import assert from "node:assert/strict";
import { test } from "node:test";
import { gamepadActive } from "./gamepad.ts";

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

test("face buttons other than A do not count as rider input", () => {
  const pad = fakePad({
    buttons: [{}, { pressed: true }, { pressed: true }, { pressed: true }],
  });
  assert.equal(gamepadActive(pad), false);
});
