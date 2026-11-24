---
title: "admitFabricationOrder"
description: "admitFabricationOrder(candidate: FabricationOrderCandidate, { profiles?, now?"
date-created: 2026-11-08
type: note
name: admit-fabrication-order
---

`admitFabricationOrder(candidate: FabricationOrderCandidate, { profiles?, now? }) -> FabricationOrderAdmission | FabricationOrderRefusal`

NDJSON: `node scripts/admit-fabrication-order.mjs` reads one candidate per line and answers `{ ok: true, ...admission }` or `{ ok: false, refusal: { reason, message, path } }`.

A buyer's order becomes the data layer's `ArtifactFabricationSpecification` (version 2), bound to the order document. The section defines no parallel record: the requirements, prohibitions, constraints, projections and acceptance obligations are the kind profile's, and the data layer admits them.

## Input

`{ type: "FabricationOrderCandidate", version: 1, kind, buyer: { id }, inputs, budget?, placedAt?, assignmentAdmission? }`. `assignmentAdmission` is the curiosity research market's admitted `ResearchAssignmentAdmission` (research paper kinds only): its question becomes the thesis, its `maxPriceMicros` the budget, its `deliveryBy` a bound on the turnaround, and its minimum source count a measured claim and a parameter of an added requirement.

## Refusals

- `UNKNOWN_KIND`
- `MISSING_INPUTS` (detail names what is missing)
- `INVALID_INPUTS`
- `MISSING_TIER` / `UNKNOWN_TIER` (kinds priced by tier)
- `INVALID_BUDGET`
- `OVER_BUDGET` (the quote exceeds the buyer's budget; detail carries the quote)
- `INVALID_ORDER`, `UNEXPECTED_FIELD`
- `ASSIGNMENT_KIND_MISMATCH`, `INVALID_ASSIGNMENT`, `ASSIGNMENT_BUYER_MISMATCH`, `TURNAROUND_EXCEEDS_DELIVERY_BY`
- `SPECIFICATION_REFUSED` (the data layer's own refusal, as detail)

## Precondition

The candidate is closed JSON of the stated shape; its kind has a profile; its inputs satisfy the profile's input schema; a tier-priced kind has a declared tier; the quote does not exceed the budget; an assignment, if present, names a research paper kind, the buyer's own and a delivery date the turnaround meets (when `placedAt` or `now` is stated).

## Postcondition

The admission's `specification` is admitted by `admitArtifactFabricationSpecification` and cites `sha256:` of `orderDocument` (the canonical text of `order`, sorted keys, two-space indent); `orderId` is the `semanticId` of the order; the specification has one projection per deliverable of the profile, one acceptance obligation per assay, and a trace for every requirement and prohibition. Equal orders give equal admissions.

## Preserved frame

Nothing is read or written. The clock is not read (`placedAt`/`now` are stated by the caller). Profiles are unchanged.

## Effect class

pure; replay safe; coordination-free; deterministic; schema-bounded.

## Witness

The specification digest (`ni:///sha-256;...`) and the order document digest; `test/order.test.mjs`; the White Repopulation fixture re-admits to the recorded specification byte for byte.
