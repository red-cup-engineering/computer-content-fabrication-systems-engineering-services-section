/**
 * `receiveFabricationDelivery`: the receiving act, after the assay. It refuses a delivery any of whose
 * assays failed; otherwise it admits the data layer's ArtifactFabricationRealizationReceipt (every
 * projection realized by an ni-addressed output, every acceptance obligation evidenced by the SignCell
 * cells of its assay) and composes the PROV fragment of the fabrication through prov-o-provenance-service.
 * It also states the market outcome (the demand -> work order -> assay -> delivery -> market-outcome
 * pattern of knowledge production): `accepted` here, `refused` from the orchestrator when this refuses.
 */
import { admitArtifactFabricationRealizationReceipt } from "@red-cup-engineering/computer-data-engineering-services-section/artifact-fabrication";
import { semanticId } from "@red-cup-engineering/computer-content-address-engineering-services-section/semiotic-content-address-system";
import { checkProvenanceClosure } from "@red-cup-engineering/prov-o-provenance-service/check-provenance-closure";
import { composeProvenanceManifest } from "@red-cup-engineering/prov-o-provenance-service/compose-provenance-manifest";
import { projectProvenanceAsProvO } from "@red-cup-engineering/prov-o-provenance-service/project-provenance-as-prov-o";
import { admitCell, address } from "@red-cup-engineering/signcell/cell";
import { readAdmission } from "./admission.mjs";
import { admitDelivery } from "./assay.mjs";
import { niOfBytes } from "./address.mjs";
import { kindProfiles } from "./kinds.mjs";
import { deepFreeze, refuse, refusingAsync } from "./refusal.mjs";

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const plain = (value) => JSON.parse(JSON.stringify(value));
const utf8 = (text) => new TextEncoder().encode(text);

/** The assay result must be of exactly these bytes, against this specification, with cells that mean what the verdicts say. */
function checkAssay(assay, specification, profile, outputs) {
  if (!isRecord(assay) || assay.type !== "FabricationAssayResult" || assay.version !== 1) refuse("INVALID_ASSAY", "assay must be a FabricationAssayResult@1", "assay");
  if (assay.artifactId !== specification.artifact.id || assay.specificationDigest !== specification.specificationDigest) refuse("ASSAY_BINDING_MISMATCH", "the assay is of another artifact or specification", "assay");
  for (const output of assay.outputs) if (outputs.get(output.projection)?.ni !== output.ni) refuse("ASSAY_OF_OTHER_BYTES", `the assay addressed ${output.projection} as ${output.ni}, which is not the delivered artifact`, "assay.outputs");
  if (assay.outputs.length !== outputs.size) refuse("ASSAY_OF_OTHER_BYTES", "the assay did not address every delivered output", "assay.outputs");
  const subjects = new Set([...outputs.values()].map(({ ni }) => ni));
  const cellsByAssay = new Map();
  for (const item of assay.cells) {
    let admitted;
    try { admitted = admitCell(item); } catch { refuse("INVALID_ASSAY", "assay.cells carries a value that is not a SignCell cell", "assay.cells"); }
    if (!subjects.has(admitted.subject) || admitted.object !== specification.specificationDigest) refuse("ASSAY_OF_OTHER_BYTES", "an assay cell is not about a delivered artifact under this specification", "assay.cells");
    cellsByAssay.set(admitted.predicate, [...(cellsByAssay.get(admitted.predicate) ?? []), admitted]);
  }
  const failures = [];
  for (const { id } of profile.assays) {
    const verdict = assay.verdicts.find((item) => item.assay === id);
    if (verdict === undefined) refuse("INVALID_ASSAY", `the assay result carries no verdict for ${id}`, "assay.verdicts");
    const issued = cellsByAssay.get(id) ?? [];
    const told = issued.some((item) => item.for.length > 0 && item.against.length === 0);
    const denied = issued.some((item) => item.against.length > 0);
    if (verdict.ok !== (told && !denied) || issued.map(address).sort().join() !== [...verdict.cells].sort().join()) refuse("INVALID_ASSAY", `the verdict of ${id} is not what its cells show`, "assay.verdicts");
    if (!verdict.ok) failures.push({ assay: id, reasons: verdict.reasons });
  }
  return failures;
}

/** The PROV fragment of this fabrication: the order, the producer, the buyer, and every output as an ni-addressed entity. */
function provenanceFragment({ admission, order, profile, delivery, outputs, receivedAt }) {
  const producer = `agent/${delivery.producer.id}`; const buyer = `agent/${order.buyer.id}`;
  const entityOf = (output, derivedFrom) => ({ id: profile.deliverables.find(({ projection }) => projection === output.projection).target, path: profile.deliverables.find(({ projection }) => projection === output.projection).target, ni: output.ni, bytes: output.size ?? utf8(JSON.stringify(output.json)).byteLength, mediaType: output.mediaType, wasDerivedFrom: [derivedFrom], wasAttributedTo: [producer] });
  const orderBytes = utf8(admission.orderDocument);
  return {
    agents: [
      { id: producer, name: delivery.producer.revision === undefined ? delivery.producer.id : `${delivery.producer.id} ${delivery.producer.revision}`, kind: delivery.producer.kind ?? "software", actedOnBehalfOf: buyer },
      { id: buyer, name: order.buyer.id, kind: "person" },
    ],
    activities: [{
      id: `fabricate-${admission.artifactId}`, label: `Fabricate ${profile.kind}`,
      startedAt: delivery.startedAt ?? receivedAt, endedAt: delivery.endedAt ?? receivedAt,
      used: ["order.json"], generated: [...outputs.values()].map((output) => entityOf(output, "order.json").id),
      wasAssociatedWith: [{ agent: producer, role: "fabricator" }],
    }],
    entities: [
      { id: "order.json", path: "order.json", ni: niOfBytes(orderBytes, "application/json").ni, bytes: orderBytes.byteLength, mediaType: "application/json", wasDerivedFrom: [], wasAttributedTo: [buyer] },
      ...[...outputs.values()].map((output) => entityOf(output, "order.json")),
    ],
  };
}

