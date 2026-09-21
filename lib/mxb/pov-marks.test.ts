import assert from "node:assert/strict";
import { test } from "node:test";
import { POV_CONE_Z, POV_HELMET_Z, POV_LANE_HALF, POV_POST_Z, povMarksAreAhead } from "./pov-marks.ts";

test("the first cones and posts sit just in front of the helmet", () => {
  assert.equal(povMarksAreAhead(), true);
  assert.ok(POV_CONE_Z > POV_HELMET_Z);
  assert.ok(POV_POST_Z > POV_CONE_Z);
  assert.ok(POV_POST_Z < 3.2, `keep the first posts close ${POV_POST_Z}`);
  assert.ok(POV_LANE_HALF > 0.8);
});
