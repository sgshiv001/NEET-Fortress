import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

async function request(path = "/", headers = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Exam Fortress host and social metadata", async () => {
  const response = await request("/", { accept: "text/html" });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Exam Fortress \| Exam Security<\/title>/i);
  assert.match(html, /<iframe src="\/fortress\/index\.html"/i);
  assert.match(html, /allow="camera; microphone; clipboard-write"/i);
  assert.match(html, /property="og:title" content="Exam Fortress \| Exam Security"/i);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("current-user returns a private signed-in display name or a guest response", async () => {
  const guest = await request("/api/current-user");
  assert.equal(guest.status, 200);
  assert.deepEqual(await guest.json(), { user: null });
  const signedIn = await request("/api/current-user", {
    "oai-authenticated-user-id": "site-user-1",
    "oai-authenticated-user-email": "exam@example.test",
    "oai-authenticated-user-full-name": encodeURIComponent("Avery López"),
    "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
  });
  assert.equal(signedIn.status, 200);
  assert.match(signedIn.headers.get("cache-control"), /private, no-store/);
  assert.deepEqual(await signedIn.json(), { user: { id: "site-user-1", displayName: "Avery López" } });
});

test("ships the complete offline module surface", async () => {
  const root = new URL("../public/fortress/", import.meta.url);
  const required = [
    "index.html", "styles.css", "app.js", "questions.js", "dsa.js", "morph.js",
    "engine.js", "security.js", "ai.js", "portal.js", "godmode.js", "lockdown.js",
    "monitoring.js", "assistant.js", "learning.js", "workspace.js", "hack_test.html",
  ];
  const files = await readdir(root);
  for (const name of required) assert.ok(files.includes(name), `${name} is required`);
  const [index, app, packageJson] = await Promise.all([
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("app.js", root), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(index, /data-view="monitor"/);
  assert.match(index, /data-view="sentinel"/);
  assert.match(index, /data-view="vault"/);
  assert.match(index, /id="workspaceWelcome"/);
  assert.match(index, /id="profileOrganization"/);
  assert.match(index, /id="profileRole"/);
  assert.match(index, /id="examSetupForm"/);
  assert.match(index, /id="assistantPanel"/);
  assert.match(index, /not recorded, stored, or uploaded/i);
  assert.match(index, /id="monitorFeedback"/);
  assert.match(index, /Optional camera and microphone access/i);
  assert.match(index, /id="continueToWorkspace"/);
  assert.match(index, /data-view="student"/);
  assert.match(index, /id="view-exam"/);
  assert.match(index, /id="view-results"/);
  assert.match(index, /Exam security overview/i);
  assert.match(index, /hack_test\.html/);
  assert.match(app, /new RandomWizer/);
  assert.match(app, /new LockdownGuard/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await access(new URL("../public/favicon.svg", import.meta.url));
});
