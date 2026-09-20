import { NextResponse } from "next/server";
import {
  getLivePacket,
  ingestLivePacket,
  isLive,
  packetAgeMs,
} from "@/lib/mxb/live-store";
import type { LivePacket, Telemetry } from "@/lib/mxb/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isTelemetry(value: unknown): value is Telemetry {
  if (!value || typeof value !== "object") return false;
  const t = value as Record<string, unknown>;
  return typeof t.speedMs === "number" && typeof t.throttle === "number";
}

export async function GET() {
  const packet = getLivePacket();
  return NextResponse.json({
    live: isLive(packet),
    packet,
    staleMs: packetAgeMs(packet),
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

  const packet = ingestLivePacket({
    state: body.state,
    event: body.event,
    session: body.session,
    telemetry: body.telemetry,
  });

  return NextResponse.json({ ok: true, receivedAt: packet.receivedAt });
}
