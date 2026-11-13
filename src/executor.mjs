/**
 * Execution is not this section's. It is the agent-harness carrier's
 * (`agent-harness-computer-system-engineering-services-section/carrier/agency-carrier`: `agencyWorkCarrier`
 * binds a dialect, a character and a data root and returns a provider that runs one allocated duty as
 * one agent-CLI session and answers the typed outcome). This module defines the port the section
 * dispatches through, and an adapter that makes a carrier a port.
 *
 *   port       { dispatch(workOrder, { signal }) -> Promise<FabricationDeliveryCandidate> }
 *   work order FabricationWorkOrder: the plan's steps, the deliverables and the assays, under a work lot
 *
 * No default executor is wired. The carrier is not safely invocable from here: it needs a duty
 * already allocated by the MetroPlat work rail to a character (its `item.allocation`, `item.delegation`,
 * office and method), a host-wide provider lease, a dialect, and it spawns a CLI session that writes to
 * the node's data root. `carrierExecutor` therefore takes the carrier, and the allocator that turns a
 * work order into the rail's duty, from the host that owns them; `unboundExecutor` is the default and
 * refuses, so a section that has not been wired never pretends to produce anything.
 *
 * The orchestration (`produceFabrication`) is the pattern of knowledge production
 * (`computer-systems-fabrication/knowledge/knowledge-production`) with the demand source swapped from
 * harness read events to buyer orders: order -> work order -> dispatch -> assay -> delivery -> market outcome.
 */
import { semanticId } from "@red-cup-engineering/computer-content-address-engineering-services-section/semiotic-content-address-system";
import { assayFabricatedArtifact } from "./assay.mjs";
import { receiveFabricationDelivery } from "./delivery.mjs";
import { admitFabricationOrder } from "./order.mjs";
import { planFabrication } from "./plan.mjs";
import { deepFreeze, refuse, refusingAsync, isRefusal } from "./refusal.mjs";

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const reasonOf = (error) => (error instanceof Error ? error.message : String(error));

/** The work order for one admitted order and its plan: what the executor is asked to produce, and nothing it need not know. */
export function fabricationWorkOrder(admission, plan) {
  return deepFreeze({
    type: "FabricationWorkOrder", version: 1,
    lot: `urn:work-lot:fabrication:${admission.artifactId}`,
    artifactId: admission.artifactId, kind: admission.kind, orderId: admission.orderId,
    specificationDigest: plan.specificationDigest, planDigest: plan.planDigest,
    order: admission.order, steps: plan.steps, agentSteps: plan.agentSteps, deliverables: plan.deliverables, assays: plan.assays,
    delivery: { type: "FabricationDeliveryCandidate", version: 1, note: "answer with this shape: artifactId, specificationDigest, producer { id, revision }, outputs [{ projection, mediaType, bytesBase64 | text | json }], evidence" },
  });
}

/** The port no host has wired: it refuses rather than produce. */
export const unboundExecutor = Object.freeze({
  async dispatch() { refuse("EXECUTOR_UNBOUND", "no executor is bound; the host must supply the agent-harness carrier through carrierExecutor", "executor"); },
});

/**
 * Make an agent-harness carrier a port.
 * @param {{ carrier: Function, allocate: (workOrder: object) => object|Promise<object>, collect?: (outcome: object, workOrder: object) => object }} binding
 *   carrier   the provider `agencyWorkCarrier(...)` returned: `carrier(item)` runs the allocated duty and resolves its outcome
 *   allocate  turns a work order into the duty the MetroPlat work rail allocated to the carrier's character (the host's act)
 *   collect   reads the delivery candidate out of the carrier's outcome; the default reads `result.value.output`, `result.output` or `result.value`
 */
export function carrierExecutor({ carrier, allocate, collect = defaultCollect }) {
  if (typeof carrier !== "function" || typeof allocate !== "function") throw new TypeError("carrierExecutor needs the carrier and the allocator that binds a work order to the rail's duty");
  return Object.freeze({
    async dispatch(workOrder) {
      const item = await allocate(workOrder);
      const outcome = await carrier(item);
      return collect(outcome, workOrder);
    },
  });
}

function defaultCollect(outcome) {
  const result = outcome?.result;
  for (const candidate of [result?.value?.output, result?.output, result?.value, result]) {
    if (isRecord(candidate) && candidate.type === "FabricationDeliveryCandidate") return candidate;
  }
  throw new TypeError("the carrier's outcome carries no FabricationDeliveryCandidate");
}

/**
 * Dispatch a work order through the port and check the frame of what returns. The delivery is a
 * candidate: the assay, not the executor, decides whether it is accepted.
 * Refusals: INVALID_WORK_ORDER, EXECUTOR_UNBOUND, EXECUTOR_FAILED, DELIVERY_BINDING_MISMATCH.
 */
