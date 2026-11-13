import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { validateJsonSchema } from "@red-cup-engineering/json-schema-engineering-services-section/validation";
import { admitFabricationOrder } from "../src/order.mjs";
import { kindIds, kindProfiles, loadProfiles, priceOf, profileProblems } from "../src/kinds.mjs";
import { ASSAYS } from "../src/assays.mjs";
import { EXAMPLE_INPUTS, orderOf } from "./helpers.mjs";

const KINDS = ["corpus-research-paper", "ebook", "fiction-serial", "lean-proof", "newsletter-issue", "research-paper", "research-paper-text", "svg-chart", "svg-diagram"];

test("the section ships exactly its nine kind profiles, each valid against the profile schema", () => {
  assert.deepEqual(kindIds().sort(), KINDS);
  const schema = JSON.parse(readFileSync(new URL("../content/schema/kind-profile.schema.json", import.meta.url), "utf8"));
  for (const name of readdirSync(new URL("../content/kinds/", import.meta.url))) {
    const profile = JSON.parse(readFileSync(new URL(`../content/kinds/${name}`, import.meta.url), "utf8"));
    assert.equal(validateJsonSchema(profile, schema).valid, true, name);
    assert.deepEqual(profileProblems(profile), [], name);
  }
});

test("prices are the ones the Leader set", () => {
  const prices = Object.fromEntries(kindIds().filter((kind) => kind !== "lean-proof").map((kind) => [kind, priceOf(kindProfiles().get(kind))]));
  assert.equal(prices["research-paper"], "$100.00");
  assert.equal(prices["research-paper-text"], "$50.00");
  assert.equal(prices["corpus-research-paper"], "$100.00");
  assert.equal(prices["svg-chart"], "$5.00");
  assert.equal(prices["svg-diagram"], "$10.00");
  const lean = kindProfiles().get("lean-proof");
  assert.equal(lean.price.basis, "tier");
  assert.deepEqual(Object.keys(lean.price.tiers), ["routine", "standard", "advanced"]);
  assert.equal(priceOf(lean, "advanced"), "$200.00");
  assert.equal(priceOf(lean, "nonsense"), undefined);
});

test("every profile names an input schema, producers, assays with a check, deliverables, a price and a turnaround", () => {
  for (const profile of kindProfiles().values()) {
    assert.ok(profile.inputSchema.type === "object" && profile.producers.length > 0 && profile.deliverables.length > 0, profile.kind);
    assert.ok(profile.turnaround.seconds > 0 && profile.turnaround.label, profile.kind);
    for (const assay of profile.assays) assert.equal(typeof ASSAYS[assay.id], "function", `${profile.kind}/${assay.id}`);
  }
});

test("the corpus kind offers the five house corpora and the delegated kinds name their upstream pair", () => {
  assert.deepEqual(kindProfiles().get("corpus-research-paper").inputSchema.properties.corpus.enum, ["sociology", "governance", "agentics", "philosophy", "metaphysics"]);
  assert.match(kindProfiles().get("ebook").delegate.package, /ebook-engineering-services-section/u);
  assert.match(kindProfiles().get("newsletter-issue").delegate.package, /email-newsletter-engineering-services-section/u);
  assert.match(kindProfiles().get("fiction-serial").delegate.fabricate, /fictionIssueFromEpisode/u);
});

test("each kind's example order is admitted by the data layer (version 2 specification, full traceability)", () => {
  for (const kind of kindIds()) {
    const admission = admitFabricationOrder(orderOf(kind, EXAMPLE_INPUTS[kind]));
    assert.equal(admission.type, "FabricationOrderAdmission", `${kind}: ${JSON.stringify(admission)}`);
    const spec = admission.specification;
    assert.equal(spec.version, 2);
    assert.equal(spec.projections.length, kindProfiles().get(kind).deliverables.length);
    assert.equal(spec.traceability.length, spec.requirements.length + spec.prohibitions.length);
  }
});

test("a defective profile directory is a defect, not a silent fallback", () => {
  assert.throws(() => loadProfiles(new URL("./no-such-directory/", import.meta.url)));
});
