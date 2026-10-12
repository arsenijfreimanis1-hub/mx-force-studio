import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getLivePacket, isLive, replaceLivePacket } from "./live-store.ts";
import type { LivePacket } from "./types.ts";

function persistPath() {
  const base = process.env.LOCALAPPDATA || os.tmpdir();
  const dir = path.join(/*turbopackIgnore: true*/ base, "MXForceStudio");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(/*turbopackIgnore: true*/ dir, "live-packet.json");
}

export function persistLivePacket(packet: LivePacket) {
  try {
    fs.writeFileSync(persistPath(), JSON.stringify(packet), "utf8");
  } catch {
    /* ignore quota / lock */
  }
}

export function readPersistedLivePacket(): LivePacket | null {
  try {
    const raw = fs.readFileSync(persistPath(), "utf8");
    const packet = JSON.parse(raw) as LivePacket;
    if (!packet || typeof packet.receivedAt !== "number") return null;
    return packet;
  } catch {
    return null;
  }
}

/** POST and GET can land in different Next workers — disk is the source of truth. */
export function getHydratedLivePacket(): LivePacket | null {
  const mem = getLivePacket();
  if (isLive(mem)) return mem;
  const disk = readPersistedLivePacket();
  if (disk && isLive(disk) && (!mem || disk.receivedAt > mem.receivedAt)) {
    replaceLivePacket(disk);
    return disk;
  }
  return mem ?? disk;
}

export function liveFromHydrated() {
  const packet = getHydratedLivePacket();
  return {
    live: isLive(packet),
    packet,
    staleMs: packet ? Date.now() - packet.receivedAt : null,
  };
}
