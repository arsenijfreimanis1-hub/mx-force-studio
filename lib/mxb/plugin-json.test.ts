import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePluginJson, repairPluginJson } from "./plugin-json.ts";

test("repairPluginJson turns C nan brake pressure into 0", () => {
  const raw = '{"brakePressureKpa":[nan,3.30],"throttle":0.4}';
  assert.equal(repairPluginJson(raw), '{"brakePressureKpa":[0,3.30],"throttle":0.4}');
  const parsed = parsePluginJson<{ brakePressureKpa: [number, number]; throttle: number }>(raw);
  assert.deepEqual(parsed.brakePressureKpa, [0, 3.3]);
  assert.equal(parsed.throttle, 0.4);
});

test("repairPluginJson also strips -nan and Infinity", () => {
  const raw = '{"a":-nan,"b":Infinity,"c":-Infinity}';
  const parsed = parsePluginJson<Record<string, number>>(raw);
  assert.equal(parsed.a, 0);
  assert.equal(parsed.b, 0);
  assert.equal(parsed.c, 0);
});
