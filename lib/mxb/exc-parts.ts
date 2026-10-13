/**
 * Sketchfab KTM 450 EXC by Motocross 3D (@mx-3d), CC BY.
 * Export is one mesh per material — those mesh groups are the selectable parts.
 */

import { SPLIT_META, isSplitMaterial, splitIdsFor } from "./exc-split.ts";

export const MODEL_URL = "/models/ktm-450-exc.glb?v=visual-pass-v10";

export const MODEL_CREDIT = {
  title: "KTM 450 EXC",
  author: "Motocross 3D (@mx-3d)",
  url: "https://sketchfab.com/3d-models/ktm-450-exc-d4a99a39c0ff48378ba47af8f8b74dea",
  license: "CC Attribution",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
} as const;

export const EXC_ASSEMBLIES = [
  "Bodywork",
  "Chassis",
  "Cooling",
  "Suspension",
  "Wheels",
  "Brakes",
  "Drive",
  "Exhaust",
  "Controls",
] as const;

type PartMeta = {
  label: string;
  assembly: string;
  material: string;
  spec: string;
};

/** Friendly names for Sketchfab material meshes. */
export const MATERIAL_META: Record<string, PartMeta> = {
  Glass: {
    label: "Lens glass",
    assembly: "Bodywork",
    material: "Clear plastic / glass",
    spec: "Headlight / indicator lens",
  },
  Orange_Plastics: {
    label: "Orange plastics",
    assembly: "Bodywork",
    material: "Orange polypropylene",
    spec: "Fenders, shrouds, and side panels",
  },
  Dark_Plastics: {
    label: "Dark plastics",
    assembly: "Bodywork",
    material: "Black polypropylene",
    spec: "Airbox covers, guards, and dark body panels",
  },
  Fuel_Tank: {
    label: "Fuel tank",
    assembly: "Bodywork",
    material: "Polyethylene tank",
    spec: "Fuel tank shell",
  },
  Black_Seat: {
    label: "Seat",
    assembly: "Bodywork",
    material: "Seat foam and cover",
    spec: "Rider seat",
  },
  Red_Reflector: {
    label: "Reflector",
    assembly: "Bodywork",
    material: "Red reflector",
    spec: "Rear reflector",
  },
  Radiator: {
    label: "Radiators",
    assembly: "Cooling",
    material: "Aluminum radiator",
    spec: "Cooling cores beside the frame",
  },
  Tyres: {
    label: "Tires",
    assembly: "Wheels",
    material: "Rubber",
    spec: "Front and rear knobby tires",
  },
  Rims: {
    label: "Rims and spokes",
    assembly: "Wheels",
    material: "Aluminum rim",
    spec: "Wheels, hubs, and spokes",
  },
  Orange_Metal: {
    label: "Frame",
    assembly: "Chassis",
    material: "Powder-coated frame",
    spec: "Main chassis spars",
  },
  Steel: {
    label: "Engine and steel hardware",
    assembly: "Chassis",
    material: "Steel",
    spec: "Engine cases, brackets, and steel fasteners",
  },
  Dull_Aluminium: {
    label: "Dull aluminum",
    assembly: "Chassis",
    material: "Dull aluminum",
    spec: "Cast and milled aluminum parts",
  },
  Shiny_Aluminium: {
    label: "Shiny aluminum",
    assembly: "Chassis",
    material: "Polished aluminum",
    spec: "Bright aluminum parts and fasteners",
  },
  Dark_Metal: {
    label: "Engine / dark metal",
    assembly: "Chassis",
    material: "Dark coated metal",
    spec: "Engine cases and dark metal housings",
  },
  Shock_Metal: {
    label: "Shock and linkage",
    assembly: "Suspension",
    material: "Shock body metal",
    spec: "Rear shock, spring and linkage metal",
  },
  Exhaust: {
    label: "Exhaust",
    assembly: "Exhaust",
    material: "Exhaust steel / aluminum",
    spec: "Header and silencer",
  },
  Chain: {
    label: "Chain",
    assembly: "Drive",
    material: "Steel chain",
    spec: "Drive chain",
  },
  Black: {
    label: "Intake and black trim",
    assembly: "Chassis",
    material: "Black plastic / rubber",
    spec: "Airbox, intake, and centre-chassis trim",
  },
};

export function slug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function metaFor(name: string): PartMeta {
  if (MATERIAL_META[name]) return MATERIAL_META[name];
  return {
    label: name.replace(/_/g, " "),
    assembly: "Other",
    material: name.replace(/_/g, " "),
    spec: "Imported mesh group",
  };
}

