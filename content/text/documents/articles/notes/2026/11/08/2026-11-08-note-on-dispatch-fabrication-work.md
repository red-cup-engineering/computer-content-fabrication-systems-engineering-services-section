---
title: "dispatchFabricationWork (the executor port)"
description: "dispatchFabricationWork(executor, workOrder, { signal?"
date-created: 2026-11-08
type: note
name: dispatch-fabrication-work
---

`dispatchFabricationWork(executor, workOrder, { signal? }) -> FabricationDispatch | FabricationDispatchRefusal`

A port, not a face: it needs an executor the host binds, so it has no NDJSON command and no offer.

The section builds no agent executor. Execution is the agent-harness carrier's
(`@red-cup-engineering/agent-harness-computer-system-engineering-services-section/carrier/agency-carrier`, `agencyWorkCarrier`), and the content-mill section's plan says not to build a second generic one. The port is `{ dispatch(workOrder, { signal }) -> Promise<FabricationDeliveryCandidate> }`; `fabricationWorkOrder(admission, plan)` states the work (the plan's steps, the steps the agent owns, the deliverables, the assays) under the lot `urn:work-lot:fabrication:<artifactId>`.

`carrierExecutor({ carrier, allocate, collect? })` makes a carrier a port. It is **not wired by default**: the carrier is not safely invocable from here. It runs a duty the MetroPlat work rail already allocated to a character (`item.allocation`, `item.delegation.provider`, office, method), under a host-wide provider lease, as a CLI session that writes the node's data root. So the host that owns the carrier supplies it, and the `allocate` that turns a work order into the rail's duty; `unboundExecutor` is the default and refuses with `EXECUTOR_UNBOUND`.

`produceFabrication(candidate, { executor, record, ports, now })` is the pattern of `computer-systems-fabrication/knowledge/knowledge-production` with the demand source swapped from harness read events to buyer orders: order, work order, dispatch, assay, delivery, market outcome. A delivery that fails its assay is a refused outcome, recorded with the market's book (`record`), and the work is placed again up to three attempts, each carrying the earlier failures; an unwritable book is kept as the attempt's receipt.

## Refusals

`INVALID_WORK_ORDER`, `EXECUTOR_UNBOUND`, `EXECUTOR_FAILED` (the executor's failure, as the message), `DELIVERY_BINDING_MISMATCH` (the delivery is not of this work order's artifact and specification).

## Precondition / postcondition

The work order is a `FabricationWorkOrder`; the executor is a port. On success the delivery is a candidate bound to the work order's artifact and specification; whether it is accepted is the assay's decision, not the executor's.

## Preserved frame

This function writes nothing; the executor's effects are the executor's, and the host's authority over them is the carrier's (its lease, its confinement, its receiving).

## Effect class

host effect through the port (the port's, not the section's); the section's own code is pure around it.

## Witness

The `FabricationDispatch` record (lot, plan digest); `test/executor.test.mjs`, with a fake executor and a fake carrier.
