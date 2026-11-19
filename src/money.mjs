/** Prices are dollar strings ("$100.00"), compared as integer cents so no float arithmetic enters a quote. */
const DOLLARS = /^\$([0-9]+)\.([0-9]{2})$/u;

export function centsOf(dollars) {
  const match = DOLLARS.exec(dollars);
  if (match === null) throw new TypeError(`not a dollar amount with cents: ${String(dollars)}`);
  return Number(match[1]) * 100 + Number(match[2]);
}

export function dollarsOf(cents) {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new TypeError("cents must be a nonnegative safe integer");
  return `$${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

/** USD micros (the curiosity market's accounting unit) to whole cents, rounding down: a budget never rounds up. */
export const centsOfMicros = (micros) => Math.floor(micros / 10_000);
