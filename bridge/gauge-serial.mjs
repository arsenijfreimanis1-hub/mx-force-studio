/**
 * Write gauge lines to an Arduino Uno at 115200 8N1.
 * Servo power stays off the Uno 5 V pin; this stream is logic only.
 */
import { execFile } from "node:child_process";
import fs from "node:fs";
import { promisify } from "node:util";
import { createGaugeMapper } from "./gauge-map.mjs";

const execFileAsync = promisify(execFile);
const BOOT_DELAY_MS = 2000;

export function devicePath(port) {
  const trimmed = String(port).trim();
  if (process.platform === "win32") {
    const com = trimmed.replace(/^\\\\\.\\/i, "");
    return `\\\\.\\${com}`;
  }
  return trimmed;
}

export async function configureGaugePort(port) {
  const trimmed = String(port).trim();
  if (process.platform === "win32") {
    const com = trimmed.replace(/^\\\\\.\\/i, "").replace(/:$/, "");
    await execFileAsync("mode", [`${com}:`, "BAUD=115200", "PARITY=N", "DATA=8", "STOP=1"]);
    return;
  }
  const flag = process.platform === "darwin" ? "-f" : "-F";
  await execFileAsync("stty", [flag, trimmed, "115200", "cs8", "-cstopb", "-parenb", "raw", "-echo"]);
}

export async function openGaugeStream(port) {
  await configureGaugePort(port);
  const path = devicePath(port);
  const stream = fs.createWriteStream(path, { flags: "r+" });
  stream.on("error", (err) => {
    console.error(`Gauge serial ${port}:`, err.message);
  });
  await new Promise((resolve, reject) => {
    stream.once("error", reject);
    stream.once("open", resolve);
  });
  await new Promise((resolve) => setTimeout(resolve, BOOT_DELAY_MS));
  return stream;
}

export function createGaugeSink(port) {
  const mapper = createGaugeMapper();
  let stream = null;
  let ready = false;
  let failed = false;
  let latest = null;

  return {
    async start() {
      try {
        stream = await openGaugeStream(port);
        ready = true;
        if (latest) {
          stream.write(latest);
          latest = null;
        }
        console.log(`Gauge serial ${port} @ 115200 (20 Hz, six needles)`);
      } catch (err) {
        failed = true;
        ready = false;
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Gauge serial ${port} failed: ${message}`);
      }
    },
    offer(raw) {
      if (failed) return;
      const line = mapper.offer(raw);
      if (!line) return;
      if (ready && stream) stream.write(line);
      else latest = line;
    },
  };
}
