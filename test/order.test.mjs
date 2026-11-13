import assert from "node:assert/strict";
import { test } from "node:test";
import { admitFabricationOrder, quoteFabricationOrder } from "../src/order.mjs";
import { planFabrication } from "../src/plan.mjs";
import { EXAMPLE_INPUTS, admitted, orderOf, planned } from "./helpers.mjs";

const code = (record) => record.code;

test("quote: price, turnaround, deliverables and assays come from the profile", () => {
  const quote = quoteFabricationOrder({ kind: "research-paper" });
  assert.equal(quote.type, "FabricationQuote");
  assert.deepEqual(quote.price, { currency: "USD", amount: "$100.00", cents: 10000 });
  assert.equal(quote.turnaround.seconds, 259200);
  assert.deepEqual(quote.deliverables.map(({ projection }) => projection), ["pdf", "html", "docx", "jats", "claims", "provenance"]);
});

test("quote: the lean tier sets price and turnaround; a missing or unknown tier is refused", () => {
  assert.equal(quoteFabricationOrder({ kind: "lean-proof", tier: "routine" }).price.amount, "$20.00");
  assert.equal(quoteFabricationOrder({ kind: "lean-proof", tier: "advanced" }).turnaround.seconds, 259200);
  assert.equal(quoteFabricationOrder({ kind: "lean-proof", inputs: { tier: "standard" } }).price.amount, "$60.00");
  assert.equal(code(quoteFabricationOrder({ kind: "lean-proof" })), "MISSING_TIER");
  assert.equal(code(quoteFabricationOrder({ kind: "lean-proof", tier: "heroic" })), "UNKNOWN_TIER");
  assert.equal(code(quoteFabricationOrder({ kind: "no-such-kind" })), "UNKNOWN_KIND");
  assert.equal(code(quoteFabricationOrder({ kind: "svg-chart", surprise: 1 })), "UNEXPECTED_FIELD");
});

test("admit: a valid order is the data layer's specification, bound to the order document", () => {
  const admission = admitted("research-paper", { title: "T", thesis: "Why" }, { budget: { amount: "$100.00" } });
  assert.match(admission.artifactId, /^research-paper-[a-f0-9]{16}$/u);
  assert.equal(admission.specification.type, "ArtifactFabricationSpecification");
  assert.equal(admission.specification.source.provenance.digest.startsWith("sha256:"), true);
  assert.equal(admission.quote.price.amount, "$100.00");
  // equal orders are one order
  assert.equal(admitted("research-paper", { thesis: "Why", title: "T" }, { budget: { amount: "$100.00" } }).orderId, admission.orderId);
  assert.notEqual(admitted("research-paper", { title: "T2", thesis: "Why" }).orderId, admission.orderId);
});

test("admit: refusals - unknown kind, missing inputs, invalid inputs, over budget", () => {
  assert.equal(code(admitFabricationOrder(orderOf("tapestry", {}))), "UNKNOWN_KIND");
  const missing = admitFabricationOrder(orderOf("research-paper", { title: "T" }));
  assert.equal(code(missing), "MISSING_INPUTS");
  assert.deepEqual(missing.detail.missing, ["thesis"]);
  assert.equal(code(admitFabricationOrder(orderOf("svg-chart", {}))), "MISSING_INPUTS");
  assert.equal(code(admitFabricationOrder(orderOf("svg-chart", { data: [{ a: 1 }] }))), "MISSING_INPUTS");
  assert.equal(code(admitFabricationOrder(orderOf("research-paper", { title: 7, thesis: "x" }))), "INVALID_INPUTS");
  assert.equal(code(admitFabricationOrder(orderOf("corpus-research-paper", { title: "T", thesis: "x", corpus: "astrology" }))), "INVALID_INPUTS");
  const over = admitFabricationOrder(orderOf("research-paper", { title: "T", thesis: "x" }, { budget: { amount: "$99.99" } }));
  assert.equal(code(over), "OVER_BUDGET");
  assert.equal(over.detail.quoted, "$100.00");
  assert.equal(code(admitFabricationOrder(orderOf("research-paper", { title: "T", thesis: "x" }, { budget: { maxPriceMicros: 99_990_000, accountingUnit: "USD-micros" } }))), "OVER_BUDGET");
  assert.equal(admitFabricationOrder(orderOf("research-paper", { title: "T", thesis: "x" }, { budget: { maxPriceMicros: 100_000_000, accountingUnit: "USD-micros" } })).type, "FabricationOrderAdmission");
  assert.equal(code(admitFabricationOrder(orderOf("research-paper", { title: "T", thesis: "x" }, { budget: { amount: "lots" } }))), "INVALID_BUDGET");
  assert.equal(code(admitFabricationOrder({ ...orderOf("svg-chart", EXAMPLE_INPUTS["svg-chart"]), extra: true })), "UNEXPECTED_FIELD");
  assert.equal(code(admitFabricationOrder({ ...orderOf("svg-chart", EXAMPLE_INPUTS["svg-chart"]), version: 2 })), "INVALID_ORDER");
  assert.equal(code(admitFabricationOrder(orderOf("svg-chart", EXAMPLE_INPUTS["svg-chart"], { buyer: { id: "two\nlines" } }))), "INVALID_ORDER");
});

