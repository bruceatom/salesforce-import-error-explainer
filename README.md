# Salesforce Import Error Explainer

A free, single-page tool that reads a Salesforce import error file and tells you, in plain language, **why rows failed and what to do next**.

Drop in the `error.csv` from Data Loader, the failed results of a Bulk API job, or paste error messages. The page:

- finds the error column (`ERROR`, `sf__Error`, `Error` and similar), or reads one message per line;
- groups failures by Salesforce status code (for example `INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST`, `FIELD_CUSTOM_VALIDATION_EXCEPTION`, `UNABLE_TO_LOCK_ROW`), then by field, picklist value or validation rule message;
- shows who usually fixes each cause (the file, an admin setting, automation, or the way the load ran) and the next steps;
- lets you download the failed rows for each cause, so you can fix and re-run only those;
- copies a shareable summary that leaves out names, emails and record values by default.

**Privacy:** everything runs in your browser. The file is never uploaded, stored or sent anywhere. There is no backend, no analytics and no third-party script in this repository.

Explanations describe the most likely causes based on the message text. Check them against your org before changing settings.

## Use it

Open `index.html` in a browser, or serve the folder with any static web server. No build step, no dependencies.

## Salesforce package

`salesforce/` holds the same tool as a Lightning app (one tab, Lightning Web Components only, no Apex, nothing stored) for distribution on AppExchange. See [salesforce/README.md](salesforce/README.md).

## Accuracy

The parser recognises error codes anywhere in a message (including text wrapped by integration tools, Apex exception text and JSON), plus common code-less wording. `examples/web-error-corpus.csv` holds 79 real messages collected from public pages, with sources; the test suite checks all of them. The parser was tuned on that set, so it is a regression check, not an accuracy estimate.

## Develop

```bash
npm test   # Node 18+; uses the built-in test runner, no packages to install
```

- `explainer.js` – parsing, classification and the error-code knowledge base (no DOM; tested in Node)
- `app.js` – page behaviour
- `examples/` – sample error files (generated, no real customer data)
- `test/` – unit tests, including the web corpus regression test
- `scripts/build-lwc.js` – regenerates the Salesforce package's parser from `explainer.js`
- `salesforce/` – Salesforce package source (SFDX project)

To add an error code, add an entry to `CODES` in `explainer.js` with a title, owner, cause and steps, and add a test case.

## About

Built by [Logic Conduit](https://logicconduit.com/?utm_source=github&utm_medium=readme&utm_campaign=import-error-explainer), a Toronto-based consultancy working with US and Canadian businesses on Salesforce integrations, automation and [data migrations](https://logicconduit.com/salesforce-data-migration-services.html?utm_source=github&utm_medium=readme&utm_campaign=import-error-explainer).

Not affiliated with or endorsed by Salesforce. Salesforce and Data Loader are trademarks of Salesforce, Inc.
