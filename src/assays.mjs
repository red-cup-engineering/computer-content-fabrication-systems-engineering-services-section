/**
 * The assays: one acceptance check per assay id a kind profile names. An assay reads the delivered
 * outputs and the evidence the delivery carries and answers `{ ok, reasons, facts }`; it never writes,
 * and it recomputes with the upstream service whenever the upstream service has a pure function for
 * the check (claims, chart rendering, provenance closure, release metadata, newsletter validation and
 * rendering), so acceptance is not the producer's word. Where the check needs a live system (Lean,
 * CAIRN, the ebook proofer) the assay reads that system's own result record, or calls a port.
 *
 * Evidence formats, by assay (the `evidence` object of the delivery):
 *   claims-reproduce        claims: { spec, records? | recordTexts? }  (the loaded claim-spec and its records)
 *   conformance-passes      conformance: { ok, checks? }  (the check-vocabulary-conformance report)
 *   render-receipt-closes   renderReceipt: a manuscript-build-receipt; people?: PROV fragment; baseIri?: string
 *   metadata-consistent     metadata: { paperYaml, files: { "CITATION.cff": text, ... } }
 *   references-resolve      references: { cited: [citekey], available: [csl id] }
 *   svg-byte-deterministic  data?: rows or a file map the chart specification reads
 *   edition-accepted        proof: the ebook section's EbookEditionProof
 */
import { checkProvenanceClosure } from "@red-cup-engineering/prov-o-provenance-service/check-provenance-closure";
import { composeProvenanceManifest } from "@red-cup-engineering/prov-o-provenance-service/compose-provenance-manifest";
import { projectProvenanceAsProvO } from "@red-cup-engineering/prov-o-provenance-service/project-provenance-as-prov-o";
import { reproduceStatedClaims } from "@red-cup-engineering/research-claim-reproduction-service/reproduce-stated-claims";
import { checkReleaseMetadataConsistency } from "@red-cup-engineering/research-release-metadata-service/check-release-metadata-consistency";
import { renderVegaLiteSpecAsSvg } from "@red-cup-engineering/chart-specification-rendering-service/render-vega-lite-spec-as-svg";
import { validateVegaLiteSpec } from "@red-cup-engineering/chart-specification-rendering-service/validate-vega-lite-spec";
import { renderMarkdown, renderPasteHtml, validateIssue } from "@red-cup-engineering/email-newsletter-engineering-services-section";
import { validateSerialManifest } from "@red-cup-engineering/email-newsletter-engineering-services-section/fiction-serial";
import { niOfBytes, niOfJson, jsonOf, textOf } from "./address.mjs";
import { sha256Hex } from "./specify.mjs";

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const verdict = (reasons, facts = {}) => ({ ok: reasons.length === 0, reasons, facts });
const fail = (...reasons) => verdict(reasons);
const DOCUMENT_PROJECTIONS = ["pdf", "html", "docx", "jats", "markdown"];
const LEAN_DEFAULT_AXIOMS = ["propext", "Classical.choice", "Quot.sound"];
const squash = (text) => text.replace(/\s+/gu, " ").trim();

// — research papers —