/**
 * Every id the panel can list: split materials contribute one id per shell
 * group, whole materials contribute their own slug.
 */
export const ALL_PART_IDS = [
  ...Object.keys(MATERIAL_META).flatMap((name) =>
    isSplitMaterial(name) ? splitIdsFor(name) : [slug(name)],
  ),
  // Blender-named controls that are not produced by the material shell split.
  ...Object.keys(SPLIT_META).filter(
    (id) =>
      !Object.keys(MATERIAL_META).some((name) =>
        (isSplitMaterial(name) ? splitIdsFor(name) : [slug(name)]).includes(id),
      ),
  ),
];

/** Which material a part id came from, so debranding and specs still resolve. */
const PART_SOURCE: Record<string, string> = Object.fromEntries(
  Object.keys(MATERIAL_META).flatMap((name) =>
    (isSplitMaterial(name) ? splitIdsFor(name) : [slug(name)]).map((id) => [id, name]),
  ),
);

/** Label / assembly / spec for one toggleable part id. */
export function partMeta(id: string): PartMeta {
  const source = PART_SOURCE[id];
  const base = source ? metaFor(source) : null;
  const split = SPLIT_META[id];
  if (split) {
    return {
      label: split.label,
      assembly: split.assembly,
      material: base?.material ?? "Imported mesh group",
      spec: base?.spec ?? "Imported mesh group",
    };
  }
  if (base) return base;
  return {
    label: id.replace(/_/g, " "),
    assembly: "Other",
    material: "Imported mesh group",
    spec: "Imported mesh group",
  };
}

/**
 * Parts kept on for the stripped sim bike: frame, seat, plastics, and bars.
 * Fork guards and the front fender's neighbours stay off because the fork
 * itself is off — a floating guard reads as a bug, not a stripped bike.
 */
export const DEFAULT_VISIBLE_PARTS = [
  "frame_main",
  "subframe",
  "black_seat",
  "fuel_tank",
  "front_fender",
  "rear_fender",
  "shroud_l",
  "shroud_r",
  "side_panel_l",
  "side_panel_r",
  "rear_cover",
  "front_plate",
  "handlebar",
  "grip_l",
  "grip_r",
  "bar_controls",
  "handguard_l",
  "handguard_r",
  "fork_l",
  "fork_r",
  "triple_clamp",
  "lower_clamp",
  "footpegs",
  "clutch_lever",
  "brake_lever",
  "shift_lever",
  "rear_brake_pedal",
] as const;

export const DEFAULT_HIDDEN_PARTS = ALL_PART_IDS.filter(
  (id) => !(DEFAULT_VISIBLE_PARTS as readonly string[]).includes(id),
);

/**
 * Whole-chassis squat from fork/shock length.
 * The Sketchfab GLB is already in a static-sag pose with no separable fork/swingarm,
 * so motion is the delta from rest — not from full extension.
 */
export function chassisSquat(frontLengthM: number, rearLengthM: number, engaged: boolean) {
  const restFront = 0.205;
  const restRear = 0.208;
  if (!engaged) return { squat: 0, pitch: 0 };
  const suspFront = Number.isFinite(frontLengthM) ? frontLengthM : restFront;
  const suspRear = Number.isFinite(rearLengthM) ? rearLengthM : restRear;
  const forkTravel = Math.max(0, restFront - suspFront);
  const shockTravel = Math.max(0, restRear - suspRear);
  const squat = (forkTravel * 0.35 + shockTravel * 0.4) * 0.55;
  const pitch = (shockTravel - forkTravel) * 0.35;
  return { squat, pitch };
}

export function parseHiddenParts(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return [];
  }
}

/** Bump the key when the default stripped set changes so old full-bike prefs do not stick. */
export const HIDDEN_PARTS_KEY = "mxb-exc-parts-hidden-v10";

export function loadHiddenParts(): string[] {
  if (typeof localStorage === "undefined") return [...DEFAULT_HIDDEN_PARTS];
  const raw = localStorage.getItem(HIDDEN_PARTS_KEY);
  if (raw == null) {
    saveHiddenParts([...DEFAULT_HIDDEN_PARTS]);
    return [...DEFAULT_HIDDEN_PARTS];
  }
  return parseHiddenParts(raw);
}

export function saveHiddenParts(ids: string[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(HIDDEN_PARTS_KEY, JSON.stringify(ids));
}
