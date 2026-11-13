---
title: "assayFabricatedArtifact"
description: "assayFabricatedArtifact({ admission, delivery }, { profiles?, ports?"
date-created: 2026-11-08
type: note
name: assay-fabricated-artifact
---

`assayFabricatedArtifact({ admission, delivery }, { profiles?, ports? }) -> FabricationAssayResult | FabricationAssayRefusal`

NDJSON: `node scripts/assay-fabricated-artifact.mjs` reads `{ admission, delivery }`. Ports (the CAIRN corpus reader, the ebook acceptance) are bound by a host that calls the function; the face binds none, so those two assays answer denied there.

The per-kind acceptance. Each output is addressed (bytes by `addressContent`, JSON by `semanticId`); each assay the profile names runs; each verdict is a SignCell cell per artifact it is traced to: subject the artifact's `ni`, predicate the assay id, object the specification digest, told for by the assay's witness when it held and against when it did not. Recomputation uses the upstream service wherever it has a pure function: claims (`reproduceStatedClaims`), chart validation and re-rendering, PROV composition, closure and projection, release metadata consistency, newsletter validation and rendering. Lean, CAIRN and the ebook proofer are read through their result records or ports.

Cell issuance and reading use SignCraft's original `tellingOf`, `settleCells`, `documentOfSettlement` and `cones` APIs. A separate finite settlement for each traced projection preserves the existing cell occurrence count and address order when two projections share an artifact `ni`. The document spine supplies the canonical cell address and `adjudicate` supplies its truth reading. An assay with no traced projection still has an empty address list and a null reading. This computation neither binds an executor nor grants collection, publication or subscription rights; delivery receiving retains its independent cell admission and evidence checks.

## Input

`admission` (a `FabricationOrderAdmission`) and `delivery` (`FabricationDeliveryCandidate`: `artifactId`, `specificationDigest`, `producer`, `outputs` each with exactly one of `bytesBase64`, `text`, `json`, and `evidence`).

## Refusals

- `INVALID_ADMISSION`, `ORDER_DOCUMENT_MISMATCH`, `INVALID_SPECIFICATION`, `UNKNOWN_KIND` (the admission is not what the caller says)
- `INVALID_DELIVERY`, `DELIVERY_BINDING_MISMATCH`, `DUPLICATE_PROJECTION`, `MISSING_PROJECTION`, `UNEXPECTED_PROJECTION`, `MEDIA_TYPE_MISMATCH`
- `UNKNOWN_ASSAY` (a profile names an assay the section has no check for; never silently passed)

## Precondition

The admission re-checks (order document, digest binding, specification digest); the delivery binds the admission's artifact and specification and carries exactly the profile's projections with the profile's media types.

## Postcondition

`verdicts` has one entry per assay of the profile; `cells` has one cell per (assay, traced projection); a held assay's cells are told for and none against, a denied assay's are told against; `passed` is every verdict held; an assay that fails is a verdict, not a refusal.

## Preserved frame

Nothing is written. Only the ports the host bound are read. The delivery is not altered.

## Effect class

pure given its ports; replay safe; coordination-free; deterministic over equal inputs.

## Witness

`assayDigest` and the SignCell cell addresses (`ni`); `test/assay.test.mjs`; the full replay of the White Repopulation release assets reproduces the recorded `assayDigest`.
