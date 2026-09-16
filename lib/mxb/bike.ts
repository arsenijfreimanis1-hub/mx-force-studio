import type { BikeEvent } from "./types";

/** YZ250F-class 250F chassis. Wet bike ~105 kg; rider assumed 75 kg. */
export const DEFAULT_MASS_KG = 180;
export const DEFAULT_WHEELBASE_M = 1.476;
export const DEFAULT_CG_HEIGHT_M = 0.56;
export const GRAVITY = 9.80665;

export const FRONT_Z = 0.748;
export const REAR_Z = -0.728;
export const FRONT_R = 0.35;
export const REAR_R = 0.32;

export const DEFAULT_EVENT: BikeEvent = {
  riderName: "You",
  bikeId: "250f",
  bikeName: "250 4-stroke",
  gears: 5,
  maxRpm: 14000,
  limiter: 14400,
  shiftRpm: 12800,
  maxFuel: 6.1,
  suspMaxTravel: [0.31, 0.312],
  steerLock: 48,
  category: "MX2",
  trackId: "studio",
  trackName: "Force studio",
  trackLength: 0,
};
