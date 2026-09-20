#!/usr/bin/env node
/**
 * UDP 47387 → POST /api/telemetry
 * Pair with plugin/mxb_force_studio.dlo on the MX Bikes PC.
 * Latest-wins: if a POST is in flight, older UDP datagrams are dropped.
 */
import dgram from "node:dgram";

const url = process.env.MXB_URL ?? "http://127.0.0.1:43187/api/telemetry";
const port = Number(process.env.MXB_UDP_PORT ?? 47387);

const socket = dgram.createSocket("udp4");
let lastError = 0;
let packets = 0;
let dropped = 0;
let latest = null;
let posting = false;

socket.on("error", (err) => {
  console.error("UDP socket error:", err.message);
});

async function flush() {
  if (posting) return;
  while (latest) {
    const body = latest;
    latest = null;
    posting = true;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (!response.ok && Date.now() - lastError > 4000) {
        lastError = Date.now();
        console.error(`POST ${url} → ${response.status}`);
      }
    } catch (err) {
      if (Date.now() - lastError > 4000) {
        lastError = Date.now();
        console.error(err instanceof Error ? err.message : err);
      }
    } finally {
      posting = false;
    }
  }
}

socket.on("message", (msg) => {
  packets += 1;
  if (latest) dropped += 1;
  latest = msg;
  void flush();
});

socket.bind(port, "0.0.0.0", () => {
  console.log(`MX Bikes Force Studio bridge`);
  console.log(`UDP ${port} → ${url} (latest-wins)`);
  console.log(`Waiting for mxb_force_studio.dlo …`);
});

setInterval(() => {
  if (packets > 0 || dropped > 0) {
    console.log(`${packets} packets forwarded, ${dropped} superseded`);
    packets = 0;
    dropped = 0;
  }
}, 5000);
