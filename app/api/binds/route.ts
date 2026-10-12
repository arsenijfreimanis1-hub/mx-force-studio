import { NextResponse } from "next/server";
import { scrubMxBikesBinds } from "@/lib/mxb/mxb-binds-node";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { map, files } = scrubMxBikesBinds();
    return NextResponse.json({ ok: true, map, files });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Could not read MX Bikes configs." },
      { status: 500 },
    );
  }
}
