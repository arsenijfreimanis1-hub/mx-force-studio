import assert from "node:assert/strict";
import { test } from "node:test";
import {
  POV_BANNER_Z,
  POV_CENTERLINE_ZS,
  POV_GATE_Z,
  POV_HELMET_Z,
  POV_LANE_HALF,
  POV_POST_ZS,
  povMarksAreAhead,
} from "./pov-marks.ts";

test("every POV landmark sits in front of the helmet", () => {
  assert.equal(povMarksAreAhead(), true);
  assert.ok(POV_GATE_Z > POV_HELMET_Z);
  assert.ok(POV_POST_ZS[0] > POV_GATE_Z - 0.2);
  assert.ok(POV_BANNER_Z > 10);
  assert.ok(POV_LANE_HALF > 0.8);
  assert.ok(POV_CENTERLINE_ZS.length >= 8);
  assert.ok(POV_POST_ZS.at(-1)! > POV_CENTERLINE_ZS[4]);
});
