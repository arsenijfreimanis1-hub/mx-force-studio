import assert from "node:assert/strict";
import { test } from "node:test";
import { SPLIT_META, isSplitMaterial, partBox, regionFor, splitIdsFor } from "./exc-split.ts";

/**
 * Boxes measured off the real shells in public/models/ktm-450-exc.glb after
 * prepareExcBike grounds the frame. If the model is ever re-exported these
 * fixtures are what tells you the thresholds moved.
 */
const SHELLS: { material: string; part: string; min: [number, number, number]; max: [number, number, number] }[] = [
  // Orange plastics
  { material: "Orange_Plastics", part: "rear_fender", min: [-0.16, 0.38, -0.98], max: [0.17, 0.79, -0.12] },
  { material: "Orange_Plastics", part: "front_fender", min: [-0.17, 0.4, 0.28], max: [0.16, 0.98, 0.92] },
  { material: "Orange_Plastics", part: "handguard_l", min: [-0.46, 0.96, 0.36], max: [-0.18, 1.08, 0.51] },
  { material: "Orange_Plastics", part: "handguard_r", min: [0.15, 0.85, 0.19], max: [0.42, 0.97, 0.28] },
  { material: "Orange_Plastics", part: "shroud_r", min: [0.02, 0.41, -0.19], max: [0.17, 0.76, 0.45] },
  { material: "Orange_Plastics", part: "shroud_l", min: [-0.24, 0.39, -0.2], max: [-0.09, 0.76, 0.43] },
  { material: "Orange_Plastics", part: "fork_guard_r", min: [0.03, 0.08, 0.52], max: [0.12, 0.43, 0.72] },
  { material: "Orange_Plastics", part: "fork_guard_l", min: [-0.17, 0.11, 0.58], max: [-0.08, 0.46, 0.78] },
  // Dark plastics
  { material: "Dark_Plastics", part: "rear_cover", min: [-0.14, 0.14, -1.04], max: [0.17, 0.77, -0.24] },
  { material: "Dark_Plastics", part: "side_panel_l", min: [-0.15, 0.18, -0.43], max: [-0.09, 0.49, -0.07] },
  { material: "Dark_Plastics", part: "side_panel_r", min: [0.09, 0.21, -0.2], max: [0.15, 0.49, -0.04] },
  { material: "Dark_Plastics", part: "grip_l", min: [-0.5, 0.98, 0.31], max: [-0.35, 1.05, 0.38] },
  { material: "Dark_Plastics", part: "grip_r", min: [0.23, 0.89, 0.06], max: [0.38, 0.96, 0.17] },
  { material: "Dark_Plastics", part: "front_plate", min: [-0.19, 0.45, 0.32], max: [0.1, 0.99, 0.57] },
  { material: "Dark_Plastics", part: "bar_controls", min: [-0.11, 0.9, 0.24], max: [0.01, 0.98, 0.32] },
  // Frame
  { material: "Orange_Metal", part: "frame_main", min: [-0.13, 0.1, -0.23], max: [0.14, 0.62, 0.28] },
  { material: "Orange_Metal", part: "subframe", min: [-0.08, 0.38, -0.12], max: [0.02, 0.87, 0.43] },
  // Wheels
  { material: "Tyres", part: "tyre_front", min: [-0.18, -0.24, 0.42], max: [0.15, 0.45, 1.09] },
  { material: "Tyres", part: "tyre_rear", min: [-0.03, -0.24, -1.08], max: [0.15, 0.44, -0.4] },
  { material: "Rims", part: "wheel_front", min: [-0.13, -0.18, 0.48], max: [0.11, 0.39, 1.03] },
  { material: "Rims", part: "wheel_rear", min: [0, -0.14, -0.98], max: [0.11, 0.34, -0.5] },
  { material: "Dull_Aluminium", part: "hub_front", min: [-0.08, 0.02, 0.67], max: [0.07, 0.18, 0.82] },
  { material: "Dull_Aluminium", part: "hub_rear", min: [-0.03, 0.03, -0.81], max: [0.15, 0.17, -0.68] },
  { material: "Dull_Aluminium", part: "swingarm", min: [-0.09, 0.06, -0.79], max: [0.18, 0.28, -0.13] },
  // Controls
  { material: "Dark_Metal", part: "handlebar", min: [-0.36, 0.89, 0.13], max: [0.25, 1.03, 0.36] },
  // Suspension / brakes
  { material: "Shock_Metal", part: "rear_shock", min: [-0.02, 0.25, -0.37], max: [0.05, 0.44, -0.2] },
  { material: "Shock_Metal", part: "fork_r", min: [0.03, 0.34, 0.28], max: [0.1, 0.85, 0.57] },
  { material: "Shock_Metal", part: "fork_l", min: [-0.17, 0.37, 0.34], max: [-0.1, 0.88, 0.64] },
  { material: "Shiny_Aluminium", part: "disc_front", min: [-0.01, -0.02, 0.62], max: [0.08, 0.22, 0.86] },
  { material: "Shiny_Aluminium", part: "disc_rear", min: [-0.03, -0.02, -0.86], max: [-0.01, 0.21, -0.63] },
  { material: "Shiny_Aluminium", part: "triple_clamp", min: [-0.18, 0.82, 0.24], max: [0.09, 0.96, 0.4] },
  { material: "Shiny_Aluminium", part: "lower_clamp", min: [-0.17, 0.62, 0.35], max: [0.1, 0.72, 0.5] },
  // Cooling / exhaust
  { material: "Radiator", part: "radiator_l", min: [-0.19, 0.38, 0.2], max: [-0.07, 0.43, 0.26] },
  { material: "Radiator", part: "radiator_r", min: [0.02, 0.4, 0.22], max: [0.14, 0.44, 0.27] },
  { material: "Exhaust", part: "header", min: [-0.15, 0.27, -0.81], max: [0.02, 0.74, 0.29] },
  { material: "Exhaust", part: "silencer", min: [-0.1, 0.65, -0.84], max: [-0.06, 0.71, -0.71] },
  // Lines, flap, and the lower fork tubes — these used to hide inside a bigger part.
  { material: "Dark_Plastics", part: "front_brake_line", min: [-0.04, -0.03, 0.55], max: [0.04, 0.49, 0.69] },
  { material: "Dark_Plastics", part: "rear_brake_line", min: [-0.1, 0.09, -0.53], max: [0.04, 0.19, 0.05] },
  { material: "Dark_Plastics", part: "mud_flap", min: [-0.115, 0.4, -0.5], max: [-0.085, 0.58, -0.34] },
  { material: "Shock_Metal", part: "fork_lower_r", min: [0.005, -0.02, 0.5], max: [0.055, 0.44, 0.77] },
];

