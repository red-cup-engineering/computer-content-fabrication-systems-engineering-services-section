/**
 * Delivered outputs and their addresses. Every delivered artifact is named by its RFC 6920 ni name:
 * bytes by `addressContent`, JSON by `semanticId` (the semantic identity of the value, not of any one
 * serialization). An output carries exactly one of `bytesBase64`, `text` (UTF-8) or `json`.
 */
import { addressContent } from "@red-cup-engineering/computer-content-address-engineering-services-section/content-address";
import { semanticId } from "@red-cup-engineering/computer-content-address-engineering-services-section/semiotic-content-address-system";
import { refuse } from "./refusal.mjs";

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/u;

export const niOfBytes = (bytes, mediaType) => addressContent(bytes, { mediaType });
export const niOfJson = (value) => semanticId(value);

/**
 * Admit one delivered output: its projection, media type, form and address. The decoded value rides
 * along as `bytes` (and `text` where it is UTF-8) or `json`, for the assays; it is never part of a record.
 */
export function admitOutput(output, path) {
  if (!isRecord(output)) refuse("INVALID_DELIVERY", `${path} must be a JSON object`, path);
  const forms = ["bytesBase64", "text", "json"].filter((key) => key in output);
  const extras = Object.keys(output).filter((key) => !["projection", "mediaType", "bytesBase64", "text", "json"].includes(key));
  if (typeof output.projection !== "string" || typeof output.mediaType !== "string" || forms.length !== 1 || extras.length > 0) {
    refuse("INVALID_DELIVERY", `${path} must carry projection, mediaType and exactly one of bytesBase64, text, json`, path);
  }
  const { projection, mediaType } = output;
  if (forms[0] === "json") {
    let ni;
    try { ni = niOfJson(output.json); } catch (error) { refuse("INVALID_DELIVERY", `${path}.json is not a semiotic JSON value: ${error.message}`, `${path}.json`); }
    return { projection, mediaType, form: "json", ni, size: null, json: output.json };
  }
  let bytes;
  if (forms[0] === "text") {
    if (typeof output.text !== "string") refuse("INVALID_DELIVERY", `${path}.text must be a string`, `${path}.text`);
    bytes = new TextEncoder().encode(output.text);
  } else {
    if (typeof output.bytesBase64 !== "string" || !BASE64.test(output.bytesBase64)) refuse("INVALID_DELIVERY", `${path}.bytesBase64 must be base64`, `${path}.bytesBase64`);
    bytes = new Uint8Array(Buffer.from(output.bytesBase64, "base64"));
  }
  const record = niOfBytes(bytes, mediaType);
  return { projection, mediaType, form: "bytes", ni: record.ni, size: record.size, bytes };
}

/** The text of an admitted output, decoded strictly as UTF-8; undefined for a JSON output. */
export function textOf(output) {
  if (output === undefined || output.form === "json") return undefined;
  return new TextDecoder("utf-8", { fatal: true }).decode(output.bytes);
}

/** The parsed JSON of an admitted output (a JSON output as given, a byte output parsed from UTF-8 text); undefined when it does not parse. */
export function jsonOf(output) {
  if (output === undefined) return undefined;
  if (output.form === "json") return output.json;
  try { return JSON.parse(textOf(output)); } catch { return undefined; }
}
