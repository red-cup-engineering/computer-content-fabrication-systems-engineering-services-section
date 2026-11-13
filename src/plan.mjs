/**
 * `planFabrication`: an admitted ArtifactFabricationSpecification to its realization plan. The data
 * layer's ArtifactFabricationRealizationPlan (exhaustive coverage of the specification's projections
 * and acceptance obligations) is admitted by the data layer; the plan adds what only the section
 * knows: the ordered steps, each naming the upstream producer service and operation that performs it.
 */
import { admitArtifactFabricationRealizationPlan } from "@red-cup-engineering/computer-data-engineering-services-section/artifact-fabrication";
import { semanticId } from "@red-cup-engineering/computer-content-address-engineering-services-section/semiotic-content-address-system";
import { kindProfiles } from "./kinds.mjs";
import { deepFreeze, refuse, refusing } from "./refusal.mjs";

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/** Stable topological order: a step follows every step it depends on; ties keep the profile's order. */
export function orderSteps(steps) {
  const placed = new Set(); const ordered = [];
  const remaining = [...steps];
  while (remaining.length > 0) {
    const index = remaining.findIndex((step) => step.dependsOn.every((id) => placed.has(id)));
    if (index === -1) refuse("CYCLIC_STEPS", "the profile's steps depend on each other in a cycle", "steps");
    const [step] = remaining.splice(index, 1);
    placed.add(step.id); ordered.push(step);
  }
  return ordered;
}

/**
 * @param {object} specification an admitted ArtifactFabricationSpecification (an order admission's `specification`)
 * @param {{ profiles?: Map<string, object> }} [options]
 * Refusals: INVALID_SPECIFICATION, UNKNOWN_KIND, PROFILE_DRIFT, CYCLIC_STEPS, PLAN_REFUSED.
 */
export function planFabrication(specification, { profiles = kindProfiles() } = {}) {
  return refusing("FabricationPlanRefusal", () => {
    if (!isRecord(specification) || specification.type !== "ArtifactFabricationSpecification" || typeof specification.specificationDigest !== "string") refuse("INVALID_SPECIFICATION", "specification must be an admitted ArtifactFabricationSpecification", "specification");
    const profile = profiles.get(specification.artifact.kind);
    if (profile === undefined) refuse("UNKNOWN_KIND", `no profile for the kind ${JSON.stringify(specification.artifact.kind)}`, "specification.artifact.kind");
    const same = (left, right) => left.length === right.length && [...left].sort().every((id, index) => id === [...right].sort()[index]);
    if (!same(specification.projections.map(({ id }) => id), profile.deliverables.map(({ projection }) => projection)) || !same(specification.acceptanceObligations.map(({ id }) => id), profile.assays.map(({ id }) => id))) {
      refuse("PROFILE_DRIFT", `the specification's projections or acceptance obligations are not the ${profile.kind} profile's`, "specification");
    }
    const realizationPlan = admitArtifactFabricationRealizationPlan(specification, {
      type: "ArtifactFabricationRealizationPlanCandidate", version: 1,
      artifactId: specification.artifact.id, specificationDigest: specification.specificationDigest,
      projectionIds: specification.projections.map(({ id }) => id),
      acceptanceObligationIds: specification.acceptanceObligations.map(({ id }) => id),
    });
    if (realizationPlan.type === "ArtifactFabricationRealizationPlanRefusal") refuse("PLAN_REFUSED", `the data layer refused the realization plan: ${realizationPlan.message}`, realizationPlan.path, realizationPlan);
    const producers = new Map(profile.producers.map((producer) => [producer.id, producer]));
    const steps = orderSteps(profile.steps).map((step, ordinal) => {
      const { id, package: packageName, operation, role, source } = producers.get(step.producer);
      return { ordinal: ordinal + 1, id: step.id, producer: { id, package: packageName, operation, role, source }, summary: step.summary, consumes: [...step.consumes], produces: [...step.produces], dependsOn: [...step.dependsOn] };
    });
    const body = {
      type: "FabricationPlan", version: 1, artifactId: specification.artifact.id, kind: profile.kind,
      specificationDigest: specification.specificationDigest, realizationPlan, steps,
      agentSteps: steps.filter(({ producer }) => producer.source === "agent-harness").map(({ id }) => id),
      deliverables: profile.deliverables.map(({ projection, mediaType, target }) => ({ projection, mediaType, target })),
      assays: profile.assays.map(({ id }) => id),
    };
    return deepFreeze({ ...body, planDigest: semanticId(JSON.parse(JSON.stringify(body))) });
  });
}
