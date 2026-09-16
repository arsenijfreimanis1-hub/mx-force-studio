import { DEFAULT_EVENT, restTelemetry } from "./defaults";
import type { SandboxInputs, ScenarioId, Telemetry } from "./types";

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function smooth(t: number) {
  const x = ((t % 1) + 1) % 1;
  return 0.5 - 0.5 * Math.cos(x * Math.PI * 2);
}

export const SCENARIOS: { id: ScenarioId; name: string; blurb: string }[] = [
  { id: "parked", name: "Parked", blurb: "Idle on the pegs. Weight through both tires, 1G down." },
  { id: "launch", name: "Holeshot", blurb: "Clutch dump. Rear unloads the front and the chain pulls hard." },
  { id: "brake", name: "Hard braking", blurb: "Front dives, rear gets light, long G points backward." },
  { id: "left-rut", name: "Left rut", blurb: "Leaned over in a rut. Lateral G and camber thrust." },
  { id: "right-berm", name: "Right berm", blurb: "Banked right-hander. Look at the inside vs outside load." },
  { id: "whoops", name: "Whoops", blurb: "Oscillating fork and shock. Damping is the whole game." },
  { id: "jump", name: "In the air", blurb: "Both tires unloaded. Gravity still acts; normals go to zero." },
  { id: "landing", name: "Jump landing", blurb: "Vertical G spike. Forks and shock eat the hit." },
  { id: "wheelie", name: "Wheelie", blurb: "Front in the air, all drive and weight on the rear." },
  { id: "sandbox", name: "Sandbox", blurb: "Drag each input yourself and watch the force arrows." },
];

export function telemetryFromSandbox(inputs: SandboxInputs, time: number): Telemetry {
  const speedMs = inputs.speedKph / 3.6;
  const maxF = DEFAULT_EVENT.suspMaxTravel[0];
  const maxR = DEFAULT_EVENT.suspMaxTravel[1];
  const frontLen = maxF * (1 - clamp(inputs.frontTravel, 0, 0.95));
  const rearLen = maxR * (1 - clamp(inputs.rearTravel, 0, 0.95));
  const frontContact = inputs.pitch < 18;
  const rearContact = inputs.pitch > -14;
  const longG =
    inputs.throttle * 0.72 * (inputs.gear > 0 ? 1 : 0.15) -
    inputs.frontBrake * 1.05 -
    inputs.rearBrake * 0.35;
  const latG = -Math.sin((inputs.lean * Math.PI) / 180) * clamp(speedMs / 18, 0, 1.4);
  const vertG = frontContact || rearContact ? 1 + inputs.frontTravel * 0.4 + inputs.rearTravel * 0.35 : 0.08;
  const wheelie = inputs.pitch > 12;
  const stoppie = inputs.pitch < -8;

  return restTelemetry({
    rpm: inputs.rpm,
    gear: inputs.gear,
    speedMs,
    accelG: {
      x: latG,
      y: vertG,
      z: longG,
    },
    pitch: inputs.pitch,
    roll: -inputs.lean,
    yawRate: inputs.steer * 0.4,
    rollRate: inputs.lean * 0.15,
    pitchRate: 0,
    suspLength: [frontLen, rearLen],
    suspVelocity: [0, 0],
    steer: inputs.steer,
    throttle: inputs.throttle,
    frontBrake: inputs.frontBrake,
    rearBrake: inputs.rearBrake,
    clutch: inputs.gear === 0 ? 0.85 : 0,
    wheelSpeed: [
      speedMs * (stoppie ? 0.2 : 1) * (1 - inputs.frontBrake * 0.35),
      speedMs * (1 + inputs.throttle * 0.28) * (wheelie ? 1.15 : 1),
    ],
    wheelMaterial: [frontContact ? 3 : 0, rearContact ? 3 : 0],
    brakePressureKpa: [inputs.frontBrake * 1650, inputs.rearBrake * 980],
    steerTorqueNm: inputs.steer * 0.55 + latG * 8,
    time,
    trackPos: (time * 0.02) % 1,
  });
}

