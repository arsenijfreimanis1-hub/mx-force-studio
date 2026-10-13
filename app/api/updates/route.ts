import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { parseUpdates } from "@/lib/mxb/updates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readBuiltRevision(root: string) {
  const built = path.join(/*turbopackIgnore: true*/ root, ".next", "app-revision.txt");
  try {
    if (fs.existsSync(built)) return fs.readFileSync(built, "utf8").trim();
  } catch {
    /* ignore */
  }
  return "";
}

/** Installed revision from UPDATES.txt, plus whether the running build matches it. */
export async function GET() {
  try {
    const root = process.cwd();
    const file = path.join(/*turbopackIgnore: true*/ root, "UPDATES.txt");
    const log = parseUpdates(fs.readFileSync(file, "utf8"));
    const builtId = readBuiltRevision(root);
    const outdated = Boolean(log.id) && Boolean(builtId) && builtId !== log.id;
    return NextResponse.json({
      id: log.id,
      date: log.date,
      builtId,
      outdated,
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
