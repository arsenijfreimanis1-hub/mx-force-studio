import type { BikeEvent, LivePacket, SessionInfo, Telemetry, Vec3 } from "./types";

export const STALE_MS = 150;

type Listener = (packet: LivePacket | null) => void;

type GlobalStore = typeof globalThis & {
  __mxbLivePacket?: LivePacket | null;
  __mxbLiveListeners?: Set<Listener>;
};

const g = globalThis as GlobalStore;

if (!g.__mxbLiveListeners) {
  g.__mxbLiveListeners = new Set();
}

function listeners() {
  return g.__mxbLiveListeners!;
}

export function getLivePacket(): LivePacket | null {
  return g.__mxbLivePacket ?? null;
}

export function packetAgeMs(packet: LivePacket | null, now = Date.now()): number | null {
  if (!packet) return null;
  return now - packet.receivedAt;
}

export function isLive(packet: LivePacket | null, now = Date.now()): boolean {
  if (!packet || packet.state < 1) return false;
  const age = packetAgeMs(packet, now);
  return age != null && age < STALE_MS;
}

export function subscribeLive(listener: Listener): () => void {
  listeners().add(listener);
  return () => {
    listeners().delete(listener);
  };
}

const PLACEHOLDER_BIKE_NAMES = new Set(["live bike", "250 4-stroke", "250 4 stroke", "250f", "live"]);

export function isPlaceholderBikeName(name: string | undefined, bikeId = "") {
  const n = (name ?? "").trim().toLowerCase();
  const id = bikeId.trim().toLowerCase();
  if (!n) return true;
  if (PLACEHOLDER_BIKE_NAMES.has(n)) return true;
  if (id && PLACEHOLDER_BIKE_NAMES.has(id)) return true;
  return false;
}

export function displayBikeName(event: BikeEvent | null | undefined) {
  if (!event || isPlaceholderBikeName(event.bikeName, event.bikeId)) return "";
  return event.bikeName.trim();
}

function defaultEvent(partial?: Partial<BikeEvent>): BikeEvent {
  return {
    riderName: partial?.riderName ?? "",
    bikeId: partial?.bikeId ?? "",
    bikeName: partial?.bikeName ?? "",
    gears: partial?.gears ?? 5,
    maxRpm: partial?.maxRpm ?? 13000,
    limiter: partial?.limiter ?? 13500,
    shiftRpm: partial?.shiftRpm ?? 11500,
    maxFuel: partial?.maxFuel ?? 7,
    suspMaxTravel: partial?.suspMaxTravel ?? [0.31, 0.315],
    steerLock: partial?.steerLock ?? 48,
    category: partial?.category ?? "MX",
    trackId: partial?.trackId ?? "",
    trackName: partial?.trackName ?? "Unknown track",
    trackLength: partial?.trackLength ?? 0,
    eventType: partial?.eventType ?? 0,
  };
}

function defaultSession(partial?: Partial<SessionInfo>): SessionInfo {
  return {
    session: partial?.session ?? 1,
    conditions: partial?.conditions ?? 0,
    airTemperature: partial?.airTemperature ?? 20,
    setupFileName: partial?.setupFileName ?? "",
  };
}

function keepText(next: string | undefined, prev: string, fallback: string) {
  if (typeof next === "string" && next.trim()) return next;
  if (prev.trim()) return prev;
  return fallback;
}

function keepSusp(next: [number, number] | undefined, prev: [number, number]): [number, number] {
  if (!next || next.length < 2) return prev;
  const a = Number(next[0]);
  const b = Number(next[1]);
  if (!(a > 0.05) || !(b > 0.05)) return prev;
  return [a, b];
}

function keepBikeId(next: string | undefined, prev: string) {
  const n = (next ?? "").trim();
  const p = prev.trim();
  if (n && !isPlaceholderBikeName(n, n)) return n;
  if (p && !isPlaceholderBikeName(p, p)) return p;
  return "";
}

