import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the NEET Fortress host and social metadata", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>NEET Fortress v4 — Examination Security OS<\/title>/i);
  assert.match(html, /<iframe src="\/fortress\/index\.html"/i);
  assert.match(html, /allow="camera; microphone; clipboard-write"/i);
  assert.match(html, /property="og:image" content="http:\/\/localhost(?::3000)?\/og\.png"/i);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("ships the complete offline module surface", async () => {
  const root = new URL("../public/fortress/", import.meta.url);
  const required = [
    "index.html", "styles.css", "app.js", "questions.js", "dsa.js", "morph.js",
    "engine.js", "security.js", "ai.js", "portal.js", "godmode.js", "lockdown.js",
    "monitoring.js", "assistant.js", "hack_test.html",
  ];
  const files = await readdir(root);
  for (const name of required) assert.ok(files.includes(name), `${name} is required`);
  const [index, app, packageJson] = await Promise.all([
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("app.js", root), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(index, /data-view="shadow"/);
  assert.match(index, /data-view="monitor"/);
  assert.match(index, /id="adminWelcome"/);
  assert.match(index, /id="assistantPanel"/);
  assert.match(index, /not recorded, stored, uploaded/i);
  assert.match(index, /id="permissionBlocked"/);
  assert.match(index, /id="continueWithoutMonitoring"/);
  assert.match(index, /automatically requests camera and microphone access/i);
  assert.match(index, /Administrators may continue/i);
  assert.match(index, /hack_test\.html/);
  assert.match(app, /new HyperShuffler/);
  assert.match(app, /new LockdownGuard/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await access(new URL("../public/og.png", import.meta.url));
});