test("admit: a tiered kind needs a tier among the profile's, and the tier prices the order", () => {
  const { tier: _omitted, ...untiered } = EXAMPLE_INPUTS["lean-proof"];
  assert.equal(code(admitFabricationOrder(orderOf("lean-proof", untiered))), "MISSING_INPUTS");
  assert.equal(code(admitFabricationOrder(orderOf("lean-proof", { ...EXAMPLE_INPUTS["lean-proof"], tier: "heroic" }))), "INVALID_INPUTS");
  assert.equal(admitted("lean-proof", { ...EXAMPLE_INPUTS["lean-proof"], tier: "standard" }).quote.price.amount, "$60.00");
  assert.equal(code(admitFabricationOrder(orderOf("lean-proof", { ...EXAMPLE_INPUTS["lean-proof"], tier: "advanced" }, { budget: { amount: "$60.00" } }))), "OVER_BUDGET");
});

const assignment = (extra = {}) => ({
  id: "urn:sha256:" + "a".repeat(64), type: "ResearchAssignmentAdmission", market: "urn:ame:curiosity-research-market-enterprise", buyer: "urn:ame:buyer",
  question: "How did institutions treat the reproduction of the classified?", maxPriceMicros: 100_000_000, accountingUnit: "USD-micros",
  intendedUses: ["analysis"], permittedBuyers: ["urn:ame:buyer"], acceptance: { minimumSources: 3, claimWarrants: true, uncertainty: true, correctionIdentity: true, requiredReuseRights: ["analysis"] },
  deliveryBy: "2026-11-30T00:00:00Z", motivatingCandidates: [], ...extra,
});

test("admit: the curiosity research market's assignment admission is an input form", () => {
  const admission = admitFabricationOrder({ type: "FabricationOrderCandidate", version: 1, kind: "research-paper", inputs: { title: "T" }, assignmentAdmission: assignment(), placedAt: "2026-10-25T00:00:00Z" });
  assert.equal(admission.type, "FabricationOrderAdmission", JSON.stringify(admission));
  assert.equal(admission.order.inputs.thesis, "How did institutions treat the reproduction of the classified?");
  assert.equal(admission.order.buyer.id, "urn:ame:buyer");
  assert.equal(admission.order.market.protocol, "curiosity-research-market");
  const claim = admission.specification.claims.find(({ id }) => id === "assignment-minimum-sources");
  assert.equal(claim.status, "measured");
  assert.equal(claim.quantity.value, 3);
  const terms = admission.specification.requirements.find(({ id }) => id === "assignment-terms");
  assert.deepEqual(terms.parameters.map(({ name, value }) => [name, value]), [["minimum-sources", 3]]);
  assert.equal(terms.statement.includes("{{minimum-sources}}"), true);
});

