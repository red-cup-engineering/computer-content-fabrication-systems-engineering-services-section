/**
 * MetroPlat operation declarations for the section's operations, so their Hoare program contracts
 * derive (`deriveProgramContract` over a `metroplat.action` declaration, which the x402 market
 * deriver reads from `x-market.metroplat`). The factory takes `operationDeclaration` and `schemaFrom`
 * as arguments so the declarations can be built, and tested, wherever those packages are installed;
 * `metroplat-operations.mjs` binds them to `@red-cup-engineering/computer-engine`.
 *
 * Every operation is a pure function of its input: it reads no resource and writes none, so its
 * precondition is its input schema, its postcondition is its output schema, and its preserved frame
 * is everything else.
 */
import {
  admitFabricationOrderOperation, assayFabricatedArtifactOperation, planFabricationOperation,
  quoteFabricationOrderOperation, receiveFabricationDeliveryOperation, orderOperation,
} from "./operations.mjs";
import { kindIds, kindProfiles } from "./kinds.mjs";

const EFFECTS = Object.freeze({ class: "pure", replay: "safe", coordination: "coordination-free", deterministic: true, totality: "schema-bounded" });
const SCHEMA_BASE = "https://561.group/schema/content-fabrication/";

const withId = (schema, id) => ({ ...schema, $id: `${SCHEMA_BASE}${id}.json` });

/** All declarations by operation name (kebab). */
export function declareOperations({ operationDeclaration, schemaFrom }) {
  const definitions = [
    ["admit-fabrication-order", admitFabricationOrderOperation],
    ["quote-fabrication-order", quoteFabricationOrderOperation],
    ["plan-fabrication", planFabricationOperation],
    ["assay-fabricated-artifact", assayFabricatedArtifactOperation],
    ["receive-fabrication-delivery", receiveFabricationDeliveryOperation],
    ...kindIds().flatMap((kind) => {
      const profile = kindProfiles().get(kind);
      const tiers = profile.price.basis === "tier" ? Object.keys(profile.price.tiers) : [undefined];
      return tiers.map((tier) => [tier === undefined ? `order-${kind}` : `order-${kind}-${tier}`, orderOperation(kind, tier)]);
    }),
  ];
  return Object.freeze(Object.fromEntries(definitions.map(([verb, definition]) => [verb, operationDeclaration({
    verb,
    summary: definition.description.split(": ")[0].slice(0, 160),
    description: definition.description,
    inputFormat: "json", outputFormat: "json",
    reads: [], writes: [],
    effects: EFFECTS,
    domain: schemaFrom(withId(definition.inputSchema, `${verb}.input`)),
    codomain: schemaFrom(withId(definition.outputSchema, `${verb}.output`)),
    run: definition.operation,
  })])));
}
