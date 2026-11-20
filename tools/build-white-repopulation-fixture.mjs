#!/usr/bin/env node
// Builds the reference fixture: the White Repopulation v0.2.0 paper as a fully worked research-paper
// order -> specification -> plan -> assay -> receipt, from its public release assets.
//
//   node tools/build-white-repopulation-fixture.mjs --release <dir of the v0.2.0 release assets>
//        --tree <the v0.2.0 source tree (git archive v0.2.0)> --conformance <check-vocabulary-conformance report json>
//        --out <dir, e.g. test/fixtures/white-repopulation>
//
// The release assets are https://github.com/lenticule-science/white-repopulation/releases/download/v0.2.0/<asset>.
// The delivery is the real bytes; every assay runs on them, with the evidence the paper's own build
// produced. The fixture keeps the evidence and the small outputs (claims.json, prov.jsonld) so the
// evidence-bound assays replay offline; the large documents are kept by ni name and size only.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { loadSpec } from "@red-cup-engineering/research-claim-reproduction-service";
import { admitFabricationOrder } from "../src/order.mjs";
import { planFabrication } from "../src/plan.mjs";
import { assayFabricatedArtifact } from "../src/assay.mjs";
import { receiveFabricationDelivery } from "../src/delivery.mjs";

const { values } = parseArgs({ options: { release: { type: "string" }, tree: { type: "string" }, conformance: { type: "string" }, out: { type: "string" } } });
for (const key of ["release", "tree", "conformance", "out"]) if (values[key] === undefined) { process.stderr.write("usage: build-white-repopulation-fixture --release <dir> --tree <dir> --conformance <report.json> --out <dir>\n"); process.exit(2); }

const RELEASE_URL = "https://github.com/lenticule-science/white-repopulation/releases/download/v0.2.0";
const asset = (name) => readFileSync(join(values.release, name));
const treeText = (path) => readFileSync(join(values.tree, path), "utf8");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const base64 = (bytes) => Buffer.from(bytes).toString("base64");

// The release's own checksums must hold for every asset we address.
const sums = new Map(treeLines(asset("SHA256SUMS").toString("utf8")).map((line) => { const [hash, name] = line.split(/\s+/u); return [name, hash]; }));
function treeLines(text) { return text.split("\n").filter(Boolean); }
for (const [name, hash] of sums) if (sha256(asset(name)) !== hash) throw new Error(`release asset ${name} does not match SHA256SUMS`);

// Claims: the claim-spec and records as the paper's repository states them; the delivered claims record
// is the tarball's data/derived/claims.json.
const root = values.tree;
const spec = loadSpec(root, "claims/claims.json");
const recordTexts = Object.fromEntries(Object.entries(spec.records).map(([name, path]) => [name, treeText(path)]));
const claimsBytes = execFileSync("tar", ["-xzOf", join(values.release, "white-repopulation-data.tar.gz"), "data/derived/claims.json"], { maxBuffer: 1 << 24 });

// References: the paper declares `nocite: "@*"` (manuscript/build.yaml), so every reference in its CSL file is cited;
// the assay checks that each cited key resolves in the delivered references.
const available = [...treeText("references/references.yaml").matchAll(/^\s*-\s+id:\s*(\S+)\s*$/gmu)].map(([, id]) => id);
if (!/^nocite:\s*"@\*"/mu.test(treeText("manuscript/build.yaml"))) throw new Error("expected the paper to cite its whole bibliography (nocite: \"@*\")");
const cited = new Set(available);

const evidence = {
  claims: { spec, recordTexts },
  conformance: JSON.parse(readFileSync(values.conformance, "utf8")),
  renderReceipt: JSON.parse(asset("receipt.json").toString("utf8")),
  people: JSON.parse(treeText("provenance/agents.json")),
  baseIri: "https://561.group/knowledge/white-repopulation/build/",
  metadata: {
    paperYaml: treeText("paper.yaml"),
    files: { "CITATION.cff": treeText("CITATION.cff"), ".zenodo.json": treeText(".zenodo.json"), "codemeta.json": treeText("codemeta.json"), "scholarly-article.jsonld": treeText("metadata/scholarly-article.jsonld") },
  },
  references: { cited: [...cited].sort(), available: available.sort() },
};

