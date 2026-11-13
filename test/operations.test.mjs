import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { validateJsonSchema } from "@red-cup-engineering/json-schema-engineering-services-section/validation";
import { schemaFrom } from "@red-cup-engineering/json-schema-engineering-services-section/contracts";
import { createJavascriptNodeOperation } from "@red-cup-engineering/javascript-node-engineering-services-section/operation";
import { deriveXMarket } from "../tools/derive-x-market.mjs";
import { declareOperations } from "../src/declare.mjs";
import { kindProfiles } from "../src/kinds.mjs";
import { EXAMPLE_INPUTS } from "./helpers.mjs";

const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const script = (name) => new URL(`../scripts/${name}.mjs`, import.meta.url).pathname;

function run(name, lines, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script(name), ...args], { stdio: ["pipe", "pipe", "pipe"] });
    let out = ""; let err = "";
    child.stdout.on("data", (chunk) => { out += chunk; }); child.stderr.on("data", (chunk) => { err += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, out, err }));
    child.stdin.end(lines.map((line) => `${JSON.stringify(line)}\n`).join(""));
  });
}

test("every operation is an NDJSON face: one request per line, one answer per line, exit 2 when any is refused", async () => {
  const { code, out } = await run("quote-fabrication-order", [{ kind: "svg-chart" }, { kind: "tapestry" }, { kind: "lean-proof", tier: "routine" }]);
  const answers = out.trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(answers.length, 3);
  assert.equal(answers[0].ok, true);
  assert.equal(answers[0].price.amount, "$5.00");
  assert.equal(answers[1].ok, false);
  assert.equal(answers[2].price.amount, "$20.00");
  assert.equal(code, 2, "an input the schema refuses makes the exit code 2");
});

test("--help prints the operation's description; a refusal is the house shape { ok: false, refusal }", async () => {
  const help = await run("admit-fabrication-order", [], ["--help"]);
  assert.match(help.out, /^admitFabricationOrder — /u);
  const refused = await run("admit-fabrication-order", [{ type: "FabricationOrderCandidate", version: 1, kind: "research-paper", buyer: { id: "b" }, inputs: { title: "T" } }]);
  const [answer] = refused.out.trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(answer.ok, false);
  assert.equal(answer.refusal.reason, "MISSING_INPUTS");
});

test("the chain runs through the faces: order, plan, and an order offer's receipt", async () => {
  const order = { type: "FabricationOrderCandidate", version: 1, kind: "svg-diagram", buyer: { id: "b" }, inputs: EXAMPLE_INPUTS["svg-diagram"], budget: { amount: "$10.00" } };
  const admitted = JSON.parse((await run("admit-fabrication-order", [order])).out);
  assert.equal(admitted.ok, true);
  const planned = JSON.parse((await run("plan-fabrication", [{ specification: admitted.specification }])).out);
  assert.equal(planned.ok, true);
  assert.equal(planned.type, "FabricationPlan");
  const sold = JSON.parse((await run("order-svg-diagram", [{ buyer: { id: "b" }, inputs: EXAMPLE_INPUTS["svg-diagram"], budget: { amount: "$10.00" } }])).out);
  assert.equal(sold.ok, true);
  assert.equal(sold.specificationDigest, admitted.specification.specificationDigest, "the sold order is the admitted order");
  assert.equal(sold.planDigest, planned.planDigest);
});

test("every bin and export names an existing script that exports the house operation definition", async () => {
  for (const [name, path] of Object.entries(manifest.bin)) {
    assert.equal(manifest.exports[`./${name}`], `./${path}`, name);
    const module = await import(new URL(`../${path}`, import.meta.url));
    assert.equal(typeof module.operation.operation, "function", name);
    assert.doesNotThrow(() => createJavascriptNodeOperation(module.operation), name);
  }
  assert.ok(readdirSync(new URL("../scripts/", import.meta.url)).length >= 16);
});

test("x-market is derived, never authored twice: it equals what the profiles and operations derive", async () => {
  assert.deepEqual(manifest["x-market"], JSON.parse(JSON.stringify(await deriveXMarket())));
});

