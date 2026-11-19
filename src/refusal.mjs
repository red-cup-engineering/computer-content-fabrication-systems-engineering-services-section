/**
 * Refusals, in the data layer's idiom: an operation does not throw at its caller; it returns a frozen
 * record `{ type: "<Operation>Refusal", version: 1, code, message, path }` beside its success record.
 * `refuse` throws inside an operation body and `refusing` turns that throw into the record.
 */
export class FabricationRefusal extends Error {
  constructor(code, message, path = null, detail = undefined) {
    super(message);
    this.code = code;
    this.path = path;
    this.detail = detail;
  }
}

export function refuse(code, message, path = null, detail = undefined) {
  throw new FabricationRefusal(code, message, path, detail);
}

export function deepFreeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const item of Object.values(value)) deepFreeze(item);
    Object.freeze(value);
  }
  return value;
}

/** Run `body`; a refusal thrown inside becomes the named refusal record, anything else is a defect and propagates. */
export function refusing(type, body) {
  try {
    return body();
  } catch (error) {
    if (error instanceof FabricationRefusal) return refusalRecord(type, error);
    throw error;
  }
}

export async function refusingAsync(type, body) {
  try {
    return await body();
  } catch (error) {
    if (error instanceof FabricationRefusal) return refusalRecord(type, error);
    throw error;
  }
}

export function refusalRecord(type, error) {
  return deepFreeze({
    type, version: 1, code: error.code, message: error.message, path: error.path ?? null,
    ...(error.detail === undefined ? {} : { detail: error.detail }),
  });
}

/** Whether a result is one of the refusal records. */
export const isRefusal = (value) => value !== null && typeof value === "object" && typeof value.type === "string" && value.type.endsWith("Refusal");
