import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { TextEncoder, TextDecoder } from "node:util";
import crypto from "node:crypto";

const localData = new Map();
const context = {
  console,
  TextEncoder,
  TextDecoder,
  crypto: crypto.webcrypto,
  CustomEvent: class CustomEvent extends Event { constructor(type, init = {}) { super(type); this.detail = init.detail; } },
  Event,
  EventTarget,
  navigator: { userAgent: "Test browser", language: "en" },
  screen: { width: 1200, height: 800 },
  dispatchEvent() {},
  localStorage: {
    getItem: key => localData.get(key) ?? null,
    setItem: (key, value) => localData.set(key, String(value)),
    removeItem: key => localData.delete(key),
  },
  setInterval,
  clearInterval,
};
context.window = context;
context.globalThis = context;
vm.createContext(context);

for (const file of ["questions.js", "dsa.js", "morph.js", "engine.js", "assistant.js", "monitoring.js", "security.js", "workspace.js", "learning.js"]) {
  vm.runInContext(fs.readFileSync(new URL(`../public/fortress/${file}`, import.meta.url), "utf8"), context, { filename: file });
}

test("question vault contains 924 balanced questions", () => {
  assert.equal(context.QuestionBank.questions.length, 924);
  const counts = Object.groupBy(context.QuestionBank.questions, q => q.subject);
  for (const subject of ["Physics", "Chemistry", "Botany", "Zoology"]) assert.equal(counts[subject].length, 231);
});

test("RandomWizer creates 100 papers with 45 questions per subject", () => {
  const wizer = new context.RandomWizer(context.QuestionBank.questions);
  const papers = wizer.generateSet(100);
  assert.equal(papers.length, 100);
  assert.equal(papers[0].questions.length, 180);
  const counts = Object.groupBy(papers[0].questions, q => q.subject);
  for (const subject of ["Physics", "Chemistry", "Botany", "Zoology"]) assert.equal(counts[subject].length, 45);
});

test("Shamir secret sharing reconstructs from three of five shares", () => {
  const sharing = new context.FortressDSA.ShamirSecretSharing();
  const secret = new TextEncoder().encode("NEET-KEY");
  const shares = sharing.split(secret, 5, 3);
  assert.equal(new TextDecoder().decode(sharing.combine([shares[0], shares[2], shares[4]])), "NEET-KEY");
});

test("morphing preserves a valid answer index", () => {
  const source = context.QuestionBank.questions[0];
  for (const strategy of context.MorphEngine.strategies) {
    const result = context.MorphEngine.morph(source, strategy);
    assert.ok(result.validity >= 70);
    assert.ok(result.question.answer >= 0 && result.question.answer < result.question.options.length);
  }
});

test("offline assistant explains monitoring privacy from local context", () => {
  const assistant = new context.FortressAssistant(() => ({ name: "Admin", monitoring: false, threat: 8 }));
  const answer = assistant.answer("Does camera monitoring record or upload me?");
  assert.match(answer, /staff user chooses Enable monitoring and grants browser permission/i);
  assert.match(answer, /Candidates can take exams without granting camera or microphone access/i);
  assert.match(answer, /not recorded, stored, or uploaded/i);
});

test("workspace saves the organization and selected preview role", () => {
  const workspace = context.ExamWorkspace;
  assert.equal(workspace.profile().role, "guest");
  workspace.save({ name: " Avery ", organization: " Example College ", type: "college", role: "coordinator" });
  assert.equal(workspace.profile().organization, "Example College");
  assert.equal(workspace.profile().name, "Avery");
  assert.equal(workspace.roles[workspace.profile().role].home, "command");
  assert.equal(workspace.greeting(new Date(2026, 10, 13, 9)), "Good morning");
  assert.equal(workspace.greeting(new Date(2026, 10, 13, 13)), "Good afternoon");
  assert.equal(workspace.greeting(new Date(2026, 10, 13, 20)), "Good evening");
});

test("custom exams use non-science subjects, variable option counts, and saved marking", () => {
  const learning = context.ExamLearning;
  const question = { subject: "Workplace safety", chapter: "Evacuation", text: "Choose the exit.", options: ["Stairs", "Lift"], answer: 0 };
  assert.equal(learning.importQuestions([question, { ...question, subject: "First aid" }, { ...question, text: "Leave now?" }]), 3);
  assert.throws(() => learning.importQuestions([question, { ...question, answer: 2 }]), /Question 2/);
  learning.attach(context.QuestionBank);
  assert.equal(learning.questionPool("organization").length, 3);
  assert.equal(learning.questionPool("demo").length, 924);
  assert.equal(learning.subjects("organization").join(", "), "First aid, Workplace safety");
  const exam = learning.saveExam({ name: "Certification", source: "organization", count: 2, minutes: 15, correct: 5, incorrect: -2 });
  assert.throws(() => learning.saveExam({ ...exam, subject: "First aid" }), /1 matching questions/);
  const attempt = learning.start("configured", "", exam);
  assert.equal(attempt.timeLimitMs, 15 * 60_000);
  assert.equal(new Set(attempt.questions.map(q => q.subject)).size, 2);
  assert.equal(learning.current().id, attempt.id);
  attempt.answers[0] = attempt.questions[0].answer;
  attempt.answers[1] = 1 - attempt.questions[1].answer;
  learning.saveExam({ ...exam, correct: 7, incorrect: 0 }, exam.id);
  const { result } = learning.finish(attempt);
  assert.equal(result.score, 3);
  assert.equal(result.maxScore, 10);
  assert.equal(result.subjects[0].maxScore, 5);
  assert.equal(learning.current(), null);
  assert.equal(learning.history()[0].name, "Certification");
  assert.equal(learning.score({ questions: attempt.questions, answers: attempt.answers }).score, 3);
});

test("concurrent local audit events stay hash-linked", async () => {
  const security = new context.SecurityCore();
  await Promise.all([security.log("EXAM_SAVED", "Created exam"), security.log("PAPERS_GENERATED", "Created variants")]);
  assert.equal(security.audit.length, 2);
  assert.equal(security.audit[1].previous, security.audit[0].hash);
  assert.equal(await security.verifyAudit(), true);
});

test("local access monitor starts in a private inactive state", () => {
  const monitor = new context.LocalAccessMonitor();
  assert.equal(monitor.running, false);
  assert.deepEqual(Object.keys(monitor.metrics), ["motion", "light", "sound", "environment"]);
});