test("offers: quote, admit and each kind's fabrication, held, priced from the profiles, sold by the engineering enterprise", () => {
  const offers = manifest["x-market"].offers;
  assert.equal(manifest["x-market"].gateway, "content-fabrication");
  const byOperation = new Map(offers.map((offer) => [offer.operation, offer]));
  assert.equal(offers.length, 13);
  for (const [operation, price] of [["order-research-paper", "$100.00"], ["order-research-paper-text", "$50.00"], ["order-corpus-research-paper", "$100.00"], ["order-svg-chart", "$5.00"], ["order-svg-diagram", "$10.00"], ["order-lean-proof-routine", "$20.00"], ["order-lean-proof-standard", "$60.00"], ["order-lean-proof-advanced", "$200.00"]]) {
    assert.equal(byOperation.get(operation).price.amount, price, operation);
  }
  assert.ok(byOperation.has("quote-fabrication-order") && byOperation.has("admit-fabrication-order"));
  for (const kind of kindProfiles().keys()) assert.ok(offers.some((offer) => offer.operation.startsWith(`order-${kind}`)), kind);
  for (const offer of offers) {
    assert.equal(offer.saleStatus, "held", offer.operation);
    assert.deepEqual(offer.seller, { enterprise: "engineering" });
    assert.match(offer.price.amount, /^\$[0-9]+\.[0-9]{2}$/u);
    assert.equal(offer.route, `/v1/${offer.operation}`);
    assert.equal(offer.subpath, `./${offer.operation}`);
    assert.ok(manifest.exports[offer.subpath], offer.operation);
    assert.match(offer.ledgerAccount, /^Income(?::[A-Z][A-Za-z0-9-]*)+$/u);
    assert.deepEqual(offer.markets, ["x402-bazaar", "402index", "house-capability-market", "house-seller-catalog"]);
  }
  const profile = kindProfiles().get("lean-proof");
  for (const tier of Object.keys(profile.price.tiers)) assert.equal(byOperation.get(`order-lean-proof-${tier}`).price.amount, profile.price.tiers[tier]);
});

test("each offer's worked example satisfies the operation's own schemas, and its output is a success", async () => {
  for (const offer of manifest["x-market"].offers) {
    const module = await import(new URL(`../scripts/${offer.operation}.mjs`, import.meta.url));
    assert.equal(validateJsonSchema(offer.examples.input, module.operation.inputSchema).valid, true, `${offer.operation} input`);
    assert.equal(validateJsonSchema(offer.examples.output, module.operation.outputSchema).valid, true, `${offer.operation} output`);
    assert.equal(offer.examples.output.ok, true, offer.operation);
    assert.equal(typeof module[offer.export], "function", `${offer.operation} exports ${offer.export}`);
    assert.deepEqual(JSON.parse(JSON.stringify(await module[offer.export](offer.examples.input))), offer.examples.output, offer.operation);
  }
});

test("MetroPlat declarations: pure, no reads or writes, schema-bound domain and codomain, one per operation", () => {
  const seen = [];
  const operationDeclaration = (spec) => { seen.push(spec); return Object.freeze({ kind: "metroplat.action", ...spec }); };
  const declared = declareOperations({ operationDeclaration, schemaFrom });
  assert.deepEqual(Object.keys(declared).sort(), Object.keys(manifest.bin).sort(), "one declaration per operation");
  for (const { operation } of manifest["x-market"].offers) assert.ok(operation in declared, `${operation} is declared`);
  for (const spec of seen) {
    assert.deepEqual(spec.reads, []);
    assert.deepEqual(spec.writes, []);
    assert.equal(spec.effects.class, "pure");
    assert.equal(spec.effects.coordination, "coordination-free");
    assert.equal(spec.domain.schema.$id.endsWith(`${spec.verb}.input.json`), true);
    assert.equal(typeof spec.run, "function");
  }
});

test("MetroPlat declarations bind to relating where it is installed, and derive no contract where it is not", async () => {
  let module;
  try { module = await import("../src/metroplat-operations.mjs"); } catch (error) { assert.match(String(error.code ?? error.message), /ERR_MODULE_NOT_FOUND|Cannot find/u); return; }
  assert.equal(module.admitFabricationOrderDeclaration.kind, "metroplat.action");
  assert.equal(module.admitFabricationOrderDeclaration.verb, "admit-fabrication-order");
});