const outputsSpec = [
  ["pdf", "application/pdf", "white-repopulation.pdf"], ["html", "text/html", "white-repopulation.html"],
  ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "white-repopulation.docx"], ["jats", "application/jats+xml", "white-repopulation.jats.xml"],
  ["provenance", "application/ld+json", "prov.jsonld"],
];
const outputs = [
  ...outputsSpec.map(([projection, mediaType, name]) => ({ projection, mediaType, bytesBase64: base64(asset(name)) })),
  { projection: "claims", mediaType: "application/json", bytesBase64: base64(claimsBytes) },
];

const candidate = {
  type: "FabricationOrderCandidate", version: 1, kind: "research-paper",
  buyer: { id: "lenticule-science" },
  inputs: {
    title: "White Repopulation: Reproduction without Preservation",
    subtitle: "The future white, captive births, and the transatlantic reproduction of settler rule",
    thesis: "Institutions preserved the authority to classify and to appropriate reproduction more reliably than the reproductive opportunities of every person classified white.",
    authors: [{ name: "Morgan Sennhauser", role: "accountable-human-author" }],
    sourceBundle: { locator: `${RELEASE_URL}/white-repopulation-data.tar.gz`, digest: `sha256:${sha256(asset("white-repopulation-data.tar.gz"))}` },
    license: "CC-BY-4.0", language: "en-US",
    keywords: ["settler colonialism", "social reproduction", "historical demography"],
  },
  budget: { amount: "$100.00" },
  placedAt: "2026-10-24T00:00:00Z",
};
const admission = admitFabricationOrder(candidate);
if (admission.type !== "FabricationOrderAdmission") throw new Error(`order refused: ${JSON.stringify(admission)}`);
const plan = planFabrication(admission.specification);
if (plan.type !== "FabricationPlan") throw new Error(`plan refused: ${JSON.stringify(plan)}`);
const delivery = {
  type: "FabricationDeliveryCandidate", version: 1, artifactId: admission.artifactId, specificationDigest: admission.specification.specificationDigest,
  producer: { id: "lenticule-science-release-v0.2.0", revision: "white-repopulation@v0.2.0", kind: "organization" },
  startedAt: "2026-10-24T23:40:34.019Z", endedAt: "2026-10-24T23:41:05.246Z",
  outputs, evidence,
};
const assay = await assayFabricatedArtifact({ admission, delivery });
if (assay.type !== "FabricationAssayResult") throw new Error(`assay refused: ${JSON.stringify(assay)}`);
for (const verdict of assay.verdicts) process.stdout.write(`${verdict.ok ? "held  " : "DENIED"} ${verdict.assay}${verdict.ok ? "" : `: ${verdict.reasons.join("; ")}`}\n`);
const receipt = await receiveFabricationDelivery({ admission, delivery, assay, receivedAt: "2026-10-24T23:58:19Z" });
if (receipt.type !== "FabricationDeliveryReceipt") throw new Error(`receipt refused: ${receipt.code}: ${receipt.message}`);

const manifest = {
  type: "FabricationDeliveryManifest", version: 1, artifactId: admission.artifactId, specificationDigest: admission.specification.specificationDigest,
  producer: delivery.producer, release: "https://github.com/lenticule-science/white-repopulation/releases/tag/v0.2.0",
  outputs: outputsSpec.map(([projection, mediaType, name]) => ({ projection, mediaType, locator: `${RELEASE_URL}/${name}`, sha256: sha256(asset(name)), ...assay.outputs.find((o) => o.projection === projection) })).concat([{ projection: "claims", mediaType: "application/json", locator: `${RELEASE_URL}/white-repopulation-data.tar.gz#data/derived/claims.json`, sha256: sha256(claimsBytes), ...assay.outputs.find((o) => o.projection === "claims") }]),
};
mkdirSync(values.out, { recursive: true });
const put = (name, value) => writeFileSync(join(values.out, name), typeof value === "string" || Buffer.isBuffer(value) ? value : `${JSON.stringify(value, null, 2)}\n`);
put("order.json", candidate);
put("admission.json", admission);
put("plan.json", plan);
put("delivery-manifest.json", manifest);
put("evidence.json", evidence);
put("claims.json", claimsBytes);
put("prov.jsonld", asset("prov.jsonld"));
put("assay.json", assay);
put("receipt.json", receipt);
process.stdout.write(`fixture written to ${values.out}\nartifact ${admission.artifactId}\nreceipt ${receipt.receiptDigest}\n`);
