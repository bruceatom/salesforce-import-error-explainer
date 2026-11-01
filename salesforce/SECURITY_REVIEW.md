# Security review notes: Import Error Explainer (package)

Draft material for the AppExchange security review submission. Fill in the bracketed items once the package version and test org exist.

## What the package contains

| Component | API name | Purpose |
| --- | --- | --- |
| Lightning Web Component | `importErrorExplainer` | The user interface |
| Lightning Web Component (module, not exposed) | `importErrorCore` | Parsing and grouping logic, generated from `explainer.js` |
| Custom Tab | `Import_Error_Explainer` | Hosts the component |
| Lightning App | `Import_Error_Explainer` | App Launcher entry with the tab |
| Permission Set | `Import_Error_Explainer_User` | App and tab visibility only |

There is no Apex, no Visualforce, no Aura, no custom object or field, no static resource, no Named Credential, no Remote Site Setting, no CSP Trusted Site, no Connected App and no external JavaScript library.

## Data flow

1. The user picks a file with `lightning-input type="file"` or pastes text into `lightning-textarea`.
2. The component reads the file in the browser with `FileReader.readAsText`. `lightning-input type="file"` does not upload the file to Salesforce (unlike `lightning-file-upload`).
3. `importErrorCore` parses the text and groups rows in memory. Nothing is written to Salesforce records, Files, platform cache, browser storage or cookies.
4. Results are rendered with standard LWC data binding. No `innerHTML`, `lwc:dom="manual"` or dynamic script is used, so file content is always rendered as text.
5. Optional user actions:
   - **Download rows**: builds a CSV in memory and offers it as a `data:` URL on a temporary anchor element. The data stays on the user's machine.
   - **Create shareable summary**: shows a summary in a read-only text area and attempts `navigator.clipboard.writeText`. If the clipboard is blocked, the user copies by hand. The summary masks email addresses and Salesforce IDs, and leaves out record values unless the user ticks the box.
6. The component makes no server calls of any kind: no Apex, no UI API, no `fetch`/XHR.

## Data stored

None. Closing the tab discards everything.

## External links

Two static links to `https://logicconduit.com` (the publisher's site), opened with `target="_blank"` and `rel="noopener noreferrer"`. No data is appended to them; the only query parameters are fixed UTM tags identifying the package as the source. They are only navigated when the user clicks.

## Expected scanner observations and justification

| Possible finding | Where | Justification |
| --- | --- | --- |
| `document.createElement` / programmatic `click()` | `handleDownload` | Standard pattern to download a CSV generated in the browser; the anchor is never added to the DOM and holds only data the user supplied |
| `navigator.clipboard` use | `handleCopySummary` | Writes text the user asked to copy; wrapped in try/catch with a manual fallback |
| `target="_blank"` links | template footer and help panel | `rel="noopener noreferrer"` set; static publisher URLs only |
| Regular expressions on user input | `importErrorCore` | Run on text the user supplied, in their own browser session; each message is cut to 2,000 characters before matching and files are capped at 50 MB |

[Attach Salesforce Code Analyzer output for `force-app` here, with any additional findings and responses.]

## Reviewer test steps

1. Install package version [version id] in the test org; assign permission set `Import_Error_Explainer_User`.
2. App Launcher > Import Error Explainer.
3. Click **Try a sample** and confirm grouped results appear.
4. Upload `review/sample-error-file.csv` from this folder and confirm 137 failed rows grouped into 8 causes.
5. Paste a single message, for example `REQUIRED_FIELD_MISSING:Required fields are missing: [LastName]:LastName --`, and click **Explain pasted text**.
6. With the browser's developer tools open on the Network tab, repeat step 4 and confirm no request carries the file contents.

Test org: [username, provided through the submission form only].
