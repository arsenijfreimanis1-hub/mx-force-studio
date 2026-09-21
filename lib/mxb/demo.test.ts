import assert from "node:assert/strict";
import { test } from "node:test";
import { telemetryFromSandbox } from "./demo.ts";
import type { SandboxInputs } from "./types.ts";

const WHEELIE: SandboxInputs = {
  throttle: 0.8,
  frontBrake: 0,
  rearBrake: 0,
  clutch: 0,
  steer: 0,
  lean: 0,
  pitch: 20,
  speedKph: 30,
  frontTravel: 0.34,
  rearTravel: 0.33,
  rpm: 8000,
  gear: 2,
};

test("sandbox wheelie pitch is a PiBoSo nose-up (negative Euler)", () => {
  const tel = telemetryFromSandbox(WHEELIE, 1);
  assert.equal(tel.pitch, -20);
  assert.ok(tel.wheelSpeed[1] > tel.wheelSpeed[0], "rear spins up on a wheelie");
});
