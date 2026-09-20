import assert from "node:assert/strict";
import { test } from "node:test";
import { gamepadActive, readBodyStick, readPadTrace, trigger } from "./gamepad.ts";

function fakePad(partial: { buttons?: { pressed?: boolean; value?: number }[]; axes?: number[] }): Gamepad {
  const buttons = (partial.buttons ?? []).map((b) => ({
    pressed: Boolean(b.pressed ?? (b.value ?? 0) > 0.5),
    touched: false,
    value: b.value ?? (b.pressed ? 1 : 0),
  }));
  while (buttons.length < 16) buttons.push({ pressed: false, touched: false, value: 0 });
  return {
    axes: partial.axes ?? [0, 0, 0, 0],
    buttons,
    connected: true,
    id: "test-pad",
    index: 0,
    mapping: "standard",
    timestamp: 0,
    hapticActuators: [],
    vibrationActuator: null,
  } as unknown as Gamepad;
}

test("an idle connected pad does not count as rider input", () => {
  const pad = fakePad({
    buttons: [{ value: 0.04 }, {}, {}, {}, {}, {}, { value: 0.05 }, { value: 0.05 }],
    axes: [0.1, -0.08, 0.11, 0.09],
  });
  assert.equal(gamepadActive(pad), false);
});

test("a pulled trigger counts as rider input", () => {
  const pad = fakePad({
    buttons: [{}, {}, {}, {}, {}, {}, {}, { value: 0.4 }],
  });
  assert.equal(gamepadActive(pad), true);
});

test("right stick is body weight for the dummy", () => {
  const pose = readBodyStick(fakePad({ axes: [0, 0, 0.8, -0.7] }));
  assert.ok(pose.lean < -0.2, `lean ${pose.lean}`);
  assert.ok(pose.foreAft > 0.04, `foreAft ${pose.foreAft}`);
  assert.ok(pose.stand > 0.3, `stand ${pose.stand}`);
});

test("full RT and LT read as 1 without using the right stick as brake", () => {
  const pad = fakePad({
    buttons: [{}, {}, {}, {}, {}, {}, { value: 1 }, { value: 1 }],
    axes: [0, 0, 0.9, 0, 0, 0],
  });
  const snap = readPadTrace(pad);
  assert.equal(snap.throttle, 1);
  assert.equal(snap.frontBrake, 1);
  assert.ok(snap.rx > 0.8);
});

test("RT axis 5 covers a missing trigger button", () => {
  const pad = fakePad({
    buttons: [],
    axes: [0, 0, 0, 0, 0.2, 1],
  });
  assert.equal(trigger(pad, 7, 5), 1);
  assert.ok(readPadTrace(pad).throttle > 0.95);
  assert.ok(readPadTrace(pad).frontBrake < 0.25);
});

test("face buttons other than A do not count as rider input", () => {
  const pad = fakePad({
    buttons: [{}, { pressed: true }, { pressed: true }, { pressed: true }],
  });
  assert.equal(gamepadActive(pad), false);
});
