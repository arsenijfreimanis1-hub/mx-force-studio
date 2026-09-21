/** Motorcycle ladder: tilt first, then heave, shove, sway, yaw. */
export type DofLevel = 2 | 3 | 4 | 5 | 6;

export type DofAxes = {
  roll: boolean;
  pitch: boolean;
  yaw: boolean;
  x: boolean;
  y: boolean;
  z: boolean;
};

export function clampDof(n: unknown): DofLevel {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v) || v <= 2) return 2;
  if (v >= 6) return 6;
  return v as DofLevel;
}

export function dofAxes(dof: DofLevel): DofAxes {
  return {
    roll: true,
    pitch: true,
    yaw: dof >= 6,
    y: dof >= 3,
    z: dof >= 4,
    x: dof >= 5,
  };
}

export const DOF_STEPS: {
  dof: DofLevel;
  title: string;
  adds: string;
  hint: string;
}[] = [
  { dof: 2, title: "2DOF", adds: "Lean + pitch", hint: "Berms and gas / brake only." },
  { dof: 3, title: "3DOF", adds: "+ Heave", hint: "Jumps and whoops lift the deck." },
  { dof: 4, title: "4DOF", adds: "+ Surge", hint: "Throttle shoves forward, brakes pull back." },
  { dof: 5, title: "5DOF", adds: "+ Sway", hint: "Side-to-side on ruts and landings." },
  { dof: 6, title: "6DOF", adds: "+ Yaw", hint: "All six axes. Crank the sliders if it still feels small." },
];

export function dofStep(dof: DofLevel) {
  return DOF_STEPS[clampDof(dof) - 2] ?? DOF_STEPS[0];
}

export function maskPose<T extends { x: number; y: number; z: number; yaw: number; pitch: number; roll: number }>(
  pose: T,
  dof: DofLevel,
): T {
  const a = dofAxes(dof);
  return {
    x: a.x ? pose.x : 0,
    y: a.y ? pose.y : 0,
    z: a.z ? pose.z : 0,
    yaw: a.yaw ? pose.yaw : 0,
    pitch: a.pitch ? pose.pitch : 0,
    roll: a.roll ? pose.roll : 0,
  };
}

/** Visual follow. Override with travel.visualTau when the rider wants it snappier. */
export function visualPoseTau(dof: DofLevel, visualTau?: number) {
  if (visualTau != null && Number.isFinite(visualTau) && visualTau > 0) {
    return Math.min(0.25, Math.max(0.008, visualTau));
  }
  if (dof <= 2) return 0.026;
  if (dof <= 3) return 0.04;
  if (dof <= 4) return 0.055;
  return 0.04;
}

export const DOF_STORAGE_KEY = "mxb-force-studio.dof.v2";

export function loadStoredDof(fallback: DofLevel = 6): DofLevel {
  try {
    if (typeof localStorage === "undefined") return fallback;
    const raw = localStorage.getItem(DOF_STORAGE_KEY);
    if (raw == null) return fallback;
    return clampDof(raw);
  } catch {
    return fallback;
  }
}

export function saveStoredDof(dof: DofLevel) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(DOF_STORAGE_KEY, String(dof));
  } catch {
    // quota / private mode
  }
}