async function claimsReproduce({ evidence, outputs }) {
  const given = evidence.claims;
  if (!isRecord(given) || !isRecord(given.spec)) return fail("evidence.claims must carry the claim-spec and its records");
  const request = { spec: given.spec, ...(given.records === undefined ? {} : { records: given.records }), ...(given.recordTexts === undefined ? {} : { recordTexts: given.recordTexts }) };
  const reproduced = reproduceStatedClaims(request);
  const reasons = [];
  if (!reproduced.ok) reasons.push(`claims disagree with their records: ${reproduced.disagreed.join(", ")}`);
  if (reproduced.total === 0) reasons.push("the claim-spec states no claim");
  const delivered = jsonOf(outputs.get("claims"));
  if (!Array.isArray(delivered)) reasons.push("the delivered claims record must be a JSON array of results");
  else {
    const mine = new Map(reproduced.results.map((result) => [result.id, niOfJson({ id: result.id, stated: result.stated, derived: result.derived, agrees: result.agrees })]));
    const theirs = new Map(delivered.map((result) => [result?.id, niOfJson({ id: result?.id, stated: result?.stated, derived: result?.derived, agrees: result?.agrees })]));
    for (const [id, ni] of mine) if (theirs.get(id) !== ni) reasons.push(`the delivered claims record differs from the reproduction at ${id}`);
    for (const id of theirs.keys()) if (!mine.has(id)) reasons.push(`the delivered claims record carries ${id}, which the spec does not state`);
  }
  return verdict(reasons, { total: reproduced.total, agreed: reproduced.agreed });
}

function conformancePasses({ evidence }) {
  const report = evidence.conformance;
  if (!isRecord(report)) return fail("evidence.conformance must be the vocabulary conformance report");
  // check-vocabulary-conformance reports { ok, checks: [{ id, ok, failures }], shapeTests, tool }.
  const findings = [
    ...["errors", "violations"].flatMap((key) => (Array.isArray(report[key]) ? report[key] : [])),
    ...(Array.isArray(report.checks) ? report.checks.filter((check) => check?.ok !== true) : []),
  ];
  const reasons = [];
  if (report.ok !== true) reasons.push("the conformance report is not ok");
  if (findings.length > 0) reasons.push(`the conformance report carries ${findings.length} finding(s)`);
  return verdict(reasons, { findings: findings.length });
}

async function renderReceiptCloses({ evidence, outputs, specification }) {
  const receipt = evidence.renderReceipt;
  if (!isRecord(receipt) || receipt.kind !== "manuscript-build-receipt" || !Array.isArray(receipt.outputs)) return fail("evidence.renderReceipt must be a manuscript-build-receipt");
  const reasons = [];
  const documents = DOCUMENT_PROJECTIONS.filter((projection) => outputs.has(projection));
  if (documents.length === 0) reasons.push("no document was delivered");
  for (const projection of documents) {
    const named = receipt.outputs.find((item) => item.format === projection);
    if (named === undefined) reasons.push(`the render receipt names no ${projection} output`);
    else if (named.ni !== outputs.get(projection).ni) reasons.push(`the delivered ${projection} is not the bytes the render receipt names`);
  }
  const baseIri = evidence.baseIri ?? `https://561.group/knowledge/${specification.artifact.id}/build/`;
  const fragments = [receipt.provenance, ...(evidence.people === undefined ? [] : [evidence.people])];
  const composed = composeProvenanceManifest({ fragments, baseIri });
  let projected;
  if (!composed.ok) reasons.push(`the provenance fragments do not compose: ${composed.refusal?.message ?? "refused"}`);
  else {
    const closure = checkProvenanceClosure(composed.manifest);
    if (!closure.ok || !closure.closed) reasons.push("the provenance of the render does not close");
    else if (outputs.has("provenance")) {
      projected = await projectProvenanceAsProvO(composed.manifest);
      if (!projected.ok) reasons.push(`the provenance does not project as PROV-O: ${projected.refusal?.message ?? "refused"}`);
      else {
        const delivered = jsonOf(outputs.get("provenance"));
        if (delivered === undefined || niOfJson(delivered) !== niOfJson(projected.jsonLd)) reasons.push("the delivered provenance is not the PROV-O projection of the render receipt's provenance");
      }
    }
  }
  return verdict(reasons, { documents, ...(projected?.ok ? { provenanceCanonicalNi: projected.canonicalNi, tripleCount: projected.tripleCount } : {}) });
}

