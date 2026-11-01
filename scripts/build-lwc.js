// Generates the Salesforce LWC module from explainer.js so the website and the package share one parser.
// Usage: node scripts/build-lwc.js
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "explainer.js"), "utf8");
const header = /\(function \(root, factory\) \{[\s\S]*?\}\)\(typeof self !== "undefined" \? self : this, function \(\) \{/;
if (!header.test(src)) throw new Error("UMD header not found in explainer.js");
let body = src.replace(header, "const SFErrorExplainer = (function () {");
body = body.replace(/\}\);\s*$/, "})();\n\nexport default SFErrorExplainer;\n");
const out = "// GENERATED from explainer.js by scripts/build-lwc.js. Edit explainer.js, then rebuild.\n" + body;
const target = path.join(__dirname, "..", "salesforce", "force-app", "main", "default", "lwc", "importErrorCore", "importErrorCore.js");
fs.writeFileSync(target, out);
console.log("wrote " + path.relative(process.cwd(), target));
