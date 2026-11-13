/**
 * Orders and quotes. A buyer's order becomes an admitted ArtifactFabricationSpecification (the data
 * layer's record, not a parallel one); a quote is the profile's price and turnaround.
 *
 * Two input forms reach `admitFabricationOrder`: the native `FabricationOrderCandidate`, and the
 * same candidate carrying the curiosity research market's admitted `ResearchAssignmentAdmission`
 * (curiosity-research-market-service), whose question, budget, delivery date and acceptance terms
 * become the order's thesis, budget, turnaround bound and an added requirement. The market's own
 * identity check (its content id) is the market's act, made when it admitted the assignment; this
 * module reads the admitted record and keeps its id as the order's market reference.
 */
import { admitArtifactFabricationSpecification } from "@red-cup-engineering/computer-data-engineering-services-section/artifact-fabrication";
import { validateJsonSchema } from "@red-cup-engineering/json-schema-engineering-services-section/validation";
import { semanticId } from "@red-cup-engineering/computer-content-address-engineering-services-section/semiotic-content-address";
import { kindIds, kindProfiles, priceOf, turnaroundOf } from "./kinds.mjs";
import { centsOf, centsOfMicros } from "./money.mjs";
import { deepFreeze, refuse, refusing } from "./refusal.mjs";
import { orderDocument, sourceBindingProblems, specificationCandidate } from "./specify.mjs";

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const singleLine = (value) => typeof value === "string" && value.trim() !== "" && !/[\r\n]/u.test(value);
const ORDER_KEYS = ["type", "version", "kind", "buyer", "inputs", "budget", "placedAt", "assignmentAdmission"];
const ASSIGNMENT_KINDS = new Set(["research-paper", "research-paper-text", "corpus-research-paper"]);

function exactKeys(value, allowed, required, path) {
  if (!isRecord(value)) refuse("INVALID_ORDER", `${path} must be a JSON object`, path);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) refuse("UNEXPECTED_FIELD", `${path} carries unexpected field ${key}`, `${path}.${key}`);
  for (const key of required) if (!(key in value)) refuse("INVALID_ORDER", `${path} must carry ${key}`, `${path}.${key}`);
}

function profileOf(kind, profiles) {
  const profile = typeof kind === "string" ? profiles.get(kind) : undefined;
  if (profile === undefined) refuse("UNKNOWN_KIND", `unknown fabrication kind ${JSON.stringify(kind)}`, "kind", { known: [...profiles.keys()] });
  return profile;
}

/** The inputs against the profile's schema: missing required inputs are their own refusal. */
function checkInputs(profile, inputs) {
  if (!isRecord(inputs)) refuse("MISSING_INPUTS", "inputs must be a JSON object", "inputs", { missing: profile.inputSchema.required ?? [] });
  const missing = (profile.inputSchema.required ?? []).filter((key) => !(key in inputs));
  const alternatives = profile.inputSchema.anyOf;
  if (missing.length === 0 && alternatives !== undefined && !alternatives.some((branch) => branch.required.every((key) => key in inputs))) {
    refuse("MISSING_INPUTS", `inputs must supply one of: ${alternatives.map((branch) => branch.required.join(" + ")).join(" | ")}`, "inputs", { oneOf: alternatives.map((branch) => branch.required) });
  }
  if (missing.length > 0) refuse("MISSING_INPUTS", `${profile.kind} needs inputs: ${missing.join(", ")}`, "inputs", { missing });
  const verdict = validateJsonSchema(inputs, profile.inputSchema);
  if (!verdict.valid) refuse("INVALID_INPUTS", `inputs do not satisfy the ${profile.kind} input schema: ${verdict.issues.slice(0, 3).map((issue) => `${issue.path || "/"} ${issue.message}`).join("; ")}`, "inputs");
}

function budgetCents(budget) {
  if (budget === undefined) return undefined;
  if (!isRecord(budget)) refuse("INVALID_BUDGET", "budget must be a JSON object", "budget");
  if (typeof budget.amount === "string") {
    try { return centsOf(budget.amount); } catch { refuse("INVALID_BUDGET", "budget.amount must be a dollar amount such as $100.00", "budget.amount"); }
  }
  if (budget.accountingUnit === "USD-micros" && Number.isSafeInteger(budget.maxPriceMicros) && budget.maxPriceMicros > 0) return centsOfMicros(budget.maxPriceMicros);
  return refuse("INVALID_BUDGET", "budget must carry amount ($D.CC) or maxPriceMicros in USD-micros", "budget");
}

