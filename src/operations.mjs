/**
 * The section's operation definitions, in the house idiom: each is `{ name, description, inputSchema,
 * outputSchema, operation }`, bound to a pure function of this section and run as an NDJSON command by
 * `@red-cup-engineering/javascript-node-engineering-services-section/operation`. Faces return `{ ok: true, ...record }`
 * or `{ ok: false, refusal: { reason, message, path } }`.
 */
import { assayFabricatedArtifact } from "./assay.mjs";
import { asFace, resultSchema } from "./command.mjs";
import { receiveFabricationDelivery } from "./delivery.mjs";
import { kindIds, kindProfiles } from "./kinds.mjs";
import { admitFabricationOrder, quoteFabricationOrder } from "./order.mjs";
import { planFabrication } from "./plan.mjs";

const object = (properties, required = []) => ({ type: "object", required, additionalProperties: false, properties });
const record = (description) => ({ type: "object", description });
const instant = { type: "string", minLength: 1, description: "An RFC 3339 instant. Operations read no clock; the caller states the time." };
const buyer = object({ id: { type: "string", minLength: 1 } }, ["id"]);
const budget = {
  type: "object", additionalProperties: false,
  properties: { amount: { type: "string", pattern: "^\\$[0-9]+\\.[0-9]{2}$" }, maxPriceMicros: { type: "integer", minimum: 1 }, accountingUnit: { const: "USD-micros" } },
  description: "The most the buyer will pay: a dollar amount, or micros in USD-micros (the curiosity research market's unit).",
};

export const orderCandidateSchema = object({
  type: { const: "FabricationOrderCandidate" }, version: { const: 1 },
  kind: { enum: kindIds() },
  buyer, inputs: record("The kind's inputs (its profile's inputSchema)."), budget, placedAt: instant,
  assignmentAdmission: record("The curiosity research market's admitted ResearchAssignmentAdmission, for the research paper kinds: its question, budget, delivery date and acceptance terms become the order's."),
}, ["type", "version", "kind"]);

export const admitFabricationOrderOperation = {
  name: "admitFabricationOrder",
  description: "Admits a buyer's order as an ArtifactFabricationSpecification bound to the order document, or refuses it: unknown kind, missing or invalid inputs, an unknown tier, a budget below the quote, or an assignment that does not fit.",
  inputSchema: orderCandidateSchema,
  outputSchema: resultSchema,
  operation: asFace((candidate) => admitFabricationOrder(candidate)),
};

export const quoteFabricationOrderOperation = {
  name: "quoteFabricationOrder",
  description: "Quotes the price, turnaround, deliverables and acceptance assays of a fabrication kind, at its declared difficulty tier where the kind is priced by tier.",
  inputSchema: object({ kind: { enum: kindIds() }, tier: { type: "string" }, inputs: record("The order's inputs, from which a tier is read when none is given.") }, ["kind"]),
  outputSchema: resultSchema,
  operation: asFace((request) => quoteFabricationOrder(request)),
};

export const planFabricationOperation = {
  name: "planFabrication",
  description: "Plans the realization of an admitted specification: the data layer's exhaustive realization plan and the ordered steps, each naming the upstream producer service and operation that performs it.",
  inputSchema: object({ specification: record("An order admission's admitted ArtifactFabricationSpecification.") }, ["specification"]),
  outputSchema: resultSchema,
  operation: asFace(({ specification }) => planFabrication(specification)),
};

export const assayFabricatedArtifactOperation = {
  name: "assayFabricatedArtifact",
  description: "Assays a delivery against its order: addresses every output, runs the kind's acceptance assays, and issues one SignCell cell per assay and artifact (subject the artifact's ni, predicate the assay id, told for or against by the assay's evidence).",
  inputSchema: object({ admission: record("The FabricationOrderAdmission."), delivery: record("The executor's FabricationDeliveryCandidate.") }, ["admission", "delivery"]),
  outputSchema: resultSchema,
  operation: asFace((request) => assayFabricatedArtifact(request)),
};

export const receiveFabricationDeliveryOperation = {
  name: "receiveFabricationDelivery",
  description: "Receives an assayed delivery: refuses it if any assay failed, otherwise admits the realization receipt with ni-addressed outputs and the assay cells, and composes the PROV-O fragment of the fabrication.",
  inputSchema: object({ admission: record("The FabricationOrderAdmission."), delivery: record("The FabricationDeliveryCandidate."), assay: record("Its FabricationAssayResult."), receivedAt: instant }, ["admission", "delivery", "assay", "receivedAt"]),
  outputSchema: resultSchema,
  operation: asFace((request) => receiveFabricationDelivery(request)),
};

const camel = (name) => name.split("-").map((word, index) => (index === 0 ? word : word[0].toUpperCase() + word.slice(1))).join("");

/** The compact answer of a sold order: what was admitted and planned, enough to place the work and no more. */
export function orderReceipt(admission, plan) {
  return {
    type: "FabricationOrderReceipt", version: 1,
    orderId: admission.orderId, artifactId: admission.artifactId, kind: admission.kind,
    specificationDigest: admission.specification.specificationDigest, planDigest: plan.planDigest,
    quote: admission.quote,
    steps: plan.steps.map(({ ordinal, id, producer }) => ({ ordinal, id, package: producer.package, operation: producer.operation })),
    deliverables: plan.deliverables, assays: plan.assays,
  };
}

function orderFace(kind, tier) {
  return asFace((body) => {
    const profile = kindProfiles().get(kind);
    const inputs = profile.price.basis === "tier" ? { ...body.inputs, [profile.price.tierField]: tier } : body.inputs;
    const admission = admitFabricationOrder({ type: "FabricationOrderCandidate", version: 1, kind, buyer: body.buyer, inputs, ...(body.budget === undefined ? {} : { budget: body.budget }), ...(body.placedAt === undefined ? {} : { placedAt: body.placedAt }) });
    if (admission.type.endsWith("Refusal")) return admission;
    const plan = planFabrication(admission.specification);
    return plan.type.endsWith("Refusal") ? plan : orderReceipt(admission, plan);
  });
}

/** The offer to fabricate one kind (at one tier, where the kind is priced by tier): admit the order, plan it, answer the receipt. */
export function orderOperation(kind, tier) {
  const profile = kindProfiles().get(kind);
  if (profile === undefined) throw new TypeError(`unknown kind ${kind}`);
  const tiered = profile.price.basis === "tier";
  if (tiered && !Object.hasOwn(profile.price.tiers, tier ?? "")) throw new TypeError(`${kind} is priced by tier: ${Object.keys(profile.price.tiers).join(", ")}`);
  const inputSchema = tiered
    ? { ...profile.inputSchema, required: (profile.inputSchema.required ?? []).filter((key) => key !== profile.price.tierField), properties: Object.fromEntries(Object.entries(profile.inputSchema.properties).filter(([key]) => key !== profile.price.tierField)) }
    : profile.inputSchema;
  const price = tiered ? profile.price.tiers[tier] : profile.price.amount;
  return {
    name: camel(tiered ? `order-${kind}-${tier}` : `order-${kind}`),
    description: `Orders ${profile.title.toLowerCase()}${tiered ? ` at the ${tier} difficulty tier` : ""} for ${price}: admits the order, plans its fabrication from upstream producer services and answers the order receipt; delivery follows ${profile.turnaround.label}.`,
    inputSchema: object({ buyer, inputs: inputSchema, budget, placedAt: instant }, ["buyer", "inputs"]),
    outputSchema: resultSchema,
    operation: orderFace(kind, tier),
  };
}
