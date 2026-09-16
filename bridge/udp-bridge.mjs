#!/usr/bin/env node
/**
 * UDP 47387 → POST /api/telemetry
 * Pair with plugin/mxb_force_studio.dlo on the MX Bikes PC.
 */
import dgram from "node:dgram";

const url = process.env.MXB_URL ?? "http://127.0.0.1:43187/api/telemetry";
const port = Number(process.env.MXB_UDP_PORT ?? 47387);

const socket = dgram.createSocket("udp4");
let lastError = 0;
let packets = 0;

socket.on("error", (err) => {
  console.error("UDP socket error:", err.message);
});

socket.on("message", async (msg) => {
  packets += 1;
  try {
    const payload = JSON.parse(msg.toString("utf8"));
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
  }
});

socket.bind(port, "0.0.0.0", () => {
  console.log(`MX Bikes Force Studio bridge`);
  console.log(`UDP ${port} → ${url}`);
  console.log(`Waiting for mxb_force_studio.dlo …`);
});

setInterval(() => {
  if (packets > 0) {
    console.log(`${packets} packets forwarded`);
    packets = 0;
  }
}, 5000);
