/**
 * The Sketchfab GLB is one mesh per material, so a material is the coarsest
 * thing you can hide. Each of those meshes is really many disconnected shells
 * (front fender, rear fender, shrouds…). We split a mesh into connected shells
 * and name each shell by where it sits on the grounded bike, which is what
 * makes individual parts toggleable.
 *
 * Coordinates are bike-local meters after `prepareExcBike` grounds the frame:
 * +Z is the front wheel, +X is the rider's right, Y 0 is the lower frame rail.
 */

export type PartBox = {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
  center: { x: number; y: number; z: number };
};

type SplitRule = {
  id: string;
  label: string;
  assembly: string;
  /** Last rule of a list omits this and catches whatever is left. */
  when?: (box: PartBox) => boolean;
};

/**
 * Ordered shell rules per Sketchfab material. Thresholds come from measuring
 * the shells of this GLB — see the component dump in exc-split.test.ts.
 */
export const SPLIT_RULES: Record<string, SplitRule[]> = {
  Orange_Plastics: [
    {
      id: "handguard_l",
      label: "Left handguard",
      assembly: "Controls",
      when: (b) => b.center.y > 0.85 && b.center.x < 0,
    },
    { id: "handguard_r", label: "Right handguard", assembly: "Controls", when: (b) => b.center.y > 0.85 },
    { id: "rear_fender", label: "Rear fender", assembly: "Bodywork", when: (b) => b.center.z < -0.3 },
    {
      id: "front_fender",
      label: "Front fender",
      assembly: "Bodywork",
      when: (b) => b.center.z > 0.45 && b.center.y > 0.5,
    },
    {
      id: "fork_guard_l",
      label: "Left fork guard",
      assembly: "Bodywork",
      when: (b) => b.center.z > 0.45 && b.center.x < 0,
    },
    { id: "fork_guard_r", label: "Right fork guard", assembly: "Bodywork", when: (b) => b.center.z > 0.45 },
    { id: "shroud_l", label: "Left shroud", assembly: "Bodywork", when: (b) => b.center.x < 0 },
    { id: "shroud_r", label: "Right shroud", assembly: "Bodywork" },
  ],
  Dark_Plastics: [
    {
      id: "grip_l",
      label: "Left grip",
      assembly: "Controls",
      when: (b) => b.center.y > 0.85 && b.center.x < -0.18,
    },
    {
      id: "grip_r",
      label: "Right grip",
      assembly: "Controls",
      when: (b) => b.center.y > 0.85 && b.center.x > 0.18,
    },
    { id: "bar_controls", label: "Bar controls", assembly: "Controls", when: (b) => b.center.y > 0.85 },
    {
      id: "front_plate",
      label: "Front number plate",
      assembly: "Bodywork",
      when: (b) => b.center.z > 0.25 && b.center.y > 0.4,
    },
    { id: "rear_cover", label: "Airbox cover", assembly: "Bodywork", when: (b) => b.center.z < -0.45 },
    {
      id: "side_panel_l",
      label: "Left side panel",
      assembly: "Bodywork",
      when: (b) => b.center.z < -0.02 && b.center.x < 0,
    },
    { id: "side_panel_r", label: "Right side panel", assembly: "Bodywork", when: (b) => b.center.z < -0.02 },
    { id: "dark_trim", label: "Dark plastic trim", assembly: "Bodywork" },
  ],
  Orange_Metal: [
    { id: "subframe", label: "Subframe rails", assembly: "Chassis", when: (b) => b.center.y > 0.55 },
    { id: "frame_main", label: "Main frame", assembly: "Chassis" },
  ],
  Tyres: [
    { id: "tyre_front", label: "Front tire", assembly: "Wheels", when: (b) => b.center.z > 0 },
    { id: "tyre_rear", label: "Rear tire", assembly: "Wheels" },
  ],
  Rims: [
    { id: "wheel_front", label: "Front wheel", assembly: "Wheels", when: (b) => b.center.z > 0 },
    { id: "wheel_rear", label: "Rear wheel", assembly: "Wheels" },
  ],
  Radiator: [
    { id: "radiator_l", label: "Left radiator", assembly: "Cooling", when: (b) => b.center.x < 0 },
    { id: "radiator_r", label: "Right radiator", assembly: "Cooling" },
  ],
  Exhaust: [
    { id: "silencer", label: "Silencer", assembly: "Exhaust", when: (b) => b.center.z < -0.6 },
    { id: "header", label: "Header pipe", assembly: "Exhaust" },
  ],
  Shock_Metal: [
    { id: "rear_shock", label: "Rear shock", assembly: "Suspension", when: (b) => b.center.z < -0.1 },
    { id: "fork_l", label: "Left fork leg", assembly: "Suspension", when: (b) => b.center.x < 0 },
    { id: "fork_r", label: "Right fork leg", assembly: "Suspension" },
  ],
  Dark_Metal: [
    { id: "handlebar", label: "Handlebar", assembly: "Controls", when: (b) => b.center.y > 0.85 },
    {
      id: "rear_brackets",
      label: "Rear brackets",
      assembly: "Chassis",
      when: (b) => b.center.z < -0.5,
    },
    { id: "footpegs", label: "Footpegs", assembly: "Controls", when: (b) => b.center.y < 0.25 },
    { id: "dark_hardware", label: "Dark hardware", assembly: "Chassis" },
  ],
  Shiny_Aluminium: [
    { id: "disc_front", label: "Front brake disc", assembly: "Brakes", when: (b) => b.center.z > 0.5 },
    { id: "disc_rear", label: "Rear disc and sprocket", assembly: "Brakes", when: (b) => b.center.z < -0.5 },
    { id: "triple_clamp", label: "Triple clamp", assembly: "Suspension", when: (b) => b.center.y > 0.8 },
    { id: "lower_clamp", label: "Lower fork clamp", assembly: "Suspension", when: (b) => b.center.y > 0.55 },
    { id: "polished_hardware", label: "Polished hardware", assembly: "Chassis" },
  ],
  Dull_Aluminium: [
    {
      id: "hub_front",
      label: "Front hub",
      assembly: "Wheels",
      when: (b) => b.center.z > 0.5 && b.center.y < 0.4,
    },
    {
      id: "hub_rear",
      label: "Rear hub",
      assembly: "Wheels",
      when: (b) => b.center.z < -0.6 && b.center.y < 0.4,
    },
    {
      id: "swingarm",
      label: "Swingarm",
      assembly: "Suspension",
      when: (b) => b.center.z < -0.1 && b.center.y < 0.35,
    },
    { id: "bar_mounts", label: "Bar mounts", assembly: "Controls", when: (b) => b.center.y > 0.85 },
    { id: "cast_aluminium", label: "Cast aluminum parts", assembly: "Chassis" },
  ],
};

/** Label / assembly for every id the splitter can produce. */
export const SPLIT_META: Record<string, { label: string; assembly: string }> = Object.fromEntries(
  Object.values(SPLIT_RULES)
    .flat()
    .map((rule) => [rule.id, { label: rule.label, assembly: rule.assembly }]),
);

export function isSplitMaterial(material: string) {
  return Object.hasOwn(SPLIT_RULES, material);
}

/** Part id for one connected shell, or null when the material is kept whole. */
export function regionFor(material: string, box: PartBox): string | null {
  const rules = SPLIT_RULES[material];
  if (!rules) return null;
  for (const rule of rules) {
    if (!rule.when || rule.when(box)) return rule.id;
  }
  return null;
}

/** Ids a material can produce, in rule order. Used to build the panel list. */
export function splitIdsFor(material: string): string[] {
  return (SPLIT_RULES[material] ?? []).map((rule) => rule.id);
}

export function partBox(
  min: { x: number; y: number; z: number },
  max: { x: number; y: number; z: number },
): PartBox {
  return {
    min,
    max,
    center: { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: (min.z + max.z) / 2 },
  };
}