function keepBikeName(next: string | undefined, prev: string, nextId = "", prevId = "") {
  const n = (next ?? "").trim();
  const p = prev.trim();
  if (n && !isPlaceholderBikeName(n, nextId)) return n;
  if (p && !isPlaceholderBikeName(p, prevId)) return p;
  return "";
}

/** Switching bikes often sends a partial EventInit; never clobber a good name. */
export function mergeEvent(prev: BikeEvent | undefined, incoming?: Partial<BikeEvent>): BikeEvent {
  const base = defaultEvent(prev);
  if (!incoming) return base;
  return {
    riderName: keepText(incoming.riderName, base.riderName, ""),
    bikeId: keepBikeId(incoming.bikeId, base.bikeId),
    bikeName: keepBikeName(incoming.bikeName, base.bikeName, incoming.bikeId, base.bikeId),
    gears: incoming.gears && incoming.gears > 0 ? incoming.gears : base.gears,
    maxRpm: incoming.maxRpm && incoming.maxRpm > 500 ? incoming.maxRpm : base.maxRpm,
    limiter: incoming.limiter && incoming.limiter > 500 ? incoming.limiter : base.limiter,
    shiftRpm: incoming.shiftRpm && incoming.shiftRpm > 500 ? incoming.shiftRpm : base.shiftRpm,
    maxFuel: incoming.maxFuel && incoming.maxFuel > 0 ? incoming.maxFuel : base.maxFuel,
    suspMaxTravel: keepSusp(incoming.suspMaxTravel, base.suspMaxTravel),
    steerLock: incoming.steerLock && incoming.steerLock > 5 ? incoming.steerLock : base.steerLock,
    category: keepText(incoming.category, base.category, base.category),
    trackId: keepText(incoming.trackId, base.trackId, ""),
    trackName: keepText(incoming.trackName, base.trackName, base.trackName),
    trackLength:
      typeof incoming.trackLength === "number" && incoming.trackLength > 0
        ? incoming.trackLength
        : base.trackLength,
    eventType:
      typeof incoming.eventType === "number" && incoming.eventType > 0
        ? incoming.eventType
        : base.eventType,
  };
}

function vec(v: Vec3 | undefined, fallback: Vec3): Vec3 {
  if (!v || typeof v.x !== "number" || typeof v.y !== "number" || typeof v.z !== "number") {
    return fallback;
  }
  return v;
}

function pair(v: [number, number] | undefined, fallback: [number, number]): [number, number] {
  if (!v || v.length < 2 || typeof v[0] !== "number" || typeof v[1] !== "number") return fallback;
  return [v[0], v[1]];
}

