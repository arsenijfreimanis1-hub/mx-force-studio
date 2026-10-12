import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { applyBindLine, DEFAULT_PAD_MAP, type PadMap } from "./mxb-binds.ts";

function homeDocs(): string[] {
  const home = os.homedir();
  return [
    path.join(home, "Documents", "PiBoSo", "MX Bikes"),
    path.join(home, "Documents", "MX Bikes"),
    path.join(home, "OneDrive", "Documents", "PiBoSo", "MX Bikes"),
    path.join(home, "OneDrive", "Documents", "MX Bikes"),
  ];
}

function walkFiles(dir: string, out: string[], depth = 0) {
  if (depth > 5 || out.length > 80) return;
  let names: string[] = [];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return;
  }
  for (const name of names) {
    if (name.startsWith(".")) continue;
    const full = path.join(/*turbopackIgnore: true*/ dir, name);
    let st: fs.Stats;
    try {
      st = fs.statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walkFiles(full, out, depth + 1);
    else if (/\.(ini|cfg|txt|xml|json|map|controls)$/i.test(name) && st.size < 2_000_000) {
      out.push(full);
    }
  }
}

export function scrubMxBikesBinds(): { map: PadMap; files: string[] } {
  const files: string[] = [];
  for (const root of homeDocs()) {
    if (fs.existsSync(root)) walkFiles(root, files);
  }
  const pointer = path.join(process.cwd(), "plugin", "mxb-plugins-dir.txt");
  try {
    if (fs.existsSync(pointer)) {
      const plugins = fs.readFileSync(pointer, "utf8").trim();
      const game = path.dirname(plugins);
      walkFiles(game, files);
      walkFiles(path.join(game, "userdata"), files);
    }
  } catch {
    /* ignore */
  }

  const map: PadMap = { ...DEFAULT_PAD_MAP };
  const used: string[] = [];
  for (const file of files) {
    let text = "";
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    if (!/lean|steer|throttle|clutch|sit|stand|joystick|axis|button/i.test(text)) continue;
    const before = JSON.stringify(map);
    for (const line of text.split(/\r?\n/)) applyBindLine(map, line);
    if (JSON.stringify(map) !== before) used.push(file);
  }
  map.source = used.length ? used.map((f) => path.basename(f)).join(", ") : DEFAULT_PAD_MAP.source;
  return { map, files: used };
}
