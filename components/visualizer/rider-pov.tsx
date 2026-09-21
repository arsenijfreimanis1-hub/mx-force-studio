"use client";

import { useLayoutEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import type { MutableRefObject } from "react";
import * as THREE from "three";
import { isRiderPad, readBodyStick, readFirstGamepad } from "@/lib/mxb/gamepad";
import { riderFromTelemetry } from "@/lib/mxb/rider";
import type { Telemetry } from "@/lib/mxb/types";

function follow(current: number, target: number, dt: number, tau: number) {
  if (tau <= 1e-4) return target;
  return current + (target - current) * (1 - Math.exp(-Math.min(0.05, dt) / tau));
}

/**
 * MX Bikes first-person dynamic: helmet cam parented to the rider pose,
 * looks chassis-forward, leans with the dummy, stands up off the seat.
 */
export function RiderPov({
  enabled,
  telemetryRef,
}: {
  enabled: boolean;
  telemetryRef: MutableRefObject<Telemetry>;
}) {
  const cam = useRef<THREE.PerspectiveCamera>(null);
  const set = useThree((s) => s.set);
  const garageCam = useThree((s) => s.camera);
  const look = useRef({
    x: 0,
    y: 0.7,
    z: 0.12,
    pitch: -0.1,
    yaw: Math.PI,
    roll: 0,
  });

  useLayoutEffect(() => {
    if (enabled && cam.current) set({ camera: cam.current });
    else set({ camera: garageCam });
  }, [enabled, set, garageCam]);

  useFrame((_, dt) => {
    const node = cam.current;
    if (!enabled || !node) return;
    const tel = telemetryRef.current;
    const gp = readFirstGamepad();
    const rider = riderFromTelemetry(tel, readBodyStick(isRiderPad(gp) ? gp : null));
    const steer = (tel.steer * Math.PI) / 180;
    const wantX = rider.lean * 0.1;
    const wantY = 0.66 + rider.stand * 0.18;
    const wantZ = 0.08 + rider.foreAft;
    const wantPitch =
      -0.08 -
      rider.stand * 0.05 +
      rider.foreAft * 0.55 +
      ((tel.pitch * Math.PI) / 180) * 0.16;
    const wantYaw = Math.PI - steer * 0.28 + ((tel.yawRate * Math.PI) / 180) * 0.04 - rider.lean * 0.45;
    const wantRoll = rider.lean * 0.32 + ((tel.roll * Math.PI) / 180) * 0.08;
    const s = look.current;
    const step = Math.min(0.05, Math.max(0.0005, dt));
    s.x = follow(s.x, wantX, step, 0.05);
    s.y = follow(s.y, wantY, step, 0.06);
    s.z = follow(s.z, wantZ, step, 0.05);
    s.pitch = follow(s.pitch, wantPitch, step, 0.05);
    s.yaw = follow(s.yaw, wantYaw, step, 0.045);
    s.roll = follow(s.roll, wantRoll, step, 0.055);
    node.position.set(s.x, s.y, s.z);
    node.rotation.set(s.pitch, s.yaw, s.roll, "YXZ");
    const fov = 70 + rider.stand * 4;
    if (Math.abs(node.fov - fov) > 0.2) {
      node.fov = fov;
      node.updateProjectionMatrix();
    }
  });

  if (!enabled) return null;
  return <PerspectiveCamera ref={cam} makeDefault fov={72} near={0.04} far={56} />;
}
