import assert from "node:assert/strict";
import { test } from "node:test";
import { isLive, mergeEvent, normalizeTelemetry, STALE_MS } from "./live-store.ts";
import { restTelemetry } from "./defaults.ts";
import type { LivePacket } from "./types.ts";

test("empty bikeName does not clobber a selected bike", () => {
  const prev = mergeEvent(undefined, { bikeName: "Honda CRF450R", bikeId: "crf450" });
  const next = mergeEvent(prev, { bikeName: "", bikeId: "" });
  assert.equal(next.bikeName, "Honda CRF450R");
  assert.equal(next.bikeId, "crf450");
});

test("whitespace bikeName keeps previous", () => {
  const prev = mergeEvent(undefined, { bikeName: "YZ250F" });
  const next = mergeEvent(prev, { bikeName: "   " });
  assert.equal(next.bikeName, "YZ250F");
});

test("a real name switch is kept for any selected bike", () => {
  const prev = mergeEvent(undefined, { bikeName: "50cc auto" });
  const next = mergeEvent(prev, { bikeName: "450 4-stroke" });
  assert.equal(next.bikeName, "450 4-stroke");
});

test("live window is 150 ms", () => {
  assert.equal(STALE_MS, 150);
  const fresh = { receivedAt: Date.now() - 80 } as LivePacket;
  const stale = { receivedAt: Date.now() - 400 } as LivePacket;
  assert.equal(isLive(fresh), true);
  assert.equal(isLive(stale), false);
});

test("normalizeTelemetry fills holes from the previous packet", () => {
  const prev = restTelemetry({ rpm: 9000, steer: -12, clutch: 0.4 });
  const next = normalizeTelemetry(
    restTelemetry({ rpm: Number.NaN, steer: Number.NaN, clutch: Number.NaN, speedMs: 14 }),
    prev,
  );
  assert.equal(next.rpm, 9000);
  assert.equal(next.steer, -12);
  assert.equal(next.clutch, 0.4);
  assert.equal(next.speedMs, 14);
});
