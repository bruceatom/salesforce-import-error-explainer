# Import Error Explainer for Salesforce (package source)

A Lightning app with one tab. Users add an import error file (Data Loader, dataloader.io, Bulk API failed results) or paste error messages, and see failures grouped by cause with the next step for each.

**Security posture:** Lightning Web Components only. No Apex, no custom objects, no stored data, no callouts, no Named Credentials or remote sites. The file is read with the browser's FileReader through `lightning-input type="file"`, which does not upload to Salesforce. The permission set grants app and tab visibility only.

The parser in `lwc/importErrorCore` is generated from `../explainer.js` (shared with the web version). Edit `explainer.js`, then run `node scripts/build-lwc.js` from the repo root; `npm test` fails if the two drift.

## Try it in a Developer Edition or scratch org

```bash
cd salesforce
sf org login web --alias lab                 # a Developer Edition org you own
sf project deploy start --target-org lab     # deploys the app, tab, component and permission set
sf org assign permset --name Import_Error_Explainer_User --target-org lab
sf org open --target-org lab                 # App Launcher > Import Error Explainer
```

## Package for AppExchange (managed 2GP)

Needs a Dev Hub with a registered, linked namespace (set `"namespace"` in `sfdx-project.json` first).

```bash
sf package create --name "Import Error Explainer" --package-type Managed --path force-app --target-dev-hub <devhub>
sf package version create --package "Import Error Explainer" --installation-key-bypass --code-coverage --wait 30 --target-dev-hub <devhub>
sf package version promote --package "Import Error Explainer@0.1.0-1" --target-dev-hub <devhub>
```

Run Salesforce Code Analyzer on `force-app` and keep the report for the security review submission.
