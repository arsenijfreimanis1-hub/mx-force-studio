export type Vec3 = {
  x: number;
  y: number;
  z: number;
};

export type Telemetry = {
  rpm: number;
  engineTemp: number;
  waterTemp: number;
  gear: number;
  fuel: number;
  speedMs: number;
  position: Vec3;
  velocity: Vec3;
  /** Chassis-local acceleration in G. X right, Y up, Z forward. */
  accelG: Vec3;
  yaw: number;
  pitch: number;
  roll: number;
  yawRate: number;
  pitchRate: number;
  rollRate: number;
  /** Shock length in meters. 0 = front, 1 = rear. */
  suspLength: [number, number];
  suspVelocity: [number, number];
  crashed: boolean;
  /** Degrees. Negative = right. */
  steer: number;
  throttle: number;
  frontBrake: number;
  rearBrake: number;
  clutch: number;
  wheelSpeed: [number, number];
  /** 0 = not in contact. */
  wheelMaterial: [number, number];
  brakePressureKpa: [number, number];
  steerTorqueNm: number;
  time: number;
  trackPos: number;
};

export type BikeEvent = {
  riderName: string;
  bikeId: string;
  bikeName: string;
  gears: number;
  maxRpm: number;
  limiter: number;
  shiftRpm: number;
  maxFuel: number;
  suspMaxTravel: [number, number];
  steerLock: number;
  category: string;
  trackId: string;
  trackName: string;
  trackLength: number;
};

export type SessionInfo = {
  session: number;
  conditions: number;
  airTemperature: number;
  setupFileName: string;
};

export type LivePacket = {
  state: number;
  event: BikeEvent;
  session: SessionInfo;
  telemetry: Telemetry;
  receivedAt: number;
};

export type ForceId =
  | "gravity"
  | "frontNormal"
  | "rearNormal"
  | "drive"
  | "frontBrake"
  | "rearBrake"
  | "longitudinal"
  | "lateral"
  | "vertical"
  | "fork"
  | "shock"
  | "aero"
  | "steer"
  | "gyro";

export type ForceVector = {
  id: ForceId;
  name: string;
  shortName: string;
  description: string;
  color: string;
  /** Newtons, chassis/world mixed — see origin. */
  magnitude: number;
  /** Unit direction in Three.js space (X right, Y up, Z forward). */
  direction: Vec3;
  /** Application point in bike-local meters. */
  origin: Vec3;
  kind: "force" | "moment";
  unit: "N" | "Nm";
};

export type ForceModel = {
  massKg: number;
  wheelbaseM: number;
  cgHeightM: number;
  airborne: boolean;
  frontContact: boolean;
  rearContact: boolean;
  frontSlip: number;
  rearSlip: number;
  loadFrontN: number;
  loadRearN: number;
  forces: ForceVector[];
};

export type SourceMode = "demo" | "live" | "sandbox";

export type ScenarioId =
  | "parked"
  | "launch"
  | "brake"
  | "left-rut"
  | "right-berm"
  | "whoops"
  | "jump"
  | "landing"
  | "wheelie"
  | "sandbox";

export type SandboxInputs = {
  throttle: number;
  frontBrake: number;
  rearBrake: number;
  steer: number;
  lean: number;
  pitch: number;
  speedKph: number;
  frontTravel: number;
  rearTravel: number;
  rpm: number;
  gear: number;
};
