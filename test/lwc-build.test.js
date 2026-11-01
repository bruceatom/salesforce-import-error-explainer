// The Salesforce package's parser is generated from explainer.js; fail if someone edits one without the other.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

test("LWC core module is in sync with explainer.js", () => {
  const target = path.join(__dirname, "..", "salesforce", "force-app", "main", "default", "lwc", "importErrorCore", "importErrorCore.js");
  const before = fs.readFileSync(target, "utf8");
  execFileSync(process.execPath, [path.join(__dirname, "..", "scripts", "build-lwc.js")], { stdio: "ignore" });
  assert.equal(fs.readFileSync(target, "utf8"), before, "run: node scripts/build-lwc.js");
});