/** The quote of a profile at a tier: a pure function of the profile. */
export function quoteOf(profile, tier) {
  const amount = priceOf(profile, tier);
  if (amount === undefined) {
    refuse(tier === undefined ? "MISSING_TIER" : "UNKNOWN_TIER", `${profile.kind} is priced by ${profile.price.tierField}: one of ${Object.keys(profile.price.tiers).join(", ")}`, profile.price.tierField, { tiers: Object.keys(profile.price.tiers) });
  }
  return deepFreeze({
    type: "FabricationQuote", version: 1, kind: profile.kind,
    ...(profile.price.basis === "tier" ? { tier } : {}),
    price: { currency: "USD", amount, cents: centsOf(amount) },
    turnaround: { seconds: turnaroundOf(profile, tier), label: profile.turnaround.label },
    deliverables: profile.deliverables.map(({ projection, mediaType }) => ({ projection, mediaType })),
    assays: profile.assays.map(({ id }) => id),
  });
}

/**
 * Quote an order: the price and turnaround of a kind, at its tier where the kind is priced by tier.
 * Refusals: UNKNOWN_KIND, MISSING_TIER, UNKNOWN_TIER, INVALID_QUOTE_REQUEST.
 * @param {{ kind: string, tier?: string, inputs?: object }} request
 */
export function quoteFabricationOrder(request, { profiles = kindProfiles() } = {}) {
  return refusing("FabricationQuoteRefusal", () => {
    exactKeys(request, ["kind", "tier", "inputs"], ["kind"], "request");
    const profile = profileOf(request.kind, profiles);
    const tier = request.tier ?? (profile.price.basis === "tier" ? request.inputs?.[profile.price.tierField] : undefined);
    return quoteOf(profile, tier);
  });
}

/** The order an assignment admission states, merged over the candidate's own inputs; and the clause that carries its terms. */
function fromAssignment(candidate, profile) {
  const admission = candidate.assignmentAdmission;
  if (!ASSIGNMENT_KINDS.has(profile.kind)) refuse("ASSIGNMENT_KIND_MISMATCH", `a research assignment admission orders a research paper kind, not ${profile.kind}`, "kind");
  if (!isRecord(admission) || admission.type !== "ResearchAssignmentAdmission" || typeof admission.id !== "string" || !singleLine(admission.buyer) || !singleLine(admission.question)) {
    refuse("INVALID_ASSIGNMENT", "assignmentAdmission must be the market's admitted ResearchAssignmentAdmission", "assignmentAdmission");
  }
  if (admission.accountingUnit !== "USD-micros" || !Number.isSafeInteger(admission.maxPriceMicros) || admission.maxPriceMicros <= 0) refuse("INVALID_ASSIGNMENT", "the assignment's budget must be a positive integer in USD-micros", "assignmentAdmission.maxPriceMicros");
  if (candidate.buyer !== undefined && candidate.buyer.id !== admission.buyer) refuse("ASSIGNMENT_BUYER_MISMATCH", "the order's buyer must be the assignment's buyer", "buyer.id");
  const deliveryBy = Date.parse(admission.deliveryBy);
  if (!Number.isFinite(deliveryBy)) refuse("INVALID_ASSIGNMENT", "the assignment must carry a deliveryBy instant", "assignmentAdmission.deliveryBy");
  const terms = admission.acceptance ?? {};
  if (!Number.isSafeInteger(terms.minimumSources) || terms.minimumSources < 1) refuse("INVALID_ASSIGNMENT", "the assignment's acceptance must state a positive integer minimumSources", "assignmentAdmission.acceptance.minimumSources");
  const gating = profile.assays.find(({ id }) => id === "references-resolve") ?? profile.assays[0];
  // The only number the terms add is the source count: a parameter referencing a claim measured from the admitted assignment.
  const claim = {
    type: "ArtifactFabricationClaim", version: 1, id: "assignment-minimum-sources", kind: "parameter",
    statement: "The admitted research assignment states its minimum source count.", status: "measured",
    quantity: { type: "ArtifactFabricationQuantity", value: terms.minimumSources, unit: "sources" },
    basis: { type: "ArtifactFabricationMeasuredBasis", locator: `market:${admission.id}`, digest: semanticId(admission), derivation: "Read from acceptance.minimumSources of the admitted ResearchAssignmentAdmission." },
  };
  const clause = {
    id: "assignment-terms",
    statement: "Meet the research assignment terms: cite at least {{minimum-sources}} distinct sources, warrant each claim, state uncertainty and carry a correction identity.",
    parameters: [{ type: "ArtifactFabricationParameter", version: 1, name: "minimum-sources", value: terms.minimumSources, unit: "sources", claimId: claim.id, exact: null }],
    claimIds: [claim.id],
    constraints: [profile.constraints[0].id],
    projections: [profile.deliverables[0].projection],
    acceptance: [gating.id],
  };
  return {
    inputs: { ...candidate.inputs, thesis: candidate.inputs?.thesis ?? admission.question },
    budget: { maxPriceMicros: admission.maxPriceMicros, accountingUnit: "USD-micros" },
    buyer: { id: admission.buyer },
    market: { protocol: "curiosity-research-market", assignmentAdmission: admission.id, deliveryBy: admission.deliveryBy },
    deliveryBy, clause, claim,
  };
}

