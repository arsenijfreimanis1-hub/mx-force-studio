import assert from "node:assert/strict";
import { test } from "node:test";
import { CRADLE_PAD_Y, FRAME_CLAMPS, FRAME_RAIL_PROFILE, RUBBER_CRUSH, railAt } from "./exc-mount.ts";

test("every clamp lands on a measured stretch of frame rail", () => {
  for (const clamp of FRAME_CLAMPS) {
    const rail = railAt(clamp.z);
    assert.ok(rail, `no rail at z ${clamp.z} for clamp ${clamp.id}`);
    // Jaw has to be under the rail, and on it, not beside it.
    assert.ok(Math.abs(rail.x - clamp.x) < 0.02, `${clamp.id} width ${clamp.x} vs rail ${rail.x}`);
    assert.ok(Math.abs(rail.y - clamp.lift) < 0.02, `${clamp.id} lift ${clamp.lift} vs rail ${rail.y}`);
  }
});

test("the clamps are spread along the chassis, not bunched", () => {
  const zs = FRAME_CLAMPS.map((c) => c.z);
  const span = Math.max(...zs) - Math.min(...zs);
  assert.ok(span > 0.18, `clamp span ${span}`);
});

test("the rails taper and climb toward the front", () => {
  const rear = FRAME_RAIL_PROFILE[0];
  const front = FRAME_RAIL_PROFILE[FRAME_RAIL_PROFILE.length - 1];
  assert.ok(front.x < rear.x, `front ${front.x} should be narrower than rear ${rear.x}`);
  // Which is why a single clamp height would leave one end hanging.
  const lifts = FRAME_CLAMPS.map((c) => c.lift);
  assert.notEqual(lifts[0], lifts[1]);
});

test("there is no rail to grab across the skid gap", () => {
  assert.equal(railAt(-0.02), null);
  assert.equal(railAt(0.6), null);
});

test("the bike's lowest frame point clears the stage", () => {
  // Jaws sit at CRADLE_PAD_Y + lift, so the pad height has to leave room for
  // the clamp posts underneath rather than burying them in the yaw ring.
  assert.ok(CRADLE_PAD_Y > 0.08, `pad ${CRADLE_PAD_Y}`);
  for (const clamp of FRAME_CLAMPS) {
    assert.ok(CRADLE_PAD_Y + clamp.lift > 0.1, `${clamp.id} jaw ${CRADLE_PAD_Y + clamp.lift}`);
  }
});

test("bike lift seats the rail underside in the jaw rubber", () => {
  const bikeLift = CRADLE_PAD_Y - RUBBER_CRUSH;
  for (const clamp of FRAME_CLAMPS) {
    const rail = railAt(clamp.z);
    assert.ok(rail);
    const railY = bikeLift + rail.y;
    const jaw = CRADLE_PAD_Y + clamp.lift;
    // Rubber center sits at jaw - 0.002; rail should land within a few mm.
    assert.ok(Math.abs(railY - (jaw - RUBBER_CRUSH)) < 0.005, `${clamp.id} rail ${railY} vs jaw ${jaw}`);
  }
});
