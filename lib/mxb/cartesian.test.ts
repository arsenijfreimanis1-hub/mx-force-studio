import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CART_XZ_M,
  cartesianUseful,
  chassisFromWorldDelta,
  createCartesianState,
  stepCartesian,
  worldToChassis,
} from "./cartesian.ts";
import type { Vec3 } from "./types.ts";

const dt = 1 / 60;

function world(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

test("heading 0 maps world +Z into chassis forward", () => {
  const mapped = worldToChassis(0, 4, 0);
  assert.ok(Math.abs(mapped.fwd - 4) < 1e-9, JSON.stringify(mapped));
  assert.ok(Math.abs(mapped.right) < 1e-9, JSON.stringify(mapped));
});

test("heading 90 maps world +X into chassis forward", () => {
  const mapped = worldToChassis(4, 0, 90);
  assert.ok(Math.abs(mapped.fwd - 4) < 1e-6, JSON.stringify(mapped));
  assert.ok(Math.abs(mapped.right) < 1e-6, JSON.stringify(mapped));
});

test("chassis delta keeps world Y as heave", () => {
  const d = chassisFromWorldDelta(0, 2.5, 3, 0);
  assert.ok(Math.abs(d.y - 2.5) < 1e-9);
  assert.ok(Math.abs(d.z - 3) < 1e-9);
  assert.ok(Math.abs(d.x) < 1e-9);
});

test("zero placeholder is not a useful Cartesian point", () => {
  assert.equal(cartesianUseful(world(0, 0, 0), 0, false), false);
  assert.equal(cartesianUseful(world(0, 0, 0), 12, false), true);
  assert.equal(cartesianUseful(world(0, 0, 0), 0, true), true);
  assert.equal(cartesianUseful(world(80, 4, -20), 0, false), true);
});

test("first Cartesian sample is the origin", () => {
  const state = createCartesianState();
  const cart = stepCartesian(state, world(12, 3, -8), { x: 0, y: 0, z: 14 }, 0, dt, "ground");
  assert.ok(Math.abs(cart.x) < 1e-9 && Math.abs(cart.y) < 1e-9 && Math.abs(cart.z) < 1e-9);
  assert.equal(state.primed, true);
  assert.equal(state.ox, 12);
  assert.equal(state.oy, 3);
  assert.equal(state.oz, -8);
});

test("air freezes the lip so a jump is ΔY", () => {
  const state = createCartesianState();
  stepCartesian(state, world(0, 2, 10), { x: 0, y: 8, z: 14 }, 0, dt, "ground");
  let peak = 0;
  for (let i = 1; i <= 50; i++) {
    const t = i * dt;
    const y = 2 + 8 * t - 0.5 * 9.80665 * t * t;
    const cart = stepCartesian(
      state,
      world(0, y, 10 + 14 * t),
      { x: 0, y: 8 - 9.80665 * t, z: 14 },
      0,
      dt,
      "air",
    );
    peak = Math.max(peak, cart.y);
  }
  assert.ok(peak > 2.8, `peak ${peak}`);
  assert.ok(Math.abs(state.oy - 2) < 1e-9, `lip ${state.oy}`);
});

test("stop walks the origin onto the bike so the deck recenters", () => {
  const state = createCartesianState();
  stepCartesian(state, world(0, 1, 0), { x: 0, y: 0, z: 0 }, 0, dt, "stop");
  let cart = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < 120; i++) {
    cart = stepCartesian(state, world(4, 1, 9), { x: 0, y: 0, z: 0 }, 0, dt, "stop");
  }
  assert.ok(Math.hypot(cart.x, cart.y, cart.z) < 0.06, JSON.stringify(cart));
});

test("constant speed with a moving world point does not pin", () => {
  const state = createCartesianState();
  const v = 18;
  let z = 40;
  let cart = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < 160; i++) {
    z += v * dt;
    cart = stepCartesian(state, world(2, 1.2, z), { x: 0, y: 0, z: v }, 0, dt, "ground");
  }
  assert.ok(Math.abs(cart.z) < 0.45, `z ${cart.z}`);
  assert.ok(Math.abs(cart.x) < 0.15, `x ${cart.x}`);
  assert.ok(Math.abs(cart.z) < CART_XZ_M, "still inside the Cartesian scale");
});

test("a forward burst leaves Cartesian surge, then washes out", () => {
  const state = createCartesianState();
  let z = 0;
  let v = 8;
  for (let i = 0; i < 50; i++) {
    z += v * dt;
    stepCartesian(state, world(0, 1, z), { x: 0, y: 0, z: v }, 0, dt, "ground");
  }
  let surge = 0;
  for (let i = 0; i < 36; i++) {
    v += 7 * dt;
    z += v * dt;
    const cart = stepCartesian(state, world(0, 1, z), { x: 0, y: 0, z: v }, 0, dt, "ground");
    surge = Math.max(surge, cart.z);
  }
  assert.ok(surge > 0.25, `surge ${surge}`);
  let settled = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < 180; i++) {
    z += v * dt;
    settled = stepCartesian(state, world(0, 1, z), { x: 0, y: 0, z: v }, 0, dt, "ground");
  }
  assert.ok(Math.abs(settled.z) < 0.5, `settled ${settled.z}`);
});

test("a frozen world sample does not invent chassis travel", () => {
  const state = createCartesianState();
  let cart = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < 90; i++) {
    cart = stepCartesian(state, world(0, 0, 40), { x: 0, y: 0, z: 18 }, 0, dt, "ground");
  }
  assert.ok(Math.hypot(cart.x, cart.y, cart.z) < 0.05, JSON.stringify(cart));
});
