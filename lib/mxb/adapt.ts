import type { FrameTravel } from "./motion";
import type { Telemetry } from "./types";

const STORAGE_PREFIX = "mxb-force-studio.profile.";
const LEARN_SECONDS = 20;
const GRAVITY = 9.80665;
const EMA_TAU = 0.6;
const DEFAULT_SMOOTH_TAU = 0.05;
const LIMIT_ROLL = (40 * Math.PI) / 180;

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export type BikeProfile = {
  bikeId: string;
  bikeName: string;
  /** Learned cue gain. 1 = default. */
  response: number;
  smoothTau: number;
  forceIsMs2: boolean | null;
  rollSign: 1 | -1;
  movingSeconds: number;
  samples: number;
  emaAx: number;
  emaAyDev: number;
  emaAz: number;
  emaRoll: number;
  emaPitchRate: number;
  peakAx: number;
  peakAyDev: number;
  peakAz: number;
  peakRoll: number;
  learned: boolean;
  updatedAt: number;
};

export function defaultProfile(bikeId = "live", bikeName = "Live bike"): BikeProfile {
  return {
    bikeId,
    bikeName,
    response: 1,
    smoothTau: DEFAULT_SMOOTH_TAU,
    forceIsMs2: null,
    rollSign: 1,
    movingSeconds: 0,
    samples: 0,
    emaAx: 0,
    emaAyDev: 0,
    emaAz: 0,
    emaRoll: 0,
    emaPitchRate: 0,
    peakAx: 0,
    peakAyDev: 0,
    peakAz: 0,
    peakRoll: 0,
    learned: false,
    updatedAt: 0,
  };
}

function browserStorage(): StorageLike | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function profileKey(bikeId: string) {
  return `${STORAGE_PREFIX}${bikeId || "live"}`;
}

export function loadProfile(
  bikeId: string,
  bikeName = "Live bike",
  storage: StorageLike | null = browserStorage(),
): BikeProfile {
  const fallback = defaultProfile(bikeId, bikeName);
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(profileKey(bikeId));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<BikeProfile>;
    return { ...fallback, ...parsed, bikeId, bikeName: parsed.bikeName || bikeName };
  } catch {
    return fallback;
  }
}

