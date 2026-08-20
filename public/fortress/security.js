(function (global) {
  "use strict";

  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const toBase64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
  const fromBase64 = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));

  class SecurityCore {
    constructor() {
      this.storageKey = "nf4_audit";
      this.audit = JSON.parse(localStorage.getItem(this.storageKey) || "[]");
      this.fingerprint = this.makeFingerprint();
      this.merkleRoot = "";
    }
    makeFingerprint() {
      return global.FortressDSA.fallbackHash([navigator.userAgent, screen.width, screen.height, navigator.language].join("|")).slice(0, 16).toUpperCase();
    }
    async log(type, detail, severity = "info") {
      const previous = this.audit.at(-1)?.hash || "0".repeat(64);
      const entry = { id: `EVT-${String(this.audit.length + 1).padStart(5, "0")}`, timestamp: Date.now(), type, detail, severity, device: this.fingerprint, previous };
      entry.hash = await global.FortressDSA.sha256(entry);
      this.audit.push(entry);
      if (this.audit.length > 500) this.audit = this.audit.slice(-500);
      localStorage.setItem(this.storageKey, JSON.stringify(this.audit));
      global.dispatchEvent(new CustomEvent("fortress-audit", { detail: entry }));
      return entry;
    }
    async verifyAudit() {
      for (let i = 0; i < this.audit.length; i += 1) {
        const entry = this.audit[i];
        if (i && entry.previous !== this.audit[i - 1].hash) return false;
        const source = { id: entry.id, timestamp: entry.timestamp, type: entry.type, detail: entry.detail, severity: entry.severity, device: entry.device, previous: entry.previous };
        if (await global.FortressDSA.sha256(source) !== entry.hash) return false;
      }
      const tree = new global.FortressDSA.MerkleTree(this.audit.map(e => e.hash));
      this.merkleRoot = await tree.build();
      return true;
    }
    async encryptAES(payload) {
      if (!crypto.subtle) throw new Error("Web Crypto is unavailable in this context.");
      const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(payload)));
      const rawKey = await crypto.subtle.exportKey("raw", key);
      return { key, rawKey: new Uint8Array(rawKey), iv, ciphertext };
    }
    async generateRSA() {
      return crypto.subtle.generateKey({ name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["encrypt", "decrypt"]);
    }
    async encryptPaper(paper, releaseAt = Date.now()) {
      const aes = await this.encryptAES(paper);
      const rsa = await this.generateRSA();
      const wrappedKey = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, rsa.publicKey, aes.rawKey);
      const privateBytes = new Uint8Array(await crypto.subtle.exportKey("pkcs8", rsa.privateKey));
      const sharing = new global.FortressDSA.ShamirSecretSharing();
      const shares = sharing.split(privateBytes, 5, 3);
      const envelope = {
        algorithm: "AES-256-GCM / RSA-OAEP-2048 / Shamir 3-of-5",
        payload: toBase64(aes.ciphertext), iv: toBase64(aes.iv), wrappedKey: toBase64(wrappedKey),
        shares: shares.map(s => ({ x: s.x, y: s.y })), releaseAt, paperId: paper.id,
        digest: await global.FortressDSA.sha256(toBase64(aes.ciphertext))
      };
      await this.log("ENCRYPTION_COMPLETE", `${paper.id} sealed with four-layer envelope`, "secure");
      return envelope;
    }
    isTimeUnlocked(envelope) { return Date.now() >= envelope.releaseAt; }
    exportAudit() {
      return new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), fingerprint: this.fingerprint, merkleRoot: this.merkleRoot, events: this.audit }, null, 2)], { type: "application/json" });
    }
    shortHash(hash) { return `${hash.slice(0, 10)}…${hash.slice(-8)}`; }
    decodeBase64(value) { return dec.decode(fromBase64(value)); }
  }

  global.SecurityCore = SecurityCore;
})(window);
