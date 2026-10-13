/**
 * Locate the MX Bikes track map image for a live session.
 * Looks next to mxbikes.exe and under the user's PiBoSo Documents tree.
 */

import fs from "node:fs";
import path from "node:path";
import { resolveSheetLogDir } from "./plugin-logs.ts";

const MAP_NAMES = [
  "map.png",
  "map.jpg",
  "map.jpeg",
  "minimap.png",
  "minimap.jpg",
  "trackmap.png",
  "trackmap.jpg",
  "map.tga",
  "minimap.tga",
];

function appRoot() {
  return process.cwd();
}

function readPointerPlugins(): string | null {
  try {
    const file = path.join(appRoot(), "plugin", "mxb-plugins-dir.txt");
    if (!fs.existsSync(file)) return null;
    const text = fs.readFileSync(file, "utf8").trim().replace(/^['"]|['"]$/g, "");
    return text || null;
  } catch {
    return null;
  }
}

/** Candidate roots that may contain a `tracks` folder. */
export function trackSearchRoots(): string[] {
  const roots: string[] = [];
  const push = (dir: string | null | undefined) => {
    if (!dir) return;
    const norm = path.resolve(dir);
    if (!roots.includes(norm)) roots.push(norm);
  };

  try {
    const { pluginsDir } = resolveSheetLogDir();
    push(path.dirname(pluginsDir));
    push(path.join(path.dirname(pluginsDir), "tracks"));
  } catch {
    /* ignore */
  }

  const pointer = readPointerPlugins();
  if (pointer) {
    push(path.dirname(pointer));
    push(path.join(path.dirname(pointer), "tracks"));
  }

  const env = process.env.MXB_PLUGINS_DIR?.trim();
  if (env) {
    push(path.dirname(env));
    push(path.join(path.dirname(env), "tracks"));
  }

  const home = process.env.USERPROFILE || process.env.HOME || "";
  if (home) {
    push(path.join(home, "Documents", "PiBoSo", "MX Bikes", "tracks"));
    push(path.join(home, "Documents", "PiBoSo", "MX Bikes"));
  }

  push("D:\\New folder\\steamapps\\common\\MX Bikes\\tracks");
  push("C:\\Program Files (x86)\\Steam\\steamapps\\common\\MX Bikes\\tracks");
  push("C:\\Program Files\\Steam\\steamapps\\common\\MX Bikes\\tracks");

  return roots;
}

function slugParts(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function scoreDirName(dirName: string, trackId: string, trackName: string) {
  const dir = dirName.toLowerCase();
  const id = trackId.toLowerCase();
  const name = trackName.toLowerCase();
  if (id && (dir === id || dir.includes(id) || id.includes(dir))) return 100;
  if (name && (dir === name || dir.includes(name))) return 80;
  const parts = slugParts(trackName);
  if (parts.length && parts.every((p) => dir.includes(p))) return 60;
  if (parts.some((p) => p.length > 3 && dir.includes(p))) return 30;
  return 0;
}

function findMapInDir(dir: string): string | null {
  try {
    const names = fs.readdirSync(dir);
    const lower = new Map(names.map((n) => [n.toLowerCase(), n]));
    for (const want of MAP_NAMES) {
      const hit = lower.get(want);
      if (hit) return path.join(dir, hit);
    }
    // Any png/jpg that looks like a map
    for (const name of names) {
      const l = name.toLowerCase();
      if (!/\.(png|jpg|jpeg|tga|bmp)$/.test(l)) continue;
      if (l.includes("map") || l.includes("mini") || l.includes("track")) {
        return path.join(dir, name);
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

export type TrackMapHit = {
  file: string;
  trackId: string;
  trackName: string;
  folder: string;
};

/** Best map image for this track, or null when the install has none we can read. */
export function findTrackMap(trackId: string, trackName: string): TrackMapHit | null {
  const id = (trackId || "").trim();
  const name = (trackName || "").trim();
  if (!id && !name) return null;

  let best: { score: number; file: string; folder: string } | null = null;

  for (const root of trackSearchRoots()) {
    let entries: fs.Dirent[];
    try {
      if (!fs.existsSync(root)) continue;
      const st = fs.statSync(root);
      if (st.isFile()) continue;
      entries = fs.readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }

    // Root itself might be the tracks folder, or a single track folder.
    const direct = findMapInDir(root);
    if (direct) {
      const score = scoreDirName(path.basename(root), id, name) + 10;
      if (!best || score > best.score) best = { score, file: direct, folder: root };
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const folder = path.join(root, entry.name);
      const score = scoreDirName(entry.name, id, name);
      if (score < 30) continue;
      const file = findMapInDir(folder);
      if (!file) continue;
      if (!best || score > best.score) best = { score, file, folder };
    }
  }

  if (!best) return null;
  return { file: best.file, trackId: id, trackName: name, folder: best.folder };
}

export function mimeForMap(file: string) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".bmp") return "image/bmp";
  if (ext === ".tga") return "image/x-tga";
  return "application/octet-stream";
}
