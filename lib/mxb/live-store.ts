import type { BikeEvent, LivePacket, SessionInfo, Telemetry } from "./types";

export const STALE_MS = 350;

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
  const age = packetAgeMs(packet, now);
  return age != null && age < STALE_MS;
}

export function subscribeLive(listener: Listener): () => void {
  listeners().add(listener);
  return () => {
    listeners().delete(listener);
  };
}

function defaultEvent(partial?: Partial<BikeEvent>): BikeEvent {
  return {
    riderName: partial?.riderName ?? "MX Bikes",
    bikeId: partial?.bikeId ?? "live",
    bikeName: partial?.bikeName ?? "Live bike",
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

export function ingestLivePacket(body: {
  state?: number;
  event?: Partial<BikeEvent>;
  session?: Partial<SessionInfo>;
  telemetry: Telemetry;
}): LivePacket {
  const packet: LivePacket = {
    state: body.state ?? 2,
    event: defaultEvent(body.event),
    session: defaultSession(body.session),
    telemetry: body.telemetry,
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
