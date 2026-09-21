/**
 * Spreadsheet CSVs land next to the MX Bikes plugin on the user's PC.
 * install-plugin.ps1 writes plugin/mxb-plugins-dir.txt with that folder.
 */

import fs from "node:fs";
import path from "node:path";

export const LOG_SUBDIR = "force_studio_logs";
export const POINTER_FILE = path.join("plugin", "mxb-plugins-dir.txt");

export type SheetLogKind = "game" | "plugin";

export type SheetLogDir = {
  dir: string;
  kind: SheetLogKind;
  pluginsDir: string;
};

function appRoot() {
  return process.cwd();
}

function readPointer(): string | null {
  const file = path.join(appRoot(), POINTER_FILE);
  try {
    if (!fs.existsSync(file)) return null;
    const text = fs.readFileSync(file, "utf8").trim().replace(/^['"]|['"]$/g, "");
    if (!text) return null;
    return text;
  } catch {
    return null;
  }
}

function windowsPluginCandidates(): string[] {
  const extra: string[] = [];
  const env = process.env.MXB_PLUGINS_DIR?.trim();
  if (env) extra.push(env);
  extra.push("D:\\New folder\\steamapps\\common\\MX Bikes\\plugins");
  extra.push("C:\\Program Files (x86)\\Steam\\steamapps\\common\\MX Bikes\\plugins");
  extra.push("C:\\Program Files\\Steam\\steamapps\\common\\MX Bikes\\plugins");
  return extra;
}

function ensureLogDir(pluginsDir: string, kind: SheetLogKind): SheetLogDir {
  const dir = path.join(/*turbopackIgnore: true*/ pluginsDir, LOG_SUBDIR);
  fs.mkdirSync(dir, { recursive: true });
  return { dir, kind, pluginsDir };
}

function isUsablePluginsDir(pluginsDir: string) {
  if (!pluginsDir) return false;
  try {
    if (fs.existsSync(pluginsDir)) return true;
    const exe = path.join(path.dirname(pluginsDir), "mxbikes.exe");
    return fs.existsSync(exe);
  } catch {
    return false;
  }
}

export function resolveSheetLogDir(): SheetLogDir {
  const env = process.env.MXB_PLUGINS_DIR?.trim();
  if (env && isUsablePluginsDir(env)) return ensureLogDir(env, "game");

  const pointer = readPointer();
  if (pointer && isUsablePluginsDir(pointer)) return ensureLogDir(pointer, "game");

  for (const candidate of windowsPluginCandidates()) {
    if (candidate === env) continue;
    if (isUsablePluginsDir(candidate)) return ensureLogDir(candidate, "game");
  }

  return ensureLogDir(path.join(appRoot(), "plugin"), "plugin");
}

export function safeSheetName(name: unknown) {
  const raw = String(name ?? "session.csv");
  const base = path.basename(raw).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  const trimmed = base.replace(/^-|-$/g, "") || "session.csv";
  return trimmed.toLowerCase().endsWith(".csv") ? trimmed : `${trimmed}.csv`;
}

export function writeSheetCsv(csv: string, filename: string) {
  if (typeof csv !== "string" || csv.length === 0) {
    throw new Error("CSV body is empty.");
  }
  if (csv.length > 12_000_000) {
    throw new Error("CSV is too large to save.");
  }
  const info = resolveSheetLogDir();
  const name = safeSheetName(filename);
  const file = path.join(/*turbopackIgnore: true*/ info.dir, name);
  fs.writeFileSync(file, csv, "utf8");
  return { ok: true as const, file, name, ...info };
}
