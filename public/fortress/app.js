(function () {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const time = value => new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const state = {
    view: "command",
    monitorEvents: [],
    permissionAttempted: false,
    shuffling: true,
    tick: 0,
  };

  const security = new SecurityCore();
  const professor = new AIProfessor();
  const sentinel = new AISentinel();
  const portal = new TeacherPortal(professor);
  const wizer = new RandomWizer(QuestionBank.questions);
  wizer.generateSet(100);
  const shuffler = new HyperShuffler(wizer.papers);
  const god = new GodMode(security);
  const guard = new LockdownGuard(sentinel, security);
  const monitor = new LocalAccessMonitor();
  const assistant = new FortressAssistant(() => ({
    adminName: adminName(),
    monitoring: monitor.running,
    threat: sentinel.threat,
    paperCount: wizer.papers.length,
    questionCount: QuestionBank.questions.length,
    auditCount: security.audit.length,
    shadowState: god.shadow.state,
  }));

  function adminName() {
    return localStorage.getItem("nf5_admin_name") || localStorage.getItem("nf4_admin_name") || "Security Authority";
  }

  function greeting() {
    const hour = new Date().getHours();
    return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  }

  function toast(title, message) {
    const item = document.createElement("div");
    item.className = "toast";
    item.innerHTML = `<strong>${esc(title)}</strong><p>${esc(message)}</p>`;
    $("#toastStack").appendChild(item);
    setTimeout(() => item.remove(), 4200);
  }

  function setBar(id, value) {
    const el = $(id);
    if (el) el.style.width = `${Math.max(0, Math.min(100, value))}%`;
  }

  function updateIdentity() {
    $("#welcomeTimeGreeting").textContent = greeting();
    $("#welcomeAdminName").textContent = adminName();
    $("#todayLabel").textContent = new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    $("#setupAdminName").value = adminName();
  }

  function enterWorkspace() {
    $("#adminWelcome").hidden = true;
    $("#appShell").inert = false;
    $("#assistantLauncher").hidden = false;
  }

  function resetGate() {
    $("#welcomePermissionGate").hidden = false;
    $("#permissionReady").hidden = true;
    $("#permissionBlocked").hidden = true;
    $("#welcomeMonitorState").textContent = "Requesting";
    $("#welcomeEnableMonitor").disabled = false;
  }

  function showBlocked(reason) {
    $("#welcomePermissionGate").hidden = true;
    $("#permissionReady").hidden = true;
    $("#permissionBlocked").hidden = false;
    $("#blockedReason").textContent = reason || "Camera or microphone permission was declined. Administrators may continue without monitoring.";
    $("#welcomeMonitorState").textContent = "Off";
  }

  function showReady() {
    $("#welcomePermissionGate").hidden = true;
    $("#permissionBlocked").hidden = true;
    $("#permissionReady").hidden = false;
    $("#welcomeMonitorState").textContent = "Active";
  }

  function showGreeting(requestPermission = false) {
    updateIdentity();
    $("#adminWelcome").hidden = false;
    $("#appShell").inert = true;
    $("#assistantLauncher").hidden = true;
    $("#assistantPanel").hidden = true;
    if (monitor.running) showReady();
    else resetGate();
    if (requestPermission && !state.permissionAttempted) {
      state.permissionAttempted = true;
      setTimeout(() => startMonitoring(true), 350);
    }
  }

  async function startMonitoring(fromGate = false) {
    $("#welcomeEnableMonitor").disabled = true;
    $("#startMonitorBtn").disabled = true;
    try {
      await monitor.start($("#monitorVideo"), $("#monitorCanvas"));
      showReady();
      await security.log("ACCESS_MONITOR_STARTED", "Camera and microphone analysis started with browser permission", "secure");
      renderActivity();
      updateMonitorUi();
      if (!fromGate) toast("Monitoring active", "Local camera and microphone analysis is now running.");
    } catch (error) {
      showBlocked(error.message);
      await security.log("ACCESS_MONITOR_UNAVAILABLE", error.message || "Media permission unavailable", "warning");
      renderActivity();
      updateMonitorUi();
    } finally {
      $("#welcomeEnableMonitor").disabled = false;
      $("#startMonitorBtn").disabled = false;
    }
  }

  function stopMonitoring() {
    monitor.stop("Administrator stopped monitoring.");
    toast("Monitoring stopped", "Camera and microphone tracks were released.");
    updateMonitorUi();
  }

  function updateMonitorUi() {
    const running = monitor.running;
    $("#startMonitorBtn").disabled = running;
    $("#stopMonitorBtn").disabled = !running;
    $("#cameraState").textContent = running ? "Camera active" : "Camera off";
    $("#analysisState").textContent = running ? monitor.metrics.environment : "Standby";
    $("#accessMetric").textContent = running ? "Active" : "Off";
    $("#sideMonitorText").textContent = running ? "Monitoring active" : "Monitoring off";
    $("#sideMonitorDot").classList.toggle("on", running);
    $("#monitorStatusButton").classList.toggle("on", running);
    $("#monitorStatusButton b").textContent = running ? "Monitoring active" : "Monitoring off";
    $("#monitorPlaceholder").hidden = running;
  }

  function renderMonitorMetrics(metrics) {
    $("#motionValue").textContent = `${metrics.motion}%`;
    $("#lightValue").textContent = `${metrics.light}%`;
    $("#soundValue").textContent = `${metrics.sound}%`;
    $("#analysisState").textContent = metrics.environment;
    setBar("#motionBar", metrics.motion);
    setBar("#lightBar", metrics.light);
    setBar("#soundBar", metrics.sound);
    sentinel.add("media_signal", { source: "browser-monitor", velocity: Math.ceil((metrics.motion + metrics.sound) / 38) });
    renderSentinel();
  }

  function renderMonitorEvents() {
    const list = $("#monitorEventList");
    if (!state.monitorEvents.length) {
      list.innerHTML = `<div><strong>No session notices</strong><p>Monitoring events will appear here after permission is granted.</p></div>`;
      return;
    }
    list.innerHTML = state.monitorEvents.slice(-6).reverse().map(event => `<div><strong>${esc(event.kind.replaceAll("_", " "))}</strong><p>${esc(event.message)} ${event.score ? `Score ${event.score}.` : ""}</p></div>`).join("");
  }

  async function seedAudit() {
    if (security.audit.length) return;
    await security.log("AI_OS_REBUILT", "NEET Fortress v5 interface initialized", "secure");
    await security.log("QUESTION_VAULT_READY", `${QuestionBank.questions.length} questions loaded into the protected vault`, "secure");
    await security.log("PAPER_AI_READY", `${wizer.papers.length} paper candidates generated`, "info");
    await security.log("SENTINEL_READY", "Local anomaly model standing by", "secure");
  }

  function eventRow(entry) {
    return `<div><span><strong>${esc(entry.type.replaceAll("_", " "))}</strong><p>${esc(entry.detail)}</p></span><time>${time(entry.timestamp)}</time></div>`;
  }

  function renderActivity() {
    $("#activityFeed").innerHTML = security.audit.slice(-5).reverse().map(eventRow).join("");
  }

  function renderQuestionStats() {
    $("#bankMetric").textContent = QuestionBank.questions.length;
    $("#subjectStats").innerHTML = QuestionBank.stats().map(item => `<article><span>${esc(item.subject)}</span><strong>${item.count}</strong><small>${item.averageQuality}% average AI quality</small></article>`).join("");
  }

  function renderQuestions() {
    const query = $("#questionSearch").value.trim().toLowerCase();
    const list = QuestionBank.questions.filter(q => !query || `${q.text} ${q.chapter} ${q.subject}`.toLowerCase().includes(query)).slice(0, 10);
    $("#questionList").innerHTML = list.map(q => `<article><b>${esc(q.id)}</b><div><strong>${esc(q.text)}</strong><p>${esc(q.subject)} · ${esc(q.chapter)} · Level ${q.difficulty} · ${q.quality}% quality</p></div><span class="tag">${esc(q.bloom)}</span></article>`).join("") || `<article><div><strong>No questions found</strong><p>Try a subject, chapter, or a phrase from the question.</p></div></article>`;
  }

  function renderPapers() {
    $("#paperMetric").textContent = wizer.papers.length;
    $("#paperTable").innerHTML = wizer.top(8).map(paper => `<div><span><strong>${esc(paper.id)}</strong><p>${paper.questions.length} questions · balance ${paper.balance}% · quality ${paper.quality}%</p></span><span>${paper.accessCount} reads</span></div>`).join("");
  }

  function updateShuffle() {
    if (!state.shuffling) return;
    state.tick = (state.tick + 1) % 10000;
    $("#shuffleTick").textContent = String(state.tick).padStart(4, "0");
    $("#shuffleEntropy").textContent = `${(99.2 + Math.random() * 0.7).toFixed(1)}% entropy`;
  }

  function renderSentinel() {
    const threat = Math.max(0, Math.min(99, Math.round(sentinel.threat || 8)));
    $("#threatValue").textContent = String(threat).padStart(2, "0");
    $("#sentinelThreat").textContent = String(threat);
    const label = threat >= 70 ? "High risk" : threat >= 28 ? "Elevated risk" : "Low risk";
    $("#sentinelState").textContent = label;
    $("#coreSummary").textContent = `${label}. Local AI checks are reading ${monitor.running ? "live access signals" : "system-only signals"}.`;
    $("#sentinelRecommendations").innerHTML = recommendations(threat).map(item => `<div><strong>${esc(item.title)}</strong><p>${esc(item.body)}</p></div>`).join("");
    const signals = [
      ["Access environment", monitor.running ? monitor.metrics.environment : "Monitoring off"],
      ["Question vault", `${QuestionBank.questions.length} balanced items`],
      ["Paper AI", `${wizer.papers.length} candidates with rotating entropy`],
      ["Audit chain", `${security.audit.length} local events`],
    ];
    $("#sentinelTable").innerHTML = signals.map(([title, body]) => `<div><span><strong>${esc(title)}</strong><p>${esc(body)}</p></span><span>${label}</span></div>`).join("");
  }

  function recommendations(threat) {
    if (threat >= 70) return [
      { title: "Freeze paper assembly", body: "Use the audit screen before exposing any final paper candidate." },
      { title: "Review media signals", body: "Check motion and sound spikes from the current browser session." },
      { title: "Prepare shadow protocol", body: "Keep emergency continuity ready until the incident is resolved." },
    ];
    if (threat >= 28) return [
      { title: "Verify access context", body: "Review monitor notices and failed-authentication events before release." },
      { title: "Run a manual sweep", body: "Refresh the Sentinel score after the environment stabilizes." },
    ];
    return [
      { title: "Maintain monitoring consent", body: "Camera and microphone analysis is best used during sensitive admin work." },
      { title: "Verify the audit root", body: "Run an integrity check before final paper assembly." },
      { title: "Keep admin recovery current", body: "Make sure the local passphrase is known to the authorized administrator." },
    ];
  }

  async function manualSweep() {
    sentinel.add("manual_sweep", { source: "administrator", velocity: monitor.running ? 1 : 2 });
    await security.log("SENTINEL_SWEEP", "Administrator requested local AI anomaly sweep", "secure");
    renderSentinel();
    renderActivity();
    toast("Sentinel sweep complete", `Current risk is ${Math.round(sentinel.threat)}%.`);
  }

  async function renderAudit() {
    const intact = await security.verifyAudit();
    $("#merkleRoot").textContent = security.merkleRoot || "No root";
    $("#integrityStatus").textContent = intact ? `All ${security.audit.length} local events are hash-linked.` : "The audit chain failed verification.";
    $("#auditTable").innerHTML = security.audit.slice().reverse().slice(0, 12).map(eventRow).join("");
  }

  function exportAudit() {
    const blob = security.exportAudit();
    const url = URL.createObjectURL(blob);
    const anchor = Object.assign(document.createElement("a"), { href: url, download: `neet-fortress-audit-${Date.now()}.json` });
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Audit exported", "The forensic JSON package was prepared locally.");
  }

  async function initializeAdmin() {
    const pass = $("#setupPassphrase").value.trim();
    const confirm = $("#setupConfirm").value.trim();
    const name = $("#setupAdminName").value.trim() || "Security Authority";
    if (pass.length < 4) return toast("Passphrase too short", "Use at least four characters for this prototype.");
    if (pass !== confirm) return toast("Passphrases do not match", "Re-enter the same passphrase in both fields.");
    localStorage.setItem("nf5_master", pass);
    localStorage.setItem("nf5_admin_name", name);
    await security.log("ADMIN_INITIALIZED", "Local administrator profile configured", "secure");
    updateIdentity();
    renderActivity();
    toast("Admin initialized", "Your local administrator profile is ready.");
  }

  async function unlockVault() {
    const pass = $("#unlockPassphrase").value.trim();
    const master = localStorage.getItem("nf5_master") || localStorage.getItem("nf4_master") || "";
    if (pass && pass === master) {
      guard.recordAttempt({ success: true, credential: "master", source: "admin" });
      await security.log("VAULT_UNLOCKED", "Administrator authenticated the paper vault", "secure");
      $("#unlockPassphrase").value = "";
      renderActivity();
      toast("Vault authenticated", "The local vault accepted the administrator passphrase.");
      return;
    }
    guard.recordAttempt({ success: false, credential: "master", source: "admin" });
    sentinel.add("failed_login", { source: "admin", velocity: 2 });
    await security.log("VAULT_UNLOCK_FAILED", "Invalid administrator passphrase", "warning");
    renderSentinel();
    renderActivity();
    toast("Authentication failed", "The passphrase did not match this browser's local admin setup.");
  }

  function resetAdmin() {
    localStorage.removeItem("nf5_master");
    localStorage.removeItem("nf5_admin_name");
    localStorage.removeItem("nf4_master");
    localStorage.removeItem("nf4_admin_name");
    updateIdentity();
    toast("Admin setup reset", "Local administrator details were cleared in this browser.");
  }

  function navigate(view) {
    state.view = view;
    $$(".view").forEach(section => section.classList.toggle("active", section.id === `view-${view}`));
    $$(".nav button").forEach(button => button.classList.toggle("active", button.dataset.view === view));
    const active = $(`#view-${view}`);
    $("#viewTitle").textContent = active?.dataset.title || "Command";
    $(".side").classList.remove("open");
    if (view === "audit") renderAudit();
    if (view === "sentinel") renderSentinel();
    if (view === "monitor") renderMonitorEvents();
  }

  function openAssistant() {
    $("#assistantPanel").hidden = false;
    if (!$("#assistantMessages").children.length) assistantMessage(assistant.greeting(adminName()));
    $("#assistantInput").focus();
  }

  function assistantMessage(text, user = false) {
    const item = document.createElement("div");
    item.className = `assistant-message${user ? " user" : ""}`;
    item.textContent = text;
    $("#assistantMessages").appendChild(item);
    $("#assistantMessages").scrollTop = $("#assistantMessages").scrollHeight;
  }

  function askAssistant(value) {
    const query = String(value || "").trim();
    if (!query) return;
    assistantMessage(query, true);
    setTimeout(() => assistantMessage(assistant.answer(query)), 160);
  }

  function bind() {
    $$(".nav button").forEach(button => button.addEventListener("click", () => navigate(button.dataset.view)));
    $$("[data-view-jump]").forEach(button => button.addEventListener("click", () => navigate(button.dataset.viewJump)));
    $("#mobileMenu").addEventListener("click", () => $(".side").classList.toggle("open"));
    $("#showGreeting").addEventListener("click", () => showGreeting(false));
    $("#monitorStatusButton").addEventListener("click", () => navigate("monitor"));
    $("#welcomeEnableMonitor").addEventListener("click", () => startMonitoring(true));
    $("#retryMonitorPermission").addEventListener("click", () => { resetGate(); startMonitoring(true); });
    $("#continueWithoutMonitoring").addEventListener("click", enterWorkspace);
    $("#enterCommandCenter").addEventListener("click", enterWorkspace);
    $("#startMonitorBtn").addEventListener("click", () => startMonitoring(false));
    $("#stopMonitorBtn").addEventListener("click", stopMonitoring);
    $("#clearMonitorEvents").addEventListener("click", () => { state.monitorEvents = []; renderMonitorEvents(); });
    $("#questionSearch").addEventListener("input", renderQuestions);
    $("#generatePapersBtn").addEventListener("click", async () => { wizer.generateSet(100); await security.log("PAPER_SET_REGENERATED", "Paper AI regenerated the candidate pool", "info"); renderPapers(); renderActivity(); toast("Paper set regenerated", "100 new candidates are ready for review."); });
    $("#toggleShuffler").addEventListener("click", event => { state.shuffling = !state.shuffling; event.currentTarget.textContent = state.shuffling ? "Pause" : "Resume"; });
    $("#runSentinelSweep").addEventListener("click", manualSweep);
    $("#manualSentinelSweep").addEventListener("click", manualSweep);
    $("#verifyAuditBtn").addEventListener("click", async () => { await renderAudit(); toast("Audit verified", "The current Merkle root has been recalculated."); });
    $("#exportAuditBtn").addEventListener("click", exportAudit);
    $("#initializeBtn").addEventListener("click", initializeAdmin);
    $("#unlockBtn").addEventListener("click", unlockVault);
    $("#resetAdminBtn").addEventListener("click", resetAdmin);
    $("#assistantLauncher").addEventListener("click", openAssistant);
    $("#openAssistantBriefing").addEventListener("click", openAssistant);
    $("#assistantClose").addEventListener("click", () => { $("#assistantPanel").hidden = true; });
    $("#assistantForm").addEventListener("submit", event => { event.preventDefault(); askAssistant($("#assistantInput").value); $("#assistantInput").value = ""; });
    $$("#assistantPrompts button").forEach(button => button.addEventListener("click", () => askAssistant(button.textContent)));

    monitor.addEventListener("metrics", event => renderMonitorMetrics(event.detail));
    monitor.addEventListener("notice", async event => {
      state.monitorEvents.push(event.detail);
      await security.log("MONITOR_NOTICE", event.detail.message, "warning");
      renderMonitorEvents();
      renderActivity();
    });
    monitor.addEventListener("state", event => {
      if (event.detail.state === "active") showReady();
      updateMonitorUi();
    });
  }

  async function initialize() {
    bind();
    updateIdentity();
    await seedAudit();
    renderQuestionStats();
    renderQuestions();
    renderPapers();
    renderSentinel();
    renderActivity();
    renderMonitorEvents();
    updateMonitorUi();
    setInterval(updateShuffle, 1000);
    shuffler.start();
    showGreeting(true);
    globalThis.fortress = { security, sentinel, professor, portal, wizer, shuffler, god, guard, monitor, assistant, state };
  }

  document.addEventListener("DOMContentLoaded", initialize);
})();
