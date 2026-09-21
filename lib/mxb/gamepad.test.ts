import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifyPad,
  describePad,
  gamepadActive,
  pickRiderGamepadFrom,
  readBodyStick,
  readPadTrace,
  rememberPadId,
  sandboxFromGamepad,
  scorePad,
  trigger,
} from "./gamepad.ts";
import type { SandboxInputs } from "./types.ts";

const IDLE_SANDBOX: SandboxInputs = {
  throttle: 0,
  frontBrake: 0,
  rearBrake: 0,
  clutch: 0,
  steer: 0,
  lean: 0,
  pitch: 0,
  speedKph: 0,
  frontTravel: 0.34,
  rearTravel: 0.33,
  rpm: 1950,
  gear: 0,
};

function fakePad(partial: {
  buttons?: { pressed?: boolean; value?: number }[];
  axes?: number[];
  id?: string;
  mapping?: GamepadMappingType;
  index?: number;
}): Gamepad {
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
    id: partial.id ?? "test-pad",
    index: partial.index ?? 0,
    mapping: partial.mapping ?? "standard",
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

test("pulling the stick back is a nose-up wheelie, not a stoppie", () => {
  const left = sandboxFromGamepad(fakePad({ axes: [0, 1, 0, 0] }), { ...IDLE_SANDBOX }, 0.016);
  const right = sandboxFromGamepad(fakePad({ axes: [0, 0, 0, 1] }), { ...IDLE_SANDBOX }, 0.016);
  assert.ok(left.pitch > 16, `left-stick pull-back ${left.pitch}`);
  assert.ok(right.pitch > 20, `right-stick pull-back ${right.pitch}`);
});

test("an Xbox pad is preferred over a racing wheel", () => {
  rememberPadId(null);
  const wheel = fakePad({
    id: "Logitech G29 Racing Wheel",
    mapping: "",
    index: 0,
  });
  const xbox = fakePad({
    id: "Xbox 360 Controller (XInput STANDARD GAMEPAD)",
    mapping: "standard",
    index: 1,
  });
  assert.equal(classifyPad(wheel.id, wheel.mapping), "wheel");
  assert.equal(classifyPad(xbox.id, xbox.mapping), "xbox");
  assert.equal(describePad(xbox), "Xbox");
  assert.equal(pickRiderGamepadFrom([wheel, xbox], null)?.id, xbox.id);
  assert.ok(scorePad(xbox, null) > scorePad(wheel, null));
});

test("an active DualSense wins over an idle Xbox", () => {
  const xbox = fakePad({
    id: "Xbox Wireless Controller",
    mapping: "standard",
    index: 0,
  });
  const ps = fakePad({
    id: "DualSense Wireless Controller (STANDARD GAMEPAD)",
    mapping: "standard",
    index: 1,
    buttons: [{}, {}, {}, {}, {}, {}, {}, { value: 0.8 }],
  });
  assert.equal(describePad(ps), "PlayStation");
  assert.equal(pickRiderGamepadFrom([xbox, ps], null)?.id, ps.id);
});

test("the last used pad is kept when both rider pads are idle", () => {
  const first = fakePad({ id: "Xbox Wireless Controller", mapping: "standard", index: 0 });
  const second = fakePad({
    id: "Wireless Controller (STANDARD GAMEPAD)",
    mapping: "standard",
    index: 1,
  });
  assert.equal(pickRiderGamepadFrom([first, second], second.id)?.id, second.id);
});

test("a wheel is used only when no rider pad is connected", () => {
  const wheel = fakePad({ id: "Thrustmaster T300RS", mapping: "", index: 0 });
  assert.equal(pickRiderGamepadFrom([wheel], null)?.id, wheel.id);
  const xbox = fakePad({ id: "Xbox One Controller", mapping: "standard", index: 1 });
  assert.equal(pickRiderGamepadFrom([wheel, xbox], wheel.id)?.id, xbox.id);
});