export function telemetryForScenario(id: ScenarioId, time: number, sandbox: SandboxInputs): Telemetry {
  if (id === "sandbox") return telemetryFromSandbox(sandbox, time);

  const t = time;
  const wave = Math.sin(t * 2.2);
  const pulse = 0.5 + 0.5 * Math.sin(t * 1.4);

  switch (id) {
    case "parked":
      return restTelemetry({
        time: t,
        rpm: 1780 + wave * 40,
        suspLength: [0.208, 0.212],
      });
    case "launch": {
      const throttle = lerp(0.2, 1, clamp(pulse, 0, 1));
      const speed = lerp(4, 18, pulse);
      return restTelemetry({
        time: t,
        rpm: lerp(4800, 12800, pulse),
        gear: pulse > 0.65 ? 2 : 1,
        speedMs: speed,
        accelG: { x: 0, y: 0.82, z: lerp(0.55, 0.95, pulse) },
        pitch: lerp(6, 14, pulse),
        suspLength: [0.27, 0.145],
        suspVelocity: [0.04, -0.18],
        throttle,
        clutch: lerp(0.4, 0.02, pulse),
        wheelSpeed: [speed * 0.92, speed * 1.22],
        wheelMaterial: [3, 3],
        steerTorqueNm: wave * 6,
      });
    }
    case "brake": {
      const speed = lerp(22, 7, pulse);
      return restTelemetry({
        time: t,
        rpm: 5400,
        gear: 3,
        speedMs: speed,
        accelG: { x: 0.05 * wave, y: 1.15, z: lerp(-0.7, -1.15, pulse) },
        pitch: lerp(-4, -9, pulse),
        suspLength: [0.11, 0.26],
        suspVelocity: [-0.12, 0.05],
        throttle: 0,
        frontBrake: lerp(0.55, 1, pulse),
        rearBrake: 0.35,
        wheelSpeed: [speed * 0.72, speed * 0.88],
        brakePressureKpa: [1400, 420],
        steerTorqueNm: 4,
      });
    }
    case "left-rut": {
      const speed = 14 + wave * 1.5;
      const lean = 32 + wave * 6;
      return restTelemetry({
        time: t,
        rpm: 9800,
        gear: 3,
        speedMs: speed,
        accelG: { x: -(0.85 + wave * 0.12), y: 1.08, z: 0.18 },
        roll: lean,
        steer: -8,
        throttle: 0.62,
        suspLength: [0.17, 0.16],
        wheelSpeed: [speed, speed * 1.02],
        steerTorqueNm: -18,
      });
    }
    case "right-berm": {
      const speed = 16 + wave * 1.2;
      const lean = -28 - wave * 5;
      return restTelemetry({
        time: t,
        rpm: 10400,
        gear: 3,
        speedMs: speed,
        accelG: { x: -0.78 + wave * 0.1, y: 1.2, z: 0.22 },
        roll: lean,
        steer: 11,
        throttle: 0.7,
        suspLength: [0.155, 0.15],
        wheelSpeed: [speed * 1.01, speed],
        steerTorqueNm: 16,
      });
    }
    case "whoops": {
      const bump = Math.sin(t * 10.5);
      const bump2 = Math.sin(t * 10.5 + 0.9);
      const speed = 15;
      return restTelemetry({
        time: t,
        rpm: 7800,
        gear: 3,
        speedMs: speed,
        accelG: { x: 0, y: 1 + bump * 0.85, z: 0.12 },
        pitch: bump * 4,
        suspLength: [0.2 + bump * 0.07, 0.2 + bump2 * 0.08],
        suspVelocity: [bump * 1.4, bump2 * 1.6],
        throttle: 0.55,
        wheelSpeed: [speed, speed],
      });
    }
    case "jump":
      return restTelemetry({
        time: t,
        rpm: 11800,
        gear: 4,
        speedMs: 21,
        accelG: { x: 0.04 * wave, y: 0.06, z: 0.04 },
        pitch: 8 + wave * 4,
        roll: wave * 3,
        suspLength: [0.305, 0.31],
        suspVelocity: [0, 0],
        throttle: 0.25,
        wheelSpeed: [18, 19],
        wheelMaterial: [0, 0],
        steer: wave * 6,
      });
    case "landing": {
      const hit = 0.55 + 0.45 * smooth(t * 0.35);
      return restTelemetry({
        time: t,
        rpm: 6400,
        gear: 3,
        speedMs: 17,
        accelG: { x: 0, y: lerp(1.4, 3.2, hit), z: -0.15 },
        pitch: lerp(-2, -7, hit),
        suspLength: [lerp(0.12, 0.06, hit), lerp(0.11, 0.05, hit)],
        suspVelocity: [0.9, 1.1],
        throttle: 0.15,
        frontBrake: 0.08,
        wheelSpeed: [17, 17],
      });
    }
    case "wheelie": {
      const up = 0.6 + 0.4 * pulse;
      const speed = 11 + pulse * 4;
      return restTelemetry({
        time: t,
        rpm: lerp(8200, 13200, pulse),
        gear: 2,
        speedMs: speed,
        accelG: { x: 0.05 * wave, y: 0.55, z: 0.48 },
        pitch: lerp(18, 28, up),
        suspLength: [0.31, 0.13],
        throttle: 0.78,
        clutch: 0,
        wheelSpeed: [2, speed * 1.18],
        wheelMaterial: [0, 3],
        steer: wave * 4,
        steerTorqueNm: wave * 10,
      });
    }
    default:
      return restTelemetry({ time: t });
  }
}
