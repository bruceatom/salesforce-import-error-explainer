/*
 * Salesforce Import Error Explainer - core logic.
 * Pure functions, no DOM access. Runs in the browser (global SFErrorExplainer)
 * and in Node (module.exports) for tests. Nothing here sends data anywhere.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.SFErrorExplainer = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Who usually resolves the problem.
  var OWNERS = {
    file: { label: "Fix the file", hint: "Usually fixable by correcting values in the CSV and re-running only the failed rows." },
    setup: { label: "Admin setting or permission", hint: "Usually needs someone with Salesforce admin access to check a setting, rule or permission." },
    automation: { label: "Automation or code", hint: "Usually needs an admin or developer to look at a Flow, trigger or other automation." },
    timing: { label: "Timing or load pattern", hint: "Usually caused by how the load ran (order, batch size, parallel jobs) rather than by the values." },
    unknown: { label: "Needs investigation", hint: "Not a recognised pattern. Read the full message and check it in your org." }
  };

  // Knowledge base. Explanations describe the most likely causes; they are not a diagnosis of a specific org.
  var CODES = {
    REQUIRED_FIELD_MISSING: {
      title: "A required field is blank or not mapped",
      owner: "file",
      cause: "Salesforce requires a value for the field(s) named in the message, and the row had none. Common reasons: the column was not mapped, the cell is empty, or the field is always required (for example Last Name on Contacts and Leads, Account Name on Accounts).",
      steps: [
        "Check that the column is included in your field mapping, not just present in the file.",
        "Fill the blank cells, or agree a default value with the business owner.",
        "Re-run only the failed rows, then spot-check a few records in Salesforce."
      ]
    },
    INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST: {
      title: "Value is not allowed in a restricted picklist",
      owner: "file",
      cause: "The picklist only accepts its defined values, and the file contains something else. Typical differences: spelling, extra spaces, a label where the API name is expected, an inactive value, or a value not available for the record type.",
      steps: [
        "Compare each rejected value below with the picklist's values exactly, including spaces and capitalisation.",
        "Map variants to an existing value (for example \"Healthcare \" to \"Healthcare\").",
        "If the value is genuinely new, ask your admin whether it should be added to the picklist and the record type.",
      ]
    },
    FIELD_CUSTOM_VALIDATION_EXCEPTION: {
      title: "Blocked by one of your org's validation rules",
      owner: "setup",
      cause: "A validation rule in your org rejected the record. The message text is the rule's own error message, so the grouping below shows which rules blocked the most rows.",
      steps: [
        "Find the rule: Setup > Object Manager > the object > Validation Rules, and match the error message.",
        "Decide with the business owner whether the data should be corrected to meet the rule, or whether the rule should allow these records.",
        "Avoid simply switching rules off in production during a load without an agreed plan to switch them back on."
      ]
    },
    DUPLICATES_DETECTED: {
      title: "Stopped by a duplicate rule",
      owner: "setup",
      cause: "An active duplicate rule found an existing record that matches this row and is set to block it.",
      steps: [
        "Decide whether these rows should update the existing records instead of creating new ones.",
        "If so, use an update or upsert keyed on the existing record Id or an external ID.",
        "Review the matching and duplicate rules with your admin before changing them."
      ]
    },
    DUPLICATE_VALUE: {
      title: "A unique field value is already used",
      owner: "file",
      cause: "A field marked unique (often an external ID) already holds this value on another record, or the value appears more than once in your file.",
      steps: [
        "Check the file for repeated values in the field named below.",
        "If the rows are meant to update existing records, use upsert on that external ID instead of insert."
      ]
    },
    INVALID_EMAIL_ADDRESS: {
      title: "Email address format is not valid",
      owner: "file",
      cause: "The email field contains something Salesforce does not accept as an address: spaces, two @ signs, a missing domain, or several addresses in one cell.",
      steps: [
        "Clean the addresses in the field(s) named below.",
        "Move extra addresses to a separate field or note rather than one cell."
      ]
    },
    STRING_TOO_LONG: {
      title: "Text is longer than the field allows",
      owner: "file",
      cause: "The value exceeds the field's maximum length (shown in the message where available).",
      steps: [
        "Shorten the values, or map them to a long text field.",
        "If the field really needs to hold longer values, ask your admin about increasing its length."
      ]
    },
    DATE_PARSE: {
      title: "Date could not be read",
      owner: "file",
      cause: "The loader could not convert the value to a date. Common reasons: day-first dates (13/04/2026) when month-first is expected, text such as \"TBD\", or Excel changing the format when saving the CSV.",
      steps: [
        "Prefer the unambiguous format YYYY-MM-DD (date) or YYYY-MM-DDThh:mm:ssZ (date/time).",
        "If the whole file is day-first, Data Loader has a \"Use European date format\" setting; check it matches the file.",
        "Open the CSV in a plain text editor to see what Excel actually saved."
      ]
    },
    NUMBER_PARSE: {
      title: "Number could not be read",
      owner: "file",
      cause: "A number, currency or percent field received text it could not convert: thousands separators, currency symbols, spaces or words.",
      steps: [
        "Remove separators and symbols, so 1,200.50 becomes 1200.50.",
        "Leave the cell blank rather than writing \"n/a\" or \"TBD\"."
      ]
    },
    INVALID_TYPE_ON_FIELD_IN_RECORD: {
      title: "Value is the wrong type for the field",
      owner: "file",
      cause: "The value does not match the field type, for example text in a number field or \"Yes\" in a checkbox.",
      steps: [
        "Use plain numbers for number fields and TRUE/FALSE for checkboxes.",
        "Check the values listed below against the field type in Object Manager."
      ]
    },
    MALFORMED_ID: {
      title: "A record ID is not valid for that field",
      owner: "file",
      cause: "An ID column or lookup holds something that is not a Salesforce ID, or an ID for the wrong object (for example a Contact ID in an Account lookup). Excel can also damage 15-character IDs.",
      steps: [
        "Use 18-character IDs exported from this org.",
        "Check the lookup column points at the right object.",
        "Consider upserting with an external ID relationship instead of hard-coded IDs."
      ]
    },
    INVALID_CROSS_REFERENCE_KEY: {
      title: "A related record cannot be found",
      owner: "file",
      cause: "The ID looks valid but the related record does not exist in this org, has been deleted, or the running user cannot see it. IDs copied from a sandbox or an old org are a common source.",
      steps: [
        "Re-export the related records from this org and rebuild the lookup values.",
        "Check the running user can see the related records."
      ]
    },
    INVALID_ID_FIELD: {
      title: "The record Id for an update is not valid",
      owner: "file",
      cause: "An update or delete row has an Id that does not identify an existing record of this object.",
      steps: [
        "Check the Id column holds current 18-character IDs for this object.",
        "Rows for new records should be inserted, not updated."
      ]
    },
    MISSING_ARGUMENT: {
      title: "Update or delete without an Id",
      owner: "file",
      cause: "The operation needs a record Id, but the Id column is blank or not mapped.",
      steps: [
        "Map the Id column, or use upsert with an external ID.",
        "Remove rows with blank IDs and decide whether they are new records."
      ]
    },
    INVALID_FIELD_FOR_INSERT_UPDATE: {
      title: "Field cannot be written by this user",
      owner: "setup",
      cause: "The mapped field is read-only for the running user: a formula or system field, or field-level security prevents editing. Audit fields such as CreatedDate need a special permission and work only on insert.",
      steps: [
        "Remove read-only fields (formulas, roll-ups, system fields) from the mapping.",
        "If the field should be writable, ask your admin to check field-level security for the running user."
      ]
    },
    INVALID_FIELD: {
      title: "Field name not recognised",
      owner: "setup",
      cause: "A mapped column or field name does not exist on the object for this user, or it is misspelt.",
      steps: [
        "Check the field API names in your mapping against Object Manager.",
        "Confirm the running user has access to the field."
      ]
    },
    INSUFFICIENT_ACCESS_OR_READONLY: {
      title: "Running user cannot edit the record",
      owner: "setup",
      cause: "The user running the load lacks edit access to this record (sharing, profile or permission set), or the record is locked, for example by an approval process.",
      steps: [
        "Check the running user's object permissions and record access.",
        "Check for locked records such as those in an approval."
      ]
    },
    INSUFFICIENT_ACCESS_ON_CROSS_REFERENCE_ENTITY: {
      title: "Running user cannot use a related record",
      owner: "setup",
      cause: "The row refers to a related record (owner, parent account, record type and so on) that the running user cannot access or assign.",
      steps: [
        "Check access to the related records named in the lookup columns.",
        "Check the owner and record type values are ones this user can assign."
      ]
    },
    INACTIVE_OWNER_OR_USER: {
      title: "Owner or user is inactive",
      owner: "file",
      cause: "The row assigns or references a user who is no longer active.",
      steps: [
        "Map these rows to an active owner or a queue agreed with the business owner."
      ]
    },
    FIELD_FILTER_VALIDATION_EXCEPTION: {
      title: "Related record does not meet a lookup filter",
      owner: "setup",
      cause: "A lookup filter on the field only allows certain related records, and this one does not qualify.",
      steps: [
        "Check the lookup filter on the field named in the message.",
        "Correct the related record, or agree an exception with your admin."
      ]
    },
    ENTITY_IS_DELETED: {
      title: "Record has been deleted",
      owner: "file",
      cause: "The row refers to a record that is deleted (possibly still in the Recycle Bin).",
      steps: [
        "Re-export current IDs, or restore the record if the deletion was a mistake."
      ]
    },
    CANNOT_UPDATE_CONVERTED_LEAD: {
      title: "Converted leads cannot be updated",
      owner: "file",
      cause: "The row tries to update a lead that has already been converted.",
      steps: [
        "Remove converted leads from the file and update the related contact, account or opportunity instead."
      ]
    },
    NUMBER_OUTSIDE_VALID_RANGE: {
      title: "Number is outside the field's range",
      owner: "file",
      cause: "The number has more digits than the field's length or decimal places allow.",
      steps: [
        "Check the field's length and decimal places in Object Manager and round or correct the values."
      ]
    },
    UNABLE_TO_LOCK_ROW: {
      title: "Record was locked by another process",
      owner: "timing",
      cause: "Another update held a lock on this record or a related parent record at the same time. Parallel batches that touch the same parent (for example many contacts under one account) are a common cause.",
      steps: [
        "Sort the file by the parent ID so related rows land in the same batch.",
        "Try a smaller batch size or serial mode for the failed rows.",
        "Find what else was running at the time before adding retries."
      ]
    },
    CANNOT_INSERT_UPDATE_ACTIVATE_ENTITY: {
      title: "Automation failed while saving the record",
      owner: "automation",
      cause: "A trigger or other automation threw an error during the save. The data may be fine; the message usually names the trigger or class involved.",
      steps: [
        "Copy the full message for the admin or developer who owns the automation.",
        "Reproduce with one row in a sandbox before re-running the batch.",
        "Avoid repeated retries until the cause is understood."
      ]
    },
    CANNOT_EXECUTE_FLOW_TRIGGER: {
      title: "A Flow or Process failed while saving the record",
      owner: "automation",
      cause: "A record-triggered Flow or Process Builder process failed. Often the automation assumes a field is populated that your file leaves blank.",
      steps: [
        "Check the Flow error emails or the Flow named in the message.",
        "Compare the failed rows with the Flow's entry criteria and the fields it reads."
      ]
    },
    STORAGE_LIMIT_EXCEEDED: {
      title: "Org data storage is full",
      owner: "setup",
      cause: "The org has used its data storage allocation.",
      steps: [
        "Stop the load and check Setup > Storage Usage with your admin."
      ]
    },
    REQUEST_LIMIT_EXCEEDED: {
      title: "API request limit reached",
      owner: "timing",
      cause: "The org exceeded an API limit, shared with every integration in the org.",
      steps: [
        "Wait for the limit window to reset and check other integrations' usage.",
        "For large loads, use the Bulk API with larger batches."
      ]
    },
    TOO_MANY_ENUM_VALUE: {
      title: "Too many values in a multi-select picklist",
      owner: "file",
      cause: "The cell selects more values than the multi-select picklist allows.",
      steps: [
        "Reduce the number of semicolon-separated values in the cell."
      ]
    }
  };

  var ERROR_HEADER = /^(error|errors|error message|error_message|sf__error|status message)$/i;
  var CODE_AT_START = /^\s*([A-Z][A-Z0-9_]{2,}[A-Z0-9])\s*:/;
  var SF_ID = /\b[a-zA-Z0-9]{3}[0-9][a-zA-Z0-9]{11}(?:[a-zA-Z0-9]{3})?\b/g;
  var EMAIL = /[^\s:;,<>"']+@[^\s:;,<>"']+/g;

  function stripBom(text) {
    return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  }

  function detectDelimiter(text) {
    var firstLine = text.split(/\r?\n/, 1)[0] || "";
    var best = ",", bestCount = 0;
    [",", ";", "\t"].forEach(function (d) {
      var n = firstLine.split(d).length - 1;
      if (n > bestCount) { best = d; bestCount = n; }
    });
    return best;
  }

  // RFC 4180-style parser: quoted fields, doubled quotes, embedded newlines, CRLF.
  function parseCSV(text, delimiter) {
    text = stripBom(text || "");
    var d = delimiter || detectDelimiter(text);
    var rows = [], row = [], field = "", inQuotes = false, i = 0, c;
    while (i < text.length) {
      c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"') { inQuotes = true; i++; continue; }
      if (c === d) { row.push(field); field = ""; i++; continue; }
      if (c === "\r") { i++; continue; }
      if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
      field += c; i++;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (v) { return v.trim() !== ""; }); });
  }

  function looksLikeError(value) {
    return CODE_AT_START.test(value || "") || /Error converting value|Failed to parse date/i.test(value || "");
  }

  // Returns { header, records: [{ rowNumber, message, cells }], errorColumn, mode }
  function extractErrors(text) {
    var rawLines = stripBom(text || "").split(/\r?\n/).filter(function (l) { return l.trim() !== ""; });
    var startsWithError = rawLines.filter(function (l) { return looksLikeError(l.trim().replace(/^"/, "")); }).length;
    if (rawLines.length && startsWithError === rawLines.length) {
      return linesResult(rawLines);
    }
    var rows = parseCSV(text);
    if (!rows.length) return { header: [], records: [], errorColumn: null, mode: "empty" };
    var header = rows[0];
    var headerless = header.some(looksLikeError);
    if (headerless && rows.every(function (r) { return r.length === 1; })) rows = []; // plain pasted lines: use fallback below
    else if (headerless) {
      var errCol = header.findIndex(looksLikeError);
      return {
        header: [],
        records: rows.map(function (r, i) { return { rowNumber: i + 1, message: (r[errCol] || "").trim(), cells: r }; })
          .filter(function (r) { return r.message !== ""; }),
        errorColumn: "column " + (errCol + 1),
        mode: "csv"
      };
    }
    var idx = rows.length ? header.findIndex(function (h) { return ERROR_HEADER.test(h.trim()); }) : -1;

    if (idx < 0 && rows.length > 1) {
      // No recognised header: look for a column whose values look like error messages.
      var sample = rows.slice(1, 51);
      for (var col = 0; col < header.length && idx < 0; col++) {
        var hits = sample.filter(function (r) { return looksLikeError(r[col]); }).length;
        if (hits > 0 && hits >= sample.length / 2) idx = col;
      }
    }

    if (idx >= 0) {
      var records = rows.slice(1).map(function (r, i) {
        return { rowNumber: i + 1, message: (r[idx] || "").trim(), cells: r };
      }).filter(function (r) { return r.message !== ""; });
      return { header: header, records: records, errorColumn: header[idx], mode: "csv" };
    }

    // Fallback: pasted error lines, one per line.
    return linesResult(rawLines);
  }

  function linesResult(rawLines) {
    var lines = rawLines.map(function (l) { return l.trim().replace(/^"(.*)"$/, "$1"); });
    return {
      header: [],
      records: lines.map(function (l, i) { return { rowNumber: i + 1, message: l, cells: [l] }; }),
      errorColumn: null,
      mode: "lines"
    };
  }

  function maskSensitive(text) {
    return String(text).replace(EMAIL, "[email]").replace(SF_ID, "[id]");
  }

  function diagnoseDate(value) {
    var v = String(value || "").trim();
    var m = v.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
    if (m) {
      if (Number(m[1]) > 12) return "day-first dates (first number above 12)";
      if (Number(m[2]) > 12) return "month-first dates, rejected by a day-first setting";
      return "ambiguous day/month order";
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return "ISO-like; check time zone or time portion";
    if (/^\d{5}(\.\d+)?$/.test(v)) return "Excel serial number, not a date";
    if (v === "") return "blank";
    return "not a recognisable date";
  }

  // Classify one message into { code, field, detail, valueKey }.
  function classify(message) {
    var msg = String(message || "").trim();
    var m = msg.match(CODE_AT_START);
    var code = m ? m[1] : null;
    var out = { code: code || "UNRECOGNIZED", field: null, detail: null, value: null, raw: msg };

    if (!code) {
      var dateMatch = msg.match(/Failed to parse date:?\s*(.*)$/i);
      if (dateMatch) {
        out.code = "DATE_PARSE";
        out.value = dateMatch[1].trim();
        out.detail = diagnoseDate(out.value);
        return out;
      }
      if (/Error converting value to correct data type/i.test(msg)) {
        out.code = "NUMBER_PARSE";
        var num = msg.match(/For input string:?\s*"?([^"]*)"?/i);
        out.value = num ? num[1] : null;
        out.detail = out.value && /[,$€£%\s]/.test(out.value) ? "contains separators or symbols" : "not a plain number";
        return out;
      }
      out.detail = maskSensitive(msg).slice(0, 160);
      return out;
    }

    var rest = msg.slice(m[0].length);
    // Trailing ":Field1,Field2 --" segment that Salesforce appends.
    var tail = rest.match(/:\s*([A-Za-z0-9_,\s]*)\s*--\s*$/);
    var tailFields = tail && tail[1].trim() ? tail[1].trim() : null;
    var body = tail ? rest.slice(0, tail.index) : rest.replace(/\s*--\s*$/, "");

    switch (code) {
      case "REQUIRED_FIELD_MISSING": {
        var req = body.match(/\[(.*?)\]/);
        out.field = req ? req[1].replace(/\s+/g, "") : tailFields;
        break;
      }
      case "INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST": {
        var pk = body.match(/bad value for restricted picklist field:\s?(.*)$/i);
        out.value = pk ? pk[1] : null;
        out.field = tailFields || (body.split(":")[0] || "").trim() || null;
        break;
      }
      case "FIELD_CUSTOM_VALIDATION_EXCEPTION": {
        out.detail = maskSensitive(body.trim()) || "(rule message not shown)";
        out.field = tailFields;
        break;
      }
      case "DUPLICATE_VALUE": {
        var dv = body.match(/duplicate value found:\s*(\S+)/i);
        out.field = dv ? dv[1] : tailFields;
        break;
      }
      case "STRING_TOO_LONG": {
        var max = body.match(/max length=(\d+)/i);
        out.field = tailFields || (body.split(":")[0] || "").trim();
        out.detail = max ? "max length " + max[1] : null;
        break;
      }
      case "INVALID_FIELD_FOR_INSERT_UPDATE": {
        var f = body.match(/Unable to create\/update fields:\s*([^.]*)/i);
        out.field = f ? f[1].replace(/\s+/g, "") : tailFields;
        break;
      }
      case "INVALID_FIELD": {
        var nf = body.match(/No such column '([^']+)'/i);
        out.field = nf ? nf[1] : tailFields;
        break;
      }
      case "CANNOT_INSERT_UPDATE_ACTIVATE_ENTITY": {
        var trig = body.match(/^\s*([A-Za-z0-9_.]+):\s*execution of/);
        out.detail = trig ? "trigger/class " + trig[1] : maskSensitive(body.trim()).slice(0, 120);
        break;
      }
      case "CANNOT_EXECUTE_FLOW_TRIGGER": {
        var fl = body.match(/[“"]([^”"]+)[”"]\s*(process|flow)/i);
        out.detail = fl ? fl[2].toLowerCase() + " \"" + fl[1] + "\"" : maskSensitive(body.trim()).slice(0, 120);
        break;
      }
      default:
        out.field = tailFields;
    }
    return out;
  }

  function csvEscape(v) {
    v = v == null ? "" : String(v);
    return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }

  // Main entry: text -> report.
  function analyze(text) {
    var extracted = extractErrors(text);
    var groups = {};
    extracted.records.forEach(function (rec) {
      var c = classify(rec.message);
      var g = groups[c.code];
      if (!g) {
        var kb = CODES[c.code];
        g = groups[c.code] = {
          code: c.code,
          known: !!kb,
          title: kb ? kb.title : (c.code === "UNRECOGNIZED" ? "Message without a recognised error code" : "Error code not in this tool's list yet"),
          owner: kb ? kb.owner : "unknown",
          cause: kb ? kb.cause : "This tool does not have an explanation for this code yet. Search the code in Salesforce's API status code documentation and read the full message.",
          steps: kb ? kb.steps.slice() : ["Read the full message for a few rows.", "Check the field and value it mentions in your org."],
          count: 0,
          rows: [],
          breakdown: {}
        };
      }
      g.count++;
      g.rows.push(rec);
      var keyParts = [];
      if (c.field) keyParts.push(c.field);
      var valueInKey = c.code === "INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST";
      if (valueInKey && c.value != null && c.value !== "") keyParts.push("“" + c.value + "”");
      if (c.detail) keyParts.push(c.detail);
      var key = keyParts.join(" · ") || "(no further detail)";
      var b = g.breakdown[key];
      if (!b) b = g.breakdown[key] = { key: key, field: c.field, value: valueInKey ? c.value : null, detail: c.detail, count: 0, examples: [], example: maskSensitive(c.raw).slice(0, 240) };
      b.count++;
      if (!valueInKey && c.value && b.examples.length < 5 && b.examples.indexOf(c.value) < 0 && (c.code === "DATE_PARSE" || c.code === "NUMBER_PARSE")) b.examples.push(c.value);
    });

    var list = Object.keys(groups).map(function (k) {
      var g = groups[k];
      g.breakdown = Object.keys(g.breakdown).map(function (bk) { return g.breakdown[bk]; })
        .sort(function (a, b) { return b.count - a.count; });
      return g;
    }).sort(function (a, b) { return b.count - a.count; });

    var byOwner = {};
    list.forEach(function (g) { byOwner[g.owner] = (byOwner[g.owner] || 0) + g.count; });

    return {
      mode: extracted.mode,
      header: extracted.header,
      errorColumn: extracted.errorColumn,
      totalRows: extracted.records.length,
      groups: list,
      byOwner: byOwner,
      needsHelp: needsHelp(list)
    };
  }

  // Heuristic for showing the "this may be more than a file fix" note. Not a sales trigger in disguise:
  // it fires when the evidence points to settings, automation or load design rather than values.
  function needsHelp(groups) {
    var reasons = [];
    var nonFile = groups.filter(function (g) { return g.owner === "automation" || g.owner === "timing"; });
    if (nonFile.length) reasons.push("Some failures point to automation or the way the load ran, not the values in the file.");
    if (groups.filter(function (g) { return g.owner === "setup"; }).length >= 2) reasons.push("Several causes involve org settings, rules or permissions.");
    if (groups.length >= 4) reasons.push("The file has " + groups.length + " different causes.");
    return reasons;
  }

  // Plain-text summary safe to share: codes, counts, field names and rule messages; no record values unless asked.
  function summaryText(report, includeValues) {
    var lines = [];
    lines.push("Salesforce import error summary");
    lines.push(report.totalRows + " failed row(s), " + report.groups.length + " cause(s)");
    lines.push("");
    report.groups.forEach(function (g) {
      lines.push(g.count + " × " + g.code + " - " + g.title + " [" + OWNERS[g.owner].label + "]");
      g.breakdown.slice(0, 8).forEach(function (b) {
        var parts = [];
        if (b.field) parts.push("field " + b.field);
        if (includeValues && b.value) parts.push("value “" + maskSensitive(b.value) + "”");
        if (b.detail && (includeValues || g.code === "FIELD_CUSTOM_VALIDATION_EXCEPTION" || g.code === "STRING_TOO_LONG" || g.code === "CANNOT_EXECUTE_FLOW_TRIGGER" || g.code === "CANNOT_INSERT_UPDATE_ACTIVATE_ENTITY" || g.code === "DATE_PARSE" || g.code === "NUMBER_PARSE")) parts.push(b.detail);
        lines.push("   " + b.count + "  " + (parts.join(", ") || "(no detail)"));
      });
      if (g.breakdown.length > 8) lines.push("   ... " + (g.breakdown.length - 8) + " more variant(s)");
    });
    lines.push("");
    lines.push("Generated in the browser by the Salesforce Import Error Explainer (Logic Conduit). No file was uploaded.");
    return lines.join("\n");
  }

  // CSV of the failed rows for one group, preserving the original columns.
  function rowsToCSV(report, group) {
    var out = [];
    if (report.header && report.header.length) out.push(report.header.map(csvEscape).join(","));
    else out.push("message");
    group.rows.forEach(function (r) { out.push(r.cells.map(csvEscape).join(",")); });
    return out.join("\r\n") + "\r\n";
  }

  return {
    OWNERS: OWNERS,
    CODES: CODES,
    parseCSV: parseCSV,
    extractErrors: extractErrors,
    classify: classify,
    diagnoseDate: diagnoseDate,
    maskSensitive: maskSensitive,
    analyze: analyze,
    summaryText: summaryText,
    rowsToCSV: rowsToCSV
  };
});
