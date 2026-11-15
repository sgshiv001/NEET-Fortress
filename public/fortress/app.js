(function () {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const time = value => new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  ExamLearning.attach(QuestionBank);

  const state = {
    view: null,
    profile: null,
    monitorEvents: [],
    monitorPending: false,
    paperExam: null,
    attempt: null,
    resultAttempt: null,
    timer: null,
  };

  const security = new SecurityCore();
  const professor = new AIProfessor();
  const sentinel = new AISentinel();
  const portal = new TeacherPortal(professor);
  const wizer = new RandomWizer([]);
  const god = new GodMode(security);
  const guard = new LockdownGuard(sentinel, security);
  const monitor = new LocalAccessMonitor();
  const assistant = new FortressAssistant(() => ({
    name: displayName(),
    monitoring: monitor.running,
    threat: sentinel.threat,
    paperCount: wizer.papers.length,
    questionCount: ExamLearning.questionPool("organization").length,
    auditCount: security.audit.length,
  }));

  function displayName(profile = state.profile) {
    return ExamWorkspace.account()?.displayName || profile?.name || "";
  }

  function canView(view) {
    const role = ExamWorkspace.roles[state.profile.role];
    return role.views.includes(view) || (role.views.includes("student") && ["exam", "results"].includes(view));
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

  function profileFromForm() {
    return {
      name: $("#profileName").value,
      organization: $("#profileOrganization").value,
      type: $("#profileType").value,
      role: $("#profileRole").value,
    };
  }

  function renderWelcome(profile) {
    const name = displayName(profile).trim();
    const type = ExamWorkspace.types[profile.type];
    $("#welcomeTimeGreeting").textContent = ExamWorkspace.greeting();
    $("#welcomeUserName").textContent = name ? `, ${name}` : "";
    $("#welcomeOrganization").textContent = [profile.organization.trim(), type].filter(Boolean).join(" · ") || "Exam security workspace";
    $("#welcomeRole").textContent = ExamWorkspace.roles[profile.role].label;
    $("#welcomeAccess").textContent = ExamWorkspace.account() ? "Signed in · Local preview" : "Local preview";
  }

  function showGreeting(focus = true) {
    $("#profileName").value = displayName();
    $("#profileName").readOnly = Boolean(ExamWorkspace.account());
    $("#profileOrganization").value = state.profile.organization;
    $("#profileType").value = state.profile.type;
    $("#profileRole").value = state.profile.role;
    $("#workspaceError").hidden = true;
    renderWelcome(state.profile);
    $("#workspaceWelcome").hidden = false;
    $("#appShell").inert = true;
    $("#assistantLauncher").hidden = true;
    $("#assistantPanel").hidden = true;
    if (focus) $("#welcomeHeading").focus();
  }

  function enterWorkspace(event) {
    event.preventDefault();
    const previous = state.profile;
    try {
      const profile = profileFromForm();
      if (ExamWorkspace.account()) profile.name = "";
      state.profile = ExamWorkspace.save(profile);
    } catch {
      $("#workspaceError").textContent = "Browser storage is unavailable. Allow local storage and try again.";
      $("#workspaceError").hidden = false;
      return;
    }
    const { role, organization } = state.profile;
    $("#workspaceUser").textContent = displayName() || "Guest";
    $("#workspaceRole").textContent = ExamWorkspace.roles[role].label;
    $("#sidebarOrganization").textContent = organization || "Exam security";
    $("#candidateOrganization").textContent = organization || "Exam Fortress";
    $("#setupAdminName").value = localStorage.getItem("nf5_admin_name") || localStorage.getItem("nf4_admin_name") || displayName();
    $$(".nav [data-view]").forEach(button => { button.hidden = !canView(button.dataset.view); });
    $("#sidebarMonitor").hidden = !canView("monitor");
    $("#monitorStatusButton").hidden = !canView("monitor");
    if (!canView("monitor") && monitor.running) monitor.stop();
    if (previous.role !== role || previous.name !== state.profile.name) $("#assistantMessages").replaceChildren();
    $("#workspaceWelcome").hidden = true;
    $("#appShell").inert = false;
    $("#assistantLauncher").hidden = !canView("command");
    navigate(previous.role === role && state.view ? state.view : ExamWorkspace.roles[role].home);
    $("#viewTitle").focus();
  }

  async function startMonitoring() {
    if (!canView("monitor") || state.monitorPending || monitor.running) return;
    state.monitorPending = true;
    updateMonitorUi();
    $("#monitorFeedback").textContent = "Waiting for browser permission.";
    try {
      await monitor.start($("#monitorVideo"), $("#monitorCanvas"));
      if (!canView("monitor")) {
        monitor.stop();
        $("#monitorFeedback").textContent = "";
        return;
      }
      await security.log("ACCESS_MONITOR_STARTED", "Camera and microphone analysis started with browser permission", "secure");
      renderActivity();
      $("#monitorFeedback").textContent = "Monitoring is active in this browser.";
    } catch (error) {
      $("#monitorFeedback").textContent = `Monitoring could not start. ${error.message || "Check your browser permissions."}`;
      await security.log("ACCESS_MONITOR_UNAVAILABLE", error.message || "Media permission unavailable", "warning");
      renderActivity();
    } finally {
      state.monitorPending = false;
      updateMonitorUi();
    }
  }

  function stopMonitoring() {
    monitor.stop("Administrator stopped monitoring.");
    $("#monitorFeedback").textContent = "Camera and microphone are off.";
    toast("Monitoring stopped", "Camera and microphone tracks were released.");
    updateMonitorUi();
  }

  function updateMonitorUi() {
    const running = monitor.running;
    $("#startMonitorBtn").disabled = running || state.monitorPending;
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
    await security.log("WORKSPACE_STARTED", "Exam Fortress browser workspace initialized", "info");
  }

  function eventRow(entry) {
    return `<div><span><strong>${esc(entry.type.replaceAll("_", " "))}</strong><p>${esc(entry.detail)}</p></span><time>${time(entry.timestamp)}</time></div>`;
  }

  function renderActivity() {
    $("#activityFeed").innerHTML = security.audit.slice(-5).reverse().map(eventRow).join("");
  }

  async function recordExamEvent(type, attempt) {
    try {
      await security.log(type, attemptName(attempt), "info");
      renderActivity();
    } catch {
      toast("Audit entry unavailable", "This browser could not save the exam activity.");
    }
  }

  function renderQuestionStats() {
    const bank = ExamLearning.questionPool($("#questionBankSource").value);
    $("#bankMetric").textContent = ExamLearning.questionPool("organization").length;
    $("#vaultHeading").textContent = `${bank.length} questions`;
    $("#subjectStats").innerHTML = QuestionBank.stats(bank).map(item => `<article><span>${esc(item.subject)}</span><strong>${item.count}</strong></article>`).join("");
  }

  function renderQuestions() {
    const query = $("#questionSearch").value.trim().toLowerCase();
    const bank = ExamLearning.questionPool($("#questionBankSource").value);
    const list = bank.filter(q => !query || `${q.text} ${q.chapter} ${q.subject}`.toLowerCase().includes(query)).slice(0, 10);
    $("#questionList").innerHTML = list.map(q => `<article><div><strong>${esc(q.text)}</strong><p>${esc(q.subject)} · ${esc(q.chapter)} · Difficulty ${esc(q.difficulty)}</p></div></article>`).join("") || `<article><div><strong>No questions found</strong><p>${query ? "Search by subject, topic, or question text." : "Add a question or import a question bank to get started."}</p></div></article>`;
  }

  function renderPapers() {
    $("#paperMetric").textContent = wizer.papers.length;
    $("#paperVariantsHeading").textContent = state.paperExam ? `Paper variants for ${state.paperExam}` : "Paper variants";
    $("#paperTable").innerHTML = wizer.papers.map(paper => {
      const subjects = QuestionBank.stats(paper.questions).map(item => `${esc(item.subject)} (${item.count})`).join(" · ");
      return `<div><span><strong>${esc(paper.id)}</strong><p>${subjects}</p></span><span>${paper.questions.length} questions</span></div>`;
    }).join("") || '<p class="empty-state">Generate variants to see how questions are distributed across subjects.</p>';
  }

  function setOptions(select, items) {
    select.replaceChildren(select.options[0], ...items.map(([value, label]) => new Option(label, value)));
  }

  function updateExamSubjects(subject = $("#examSubject").value) {
    const source = $("#examSource").value;
    const select = $("#examSubject");
    setOptions(select, ExamLearning.subjects(source).map(name => [name, name]));
    select.value = Array.from(select.options).some(option => option.value === subject) ? subject : "";
    const available = ExamLearning.questionPool(source, select.value).length;
    $("#examAvailability").textContent = `${available} questions available in this selection.`;
  }

  function renderExamCatalog(id = $("#savedExamEdit").value) {
    const catalog = ExamLearning.exams();
    const select = $("#savedExamEdit");
    setOptions(select, catalog.map(exam => [exam.id, exam.name]));
    select.value = catalog.some(exam => exam.id === id) ? id : "";
    $("#removeExam").hidden = !select.value;
    $("#examMetric").textContent = catalog.length;
  }

  function loadExamForm() {
    const form = $("#examSetupForm");
    const exam = ExamLearning.exams().find(item => item.id === $("#savedExamEdit").value);
    form.reset();
    if (exam) {
      for (const field of ["name", "source", "count", "minutes", "correct", "incorrect"]) form.elements.namedItem(field).value = exam[field];
    }
    updateExamSubjects(exam?.subject || "");
    $("#removeExam").hidden = !exam;
  }

  function examFormValues() {
    return Object.fromEntries(new FormData($("#examSetupForm")));
  }

  async function saveExam(event) {
    event.preventDefault();
    try {
      const exam = ExamLearning.saveExam(examFormValues(), $("#savedExamEdit").value || undefined);
      renderExamCatalog(exam.id);
      await security.log("EXAM_SAVED", `Exam configuration saved for ${exam.name}`, "info");
      renderActivity();
      toast("Exam saved", `${exam.name} is available in the candidate hub.`);
    } catch (error) { toast("Could not save exam", error.message); }
  }

  async function removeExam() {
    const exam = ExamLearning.exams().find(item => item.id === $("#savedExamEdit").value);
    if (!exam || !confirm(`Remove ${exam.name} from the candidate hub?`)) return;
    try {
      ExamLearning.removeExam(exam.id);
      renderExamCatalog("");
      loadExamForm();
      await security.log("EXAM_REMOVED", `Exam configuration removed for ${exam.name}`, "info");
      renderActivity();
      toast("Exam removed", "Existing attempts remain in candidate history.");
    } catch (error) { toast("Could not remove exam", error.message); }
  }

  async function generatePapers() {
    if (!$("#examSetupForm").reportValidity()) return;
    try {
      const exam = ExamLearning.validateExam(examFormValues());
      wizer.bank = ExamLearning.questionPool(exam.source, exam.subject);
      wizer.generateSet(12, exam.count);
      const variants = new Set();
      wizer.papers = wizer.papers.filter(paper => {
        const key = JSON.stringify(paper.questions.map(question => question.id));
        if (variants.has(key)) return false;
        variants.add(key);
        return true;
      });
      state.paperExam = exam.name;
      renderPapers();
      await security.log("PAPER_VARIANTS_GENERATED", `${wizer.papers.length} paper variants generated for ${exam.name}`, "info");
      renderActivity();
    } catch (error) { toast("Could not generate papers", error.message); }
  }

  function renderSentinel() {
    const threat = Math.max(0, Math.min(99, Math.round(sentinel.threat || 8)));
    $("#threatValue").textContent = String(threat).padStart(2, "0");
    $("#sentinelThreat").textContent = String(threat);
    const label = threat >= 70 ? "High risk" : threat >= 28 ? "Elevated risk" : "Low risk";
    $("#sentinelState").textContent = label;
    $("#coreSummary").textContent = `${label} in the local simulation. Monitoring is ${monitor.running ? "active" : "off"}.`;
    $("#sentinelRecommendations").innerHTML = recommendations(threat).map(item => `<div><strong>${esc(item.title)}</strong><p>${esc(item.body)}</p></div>`).join("");
    const signals = [
      ["Access environment", monitor.running ? monitor.metrics.environment : "Monitoring off"],
      ["Question bank", `${ExamLearning.questionPool("organization").length} organization questions`],
      ["Paper variants", `${wizer.papers.length} generated this session`],
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
    return intact;
  }

  function exportAudit() {
    const blob = security.exportAudit();
    const url = URL.createObjectURL(blob);
    const anchor = Object.assign(document.createElement("a"), { href: url, download: `exam-fortress-audit-${Date.now()}.json` });
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
    $("#setupAdminName").value = name;
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
    $("#setupAdminName").value = displayName();
    toast("Admin setup reset", "Local administrator details were cleared in this browser.");
  }

  function navigate(view) {
    if (!canView(view)) return;
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

  function attemptName(attempt) {
    if (attempt.name) return attempt.name;
    if (attempt.mode === "mock") return "Science mock exam";
    return attempt.subject && attempt.subject !== "All" ? `${attempt.subject} practice` : "Science practice";
  }

  function renderStudentHub() {
    const name = displayName();
    $("#studentGreeting").textContent = name ? `Your exams, ${name}` : "Your exams";
    const current = ExamLearning.current();
    const active = current?.status === "in_progress";
    $("#startMockExam").disabled = active;
    $("#startPractice").disabled = active;
    $("#activeAttempt").innerHTML = active ? `<div class="history-resume"><span><strong>Exam in progress</strong><p>${esc(attemptName(current))} · ${current.questions.length} questions</p></span><button class="primary-btn" id="resumeExam">Resume</button></div>` : "";
    $("#availableExams").innerHTML = ExamLearning.exams().map(exam =>
      `<article class="student-launch-card"><span class="eyebrow">${exam.source === "demo" ? "Science sample" : esc(exam.subject || "Organization exam")}</span><h3>${esc(exam.name)}</h3><p>${exam.count} questions · ${exam.minutes} min<br>Correct +${exam.correct} · Incorrect ${exam.incorrect} · Unanswered 0</p><button class="primary-btn" data-exam-id="${esc(exam.id)}"${active ? " disabled" : ""}>Start exam</button></article>`
    ).join("") || '<p class="empty-state">No exams have been set up on this browser yet.</p>';
    const history = ExamLearning.history();
    $("#studentHistory").innerHTML = history.length ? history.slice(0, 8).map((item, i) =>
      `<button class="history-row" data-history-index="${i}"><span><strong>${esc(attemptName(item))}</strong><small>${new Date(item.result?.completedAt || item.startedAt).toLocaleString()}</small></span><b>${item.result?.score ?? 0}<small> / ${item.result?.maxScore ?? 0}</small></b></button>`
    ).join("") : '<p class="empty-state">No completed attempts yet.</p>';
    const resume = $("#resumeExam");
    if (resume) resume.addEventListener("click", resumeExam);
    $$("[data-history-index]").forEach(button => button.addEventListener("click", () => {
      const item = ExamLearning.history()[Number(button.dataset.historyIndex)];
      if (item) showResults(item);
    }));
  }

  function beginExam(mode, subject = "", exam) {
    try {
      const existing = ExamLearning.current();
      if (!mode && existing?.status !== "in_progress") return renderStudentHub();
      state.attempt = existing?.status === "in_progress" ? existing : ExamLearning.start(mode, subject, exam);
      renderExam();
      navigate("exam");
      if (state.timer) clearInterval(state.timer);
      state.timer = setInterval(updateExamTimer, 1000);
      if (!existing && mode === "configured") void recordExamEvent("EXAM_STARTED", state.attempt);
      updateExamTimer();
    } catch (error) { toast("Could not start exam", error.message); }
  }

  function resumeExam() { beginExam(); }

  function renderExam() {
    const attempt = state.attempt;
    if (!attempt) return;
    const index = Math.max(0, Math.min(attempt.currentIndex, attempt.questions.length - 1));
    attempt.currentIndex = index;
    const question = attempt.questions[index];
    $("#examModeLabel").textContent = attempt.mode === "configured" ? "TIMED EXAM" : "SCIENCE SAMPLE";
    $("#examSubjectTitle").textContent = attemptName(attempt);
    $("#examQuestionSubject").textContent = question.subject.toUpperCase();
    $("#examQuestionChapter").textContent = question.chapter;
    $("#examQuestionNumber").textContent = `Question ${index + 1}`;
    $("#examQuestionText").textContent = question.text;
    $("#examOptions").innerHTML = question.options.map((option, optionIndex) => `<button class="exam-option${Number(attempt.answers[index]) === optionIndex ? " selected" : ""}" data-option="${optionIndex}"><span>${String.fromCharCode(65 + optionIndex)}</span>${esc(option)}</button>`).join("");
    $("#examProgressText").textContent = `Question ${index + 1} of ${attempt.questions.length}`;
    $("#examAnsweredText").textContent = `${Object.keys(attempt.answers).length} answered`;
    $("#examProgressBar").style.width = `${Object.keys(attempt.answers).length / attempt.questions.length * 100}%`;
    $("#examPrevious").disabled = index === 0;
    $("#examNext").textContent = index === attempt.questions.length - 1 ? "Review unanswered" : "Save & next";
    $("#examMarkReview").classList.toggle("marked", attempt.marked.includes(index));
    $("#examPalette").innerHTML = attempt.questions.map((_, i) => `<button class="palette-question${attempt.answers[i] !== undefined ? " answered" : ""}${attempt.marked.includes(i) ? " review" : ""}${i === index ? " current" : ""}" data-question-index="${i}" aria-label="Question ${i + 1}">${i + 1}</button>`).join("");
    ExamLearning.update(attempt);
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
    try {
      const completed = ExamLearning.finish(state.attempt);
      state.attempt = null;
      if (canView("results")) showResults(completed);
      if (completed.mode === "configured") void recordExamEvent(auto ? "EXAM_TIME_EXPIRED" : "EXAM_SUBMITTED", completed);
      toast(auto ? "Time is up" : "Exam submitted", `You scored ${completed.result.score} out of ${completed.result.maxScore}.`);
    } catch {
      toast("Could not save results", "Check browser storage, then submit again.");
    }
  }

  function showResults(attempt) {
    state.resultAttempt = attempt;
    const result = attempt.result || ExamLearning.score(attempt);
    $("#resultModeLabel").textContent = `${attemptName(attempt)} · ${new Date(result.completedAt || attempt.startedAt).toLocaleString()}`;
    $("#resultSummary").innerHTML = `<article><span>Score</span><strong>${result.score}<small> / ${result.maxScore}</small></strong></article><article><span>Correct</span><strong>${result.correct}</strong></article><article><span>Incorrect</span><strong>${result.incorrect}</strong></article><article><span>Unanswered</span><strong>${result.unanswered}</strong></article><article><span>Accuracy</span><strong>${result.accuracy}%</strong></article>`;
    $("#resultSubjects").innerHTML = result.subjects.filter(row => row.total).map(row => `<div class="result-subject-row"><span><strong>${esc(row.subject)}</strong><small>${row.correct} right · ${row.incorrect} wrong · ${row.unanswered} blank</small></span><b>${row.score} <small>/ ${row.maxScore ?? row.total * 4}</small></b></div>`).join("");
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
    const options = Array.from({ length: 6 }, (_, index) => $(`#newOption${index}`).value.trim());
    const answer = Number($("#newQuestionAnswer").value);
    if (!options[answer]) return toast("Choose the correct option", "Enter an answer for the option you selected.");
    const question = {
      subject: $("#newQuestionSubject").value, chapter: $("#newQuestionChapter").value.trim(), text: $("#newQuestionText").value.trim(),
      explanation: $("#newQuestionExplanation").value.trim(), options: options.filter(Boolean),
      answer: options.slice(0, answer).filter(Boolean).length, difficulty: Number($("#newQuestionDifficulty").value),
    };
    try {
      const saved = ExamLearning.saveCustom(question);
      QuestionBank.questions.push(saved);
      renderUpdatedBank();
      event.currentTarget.reset();
      toast("Question added", "It is available when configuring organization exams on this browser.");
    } catch (error) { toast("Question not added", error.message); }
  }

  async function importQuestionBank(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const count = ExamLearning.importQuestions(JSON.parse(await file.text()));
      ExamLearning.attach(QuestionBank);
      renderUpdatedBank();
      toast("Question bank imported", `${count} questions added to this browser.`);
    } catch (error) { toast("Import failed", error.message || "Could not read this JSON file."); }
    finally { event.target.value = ""; }
  }

  function renderUpdatedBank() {
    $("#questionBankSource").value = "organization";
    renderQuestionStats();
    renderQuestions();
    renderSentinel();
    updateExamSubjects();
  }

  function exportQuestions() {
    const source = $("#questionBankSource").value;
    const bank = ExamLearning.questionPool(source);
    const url = URL.createObjectURL(new Blob([JSON.stringify({ questions: bank }, null, 2)], { type: "application/json" }));
    const anchor = Object.assign(document.createElement("a"), { href: url, download: `exam-fortress-${source}-questions.json` });
    anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function openAssistant() {
    $("#assistantPanel").hidden = false;
    if (!$("#assistantMessages").children.length) assistantMessage(assistant.greeting(displayName()));
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
    $(".brand").addEventListener("click", event => {
      event.preventDefault();
      navigate(ExamWorkspace.roles[state.profile.role].home);
    });
    $("#mobileMenu").addEventListener("click", () => $(".side").classList.toggle("open"));
    $("#showGreeting").addEventListener("click", () => showGreeting());
    $("#workspaceForm").addEventListener("input", () => renderWelcome(profileFromForm()));
    $("#workspaceForm").addEventListener("submit", enterWorkspace);
    $("#monitorStatusButton").addEventListener("click", () => navigate("monitor"));
    $("#startMonitorBtn").addEventListener("click", startMonitoring);
    $("#stopMonitorBtn").addEventListener("click", stopMonitoring);
    $("#clearMonitorEvents").addEventListener("click", () => { state.monitorEvents = []; renderMonitorEvents(); });
    $("#questionSearch").addEventListener("input", renderQuestions);
    $("#questionBankSource").addEventListener("change", () => { renderQuestionStats(); renderQuestions(); });
    $("#startMockExam").addEventListener("click", () => beginExam("mock"));
    $("#startPractice").addEventListener("click", () => beginExam("practice", $("#practiceSubject").value));
    $("#availableExams").addEventListener("click", event => {
      const button = event.target.closest("[data-exam-id]");
      if (!button) return;
      const exam = ExamLearning.exams().find(item => item.id === button.dataset.examId);
      if (exam) beginExam("configured", "", exam);
      else renderStudentHub();
    });
    $("#clearStudentHistory").addEventListener("click", () => {
      if (!ExamLearning.history().length || !confirm("Clear your completed attempts from this browser?")) return;
      ExamLearning.clearHistory(); renderStudentHub(); toast("Progress cleared", "Your completed exam history was removed from this browser.");
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
    $("#examNext").addEventListener("click", () => {
      const attempt = state.attempt;
      if (!attempt) return;
      if (attempt.currentIndex < attempt.questions.length - 1) attempt.currentIndex += 1;
      else {
        const unanswered = attempt.questions.findIndex((_, index) => attempt.answers[index] === undefined);
        if (unanswered < 0) return $("#submitExamTop").focus();
        attempt.currentIndex = unanswered;
      }
      renderExam();
    });
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
    $("#savedExamEdit").addEventListener("change", loadExamForm);
    $("#examSource").addEventListener("change", () => updateExamSubjects(""));
    $("#examSubject").addEventListener("change", () => updateExamSubjects());
    $("#examSetupForm").addEventListener("submit", saveExam);
    $("#removeExam").addEventListener("click", removeExam);
    $("#generatePapersBtn").addEventListener("click", generatePapers);
    $("#runSentinelSweep").addEventListener("click", manualSweep);
    $("#manualSentinelSweep").addEventListener("click", manualSweep);
    $("#verifyAuditBtn").addEventListener("click", async () => {
      const intact = await renderAudit();
      toast(intact ? "Audit verified" : "Audit verification failed", $("#integrityStatus").textContent);
    });
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
    monitor.addEventListener("state", updateMonitorUi);
  }

  async function initialize() {
    await ExamWorkspace.loadAccount();
    state.profile = ExamWorkspace.profile();
    for (const [value, label] of Object.entries(ExamWorkspace.types)) $("#profileType").add(new Option(label, value));
    for (const [value, role] of Object.entries(ExamWorkspace.roles)) $("#profileRole").add(new Option(role.label, value));
    setOptions($("#practiceSubject"), ExamLearning.subjects("demo").map(name => [name, name]));
    $("#todayLabel").textContent = new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    bind();
    showGreeting(false);
    $("#continueToWorkspace").disabled = false;
    renderQuestionStats();
    renderQuestions();
    renderExamCatalog();
    updateExamSubjects();
    renderPapers();
    renderSentinel();
    renderActivity();
    renderMonitorEvents();
    updateMonitorUi();
    globalThis.fortress = { security, sentinel, professor, portal, wizer, god, guard, monitor, assistant, state };
    await seedAudit();
    renderActivity();
  }

  document.addEventListener("DOMContentLoaded", initialize);
})();
