#!/usr/bin/env node
// Writes (or with --check, compares) the `x-market` declaration of package.json from the kind profiles
// and the operation definitions: prices come from the profiles, schemas from the definitions, and each
// worked example is the operation's own answer to its example request. Nothing in x-market is authored
// a second time. Schema: x402-engineering-services-section schemas/package-market.schema.json.
import { readFileSync, writeFileSync } from "node:fs";
import { kindIds, kindProfiles } from "../src/kinds.mjs";
import {
  admitFabricationOrderOperation, orderOperation, quoteFabricationOrderOperation,
} from "../src/operations.mjs";

const PACKAGE = new URL("../package.json", import.meta.url);
const camel = (name) => name.split("-").map((word, index) => (index === 0 ? word : word[0].toUpperCase() + word.slice(1))).join("");
const PLACED = "2026-10-25T00:00:00Z";
const EXAMPLE_INPUTS = {
  "research-paper": { title: "Reproduction without Preservation", thesis: "Institutions preserved the authority to classify more reliably than the reproduction of those they classified.", license: "CC-BY-4.0" },
  "research-paper-text": { title: "A Short History of Ledgers", thesis: "Double-entry bookkeeping spread because it made trust auditable." },
  "corpus-research-paper": { title: "Rendanheyi in the Agentic Enterprise", thesis: "Micro-enterprise accounting is the coordination layer of an agentic firm.", corpus: "governance", minimumRecords: 5 },
  "lean-proof": { statement: "theorem add_comm_example (a b : Nat) : a + b = b + a", theoremName: "add_comm_example", module: "Example.AddComm", imports: ["Mathlib"] },
  "svg-chart": { spec: { $schema: "https://vega.github.io/schema/vega-lite/v5.json", data: { values: [{ a: "A", b: 3 }, { a: "B", b: 5 }] }, mark: "bar", encoding: { x: { field: "a", type: "nominal" }, y: { field: "b", type: "quantitative" } } } },
  "svg-diagram": { intent: "Show how the packages depend on each other.", source: { kind: "dependency-graph", graph: { nodes: [{ id: "a", label: "a" }, { id: "b", label: "b" }], edges: [{ from: "a", to: "b" }] } } },
  ebook: { title: "A Field Guide to Ledgers", author: "A. Author", manuscript: { locator: "https://example.org/manuscript.tar", digest: `sha256:${"0".repeat(64)}` } },
  "newsletter-issue": { title: "This Week in Ledgers", brief: "Three developments in open accounting, each with a source.", sections: 3 },
  "fiction-serial": { manifest: { canon: "the-canon", serial: "the-serial", cadence: "weekly", buttondownNewsletter: "the-serial", language: "en", script: "Latn", freeEpisodes: [1] }, storyBible: { outline: [] }, brief: "Episode one: the arrival.", episode: 1 },
};

const LEDGER = "Income:Sales:X402:Content-fabrication";
const MARKETS = ["x402-bazaar", "402index", "house-capability-market", "house-seller-catalog"];

async function offer({ definition, file, price, title, tags, example }) {
  const output = await definition.operation(example);
  return {
    operation: file, subpath: `./${file}`, export: camel(file),
    route: `/v1/${file}`, method: "POST",
    price: { amount: price },
    framings: [{ key: "default", title, description: definition.description, tags, serviceName: file }],
    ledgerAccount: LEDGER, markets: MARKETS, saleStatus: "held", seller: { enterprise: "engineering" },
    category: "content", runtime: "node",
    resources: ["CPU: admission and planning of one order; production is delegated to the agent harness"],
    metroplat: { subpath: "./metroplat-operations", export: `${camel(file)}Declaration` },
    examples: { input: example, output },
  };
}

export async function deriveXMarket() {
  const offers = [
    await offer({ definition: quoteFabricationOrderOperation, file: "quote-fabrication-order", price: "$0.01", title: "Quote a fabricated artifact", tags: ["content", "quote", "fabrication"], example: { kind: "research-paper" } }),
    await offer({ definition: admitFabricationOrderOperation, file: "admit-fabrication-order", price: "$0.05", title: "Admit a fabrication order", tags: ["content", "order", "fabrication", "specification"], example: { type: "FabricationOrderCandidate", version: 1, kind: "svg-chart", buyer: { id: "example-buyer" }, inputs: EXAMPLE_INPUTS["svg-chart"], budget: { amount: "$5.00" }, placedAt: PLACED } }),
  ];
  for (const kind of kindIds()) {
    const profile = kindProfiles().get(kind);
    const tiers = profile.price.basis === "tier" ? Object.keys(profile.price.tiers) : [undefined];
    for (const tier of tiers) {
      const definition = orderOperation(kind, tier);
      const file = tier === undefined ? `order-${kind}` : `order-${kind}-${tier}`;
      const price = tier === undefined ? profile.price.amount : profile.price.tiers[tier];
      offers.push(await offer({
        definition, file, price, title: `${profile.title}${tier ? ` (${tier})` : ""}`,
        tags: ["content", "fabrication", kind, ...(tier ? [tier] : [])],
        example: { buyer: { id: "example-buyer" }, inputs: EXAMPLE_INPUTS[kind], budget: { amount: price }, placedAt: PLACED },
      }));
    }
  }
  return { gateway: "content-fabrication", offers };
}

if (import.meta.main) {
  const derived = await deriveXMarket();
  const manifest = JSON.parse(readFileSync(PACKAGE, "utf8"));
  if (process.argv.includes("--check")) {
    const same = JSON.stringify(manifest["x-market"]) === JSON.stringify(derived);
    process.stdout.write(same ? "x-market is current\n" : "x-market drifts from the profiles and operations; run npm run derive-x-market\n");
    process.exitCode = same ? 0 : 1;
  } else {
    writeFileSync(PACKAGE, `${JSON.stringify({ ...manifest, "x-market": derived }, null, 2)}\n`);
    process.stdout.write(`wrote x-market with ${derived.offers.length} offers\n`);
  }
}