function metadataConsistent({ evidence }) {
  const given = evidence.metadata;
  if (!isRecord(given) || typeof given.paperYaml !== "string" || !isRecord(given.files)) return fail("evidence.metadata must carry paperYaml and the metadata files");
  const checked = checkReleaseMetadataConsistency({ paperYaml: given.paperYaml, files: given.files });
  return verdict(checked.consistent ? [] : [`release metadata drifts from paper.yaml in ${checked.drift.length} place(s)`], { files: Object.keys(given.files).sort() });
}

function referencesResolve({ evidence, specification }) {
  const given = evidence.references;
  if (!isRecord(given) || !Array.isArray(given.cited) || !Array.isArray(given.available)) return fail("evidence.references must carry cited citekeys and the available references");
  const available = new Set(given.available);
  const cited = [...new Set(given.cited)];
  const reasons = cited.filter((key) => !available.has(key)).map((key) => `the citation ${key} resolves to no reference`);
  const minimum = specification.claims.find(({ id }) => id === "assignment-minimum-sources")?.quantity?.value;
  if (minimum !== undefined && cited.length < minimum) reasons.push(`${cited.length} distinct source(s) are cited; the assignment requires ${minimum}`);
  return verdict(reasons, { cited: cited.length });
}

async function corpusGrounded({ order, outputs, ports }) {
  const delivered = jsonOf(outputs.get("corpus-citations"));
  if (!isRecord(delivered) || !Array.isArray(delivered.records)) return fail("the corpus-citations output must be { corpus, records: [{ id }] }");
  if (typeof ports.readCorpusRecord !== "function") return fail("no CAIRN corpus reader is bound to the assay");
  const reasons = [];
  if (delivered.corpus !== order.inputs.corpus) reasons.push(`the citations are of the ${delivered.corpus} corpus, not the ordered ${order.inputs.corpus}`);
  const ids = [...new Set(delivered.records.map((record) => record?.id))];
  for (const id of ids) {
    const read = await ports.readCorpusRecord({ corpus: order.inputs.corpus, id });
    if (read?.exists !== true) reasons.push(`corpus record ${String(id)} is not in the ${order.inputs.corpus} corpus`);
  }
  const minimum = order.inputs.minimumRecords ?? 5;
  if (ids.length < minimum) reasons.push(`${ids.length} distinct corpus record(s) are cited; the order requires ${minimum}`);
  return verdict(reasons, { cited: ids.length });
}

// — Lean —

function leanCheckClean({ outputs }) {
  const check = jsonOf(outputs.get("check"));
  if (!isRecord(check) || check.kind !== "metroplat.lean.check-result") return fail("the check output must be a metroplat.lean.check-result");
  return verdict(check.state === "succeeded" ? [] : [`lean-check ended ${String(check.state)}, not succeeded`], { state: check.state });
}

