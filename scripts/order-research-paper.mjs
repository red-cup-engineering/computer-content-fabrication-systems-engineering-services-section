#!/usr/bin/env node
import { runCommand } from "../src/command.mjs";
import { orderOperation } from "../src/operations.mjs";

export const operationDefinition = orderOperation("research-paper");
/** The offer as a face: admit the order, plan it, answer the order receipt. */
export const orderResearchPaper = operationDefinition.operation;
export const operation = operationDefinition;

if (import.meta.main) await runCommand(operationDefinition);