test("admit: an assignment is refused when it cannot be met", () => {
  const base = { type: "FabricationOrderCandidate", version: 1, kind: "research-paper", inputs: { title: "T" }, placedAt: "2026-10-25T00:00:00Z" };
  assert.equal(code(admitFabricationOrder({ ...base, assignmentAdmission: assignment({ maxPriceMicros: 50_000_000 }) })), "OVER_BUDGET");
  assert.equal(code(admitFabricationOrder({ ...base, assignmentAdmission: assignment({ deliveryBy: "2026-10-26T00:00:00Z" }) })), "TURNAROUND_EXCEEDS_DELIVERY_BY");
  assert.equal(code(admitFabricationOrder({ ...base, kind: "svg-chart", inputs: EXAMPLE_INPUTS["svg-chart"], assignmentAdmission: assignment() })), "ASSIGNMENT_KIND_MISMATCH");
  assert.equal(code(admitFabricationOrder({ ...base, assignmentAdmission: { ...assignment(), type: "ResearchAssignment" } })), "INVALID_ASSIGNMENT");
  assert.equal(code(admitFabricationOrder({ ...base, assignmentAdmission: assignment({ acceptance: { minimumSources: 0 } }) })), "INVALID_ASSIGNMENT");
  assert.equal(code(admitFabricationOrder({ ...base, buyer: { id: "someone-else" }, assignmentAdmission: assignment() })), "ASSIGNMENT_BUYER_MISMATCH");
});

test("plan: ordered steps name the upstream producer per step; every deliverable is produced after its inputs", () => {
  const plan = planned(admitted("research-paper", EXAMPLE_INPUTS["research-paper"]));
  const names = plan.steps.map(({ producer }) => producer.package);
  for (const expected of ["research-claim-reproduction-service", "chart-specification-rendering-service", "project-document-through-pandoc-service", "research-release-metadata-service", "csl-yaml-services-section", "rdf-vocabulary-conformance-service", "prov-o-provenance-service"]) {
    assert.ok(names.some((name) => name.endsWith(expected)), expected);
  }
  const position = new Map(plan.steps.map(({ id, ordinal }) => [id, ordinal]));
  for (const step of plan.steps) for (const dependency of step.dependsOn) assert.ok(position.get(dependency) < step.ordinal, `${dependency} before ${step.id}`);
  assert.deepEqual(plan.agentSteps, ["author-manuscript"]);
  assert.equal(plan.realizationPlan.type, "ArtifactFabricationRealizationPlan");
  assert.deepEqual(plan.realizationPlan.projectionIds, ["claims", "docx", "html", "jats", "pdf", "provenance"]);
  assert.equal(plan.planDigest, planned(admitted("research-paper", EXAMPLE_INPUTS["research-paper"])).planDigest);
});

test("plan: the corpus kind reads CAIRN first; the delegated kinds name their upstream packages", () => {
  assert.equal(planned(admitted("corpus-research-paper", EXAMPLE_INPUTS["corpus-research-paper"])).steps[0].producer.package, "@red-cup-engineering/cairn");
  assert.ok(planned(admitted("ebook", EXAMPLE_INPUTS.ebook)).steps.some(({ producer }) => producer.package.endsWith("ebook-engineering-services-section")));
  assert.ok(planned(admitted("fiction-serial", EXAMPLE_INPUTS["fiction-serial"])).steps.some(({ producer }) => producer.package.endsWith("email-newsletter-engineering-services-section")));
});

test("plan: refuses what is not an admitted specification, an unknown kind, or a specification that drifts from its profile", () => {
  assert.equal(code(planFabrication({})), "INVALID_SPECIFICATION");
  const { specification } = admitted("svg-chart", EXAMPLE_INPUTS["svg-chart"]);
  assert.equal(code(planFabrication({ ...specification, artifact: { ...specification.artifact, kind: "tapestry" } })), "UNKNOWN_KIND");
  assert.equal(code(planFabrication({ ...specification, projections: specification.projections.slice(1) })), "PROFILE_DRIFT");
});
