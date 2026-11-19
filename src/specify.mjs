/**
 * From a kind profile and an order to the data layer's ArtifactFabricationSpecificationCandidate.
 * The record type is the data layer's (`computer-data-engineering-services-section/artifact-fabrication`);
 * this module only fills it from the profile. The source of the specification is the order document:
 * the canonical text of the order, whose digest the admitted specification cites.
 */
import { createHash } from "node:crypto";

const sortKeys = (value) => {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]));
  return value;
};

/** The order as its source document: sorted keys, two-space indent, one trailing newline. Equal orders give equal bytes. */
export const orderDocument = (order) => `${JSON.stringify(sortKeys(order), null, 2)}\n`;

export const sha256Hex = (bytes) => createHash("sha256").update(bytes).digest("hex");

const lineCount = (text) => text.split(/\r\n|\n|\r/u).length;

/** Single-line text for a clause: whitespace collapsed, so no text can break the data layer's line rule. */
export const oneLine = (value) => String(value).replace(/\s+/gu, " ").trim();

const span = (endLine) => ({ type: "ArtifactFabricationSourceSpan", startLine: 1, endLine });

/**
 * Version 2 candidates (the data layer's epistemic law): every clause states its parameters and the
 * claims it rests on. A statement here carries no number and no input text; it refers to the order
 * ("the title the order states") because the order document is the source the specification cites.
 * A prohibition refuses work, so it rests on a claim derived from the constraints it names; a number
 * an input form adds (an assignment's minimum source count) is a parameter that references a measured
 * claim read from the admitted assignment.
 *
 * @param {object} profile an admitted kind profile
 * @param {object} order the normalized order record
 * @param {string} text the order document (orderDocument(order))
 * @param {{ requirements?: object[], claims?: object[] }} [additions] clauses and measured claims an input form adds
 */
export function specificationCandidate(profile, order, text, { requirements: extraRequirements = [], claims: extraClaims = [] } = {}) {
  const whole = span(lineCount(text));
  const hex = sha256Hex(new TextEncoder().encode(text));
  const requirements = [...profile.requirements, ...extraRequirements];
  const prohibitionClaim = (item) => ({
    type: "ArtifactFabricationClaim", version: 1, id: `rests-${item.id}`, kind: "world",
    statement: oneLine(`The prohibition ${item.id} follows from the constraints it names.`),
    status: "derived", quantity: null,
    basis: {
      type: "ArtifactFabricationDerivedBasis",
      premises: item.constraints.map((ref) => ({ type: "ArtifactFabricationPremise", kind: "constraint", ref })),
      derivation: "The prohibition states the negation of what a named constraint permits.",
    },
    sourceSpan: whole,
  });
  const clause = (type, item, claimIds = []) => ({ type, version: 2, id: item.id, statement: oneLine(item.statement), parameters: item.parameters ?? [], claimIds: item.claimIds ?? claimIds, sourceSpan: whole });
  return {
    type: "ArtifactFabricationSpecificationCandidate",
    version: 2,
    source: {
      type: "ArtifactFabricationSource", version: 1,
      identity: { type: "ArtifactFabricationSourceIdentity", id: `fabrication-order-${hex.slice(0, 16)}` },
      provenance: { type: "ArtifactFabricationSourceProvenance", locator: `order:${oneLine(order.buyer.id)}/${hex.slice(0, 16)}`, digest: `sha256:${hex}`, sourceSpan: whole },
    },
    artifact: { type: "FabricatedArtifactIdentity", version: 1, id: `${profile.kind}-${hex.slice(0, 16)}`, kind: profile.kind },
    claims: [...extraClaims.map((claim) => ({ ...claim, sourceSpan: whole })), ...profile.prohibitions.map(prohibitionClaim)],
    requirements: requirements.map((item) => clause("ArtifactFabricationRequirement", item)),
    prohibitions: profile.prohibitions.map((item) => clause("ArtifactFabricationProhibition", item, [`rests-${item.id}`])),
    openQuestions: [],
    constraints: profile.constraints.map((item) => ({ type: "ArtifactFabricationConstraint", version: 2, ...item, parameters: [], claimIds: [], sourceSpan: whole })),
    projections: profile.deliverables.map(({ projection, mediaType, target }) => ({ type: "ArtifactFabricationProjection", version: 1, id: projection, target, configuration: { mediaType }, sourceSpan: whole })),
    acceptanceObligations: profile.assays.map(({ id, statement }) => ({ type: "ArtifactFabricationAcceptanceObligation", version: 2, id, kind: "assay", statement: oneLine(statement), parameters: [], claimIds: [], sourceSpan: whole })),
    traceability: [...requirements, ...profile.prohibitions].map((item) => ({
      type: "ArtifactFabricationTrace", version: 1, requirementId: item.id,
      constraintIds: [...item.constraints], projectionIds: [...item.projections], acceptanceObligationIds: [...item.acceptance],
    })),
  };
}

/**
 * Bind an admitted specification to the exact bytes of its source document: the digest it cites is
 * the digest of those bytes, and every span lies within the document. This is the binding
 * `qualifySourceBoundArtifactFabrication` (computer-systems-fabrication) performs; that package's
 * dependency closure is the whole platform, so the section mirrors the binding rather than importing it.
 */
export function sourceBindingProblems(specification, bytes) {
  const problems = [];
  if (specification.source.provenance.digest !== `sha256:${sha256Hex(bytes)}`) problems.push("the admitted specification must cite the exact source document bytes");
  const lines = lineCount(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  const spans = [
    specification.source.provenance.sourceSpan,
    ...[...specification.claims, ...specification.requirements, ...specification.prohibitions, ...specification.openQuestions, ...specification.constraints, ...specification.projections, ...specification.acceptanceObligations].map((item) => item.sourceSpan),
  ];
  if (spans.some((item) => item.endLine > lines)) problems.push("source spans must reference lines present in the document");
  return problems;
}
