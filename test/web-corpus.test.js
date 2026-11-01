// Regression test: 79 real error messages collected from public web pages (sources in the CSV).
// The parser was tuned while looking at these, so this guards against regressions; it is not an accuracy estimate.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const E = require("../explainer.js");

const rows = E.parseCSV(fs.readFileSync(path.join(__dirname, "..", "examples", "web-error-corpus.csv"), "utf8"));
const h = rows[0];
const col = (r, n) => r[h.indexOf(n)];

test("web corpus: error codes", () => {
  const misses = rows.slice(1).filter((r) => E.classify(col(r, "message")).code !== col(r, "expected_code"));
  assert.ok(misses.length === 0, "code misses:\n" + misses.map((r) => `${r[0]} ${col(r, "expected_code")} got ${E.classify(col(r, "message")).code}`).join("\n"));
});

test("web corpus: usually-fixed-by owner (at least 90%)", () => {
  const n = rows.length - 1;
  const ok = rows.slice(1).filter((r) => E.classify(col(r, "message")).owner === col(r, "expected_owner")).length;
  assert.ok(ok / n >= 0.9, `owner ${ok}/${n}`);
});

test("web corpus: whole file analyses without throwing", () => {
  const report = E.analyze(rows.slice(1).map((r) => col(r, "message")).join("\n"));
  assert.equal(report.totalRows, rows.length - 1);
});
