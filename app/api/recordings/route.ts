import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { resolveSheetLogDir } from "@/lib/mxb/plugin-logs";
import { recordingMeta, type RecordingFile } from "@/lib/mxb/recording";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function recDir() {
  const info = resolveSheetLogDir();
  const dir = path.join(/*turbopackIgnore: true*/ info.dir, "recordings");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function safeId(id: unknown) {
  return String(id ?? "").replace(/[^a-zA-Z0-9._-]+/g, "").slice(0, 80);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = safeId(url.searchParams.get("id"));
  const dir = recDir();
  try {
    if (id) {
      const file = path.join(dir, `${id}.json`);
      if (!fs.existsSync(file)) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const rec = JSON.parse(fs.readFileSync(file, "utf8")) as RecordingFile;
      return NextResponse.json({ ok: true, recording: rec });
    }
    const list = fs
      .readdirSync(dir)
      .filter((n) => n.endsWith(".json"))
      .map((n) => {
        const rec = JSON.parse(fs.readFileSync(path.join(dir, n), "utf8")) as RecordingFile;
        return recordingMeta(rec);
      })
      .sort((a, b) => b.startedAt - a.startedAt);
    return NextResponse.json({ ok: true, recordings: list, dir });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Could not read recordings." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let rec: RecordingFile;
  try {
    rec = (await request.json()) as RecordingFile;
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }
  if (!rec?.id || !Array.isArray(rec.samples) || rec.samples.length < 2) {
    return NextResponse.json({ error: "Recording needs an id and samples." }, { status: 400 });
  }
  rec.id = safeId(rec.id);
  const dir = recDir();
  const file = path.join(dir, `${rec.id}.json`);
  fs.writeFileSync(file, JSON.stringify(rec), "utf8");
  return NextResponse.json({ ok: true, file, meta: recordingMeta(rec) });
}
