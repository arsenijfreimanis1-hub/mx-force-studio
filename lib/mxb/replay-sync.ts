import type { RecordingFile } from "./recording.ts";
import type { Vec3 } from "./types.ts";

/**
 * MX Bikes does not send a replay flag. A replay (or a scrub) rewinds RunTelemetry
 * session time (`telemetry.time`) and keeps streaming position. Force Studio locks
 * the saved take whose clock and track position match that rewind, then scrubs the
 * take to each new session time.
 */
export const REPLAY_REWIND_S = 0.4;
export const REPLAY_MATCH_RADIUS_M = 15;
export const REPLAY_END_SLACK_S = 1.25;

export type RecordingClock = {
  id: string;
  startedAt: number;
  t0: number;
  t1: number;
  times: number[];
  positions: Vec3[];
};

export type ReplaySync = {
  recordingId: string | null;
  lastTime: number | null;
  following: boolean;
};

export type ReplayStep = {
  sync: ReplaySync;
  follow: boolean;
  recordingId: string | null;
  index: number;
  /** Rewind happened before any take was loaded. Do not advance lastTime. */
  needsClocks: boolean;
};

export function createReplaySync(): ReplaySync {
  return { recordingId: null, lastTime: null, following: false };
}

export function clockFromRecording(rec: RecordingFile): RecordingClock | null {
  const times: number[] = [];
  const positions: Vec3[] = [];
  for (const sample of rec.samples) {
    const time = sample.telemetry?.time;
    const position = sample.telemetry?.position;
    if (typeof time !== "number" || !Number.isFinite(time) || !position) continue;
    times.push(time);
    positions.push(position);
  }
  if (times.length === 0) return null;
  let t0 = times[0];
  let t1 = times[0];
  for (const time of times) {
    if (time < t0) t0 = time;
    if (time > t1) t1 = time;
  }
  return { id: rec.id, startedAt: rec.startedAt, t0, t1, times, positions };
}

export function indexAtGameTime(times: number[], gameTime: number) {
  if (times.length === 0) return 0;
  if (!isMostlySorted(times)) return nearestLinear(times, gameTime);
  let lo = 0;
  let hi = times.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] < gameTime) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(times[lo - 1] - gameTime) <= Math.abs(times[lo] - gameTime)) return lo - 1;
  return lo;
}

export function matchRecording(clocks: RecordingClock[], gameTime: number, position: Vec3) {
  let best: { id: string; err: number; startedAt: number } | null = null;
  for (const clock of clocks) {
    if (gameTime < clock.t0 - 0.05 || gameTime > clock.t1 + 0.05) continue;
    const index = indexAtGameTime(clock.times, gameTime);
    const err = distance(position, clock.positions[index]);
    if (err > REPLAY_MATCH_RADIUS_M) continue;
    if (
      !best ||
      err < best.err - 0.05 ||
      (Math.abs(err - best.err) <= 0.05 && clock.startedAt > best.startedAt)
    ) {
      best = { id: clock.id, err, startedAt: clock.startedAt };
    }
  }
  return best?.id ?? null;
}

export function stepReplaySync(
  prev: ReplaySync,
  gameTime: number,
  position: Vec3,
  clocks: RecordingClock[],
  clocksReady: boolean,
): ReplayStep {
  const sync: ReplaySync = { ...prev };
  const rewind = sync.lastTime != null && gameTime < sync.lastTime - REPLAY_REWIND_S;
  if (!Number.isFinite(gameTime)) {
    return { sync, follow: false, recordingId: null, index: -1, needsClocks: false };
  }
  if (rewind && !clocksReady) {
    return { sync, follow: false, recordingId: null, index: -1, needsClocks: true };
  }

  if (rewind) {
    const id = matchRecording(clocks, gameTime, position);
    sync.recordingId = id;
    sync.following = id != null;
  }

  if (sync.following && sync.recordingId) {
    const clock = clocks.find((item) => item.id === sync.recordingId) ?? null;
    if (!clock || gameTime < clock.t0 - 0.2 || gameTime > clock.t1 + REPLAY_END_SLACK_S) {
      sync.following = false;
      sync.recordingId = null;
    } else {
      const index = indexAtGameTime(clock.times, gameTime);
      const err = distance(position, clock.positions[index]);
      if (err > REPLAY_MATCH_RADIUS_M * 1.6) {
        sync.following = false;
        sync.recordingId = null;
      } else {
        sync.lastTime = gameTime;
        return { sync, follow: true, recordingId: clock.id, index, needsClocks: false };
      }
    }
  }

  sync.lastTime = gameTime;
  return { sync, follow: false, recordingId: null, index: -1, needsClocks: false };
}

function isMostlySorted(times: number[]) {
  for (let i = 1; i < times.length; i += 1) {
    if (times[i] + 1e-3 < times[i - 1]) return false;
  }
  return true;
}

function nearestLinear(times: number[], gameTime: number) {
  let best = 0;
  let err = Infinity;
  for (let i = 0; i < times.length; i += 1) {
    const next = Math.abs(times[i] - gameTime);
    if (next < err) {
      err = next;
      best = i;
    }
  }
  return best;
}

function distance(a: Vec3, b: Vec3) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}
