import type { BikeEvent, Telemetry } from "./types";

/** MaxTM-style shock travel: shorter length = more used stroke. */
export function suspUsedPct(length: number, maxTravel: number) {
  if (!(maxTravel > 0.05)) return 0;
  return Math.min(1, Math.max(0, (maxTravel - length) / maxTravel));
}

export function fmtLapMs(ms: number) {
  if (!(ms > 0)) return "—";
  const total = ms / 1000;
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, "0")}`;
}

export function fmtOnTrackS(seconds: number) {
  if (!(seconds > 0)) return "—";
  return fmtLapMs(seconds * 1000);
}

export function sessionKind(event: BikeEvent | null | undefined, session = 0) {
  const type = event?.eventType ?? 0;
  if (type === 4) {
    return ["Waiting", "Practice", "Round", "Quarter", "Semi", "Final"][session] ?? "Straight rhythm";
  }
  if (type === 2) {
    return ["Waiting", "Practice", "Pre-Q", "Qualify", "Warmup", "Race 1", "Race 2"][session] ?? "Race";
  }
  return session > 0 ? "On track" : "Testing";
}

export function trackPct(telemetry: Telemetry) {
  const p = telemetry.trackPos;
  if (!Number.isFinite(p)) return 0;
  const wrapped = p - Math.floor(p);
  return Math.min(1, Math.max(0, wrapped));
}