/**
 * @param {{ admission: object, delivery: object, assay: object, receivedAt: string }} request
 * @param {{ profiles?: Map<string, object> }} [options]
 * Refusals: the admission and delivery refusals of `assayFabricatedArtifact`, INVALID_ASSAY, ASSAY_BINDING_MISMATCH,
 * ASSAY_OF_OTHER_BYTES, ASSAY_FAILED (detail.failures names each failed assay), INVALID_REQUEST,
 * RECEIPT_REFUSED, PROVENANCE_REFUSED.
 */
export async function receiveFabricationDelivery(request, { profiles = kindProfiles() } = {}) {
  return refusingAsync("FabricationDeliveryRefusal", async () => {
    if (!isRecord(request) || Number.isNaN(Date.parse(request.receivedAt))) refuse("INVALID_REQUEST", "request must carry admission, delivery, assay and receivedAt (an instant)", "request");
    const { admission, delivery, assay, receivedAt } = request;
    const { order, specification, profile } = readAdmission(admission, profiles);
    const outputs = admitDelivery(delivery, specification, profile);
    const failures = checkAssay(assay, specification, profile, outputs);
    if (failures.length > 0) refuse("ASSAY_FAILED", `the delivery failed ${failures.length} assay(s): ${failures.map(({ assay: id }) => id).join(", ")}`, "assay", { failures });
    const projectionOf = (id) => profile.deliverables.find(({ projection }) => projection === id);
    const candidate = {
      type: "ArtifactFabricationRealizationReceiptCandidate", version: 1, artifactId: specification.artifact.id, specificationDigest: specification.specificationDigest,
      realizations: specification.projections.map(({ id }) => ({ type: "ArtifactFabricationRealizationEvidence", version: 1, projectionId: id, evidence: { type: "ArtifactFabricationEvidence", locator: projectionOf(id).target, digest: outputs.get(id).ni } })),
      acceptances: specification.acceptanceObligations.map(({ id }) => ({ type: "ArtifactFabricationRealizationEvidence", version: 1, acceptanceObligationId: id, evidence: { type: "ArtifactFabricationEvidence", locator: `signcell:${id}`, digest: semanticId(plain(assay.verdicts.find((item) => item.assay === id).cells)) } })),
    };
    const receipt = admitArtifactFabricationRealizationReceipt(specification, candidate);
    if (receipt.type === "ArtifactFabricationRealizationReceiptRefusal") refuse("RECEIPT_REFUSED", `the data layer refused the realization receipt: ${receipt.message}`, receipt.path, receipt);
    const fragment = provenanceFragment({ admission, order, profile, delivery, outputs, receivedAt });
    const composed = composeProvenanceManifest({ fragments: [fragment], baseIri: `https://561.group/fabrication/${specification.artifact.id}/` });
    if (!composed.ok) refuse("PROVENANCE_REFUSED", `the fabrication provenance does not compose: ${composed.refusal.message}`, "provenance");
    const closure = checkProvenanceClosure(composed.manifest);
    if (!closure.ok || !closure.closed) refuse("PROVENANCE_REFUSED", "the fabrication provenance does not close", "provenance");
    const projected = await projectProvenanceAsProvO(composed.manifest);
    if (!projected.ok) refuse("PROVENANCE_REFUSED", `the fabrication provenance does not project as PROV-O: ${projected.refusal.message}`, "provenance");
    const receiptDigest = semanticId(plain(receipt));
    return deepFreeze({
      type: "FabricationDeliveryReceipt", version: 1,
      artifactId: specification.artifact.id, kind: profile.kind, orderId: admission.orderId, specificationDigest: specification.specificationDigest,
      receipt, receiptDigest,
      outputs: assay.outputs, cells: assay.cells, assayDigest: assay.assayDigest,
      provenance: { manifest: composed.manifest, canonicalNi: projected.canonicalNi, tripleCount: projected.tripleCount, closed: true },
      marketOutcome: {
        type: "FabricationMarketOutcome", version: 1, lot: `urn:work-lot:fabrication:${specification.artifact.id}`, provider: delivery.producer.id,
        taskClass: `fabrication.${profile.kind}`, outcome: "accepted", receipt: receiptDigest, evidence: `assay ${assay.assayDigest}`,
        ...(order.market === undefined ? {} : { market: order.market }),
      },
    });
  });
}
