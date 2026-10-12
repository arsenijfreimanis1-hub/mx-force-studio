import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { parseUpdates } from "@/lib/mxb/updates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Installed revision for a future website check. Header id in UPDATES.txt. */
export async function GET() {
  try {
    const file = path.join(/*turbopackIgnore: true*/ process.cwd(), "UPDATES.txt");
    const log = parseUpdates(fs.readFileSync(file, "utf8"));
    return NextResponse.json({
      id: log.id,
      date: log.date,
      current: log.entries[0] ?? null,
      history: log.entries,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "UPDATES.txt is missing." },
      { status: 500 },
    );
  }
}
