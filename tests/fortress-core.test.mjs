import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { TextEncoder, TextDecoder } from "node:util";
import crypto from "node:crypto";

const context = {
  console,
  TextEncoder,
  TextDecoder,
  crypto: crypto.webcrypto,
  CustomEvent: class CustomEvent extends Event { constructor(type, init = {}) { super(type); this.detail = init.detail; } },
  Event,
  EventTarget,
  setInterval,
  clearInterval,
};
context.window = context;
context.globalThis = context;
vm.createContext(context);

for (const file of ["questions.js", "dsa.js", "morph.js", "engine.js", "assistant.js", "monitoring.js"]) {
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
  const assistant = new context.FortressAssistant(() => ({ adminName: "Admin", monitoring: false, threat: 8 }));
  const answer = assistant.answer("Does camera monitoring record or upload me?");
  assert.match(answer, /requested automatically in each new browser session/i);
  assert.match(answer, /Administrators may continue/i);
  assert.match(answer, /not recorded, uploaded/i);
});

test("local access monitor starts in a private inactive state", () => {
  const monitor = new context.LocalAccessMonitor();
  assert.equal(monitor.running, false);
  assert.deepEqual(Object.keys(monitor.metrics), ["motion", "light", "sound", "environment"]);
});
