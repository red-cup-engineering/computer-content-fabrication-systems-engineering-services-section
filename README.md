# @red-cup-engineering/computer-content-fabrication-systems-engineering-services-section

The commerce-and-acceptance layer of on-demand content fabrication: kind profiles, order admission, quotes, realization plans, per-kind assays that issue SignCell acceptance cells, and realization receipts. Execution is delegated through a port to the agent harness; production is composed from upstream house services.

The commerce-and-acceptance layer of on-demand content: a buyer activates a need, the section admits the order, quotes it, plans its fabrication from upstream house services, assays what an executor delivers, and receives it only if every assay held. It produces nothing itself. Production is the agent-harness carrier's; the pieces of a paper, a chart or a proof are the upstream producer services'. What this section owns is the order, the plan, the acceptance and the record.

Its assay computation sits downstream of SignCraft: each explicitly sided witness is settled and read through SignCraft's existing membrane and settlement APIs. Every delivered artifact is named by its RFC 6920 `ni` name (`addressContent` for bytes, `semanticId` for JSON), and every assay result remains a SignCell cell whose subject is that name. Each traced projection retains its own cell occurrence and address order even when projections share the same artifact bytes. Delivery receiving independently admits and checks those cells through its existing SignCell dependency before accepting a delivery.

## Kinds

A kind is data: `content/kinds/<kind>.json`, validated against `content/schema/kind-profile.schema.json`. A profile names the input schema, the upstream producer services the kind composes, the plan steps that order them, the deliverables (media types), the acceptance assays, the price and the turnaround. The operations read profiles; no operation names a kind except to bind its assays.

| Kind | Price | Turnaround | Deliverables | Composes |
| --- | --- | --- | --- | --- |
| `research-paper` | $100.00 | 72 hours | PDF, HTML, DOCX, JATS, claims record, PROV-O | research-claim-reproduction, chart-specification-rendering, csl-yaml, research-release-metadata, rdf-vocabulary-conformance, project-document-through-pandoc, prov-o-provenance |
| `research-paper-text` | $50.00 | 48 hours | Markdown, HTML, PROV-O | csl-yaml, pandoc, prov-o |
| `corpus-research-paper` | $100.00 | 72 hours | the full paper, and its corpus citations | the above, after CAIRN reads (`cairn`) of a named house corpus: sociology, governance, agentics, philosophy or metaphysics |
| `lean-proof` | by declared tier: routine $20.00, standard $60.00, advanced $200.00 | 2, 12 or 72 hours | the Lean module, the clean lean-check result | `lean-engineering-services-section` lean-check |
| `svg-chart` | $5.00 | 15 minutes | SVG, the Vega-Lite specification | chart-specification-rendering-service |
| `svg-diagram` | $10.00 | 30 minutes | SVG, the graph it draws | computer-systems-fabrication workspace and symbol SVG, lean-blueprint-chart-service |
| `ebook` | $60.00 | 7 days | EPUB, screen PDF, the edition record | delegates to `ebook-engineering-services-section` (fabricate, then accept on an independent proof) |
| `newsletter-issue` | $25.00 | 24 hours | issue record, Markdown, HTML | delegates to `email-newsletter-engineering-services-section` |
| `fiction-serial` | $40.00 | 24 hours | fiction issue record, Markdown, HTML | delegates to `email-newsletter-engineering-services-section` (`fiction-serial`) |

The Leader set the first five prices; the lean tier amounts and the last three kinds' prices and turnarounds are this section's provisional figures, kept in the profiles so they change in one place.

## Operations

Pure exported functions (`index.mjs`), each also an NDJSON face under `scripts/` run by `@red-cup-engineering/javascript-node-engineering-services-section/operation`: one JSON request per line in, one answer per line out, `{ ok: true, ...record }` or `{ ok: false, refusal: { reason, message, path } }`, exit 2 if any line was refused. Each exports `operation`, the definition. Each has a document of its signature, refusals, precondition, postcondition, preserved frame, effect class and witness.

| Operation | Does | Document |
| --- | --- | --- |
| `quoteFabricationOrder` | price and turnaround of a kind (at a tier) | [quote](docs/operations/quote-fabrication-order.md) |
| `admitFabricationOrder` | buyer order, or a curiosity-market assignment admission, to an `ArtifactFabricationSpecification` | [admit](docs/operations/admit-fabrication-order.md) |
| `planFabrication` | specification to realization plan: ordered steps naming the upstream producer per step | [plan](docs/operations/plan-fabrication.md) |
| `assayFabricatedArtifact` | per-kind acceptance, issuing SignCell cells | [assay](docs/operations/assay-fabricated-artifact.md) |
| `receiveFabricationDelivery` | realization receipt, cells, PROV-O fragment; refuses any failed assay | [receive](docs/operations/receive-fabrication-delivery.md) |
| `dispatchFabricationWork` | the executor port, delegating to the agent-harness carrier | [port](docs/operations/dispatch-fabrication-work.md) |
| `order-<kind>` (11) | admit, plan and answer an order receipt: what the market sells | [offers](docs/operations/order-offers.md) |

The flow is the demand, work order, assay, delivery, market-outcome pattern of `computer-systems-fabrication/knowledge/knowledge-production`, with the demand source swapped from harness read events to buyer orders; `produceFabrication` is that loop.

```
order --admit--> specification --plan--> plan --dispatch(port)--> delivery
       --assay--> SignCell cells --receive--> realization receipt + PROV-O + market outcome
```

### What each operation uses upstream

