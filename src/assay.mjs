/**
 * `assayFabricatedArtifact`: the per-kind acceptance of a delivery. Each output is addressed (bytes by
 * `addressContent`, JSON by `semanticId`); each assay the kind's profile names runs; and each verdict
 * is a SignCell cell per artifact it is traced to:
 *
 *   subject    the ni name of the delivered artifact (the projection the assay is traced to)
 *   predicate  the assay id
 *   object     the specification digest the artifact was assayed against
 *   for        the assay's witness when it passed; against, when it failed
 *
 * so the cell's value is its presence: a passed assay reads held (told true), a failed one denied (told false).
 * An assay that fails is a verdict, not a refusal; a malformed delivery is a refusal.
 */
import { tellingOf } from "@red-cup-engineering/signcraft/membrane";
import { cones, documentOfSettlement, settleCells } from "@red-cup-engineering/signcraft/settle";
import { semanticId } from "@red-cup-engineering/computer-content-address-engineering-services-section/semiotic-content-address-system";
import { projectionsOfAssay, readAdmission } from "./admission.mjs";
import { admitOutput } from "./address.mjs";
import { ASSAYS } from "./assays.mjs";
import { kindProfiles } from "./kinds.mjs";
import { deepFreeze, refuse, refusingAsync } from "./refusal.mjs";

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const plain = (value) => JSON.parse(JSON.stringify(value));

/** Let SignCraft settle and read one explicitly sided, witnessed assay proposition.
 * Each traced projection is read separately: equal artifact addresses do not
 * erase the projection multiplicity or order required by delivery receiving. */
function assayCell(subject, predicate, object, witness, ok) {
  const telling = tellingOf({ utterance: [{ subject, object }, predicate], side: ok ? "for" : "against" }, witness);
  const settlement = settleCells([telling]);
  const { spine } = documentOfSettlement(settlement);
  return { cell: spine.cells[0], address: spine.addresses[0].key, reading: cones(settlement)[0].adjudicate };
}

/** Check a delivery candidate's frame against the admission and admit every output. */
export function admitDelivery(delivery, specification, profile) {
  if (!isRecord(delivery) || delivery.type !== "FabricationDeliveryCandidate" || delivery.version !== 1) refuse("INVALID_DELIVERY", "delivery must be FabricationDeliveryCandidate@1", "delivery");
  if (delivery.artifactId !== specification.artifact.id || delivery.specificationDigest !== specification.specificationDigest) refuse("DELIVERY_BINDING_MISMATCH", "the delivery must bind the admitted artifact id and specification digest", "delivery");
  if (!isRecord(delivery.producer) || typeof delivery.producer.id !== "string" || delivery.producer.id === "") refuse("INVALID_DELIVERY", "delivery.producer must name its producer (id, revision)", "delivery.producer");
  if (!Array.isArray(delivery.outputs)) refuse("INVALID_DELIVERY", "delivery.outputs must be an array", "delivery.outputs");
  if (delivery.evidence !== undefined && !isRecord(delivery.evidence)) refuse("INVALID_DELIVERY", "delivery.evidence must be a JSON object", "delivery.evidence");
  const outputs = new Map();
  delivery.outputs.forEach((raw, index) => {
    const output = admitOutput(raw, `delivery.outputs[${index}]`);
    if (outputs.has(output.projection)) refuse("DUPLICATE_PROJECTION", `the delivery repeats ${output.projection}`, `delivery.outputs[${index}]`);
    outputs.set(output.projection, output);
  });
  for (const { projection, mediaType } of profile.deliverables) {
    const output = outputs.get(projection);
    if (output === undefined) refuse("MISSING_PROJECTION", `the delivery lacks the ${projection} projection`, "delivery.outputs", { missing: projection });
    if (output.mediaType !== mediaType) refuse("MEDIA_TYPE_MISMATCH", `${projection} is ${output.mediaType}, not the ordered ${mediaType}`, "delivery.outputs", { projection });
  }
  for (const projection of outputs.keys()) if (!profile.deliverables.some((item) => item.projection === projection)) refuse("UNEXPECTED_PROJECTION", `the delivery carries ${projection}, which the kind does not deliver`, "delivery.outputs");
  return outputs;
}

/**
 * @param {{ admission: object, delivery: object }} request the order admission and the executor's delivery candidate
 * @param {{ profiles?: Map<string, object>, ports?: { readCorpusRecord?: Function, ebook?: { accept?: Function } } }} [options]
 *   ports: the live systems some assays read: CAIRN corpus records, the ebook section's acceptance
 *
 * Refusals: INVALID_ADMISSION, ORDER_DOCUMENT_MISMATCH, INVALID_SPECIFICATION, UNKNOWN_KIND, INVALID_DELIVERY,
 * DELIVERY_BINDING_MISMATCH, DUPLICATE_PROJECTION, MISSING_PROJECTION, UNEXPECTED_PROJECTION, MEDIA_TYPE_MISMATCH, UNKNOWN_ASSAY.
 */
export async function assayFabricatedArtifact(request, { profiles = kindProfiles(), ports = {} } = {}) {
  return refusingAsync("FabricationAssayRefusal", async () => {
    if (!isRecord(request)) refuse("INVALID_REQUEST", "request must carry admission and delivery", "request");
    const { order, specification, profile } = readAdmission(request.admission, profiles);
    const outputs = admitDelivery(request.delivery, specification, profile);
    const evidence = request.delivery.evidence ?? {};
    const verdicts = []; const cells = [];
    for (const { id } of profile.assays) {
      const check = ASSAYS[id];
      if (check === undefined) refuse("UNKNOWN_ASSAY", `the ${profile.kind} profile names the assay ${id}, which the section has no check for`, "profile.assays");
      let result;
      try { result = await check({ order, specification, profile, outputs, evidence, ports }); }
      catch (error) { result = { ok: false, reasons: [`the assay raised ${error?.name ?? "Error"}: ${String(error?.message ?? error).slice(0, 300)}`], facts: {} }; }
      const witness = plain({ assay: id, ok: result.ok, reasons: result.reasons, facts: result.facts });
      const projections = projectionsOfAssay(specification, id);
      const issued = projections.map((projection) => assayCell(outputs.get(projection).ni, id, specification.specificationDigest, witness, result.ok));
      cells.push(...issued.map((item) => item.cell));
      verdicts.push({ assay: id, ok: result.ok, reasons: result.reasons, projections, cells: issued.map((item) => item.address), reading: issued.length === 0 ? null : issued[0].reading });
    }
    const summary = [...outputs.values()].map(({ projection, mediaType, ni, size }) => ({ projection, mediaType, ni, size })).sort((a, b) => a.projection.localeCompare(b.projection));
    const body = {
      type: "FabricationAssayResult", version: 1, artifactId: specification.artifact.id, kind: profile.kind,
      specificationDigest: specification.specificationDigest, outputs: summary, verdicts, cells: plain(cells),
      passed: verdicts.every(({ ok }) => ok),
    };
    return deepFreeze({ ...body, assayDigest: semanticId({ artifactId: body.artifactId, specificationDigest: body.specificationDigest, outputs: summary, verdicts: plain(verdicts) }) });
  });
}
