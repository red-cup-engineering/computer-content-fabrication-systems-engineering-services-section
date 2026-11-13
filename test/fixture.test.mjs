import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { admitArtifactFabricationRealizationReceipt } from "@red-cup-engineering/computer-data-engineering-services-section/artifact-fabrication";
import { semanticId } from "@red-cup-engineering/computer-content-address-engineering-services-section/semiotic-content-address-system";
import { admitCell, address } from "@red-cup-engineering/signcell/cell";
import { assayFabricatedArtifact } from "../src/assay.mjs";
import { ASSAYS } from "../src/assays.mjs";
import { admitOutput } from "../src/address.mjs";
import { readAdmission } from "../src/admission.mjs";
import { admitFabricationOrder } from "../src/order.mjs";
import { planFabrication } from "../src/plan.mjs";

const DIR = new URL("../test/fixtures/white-repopulation/", import.meta.url);
const read = (name) => readFileSync(new URL(name, DIR));
const json = (name) => JSON.parse(read(name).toString("utf8"));
const [order, admission, plan, manifest, evidence, assay, receipt] = ["order.json", "admission.json", "plan.json", "delivery-manifest.json", "evidence.json", "assay.json", "receipt.json"].map(json);

// SHA256SUMS of https://github.com/lenticule-science/white-repopulation/releases/tag/v0.2.0
const RELEASE_SHA256 = {
  pdf: "3383dbc3d8d3d721a4396ce2748da725859281ddc92a8eaa81ee65e1e6382f93",
  html: "e7d156ff78f002d6344b176d16a8a4ef8e168d4a68f2995cecc758043df3b36b",
  docx: "9683fe34e5968bfd2c239855fa656a8cd41553c46846febcc77d74c1cddcd3a2",
  jats: "01db37ec62bdaf2dc55efefb683b30b8db0f0a60925b38a678e5f056b9800394",
  provenance: "143426652a1fdd6e8ef0795992c9d42927a539b4628b948810a818cbdbc1be68",
};
// RFC 6920: the base64url, unpadded, of the sha-256 digest.
const niOfHex = (hex) => `ni:///sha-256;${Buffer.from(hex, "hex").toString("base64url")}`;

test("White Repopulation v0.2.0: the order is admitted as the same specification the fixture records", () => {
  const again = admitFabricationOrder(order);
  assert.equal(again.type, "FabricationOrderAdmission");
  assert.deepEqual(JSON.parse(JSON.stringify(again)), admission);
  assert.equal(admission.quote.price.amount, "$100.00");
  assert.equal(readAdmission(admission).profile.kind, "research-paper");
  assert.deepEqual(JSON.parse(JSON.stringify(planFabrication(admission.specification))), plan);
});

test("the fixture's outputs are the real release assets, addressed by their ni names", () => {
  for (const [projection, hex] of Object.entries(RELEASE_SHA256)) {
    const output = manifest.outputs.find((item) => item.projection === projection);
    assert.equal(output.sha256, hex, projection);
    assert.equal(output.ni, niOfHex(hex), `${projection} is addressed by the sha-256 of the release asset`);
    assert.ok(output.locator.startsWith("https://github.com/lenticule-science/white-repopulation/releases/download/v0.2.0/"));
  }
  // the committed small outputs are exactly the release bytes
  assert.equal(createHash("sha256").update(read("prov.jsonld")).digest("hex"), RELEASE_SHA256.provenance);
  const claims = manifest.outputs.find((item) => item.projection === "claims");
  assert.equal(createHash("sha256").update(read("claims.json")).digest("hex"), claims.sha256);
  assert.equal(admitOutput({ projection: "claims", mediaType: "application/json", bytesBase64: read("claims.json").toString("base64") }).ni, claims.ni);
  // and the paper's own render receipt names the same bytes
  for (const projection of ["pdf", "html", "docx", "jats"]) assert.equal(evidence.renderReceipt.outputs.find((item) => item.format === projection).ni, manifest.outputs.find((item) => item.projection === projection).ni);
});

test("every assay of the research-paper kind held, each as SignCell cells whose subjects are the release assets", () => {
  assert.equal(assay.passed, true);
  assert.deepEqual(assay.verdicts.map((verdict) => verdict.assay), ["claims-reproduce", "conformance-passes", "render-receipt-closes", "metadata-consistent", "references-resolve"]);
  const subjects = new Set(manifest.outputs.map(({ ni }) => ni));
  assert.equal(assay.cells.length, 16);
  for (const item of assay.cells) {
    const cell = admitCell(item);
    assert.ok(subjects.has(cell.subject));
    assert.equal(cell.object, admission.specification.specificationDigest);
    assert.equal(cell.for.length, 1);
    assert.deepEqual(cell.against, []);
  }
  assert.deepEqual(assay.verdicts.flatMap((verdict) => verdict.cells).sort(), assay.cells.map((item) => address(admitCell(item))).sort());
});

