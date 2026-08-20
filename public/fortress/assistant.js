(function (global) {
  "use strict";

  class FortressAssistant {
    constructor(getContext = () => ({})) {
      this.getContext = getContext;
    }

    greeting(name = "Security Authority") {
      const hour = new Date().getHours();
      const period = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
      return `${period}, ${name}. I’m Fortress AI, your private on-device guide. Ask me about system status, monitoring, threat signals, papers, questions, or audits.`;
    }

    answer(input) {
      const query = String(input || "").trim().toLowerCase();
      const context = this.getContext() || {};
      const threat = Number.isFinite(context.threat) ? context.threat : 0;
      const monitor = context.monitoring ? "active" : "off";

      if (!query) return "Ask a question and I’ll help you navigate the command center.";
      if (/hello|hi\b|hey|good (morning|afternoon|evening)/.test(query)) return this.greeting(context.adminName);
      if (/privacy|record|upload|camera|microphone|mic|monitor/.test(query)) {
        return `Access monitoring is ${monitor}. Camera and microphone access is requested automatically in each new browser session. Administrators may continue if either permission is declined. Frames and audio samples are processed in memory for motion, light, and sound levels; they are not recorded, uploaded, or used to identify anyone.`;
      }
      if (/threat|risk|sentinel|alert/.test(query)) {
        return `Sentinel currently reports ${threat}% threat, classified as ${threat >= 75 ? "high" : threat >= 25 ? "elevated" : "low"} risk. Open AI Sentinel for event-level signals and prioritized recommendations.`;
      }
      if (/paper|shuffle|assembly|exam/.test(query)) {
        return `${context.paperCount || 100} candidate papers are available to the hyper-shuffler. Open Paper sets to review entropy, regenerate the set, or assemble the highest-quality final candidate.`;
      }
      if (/question|vault|bank|teacher|submission/.test(query)) {
        return `The question vault contains ${context.questionCount || 924} balanced items. Use Question bank to search and filter, or Teacher portal to submit, review, and approve new material.`;
      }
      if (/audit|integrity|merkle|security log/.test(query)) {
        return `The local audit chain contains ${context.auditCount || 0} events. Open Security audit to verify the Merkle root or export a forensic JSON report.`;
      }
      if (/status|overview|summary|brief/.test(query)) {
        return `System posture is nominal: 7 of 7 defense layers are active, Sentinel risk is ${threat}%, local monitoring is ${monitor}, and the shadow paper is ${String(context.shadowState || "dormant").toLowerCase()}.`;
      }
      if (/help|what can you do|commands|navigate/.test(query)) {
        return "I can summarize system posture, explain monitoring privacy, report Sentinel risk, describe the paper and question workflows, and point you to audit, encryption, unlock, or shadow controls. I work entirely offline.";
      }
      if (/encryption|aes|rsa|shamir|key/.test(query)) {
        return "The Encryption view demonstrates an AES-256-GCM payload, RSA-OAEP key wrapping, 3-of-5 Shamir recovery shares, and a controlled release policy using browser cryptography.";
      }
      if (/shadow|backup|emergency/.test(query)) {
        return `The shadow paper is ${String(context.shadowState || "dormant").toLowerCase()}. Deployment requires an authenticated God Mode session and records the action in the audit chain.`;
      }
      return "I don’t have a matching local briefing for that yet. Try asking about system status, monitoring privacy, Sentinel threats, paper sets, the question vault, encryption, or the security audit.";
    }
  }

  global.FortressAssistant = FortressAssistant;
})(globalThis);
