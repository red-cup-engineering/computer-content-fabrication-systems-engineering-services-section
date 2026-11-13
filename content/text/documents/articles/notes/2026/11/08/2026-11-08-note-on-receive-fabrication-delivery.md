---
title: "receiveFabricationDelivery"
description: "receiveFabricationDelivery({ admission, delivery, assay, receivedAt }, { profiles?"
date-created: 2026-11-08
type: note
name: receive-fabrication-delivery
---

`receiveFabricationDelivery({ admission, delivery, assay, receivedAt }, { profiles? }) -> FabricationDeliveryReceipt | FabricationDeliveryRefusal`

NDJSON: `node scripts/receive-fabrication-delivery.mjs`.

The receiving act. It refuses a delivery any of whose assays failed; otherwise it admits the data layer's `ArtifactFabricationRealizationReceipt` (each projection realized by an ni-addressed output, each acceptance obligation evidenced by the digest of its SignCell cells), composes the PROV fragment of the fabrication (the order, the buyer, the producer, the activity and every output as an ni-addressed entity) through prov-o-provenance-service, checks that it closes, and states the market outcome (`accepted`) in the shape the inference market's book takes.

## Input

`admission`, `delivery`, `assay` (the `FabricationAssayResult`) and `receivedAt` (an instant; the operation reads no clock).

## Refusals

- the admission and delivery refusals of the assay
- `INVALID_ASSAY`, `ASSAY_BINDING_MISMATCH`, `ASSAY_OF_OTHER_BYTES` (the assay addressed other bytes, or its cells do not show its verdicts)
- `ASSAY_FAILED` (detail.failures names each failed assay and why)
- `INVALID_REQUEST`
- `RECEIPT_REFUSED`, `PROVENANCE_REFUSED`

## Precondition

The assay is of exactly these outputs under this specification, every assay of the profile has a verdict, and each verdict is what its cells show; every verdict held.

## Postcondition

`receipt` is admitted by the data layer and re-admits to itself; `provenance.closed` is true and carries the PROV-O canonical `ni`; `marketOutcome.receipt` is the receipt's digest.

## Preserved frame

Nothing is written. Delivery to the buyer, settlement and the market's book are the host's acts on this record.

## Effect class

pure; replay safe; coordination-free; deterministic.

## Witness

`receiptDigest`, the PROV-O `canonicalNi`; `test/delivery.test.mjs`; the White Repopulation fixture receipt.