test("the receipt closes: every projection realized by an ni name, every assay evidenced by its cells, PROV closed", () => {
  const again = admitArtifactFabricationRealizationReceipt(admission.specification, { type: "ArtifactFabricationRealizationReceiptCandidate", version: 1, artifactId: receipt.receipt.artifactId, specificationDigest: receipt.receipt.specificationDigest, realizations: receipt.receipt.realizations, acceptances: receipt.receipt.acceptances });
  assert.deepEqual(JSON.parse(JSON.stringify(again)), receipt.receipt);
  assert.equal(receipt.receipt.realizations.length, 6);
  assert.equal(receipt.receipt.acceptances.length, 5);
  assert.equal(receipt.receiptDigest, semanticId(receipt.receipt));
  assert.equal(receipt.provenance.closed, true);
  assert.equal(receipt.marketOutcome.outcome, "accepted");
  for (const realization of receipt.receipt.realizations) assert.equal(realization.evidence.digest, manifest.outputs.find((item) => item.projection === realization.projectionId).ni);
});

test("the evidence-bound assays replay offline on the recorded evidence and the committed outputs", async () => {
  const outputs = new Map(manifest.outputs.map((item) => [item.projection, { projection: item.projection, mediaType: item.mediaType, form: "bytes", ni: item.ni, size: item.size }]));
  outputs.set("claims", admitOutput({ projection: "claims", mediaType: "application/json", bytesBase64: read("claims.json").toString("base64") }));
  outputs.set("provenance", admitOutput({ projection: "provenance", mediaType: "application/ld+json", bytesBase64: read("prov.jsonld").toString("base64") }));
  const ctx = { order: admission.order, specification: admission.specification, outputs, evidence, ports: {} };
  for (const id of ["claims-reproduce", "conformance-passes", "render-receipt-closes", "metadata-consistent", "references-resolve"]) {
    const verdict = await ASSAYS[id](ctx);
    assert.equal(verdict.ok, true, `${id}: ${verdict.reasons.join("; ")}`);
  }
  // 26 stated claims reproduce exactly
  assert.deepEqual(await ASSAYS["claims-reproduce"](ctx), { ok: true, reasons: [], facts: { total: 26, agreed: 26 } });
  // and the assays are not vacuous: a claim edited in the delivered record, a drifted metadata file, a document with other bytes
  const tampered = new Map(outputs); tampered.set("claims", admitOutput({ projection: "claims", mediaType: "application/json", text: read("claims.json").toString("utf8").replace('"derived": 5167522', '"derived": 5167523') }));
  assert.equal((await ASSAYS["claims-reproduce"]({ ...ctx, outputs: tampered })).ok, false);
  const drifted = { ...evidence, metadata: { ...evidence.metadata, files: { ...evidence.metadata.files, "CITATION.cff": evidence.metadata.files["CITATION.cff"].replace("White Repopulation", "Black Depopulation") } } };
  assert.equal((await ASSAYS["metadata-consistent"]({ ...ctx, evidence: drifted })).ok, false);
  const swapped = new Map(outputs); swapped.set("pdf", { ...outputs.get("pdf"), ni: niOfHex("00".repeat(32)) });
  assert.equal((await ASSAYS["render-receipt-closes"]({ ...ctx, outputs: swapped })).ok, false);
  const broken = { ...evidence, conformance: { ...evidence.conformance, ok: false } };
  assert.equal((await ASSAYS["conformance-passes"]({ ...ctx, evidence: broken })).ok, false);
});

test("opt-in full replay on the downloaded release assets (WR_RELEASE_DIR=<dir with the v0.2.0 assets>)", { skip: process.env.WR_RELEASE_DIR === undefined }, async () => {
  const dir = process.env.WR_RELEASE_DIR;
  const asset = (name) => readFileSync(`${dir}/${name}`).toString("base64");
  const media = { pdf: ["application/pdf", "white-repopulation.pdf"], html: ["text/html", "white-repopulation.html"], docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "white-repopulation.docx"], jats: ["application/jats+xml", "white-repopulation.jats.xml"], provenance: ["application/ld+json", "prov.jsonld"] };
  const outputs = [...Object.entries(media).map(([projection, [mediaType, name]]) => ({ projection, mediaType, bytesBase64: asset(name) })), { projection: "claims", mediaType: "application/json", bytesBase64: read("claims.json").toString("base64") }];
  const delivery = { type: "FabricationDeliveryCandidate", version: 1, artifactId: admission.artifactId, specificationDigest: admission.specification.specificationDigest, producer: { id: "lenticule-science-release-v0.2.0", revision: "white-repopulation@v0.2.0", kind: "organization" }, outputs, evidence };
  const replayed = await assayFabricatedArtifact({ admission, delivery });
  assert.equal(replayed.passed, true);
  assert.equal(replayed.assayDigest, assay.assayDigest);
  assert.ok(existsSync(dir));
});
