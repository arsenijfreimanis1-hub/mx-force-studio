import type { PadTrace } from "./gamepad.ts";
import type { Telemetry } from "./types.ts";

export type RecFrame = {
  t: number;
  telemetry: Telemetry;
  pad: PadTrace;
};

export type RecordingFile = {
  id: string;
  name: string;
  startedAt: number;
  durationMs: number;
  samples: RecFrame[];
};

export type RecordingMeta = {
  id: string;
  name: string;
  startedAt: number;
  durationMs: number;
  frames: number;
};

export function newRecordingId() {
  const d = new Date();
  const stamp = d.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `rec-${stamp}`;
}

export function recordingMeta(rec: RecordingFile): RecordingMeta {
  return {
    id: rec.id,
    name: rec.name,
    startedAt: rec.startedAt,
    durationMs: rec.durationMs,
    frames: rec.samples.length,
  };
}
