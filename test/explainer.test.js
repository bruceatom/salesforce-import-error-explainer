const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const E = require("../explainer.js");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", "examples", f), "utf8");

test("parseCSV handles quotes, doubled quotes, embedded newlines, CRLF and BOM", () => {
  const rows = E.parseCSV('﻿a,b\r\n"x, y","he said ""hi"""\r\n"line1\nline2",z\r\n');
  assert.deepEqual(rows, [["a", "b"], ["x, y", 'he said "hi"'], ["line1\nline2", "z"]]);
});

test("parseCSV detects semicolon delimiter", () => {
  assert.deepEqual(E.parseCSV("a;b\n1;2\n"), [["a", "b"], ["1", "2"]]);
});

test("Data Loader sample: finds ERROR column and groups by cause", () => {
  const r = E.analyze(read("dataloader-contacts-error.csv"));
  assert.equal(r.mode, "csv");
  assert.equal(r.errorColumn, "ERROR");
  assert.equal(r.totalRows, 137);
  const byCode = Object.fromEntries(r.groups.map((g) => [g.code, g]));
  assert.equal(byCode.INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST.count, 58);
  assert.equal(byCode.INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST.breakdown.length, 2);
  assert.equal(byCode.FIELD_CUSTOM_VALIDATION_EXCEPTION.breakdown[0].detail, "Phone is required for Customer contacts");
  assert.equal(byCode.DATE_PARSE.count, 18);
  assert.equal(byCode.DATE_PARSE.breakdown.length, 1, "dates group by pattern, not by value");
  assert.equal(byCode.REQUIRED_FIELD_MISSING.breakdown[0].field, "LastName");
  assert.equal(byCode.CANNOT_EXECUTE_FLOW_TRIGGER.owner, "automation");
  assert.equal(r.groups[0].code, "INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST", "sorted by count");
  assert.ok(r.needsHelp.length >= 1);
});

test("Bulk API failed results: finds sf__Error column", () => {
  const r = E.analyze(read("bulk-api-accounts-failed-results.csv"));
  assert.equal(r.errorColumn, "sf__Error");
  const codes = r.groups.map((g) => g.code);
  assert.deepEqual(codes, ["DUPLICATE_VALUE", "NUMBER_PARSE", "STRING_TOO_LONG", "CANNOT_INSERT_UPDATE_ACTIVATE_ENTITY"]);
  assert.equal(r.groups[0].breakdown[0].field, "Legacy_Id__c");
  assert.equal(r.groups[2].breakdown[0].detail, "max length 255");
  assert.match(r.groups[3].breakdown[0].detail, /AccountTrigger/);
});

test("pasted lines without a header are read one per line", () => {
  const r = E.analyze("REQUIRED_FIELD_MISSING:Required fields are missing: [LastName]:LastName --\nUNABLE_TO_LOCK_ROW:unable to obtain exclusive access to this record or 1 records: 0015g00000AbCdEAAZ:--\n");
  assert.equal(r.mode, "lines");
  assert.equal(r.totalRows, 2);
  assert.equal(r.byOwner.timing, 1);
});

test("unknown codes and code-less messages are kept, not dropped", () => {
  const r = E.analyze("SOME_NEW_CODE:something:--\nGeneric failure text\n");
  const codes = r.groups.map((g) => g.code).sort();
  assert.deepEqual(codes, ["SOME_NEW_CODE", "UNRECOGNIZED"]);
  assert.ok(r.groups.every((g) => g.owner === "unknown"));
});

test("diagnoseDate", () => {
  assert.match(E.diagnoseDate("13/04/2026"), /day-first/);
  assert.match(E.diagnoseDate("04/05/2026"), /ambiguous/);
  assert.match(E.diagnoseDate("45123"), /Excel serial/);
  assert.match(E.diagnoseDate("TBD"), /not a recognisable/);
});

test("summary masks emails and IDs and omits values by default", () => {
  const r = E.analyze(read("dataloader-contacts-error.csv"));
  const s = E.summaryText(r, false);
  assert.doesNotMatch(s, /@example\.com/);
  assert.doesNotMatch(s, /0015g00000/);
  assert.doesNotMatch(s, /Health Care/);
  assert.match(s, /Phone is required for Customer contacts/);
  const withValues = E.summaryText(r, true);
  assert.match(withValues, /Health Care/);
  assert.doesNotMatch(withValues, /@example\.com/);
});

test("rowsToCSV round-trips original columns", () => {
  const r = E.analyze(read("bulk-api-accounts-failed-results.csv"));
  const csv = E.rowsToCSV(r, r.groups[1]);
  const back = E.parseCSV(csv);
  assert.equal(back[0][1], "sf__Error");
  assert.equal(back.length, 5);
  assert.equal(back[1][4], "1,250,000");
});

test("every knowledge-base entry is complete", () => {
  for (const [code, kb] of Object.entries(E.CODES)) {
    assert.ok(kb.title && kb.cause && kb.steps.length, code);
    assert.ok(E.OWNERS[kb.owner], code + " owner");
  }
});

test("pasted line containing commas stays one message", () => {
  const r = E.analyze("INVALID_FIELD_FOR_INSERT_UPDATE:Unable to create/update fields: CreatedDate, LastModifiedDate. Please check the security settings of this field.:CreatedDate,LastModifiedDate --\n");
  assert.equal(r.mode, "lines");
  assert.equal(r.groups[0].breakdown[0].field, "CreatedDate,LastModifiedDate");
});

test("Bulk API 1.0 / Import Wizard result file: only rows with an Error are counted", () => {
  const csv = '"Id","Success","Created","Error"\n"0035g00000AAAAAAA1","true","true",""\n"","false","false","REQUIRED_FIELD_MISSING:Required fields are missing: [LastName]:LastName --"\n';
  const r = E.analyze(csv);
  assert.equal(r.errorColumn, "Error");
  assert.equal(r.totalRows, 1);
  assert.equal(r.groups[0].code, "REQUIRED_FIELD_MISSING");
});
