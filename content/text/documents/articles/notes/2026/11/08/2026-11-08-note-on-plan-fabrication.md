---
title: "planFabrication"
description: "planFabrication(specification: ArtifactFabricationSpecification, { profiles?"
date-created: 2026-11-08
type: note
name: plan-fabrication
---

`planFabrication(specification: ArtifactFabricationSpecification, { profiles? }) -> FabricationPlan | FabricationPlanRefusal`

NDJSON: `node scripts/plan-fabrication.mjs` reads `{ specification }`.

The realization plan: the data layer's exhaustive `ArtifactFabricationRealizationPlan` for the specification, and the ordered steps that realize it, each naming the upstream producer package and operation (for a research paper: claims reproduction, figure rendering, reference projection, release metadata, vocabulary conformance, the pandoc render, and the PROV-O composition, after an agent step that writes the manuscript).

## Input

`{ specification }`: an order admission's admitted specification.

## Refusals

- `INVALID_SPECIFICATION`
- `UNKNOWN_KIND`
- `PROFILE_DRIFT` (the specification's projections or obligations are not the kind profile's)
- `CYCLIC_STEPS`
- `PLAN_REFUSED` (the data layer's refusal, as detail)

## Precondition

The specification is an admitted `ArtifactFabricationSpecification` of a kind with a profile, whose projections and acceptance obligations are the profile's.

## Postcondition

`steps` are in dependency order (a step follows every step it depends on); every deliverable is produced by a step; `realizationPlan` covers every projection and obligation; `agentSteps` are the steps the executor port owns; `planDigest` is the `semanticId` of the plan.

## Preserved frame

Nothing is read or written; nothing is executed. The plan performs no effect and names the services that will.

## Effect class

pure; replay safe; coordination-free; deterministic.

## Witness

`planDigest`, and the data layer's plan admission; `test/order.test.mjs`.
