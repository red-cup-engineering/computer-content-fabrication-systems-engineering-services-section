---
title: "order-<kind> (the fabrication offers)"
description: "order-research-paper, order-research-paper-text, order-corpus-research-paper, order-lean-proof-routine, order-lean-proof-standard, order-lean-proof-advanced, order-svg-chart, order-svg-diagram, order-ebook, order-newsletter-issue,…"
date-created: 2026-11-08
type: note
name: order-offers
---

`order-research-paper`, `order-research-paper-text`, `order-corpus-research-paper`, `order-lean-proof-routine`, `order-lean-proof-standard`, `order-lean-proof-advanced`, `order-svg-chart`, `order-svg-diagram`, `order-ebook`, `order-newsletter-issue`, `order-fiction-serial`

`orderOperation(kind, tier?) -> { name, inputSchema, outputSchema, operation }`; the face is `node scripts/order-<kind>.mjs`.

An offer is a buyer's order for one kind: it admits the order (`admitFabricationOrder`, with the tier fixed by the offer), plans it (`planFabrication`) and answers the compact `FabricationOrderReceipt` (`orderId`, `artifactId`, `specificationDigest`, `planDigest`, `quote`, the steps' upstream packages, the deliverables and the assays). Production follows, through the executor port; the offer sells the admitted order, not the artifact in the response.

## Input

`{ buyer: { id }, inputs, budget?, placedAt? }`; `inputs` is the kind profile's input schema. The lean-proof offers fix `tier` by name, so it is not an input there.

## Refusals

Those of `admitFabricationOrder` and `planFabrication`, in the Group shape `{ ok: false, refusal: { reason, message, path } }`.

## Precondition / postcondition

As `admitFabricationOrder` and `planFabrication`; the receipt's `specificationDigest` equals the digest `admitFabricationOrder` gives the same order, and its `planDigest` the digest `planFabrication` gives that specification.

## Preserved frame

Nothing is read or written; the clock is not read.

## Effect class

pure; replay safe; coordination-free; deterministic.

## Witness

`specificationDigest`, `planDigest`; `test/operations.test.mjs` (the sold order is the admitted order).

## Sale

Each is an `x-market` offer in `package.json`, `saleStatus: "held"`, priced from its kind profile, sold by the `engineering` enterprise. No gateway issues a payment challenge for a held offer.
