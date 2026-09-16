import type { BikeEvent, SandboxInputs, SessionInfo, Telemetry } from "./types";

export const DEFAULT_MASS_KG = 186;
export const DEFAULT_WHEELBASE_M = 1.49;
export const DEFAULT_CG_HEIGHT_M = 0.58;
export const GRAVITY = 9.80665;

export const DEFAULT_EVENT: BikeEvent = {
  riderName: "You",
  bikeId: "450f",
  bikeName: "450 4-stroke",
  gears: 5,
  maxRpm: 13400,
  limiter: 13800,
  shiftRpm: 11800,
  maxFuel: 7.2,
  suspMaxTravel: [0.31, 0.315],
  steerLock: 48,
  category: "MX",
  trackId: "studio",
  trackName: "Force studio",
  trackLength: 0,
};

export const DEFAULT_SESSION: SessionInfo = {
  session: 1,
  conditions: 0,
  airTemperature: 21,
  setupFileName: "stock.ssx",
};

export const REST_SUSP: [number, number] = [0.205, 0.21];

export function restTelemetry(partial: Partial<Telemetry> = {}): Telemetry {
  return {
    rpm: 1850,
    engineTemp: 78,
    waterTemp: 72,
    gear: 0,
    fuel: 4.8,
    speedMs: 0,
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    accelG: { x: 0, y: 1, z: 0 },
    yaw: 0,
    pitch: 0,
    roll: 0,
    yawRate: 0,
    pitchRate: 0,
    rollRate: 0,
    suspLength: [...REST_SUSP],
    suspVelocity: [0, 0],
    crashed: false,
    steer: 0,
    throttle: 0,
    frontBrake: 0,
    rearBrake: 0,
    clutch: 0,
    wheelSpeed: [0, 0],
    wheelMaterial: [3, 3],
    brakePressureKpa: [0, 0],
    steerTorqueNm: 0,
    time: 0,
    trackPos: 0,
    ...partial,
  };
}

export const DEFAULT_SANDBOX: SandboxInputs = {
  throttle: 0,
  frontBrake: 0,
  rearBrake: 0,
  steer: 0,
  lean: 0,
  pitch: 0,
  speedKph: 0,
  frontTravel: 0.34,
  rearTravel: 0.33,
  rpm: 1850,
  gear: 0,
};