export function saveProfile(profile: BikeProfile, storage: StorageLike | null = browserStorage()) {
  if (!storage) return;
  try {
    storage.setItem(profileKey(profile.bikeId), JSON.stringify(profile));
  } catch {
    // quota / private mode
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function asG(value: number, forceIsMs2: boolean | null) {
  return forceIsMs2 ? value / GRAVITY : value;
}

export function isParked(tel: Telemetry) {
  return tel.speedMs < 0.45 && tel.throttle < 0.04 && !tel.crashed;
}

export function isMoving(tel: Telemetry, forceIsMs2: boolean | null = null) {
  return (
    tel.speedMs > 2 ||
    Math.abs(asG(tel.accelG.y, forceIsMs2) - 1) > 0.18 ||
    Math.abs(asG(tel.accelG.z, forceIsMs2)) > 0.25 ||
    Math.abs(tel.roll) > 8
  );
}

/**
 * Parked lock: G vs m/s², and whether MX Bikes roll is flipped vs the garage.
 */
export function lockParkedUnits(profile: BikeProfile, tel: Telemetry): BikeProfile {
  if (!isParked(tel)) return profile;
  const mag = Math.hypot(tel.accelG.x, tel.accelG.y, tel.accelG.z);
  let forceIsMs2 = profile.forceIsMs2;
  if (mag > 6.5) forceIsMs2 = true;
  else if (mag > 0.55 && mag < 1.8) forceIsMs2 = false;

  let rollSign = profile.rollSign;
  const rollRad = (tel.roll * Math.PI) / 180;
  if (Math.abs(tel.roll) > 6) {
    const ax = asG(tel.accelG.x, forceIsMs2);
    const expected = -Math.sin(rollRad);
    if (Math.abs(ax) > 0.08 && Math.abs(expected) > 0.08) {
      rollSign = Math.sign(ax) === Math.sign(expected) ? 1 : -1;
    }
  }
  return { ...profile, forceIsMs2, rollSign };
}

function applyLearnedGain(profile: BikeProfile): BikeProfile {
  const p95G = Math.max(profile.peakAx, profile.peakAz, profile.peakAyDev) * 0.85;
  const p95RollDeg = profile.peakRoll * 0.85;
  let gGain = 1;
  if (p95G > 0.15) gGain = 0.8 / p95G;
  const rollRad = (p95RollDeg * Math.PI) / 180;
  let rollGain = 1;
  if (rollRad > 0.05) {
    rollGain = (0.8 * LIMIT_ROLL) / (rollRad * 0.9);
  }
  const response = clamp((gGain + rollGain) / 2, 0.35, 1.8);
  const smoothTau = clamp(0.035 + (profile.emaPitchRate / 400) * 0.08, 0.03, 0.12);
  return { ...profile, response, smoothTau, learned: true };
}

/** EMA peaks from live telemetry. Call at ~1 Hz (dt ≈ 1) or per packet with real dt. */
export function observeTelemetry(profile: BikeProfile, tel: Telemetry, dt: number): BikeProfile {
  const step = Math.min(2, Math.max(0.001, dt));
  let next = lockParkedUnits(
    { ...profile, bikeName: profile.bikeName },
    tel,
  );
  const ax = Math.abs(asG(tel.accelG.x, next.forceIsMs2));
  const ayDev = Math.abs(asG(tel.accelG.y, next.forceIsMs2) - 1);
  const az = Math.abs(asG(tel.accelG.z, next.forceIsMs2));
  const roll = Math.abs(tel.roll);
  const pitchRate = Math.abs(tel.pitchRate);
  const a = 1 - Math.exp(-step / EMA_TAU);
  const decay = Math.pow(0.997, step * 60);

  next = {
    ...next,
    emaAx: next.emaAx + (ax - next.emaAx) * a,
    emaAyDev: next.emaAyDev + (ayDev - next.emaAyDev) * a,
    emaAz: next.emaAz + (az - next.emaAz) * a,
    emaRoll: next.emaRoll + (roll - next.emaRoll) * a,
    emaPitchRate: next.emaPitchRate + (pitchRate - next.emaPitchRate) * a,
    peakAx: Math.max(next.peakAx * decay, ax),
    peakAyDev: Math.max(next.peakAyDev * decay, ayDev),
    peakAz: Math.max(next.peakAz * decay, az),
    peakRoll: Math.max(next.peakRoll * decay, roll),
    samples: next.samples + 1,
  };

  if (isMoving(tel, next.forceIsMs2) && !tel.crashed) {
    next.movingSeconds += step;
  }
  if (next.movingSeconds >= LEARN_SECONDS) {
    next = applyLearnedGain(next);
  }
  next.updatedAt = Date.now();
  return next;
}

export function applyProfileToTravel(travel: FrameTravel, profile: BikeProfile): FrameTravel {
  const learned = profile.learned ? profile.response : 1;
  return {
    ...travel,
    response: clamp(travel.response * learned, 0.05, 3),
    smoothTau: profile.learned ? profile.smoothTau : travel.smoothTau,
  };
}

export function applyProfileToTelemetry(tel: Telemetry, profile: BikeProfile): Telemetry {
  const accel =
    profile.forceIsMs2 === true
      ? {
          x: tel.accelG.x / GRAVITY,
          y: tel.accelG.y / GRAVITY,
          z: tel.accelG.z / GRAVITY,
        }
      : tel.accelG;
  if (profile.rollSign === 1 && profile.forceIsMs2 !== true) return tel;
  return {
    ...tel,
    accelG: accel,
    roll: tel.roll * profile.rollSign,
    rollRate: tel.rollRate * profile.rollSign,
  };
}
