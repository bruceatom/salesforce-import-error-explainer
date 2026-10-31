/* UI for the Salesforce Import Error Explainer. All processing happens in this page; nothing is uploaded. */
(function () {
  "use strict";
  var E = window.SFErrorExplainer;
  var LC = "https://logicconduit.com";
  var UTM = "?utm_source=import-error-explainer&utm_medium=tool";

  var $ = function (id) { return document.getElementById(id); };
  var fileInput = $("file"), drop = $("drop"), paste = $("paste"), status = $("status"), results = $("results");
  var lastReport = null;

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "text") n.textContent = attrs[k];
      else if (k === "class") n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }

  function setStatus(msg, isError) {
    status.textContent = msg;
    status.className = isError ? "status error" : "status";
  }

  function readFile(file) {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { setStatus("That file is over 50 MB. Split it and try a part.", true); return; }
    var reader = new FileReader();
    reader.onload = function () { run(String(reader.result), file.name); };
    reader.onerror = function () { setStatus("The file could not be read.", true); };
    reader.readAsText(file);
  }

  function run(text, sourceName) {
    if (!text || !text.trim()) { setStatus("Nothing to read yet. Choose a file or paste error lines.", true); return; }
    var report;
    try { report = E.analyze(text); } catch (e) { setStatus("Could not read that input: " + e.message, true); return; }
    if (!report.totalRows) { setStatus("No error messages were found. Is this the error file rather than the success file?", true); return; }
    lastReport = report;
    var how = report.mode === "csv" ? "using the “" + report.errorColumn + "” column" : "one message per line";
    setStatus("Read " + report.totalRows + " failed row(s) from " + (sourceName || "pasted text") + ", " + how + ".");
    render(report);
  }

  function download(name, content) {
    var blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    var a = el("a", { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function ownerBadge(owner) {
    return el("span", { class: "badge badge-" + owner, text: E.OWNERS[owner].label });
  }

  function render(report) {
    results.innerHTML = "";
    var fileFix = report.byOwner.file || 0;

    var heading = el("h2", { id: "results-heading", tabindex: "-1", text: report.totalRows + " failed rows, " + report.groups.length + " cause" + (report.groups.length === 1 ? "" : "s") });
    var lead = el("p", { class: "lead", text: fileFix === report.totalRows
      ? "Every failure looks fixable in the file. Correct the values below and re-run only the failed rows."
      : fileFix + " of " + report.totalRows + " rows look fixable in the file. The rest need a setting, permission, automation or load change." });

    // Overview table.
    var tbody = el("tbody");
    report.groups.forEach(function (g, i) {
      var fields = g.breakdown.map(function (b) { return b.field; }).filter(Boolean)
        .filter(function (v, j, a) { return a.indexOf(v) === j; }).slice(0, 3).join(", ");
      tbody.appendChild(el("tr", null, [
        el("td", null, [el("a", { href: "#group-" + i, text: g.title })]),
        el("td", { class: "num", text: String(g.count) }),
        el("td", null, [ownerBadge(g.owner)]),
        el("td", null, [el("code", { text: fields || "—" })])
      ]));
    });
    var table = el("table", { class: "overview" }, [
      el("caption", { class: "sr-only", text: "Failures grouped by cause" }),
      el("thead", null, [el("tr", null, [el("th", { scope: "col", text: "Cause" }), el("th", { scope: "col", class: "num", text: "Rows" }), el("th", { scope: "col", text: "Usually fixed by" }), el("th", { scope: "col", text: "Fields" })])]),
      tbody
    ]);

    // Actions.
    var include = el("input", { type: "checkbox", id: "include-values" });
    var copyBtn = el("button", { type: "button", class: "secondary", text: "Copy summary" });
    copyBtn.addEventListener("click", function () {
      var txt = E.summaryText(report, include.checked);
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(
        function () { copyBtn.textContent = "Copied"; setTimeout(function () { copyBtn.textContent = "Copy summary"; }, 1500); },
        function () { $("summary-fallback").hidden = false; $("summary-fallback").value = txt; $("summary-fallback").select(); }
      );
    });
    var actions = el("div", { class: "actions" }, [
      copyBtn,
      el("label", { for: "include-values", class: "inline" }, [include, " Include example values (picklist, date and number values; emails and IDs stay masked)"]),
    ]);
    var fallback = el("textarea", { id: "summary-fallback", rows: "8", hidden: "", "aria-label": "Summary text to copy" });
    var privacyNote = el("p", { class: "small", text: "The summary lists error codes, counts, field names and your validation rule messages. It leaves out names, emails and record values unless you tick the box above." });

    results.appendChild(heading);
    results.appendChild(lead);
    results.appendChild(table);
    results.appendChild(actions);
    results.appendChild(fallback);
    results.appendChild(privacyNote);

    if (report.needsHelp.length) results.appendChild(helpPanel(report));

    report.groups.forEach(function (g, i) { results.appendChild(groupCard(report, g, i)); });

    results.hidden = false;
    heading.focus();
  }

  function groupCard(report, g, i) {
    var rows = el("tbody");
    g.breakdown.slice(0, 25).forEach(function (b) {
      var detail = b.key;
      if (b.examples && b.examples.length) detail += " — e.g. " + b.examples.join(", ");
      rows.appendChild(el("tr", null, [el("td", { class: "num", text: String(b.count) }), el("td", { text: detail })]));
    });
    var more = g.breakdown.length > 25 ? el("p", { class: "small", text: (g.breakdown.length - 25) + " more variants not shown." }) : null;
    var dl = el("button", { type: "button", class: "secondary", text: "Download these " + g.count + " rows (CSV)" });
    dl.addEventListener("click", function () { download("failed-" + g.code.toLowerCase() + ".csv", E.rowsToCSV(report, g)); });

    var stepsList = el("ol", null, g.steps.map(function (s) { return el("li", { text: s }); }));
    return el("section", { class: "card", id: "group-" + i, "aria-labelledby": "group-title-" + i }, [
      el("div", { class: "card-head" }, [
        el("h3", { id: "group-title-" + i, text: g.title }),
        el("span", { class: "count", text: g.count + " row" + (g.count === 1 ? "" : "s") })
      ]),
      el("p", { class: "meta" }, [el("code", { text: g.code }), " ", ownerBadge(g.owner)]),
      el("p", { text: g.cause }),
      el("h4", { text: "What to do" }),
      stepsList,
      el("h4", { text: "Breakdown" }),
      el("table", { class: "breakdown" }, [
        el("thead", null, [el("tr", null, [el("th", { scope: "col", class: "num", text: "Rows" }), el("th", { scope: "col", text: "Field, value or message" })])]),
        rows
      ]),
      more,
      el("details", null, [el("summary", { text: "Example message" }), el("pre", { text: g.breakdown[0] ? g.breakdown[0].example : "" })]),
      el("div", { class: "actions" }, [dl])
    ]);
  }

  function helpPanel(report) {
    var link = el("a", { href: LC + "/salesforce-data-migration-services.html" + UTM + "&utm_campaign=help-panel", text: "Talk to Logic Conduit about a scoped migration review" });
    return el("aside", { class: "help", "aria-label": "When this may need more than a file fix" }, [
      el("h3", { text: "This may be more than a file fix" }),
      el("ul", null, report.needsHelp.map(function (r) { return el("li", { text: r }); })),
      el("p", null, [
        "If you are mid-migration or this keeps happening on repeat loads, ",
        link,
        ". Send the copied summary, not the data."
      ])
    ]);
  }

  // Events.
  fileInput.addEventListener("change", function () { readFile(fileInput.files[0]); });
  ["dragenter", "dragover"].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add("over"); }); });
  ["dragleave", "drop"].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove("over"); }); });
  drop.addEventListener("drop", function (e) { if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]); });
  $("explain-paste").addEventListener("click", function () { run(paste.value, "pasted text"); });
  $("sample").addEventListener("click", function () { run(window.SF_SAMPLE_ERROR_CSV, "the sample file"); });
})();