test("measured shells land on the part the panel shows", () => {
  for (const shell of SHELLS) {
    const box = partBox(
      { x: shell.min[0], y: shell.min[1], z: shell.min[2] },
      { x: shell.max[0], y: shell.max[1], z: shell.max[2] },
    );
    assert.equal(regionFor(shell.material, box), shell.part, `${shell.material} → ${shell.part}`);
  }
});

test("materials with no rules stay whole", () => {
  for (const name of ["Black", "Steel", "Chain", "Glass", "Fuel_Tank", "Black_Seat", "Red_Reflector"]) {
    assert.equal(isSplitMaterial(name), false, name);
    assert.equal(regionFor(name, partBox({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 })), null, name);
  }
});

test("every rule id has a label and a known assembly", () => {
  const assemblies = new Set([
    "Bodywork",
    "Chassis",
    "Cooling",
    "Suspension",
    "Wheels",
    "Brakes",
    "Drive",
    "Exhaust",
    "Controls",
  ]);
  for (const [id, meta] of Object.entries(SPLIT_META)) {
    assert.ok(meta.label.length > 0, id);
    assert.ok(assemblies.has(meta.assembly), `${id} → ${meta.assembly}`);
  }
});

test("a split material always resolves to one of its own ids", () => {
  for (const material of ["Orange_Plastics", "Dark_Plastics", "Tyres", "Dark_Metal"]) {
    const ids = splitIdsFor(material);
    assert.ok(ids.length > 1, material);
    // The last rule is a catch-all, so an absurd box still lands somewhere.
    const far = partBox({ x: 9, y: 9, z: 9 }, { x: 9.1, y: 9.1, z: 9.1 });
    assert.ok(ids.includes(regionFor(material, far) as string), material);
  }
});
