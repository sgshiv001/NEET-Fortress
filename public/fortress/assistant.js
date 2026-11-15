(function (global) {
  "use strict";

  class FortressAssistant {
    constructor(getContext = () => ({})) {
      this.getContext = getContext;
    }

    greeting(name) {
      const hour = new Date().getHours();
      const period = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
      return `${period}${name ? `, ${name}` : ""}. I’m the Exam Fortress assistant. Ask about monitoring, risk signals, exam setup, question banks, or audits.`;
    }

    answer(input) {
      const query = String(input || "").trim().toLowerCase();
      const context = this.getContext() || {};
      const threat = Number.isFinite(context.threat) ? context.threat : 0;
      const monitor = context.monitoring ? "active" : "off";

      if (!query) return "Ask a question and I’ll help you navigate the command center.";
      if (/\b(hello|hi|hey|good (morning|afternoon|evening))\b/.test(query)) return this.greeting(context.name);
      if (/privacy|record|upload|camera|microphone|mic|monitor/.test(query)) {
        return `Access monitoring is ${monitor}. It starts when a staff user chooses Enable monitoring and grants browser permission. Candidates can take exams without granting camera or microphone access. Frames and audio samples are analyzed for motion, light, and sound in memory. Media is not recorded, stored, or uploaded.`;
      }
      if (/threat|risk|sentinel|alert/.test(query)) {
        return `The simulated risk score is ${threat}%. Open Risk signals to review the inputs and suggested actions.`;
      }
      if (/paper|shuffle|assembly|exam/.test(query)) {
        return `${context.paperCount || 0} variants have been generated for the current session. Open Exam setup to configure an assessment and generate randomized paper variants.`;
      }
      if (/question|vault|bank|teacher|submission/.test(query)) {
        return `The organization bank contains ${context.questionCount || 0} questions. Open Question bank to add questions or import a JSON file.`;
      }
      if (/audit|integrity|merkle|security log/.test(query)) {
        return `The local audit chain contains ${context.auditCount || 0} events. Open Security audit to verify the Merkle root or export a forensic JSON report.`;
      }
      if (/status|overview|summary|brief/.test(query)) {
        return `Local monitoring is ${monitor}. This browser has ${context.auditCount || 0} audit events and ${context.paperCount || 0} paper variants in this session.`;
      }
      if (/help|what can you do|commands|navigate/.test(query)) {
        return "I can summarize this browser’s activity and explain exam setup, the question bank, monitoring, and the audit.";
      }
      return "Try asking about monitoring privacy, risk signals, exam setup, the question bank, or the security audit.";
    }
  }

  global.FortressAssistant = FortressAssistant;
})(globalThis);
