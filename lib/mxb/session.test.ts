import assert from "node:assert/strict";
import { test } from "node:test";
import { fmtLapMs, sessionKind, suspUsedPct, trackPct } from "./session.ts";

test("shock travel percent matches MaxTM used-stroke", () => {
  assert.ok(Math.abs(suspUsedPct(0.205, 0.31) - (0.31 - 0.205) / 0.31) < 1e-9);
  assert.equal(suspUsedPct(0.31, 0.31), 0);
  assert.equal(suspUsedPct(0, 0.31), 1);
});

test("lap formatter is m:ss.mmm", () => {
  assert.equal(fmtLapMs(0), "—");
  assert.equal(fmtLapMs(73210), "1:13.210");
});

test("session labels follow the PiBoSo event type", () => {
  assert.equal(sessionKind({ eventType: 2 } as never, 5), "Race 1");
  assert.equal(sessionKind({ eventType: 4 } as never, 2), "Round");
  assert.equal(sessionKind({ eventType: 1 } as never, 1), "On track");
});

test("track percent wraps the centerline", () => {
  assert.equal(trackPct({ trackPos: 0.42 } as never), 0.42);
  assert.ok(Math.abs(trackPct({ trackPos: 1.1 } as never) - 0.1) < 1e-9);
});
