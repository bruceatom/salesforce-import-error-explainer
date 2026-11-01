#!/usr/bin/env node
/*
 * Import error lab runner.
 * Loads deliberately bad rows into a throwaway Developer Edition org with the Salesforce CLI (Bulk API 2.0),
 * saves each job's failed-results CSV to lab/results/, then scores the explainer against the expected codes.
 *
 * Usage (from the repo root):
 *   sf org login web --alias lab
 *   (cd lab && sf project deploy start --target-org lab && sf org assign permset --name Error_Lab_Access --target-org lab)
 *   node lab/run-lab.js --org lab            # seed, load, collect, score
 *   node lab/run-lab.js --score-only         # re-score files already in lab/results/
 *
 * Never point this at a real company org: it creates, deletes and converts records.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const E = require("../explainer.js");

const args = process.argv.slice(2);
const ORG = (args[args.indexOf("--org") + 1] || "").trim();
const SCORE_ONLY = args.includes("--score-only");
const API = "v62.0";
const DATA = path.join(__dirname, "data");
const RESULTS = path.join(__dirname, "results");
const isWin = process.platform === "win32";
const NO_FAILURES = "(no failed rows)";
fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(RESULTS, { recursive: true });

function sf(argv, { allowFail = false } = {}) {
  const quoted = argv.map((a) => (isWin && /[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a));
  const r = spawnSync("sf", quoted.concat(["--target-org", ORG]), { encoding: "utf8", shell: isWin, maxBuffer: 64 * 1024 * 1024 });
  const out = (r.stdout || "") + (r.stderr || "");
  if (r.status !== 0 && !allowFail) throw new Error(`sf ${argv.join(" ")} failed:\n${out.slice(0, 2000)}`);
  return out;
}
const json = (text) => { try { return JSON.parse(text.slice(text.indexOf("{"))); } catch (e) { return null; } };
const createRecord = (sobject, values) => json(sf(["data", "create", "record", "--sobject", sobject, "--values", values, "--json"])).result.id;
const query = (soql) => (json(sf(["data", "query", "--query", soql, "--json"])).result.records || []);
const csvCell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const writeCsv = (name, rows) => fs.writeFileSync(path.join(DATA, name), rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n");

// expect: codes counted as correct. "learn": the lab is discovering the real wording for this case.
function recipes(ids) {
  return [
    { id: "R01", object: "Contact", op: "insert", expect: ["REQUIRED_FIELD_MISSING"],
      rows: [["FirstName", "LastName"], ["Good", "Row"], ["Missing", ""]] },
    { id: "R02", object: "Account", op: "insert", expect: ["INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST"], note: "Shows which variants Salesforce rejects",
      rows: [["Name", "Tier__c"], ["Lab Good Tier", "Gold"], ["Lab Platinum", "Platinum"], ["Lab Trailing", "Gold "], ["Lab Upper", "GOLD"]] },
    { id: "R03", object: "Contact", op: "insert", expect: ["FIELD_CUSTOM_VALIDATION_EXCEPTION"],
      rows: [["LastName", "Contact_Type__c", "Phone"], ["Has Phone", "Customer", "555-0100"], ["No Phone", "Customer", ""]] },
    { id: "R04", object: "Contact", op: "insert", expect: ["DUPLICATES_DETECTED"], note: "Needs the standard Contact duplicate rule set to Block",
      rows: [["FirstName", "LastName", "Email"], ["Dupe", "Person", "dupe.person@example.com"]] },
    { id: "R05", object: "Account", op: "insert", expect: ["DUPLICATE_VALUE"],
      rows: [["Name", "Legacy_Id__c"], ["Lab Dup A", "L-DUP"], ["Lab Dup B", "L-DUP"], ["Lab Existing Key", "L-EXIST"]] },
    { id: "R06", object: "Account", op: "upsert", externalId: "Legacy_Id__c", expect: ["DUPLICATE_VALUE", "DUPLICATE_EXTERNAL_ID"],
      rows: [["Name", "Legacy_Id__c"], ["Lab Upsert A", "L-UP"], ["Lab Upsert B", "L-UP"]] },
    { id: "R07", object: "Contact", op: "insert", expect: ["INVALID_EMAIL_ADDRESS"],
      rows: [["LastName", "Email"], ["Good Email", "good@example.com"], ["Double At", "bob@@example.com"], ["Two Emails", "a@example.com; c@example.com"]] },
    { id: "R08", object: "Account", op: "insert", expect: ["STRING_TOO_LONG"],
      rows: [["Name", "Short_Code__c"], ["Lab Short OK", "ABC"], ["Lab Short Long", "ABCDEFG"]] },
    { id: "R09", object: "Account", op: "insert", expect: ["NUMBER_OUTSIDE_VALID_RANGE"],
      rows: [["Name", "Employee_Band__c"], ["Lab Band OK", "12"], ["Lab Band Big", "12345"]] },
    { id: "R10", object: "Account", op: "insert", expect: ["NUMBER_PARSE", "INVALID_TYPE_ON_FIELD_IN_RECORD"], learn: true,
      rows: [["Name", "Employee_Band__c"], ["Lab Comma", "1,200"], ["Lab Dollar", "$500"], ["Lab NA", "n/a"]] },
    { id: "R11", object: "Contact", op: "insert", expect: ["DATE_PARSE", "INVALID_TYPE_ON_FIELD_IN_RECORD"], learn: true,
      rows: [["LastName", "Birthdate"], ["Date OK", "1990-04-13"], ["Day First", "13/04/1990"], ["Offset", "1990-01-01T23:01:01+01:00"], ["Serial", "45123"], ["Text", "TBD"]] },
    { id: "R12", object: "Contact", op: "insert", expect: ["MALFORMED_ID", "FIELD_INTEGRITY_EXCEPTION"], learn: true,
      rows: [["LastName", "AccountId"], ["Bad Id Text", "abc"], ["Wrong Object Id", ids.contactId]] },
    { id: "R13", object: "Contact", op: "insert", expect: ["ENTITY_IS_DELETED", "INVALID_CROSS_REFERENCE_KEY"], learn: true,
      rows: [["LastName", "AccountId"], ["Deleted Parent", ids.deletedAccountId], ["Missing Parent", "001000000000000AAA"]] },
    { id: "R14", object: "Contact", op: "update", expect: ["MISSING_ARGUMENT", "INVALID_ID_FIELD", "INVALID_CROSS_REFERENCE_KEY", "MALFORMED_ID"], learn: true,
      rows: [["Id", "Title"], ["", "Blank Id"], ["003000000000000AAA", "Random Id"]] },
    { id: "R15", object: "Account", op: "insert", expect: ["INVALID_FIELD_FOR_INSERT_UPDATE", "INVALID_FIELD"], learn: true,
      rows: [["Name", "Lab_Formula__c"], ["Lab Formula", "x"]] },
    { id: "R16", object: "Account", op: "insert", expect: ["INVALID_FIELD"], note: "Job-level failure expected",
      rows: [["Name", "Nonexistent__c"], ["Lab Bad Header", "x"]] },
    { id: "R17", object: "Lead", op: "update", expect: ["CANNOT_UPDATE_CONVERTED_LEAD"],
      rows: [["Id", "Title"], [ids.convertedLeadId, "Updated"]] },
    { id: "R18", object: "Contact", op: "insert", expect: ["FIELD_FILTER_VALIDATION_EXCEPTION"],
      rows: [["LastName", "Preferred_Account__c"], ["Prefers Gold", ids.goldAccountId], ["Prefers Bronze", ids.bronzeAccountId]] },
    { id: "R19", object: "Lab_Event__c", op: "insert", expect: ["CANNOT_INSERT_UPDATE_ACTIVATE_ENTITY"],
      rows: [["Name"], ["fine"], ["BOOM"]] },
    { id: "R20", object: "Lead", op: "insert", expect: ["CANNOT_EXECUTE_FLOW_TRIGGER"], note: "Needs the FlowFail Flow from lab/README.md",
      rows: [["LastName", "Company", "LeadSource"], ["Flow OK", "Lab Co", "Web"], ["Flow Fail", "Lab Co", "FlowFail"]] }
  ];
}

function seed() {
  console.log("Seeding records...");
  const ids = {};
  ids.goldAccountId = createRecord("Account", "Name='Lab Gold' Tier__c=Gold Legacy_Id__c=L-EXIST");
  ids.bronzeAccountId = createRecord("Account", "Name='Lab Bronze' Tier__c=Bronze");
  ids.deletedAccountId = createRecord("Account", "Name='Lab Deleted'");
  sf(["data", "delete", "record", "--sobject", "Account", "--record-id", ids.deletedAccountId]);
  ids.contactId = createRecord("Contact", "FirstName=Dupe LastName=Person Email=dupe.person@example.com");
  sf(["apex", "run", "--file", path.join(__dirname, "convert-lead.apex")]);
  const lead = query("SELECT Id FROM Lead WHERE LastName = 'Lab Converted' AND IsConverted = true ORDER BY CreatedDate DESC LIMIT 1")[0];
  ids.convertedLeadId = lead ? lead.Id : "";
  fs.writeFileSync(path.join(RESULTS, "seed-ids.json"), JSON.stringify(ids, null, 2));
  return ids;
}

function runRecipe(r) {
  const file = path.join(DATA, `${r.id}.csv`);
  writeCsv(`${r.id}.csv`, r.rows);
  const base = { insert: ["data", "import", "bulk"], update: ["data", "update", "bulk"], upsert: ["data", "upsert", "bulk"] }[r.op];
  const argv = base.concat(["--file", file, "--sobject", r.object, "--wait", "10", "--json"]);
  if (r.externalId) argv.push("--external-id", r.externalId);
  const out = sf(argv, { allowFail: true });
  const m = out.match(/750[A-Za-z0-9]{12,15}/);
  if (!m) {
    fs.writeFileSync(path.join(RESULTS, `${r.id}.csv`), out.replace(/\s+/g, " ").slice(0, 1000) + "\n");
    return;
  }
  let failed = sf(["api", "request", "rest", `/services/data/${API}/jobs/ingest/${m[0]}/failedResults/`], { allowFail: true });
  if (!/sf__Error/.test(failed)) {
    const info = json(sf(["api", "request", "rest", `/services/data/${API}/jobs/ingest/${m[0]}/`], { allowFail: true })) || {};
    failed = (info.errorMessage || NO_FAILURES) + "\n";
  }
  fs.writeFileSync(path.join(RESULTS, `${r.id}.csv`), failed);
}

function score(list) {
  const lines = [["recipe", "object", "expected", "found_codes", "failed_rows", "result", "note"]];
  let pass = 0, scored = 0;
  for (const r of list) {
    const f = path.join(RESULTS, `${r.id}.csv`);
    if (!fs.existsSync(f)) { lines.push([r.id, r.object, r.expect.join("|"), "", 0, "not run", r.note || ""]); continue; }
    const text = fs.readFileSync(f, "utf8");
    const report = text.trim() === NO_FAILURES ? { groups: [], totalRows: 0 } : E.analyze(text);
    const found = report.groups.map((g) => g.code);
    const real = report.groups;
    const ok = real.length > 0 && real.every((g) => r.expect.includes(g.code));
    const result = real.length === 0 ? "not provoked" : ok ? "pass" : r.learn ? "learn" : "FAIL";
    if (real.length) { scored++; if (ok) pass++; }
    lines.push([r.id, r.object, r.expect.join("|"), found.join("|"), report.totalRows, result, r.note || ""]);
  }
  fs.writeFileSync(path.join(RESULTS, "summary.csv"), lines.map((l) => l.map(csvCell).join(",")).join("\n") + "\n");
  console.table(lines.slice(1).map((l) => ({ recipe: l[0], expected: l[2], found: l[3], rows: l[4], result: l[5] })));
  console.log(`${pass}/${scored} provoked recipes classified as expected. Details: lab/results/summary.csv`);
  console.log("For 'learn' and 'FAIL' rows, open lab/results/<recipe>.csv and add the real wording to the corpus.");
}

if (SCORE_ONLY) {
  const ids = fs.existsSync(path.join(RESULTS, "seed-ids.json")) ? JSON.parse(fs.readFileSync(path.join(RESULTS, "seed-ids.json"), "utf8")) : {};
  score(recipes(ids));
} else {
  if (!ORG) { console.error("Pass --org <alias>, for example: node lab/run-lab.js --org lab"); process.exit(1); }
  const ids = seed();
  const list = recipes(ids);
  for (const r of list) { process.stdout.write(`Running ${r.id} (${r.object} ${r.op})... `); runRecipe(r); console.log("done"); }
  score(list);
}
