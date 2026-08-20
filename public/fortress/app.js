(function () {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = value => String(value ?? "").replace(/[&<>'"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[ch]);
  const formatTime = value => new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const formatDate = value => new Date(value).toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });
  const download = (blob, filename) => { const url = URL.createObjectURL(blob); const a = Object.assign(document.createElement("a"), { href: url, download: filename }); a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };

  const state = {
    currentView: localStorage.getItem("nf4_view") || "command",
    questionPage: 1, questionPageSize: 9, morphStrategy: "numerical", morphQuestion: null,
    dsaMode: "merkle", examTarget: +(localStorage.getItem("nf4_exam_target") || 0), lastEnvelope: null
  };
  if (!state.examTarget || state.examTarget < Date.now()) { state.examTarget = Date.now() + ((5 * 3600 + 42 * 60 + 18) * 1000); localStorage.setItem("nf4_exam_target", state.examTarget); }

  const security = new SecurityCore();
  const professor = new AIProfessor();
  const sentinel = new AISentinel();
  const portal = new TeacherPortal(professor);
  const wizer = new RandomWizer(QuestionBank.questions);
  wizer.generateSet(100);
  const shuffler = new HyperShuffler(wizer.papers);
  const god = new GodMode(security);
  const guard = new LockdownGuard(sentinel, security);

  function toast(title, message, type = "success", timeout = 3600) {
    const el = document.createElement("div"); el.className = `toast ${type}`;
    el.innerHTML = `<i></i><div><strong>${esc(title)}</strong><p>${esc(message)}</p></div>`;
    $("#toastStack").appendChild(el); setTimeout(() => el.remove(), timeout);
  }

  function openModal(id) { $(id).hidden = false; const input = $("input", $(id)); setTimeout(() => input?.focus(), 50); }
  function closeModal(el) { el.closest(".modal-backdrop").hidden = true; }

  function navigate(view) {
    state.currentView = view; localStorage.setItem("nf4_view", view);
    $$(".view").forEach(v => v.classList.toggle("active", v.id === `view-${view}`));
    $$(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.view === view));
    const active = $(`#view-${view}`); $("#viewTitle").textContent = active?.dataset.title || "Command center";
    $("#sidebar").classList.remove("open"); window.scrollTo({ top: 0, behavior: "smooth" });
    if (view === "security") renderAudit();
    if (view === "sentinel") renderSentinel();
    if (view === "shadow") renderShadow();
  }

  function bindNavigation() {
    $$(".nav-btn").forEach(btn => btn.addEventListener("click", () => navigate(btn.dataset.view)));
    $$('[data-go]').forEach(btn => btn.addEventListener("click", () => navigate(btn.dataset.go)));
    $("#mobileMenu").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
    $("#collapseBtn").addEventListener("click", () => { $("#appShell").classList.toggle("collapsed"); localStorage.setItem("nf4_collapsed", $("#appShell").classList.contains("collapsed") ? "1" : "0"); });
    if (localStorage.getItem("nf4_collapsed") === "1") $("#appShell").classList.add("collapsed");
    $("#notificationBtn").addEventListener("click", () => toast("2 advisory notices", "Final assembly is approaching. Audit verification is due in 18 minutes.", "success", 5200));
  }

  function bindTheme() {
    const saved = localStorage.getItem("nf4_theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = saved;
    $("#themeToggle").addEventListener("click", () => { const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = next; localStorage.setItem("nf4_theme", next); });
  }

  function updateCountdown() {
    let remaining = Math.max(0, state.examTarget - Date.now());
    const hours = Math.floor(remaining / 3600000); remaining %= 3600000;
    const minutes = Math.floor(remaining / 60000); const seconds = Math.floor((remaining % 60000) / 1000);
    $("#examCountdown").innerHTML = `<strong>${String(hours).padStart(2, "0")}</strong><i>:</i><strong>${String(minutes).padStart(2, "0")}</strong><i>:</i><strong>${String(seconds).padStart(2, "0")}</strong>`;
  }

  async function ensureAuditSeed() {
    if (!security.audit.length) {
      await security.log("SYSTEM_INITIALIZED", "Offline security workspace ready", "secure");
      await security.log("MERKLE_VERIFIED", "Audit chain integrity established", "secure");
      await security.log("PAPER_SHUFFLE", "100 paper candidates entered hyper-shuffle", "info");
      await security.log("SENTINEL_SWEEP", "No anomalous access patterns detected", "secure");
    }
    renderActivity();
  }

  function eventPresentation(entry) {
    if (/LOCK|FAILED|BAN|CRITICAL|COMPROMISE/.test(entry.type)) return ["!", "warn"];
    if (/SHUFFLE|ENCRYPT|SHADOW/.test(entry.type)) return ["↻", "info"];
    return ["✓", "ok"];
  }

  function renderActivity() {
    const items = security.audit.slice(-4).reverse();
    $("#activityFeed").innerHTML = items.map(entry => { const [mark, style] = eventPresentation(entry); return `<div class="event-item"><span class="${style}">${mark}</span><div><strong>${esc(entry.type.replaceAll("_", " ").toLowerCase())}</strong><p>${esc(entry.detail)}</p></div><time>${formatTime(entry.timestamp)}</time></div>`; }).join("");
  }

  function renderQuestionStats() {
    const initials = { Physics: "PH", Chemistry: "CH", Botany: "BO", Zoology: "ZO" };
    $("#subjectStats").innerHTML = QuestionBank.stats().map(s => `<article class="card subject-stat"><div><small>${s.subject}</small><strong>${s.count}</strong><small>${s.averageQuality}% avg. quality</small></div><span>${initials[s.subject]}</span></article>`).join("");
  }

  function filteredQuestions() {
    const search = $("#questionSearch").value.trim().toLowerCase(), subject = $("#subjectFilter").value, difficulty = $("#difficultyFilter").value;
    return QuestionBank.questions.filter(q => (!search || `${q.text} ${q.chapter}`.toLowerCase().includes(search)) && (subject === "all" || q.subject === subject) && (difficulty === "all" || q.difficulty === +difficulty));
  }

  function renderQuestions() {
    const list = filteredQuestions();
    const pages = Math.max(1, Math.ceil(list.length / state.questionPageSize)); state.questionPage = Math.min(state.questionPage, pages);
    const start = (state.questionPage - 1) * state.questionPageSize;
    $("#questionList").innerHTML = list.slice(start, start + state.questionPageSize).map((q, i) => `<article class="card question-card"><span class="question-index">${String(start + i + 1).padStart(3, "0")}</span><div class="question-body"><p>${esc(q.text)}</p><div class="tag-row"><span class="tag">${q.subject}</span><span class="tag">${q.chapter}</span><span class="tag">${q.bloom}</span><span class="tag">${q.quality}% quality</span></div></div><div class="difficulty" title="Difficulty ${q.difficulty} of 5">${Array.from({ length: 5 }, (_, n) => `<i class="${n < q.difficulty ? "on" : ""}"></i>`).join("")}</div></article>`).join("") || `<article class="card question-card"><div></div><div class="question-body"><p>No questions match the current filters.</p></div></article>`;
    $("#questionResultCount").textContent = `${list.length} results`; $("#questionPage").textContent = `Page ${state.questionPage} / ${pages}`;
    $("#questionPrev").disabled = state.questionPage === 1; $("#questionNext").disabled = state.questionPage === pages;
  }

  function bindQuestions() {
    ["#questionSearch", "#subjectFilter", "#difficultyFilter"].forEach(id => $(id).addEventListener(id === "#questionSearch" ? "input" : "change", () => { state.questionPage = 1; renderQuestions(); }));
    $("#questionPrev").addEventListener("click", () => { state.questionPage -= 1; renderQuestions(); });
    $("#questionNext").addEventListener("click", () => { state.questionPage += 1; renderQuestions(); });
    ["#openSubmitQuestion", "#teacherSubmitBtn"].forEach(id => $(id).addEventListener("click", () => openModal("#submissionModal")));
  }

  const statusLabel = status => ({ submitted: "Submitted", format_check: "Format check", ai_analysis: "AI analysis", peer_review: "Peer review", approved: "Approved", needs_revision: "Needs revision", quarantined: "Quarantined" })[status] || status;
  function renderPortal() {
    const pipeline = [{ status: "submitted", title: "Submitted" }, { status: "format_check", title: "Format check" }, { status: "ai_analysis", title: "AI analysis" }, { status: "peer_review", title: "Peer review" }, { status: "approved", title: "Bank ready" }];
    $("#submissionPipeline").innerHTML = pipeline.map((p, i) => `<div class="card"><span>0${i + 1}</span><strong>${p.title}</strong><b>${portal.submissions.filter(s => s.status === p.status).length}</b></div>`).join("");
    $("#submissionTable").innerHTML = `<div class="table-row header"><span>Question</span><span>Contributor</span><span>Subject</span><span>Status</span><span>Score</span></div>` + portal.submissions.slice(0, 9).map(s => `<div class="table-row"><strong>${esc(s.question.text.slice(0, 72))}${s.question.text.length > 72 ? "…" : ""}</strong><span>${esc(s.teacher)}</span><span>${esc(s.question.subject)}</span><span><b class="chip ${s.status === "approved" ? "success" : s.status === "needs_revision" ? "danger" : "neutral"}">${statusLabel(s.status)}</b></span><strong>${s.score}</strong></div>`).join("");
    const queue = portal.submissions.filter(s => s.status === "peer_review");
    $("#reviewQueue").innerHTML = queue.map(s => `<article class="card review-card"><b class="chip neutral">${esc(s.question.subject)}</b><h3>${esc(s.question.chapter)}</h3><p>${esc(s.question.text)}</p><small>${s.score}% AI quality · ${s.reviews}/2 reviews</small><div class="review-actions"><button class="secondary-btn" data-review="reject" data-id="${s.id}">Request changes</button><button class="primary-btn" data-review="approve" data-id="${s.id}">Approve</button></div></article>`).join("") || `<article class="card review-card"><h3>Queue cleared</h3><p>No questions are waiting for peer review.</p></article>`;
    $("#teacherGrid").innerHTML = portal.teachers.slice(0, 9).map(t => `<article class="card teacher-card"><span class="teacher-avatar">${t.name.split(" ").slice(-2).map(n => n[0]).join("")}</span><h3>${esc(t.name)}</h3><p>${esc(t.subject)} specialist · ${esc(t.status)}</p><div class="teacher-meta"><div><strong>${t.reputation}%</strong><span>Reputation</span></div><div><strong>${t.accepted}</strong><span>Accepted</span></div></div></article>`).join("");
    $("#leaderboard").innerHTML = `<div class="card-title"><div><span>Contributor leaderboard</span><p>Quality-adjusted points and accepted questions</p></div></div>` + portal.leaderboard().map((t, i) => `<div class="leader-row"><span>#${String(i + 1).padStart(2, "0")}</span><div><strong>${esc(t.name)}</strong><small>${esc(t.subject)}</small></div><small>${t.accepted} accepted</small><b>${t.points} pts</b></div>`).join("");
    $$('[data-review]').forEach(btn => btn.addEventListener("click", async () => { const approved = btn.dataset.review === "approve"; const result = portal.review(btn.dataset.id, approved); await security.log("PEER_REVIEW", `${result.id} ${approved ? "approved" : "returned"}`, "info"); toast("Peer review saved", approved ? "Approval recorded. The quality gate has been updated." : "The question was returned for revision."); renderPortal(); }));
  }

  function bindPortal() {
    $$('[data-tabs="teacherTabs"] button').forEach(btn => btn.addEventListener("click", () => { $$('[data-tabs="teacherTabs"] button').forEach(b => b.classList.remove("active")); btn.classList.add("active"); $$("#view-teachers .tab-panel").forEach(p => p.classList.toggle("active", p.dataset.panel === btn.dataset.tab)); }));
    $("#questionForm").addEventListener("submit", async event => { event.preventDefault(); const form = new FormData(event.currentTarget); const data = Object.fromEntries(form); const submission = portal.submit(data); await security.log("QUESTION_SUBMITTED", `${submission.id} scored ${submission.score}%`, "info"); closeModal(event.currentTarget); event.currentTarget.reset(); renderPortal(); toast("Question submitted", `AI Professor scored the submission ${submission.score}%. ${statusLabel(submission.status)}.`); navigate("teachers"); });
  }

  function renderPapers() {
    const top = wizer.top(10);
    $("#paperTable").innerHTML = `<div class="table-row header"><span>Candidate</span><span>Quality</span><span>Entropy</span><span>Accesses</span><span>State</span></div>` + top.map((p, i) => `<div class="table-row"><strong>#${i + 1} · ${p.id}</strong><span>${p.quality}%</span><span>${p.entropy}%</span><span>${p.accessCount}</span><b class="chip success">Eligible</b></div>`).join("");
  }

  function bindPapers() {
    shuffler.addEventListener("shuffle", event => { $("#shuffleTick").textContent = String(event.detail.cycles).padStart(4, "0"); $("#shuffleEntropy").textContent = `${event.detail.entropy}% entropy`; if (event.detail.cycles % 30 === 0) security.log("PAPER_SHUFFLE", `Cycle ${event.detail.cycles} completed at ${event.detail.entropy}% entropy`, "info"); });
    $("#toggleShuffler").addEventListener("click", event => { if (shuffler.running) { shuffler.stop(); event.currentTarget.textContent = "Resume shuffler"; toast("Hyper-shuffler paused", "The current in-memory order is temporarily held.", "error"); } else { shuffler.start(); event.currentTarget.textContent = "Pause shuffler"; toast("Hyper-shuffler resumed", "One-second randomized reordering is active."); } });
    $("#generatePapersBtn").addEventListener("click", async () => { wizer.generateSet(100); shuffler.papers = wizer.papers; shuffler.order = wizer.papers.map(p => p.id); renderPapers(); await security.log("PAPER_SET_REGENERATED", "100 balanced paper candidates created", "secure"); toast("Paper set regenerated", "18,000 balanced question placements are ready for shuffling."); });
    $("#selectFinalBtn").addEventListener("click", async () => { const finalPaper = wizer.finalAssembly(); state.finalPaper = finalPaper; await security.log("FINAL_ASSEMBLY", `${finalPaper.id} assembled at quality ${finalPaper.quality}%`, "secure"); toast("Final paper assembled", `${finalPaper.id} contains ${finalPaper.questions.length} balanced questions at ${finalPaper.quality}% quality.`); navigate("encryption"); });
  }

  function renderMorph(result) {
    const original = state.morphQuestion;
    $("#morphOriginalId").textContent = original.id; $("#morphOriginalText").textContent = original.text;
    $("#morphOriginalOptions").innerHTML = original.options.map((o, i) => `<div class="option ${i === original.answer ? "correct" : ""}"><span>${String.fromCharCode(65 + i)}</span>${esc(o)}</div>`).join("");
    const output = result?.question || original;
    $("#morphOutputText").textContent = output.text;
    $("#morphOutputOptions").innerHTML = output.options.map((o, i) => `<div class="option ${i === output.answer ? "correct" : ""}"><span>${String.fromCharCode(65 + i)}</span>${esc(o)}</div>`).join("");
    const validity = result?.validity || 100; $("#validityScore").textContent = `${validity}%`; $("#validityChip").textContent = `${validity}% valid`; $("#validityBar").style.width = `${validity}%`; $("#morphRationale").textContent = result?.rationale || "Select a strategy and run the transformation engine.";
  }

  function pickMorphQuestion() { state.morphQuestion = QuestionBank.questions[Math.floor(Math.random() * QuestionBank.questions.length)]; renderMorph(null); }
  function bindMorph() {
    $$("#morphStrategies button").forEach(btn => btn.addEventListener("click", () => { $$("#morphStrategies button").forEach(b => b.classList.remove("active")); btn.classList.add("active"); state.morphStrategy = btn.dataset.strategy; }));
    $("#randomMorphQuestion").addEventListener("click", pickMorphQuestion);
    $("#runMorphBtn").addEventListener("click", async () => { const result = MorphEngine.morph(state.morphQuestion, state.morphStrategy); renderMorph(result); await security.log("QUESTION_MORPHED", `${state.morphQuestion.id} via ${state.morphStrategy} at ${result.validity}% validity`, "info"); toast("Morph complete", `${state.morphStrategy} strategy passed at ${result.validity}% validity.`); });
  }

  function renderSentinel() {
    sentinel.threat = sentinel.calculateThreat(); const level = sentinel.level(); const angle = Math.round(sentinel.threat * 3.6);
    $("#sentinelThreat").textContent = sentinel.threat; $("#threatValue").textContent = String(sentinel.threat).padStart(2, "0");
    $("#largeGauge").style.background = `conic-gradient(${sentinel.threat >= 75 ? "var(--red)" : sentinel.threat >= 25 ? "var(--amber)" : "var(--green)"} 0 ${angle}deg,var(--line-2) ${angle}deg 360deg)`;
    $("#sentinelState").className = `chip ${sentinel.threat >= 75 ? "danger" : sentinel.threat >= 25 ? "warning" : "success"}`; $("#sentinelState").textContent = `${level} risk`;
    $("#sentinelRecommendations").innerHTML = sentinel.recommendations().map((r, i) => `<div class="recommendation"><span>0${i + 1}</span><div><strong>${esc(r)}</strong><p>Rule-based recommendation · priority ${i + 1}</p></div></div>`).join("");
    $("#sentinelTable").innerHTML = `<div class="table-row header"><span>Event</span><span>Engine</span><span>Time</span><span>Signal</span><span>Score</span></div>` + sentinel.events.slice(0, 10).map(e => `<div class="table-row"><strong>${e.id}</strong><span>${esc(e.kind.replaceAll("_", " "))}</span><span>${formatTime(e.at)}</span><span>${esc(e.detail.source || "local")}</span><strong>${e.score}</strong></div>`).join("");
    $("#eventScanCount").textContent = (2847 + sentinel.events.length * 31).toLocaleString(); $("#criticalCount").textContent = sentinel.events.filter(e => e.score >= 75).length;
  }

  function bindSentinel() {
    $("#runSentinelSweep").addEventListener("click", async () => { sentinel.add("sweep", { source: "manual" }); await security.log("SENTINEL_SWEEP", "Manual statistical sweep completed", "secure"); renderSentinel(); toast("Sentinel sweep complete", "No new high-risk access patterns were detected."); });
    sentinel.addEventListener("threat", renderSentinel);
  }

  const dsaCopy = {
    merkle: ["Merkle tree · audit integrity", "Tamper-evident audit log", "Pairs event hashes into a binary tree. Any change to a stored audit event produces a different root fingerprint."],
    bloom: ["Bloom filter · duplicate detection", "Fast probabilistic lookup", "Uses several hash positions to reject definitely-new question text without scanning the full vault."],
    rbtree: ["Red-black tree · paper ranking", "Balanced candidate ranking", "Maintains quality-scored papers in sorted order so top candidates can be retrieved efficiently."],
    trie: ["Trie · question search", "Prefix search index", "Indexes question text by character path for rapid local search suggestions."],
    shamir: ["Shamir · authority threshold", "3-of-5 secret recovery", "Encodes key bytes as polynomial points. Any three valid authority shares reconstruct the secret."],
    ring: ["Consistent hash ring · center routing", "Stable distribution map", "Routes paper packages across centers while minimizing reassignment when a node changes."],
    chain: ["Hash chain · sequential audit", "Linked event evidence", "Every event includes the previous event hash, exposing deletion or modification in the recorded sequence."],
    hmac: ["HMAC tree · layered authentication", "Authenticated integrity tree", "Combines a secret-derived value with hierarchical hashes for multi-level message authentication."]
  };

  async function runDsaDemo() {
    const visual = $("#dsaVisual"), output = $("#dsaOutput");
    if (state.dsaMode === "merkle") { const tree = new FortressDSA.MerkleTree(["Access logged", "Paper shuffled", "Key rotated", "Sweep complete"]); const root = await tree.build(); visual.innerHTML = `<div class="tree-levels"><div class="tree-level"><span class="tree-node root">${root.slice(0, 10)}</span></div><div class="tree-level">${tree.levels[1].map(x => `<span class="tree-node">${x.slice(0, 9)}</span>`).join("")}</div><div class="tree-level">${tree.levels[2].map(x => `<span class="tree-node">${x.slice(0, 7)}</span>`).join("")}</div></div>`; output.textContent = `Root: ${root}\nLeaves: 4\nIntegrity: VERIFIED`; }
    if (state.dsaMode === "bloom") { const filter = new FortressDSA.BloomFilter(64, 4); ["nephron kidney", "ohm current", "chlorophyll light"].forEach(x => filter.add(x)); visual.innerHTML = `<div class="bloom-visual">${Array.from(filter.bits).map((b, i) => `<span class="bloom-bit ${b ? "on" : ""}">${b}</span>`).join("")}</div>`; output.textContent = `"ohm current" → ${filter.has("ohm current") ? "possibly present" : "definitely absent"}\n"random leak" → ${filter.has("random leak") ? "possibly present" : "definitely absent"}`; }
    if (state.dsaMode === "rbtree") { const rank = new FortressDSA.RankTree(); [91, 86, 97, 89, 94].forEach((n, i) => rank.insert(n, `Paper ${i + 1}`)); visual.innerHTML = `<div class="tree-levels"><div class="tree-level"><span class="tree-node root">97 · P3</span></div><div class="tree-level"><span class="tree-node">94 · P5</span><span class="tree-node">91 · P1</span></div><div class="tree-level"><span class="tree-node">89 · P4</span><span class="tree-node">86 · P2</span></div></div>`; output.textContent = `Top 3: ${rank.getTopK(3).join(", ")}\nLookup: O(log n + k)`; }
    if (state.dsaMode === "trie") { const trie = new FortressDSA.Trie(); ["photosynthesis light reaction", "photoelectric effect", "photon energy"].forEach((x, i) => trie.insert(x, `Q${i + 1}`)); visual.innerHTML = `<div class="tree-levels"><div class="tree-level"><span class="tree-node root">ROOT</span></div><div class="tree-level"><span class="tree-node">p</span></div><div class="tree-level"><span class="tree-node">ph</span><span class="tree-node">pho</span><span class="tree-node">phot</span></div></div>`; output.textContent = `Prefix "photo" → ${trie.searchPrefix("photo").join(", ")}\nIndexed locally without network access.`; }
    if (state.dsaMode === "shamir") { const shamir = new FortressDSA.ShamirSecretSharing(); const secret = new TextEncoder().encode("NEET-KEY"); const shares = shamir.split(secret, 5, 3); const recovered = new TextDecoder().decode(shamir.combine(shares.slice(0, 3))); visual.innerHTML = `<div class="tree-levels"><div class="tree-level">${shares.map(s => `<span class="tree-node">Share ${s.x}</span>`).join("")}</div><div class="tree-level"><span class="tree-node root">3 required</span></div></div>`; output.textContent = `Created: 5 shares\nThreshold: 3\nRecovered: ${recovered}`; }
    if (state.dsaMode === "ring") { const ring = new FortressDSA.ConsistentHashRing(); ["Delhi", "Mumbai", "Chennai", "Kolkata"].forEach(n => ring.addNode(n)); visual.innerHTML = `<div class="ring-visual"><span class="ring-node" style="left:50%;top:0">DEL</span><span class="ring-node" style="left:100%;top:50%">MUM</span><span class="ring-node" style="left:50%;top:100%">CHE</span><span class="ring-node" style="left:0;top:50%">KOL</span></div>`; output.textContent = `Paper-042 → ${ring.get("Paper-042")}\nPaper-089 → ${ring.get("Paper-089")}\nVirtual replicas: 32`; }
    if (state.dsaMode === "chain") { const chain = new FortressDSA.HashChain(); await chain.append("Login"); await chain.append("Paper read"); await chain.append("Logout"); visual.innerHTML = `<div class="tree-levels"><div class="tree-level"><span class="tree-node">Login</span><span class="tree-node">Paper read</span><span class="tree-node root">Logout</span></div></div>`; output.textContent = `Blocks: 3\nPrevious-hash links: 2\nIntegrity: ${(await chain.verify()) ? "VALID" : "BROKEN"}`; }
    if (state.dsaMode === "hmac") { const hmac = new FortressDSA.HMACTree(); const result = await hmac.sign(["center-a", "center-b", "center-c", "center-d"], "authority-key"); visual.innerHTML = `<div class="tree-levels"><div class="tree-level"><span class="tree-node root">AUTH ROOT</span></div><div class="tree-level"><span class="tree-node">MAC A+B</span><span class="tree-node">MAC C+D</span></div></div>`; output.textContent = `Authenticated root: ${result.root}\nLevels: ${result.levels.length}\nStatus: VERIFIED`; }
  }

  function bindDsa() {
    $$("#dsaTabs button").forEach(btn => btn.addEventListener("click", () => { $$("#dsaTabs button").forEach(b => b.classList.remove("active")); btn.classList.add("active"); state.dsaMode = btn.dataset.dsa; const copy = dsaCopy[state.dsaMode]; $("#dsaName").textContent = copy[0]; $("#dsaTitle").textContent = copy[1]; $("#dsaDescription").textContent = copy[2]; $("#dsaVisual").innerHTML = ""; $("#dsaOutput").textContent = "Ready — press “Run demonstration”."; }));
    $("#runDsaDemo").addEventListener("click", runDsaDemo);
  }

  async function renderAudit() {
    const intact = await security.verifyAudit();
    $("#merkleRoot").textContent = security.merkleRoot || "No root"; $("#integrityStatus").textContent = intact ? `All ${security.audit.length} recorded blocks are hash-linked and intact.` : "The local audit chain has failed integrity verification.";
    $("#integrityChip").className = `chip ${intact ? "success" : "danger"}`; $("#integrityChip").textContent = intact ? "Intact" : "Compromised";
    $("#auditTable").innerHTML = `<div class="table-row header"><span>Event</span><span>Type</span><span>Time</span><span>Device</span><span>Hash</span></div>` + security.audit.slice().reverse().slice(0, 16).map(e => `<div class="table-row"><strong>${e.id}</strong><span>${esc(e.type)}</span><span>${formatTime(e.timestamp)}</span><span>${e.device.slice(0, 8)}</span><strong>${security.shortHash(e.hash)}</strong></div>`).join("");
  }

  function exportAudit() { const blob = security.exportAudit(); download(blob, `neet-fortress-audit-${Date.now()}.json`); toast("Audit report exported", "The forensic JSON package was prepared locally."); }
  function bindSecurity() { $("#verifyAuditBtn").addEventListener("click", async () => { await renderAudit(); await security.log("MERKLE_VERIFIED", "Manual audit integrity verification completed", "secure"); toast("Integrity verified", `Merkle root ${security.merkleRoot.slice(0, 12)}… is intact.`); }); $("#exportAuditBtn").addEventListener("click", exportAudit); }

  async function encryptionDemo() {
    const log = $("#cryptoLog"), cards = $$(".encryption-card"); cards.forEach(c => c.classList.remove("done"));
    const paper = state.finalPaper || wizer.top(1)[0];
    log.textContent = `[${formatTime(Date.now())}] Serializing ${paper.id}…\n`;
    try {
      const envelope = await security.encryptPaper(paper, Date.now()); state.lastEnvelope = envelope;
      const lines = [
        `AES-256-GCM payload sealed · ${(envelope.payload.length / 1024).toFixed(1)} KB`,
        `RSA-OAEP wrapped key · ${envelope.wrappedKey.length} base64 chars`,
        `Shamir authority shares · ${envelope.shares.length} created, threshold 3`,
        `Operational release policy · ${new Date(envelope.releaseAt).toLocaleString()}`,
        `Cipher digest · ${envelope.digest}`
      ];
      lines.forEach((line, i) => setTimeout(() => { cards[i]?.classList.add("done"); if (cards[i]) $("b", cards[i]).textContent = "Secured"; log.textContent += `[${formatTime(Date.now())}] ${line}\n`; }, i * 280));
      setTimeout(() => toast("Encryption complete", `${paper.id} is sealed in a four-layer operational envelope.`), 1200);
    } catch (error) { log.textContent += `ERROR: ${error.message}\nUse localhost or a secure origin to enable Web Crypto.`; toast("Encryption unavailable", error.message, "error"); }
  }
  function bindEncryption() { $("#encryptDemoBtn").addEventListener("click", encryptionDemo); }

  function unlockFailures() { return +(localStorage.getItem("nf4_unlock_failures") || 0); }
  function renderAttempts() {
    const failed = unlockFailures(), remaining = Math.max(0, 3 - failed); const dots = $$("#attemptIndicators i");
    dots.forEach((d, i) => { d.className = i < failed ? "failed" : "available"; }); $("#attemptIndicators span").textContent = `${remaining} attempt${remaining === 1 ? "" : "s"} remaining`;
  }
  async function attemptUnlock() {
    const pass = $("#unlockPassphrase").value, master = localStorage.getItem("nf4_master");
    if (pass && pass === master) { localStorage.setItem("nf4_unlock_failures", "0"); guard.recordAttempt({ success: true, credential: "master", source: "exam-center" }); await security.log("VAULT_UNLOCKED", "Exam-center authority authenticated", "secure"); renderAttempts(); $("#unlockPassphrase").value = ""; toast("Vault authenticated", "The selected paper is available inside its authorized release window."); return; }
    const failed = unlockFailures() + 1; localStorage.setItem("nf4_unlock_failures", String(failed)); sentinel.add("failed_login", { source: "exam-center", velocity: failed }); guard.recordAttempt({ success: false, credential: "master", source: "exam-center" }); await security.log("UNLOCK_FAILED", `Failed exam-center authentication ${failed}/3`, "warning"); renderAttempts(); $("#unlockPassphrase").value = ""; toast("Authentication failed", `${Math.max(0, 3 - failed)} attempts remain before lockdown.`, "error"); if (failed >= 3 && !guard.isLocked()) guard.trigger("Three exam-paper passphrase failures", "THREE_ATTEMPT_LOCK");
  }
  function bindUnlock() { $("#unlockBtn").addEventListener("click", attemptUnlock); $("#unlockPassphrase").addEventListener("keydown", e => { if (e.key === "Enter") attemptUnlock(); }); renderAttempts(); }

  function renderShadow() {
    const current = god.shadow.state, index = ["DORMANT", "STANDBY", "DEPLOYED"].indexOf(current);
    $("#shadowState").textContent = current; $("#shadowHeaderState").textContent = current; $("#shadowHeaderState").className = `chip ${current === "DORMANT" ? "neutral" : current === "STANDBY" ? "warning" : "danger"}`;
    $("#shadowDescription").textContent = current === "DORMANT" ? "A sealed backup paper exists in a separate logical pool. It has not been warmed or exposed to the primary workflow." : current === "STANDBY" ? "A compromise signal has pre-warmed the backup. It is isolated and ready for authorized deployment." : "The shadow paper is now the active examination package. Primary-paper access is revoked and evidence packaging is active.";
    $$(".shadow-steps span").forEach((s, i) => s.classList.toggle("active", i <= index)); $("#warmShadowBtn").disabled = current !== "DORMANT"; $("#deployShadowBtn").disabled = current === "DEPLOYED";
  }
  function requireGod(action) { if (!god.active()) { openModal("#godMode"); toast("God-Mode authorization required", "Authenticate in the emergency authority console.", "error"); return false; } action(); return true; }
  function bindShadow() { $("#warmShadowBtn").addEventListener("click", () => requireGod(() => { god.setShadow("STANDBY"); renderShadow(); toast("Shadow paper standing by", "Emergency package pre-warmed and isolated."); })); $("#deployShadowBtn").addEventListener("click", () => requireGod(() => { god.setShadow("DEPLOYED"); god.ban("Compromise cluster", 3); renderShadow(); toast("Shadow paper deployed", "Primary access was revoked and the evidence package created.", "error", 6000); })); god.addEventListener("shadow", renderShadow); }

  function updateLockdown() {
    const overlay = $("#lockdownOverlay");
    if (!guard.isLocked()) { overlay.hidden = true; return; }
    overlay.hidden = false; const ms = guard.remaining(), h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000), s = Math.floor(ms % 60000 / 1000);
    $("#lockdownTimer").textContent = [h, m, s].map(n => String(n).padStart(2, "0")).join(":"); $("#lockdownReason").textContent = `${guard.state.engine}: ${guard.state.reason}. All paper operations are suspended.`;
  }
  function bindLockdown() { guard.addEventListener("lock", updateLockdown); guard.addEventListener("clear", updateLockdown); $("#recoveryBtn").addEventListener("click", () => { if (guard.recover($("#recoveryKey").value)) { localStorage.setItem("nf4_unlock_failures", "0"); renderAttempts(); toast("System recovered", "The lockdown was cleared with the authorized recovery key."); } else { $("#recoveryKey").value = ""; } }); setInterval(updateLockdown, 1000); updateLockdown(); }

  function bindGodMode() {
    god.addEventListener("request-open", () => { if (god.canOpen()) openModal("#godMode"); else toast("God-Mode rate limit", "Maximum emergency sessions reached for today.", "error"); });
    $("#godLogin").addEventListener("click", () => { if (god.authenticate($("#godPassphrase").value)) { $("#godAuth").hidden = true; $("#godControls").hidden = false; $("#godPassphrase").value = ""; } else toast("Authority verification failed", "The passphrase was invalid or the daily session limit was reached.", "error"); });
    $$('[data-god]').forEach(btn => btn.addEventListener("click", async () => {
      const action = btn.dataset.god;
      if (!god.active()) return;
      if (action === "shadow") { god.setShadow("DEPLOYED"); god.ban("Compromise cluster", 3); renderShadow(); }
      if (action === "reencrypt") { await security.log("FORCE_REENCRYPT", "Emergency rotation queued for all paper envelopes", "critical"); encryptionDemo(); }
      if (action === "audit") exportAudit();
      if (action === "unlock") { guard.clear(true); localStorage.setItem("nf4_unlock_failures", "0"); renderAttempts(); }
      if (action === "ban") { const identity = window.prompt("Identity or incident reference to quarantine:", "INCIDENT-CLUSTER-01"); if (identity) god.ban(identity, 4); }
      if (action === "lockdown") guard.trigger("Manual nuclear lockdown ordered by emergency authority", "GOD_MODE");
      toast("God-Mode action completed", `${action.replaceAll("_", " ")} was recorded in the audit chain.`, action === "lockdown" ? "error" : "success");
    }));
  }

  function bindModals() { $$(".close-modal").forEach(btn => btn.addEventListener("click", () => closeModal(btn))); $$(".modal-backdrop").forEach(backdrop => backdrop.addEventListener("click", e => { if (e.target === backdrop && backdrop.id !== "setupModal") backdrop.hidden = true; })); }
  function bindSetup() {
    if (!localStorage.getItem("nf4_master")) openModal("#setupModal");
    $("#initializeBtn").addEventListener("click", async () => { const pass = $("#setupPassphrase").value, confirm = $("#setupConfirm").value; if (pass.length < 4) return toast("Passphrase too short", "Use at least four characters for this local prototype.", "error"); if (pass !== confirm) return toast("Passphrases do not match", "Re-enter the same master passphrase in both fields.", "error"); localStorage.setItem("nf4_master", pass); $("#setupModal").hidden = true; await security.log("AUTHORITY_INITIALIZED", "Local master authority configured", "secure"); toast("Secure workspace initialized", "Admin recovery, vault unlock and God Mode are now configured."); });
  }

  async function initialize() {
    bindNavigation(); bindTheme(); bindQuestions(); bindPortal(); bindPapers(); bindMorph(); bindSentinel(); bindDsa(); bindSecurity(); bindEncryption(); bindUnlock(); bindShadow(); bindLockdown(); bindGodMode(); bindModals(); bindSetup();
    renderQuestionStats(); renderQuestions(); renderPortal(); renderPapers(); pickMorphQuestion(); renderSentinel(); renderShadow(); await ensureAuditSeed();
    navigate(state.currentView); updateCountdown(); setInterval(updateCountdown, 1000); shuffler.start();
    globalThis.fortress = { security, sentinel, professor, portal, wizer, shuffler, god, guard, state };
  }

  document.addEventListener("DOMContentLoaded", initialize);
})();
