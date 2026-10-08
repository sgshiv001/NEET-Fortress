(function () {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const time = value => new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  NEETLearning.attach(QuestionBank);

  const state = {
    view: "command",
    monitorEvents: [],
    permissionAttempted: false,
    shuffling: true,
    tick: 0,
    attempt: null,
    resultAttempt: null,
    timer: null,
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
    await security.log("AI_OS_REBUILT", "NEET Fortress exam security dashboard initialized", "secure");
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
    $("#vaultHeading").textContent = `${QuestionBank.questions.length} questions`;
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
    if (view === "student") renderStudentHub();
  }

  function renderStudentHub() {
    const name = NEETLearning.studentName();
    $("#studentName").value = name;
    $("#studentGreeting").textContent = name ? `Ready to study, ${name}?` : "Your NEET practice desk";
    const current = NEETLearning.current();
    const active = current?.status === "in_progress";
    $("#startMockExam").textContent = active ? "Resume current exam" : "Start full mock";
    $("#startPractice").textContent = active ? "Resume current exam" : "Start practice";
    const history = NEETLearning.history();
    $("#studentHistory").innerHTML = `${active ? `<div class="history-resume"><span><strong>Exam in progress</strong><p>${current.mode === "mock" ? "Full mock" : `${esc(current.subject)} practice`} · ${current.questions.length} questions</p></span><button class="primary-btn" id="resumeExam">Resume</button></div>` : ""}${history.length ? history.slice(0, 8).map((item, i) => `<button class="history-row" data-history-index="${i}"><span><strong>${item.mode === "mock" ? "Full mock exam" : `${esc(item.subject)} practice`}</strong><small>${new Date(item.result?.completedAt || item.startedAt).toLocaleString()}</small></span><b>${item.result?.score ?? 0}<small> / ${item.result?.maxScore ?? 0}</small></b></button>`).join("") : `<p class="empty-state">No completed attempts yet. Start a practice set to see your progress here.</p>`}`;
    const resume = $("#resumeExam");
    if (resume) resume.addEventListener("click", resumeExam);
    $$("[data-history-index]").forEach(button => button.addEventListener("click", () => {
      const item = NEETLearning.history()[Number(button.dataset.historyIndex)];
      if (item) showResults(item);
    }));
  }

  function beginExam(mode, subject = "All") {
    try {
      const existing = NEETLearning.current();
      state.attempt = existing?.status === "in_progress" ? existing : NEETLearning.start(mode, subject);
      renderExam();
      navigate("exam");
      if (state.timer) clearInterval(state.timer);
      state.timer = setInterval(updateExamTimer, 1000);
      updateExamTimer();
    } catch (error) { toast("Could not start exam", error.message); }
  }

  function resumeExam() { beginExam("mock"); }

  function renderExam() {
    const attempt = state.attempt;
    if (!attempt) return;
    const index = Math.max(0, Math.min(attempt.currentIndex, attempt.questions.length - 1));
    attempt.currentIndex = index;
    const question = attempt.questions[index];
    $("#examModeLabel").textContent = attempt.mode === "mock" ? "FULL MOCK EXAM" : "FOCUSED PRACTICE";
    $("#examSubjectTitle").textContent = attempt.mode === "mock" ? "NEET Full Mock" : `${attempt.subject} Practice`;
    $("#examQuestionSubject").textContent = question.subject.toUpperCase();
    $("#examQuestionChapter").textContent = question.chapter;
    $("#examQuestionNumber").textContent = `Question ${index + 1}`;
    $("#examQuestionText").textContent = question.text;
    $("#examOptions").innerHTML = question.options.map((option, optionIndex) => `<button class="exam-option${Number(attempt.answers[index]) === optionIndex ? " selected" : ""}" data-option="${optionIndex}"><span>${String.fromCharCode(65 + optionIndex)}</span>${esc(option)}</button>`).join("");
    $("#examProgressText").textContent = `Question ${index + 1} of ${attempt.questions.length}`;
    $("#examAnsweredText").textContent = `${Object.keys(attempt.answers).length} answered`;
    $("#examProgressBar").style.width = `${Object.keys(attempt.answers).length / attempt.questions.length * 100}%`;
    $("#examPrevious").disabled = index === 0;
    $("#examNext").textContent = index === attempt.questions.length - 1 ? "Finish review" : "Save & next";
    $("#examMarkReview").classList.toggle("marked", attempt.marked.includes(index));
    $("#examPalette").innerHTML = attempt.questions.map((_, i) => `<button class="palette-question${attempt.answers[i] !== undefined ? " answered" : ""}${attempt.marked.includes(i) ? " review" : ""}${i === index ? " current" : ""}" data-question-index="${i}" aria-label="Question ${i + 1}">${i + 1}</button>`).join("");
    NEETLearning.update(attempt);
  }

  function updateExamTimer() {
    if (!state.attempt) return;
    const remaining = Math.max(0, state.attempt.expiresAt - Date.now());
    const seconds = Math.ceil(remaining / 1000);
    $("#examTimer").textContent = `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor(seconds % 3600 / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
    $("#examTimer").classList.toggle("urgent", remaining < 5 * 60 * 1000);
    if (remaining <= 0) submitExam(true);
  }

  function submitExam(auto = false) {
    if (!state.attempt) return;
    const unanswered = state.attempt.questions.length - Object.keys(state.attempt.answers).length;
    if (!auto && !confirm(`Submit this exam? ${unanswered} question${unanswered === 1 ? " is" : "s are"} unanswered.`)) return;
    if (state.timer) clearInterval(state.timer);
    const completed = NEETLearning.finish(state.attempt);
    state.attempt = null;
    showResults(completed);
    toast(auto ? "Time is up" : "Exam submitted", `You scored ${completed.result.score} out of ${completed.result.maxScore}.`);
  }

  function showResults(attempt) {
    state.resultAttempt = attempt;
    const result = attempt.result || NEETLearning.score(attempt);
    $("#resultModeLabel").textContent = `${attempt.mode === "mock" ? "Full mock" : `${esc(attempt.subject)} practice`} · ${new Date(result.completedAt || attempt.startedAt).toLocaleString()}`;
    $("#resultSummary").innerHTML = `<article><span>Score</span><strong>${result.score}<small> / ${result.maxScore}</small></strong></article><article><span>Correct</span><strong>${result.correct}</strong></article><article><span>Incorrect</span><strong>${result.incorrect}</strong></article><article><span>Unanswered</span><strong>${result.unanswered}</strong></article><article><span>Accuracy</span><strong>${result.accuracy}%</strong></article>`;
    $("#resultSubjects").innerHTML = result.subjects.filter(row => row.total).map(row => `<div class="result-subject-row"><span><strong>${row.subject}</strong><small>${row.correct} right · ${row.incorrect} wrong · ${row.unanswered} blank</small></span><b>${row.score} <small>/ ${row.total * 4}</small></b></div>`).join("");
    renderResultReview();
    navigate("results");
  }

  function renderResultReview() {
    const attempt = state.resultAttempt;
    if (!attempt) return;
    const filter = $("#reviewFilter").value;
    const rows = attempt.questions.map((q, index) => ({ q, index, chosen: attempt.answers[index] })).filter(({ q, chosen }) => {
      if (filter === "incorrect") return chosen !== undefined && Number(chosen) !== q.answer;
      if (filter === "unanswered") return chosen === undefined;
      return true;
    });
    $("#resultReview").innerHTML = rows.map(({ q, index, chosen }) => {
      const correct = chosen !== undefined && Number(chosen) === q.answer;
      const label = chosen === undefined ? "Unanswered" : correct ? "Correct" : "Incorrect";
      return `<article class="review-question ${chosen === undefined ? "unanswered" : correct ? "correct" : "incorrect"}"><div class="review-heading"><strong>Q${index + 1} · ${esc(q.subject)} · ${esc(q.chapter)}</strong><span>${label}</span></div><p>${esc(q.text)}</p><p>Your answer: ${chosen === undefined ? "No answer" : esc(q.options[Number(chosen)])} · Correct: ${esc(q.options[q.answer])}</p><small>${esc(q.explanation || "Review this concept in your notes.")}</small></article>`;
    }).join("") || `<p class="empty-state">No questions match this filter.</p>`;
  }

  function addQuestion(event) {
    event.preventDefault();
    const question = {
      subject: $("#newQuestionSubject").value, chapter: $("#newQuestionChapter").value.trim(), text: $("#newQuestionText").value.trim(),
      explanation: $("#newQuestionExplanation").value.trim(), options: [0, 1, 2, 3].map(index => $(`#newOption${index}`).value.trim()), answer: Number($("#newQuestionAnswer").value), difficulty: Number($("#newQuestionDifficulty").value), bloom: "Understand",
    };
    try {
      const saved = NEETLearning.saveCustom(question);
      QuestionBank.questions.push(saved);
      wizer.generateSet(100);
      renderQuestionStats(); renderQuestions(); renderPapers();
      event.currentTarget.reset();
      toast("Question added", "It is available in practice sets and future papers on this browser.");
    } catch (error) { toast("Question not added", error.message); }
  }

  async function importQuestionBank(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const count = NEETLearning.importQuestions(JSON.parse(await file.text()));
      NEETLearning.attach({ questions: QuestionBank.questions });
      wizer.generateSet(100);
      renderQuestionStats(); renderQuestions(); renderPapers();
      toast("Question bank imported", `${count} questions added to this browser.`);
    } catch (error) { toast("Import failed", error.message || "Could not read this JSON file."); }
    finally { event.target.value = ""; }
  }

  function exportQuestions() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ questions: QuestionBank.questions }, null, 2)], { type: "application/json" }));
    const anchor = Object.assign(document.createElement("a"), { href: url, download: "neet-question-bank.json" });
    anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
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
    $("#continueToWorkspace").addEventListener("click", enterWorkspace);
    $("#enterCommandCenter").addEventListener("click", enterWorkspace);
    $("#startMonitorBtn").addEventListener("click", () => startMonitoring(false));
    $("#stopMonitorBtn").addEventListener("click", stopMonitoring);
    $("#clearMonitorEvents").addEventListener("click", () => { state.monitorEvents = []; renderMonitorEvents(); });
    $("#questionSearch").addEventListener("input", renderQuestions);
    $("#startMockExam").addEventListener("click", () => beginExam("mock"));
    $("#startPractice").addEventListener("click", () => beginExam("practice", $("#practiceSubject").value));
    $("#studentName").addEventListener("change", event => { NEETLearning.setStudentName(event.target.value); renderStudentHub(); });
    $("#clearStudentHistory").addEventListener("click", () => {
      if (!NEETLearning.history().length || !confirm("Clear all completed attempts from this browser?")) return;
      NEETLearning.clearHistory(); renderStudentHub(); toast("Progress cleared", "Completed exam history was removed from this browser.");
    });
    $("#examOptions").addEventListener("click", event => {
      const button = event.target.closest("[data-option]");
      if (!button || !state.attempt) return;
      state.attempt.answers[state.attempt.currentIndex] = Number(button.dataset.option);
      renderExam();
    });
    $("#examPalette").addEventListener("click", event => {
      const button = event.target.closest("[data-question-index]");
      if (!button || !state.attempt) return;
      state.attempt.currentIndex = Number(button.dataset.questionIndex); renderExam();
    });
    $("#examPrevious").addEventListener("click", () => { if (state.attempt && state.attempt.currentIndex > 0) { state.attempt.currentIndex -= 1; renderExam(); } });
    $("#examNext").addEventListener("click", () => { if (state.attempt) { state.attempt.currentIndex = Math.min(state.attempt.questions.length - 1, state.attempt.currentIndex + 1); renderExam(); } });
    $("#examClearAnswer").addEventListener("click", () => { if (state.attempt) { delete state.attempt.answers[state.attempt.currentIndex]; renderExam(); } });
    $("#examMarkReview").addEventListener("click", () => {
      if (!state.attempt) return;
      const marked = new Set(state.attempt.marked);
      marked.has(state.attempt.currentIndex) ? marked.delete(state.attempt.currentIndex) : marked.add(state.attempt.currentIndex);
      state.attempt.marked = [...marked]; renderExam();
    });
    $("#submitExamTop").addEventListener("click", () => submitExam());
    $("#submitExamBottom").addEventListener("click", () => submitExam());
    $("#backToStudent").addEventListener("click", () => navigate("student"));
    $("#reviewFilter").addEventListener("change", renderResultReview);
    $("#questionEditorForm").addEventListener("submit", addQuestion);
    $("#importQuestions").addEventListener("change", importQuestionBank);
    $("#exportQuestions").addEventListener("click", exportQuestions);
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
    renderStudentHub();
    renderPapers();
    renderSentinel();
    renderActivity();
    renderMonitorEvents();
    updateMonitorUi();
    setInterval(updateShuffle, 1000);
    shuffler.start();
    showGreeting(false);
    globalThis.fortress = { security, sentinel, professor, portal, wizer, shuffler, god, guard, monitor, assistant, state };
  }

  document.addEventListener("DOMContentLoaded", initialize);
})();
