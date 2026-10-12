import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBindsText } from "./mxb-binds.ts";

test("MX Bikes JOY BUTTON lines map onto Standard Gamepad indices", () => {
  const map = parseBindsText(
    [
      "throttle = JOY1 BUTTON8",
      "front_brake = JOY1 BUTTON7",
      "rear_brake = JOY1 BUTTON5",
      "clutch = JOY1 BUTTON1",
      "steer = JOY1 XAXIS",
      "lean = JOY1 RXAXIS invert",
      "sit = JOY1 RYAXIS",
    ].join("\n"),
    "test.ini",
  );
  assert.equal(map.throttleBtn, 7);
  assert.equal(map.frontBrakeBtn, 6);
  assert.equal(map.rearBrakeBtn, 4);
  assert.equal(map.clutchBtn, 0);
  assert.equal(map.steerAxis, 0);
  assert.equal(map.leanAxis, 2);
  assert.equal(map.sitAxis, 3);
  assert.equal(map.invertLean, true);
  assert.equal(map.source, "test.ini");
});

test("0-based button + axis numbers stay as written", () => {
  const map = parseBindsText(
    "throttle button 7\nlean axis 2\nsit axis 3\nsteer axis 0",
    "cfg",
  );
  assert.equal(map.throttleBtn, 7);
  assert.equal(map.leanAxis, 2);
  assert.equal(map.sitAxis, 3);
  assert.equal(map.steerAxis, 0);
});
