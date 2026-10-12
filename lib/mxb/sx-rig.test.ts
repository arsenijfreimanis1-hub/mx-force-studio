import assert from "node:assert/strict";
import { test } from "node:test";
import { forkSlideM, parseHiddenParts, swingPitchRad, sxRole } from "./sx-rig.ts";

test("rest suspension leaves the 250 SX in its built pose", () => {
  assert.equal(forkSlideM(0.205), 0);
  assert.equal(swingPitchRad(0.208), 0);
});

test("shorter shock and fork compress the 250 SX", () => {
  assert.ok(forkSlideM(0.12) > 0);
  assert.ok(swingPitchRad(0.12) > 0);
  assert.equal(forkSlideM(Number.NaN), 0);
});

test("named 250 SX parts map onto steer, fork, wheels, and swingarm", () => {
  assert.equal(sxRole("front_tire", "Front wheel"), "front-wheel");
  assert.equal(sxRole("rear_sprocket", "Rear wheel"), "rear-wheel");
  assert.equal(sxRole("handlebar", "Front end"), "steer");
  assert.equal(sxRole("fork_inner_tube_l", "Front end"), "fork");
  assert.equal(sxRole("fork_outer_tube_r", "Front end"), "steer");
  assert.equal(sxRole("swingarm", "Rear suspension"), "swing");
  assert.equal(sxRole("shock_absorber", "Rear suspension"), "chassis");
  assert.equal(sxRole("front_sprocket", "Drive"), "chassis");
  assert.equal(sxRole("frame_downtube", "Frame"), "chassis");
});

test("hidden part list ignores junk", () => {
  assert.deepEqual(parseHiddenParts(null), []);
  assert.deepEqual(parseHiddenParts("nope"), []);
  assert.deepEqual(parseHiddenParts(JSON.stringify(["seat", 3, ""])), ["seat"]);
});
