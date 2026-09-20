/**
 * MX Bikes player inputs as the game exposes them and as a typical
 * Windows Xbox / XInput config binds them (the stock mapping in
 * Documents\PiBoSo\MX Bikes and the in-game Controls screen).
 *
 * Plugin field signs come from PiBoSo `mxb_example.c` / MaxTM:
 *   steer  — degrees, negative = right
 *   lean   — RaceVehicleData m_fLean AND chassis m_fRoll, negative = left
 *   throttle / brakes / clutch — 0..1 (clutch 0 = fully engaged)
 * Setup name is session.m_szSetupFileName (Documents\PiBoSo\MX Bikes\setups).
 */

export const MXB_PLUGIN_INPUTS = {
  throttle: "telemetry.throttle (0–1, RT)",
  frontBrake: "telemetry.frontBrake (0–1, LT)",
  rearBrake: "telemetry.rearBrake (0–1, LB)",
  clutch: "telemetry.clutch (0–1, A; 0 = engaged)",
  steer: "telemetry.steer (degrees, negative = right)",
  lean: "chassis roll (degrees, negative = left)",
} as const;

/** Default Xbox / Standard Gamepad map used by MX Bikes on Windows. */
export const MXB_XBOX_BINDINGS = {
  throttle: { button: 7, axis: 5, label: "RT" },
  frontBrake: { button: 6, axis: 2, label: "LT" },
  rearBrake: { button: 4, label: "LB" },
  clutch: { button: 0, label: "A" },
  steer: { axis: 0, label: "Left stick X" },
  riderLean: { axis: 0, extraAxis: 2, label: "Left / right stick X" },
  riderPitch: { axis: 1, extraAxis: 3, label: "Left / right stick Y" },
} as const;

export function setupLabel(setupFileName: string | undefined) {
  const name = (setupFileName ?? "").trim();
  if (!name) return "";
  return name.replace(/^.*[\\/]/, "");
}
