/**
 * Kind profiles: the data in `content/kinds/*.json`, validated against
 * `content/schema/kind-profile.schema.json` and cross-checked once, at load. Operations read
 * profiles through this module; no operation names a kind in code except to bind that kind's assays.
 */
import { readFileSync, readdirSync } from "node:fs";
import { firstBareNumber } from "@red-cup-engineering/computer-data-engineering-services-section/artifact-fabrication";
import { validateJsonSchema } from "@red-cup-engineering/json-schema-engineering-services-section/validation";
import { centsOf } from "./money.mjs";
import { deepFreeze } from "./refusal.mjs";

const KINDS_DIRECTORY = new URL("../content/kinds/", import.meta.url);
const PROFILE_SCHEMA = JSON.parse(readFileSync(new URL("../content/schema/kind-profile.schema.json", import.meta.url), "utf8"));

/** Structural cross-checks the JSON Schema cannot state: a profile that fails any of them is a defect in the data. */
export function profileProblems(profile) {
  const problems = [];
  const producers = new Set(profile.producers.map(({ id }) => id));
  const stepIds = new Set();
  for (const step of profile.steps) {
    if (stepIds.has(step.id)) problems.push(`step ${step.id} repeats`);
    stepIds.add(step.id);
    if (!producers.has(step.producer)) problems.push(`step ${step.id} names unknown producer ${step.producer}`);
  }
  for (const step of profile.steps) for (const dependency of step.dependsOn) if (!stepIds.has(dependency)) problems.push(`step ${step.id} depends on unknown step ${dependency}`);
  const produced = new Set(profile.steps.flatMap(({ produces }) => produces));
  const projections = new Set(profile.deliverables.map(({ projection }) => projection));
  for (const projection of projections) if (!produced.has(projection)) problems.push(`no step produces deliverable ${projection}`);
  const assays = new Set(profile.assays.map(({ id }) => id));
  if (assays.size !== profile.assays.length) problems.push("assay ids repeat");
  if (projections.size !== profile.deliverables.length) problems.push("deliverable projections repeat");
  const constraints = new Set(profile.constraints.map(({ id }) => id));
  if (!profile.constraints.some(({ kind }) => kind === "law") || !profile.constraints.some(({ kind }) => kind === "standard")) problems.push("constraints need at least one law and one standard");
  const clauses = [...profile.requirements, ...profile.prohibitions];
  const covered = { projections: new Set(), assays: new Set() };
  for (const clause of clauses) {
    for (const id of clause.constraints) if (!constraints.has(id)) problems.push(`clause ${clause.id} names unknown constraint ${id}`);
    for (const id of clause.projections) { if (!projections.has(id)) problems.push(`clause ${clause.id} names unknown projection ${id}`); covered.projections.add(id); }
    for (const id of clause.acceptance) { if (!assays.has(id)) problems.push(`clause ${clause.id} names unknown assay ${id}`); covered.assays.add(id); }
  }
  for (const id of projections) if (!covered.projections.has(id)) problems.push(`deliverable ${id} is traced by no clause`);
  for (const id of assays) if (!covered.assays.has(id)) problems.push(`assay ${id} is traced by no clause`);
  // The data layer refuses a bare number in a requirement, prohibition or acceptance statement; find it at load.
  for (const item of [...profile.requirements, ...profile.prohibitions, ...profile.assays]) {
    const literal = firstBareNumber(item.statement);
    if (literal !== null && !/\{\{[^{}]*\}\}/u.test(item.statement)) problems.push(`${item.id} carries the bare number ${literal}`);
  }
  // The steps form a DAG.
  const visiting = new Set(); const done = new Set();
  const byId = new Map(profile.steps.map((step) => [step.id, step]));
  const visit = (id) => {
    if (done.has(id)) return;
    if (visiting.has(id)) { problems.push(`steps cycle through ${id}`); return; }
    visiting.add(id);
    for (const dependency of byId.get(id)?.dependsOn ?? []) visit(dependency);
    visiting.delete(id); done.add(id);
  };
  for (const id of stepIds) visit(id);
  if (profile.price.basis === "tier") {
    for (const tier of Object.keys(profile.price.tiers)) {
      centsOf(profile.price.tiers[tier]);
      if (profile.turnaround.tiers?.[tier] === undefined) problems.push(`tier ${tier} has no turnaround`);
    }
    if (profile.inputSchema.properties?.[profile.price.tierField] === undefined) problems.push(`input schema lacks tier field ${profile.price.tierField}`);
  }
  return problems;
}

/** Load and validate every profile in a directory; throws on a defective profile (a defect in data, not a refusal). */
export function loadProfiles(directory = KINDS_DIRECTORY) {
  const profiles = new Map();
  for (const name of readdirSync(directory).filter((entry) => entry.endsWith(".json")).sort()) {
    const profile = JSON.parse(readFileSync(new URL(name, directory), "utf8"));
    const verdict = validateJsonSchema(profile, PROFILE_SCHEMA);
    if (!verdict.valid) throw new TypeError(`${name}: ${verdict.issues.slice(0, 3).map((issue) => `${issue.path || "/"} ${issue.message}`).join("; ")}`);
    if (`${profile.kind}.json` !== name) throw new TypeError(`${name}: kind ${profile.kind} must name its file`);
    const problems = profileProblems(profile);
    if (problems.length > 0) throw new TypeError(`${name}: ${problems.join("; ")}`);
    profiles.set(profile.kind, deepFreeze(profile));
  }
  return profiles;
}

let loaded;
/** The section's profiles, loaded once. */
export function kindProfiles() {
  loaded ??= loadProfiles();
  return loaded;
}

export const kindIds = () => [...kindProfiles().keys()];

/** The price of a profile for a tier (fixed-price kinds ignore the tier); undefined when the tier is required and unknown. */
export function priceOf(profile, tier) {
  if (profile.price.basis === "fixed") return profile.price.amount;
  return Object.hasOwn(profile.price.tiers, tier ?? "") ? profile.price.tiers[tier] : undefined;
}

export function turnaroundOf(profile, tier) {
  if (profile.price.basis === "fixed") return profile.turnaround.seconds;
  return profile.turnaround.tiers?.[tier];
}
