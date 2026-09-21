import { NextResponse } from "next/server";
import { readLatestSheet, resolveSheetLogDir, writeSheetCsv } from "@/lib/mxb/plugin-logs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const info = resolveSheetLogDir();
    const latest = readLatestSheet();
    return NextResponse.json({
      ok: true,
      dir: info.dir,
      pluginsDir: info.pluginsDir,
      kind: info.kind,
      latestName: latest?.name ?? "",
      latestFile: latest?.file ?? "",
      latestCsv: latest?.csv ?? "",
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Could not resolve log folder." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let body: { csv?: unknown; filename?: unknown };
  try {
    body = (await request.json()) as { csv?: unknown; filename?: unknown };
  } catch {
    return NextResponse.json({ error: "Body must be JSON with csv." }, { status: 400 });
  }

  if (typeof body.csv !== "string" || body.csv.length < 8) {
    return NextResponse.json({ error: "Body must include a csv string." }, { status: 400 });
  }

  try {
    const saved = writeSheetCsv(body.csv, String(body.filename ?? "session.csv"));
    return NextResponse.json(saved);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not save spreadsheet." },
      { status: 500 },
    );
  }
}
