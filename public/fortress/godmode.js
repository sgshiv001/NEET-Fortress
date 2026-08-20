(function (global) {
  "use strict";

  class GodMode extends EventTarget {
    constructor(security) {
      super(); this.security = security; this.sequence = []; this.sessionUntil = 0;
      this.shadow = JSON.parse(localStorage.getItem("nf4_shadow") || '{"state":"DORMANT","updatedAt":0}');
      this.bans = JSON.parse(localStorage.getItem("nf4_bans") || "[]");
      this.sessionKey = new Date().toISOString().slice(0, 10);
      this.sessions = JSON.parse(localStorage.getItem("nf4_god_sessions") || "{}");
      global.addEventListener("keydown", e => this.keyHandler(e));
    }
    keyHandler(event) {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "g") { this.sequence = ["g"]; return; }
      if (this.sequence[0] === "g" && event.key.toLowerCase() === "o") { this.sequence.push("o"); return; }
      if (this.sequence.join("") === "go" && event.key.toLowerCase() === "d") { this.sequence = []; this.dispatchEvent(new Event("request-open")); }
    }
    canOpen() { return (this.sessions[this.sessionKey] || 0) < 3 || Date.now() < this.sessionUntil; }
    authenticate(passphrase) {
      if (!this.canOpen()) return false;
      const ok = passphrase && passphrase === localStorage.getItem("nf4_master");
      if (ok) { this.sessions[this.sessionKey] = (this.sessions[this.sessionKey] || 0) + 1; localStorage.setItem("nf4_god_sessions", JSON.stringify(this.sessions)); this.sessionUntil = Date.now() + 5 * 60 * 1000; this.security.log("GOD_MODE_AUTH", "Emergency authority session opened", "critical"); }
      return ok;
    }
    active() { return Date.now() < this.sessionUntil; }
    setShadow(state) {
      if (!["DORMANT", "STANDBY", "DEPLOYED"].includes(state)) throw new Error("Invalid shadow state");
      this.shadow = { state, updatedAt: Date.now() }; localStorage.setItem("nf4_shadow", JSON.stringify(this.shadow));
      this.security.log("SHADOW_STATE", `Shadow paper moved to ${state}`, state === "DEPLOYED" ? "critical" : "warning");
      this.dispatchEvent(new CustomEvent("shadow", { detail: this.shadow })); return this.shadow;
    }
    ban(identity, level = 3, reason = "Confirmed paper compromise") {
      const names = ["Suspension", "System Ban", "Total Blacklist", "Nuclear Ban"];
      const record = { id: `BAN-${Date.now().toString(36).toUpperCase()}`, identity, level, name: names[level - 1], reason, at: Date.now() };
      this.bans.unshift(record); localStorage.setItem("nf4_bans", JSON.stringify(this.bans)); this.security.log("IDENTITY_BAN", `${identity} · Level ${level} ${record.name}`, "critical"); return record;
    }
  }

  global.GodMode = GodMode;
})(window);
