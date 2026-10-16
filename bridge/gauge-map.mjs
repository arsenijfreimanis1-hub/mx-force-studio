/**
 * Map one MX Bikes UDP JSON datagram to a six-needle servo line.
 * Channels: 0 speed, 1 rpm, 2 throttle, 3 front brake, 4 gear, 5 roll.
 * Angles are degrees 0–180. The Uno only applies them.
 */

const NONFINITE = /(?<![A-Za-z0-9_])-?(?:nan|NaN|Infinity|Inf)(?![A-Za-z0-9_])/g;

export const GAUGE_MIN_MS = 50;
const SPEED_MAX_MS = 30;
const RPM_IDLE = 1950;
const DEFAULT_MAX_RPM = 14000;
const DEFAULT_GEARS = 5;
const ROLL_LIMIT = 60;

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function angle(fraction) {
  return Math.round(clamp01(fraction) * 180);
}

export function mapTelemetry(telemetry, limits) {
  const maxRpm = limits.maxRpm > 500 ? limits.maxRpm : DEFAULT_MAX_RPM;
  const gears = limits.gears > 0 ? limits.gears : DEFAULT_GEARS;
  const rpmSpan = maxRpm - RPM_IDLE;
  return [
    angle(finite(telemetry.speedMs) / SPEED_MAX_MS),
    angle((finite(telemetry.rpm) - RPM_IDLE) / rpmSpan),
    angle(finite(telemetry.throttle)),
    angle(finite(telemetry.frontBrake)),
    angle(finite(telemetry.gear) / gears),
    angle((finite(telemetry.roll) + ROLL_LIMIT) / (ROLL_LIMIT * 2)),
  ];
}

export function formatGaugeLine(angles) {
  return `${angles.map((n) => angle(n / 180)).join(",")}\n`;
}

export function parseGaugeLine(line) {
  const text = String(line).replace(/\r?\n$/, "");
  if (!/^\d{1,3}(,\d{1,3}){5}$/.test(text)) return null;
  const nums = text.split(",").map(Number);
  if (nums.some((n) => n > 180)) return null;
  return nums;
}

export function createGaugeMapper() {
  let maxRpm = DEFAULT_MAX_RPM;
  let gears = DEFAULT_GEARS;
  let lastEmit = -Infinity;

  return {
    offer(raw, now = Date.now()) {
      let packet;
      try {
        const text = Buffer.isBuffer(raw) ? raw.toString("utf8") : String(raw);
        packet = JSON.parse(text.replace(NONFINITE, "0"));
      } catch {
        return null;
      }
      if (!packet || typeof packet !== "object") return null;
      if (packet.event && typeof packet.event === "object") {
        const rpm = Number(packet.event.maxRpm);
        const count = Number(packet.event.gears);
        if (rpm > 500) maxRpm = rpm;
        if (count > 0) gears = count;
      }
      if (packet.state === 0 || !packet.telemetry || typeof packet.telemetry !== "object") {
        return null;
      }
      if (now - lastEmit < GAUGE_MIN_MS) return null;
      lastEmit = now;
      return formatGaugeLine(mapTelemetry(packet.telemetry, { maxRpm, gears }));
    },
  };
}
