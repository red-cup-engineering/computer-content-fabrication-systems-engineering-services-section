import { runJavascriptNodeOperation } from "@red-cup-engineering/javascript-node-engineering-services-section/operation";
import { isRefusal } from "./refusal.mjs";

/** The output every operation shares: a success carrying ok: true with its record, or a refusal carrying ok: false. */
export const resultSchema = {
  type: "object",
  required: ["ok"],
  properties: {
    ok: { type: "boolean" },
    type: { type: "string" },
    refusal: {
      type: "object",
      required: ["reason", "message"],
      properties: { reason: { type: "string" }, message: { type: "string" }, path: { type: ["string", "null"] } },
    },
  },
};

/** Lift an operation returning records (or refusal records) to the house result: `{ ok: true, ...record }` or `{ ok: false, refusal }`. */
export const asFace = (operation) => async (request) => {
  const record = await operation(request);
  if (!isRefusal(record)) return { ok: true, ...record };
  const { code, message, path, detail } = record;
  return { ok: false, refusal: { reason: code, message, path, ...(detail === undefined ? {} : { detail }) } };
};

/** Run one operation as an NDJSON command: one JSON value per input line, one per output line. */
export async function runCommand(operationDefinition) {
  process.exitCode = (await runJavascriptNodeOperation(operationDefinition, {
    arguments: process.argv.slice(2), standardInput: process.stdin, standardOutput: process.stdout,
  })).exitCode;
}
