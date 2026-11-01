# Import error lab

A throwaway Developer Edition org set up to fail on purpose, so the explainer can be scored on real, current Salesforce error files instead of messages copied from the web.

**Use a fresh Developer Edition org that holds nothing you care about.** The runner creates, deletes and converts records.

## One-time setup (about 20 minutes)

1. Sign up for a free Developer Edition org, then log in with the Salesforce CLI:
   ```bash
   sf org login web --alias lab
   ```
2. From the repo root, deploy the lab configuration and give yourself access to its fields:
   ```bash
   sf project deploy start --source-dir lab/force-app --target-org lab
   sf org assign permset --name Error_Lab_Access --target-org lab
   ```
   This adds Account fields (restricted picklist `Tier__c`, unique external ID `Legacy_Id__c`, number(3,0) `Employee_Band__c`, text(5) `Short_Code__c`, a formula field), Contact fields (`Contact_Type__c`, `Preferred_Account__c` with a Gold-only lookup filter), a "Phone required for Customer" validation rule, and a `Lab_Event__c` object whose trigger throws on `Name = 'BOOM'`.
3. Two steps in Setup (the metadata for these is fiddly, so they are manual):
   - **Duplicate rule (for R04):** Setup > Duplicate Rules > Standard Contact Duplicate Rule > Edit. Set Action On Create to **Block**, and activate the rule.
   - **Failing Flow (for R20, optional):** Setup > Flows > New > Record-Triggered Flow on Lead, *A record is created*, entry condition `LeadSource` Equals `FlowFail`, optimized for *Actions and Related Records*. Add an **Update Triggering Record** element that sets `LastName` to blank (`{!$GlobalConstant.EmptyString}`). Save as "Lab Flow Fail" and activate.

## Run

```bash
node lab/run-lab.js --org lab
```

The runner seeds a few records, loads 20 recipe files (`lab/data/R01.csv` to `R20.csv`) with Bulk API 2.0 through the CLI, and saves each job's failed-results CSV to `lab/results/`. It then scores the explainer and writes `lab/results/summary.csv`.

Results mean:
- **pass**: every failure was classified as one of the expected codes.
- **learn**: a case where the lab is finding out Salesforce's real wording. Add the message to `examples/web-error-corpus.csv`, decide the right answer, then fix the parser.
- **FAIL**: the parser got a known case wrong.
- **not provoked**: no rows failed, usually because a manual step above was skipped.

Re-score without reloading: `node lab/run-lab.js --score-only`.

## Also worth trying by hand

The runner uses Bulk API 2.0. Data Loader's own client-side checks (dates, numbers) produce different wording, so load `lab/data/R10.csv` and `R11.csv` once with Data Loader in both SOAP and Bulk mode and drop the error files into the explainer. Do the same with one Data Import Wizard run, downloading the result from Setup > Bulk Data Load Jobs.
