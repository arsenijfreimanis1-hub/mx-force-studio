/**
 * The MX Bikes .dlo prints C floats with %.2f. Uninitialized brake
 * pressure becomes the token `nan`, which is not JSON. Repair that
 * (and Infinity) so /api/telemetry can ingest a live packet.
 */

const NONFINITE = /(?<![A-Za-z0-9_])-?(?:nan|NaN|Infinity|Inf)(?![A-Za-z0-9_])/g;

export function repairPluginJson(text: string): string {
  return text.replace(NONFINITE, "0");
}

export function parsePluginJson<T = unknown>(text: string): T {
  return JSON.parse(repairPluginJson(text)) as T;
}
