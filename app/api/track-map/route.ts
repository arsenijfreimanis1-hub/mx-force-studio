import { NextResponse } from "next/server";
import fs from "node:fs";
import { findTrackMap, mimeForMap } from "@/lib/mxb/track-map";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const trackId = url.searchParams.get("trackId") ?? "";
  const trackName = url.searchParams.get("trackName") ?? "";
  const hit = findTrackMap(trackId, trackName);
  if (!hit) {
    return NextResponse.json({ ok: false, found: false, trackId, trackName });
  }
  if (url.searchParams.get("meta") === "1") {
    return NextResponse.json({
      ok: true,
      found: true,
      trackId: hit.trackId,
      trackName: hit.trackName,
      folder: hit.folder,
      file: hit.file,
    });
  }
  try {
    const body = new Uint8Array(fs.readFileSync(hit.file));
    return new NextResponse(body, {
      headers: {
        "Content-Type": mimeForMap(hit.file),
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Could not read map." },
      { status: 500 },
    );
  }
}
