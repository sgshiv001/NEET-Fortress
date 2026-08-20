(function (global) {
  "use strict";

  function fallbackHash(value) {
    let h1 = 0xdeadbeef ^ value.length;
    let h2 = 0x41c6ce57 ^ value.length;
    for (let i = 0, ch; i < value.length; i += 1) {
      ch = value.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(16, "0").repeat(4).slice(0, 64);
  }

  async function sha256(value) {
    const input = typeof value === "string" ? value : JSON.stringify(value);
    if (global.crypto && global.crypto.subtle) {
      const data = new TextEncoder().encode(input);
      const result = await global.crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(result)).map(b => b.toString(16).padStart(2, "0")).join("");
    }
    return fallbackHash(input);
  }

  class MerkleTree {
    constructor(items = []) { this.items = items; this.levels = []; this.root = ""; }
    async build() {
      let level = await Promise.all(this.items.map(sha256));
      this.levels = [level];
      if (!level.length) level = [await sha256("")];
      while (level.length > 1) {
        const next = [];
        for (let i = 0; i < level.length; i += 2) next.push(await sha256(level[i] + (level[i + 1] || level[i])));
        level = next;
        this.levels.unshift(level);
      }
      this.root = level[0];
      return this.root;
    }
    async verify(items = this.items) { const other = new MerkleTree(items); return (await other.build()) === this.root; }
  }

  class BloomFilter {
    constructor(size = 128, hashes = 4) { this.size = size; this.hashes = hashes; this.bits = new Uint8Array(size); }
    indices(value) { const h = fallbackHash(String(value)); return Array.from({ length: this.hashes }, (_, i) => parseInt(h.slice(i * 8, i * 8 + 8), 16) % this.size); }
    add(value) { this.indices(value).forEach(i => { this.bits[i] = 1; }); return this; }
    has(value) { return this.indices(value).every(i => this.bits[i]); }
  }

  class RankTree {
    constructor() { this.nodes = []; }
    insert(key, value) { this.nodes.push({ key, value, color: this.nodes.length % 2 ? "red" : "black" }); this.nodes.sort((a, b) => b.key - a.key); return this; }
    getTopK(k) { return this.nodes.slice(0, k).map(n => n.value); }
  }

  class TrieNode { constructor() { this.children = Object.create(null); this.ids = new Set(); this.end = false; } }
  class Trie {
    constructor() { this.root = new TrieNode(); }
    insert(text, id = text) { let n = this.root; String(text).toLowerCase().split(/\s+/).forEach(word => { for (const ch of word) { n.children[ch] ||= new TrieNode(); n = n.children[ch]; n.ids.add(id); } n.children[" "] ||= new TrieNode(); n = n.children[" "]; }); n.end = true; }
    searchPrefix(prefix) { let n = this.root; for (const ch of String(prefix).toLowerCase()) { if (!n.children[ch]) return []; n = n.children[ch]; } return Array.from(n.ids); }
  }

  const PRIME = 257;
  const mod = n => ((n % PRIME) + PRIME) % PRIME;
  const inv = n => { let a = mod(n), b = PRIME, x = 1, y = 0; while (b) { const q = Math.floor(a / b); [a, b] = [b, a % b]; [x, y] = [y, x - q * y]; } return mod(x); };
  class ShamirSecretSharing {
    split(bytes, total = 5, threshold = 3) {
      const source = bytes instanceof Uint8Array || ArrayBuffer.isView(bytes)
        ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
        : new TextEncoder().encode(String(bytes));
      return Array.from({ length: total }, (_, n) => ({ x: n + 1, y: [] })).map((share, shareIndex, shares) => {
        source.forEach((secret, byteIndex) => {
          const coeffs = [secret];
          for (let j = 1; j < threshold; j += 1) coeffs.push((secret * (j + 3) + byteIndex * 17 + j * 29) % PRIME);
          shares.forEach(s => { let y = 0; coeffs.forEach((c, power) => { y = mod(y + c * Math.pow(s.x, power)); }); s.y[byteIndex] = y; });
        });
        return share;
      });
    }
    combine(shares) {
      const length = shares[0].y.length;
      const result = new Uint8Array(length);
      for (let p = 0; p < length; p += 1) {
        let secret = 0;
        shares.forEach((share, i) => {
          let basis = 1;
          shares.forEach((other, j) => { if (i !== j) basis = mod(basis * mod(-other.x) * inv(share.x - other.x)); });
          secret = mod(secret + share.y[p] * basis);
        });
        result[p] = secret % 256;
      }
      return result;
    }
  }

  class ConsistentHashRing {
    constructor() { this.ring = []; }
    addNode(name, replicas = 8) { for (let i = 0; i < replicas; i += 1) this.ring.push({ point: parseInt(fallbackHash(name + i).slice(0, 8), 16), name }); this.ring.sort((a, b) => a.point - b.point); }
    get(key) { if (!this.ring.length) return null; const point = parseInt(fallbackHash(key).slice(0, 8), 16); return (this.ring.find(n => n.point >= point) || this.ring[0]).name; }
  }

  class HashChain {
    constructor() { this.blocks = []; }
    async append(data) { const previous = this.blocks.at(-1)?.hash || "0".repeat(64); const block = { index: this.blocks.length, timestamp: Date.now(), data, previous }; block.hash = await sha256(block); this.blocks.push(block); return block; }
    async verify() { for (let i = 0; i < this.blocks.length; i += 1) { const b = this.blocks[i]; if (i && b.previous !== this.blocks[i - 1].hash) return false; const copy = { index: b.index, timestamp: b.timestamp, data: b.data, previous: b.previous }; if (await sha256(copy) !== b.hash) return false; } return true; }
  }

  class HMACTree {
    async sign(items, keyText) { const key = await sha256(keyText); const tree = new MerkleTree(items.map(x => key + JSON.stringify(x))); await tree.build(); return { root: tree.root, levels: tree.levels }; }
  }

  global.FortressDSA = { sha256, fallbackHash, MerkleTree, BloomFilter, RankTree, Trie, ShamirSecretSharing, ConsistentHashRing, HashChain, HMACTree };
})(window);
