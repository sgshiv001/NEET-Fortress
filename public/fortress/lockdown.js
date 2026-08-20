(function (global) {
  "use strict";

  class LockdownGuard extends EventTarget {
    constructor(sentinel, security) {
      super(); this.sentinel = sentinel; this.security = security; this.attemptKey = "nf4_attempt_log"; this.lockKey = "nf4_lockdown";
      this.attempts = JSON.parse(localStorage.getItem(this.attemptKey) || "[]");
      this.state = JSON.parse(localStorage.getItem(this.lockKey) || "null");
      if (this.state && this.state.until <= Date.now()) this.clear(false);
    }
    recordAttempt({ credential = "master", success = false, device = "local", source = "unlock" } = {}) {
      const entry = { at: Date.now(), credential, success, device, source };
      this.attempts.push(entry); this.attempts = this.attempts.filter(a => Date.now() - a.at < 24 * 60 * 60 * 1000);
      localStorage.setItem(this.attemptKey, JSON.stringify(this.attempts));
      if (success) return { locked: false, reason: null };
      const result = this.detect();
      if (result.reason) this.trigger(result.reason, result.engine);
      return { locked: Boolean(this.state), ...result };
    }
    detect() {
      const now = Date.now(), failed = this.attempts.filter(a => !a.success);
      const fiveMinutes = failed.filter(a => now - a.at <= 300000);
      if (fiveMinutes.length >= 5) return { engine: "BRUTE_FORCE", reason: "Five or more failed attempts within five minutes" };
      const thirtySeconds = failed.filter(a => now - a.at <= 30000);
      if (thirtySeconds.length >= 3) return { engine: "RATE_LIMITER", reason: "Three or more attempts within thirty seconds" };
      const recent = failed.filter(a => now - a.at <= 600000);
      if (new Set(recent.map(a => a.credential)).size >= 4) return { engine: "CREDENTIAL_STUFFING", reason: "Multiple credentials attempted from one device" };
      if (recent.length >= 4) {
        const intervals = recent.slice(1).map((a, i) => a.at - recent[i].at);
        const spread = Math.max(...intervals) - Math.min(...intervals);
        if (spread < 120) return { engine: "AUTOMATION", reason: "Regular scripted timing pattern detected" };
      }
      return { engine: null, reason: null };
    }
    trigger(reason, engine = "MANUAL", duration = 24 * 60 * 60 * 1000) {
      this.state = { since: Date.now(), until: Date.now() + duration, reason, engine };
      localStorage.setItem(this.lockKey, JSON.stringify(this.state));
      this.sentinel?.add(engine.toLowerCase(), { velocity: 8 }); this.security?.log("LOCKDOWN_TRIGGERED", `${engine}: ${reason}`, "critical");
      this.dispatchEvent(new CustomEvent("lock", { detail: this.state })); return this.state;
    }
    clear(log = true) { this.state = null; localStorage.removeItem(this.lockKey); this.attempts = []; localStorage.setItem(this.attemptKey, "[]"); if (log) this.security?.log("LOCKDOWN_RECOVERED", "Authorized recovery key accepted", "secure"); this.dispatchEvent(new Event("clear")); }
    remaining() { return this.state ? Math.max(0, this.state.until - Date.now()) : 0; }
    isLocked() { return this.remaining() > 0; }
    recover(key) { if (key && key === localStorage.getItem("nf4_master")) { this.clear(true); return true; } this.security?.log("RECOVERY_FAILED", "Invalid recovery key supplied", "critical"); return false; }
  }

  global.LockdownGuard = LockdownGuard;
})(window);
