import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { appOrigin, assertAppReady, redirectHtml } from "../lib/pages-redirect.mjs";

test("Pages preserves login, dashboard and reset links on the fixed application origin", () => {
  const html = redirectHtml("https://app.example.com");
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  for (const [pathname, expected] of [
    ["/ScholarAI/", "/login"], ["/ScholarAI", "/login"],
    ["/ScholarAI/dashboard", "/dashboard"],
    ["/ScholarAI/reset-password", "/reset-password"],
    ["/ScholarAI//evil.example", "//evil.example"],
  ]) {
    let actual;
    vm.runInNewContext(script, { URL, location: {
      pathname, search: "?token=test", hash: "#section", replace: (value) => { actual = value; },
    } });
    assert.equal(actual, `https://app.example.com${expected}?token=test#section`);
  }
});

test("Pages refuses insecure, credentialed or self-referential destinations", () => {
  for (const url of ["http://app.example.com", "https://user:pass@app.example.com", "https://faresfadly1.github.io/ScholarAI/", "https://app.example.com/login", "https://app.example.com?x=1"]) {
    assert.throws(() => appOrigin(url));
  }
  assert.equal(appOrigin("https://app.example.com/"), "https://app.example.com");
});

test("Pages will not replace the live entry point with an unhealthy backend", async () => {
  await assert.rejects(() => assertAppReady("https://app.example.com", async () => Response.json({ status: "not ready" }, { status: 503 })));
  await assert.rejects(() => assertAppReady("https://app.example.com", async () => Response.json({ status: "ready" })));
  await assertAppReady("https://app.example.com", async () => Response.json({ status: "ready", service: "scholarai-web" }));
});