/**
 * Admit a buyer's order as an ArtifactFabricationSpecification bound to the order document.
 * Refusals: INVALID_ORDER, UNEXPECTED_FIELD, UNKNOWN_KIND, MISSING_INPUTS, INVALID_INPUTS, MISSING_TIER,
 * UNKNOWN_TIER, INVALID_BUDGET, OVER_BUDGET, ASSIGNMENT_KIND_MISMATCH, INVALID_ASSIGNMENT,
 * ASSIGNMENT_BUYER_MISMATCH, TURNAROUND_EXCEEDS_DELIVERY_BY, SPECIFICATION_REFUSED (with the data layer's refusal as detail).
 * @param {object} candidate a FabricationOrderCandidate
 * @param {{ profiles?: Map<string, object>, now?: string }} [options] `now` bounds a delivery date; the operation reads no clock
 */
export function admitFabricationOrder(candidate, { profiles = kindProfiles(), now } = {}) {
  return refusing("FabricationOrderRefusal", () => {
    exactKeys(candidate, ORDER_KEYS, ["type", "version", "kind"], "candidate");
    if (candidate.type !== "FabricationOrderCandidate" || candidate.version !== 1) refuse("INVALID_ORDER", "candidate must be FabricationOrderCandidate@1", "candidate");
    const profile = profileOf(candidate.kind, profiles);
    const placed = candidate.placedAt ?? now;
    if (candidate.placedAt !== undefined && !Number.isFinite(Date.parse(candidate.placedAt))) refuse("INVALID_ORDER", "placedAt must be an instant", "placedAt");
    let { inputs, buyer, budget } = candidate;
    let market; let extra = { requirements: [], claims: [] };
    if (candidate.assignmentAdmission !== undefined) {
      const assigned = fromAssignment(candidate, profile);
      ({ inputs, buyer, budget, market } = assigned);
      extra = { requirements: [assigned.clause], claims: [assigned.claim] };
      if (placed !== undefined) {
        const tier = inputs[profile.price.tierField];
        const deadline = Date.parse(placed) + turnaroundOf(profile, tier) * 1000;
        if (deadline > assigned.deliveryBy) refuse("TURNAROUND_EXCEEDS_DELIVERY_BY", `${profile.kind} turns around in ${turnaroundOf(profile, tier)}s, past the assignment's deliveryBy ${market.deliveryBy}`, "assignmentAdmission.deliveryBy");
      }
    }
    if (!isRecord(buyer) || !singleLine(buyer.id)) refuse("INVALID_ORDER", "buyer.id must be nonempty single-line text", "buyer.id");
    checkInputs(profile, inputs);
    const tier = profile.price.basis === "tier" ? inputs[profile.price.tierField] : undefined;
    const quote = quoteOf(profile, tier);
    const limit = budgetCents(budget);
    if (limit !== undefined && limit < quote.price.cents) refuse("OVER_BUDGET", `the ${profile.kind} quote ${quote.price.amount} exceeds the buyer's budget`, "budget", { quoted: quote.price.amount, budgetCents: limit });
    const order = {
      type: "FabricationOrder", version: 1, kind: profile.kind, buyer: { id: buyer.id }, inputs,
      ...(budget === undefined ? {} : { budget }), ...(placed === undefined ? {} : { placedAt: placed }), ...(market === undefined ? {} : { market }),
    };
    const text = orderDocument(order);
    const bytes = new TextEncoder().encode(text);
    const specification = admitArtifactFabricationSpecification(specificationCandidate(profile, order, text, extra));
    if (specification.type === "ArtifactFabricationSpecificationRefusal") refuse("SPECIFICATION_REFUSED", `the data layer refused the specification: ${specification.message}`, specification.path, specification);
    const unbound = sourceBindingProblems(specification, bytes);
    if (unbound.length > 0) refuse("SPECIFICATION_REFUSED", unbound.join("; "), "source");
    return deepFreeze({
      type: "FabricationOrderAdmission", version: 1,
      orderId: semanticId(order), artifactId: specification.artifact.id, kind: profile.kind,
      order, orderDocument: text, quote, specification,
    });
  });
}

export const knownKinds = () => kindIds();
