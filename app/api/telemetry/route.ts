import { NextResponse } from "next/server";
import type { BikeEvent, LivePacket, SessionInfo, Telemetry } from "@/lib/mxb/types";

const STALE_MS = 600;

type GlobalStore = typeof globalThis & {
  __mxbLivePacket?: LivePacket | null;
};

const g = globalThis as GlobalStore;

function isTelemetry(value: unknown): value is Telemetry {
  if (!value || typeof value !== "object") return false;
  const t = value as Record<string, unknown>;
  return typeof t.speedMs === "number" && typeof t.throttle === "number";
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

export async function GET() {
  const packet = g.__mxbLivePacket ?? null;
  const live = Boolean(packet && Date.now() - packet.receivedAt < STALE_MS);
  return NextResponse.json({
    live,
    packet,
    staleMs: packet ? Date.now() - packet.receivedAt : null,
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<LivePacket>;

  if (!isTelemetry(body.telemetry)) {
    return NextResponse.json(
      { error: "Body must include a telemetry object with speedMs and throttle." },
      { status: 400 },
    );
  }

  const packet: LivePacket = {
    state: body.state ?? 2,
    event: defaultEvent(body.event),
    session: defaultSession(body.session),
    telemetry: body.telemetry,
    receivedAt: Date.now(),
  };

  g.__mxbLivePacket = packet;
  return NextResponse.json({ ok: true, receivedAt: packet.receivedAt });
}