function stripLeanComments(source) {
  return source.replace(/\/-[\s\S]*?-\//gu, " ").replace(/--[^\n]*/gu, " ");
}

function statementUnchanged({ order, outputs }) {
  const source = textOf(outputs.get("proof"));
  if (source === undefined) return fail("the proof output must be Lean source text");
  const code = squash(stripLeanComments(source));
  const reasons = [];
  if (!code.includes(squash(order.inputs.statement))) reasons.push("the delivered module does not state the ordered theorem exactly");
  if (!new RegExp(`\\b${order.inputs.theoremName.split(".").at(-1).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\b`, "u").test(code)) reasons.push("the delivered module does not declare the ordered theorem name");
  return verdict(reasons);
}

function axiomsAllowed({ order, outputs }) {
  const check = jsonOf(outputs.get("check"));
  const inspection = isRecord(check) ? check.inspection : undefined;
  if (!isRecord(inspection) || !Array.isArray(inspection.axioms)) return fail("the check output carries no declaration inspection");
  const allowed = new Set(order.inputs.allowedAxioms ?? LEAN_DEFAULT_AXIOMS);
  const reasons = [];
  if (inspection.declaration !== order.inputs.theoremName) reasons.push(`the inspected declaration is ${String(inspection.declaration)}, not the ordered ${order.inputs.theoremName}`);
  for (const axiom of inspection.axioms) if (axiom === "sorryAx" || !allowed.has(axiom)) reasons.push(`the declaration depends on the axiom ${axiom}`);
  const source = textOf(outputs.get("proof"));
  if (source !== undefined && /\bsorry\b/u.test(stripLeanComments(source))) reasons.push("the delivered module contains sorry");
  return verdict(reasons, { axioms: [...inspection.axioms].sort() });
}

// — SVG —

function svgSafe({ outputs }) {
  const svg = textOf(outputs.get("svg"));
  if (svg === undefined) return fail("the svg output must be SVG text");
  const reasons = [];
  if (!/^\s*(?:<\?xml[^>]*\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg[\s>]/u.test(svg)) reasons.push("the document does not open with an svg root");
  if (/<script\b/iu.test(svg)) reasons.push("the SVG carries a script element");
  if (/<foreignObject\b/iu.test(svg)) reasons.push("the SVG carries a foreignObject");
  if (/\son[a-z]+\s*=/iu.test(svg)) reasons.push("the SVG carries an event handler attribute");
  if (/javascript:/iu.test(svg)) reasons.push("the SVG carries a javascript: reference");
  if (/<!DOCTYPE|<!ENTITY/iu.test(svg)) reasons.push("the SVG declares a DOCTYPE or entity");
  for (const [, reference] of svg.matchAll(/(?:xlink:)?href\s*=\s*["']([^"']*)["']/giu)) if (!reference.startsWith("#")) reasons.push(`the SVG references ${reference.slice(0, 40)} outside itself`);
  if (/url\(\s*["']?(?!#)/iu.test(svg)) reasons.push("the SVG uses a url() outside itself");
  return verdict(reasons);
}

function vegaLiteValid({ outputs }) {
  const spec = jsonOf(outputs.get("spec"));
  if (!isRecord(spec)) return fail("the spec output must be a Vega-Lite specification object");
  const checked = validateVegaLiteSpec({ spec });
  return verdict(checked.valid ? [] : checked.issues.slice(0, 5).map((issue) => `${issue.kind} ${issue.path}: ${issue.message}`), { warnings: checked.warnings.length });
}

async function svgByteDeterministic({ evidence, outputs }) {
  const spec = jsonOf(outputs.get("spec"));
  const delivered = outputs.get("svg");
  if (!isRecord(spec) || delivered === undefined) return fail("the spec and svg outputs are required");
  const rendered = await renderVegaLiteSpecAsSvg({ spec, ...(evidence.data === undefined ? {} : { data: evidence.data }) });
  const ni = niOfBytes(new TextEncoder().encode(rendered.svg), "image/svg+xml").ni;
  return verdict(ni === delivered.ni ? [] : ["rendering the specification again does not yield the delivered SVG bytes"], { ni });
}

function svgCoversGraph({ outputs }) {
  const graph = jsonOf(outputs.get("graph"));
  const svg = textOf(outputs.get("svg"));
  if (!isRecord(graph) || !Array.isArray(graph.nodes) || svg === undefined) return fail("the graph (with nodes) and svg outputs are required");
  const text = svg.replace(/&lt;/gu, "<").replace(/&gt;/gu, ">").replace(/&quot;/gu, '"').replace(/&apos;/gu, "'").replace(/&amp;/gu, "&");
  const reasons = [];
  if (graph.nodes.length === 0) reasons.push("the graph has no node");
  for (const node of graph.nodes) {
    const label = String(node?.label ?? node?.id ?? "");
    if (label === "" || !text.includes(label)) reasons.push(`the node ${label || "(unlabelled)"} is not drawn in the SVG`);
  }
  return verdict(reasons, { nodes: graph.nodes.length });
}

// — ebook (delegated) —

async function editionAccepted({ evidence, outputs, ports }) {
  const accept = ports.ebook?.accept;
  if (typeof accept !== "function") return fail("no ebook acceptance is bound to the assay");
  const fabrication = jsonOf(outputs.get("edition"));
  if (!isRecord(fabrication)) return fail("the edition output must be the ebook fabrication result");
  if (!isRecord(evidence.proof)) return fail("evidence.proof must be the independent proofer's EbookEditionProof");
  const acceptance = await accept(fabrication, evidence.proof);
  return verdict(acceptance?.status === "accepted" ? [] : [`the ebook section did not accept the edition: ${acceptance?.code ?? acceptance?.status ?? "no acceptance"}`], { status: acceptance?.status ?? null });
}

function editionBytesAddressed({ outputs }) {
  const fabrication = jsonOf(outputs.get("edition"));
  if (!isRecord(fabrication) || !isRecord(fabrication.artifacts)) return fail("the edition output must carry the fabricated artifacts' digests");
  const reasons = [];
  for (const [projection, key] of [["epub", "epub"], ["screen-pdf", "screenPdf"]]) {
    const named = String(fabrication.artifacts[key]?.sha256 ?? "").replace(/^sha256:/u, "");
    const output = outputs.get(projection);
    if (output === undefined || output.form !== "bytes") reasons.push(`the ${projection} output is missing`);
    else if (named !== sha256Hex(output.bytes)) reasons.push(`the delivered ${projection} is not the bytes the edition names`);
  }
  return verdict(reasons);
}

// — newsletter and fiction serial (delegated) —

function issueValid({ outputs }) {
  const issue = jsonOf(outputs.get("issue"));
  if (!isRecord(issue)) return fail("the issue output must be the issue record");
  const report = validateIssue(issue);
  return verdict(report.valid ? [] : report.findings.filter((finding) => finding.severity === "error").slice(0, 5).map((finding) => finding.message), { findings: report.findings.length });
}

function renderingsReproduce({ outputs }) {
  const issue = jsonOf(outputs.get("issue"));
  if (!isRecord(issue)) return fail("the issue output must be the issue record");
  const reasons = [];
  const expected = { markdown: renderMarkdown(issue), html: renderPasteHtml(issue) };
  for (const [projection, text] of Object.entries(expected)) {
    const output = outputs.get(projection);
    if (output === undefined || textOf(output) === undefined) reasons.push(`the ${projection} output is missing`);
    else if (output.ni !== niOfBytes(new TextEncoder().encode(text), output.mediaType).ni) reasons.push(`rendering the issue again does not yield the delivered ${projection}`);
  }
  return verdict(reasons);
}

function serialManifestValid({ order }) {
  const report = validateSerialManifest(order.inputs.manifest);
  return verdict(report.valid ? [] : report.findings.filter((finding) => finding.severity === "error").slice(0, 5).map((finding) => finding.message));
}

/** Assay id to its check. A profile that names an assay with no check here is refused at assay time, never silently passed. */
export const ASSAYS = Object.freeze({
  "claims-reproduce": claimsReproduce,
  "conformance-passes": conformancePasses,
  "render-receipt-closes": renderReceiptCloses,
  "metadata-consistent": metadataConsistent,
  "references-resolve": referencesResolve,
  "corpus-grounded": corpusGrounded,
  "lean-check-clean": leanCheckClean,
  "statement-unchanged": statementUnchanged,
  "axioms-allowed": axiomsAllowed,
  "svg-safe": svgSafe,
  "vega-lite-valid": vegaLiteValid,
  "svg-byte-deterministic": svgByteDeterministic,
  "svg-covers-graph": svgCoversGraph,
  "edition-accepted": editionAccepted,
  "edition-bytes-addressed": editionBytesAddressed,
  "issue-valid": issueValid,
  "renderings-reproduce": renderingsReproduce,
  "serial-manifest-valid": serialManifestValid,
});
