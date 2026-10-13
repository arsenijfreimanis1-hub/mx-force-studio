import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clockFromRecording,
  createReplaySync,
  indexAtGameTime,
  matchRecording,
  stepReplaySync,
  telemetryAtGameTime,
  type RecordingClock,
} from "./replay-sync.ts";
import type { RecordingFile } from "./recording.ts";
import { restTelemetry } from "./defaults.ts";
import { idlePadTrace } from "./gamepad.ts";

function clock(id: string, startedAt: number, samples: Array<[number, number, number, number]>): RecordingClock {
  return {
    id,
    startedAt,
    t0: samples[0][0],
    t1: samples[samples.length - 1][0],
    times: samples.map((sample) => sample[0]),
    positions: samples.map((sample) => ({ x: sample[1], y: sample[2], z: sample[3] })),
  };
}

test("game time picks the nearest recorded sample", () => {
  assert.equal(indexAtGameTime([0, 0.5, 1.2, 2], 1.1), 2);
  assert.equal(indexAtGameTime([2, 0, 1], 0.9), 2);
});

test("a rewind locks the take that is on the same piece of track", () => {
  const home = clock("home", 10, [
    [1, 0, 0, 0],
    [2, 10, 0, 0],
    [3, 20, 0, 0],
  ]);
  const other = clock("other", 20, [
    [1, 100, 0, 0],
    [2, 110, 0, 0],
    [3, 120, 0, 0],
  ]);
  assert.equal(matchRecording([other, home], 2, { x: 10, y: 0, z: 0 }), "home");

  let sync = createReplaySync();
  sync = stepReplaySync(sync, 8, { x: 40, y: 0, z: 0 }, [home, other], true).sync;
  const locked = stepReplaySync(sync, 2.1, { x: 10, y: 0, z: 1 }, [home, other], true);
  assert.equal(locked.follow, true);
  assert.equal(locked.recordingId, "home");
  assert.equal(locked.index, 1);

  const drifted = stepReplaySync(locked.sync, 2.4, { x: 80, y: 0, z: 0 }, [home, other], true);
  assert.equal(drifted.follow, false);
});

test("a short scrub still locks the take, and the frame is blended between samples", () => {
  const ride = clock("ride", 1, [
    [1, 0, 0, 0],
    [2, 10, 0, 0],
    [3, 20, 0, 0],
  ]);
  let sync = createReplaySync();
  sync = stepReplaySync(sync, 5, { x: 40, y: 0, z: 0 }, [ride], true).sync;
  const locked = stepReplaySync(sync, 4.7, { x: 40, y: 0, z: 0 }, [ride], true);
  assert.equal(locked.follow, false);

  sync = stepReplaySync(createReplaySync(), 8, { x: 0, y: 0, z: 0 }, [ride], true).sync;
  const scrub = stepReplaySync(sync, 1.4, { x: 4, y: 0, z: 0 }, [ride], true);
  assert.equal(scrub.follow, true);

  const rec: RecordingFile = {
    id: "ride",
    name: "Ride",
    startedAt: 1,
    durationMs: 2000,
    samples: [1, 2].map((time) => ({
      t: time * 1000,
      telemetry: { ...restTelemetry(), time, steer: time === 1 ? 0 : 20, position: { x: time, y: 0, z: 0 } },
      pad: idlePadTrace(),
    })),
  };
  const mid = telemetryAtGameTime(rec.samples, 1.5);
  assert.ok(mid);
  assert.ok(Math.abs(mid.steer - 10) < 0.01, `steer ${mid.steer}`);
});

test("live time that keeps climbing does not start a synced replay", () => {
  const ride = clock("ride", 1, [
    [1, 0, 0, 0],
    [2, 5, 0, 0],
  ]);
  let sync = createReplaySync();
  sync = stepReplaySync(sync, 1, { x: 0, y: 0, z: 0 }, [ride], true).sync;
  const next = stepReplaySync(sync, 1.5, { x: 2, y: 0, z: 0 }, [ride], true);
  assert.equal(next.follow, false);
  assert.equal(next.needsClocks, false);
});

test("a rewind waits for saved takes instead of consuming the jump", () => {
  const sync = stepReplaySync(createReplaySync(), 4, { x: 0, y: 0, z: 0 }, [], true).sync;
  const waiting = stepReplaySync(sync, 0.2, { x: 0, y: 0, z: 0 }, [], false);
  assert.equal(waiting.needsClocks, true);
  assert.equal(waiting.sync.lastTime, 4);
});

test("clockFromRecording reads session time off each sample", () => {
  const rec: RecordingFile = {
    id: "rec-1",
    name: "Ride",
    startedAt: 5,
    durationMs: 1000,
    samples: [
      { t: 0, pad: idlePadTrace(), telemetry: { ...restTelemetry(), time: 12, position: { x: 1, y: 2, z: 3 } } },
      { t: 30, pad: idlePadTrace(), telemetry: { ...restTelemetry(), time: 12.4, position: { x: 2, y: 2, z: 3 } } },
    ],
  };
  const built = clockFromRecording(rec);
  assert.equal(built?.t0, 12);
  assert.equal(built?.t1, 12.4);
  assert.equal(built?.positions[1].x, 2);
});