export async function dispatchFabricationWork(executor, workOrder, { signal } = {}) {
  return refusingAsync("FabricationDispatchRefusal", async () => {
    if (!isRecord(workOrder) || workOrder.type !== "FabricationWorkOrder") refuse("INVALID_WORK_ORDER", "workOrder must be a FabricationWorkOrder", "workOrder");
    if (!isRecord(executor) || typeof executor.dispatch !== "function") refuse("EXECUTOR_UNBOUND", "executor must be a port { dispatch(workOrder, { signal }) }", "executor");
    let delivery;
    try { delivery = await executor.dispatch(workOrder, { signal }); }
    catch (error) {
      if (error?.code === "EXECUTOR_UNBOUND") refuse("EXECUTOR_UNBOUND", error.message, "executor");
      refuse("EXECUTOR_FAILED", `the executor failed: ${reasonOf(error)}`, "executor");
    }
    if (!isRecord(delivery) || delivery.type !== "FabricationDeliveryCandidate" || delivery.artifactId !== workOrder.artifactId || delivery.specificationDigest !== workOrder.specificationDigest) {
      refuse("DELIVERY_BINDING_MISMATCH", "the executor's delivery is not of this work order's artifact and specification", "delivery");
    }
    return deepFreeze({ type: "FabricationDispatch", version: 1, lot: workOrder.lot, planDigest: workOrder.planDigest, delivery });
  });
}

const MAX_ATTEMPTS = 3;

/**
 * One production run for one buyer order. Each attempt dispatches, assays and receives; a delivery
 * that fails its assay is a refused market outcome, recorded, and the work is placed again (the next
 * attempt carries the earlier failures) up to three attempts. The market's book is a port: `record`
 * hears the outcome either way, so routing learns whose deliveries the assays accept; a book that
 * cannot be written is kept as the attempt's receipt, never thrown.
 *
 * @param {object} candidate the FabricationOrderCandidate
 * @param {{ executor: object, record?: (outcome: object) => Promise<unknown>, ports?: object, profiles?: Map, now: string, signal?: AbortSignal }} binding
 */
export async function produceFabrication(candidate, { executor = unboundExecutor, record, ports, profiles, now, signal } = {}) {
  const admission = admitFabricationOrder(candidate, { profiles, now });
  if (isRefusal(admission)) return deepFreeze({ type: "FabricationProduction", version: 1, outcome: "refused-at-admission", refusal: admission });
  const plan = planFabrication(admission.specification, { profiles });
  if (isRefusal(plan)) return deepFreeze({ type: "FabricationProduction", version: 1, outcome: "refused-at-planning", refusal: plan });
  const attempts = [];
  let earlier = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS && signal?.aborted !== true; attempt += 1) {
    const workOrder = fabricationWorkOrder(admission, plan);
    const dispatched = await dispatchFabricationWork(executor, earlier.length === 0 ? workOrder : { ...workOrder, earlierFailures: earlier }, { signal });
    if (isRefusal(dispatched)) { attempts.push({ attempt, outcome: "dispatch-refused", refusal: dispatched }); break; }
    const assay = await assayFabricatedArtifact({ admission, delivery: dispatched.delivery }, { profiles, ports });
    const received = isRefusal(assay) ? assay : await receiveFabricationDelivery({ admission, delivery: dispatched.delivery, assay, receivedAt: now }, { profiles });
    const accepted = !isRefusal(received);
    const outcome = accepted ? received.marketOutcome : deepFreeze({
      type: "FabricationMarketOutcome", version: 1, lot: workOrder.lot, provider: dispatched.delivery.producer?.id ?? "unknown", taskClass: `fabrication.${admission.kind}`, outcome: "refused",
      evidence: `attempt ${attempt}: ${received.code}: ${received.message}`.slice(0, 400),
      ...(admission.order.market === undefined ? {} : { market: admission.order.market }),
    });
    let recorded = false;
    if (typeof record === "function") {
      try { await record(outcome); recorded = true; } catch (error) { recorded = reasonOf(error); }
    }
    attempts.push({ attempt, outcome: accepted ? "accepted" : "refused", marketOutcome: outcome, outcomeRecorded: recorded, ...(accepted ? { receipt: received } : { refusal: received }) });
    if (accepted) break;
    earlier = [...earlier, { attempt, code: received.code, message: received.message, failures: received.detail?.failures ?? [] }];
  }
  const last = attempts.at(-1);
  return deepFreeze({
    type: "FabricationProduction", version: 1, orderId: admission.orderId, artifactId: admission.artifactId, kind: admission.kind,
    outcome: last?.outcome === "accepted" ? "accepted" : "not-accepted", attempts,
    digest: semanticId(JSON.parse(JSON.stringify({ orderId: admission.orderId, attempts: attempts.map(({ attempt, outcome }) => ({ attempt, outcome })) }))),
  });
}
