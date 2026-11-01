// GENERATED from explainer.js by scripts/build-lwc.js. Edit explainer.js, then rebuild.
/*
 * Salesforce Import Error Explainer - core logic.
 * Pure functions, no DOM access. Runs in the browser (global SFErrorExplainer)
 * and in Node (module.exports) for tests. Nothing here sends data anywhere.
 */
const SFErrorExplainer = (function () {
  "use strict";

  // Who usually resolves the problem.
  var OWNERS = {
    file: { label: "Fix the file", hint: "Usually fixable by correcting values in the CSV and re-running only the failed rows." },
    setup: { label: "Admin setting or permission", hint: "Usually needs someone with Salesforce admin access to check a setting, rule or permission." },
    automation: { label: "Automation or code", hint: "Usually needs an admin or developer to look at a Flow, trigger or other automation." },
    timing: { label: "Timing or load pattern", hint: "Usually caused by how the load ran (order, batch size, parallel jobs) rather than by the values." },
    loader: { label: "Loader settings or mapping", hint: "Fixed in the loading tool itself: field mapping, settings, or the computer running it." },
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
      cause: "A validation rule in your org rejected the record, or a trigger rejected it with addError(). The message text is the rule's or trigger's own error message, so the grouping below shows which rules blocked the most rows.",
      steps: [
        "Find the rule: Setup > Object Manager > the object > Validation Rules, and match the error message.",
        "Decide with the business owner whether the data should be corrected to meet the rule, or whether the rule should allow these records.",
        "Avoid simply switching rules off in production during a load without an agreed plan to switch them back on."
      ]
    },
    DUPLICATES_DETECTED: {
      title: "Stopped by a duplicate rule",
      owner: "setup",
      cause: "An active duplicate rule found an existing record that matches this row and is set to block it. Rules can run on edit as well as create, so updates by record Id can be blocked too.",
      steps: [
        "Decide whether these rows should update the existing records instead of creating new ones.",
        "If so, use an update or upsert keyed on the existing record Id or an external ID.",
        "Review the matching and duplicate rules with your admin before changing them."
      ]
    },
    DUPLICATE_VALUE: {
      title: "A unique field value is already used",
      owner: "file",
      cause: "A field marked unique (often an external ID) already holds this value on another record, or the value appears more than once in your file. During an upsert, a repeated external ID in the file is reported as \"Duplicate external id specified\".",
      steps: [
        "Check the file for repeated values in the field named below.",
        "If the rows are meant to update existing records, use upsert on that external ID instead of insert."
      ]
    },
    INVALID_EMAIL_ADDRESS: {
      title: "Email address format is not valid",
      owner: "file",
      cause: "The email field contains something Salesforce does not accept as an address: spaces, two @ signs, a missing domain, or several addresses in one cell. If the message also mentions SendEmail or an exception, an automation sending email failed instead, and the file may be fine.",
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
        "If the field really needs to hold longer values, ask your admin about increasing its length.",
        "Data Loader's \"Allow field truncation\" setting can cut values to fit instead; it is not available when a Bulk API option is selected."
      ]
    },
    DATE_PARSE: {
      title: "Date could not be read",
      owner: "file",
      cause: "The loader could not convert the value to a date. Common reasons: day-first dates (13/04/2026) when month-first is expected, text such as \"TBD\", or Excel changing the format when saving the CSV.",
      steps: [
        "Use YYYY-MM-DD for dates. For date/times, Data Loader recommends yyyy-MM-ddTHH:mm:ss.SSS+HHmm, for example 2026-04-13T09:00:00.000-0500.",
        "If the whole file is day-first (dd/MM/yyyy), turn on Data Loader's \"Use European date format\" setting so it matches the file.",
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
      cause: "The value does not match the field type, for example text in a number field or a checkbox value the loader does not recognise.",
      steps: [
        "Use plain numbers for number fields. For checkboxes, Data Loader accepts true/false, yes/no, y/n, on/off and 1/0.",
        "Check the values listed below against the field type in Object Manager."
      ]
    },
    MALFORMED_ID: {
      title: "A record ID is not valid for that field",
      owner: "file",
      cause: "An ID column or lookup holds something that is not a valid Salesforce ID, such as a name, a truncated ID or text copied from another system. Excel can also damage 15-character IDs.",
      steps: [
        "Use 18-character IDs exported from this org.",
        "Check the lookup column points at the right object.",
        "Consider upserting with an external ID relationship instead of hard-coded IDs."
      ]
    },
    INVALID_CROSS_REFERENCE_KEY: {
      title: "A related record cannot be found",
      owner: "file",
      cause: "The ID looks valid but the related record does not exist in this org, has been deleted, or the running user cannot see it. IDs copied from a sandbox or an old org are a common source, as is a Record Type ID that is not assigned to the running user.",
      steps: [
        "Re-export the related records from this org and rebuild the lookup values.",
        "Check the running user can see the related records."
      ]
    },
    INVALID_ID_FIELD: {
      title: "The record Id for an update is not valid",
      owner: "file",
      cause: "The Id is correctly formatted but not valid here: it is for the wrong object, or the record it identifies no longer exists.",
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
      cause: "The user running the load lacks edit access to this record through sharing, profile or permission set.",
      steps: [
        "Check the running user's object permissions and record access.",
        "Compare with a user who can edit the same record to see which access differs."
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
      cause: "The row assigns or references a user who is no longer active. Data Loader can also report this as \"Operation not valid for this user type\".",
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
        "Avoid repeated retries until the cause is understood.",
        "If the message mentions Apex CPU time or query limits, every automation on the object shares that limit; the trigger named is not always the main cause, and smaller batches often help."
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
    },
    DUPLICATE_EXTERNAL_ID: {
      title: "More than one record has this external ID",
      owner: "file",
      cause: "An upsert matched several existing records in the org that share the same external ID, so Salesforce cannot tell which record to update.",
      steps: [
        "Find the records in the org that share the external ID value, with a report or query.",
        "Merge or correct the duplicates, ideally making the field unique, then re-run the failed rows."
      ]
    },
    FIELD_INTEGRITY_EXCEPTION: {
      title: "Value breaks a field or relationship rule",
      owner: "file",
      cause: "The value is not allowed for this field or relationship, for example a dependent picklist value that does not fit its controlling value, or a lookup to the wrong kind of record.",
      steps: [
        "Read the field named in the message and check its type, dependencies and lookup target.",
        "Correct the values, then re-run only the failed rows."
      ]
    },
    DELETE_FAILED: {
      title: "Record could not be deleted",
      owner: "setup",
      cause: "Salesforce blocked the delete because other records or features depend on it, for example portal users, related cases or opportunities.",
      steps: [
        "Read which related records the message names.",
        "Decide with the business owner whether to remove or reassign those first, or keep the record."
      ]
    },
    GROUP_MEMBERSHIP_OPERATION_IN_PROGRESS: {
      title: "Sharing recalculation was still running",
      owner: "timing",
      cause: "Salesforce was recalculating sharing after role or group changes, which blocks some record updates until it finishes.",
      steps: [
        "Wait for the recalculation to finish, then re-run only the failed rows.",
        "Avoid loading records straight after changing roles, groups or sharing rules."
      ]
    },
    LOADER_CSV_FORMAT: {
      title: "The file's columns don't line up",
      owner: "file",
      cause: "A row has more values than the header has columns, so the loader rejected the file. Common causes: a value with no header above it, an unquoted comma, or a tab character inside a comma-delimited cell, which Data Loader 34.0 and later reads as an extra column.",
      steps: [
        "Open the file in a plain text editor and look at the row number in the message.",
        "Remove tab characters and stray delimiters, and put quotes around values that contain commas.",
        "Make sure every column that holds data has a header."
      ]
    },
    LOADER_MAPPING: {
      title: "Columns aren't mapped the way the loader needs",
      owner: "loader",
      cause: "The loader stopped before sending rows. With Data Loader's Bulk API option on, this happens when no fields are mapped (\"Failed to parse CSV header\"). An insert also needs required columns such as Name to be mapped.",
      steps: [
        "Go back to the mapping step and map at least the required fields.",
        "Save the mapping as an .sdl file so repeat loads use the same mapping."
      ]
    },
    LOADER_SETTING: {
      title: "A Data Loader setting doesn't match the file",
      owner: "loader",
      cause: "Data Loader stopped with an internal error before loading. In the case Salesforce documents, the setting to perform updates with an external ID is on, but no external ID column is mapped in the file.",
      steps: [
        "Open Data Loader Settings and check the external ID and Bulk API options.",
        "Map the external ID column, or turn the setting off, and run again."
      ]
    },
    LOADER_MEMORY: {
      title: "The computer running Data Loader ran out of memory",
      owner: "loader",
      cause: "Java ran out of memory on the machine running the load (\"Java heap space\"). Salesforce records are not the problem.",
      steps: [
        "Split the file into smaller parts and load them one at a time.",
        "Close other programs, or give Data Loader more memory as described in Salesforce's \"Java Heap Space\" help article."
      ]
    },
    LOADER_CONNECTION: {
      title: "Data Loader couldn't reach Salesforce",
      owner: "loader",
      cause: "The login request never reached Salesforce, often because of a proxy or VPN, or the wrong server host (login.salesforce.com for production, test.salesforce.com for sandboxes).",
      steps: [
        "Check the server host in Data Loader Settings.",
        "On a proxy or VPN, enter the proxy details in Data Loader Settings and check with your network administrator.",
        "Look at the user's Login History to see whether the attempt arrived."
      ]
    }
  };

  var OWNER_SUFFIX = {
    automation: " (raised by a trigger, Flow or package)",
    timing: " (a record lock is involved)",
    setup: " (an org setting or access issue)",
    file: " (a field-mapping issue)",
    loader: " (a loader setting or mapping issue)"
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
    var v = String(value || "");
    if (CODE_AT_START.test(v) || /Error converting value|Failed to parse date/i.test(v)) return true;
    // Defined later in this file; function declarations are hoisted.
    return v.length > 12 && (findCodes(normalise(v)).length > 0 || PHRASES.some(function (x) { return x[0].test(v); }));
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
    if (/[+-]\d{2}:\d{2}$/.test(v)) return "time-zone offset with a colon; Data Loader expects +0100 or GMT+01:00";
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return "ISO-like; check time zone or time portion";
    if (/^\d{5}(\.\d+)?$/.test(v)) return "Excel serial number, not a date";
    if (v === "") return "blank";
    return "not a recognisable date";
  }

  // Codes Salesforce returns that this tool recognises anywhere in a message, longest first.
  var EXTRA_CODES = ["DUPLICATE_EXTERNAL_ID", "FIELD_INTEGRITY_EXCEPTION", "LIMIT_EXCEEDED", "INVALID_OPERATION"];
  function knownCodes() {
    return Object.keys(CODES).filter(function (c) { return !/_PARSE$/.test(c); }).concat(EXTRA_CODES)
      .sort(function (a, b) { return b.length - a.length; });
  }
  var CODE_ANYWHERE = new RegExp("(?:^|[^A-Z0-9_])(" + knownCodes().join("|") + ")(?![A-Z0-9_])", "g");
  var JSON_CODE = /["']?(?:errorCode|statusCode)["']?\s*[:=]\s*["']([A-Z][A-Z0-9_]{3,})["']/;
  var FLOW_WRAPPER = /We can.t save this record because|flow tried to (?:update|create|delete) records|failed to trigger a flow/i;
  var AUTOMATION_EVIDENCE = /Data changed by trigger|caused by:|System\.\w*Exception|flow tried to|process failed|Rollup Helper/i;
  // Wording-only messages (no code in the text), in priority order.
  var PHRASES = [
    [/Failed to send request|Unable to connect to Salesforce/i, "LOADER_CONNECTION"],
    [/OutOfMemoryError|Java heap space/i, "LOADER_MEMORY"],
    [/Row is larger than header|Invalid CSV file format|number of data columns exceeds/i, "LOADER_CSV_FORMAT"],
    [/Failed to parse CSV header|column must be mapped/i, "LOADER_MAPPING"],
    [/com\.salesforce\.dataloader|Cannot invoke 'Object\.toString\(\)'/i, "LOADER_SETTING"],
    [/Group membership operation already in progress/i, "GROUP_MEMBERSHIP_OPERATION_IN_PROGRESS"],
    [/Operation not valid for this user type/i, "INACTIVE_OWNER_OR_USER"],
    [/value not of required type/i, "INVALID_TYPE_ON_FIELD_IN_RECORD"],
    [/Failed to parse date|not a valid DATE|deserialize instance of date/i, "DATE_PARSE"],
    [/invalid number|For input string|Error converting value to correct data type/i, "NUMBER_PARSE"],
    [/bad value for restricted picklist/i, "INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST"],
    [/id value of incorrect (?:record )?type|Id in upsert is not valid|\bbad id\b/i, "MALFORMED_ID"],
    [/isn.t valid for the user|invalid cross reference id/i, "INVALID_CROSS_REFERENCE_KEY"],
    [/use one of these records/i, "DUPLICATES_DETECTED"],
    [/duplicate value found|Duplicate external id specified/i, "DUPLICATE_VALUE"],
    [/unable to create\/update fields|bad field names on insert\/update call/i, "INVALID_FIELD_FOR_INSERT_UPDATE"],
    [/No such column|Field name not found/i, "INVALID_FIELD"],
    [/data value too large/i, "STRING_TOO_LONG"],
    [/invalid email address|Email address is invalid/i, "INVALID_EMAIL_ADDRESS"],
    [/unable to obtain exclusive access|TooManyLockFailure/i, "UNABLE_TO_LOCK_ROW"],
    [/process failed|failed to trigger a flow|flow tried to/i, "CANNOT_EXECUTE_FLOW_TRIGGER"],
    [/execution of (?:Before|After)\w*|System\.LimitException|Apex CPU time limit|Too many (?:SOQL queries|query rows|DML)|batch save in the presence of Apex triggers/i, "CANNOT_INSERT_UPDATE_ACTIVATE_ENTITY"],
    [/insufficient access rights on cross-reference/i, "INSUFFICIENT_ACCESS_ON_CROSS_REFERENCE_ENTITY"],
    [/insufficient access rights (?:on|to) object/i, "INSUFFICIENT_ACCESS_OR_READONLY"],
    [/converted lead/i, "CANNOT_UPDATE_CONVERTED_LEAD"],
    [/entity is deleted/i, "ENTITY_IS_DELETED"],
    [/does not match filter criteria|Does Not Exist or Meet Criteria/i, "FIELD_FILTER_VALIDATION_EXCEPTION"],
    [/Required fields are missing/i, "REQUIRED_FIELD_MISSING"]
  ];
  var NOT_CODES = /^(ERROR|ERRORS|SOURCE|FAILED|WARNING|STATUS|MESSAGE|NULL|TRUE|FALSE)$/;

  var MAX_MESSAGE = 2000;

  function normalise(message) {
    return String(message || "")
      .replace(/\\n/g, " ")              // literal "\n" copied from integration logs
      .replace(/^[\s{\[(]+|[\s}\])]+$/g, "")
      .trim();
  }

  function findCodes(msg) {
    var found = [], m;
    CODE_ANYWHERE.lastIndex = 0;
    while ((m = CODE_ANYWHERE.exec(msg))) {
      found.push({ code: m[1], index: m.index + m[0].indexOf(m[1]) });
    }
    return found;
  }

  // Classify one message into { code, inner, owner, field, detail, value, raw }.
  function classify(message) {
    var raw = String(message || "").trim();
    // Cap the text the patterns see so a pathological cell cannot make matching slow.
    var msg = normalise(raw.length > MAX_MESSAGE ? raw.slice(0, MAX_MESSAGE) : raw);
    var out = { code: "UNRECOGNIZED", inner: null, owner: null, field: null, detail: null, value: null, raw: raw };
    var codes = findCodes(msg);
    var at = -1;

    if (FLOW_WRAPPER.test(msg) && !(codes.length && codes[0].code !== "CANNOT_EXECUTE_FLOW_TRIGGER" && codes[0].index < msg.search(FLOW_WRAPPER))) {
      out.code = "CANNOT_EXECUTE_FLOW_TRIGGER";
      var innerFlow = codes.filter(function (c) { return c.code !== out.code; })[0];
      out.inner = innerFlow ? innerFlow.code : null;
    } else if (codes.length) {
      out.code = codes[0].code;
      at = codes[0].index + codes[0].code.length;
      var innerC = codes.filter(function (c) { return c.code !== out.code; })[0];
      out.inner = innerC ? innerC.code : null;
    } else {
      var p = PHRASES.filter(function (x) { return x[0].test(msg); })[0];
      var jc = msg.match(JSON_CODE);
      var lead = msg.match(/^\s*([A-Z][A-Z0-9]*_[A-Z0-9_]*[A-Z0-9])\s*:/);
      if (p) out.code = p[1];
      else if (jc) out.code = jc[1];
      else if (lead && !NOT_CODES.test(lead[1])) { out.code = lead[1]; at = msg.indexOf(lead[1]) + lead[1].length; }
    }

    // Text after the code, minus the separator Salesforce or the tool used.
    var rest = at >= 0 ? msg.slice(at).replace(/^['"]?\s*[:,]\s*/, "") : msg;
    var tail = rest.match(/:\s*([A-Za-z0-9_,\s]*)\s*--\s*$/) || rest.match(/:\s*\[([A-Za-z0-9_,\s]*)\]\s*$/);
    var tailFields = tail && tail[1].trim() ? tail[1].replace(/\s+/g, "") : null;
    var body = tail ? rest.slice(0, tail.index) : rest.replace(/\s*--\s*$/, "");

    switch (out.code) {
      case "REQUIRED_FIELD_MISSING": {
        var req = body.match(/\[(.*?)\]/);
        out.field = req ? req[1].replace(/\s+/g, "") : tailFields;
        break;
      }
      case "INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST": {
        var pk = body.match(/bad value for restricted picklist field:\s?([^:'"\]}]*)/i);
        out.value = pk ? pk[1] : null;
        var fq = msg.match(/'fields':\s*\['([^']+)'/);
        out.field = tailFields || (fq ? fq[1] : null) || (/^[^:]+:\s*bad value/i.test(body) ? body.split(":")[0].trim() : null);
        if (/Data changed by trigger/i.test(msg)) out.detail = "value set by a trigger, not the file";
        break;
      }
      case "FIELD_CUSTOM_VALIDATION_EXCEPTION": {
        out.detail = maskSensitive(body.replace(/:\s*$/, "").trim()).slice(0, 160) || "(rule message not shown)";
        out.field = tailFields;
        break;
      }
      case "DUPLICATE_VALUE": {
        var dv = body.match(/duplicate value found:\s*(\S+)/i);
        out.field = dv ? dv[1] : tailFields;
        break;
      }
      case "STRING_TOO_LONG": {
        var max = msg.match(/max length=(\d+)/i);
        var lbl = body.match(/^\s*([^:]+):\s*data value too large/i) || msg.match(/([A-Za-z_][\w ]*):\s*data value too large/i);
        out.field = tailFields || (lbl ? lbl[1].trim() : null);
        out.detail = max ? "max length " + max[1] : null;
        break;
      }
      case "INVALID_FIELD_FOR_INSERT_UPDATE": {
        var f = msg.match(/Unable to create\/update fields:\s*([^.]*)/i);
        var bf = msg.match(/bad field names on insert\/update call:\s*([^"\]}]*)/i);
        out.field = f ? f[1].replace(/\s+/g, "") : (bf ? bf[1].replace(/,\s*Fields:.*$/i, "").trim() : tailFields);
        if (bf) out.detail = /Account:|__pc|FirstName|LastName/.test(msg)
          ? "field not valid for this record type (Person Accounts use FirstName/LastName, not Name)"
          : "field not available on this object for this record";
        break;
      }
      case "INVALID_FIELD": {
        var nf = msg.match(/No such column '([^']+)'/i);
        out.field = nf ? nf[1] : tailFields;
        if (/InvalidBatch|Field name not found/i.test(msg)) out.detail = "whole batch or job rejected";
        break;
      }
      case "CANNOT_INSERT_UPDATE_ACTIVATE_ENTITY": {
        var trig = msg.match(/([A-Za-z0-9_.]+):\s*(?:execution of|System\.)/);
        var lim = msg.match(/Apex CPU time limit|Too many (?:query rows|SOQL queries)[^.]*|NullPointerException|QueryException|DmlException/i);
        out.detail = [trig ? "trigger/class " + trig[1] : null, lim ? lim[0] : null].filter(Boolean).join(" · ") || maskSensitive(body.trim()).slice(0, 120);
        break;
      }
      case "CANNOT_EXECUTE_FLOW_TRIGGER": {
        var fl = msg.match(/[“"]([^”"]+)[”"]\s*(process|flow)/i);
        out.detail = fl ? fl[2].toLowerCase() + " \"" + fl[1] + "\"" : "Flow or process (name not in message)";
        break;
      }
      case "DATE_PARSE": {
        var dm = msg.match(/Failed to parse date:?\s*(.*)$/i);
        out.value = dm ? dm[1].trim() : null;
        out.detail = out.value ? diagnoseDate(out.value) : "date format not accepted";
        break;
      }
      case "NUMBER_PARSE": {
        var num = msg.match(/For input string:?\s*"?([^"]*)"?/i) || msg.match(/invalid number:\s*(.*)$/i);
        out.value = num ? num[1].trim() : null;
        out.detail = out.value && /[,$€£%\s]/.test(out.value) ? "contains separators or symbols" : "not a plain number";
        break;
      }
      case "UNABLE_TO_LOCK_ROW": {
        if (/TooManyLockFailure/i.test(msg)) out.detail = "whole batch retried and gave up";
        break;
      }
      case "UNRECOGNIZED":
        out.detail = maskSensitive(msg).slice(0, 160);
        break;
      default:
        out.field = tailFields;
    }
    if (out.inner) out.detail = [out.detail, "inner cause " + out.inner].filter(Boolean).join(" · ");
    out.owner = ownerFor(out, msg);
    return out;
  }

  // Who usually fixes it, adjusted by evidence in the message itself.
  function ownerFor(c, msg) {
    if (c.code === "UNABLE_TO_LOCK_ROW" || (c.inner === "UNABLE_TO_LOCK_ROW" && c.code !== "CANNOT_EXECUTE_FLOW_TRIGGER")) return "timing";
    if (c.code === "CANNOT_EXECUTE_FLOW_TRIGGER" || c.code === "CANNOT_INSERT_UPDATE_ACTIVATE_ENTITY") return "automation";
    if (AUTOMATION_EVIDENCE.test(msg) && !/^System\.DmlException: \w+ failed\. First exception on row \d+[^;]*; first error: FIELD_FILTER/.test(msg)) return "automation";
    if (c.code === "INVALID_CROSS_REFERENCE_KEY" && /RecordTypeId|isn.t valid for the user/i.test(msg)) return "setup";
    if (c.code === "INVALID_FIELD_FOR_INSERT_UPDATE" && /bad field names/i.test(msg)) return "file";
    var kb = CODES[c.code];
    return kb ? kb.owner : "unknown";
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
      var gkey = c.code + "|" + c.owner;
      var g = groups[gkey];
      if (!g) {
        var kb = CODES[c.code];
        var baseTitle = kb ? kb.title : (c.code === "UNRECOGNIZED" ? "Message without a recognised error code" : "Error code not in this tool's list yet");
        var shifted = kb && c.owner !== kb.owner ? OWNER_SUFFIX[c.owner] : "";
        g = groups[gkey] = {
          code: c.code,
          known: !!kb,
          title: baseTitle + (shifted || ""),
          owner: c.owner,
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
})();

export default SFErrorExplainer;
