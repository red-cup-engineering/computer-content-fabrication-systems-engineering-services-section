/**
 * Reading back an admission record the caller hands to a later operation. The records are plain
 * JSON, so a caller could alter one; each operation therefore re-checks what it relies on: the order
 * document is the canonical text of the order, the specification cites that document's digest, and
 * the data layer itself admitted the specification (the plan and receipt admissions re-validate it).
 */
import { semanticId } from "@red-cup-engineering/computer-content-address-engineering-services-section/semiotic-content-address-system";
import { kindProfiles } from "./kinds.mjs";
import { refuse } from "./refusal.mjs";
import { orderDocument, sha256Hex } from "./specify.mjs";

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

export function readAdmission(admission, profiles = kindProfiles()) {
  if (!isRecord(admission) || admission.type !== "FabricationOrderAdmission" || admission.version !== 1 || !isRecord(admission.order) || !isRecord(admission.specification) || typeof admission.orderDocument !== "string") {
    refuse("INVALID_ADMISSION", "admission must be a FabricationOrderAdmission@1", "admission");
  }
  const { order, specification } = admission;
  const profile = profiles.get(specification.artifact?.kind);
  if (profile === undefined || order.kind !== profile.kind) refuse("UNKNOWN_KIND", `the admission names the unknown kind ${JSON.stringify(specification.artifact?.kind)}`, "admission.specification.artifact.kind");
  if (orderDocument(order) !== admission.orderDocument) refuse("ORDER_DOCUMENT_MISMATCH", "orderDocument is not the canonical text of order", "admission.orderDocument");
  if (specification.source?.provenance?.digest !== `sha256:${sha256Hex(new TextEncoder().encode(admission.orderDocument))}`) refuse("ORDER_DOCUMENT_MISMATCH", "the specification does not cite the order document's bytes", "admission.specification.source");
  if (specification.type !== "ArtifactFabricationSpecification" || typeof specification.specificationDigest !== "string") refuse("INVALID_SPECIFICATION", "specification must be an admitted ArtifactFabricationSpecification", "admission.specification");
  const { specificationDigest, ...body } = specification;
  if (semanticId(body) !== specificationDigest) refuse("INVALID_SPECIFICATION", "the specification does not hash to its specificationDigest", "admission.specification");
  return { order, specification, profile, orderDocument: admission.orderDocument };
}

/** The projections an acceptance obligation is traced to: the artifacts its verdict is about. */
export function projectionsOfAssay(specification, assayId) {
  return [...new Set(specification.traceability.filter((trace) => trace.acceptanceObligationIds.includes(assayId)).flatMap((trace) => trace.projectionIds))].sort();
}