/** Fill holes so a 50cc or a 450 packet still drives the 6DOF deck. */
export function normalizeTelemetry(raw: Telemetry, prev?: Telemetry): Telemetry {
  const p = prev;
  return {
    rpm: Number.isFinite(raw.rpm) ? raw.rpm : (p?.rpm ?? 0),
    engineTemp: Number.isFinite(raw.engineTemp) ? raw.engineTemp : (p?.engineTemp ?? 70),
    waterTemp: Number.isFinite(raw.waterTemp) ? raw.waterTemp : (p?.waterTemp ?? 70),
    gear: Number.isFinite(raw.gear) ? raw.gear : (p?.gear ?? 0),
    fuel: Number.isFinite(raw.fuel) ? raw.fuel : (p?.fuel ?? 0),
    speedMs: Number.isFinite(raw.speedMs) ? raw.speedMs : (p?.speedMs ?? 0),
    position: vec(raw.position, p?.position ?? { x: 0, y: 0, z: 0 }),
    velocity: vec(raw.velocity, p?.velocity ?? { x: 0, y: 0, z: 0 }),
    accelG: vec(raw.accelG, p?.accelG ?? { x: 0, y: 1, z: 0 }),
    yaw: Number.isFinite(raw.yaw) ? raw.yaw : (p?.yaw ?? 0),
    pitch: Number.isFinite(raw.pitch) ? raw.pitch : (p?.pitch ?? 0),
    roll: Number.isFinite(raw.roll) ? raw.roll : (p?.roll ?? 0),
    yawRate: Number.isFinite(raw.yawRate) ? raw.yawRate : (p?.yawRate ?? 0),
    pitchRate: Number.isFinite(raw.pitchRate) ? raw.pitchRate : (p?.pitchRate ?? 0),
    rollRate: Number.isFinite(raw.rollRate) ? raw.rollRate : (p?.rollRate ?? 0),
    suspLength: pair(raw.suspLength, p?.suspLength ?? [0.2, 0.2]),
    suspVelocity: pair(raw.suspVelocity, p?.suspVelocity ?? [0, 0]),
    crashed: Boolean(raw.crashed),
    steer: Number.isFinite(raw.steer) ? raw.steer : (p?.steer ?? 0),
    throttle: Number.isFinite(raw.throttle) ? raw.throttle : (p?.throttle ?? 0),
    frontBrake: Number.isFinite(raw.frontBrake) ? raw.frontBrake : (p?.frontBrake ?? 0),
    rearBrake: Number.isFinite(raw.rearBrake) ? raw.rearBrake : (p?.rearBrake ?? 0),
    clutch: Number.isFinite(raw.clutch) ? raw.clutch : (p?.clutch ?? 0),
    wheelSpeed: pair(raw.wheelSpeed, p?.wheelSpeed ?? [0, 0]),
    wheelMaterial: pair(raw.wheelMaterial, p?.wheelMaterial ?? [0, 0]),
    brakePressureKpa: pair(raw.brakePressureKpa, p?.brakePressureKpa ?? [0, 0]),
    steerTorqueNm: Number.isFinite(raw.steerTorqueNm) ? raw.steerTorqueNm : (p?.steerTorqueNm ?? 0),
    time: Number.isFinite(raw.time) ? raw.time : (p?.time ?? 0),
    trackPos: Number.isFinite(raw.trackPos) ? raw.trackPos : (p?.trackPos ?? 0),
    rot: Array.isArray(raw.rot) && raw.rot.length >= 9 ? raw.rot.slice(0, 9) : p?.rot,
    lapNum: Number.isFinite(raw.lapNum) ? raw.lapNum : (p?.lapNum ?? 0),
    lapInvalid: typeof raw.lapInvalid === "boolean" ? raw.lapInvalid : Boolean(p?.lapInvalid),
    lastLapMs: Number.isFinite(raw.lastLapMs) ? raw.lastLapMs : (p?.lastLapMs ?? 0),
    bestLap: typeof raw.bestLap === "boolean" ? raw.bestLap : Boolean(p?.bestLap),
    split: Number.isFinite(raw.split) ? raw.split : (p?.split ?? 0),
    splitTimeMs: Number.isFinite(raw.splitTimeMs) ? raw.splitTimeMs : (p?.splitTimeMs ?? 0),
    splitBestDiffMs: Number.isFinite(raw.splitBestDiffMs)
      ? raw.splitBestDiffMs
      : (p?.splitBestDiffMs ?? 0),
  };
}

export function ingestLivePacket(body: {
  state?: number;
  event?: Partial<BikeEvent>;
  session?: Partial<SessionInfo>;
  telemetry?: Telemetry;
}): LivePacket {
  const prev = g.__mxbLivePacket;
  const state = body.state ?? 2;
  const packet: LivePacket = {
    state,
    event: mergeEvent(prev?.event, body.event),
    session: defaultSession({ ...prev?.session, ...body.session }),
    telemetry: normalizeTelemetry((body.telemetry ?? prev?.telemetry ?? ({} as Telemetry)) as Telemetry, prev?.telemetry),
    receivedAt: Date.now(),
  };
  g.__mxbLivePacket = packet;
  for (const listener of listeners()) {
    try {
      listener(packet);
    } catch {
      // ignore a broken SSE client
    }
  }
  return packet;
}
