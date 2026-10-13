import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ALL_PART_IDS,
  DEFAULT_HIDDEN_PARTS,
  DEFAULT_VISIBLE_PARTS,
  chassisSquat,
  metaFor,
  parseHiddenParts,
  partMeta,
  slug,
} from "./exc-parts.ts";

test("rest suspension leaves the 450 EXC unsquashed", () => {
  const rest = chassisSquat(0.205, 0.208, true);
  assert.equal(rest.squat, 0);
  assert.equal(rest.pitch, 0);
});

test("shorter shocks squat and pitch the chassis", () => {
  const hit = chassisSquat(0.12, 0.1, true);
  assert.ok(hit.squat > 0);
  assert.ok(hit.pitch > 0);
  const idle = chassisSquat(0.12, 0.1, false);
  assert.equal(idle.squat, 0);
});

test("Sketchfab material names map to assemblies", () => {
  assert.equal(metaFor("Orange_Plastics").assembly, "Bodywork");
  assert.equal(metaFor("Tyres").assembly, "Wheels");
  assert.equal(metaFor("Shock_Metal").assembly, "Suspension");
  assert.equal(slug("Orange_Plastics"), "orange_plastics");
});

test("split shells are listed as their own parts", () => {
  // The bar is Dark_Metal, not the Black material — that mislabel is why the
  // handlebar used to vanish with the airbox.
  assert.equal(partMeta("handlebar").label, "Handlebar");
  assert.equal(partMeta("handlebar").assembly, "Controls");
  assert.equal(partMeta("front_fender").assembly, "Bodywork");
  assert.equal(partMeta("tyre_front").label, "Front tire");
  for (const id of ["front_fender", "rear_fender", "shroud_l", "shroud_r", "handlebar", "tyre_rear"]) {
    assert.ok(ALL_PART_IDS.includes(id), id);
  }
  // Coarse material ids are gone once the material is split.
  assert.ok(!ALL_PART_IDS.includes("orange_plastics"));
  assert.ok(!ALL_PART_IDS.includes("tyres"));
  assert.ok(ALL_PART_IDS.length > 40, `only ${ALL_PART_IDS.length} parts`);
});

test("part ids are unique so one toggle cannot own two rows", () => {
  assert.equal(new Set(ALL_PART_IDS).size, ALL_PART_IDS.length);
});

test("default stripped bike keeps frame, seat, plastics, and bars", () => {
  for (const id of DEFAULT_VISIBLE_PARTS) {
    assert.ok(ALL_PART_IDS.includes(id), `unknown default ${id}`);
    assert.ok(!DEFAULT_HIDDEN_PARTS.includes(id), id);
  }
  assert.ok(DEFAULT_VISIBLE_PARTS.includes("front_plate"), "MX number board on by default");
  assert.ok(DEFAULT_HIDDEN_PARTS.includes("dark_trim"), "dark_trim scraps stay off");
  for (const id of ["tyre_front", "tyre_rear", "wheel_front", "steel", "rear_shock", "swingarm", "front_brake_line", "rear_brake_line", "mud_flap", "fork_lower_l", "fork_lower_r", "glass"]) {
    assert.ok(DEFAULT_HIDDEN_PARTS.includes(id), id);
  }
});

test("hidden part list ignores junk", () => {
  assert.deepEqual(parseHiddenParts(null), []);
  assert.deepEqual(parseHiddenParts("nope"), []);
  assert.deepEqual(parseHiddenParts(JSON.stringify(["seat", 3, ""])), ["seat"]);
});
