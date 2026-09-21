/** Studio motion is always full 6DOF. Older travel JSON still round-trips. */
export type DofLevel = 6;

export type DofAxes = {
  roll: boolean;
  pitch: boolean;
  yaw: boolean;
  x: boolean;
  y: boolean;
  z: boolean;
};

export function clampDof(_n?: unknown): DofLevel {
  return 6;
}

export function dofAxes(_dof?: DofLevel): DofAxes {
  return {
    roll: true,
    pitch: true,
    yaw: true,
    y: true,
    z: true,
    x: true,
  };
}

export const DOF_STEPS: {
  dof: DofLevel;
  title: string;
  adds: string;
  hint: string;
}[] = [
  {
    dof: 6,
    title: "6DOF",
    adds: "Lean, pitch, heave, surge, sway, yaw",
    hint: "All six axes. Use the sliders if the deck feels small.",
  },
];

export function dofStep(_dof?: DofLevel) {
  return DOF_STEPS[0];
}

export function maskPose<T extends { x: number; y: number; z: number; yaw: number; pitch: number; roll: number }>(
  pose: T,
  _dof?: DofLevel,
): T {
  return pose;
}

/** Visual follow. Override with travel.visualTau when the rider wants it snappier. */
export function visualPoseTau(_dof?: DofLevel, visualTau?: number) {
  if (visualTau != null && Number.isFinite(visualTau) && visualTau > 0) {
    return Math.min(0.25, Math.max(0.008, visualTau));
  }
  return 0.04;
}

export const DOF_STORAGE_KEY = "mxb-force-studio.dof.v3";

export function loadStoredDof(_fallback: DofLevel = 6): DofLevel {
  return 6;
}

export function saveStoredDof(_dof?: DofLevel) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(DOF_STORAGE_KEY, "6");
  } catch {
    // quota / private mode
  }
}
