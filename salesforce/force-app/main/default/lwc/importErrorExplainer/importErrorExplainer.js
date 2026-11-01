import { LightningElement } from "lwc";
import Explainer from "c/importErrorCore";

// Links back to the publisher. Tagged so visits from the package can be told apart from the website tool.
const HELP_URL =
    "https://logicconduit.com/salesforce-data-migration-services.html?utm_source=appexchange&utm_medium=import-error-explainer&utm_campaign=help-panel";
const ABOUT_URL = "https://logicconduit.com/?utm_source=appexchange&utm_medium=import-error-explainer&utm_campaign=footer";
const MAX_BYTES = 50 * 1024 * 1024;

const SAMPLE = [
    "FirstName,LastName,Email,Industry__c,ERROR",
    'Jordan,Lee,jordan.lee@example.com,Health Care,"INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST:Industry: bad value for restricted picklist field: Health Care:Industry__c --"',
    'Priya,Patel,priya.patel@example.com,Health Care,"INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST:Industry: bad value for restricted picklist field: Health Care:Industry__c --"',
    'Sam,Nguyen,sam.nguyen@example.com,Retail,"FIELD_CUSTOM_VALIDATION_EXCEPTION:Phone is required for Customer contacts:Phone --"',
    'Alex,,alex@example.com,Retail,"REQUIRED_FIELD_MISSING:Required fields are missing: [LastName]:LastName --"',
    'Morgan,Smith,morgan@@example.com,Retail,"INVALID_EMAIL_ADDRESS:Email: invalid email address: morgan@@example.com:Email --"',
    'Taylor,Brown,taylor.brown@example.com,Retail,"Error converting value to correct data type: Failed to parse date: 21/04/2026"',
    'Casey,Wilson,casey.wilson@example.com,Retail,"UNABLE_TO_LOCK_ROW:unable to obtain exclusive access to this record or 1 records: 0015g00000AbCdEAAZ:--"',
    'Riley,Martin,riley.martin@example.com,Retail,"CANNOT_EXECUTE_FLOW_TRIGGER:We can\'t save this record because the “Contact Welcome Email” process failed. Give your Salesforce admin these details. This error occurred when the flow tried to update records: REQUIRED_FIELD_MISSING: Required fields are missing: [Status__c]:--"'
].join("\n");

export default class ImportErrorExplainer extends LightningElement {
    report;
    status = "";
    statusIsError = false;
    pasteText = "";
    includeValues = false;
    summaryText = "";
    helpUrl = HELP_URL;
    aboutUrl = ABOUT_URL;

    get statusClass() {
        return this.statusIsError ? "status slds-text-color_error" : "status slds-text-color_weak";
    }

    get hasReport() {
        return !!this.report;
    }

    get heading() {
        if (!this.report) return "";
        const n = this.report.groups.length;
        return `${this.report.totalRows} failed rows, ${n} cause${n === 1 ? "" : "s"}`;
    }

    get lead() {
        if (!this.report) return "";
        const fileFix = this.report.byOwner.file || 0;
        return fileFix === this.report.totalRows
            ? "Every failure looks fixable in the file. Correct the values below and re-run only the failed rows."
            : `${fileFix} of ${this.report.totalRows} rows look fixable in the file. The rest need a setting, permission, automation or load change.`;
    }

    get showHelp() {
        return !!(this.report && this.report.needsHelp.length);
    }

    get helpReasons() {
        return this.report ? this.report.needsHelp.map((text, i) => ({ key: `r${i}`, text })) : [];
    }

    get hasSummary() {
        return this.summaryText !== "";
    }

    get groups() {
        if (!this.report) return [];
        return this.report.groups.map((g, i) => ({
            key: `g${i}`,
            index: i,
            title: g.title,
            code: g.code,
            count: g.count,
            countLabel: `${g.count} row${g.count === 1 ? "" : "s"}`,
            ownerLabel: Explainer.OWNERS[g.owner].label,
            ownerHint: Explainer.OWNERS[g.owner].hint,
            badgeClass: `owner owner-${g.owner}`,
            cause: g.cause,
            steps: g.steps.map((s, j) => ({ key: `s${j}`, text: s })),
            breakdown: g.breakdown.slice(0, 25).map((b, j) => ({
                key: `b${j}`,
                count: b.count,
                text: b.examples && b.examples.length ? `${b.key} — e.g. ${b.examples.join(", ")}` : b.key
            })),
            moreVariants: g.breakdown.length > 25 ? `${g.breakdown.length - 25} more variants not shown.` : "",
            example: g.breakdown[0] ? g.breakdown[0].example : "",
            downloadLabel: `Download these ${g.count} rows (CSV)`
        }));
    }

    handleFileChange(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        if (file.size > MAX_BYTES) {
            this.setStatus("That file is over 50 MB. Split it and try a part.", true);
            return;
        }
        const reader = new FileReader();
        reader.onload = () => this.run(String(reader.result), file.name);
        reader.onerror = () => this.setStatus("The file could not be read.", true);
        reader.readAsText(file);
    }

    handlePasteChange(event) {
        this.pasteText = event.target.value;
    }

    handleExplainPaste() {
        this.run(this.pasteText, "pasted text");
    }

    handleSample() {
        this.run(SAMPLE, "the sample file");
    }

    handleIncludeValues(event) {
        this.includeValues = event.target.checked;
        if (this.hasSummary) this.summaryText = Explainer.summaryText(this.report, this.includeValues);
    }

    handleCopySummary() {
        this.summaryText = Explainer.summaryText(this.report, this.includeValues);
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(this.summaryText).catch(() => {});
            }
        } catch (e) {
            // Clipboard can be blocked inside Salesforce; the summary box below stays available to copy by hand.
        }
    }

    handleDownload(event) {
        const index = Number(event.currentTarget.dataset.index);
        const group = this.report.groups[index];
        const csv = Explainer.rowsToCSV(this.report, group);
        const link = document.createElement("a");
        link.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
        link.download = `failed-${group.code.toLowerCase()}.csv`;
        link.click();
    }

    run(text, sourceName) {
        if (!text || !text.trim()) {
            this.setStatus("Nothing to read yet. Choose a file or paste error lines.", true);
            return;
        }
        let report;
        try {
            report = Explainer.analyze(text);
        } catch (e) {
            this.setStatus("Could not read that input: " + e.message, true);
            return;
        }
        if (!report.totalRows) {
            this.report = undefined;
            this.setStatus("No error messages were found. Is this the error file rather than the success file?", true);
            return;
        }
        this.report = report;
        this.summaryText = "";
        const how = report.mode === "csv" ? `using the “${report.errorColumn}” column` : "one message per line";
        this.setStatus(`Read ${report.totalRows} failed row(s) from ${sourceName}, ${how}.`, false);
    }

    setStatus(message, isError) {
        this.status = message;
        this.statusIsError = isError;
    }
}