| Operation | Packages |
| --- | --- |
| `quote`, `admit` | `computer-data-engineering-services-section/artifact-fabrication` (the specification record), `computer-content-address.../semiotic-content-address` (`semanticId`), `json-schema-engineering-services-section` (input schemas) |
| `plan` | `artifact-fabrication` (the realization plan); the profile's producers are named, not imported |
| `assay` | `signcraft/membrane` (`tellingOf`) and `signcraft/settle` (`settleCells`, `documentOfSettlement`, `cones`) for witnessed cell issuance, canonical addresses and truth readings; `computer-content-address.../content-address` (`addressContent`), `research-claim-reproduction-service` (`reproduceStatedClaims`), `chart-specification-rendering-service` (validate, re-render), `prov-o-provenance-service` (compose, closure, PROV-O), `research-release-metadata-service` (consistency), `email-newsletter-engineering-services-section` (validate, render, serial manifest); through ports or result records: lean-check, CAIRN, `ebook-engineering-services-section` acceptance |
| `receive` | `artifact-fabrication` (the receipt), `signcell/cell` (independent cell admission and addressed-evidence checks), `prov-o-provenance-service` |
| operation faces | `javascript-node-services-section/operation` |
| MetroPlat declarations | `relating/operation-declaration` (optional peer) |

## Input from the curiosity research market

`admitFabricationOrder` accepts the curiosity research market's admitted `ResearchAssignmentAdmission` (`coesite-operations/curiosity-research-market-enterprise`, code in `red-cup-engineering/curiosity-research-market-service`) as an input form for the research paper kinds: the question becomes the thesis, `maxPriceMicros` the budget (refused `OVER_BUDGET` below the quote), `deliveryBy` a bound on the turnaround, and the minimum source count a measured claim and a parameter of an added requirement that the `references-resolve` assay enforces. The market's own content-id check is its act when it admitted the assignment; this section reads the admitted record and keeps its id as `order.market`. The market's clearing, award settlement and delivery path are not called: that code's tests do not load (unpublished dependencies) and its delivery path hands a settled award to the research desk, not to a producer. The outcome is stated in the market's vocabulary in the receipt's `marketOutcome`; wiring it to the market's award delivery is the remaining work.

## Executor

None is built here. `dispatchFabricationWork` is a port, `carrierExecutor` adapts the agent-harness carrier (`agencyWorkCarrier`) to it, and no default is wired: the carrier runs a duty the MetroPlat work rail allocated, under a provider lease, as a CLI session on the node. Tests use a fake. See the [port](docs/operations/dispatch-fabrication-work.md).

## Reference fixture

`test/fixtures/white-repopulation/` is the White Repopulation v0.2.0 paper ([lenticule-science/white-repopulation](https://github.com/lenticule-science/white-repopulation)) as a worked `research-paper` order: `order.json`, `admission.json` (the specification), `plan.json`, `delivery-manifest.json` (the six outputs by `ni`), `evidence.json`, `assay.json` (sixteen SignCell cells), `receipt.json`. The outputs are the release assets, downloaded from `releases/download/v0.2.0/<asset>`, checked against the release's `SHA256SUMS` and addressed by `ni`. All five assays held on them: the 26 stated claims reproduce, the vocabulary conformance report is clean (22 checks), the render receipt names the delivered PDF, HTML, DOCX and JATS and its provenance closes and equals the delivered `prov.jsonld`, the four release metadata files agree with `paper.yaml`, and every citation resolves. `tools/build-white-repopulation-fixture.mjs` rebuilds it; `WR_RELEASE_DIR=<dir> npm test` replays the assay on the downloaded bytes.

## Sale

`package.json#x-market` declares thirteen offers per the autosell schema (`x402-engineering-services-section`, `schemas/package-market.schema.json`): quote ($0.01), admit ($0.05) and each kind's fabrication offer at the prices above, `saleStatus: "held"`, seller enterprise `engineering`. It is derived (`npm run derive-x-market`; a test fails on drift): prices from the profiles, schemas from the operation definitions, each example from the operation's own answer. `deriveMarketOffers` derives all thirteen without refusal.

## Dependencies

Pinned to exact registry versions, including `prov-o-provenance-service` 0.2.0 with `compose-provenance-manifest`. Not dependencies, deliberately: `computer-systems-fabrication-engineering-services-section` and `ebook-engineering-services-section` (their closure is the whole platform, 732 packages; the source-binding of `qualifySourceBoundArtifactFabrication` is mirrored in `src/specify.mjs`, and the ebook acceptance is a port, with `ebook-engineering-services-section` an optional peer), and `relating` (an optional peer: the MetroPlat declarations in `src/metroplat-operations.mjs` bind to it where it is installed; `src/declare.mjs` builds them anywhere).

## Before live sale

- A gateway that serves the held offers and issues payment challenges (the offers are catalogued, not served).
- The executor: the host binding `carrierExecutor` to an agent-harness carrier and the work rail's allocation of a fabrication duty, and the harness's receiving of deliveries.
- The market book (`record` port) bound to the inference market's outcomes, and the curiosity market's award delivery path.
- A CAIRN corpus reader for `corpus-grounded`, a proofer for `ebook`, and a lean-check runner whose result record is the `check` deliverable.
- Upstream: factor the source binding of `qualifySourceBoundArtifactFabrication` into the data layer so it can be imported without the platform; settle the provisional prices.

## Tests

`npm test` (Node 24.2 or later). The suite runs offline except where an assay renders a chart with Vega.
