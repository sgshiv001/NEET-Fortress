(function (global) {
  "use strict";

  class AIProfessor {
    analyze(question) {
      const completeness = Math.min(25, question.text.trim().length / 4);
      const optionScore = Array.isArray(question.options) && question.options.length === 4 ? 20 : 5;
      const metadata = [question.subject, question.chapter, question.difficulty].filter(Boolean).length * 5;
      const clarity = /\?|is$|are$|the$/i.test(question.text.trim()) ? 18 : 14;
      const discrimination = Math.round((question.discrimination || .42) * 20);
      const score = Math.min(99, Math.round(completeness + optionScore + metadata + clarity + discrimination));
      return { score, difficulty: question.difficulty || 3, discrimination: question.discrimination || +(0.28 + score / 220).toFixed(2), bloom: question.bloom || ["Remember", "Understand", "Apply", "Analyse", "Evaluate"][Math.max(0, (question.difficulty || 3) - 1)], flags: score < 70 ? ["Requires editorial review"] : [] };
    }
    scorePaper(paper) {
      const counts = paper.questions.reduce((a, q) => ((a[q.subject] = (a[q.subject] || 0) + 1), a), {});
      const balanced = ["Physics", "Chemistry", "Botany", "Zoology"].every(s => counts[s] === 45);
      const quality = Math.round(paper.questions.reduce((s, q) => s + this.analyze(q).score, 0) / paper.questions.length);
      return { score: Math.min(100, quality + (balanced ? 7 : -15)), balanced, counts };
    }
  }

  class AISentinel extends EventTarget {
    constructor() {
      super();
      this.key = "nf4_sentinel_events";
      this.events = JSON.parse(localStorage.getItem(this.key) || "[]");
      this.threat = this.calculateThreat();
    }
    add(kind, detail = {}) {
      const event = { id: `SN-${Date.now().toString(36).toUpperCase()}`, at: Date.now(), kind, detail, score: this.scoreEvent(kind, detail) };
      this.events.unshift(event);
      this.events = this.events.slice(0, 120);
      localStorage.setItem(this.key, JSON.stringify(this.events));
      this.threat = this.calculateThreat();
      this.dispatchEvent(new CustomEvent("threat", { detail: { event, threat: this.threat } }));
      return event;
    }
    scoreEvent(kind, detail) {
      const base = { access: 2, failed_login: 18, rapid_attempt: 28, automation: 38, credential_stuffing: 52, compromise: 85, sweep: 0 }[kind] ?? 5;
      return Math.min(100, base + (detail.velocity || 0) * 3);
    }
    calculateThreat() {
      const recent = this.events.filter(e => Date.now() - e.at < 5 * 60 * 1000);
      if (!recent.length) return 8;
      return Math.min(100, Math.round(8 + recent.reduce((s, e) => s + e.score, 0) / Math.max(2, recent.length)));
    }
    level() { return this.threat >= 75 ? "Critical" : this.threat >= 50 ? "High" : this.threat >= 25 ? "Medium" : "Low"; }
    recommendations() {
      if (this.threat >= 75) return ["Move shadow paper to standby", "Freeze contributor access", "Initiate forensic export"];
      if (this.threat >= 50) return ["Rotate active paper keys", "Review high-velocity access", "Increase authority checks"];
      if (this.threat >= 25) return ["Review recent authentication failures", "Verify device fingerprints", "Continue enhanced monitoring"];
      return ["Maintain continuous shuffle", "Verify Merkle root on schedule", "Keep shadow paper dormant"];
    }
  }

  global.AIProfessor = AIProfessor;
  global.AISentinel = AISentinel;
})(window);
