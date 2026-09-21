import assert from "node:assert/strict";
import { test } from "node:test";
import { attitudeFromRot, resolveAttitude, rxPitch, rzRoll } from "./attitude.ts";

test("MaxTM +Z rotation extracts a matching Euler roll", () => {
  const att = attitudeFromRot(rzRoll(32));
  assert.ok(att);
  assert.ok(Math.abs(att.roll - 32) < 0.05, `roll ${att.roll}`);
  assert.ok(Math.abs(att.pitch) < 0.05, `pitch ${att.pitch}`);
});

test("MaxTM rotation matrix +12° is a nose-down pitch", () => {
  const att = attitudeFromRot(rxPitch(12));
  assert.ok(att);
  assert.ok(Math.abs(att.pitch - 12) < 0.05, `pitch ${att.pitch}`);
  assert.ok(Math.abs(att.roll) < 0.05, `roll ${att.roll}`);
});

test("a zero matrix falls back to Euler", () => {
  const att = resolveAttitude({ yaw: 10, pitch: 4, roll: -18, rot: [0, 0, 0, 0, 0, 0, 0, 0, 0] });
  assert.equal(att.roll, -18);
  assert.equal(att.pitch, 4);
  assert.equal(att.yaw, 10);
});

test("live Euler is used even when a valid matrix disagrees", () => {
  const att = resolveAttitude({ yaw: 0, pitch: 2, roll: -12, rot: rzRoll(40) });
  assert.equal(att.roll, -12);
  assert.equal(att.pitch, 2);
});
