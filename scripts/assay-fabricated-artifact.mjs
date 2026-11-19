#!/usr/bin/env node
import { runCommand } from "../src/command.mjs";
import { assayFabricatedArtifactOperation as operationDefinition } from "../src/operations.mjs";

/** The operation as a face: `{ ok: true, ...record }` or `{ ok: false, refusal }`. The pure function is exported from the package root. */
export const assayFabricatedArtifact = operationDefinition.operation;
export { operationDefinition };
export const operation = operationDefinition;

if (import.meta.main) await runCommand(operationDefinition);
