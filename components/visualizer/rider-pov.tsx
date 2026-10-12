"use client";

import { useLayoutEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import type { MutableRefObject } from "react";
import * as THREE from "three";
import { isRiderPad, readBodyStick, readFirstGamepad } from "@/lib/mxb/gamepad";
import type { FrameTravel, Pose6 } from "@/lib/mxb/motion";
import { riderFromTelemetry } from "@/lib/mxb/rider";
import { stageOffset } from "@/lib/mxb/stage";
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
  garageCamRef,
  poseRef,
  travelRef,
}: {
  enabled: boolean;
  telemetryRef: MutableRefObject<Telemetry>;
  garageCamRef: MutableRefObject<THREE.PerspectiveCamera | null>;
  poseRef: MutableRefObject<Pose6>;
  travelRef: MutableRefObject<FrameTravel>;
}) {
  const cam = useRef<THREE.PerspectiveCamera>(null);
  const set = useThree((s) => s.set);
  const look = useRef({
    x: 0,
    y: 1.7,
    z: 0.02,
    pitch: -0.2,
    yaw: Math.PI,
    roll: 0,
  });

  useLayoutEffect(() => {
    if (enabled && cam.current) set({ camera: cam.current });
    else if (garageCamRef.current) set({ camera: garageCamRef.current });
  }, [enabled, set, garageCamRef]);

  useFrame((_, dt) => {
    const node = cam.current;
    if (!enabled || !node) return;
    const tel = telemetryRef.current;
    const gp = readFirstGamepad();
    const rider = riderFromTelemetry(tel, readBodyStick(isRiderPad(gp) ? gp : null));
    const steer = (tel.steer * Math.PI) / 180;
    const wantX = rider.lean * 0.08;
    // Eyes sit just above the 250 SX seat (model seat ~0.92 m, rig lift 0.35 m).
    const wantY = 1.7 + rider.stand * 0.12;
    const wantZ = 0.02 + rider.foreAft;
    const wantPitch =
      -0.2 -
      rider.stand * 0.05 +
      rider.foreAft * 0.35 +
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
    const stage = stageOffset(poseRef.current, travelRef.current);
    const cy = Math.cos(stage.yaw);
    const sy = Math.sin(stage.yaw);
    node.position.set(stage.x + s.x * cy + s.z * sy, s.y, stage.z - s.x * sy + s.z * cy);
    node.rotation.set(s.pitch, s.yaw + stage.yaw, s.roll, "YXZ");
    const fov = 70 + rider.stand * 4;
    if (Math.abs(node.fov - fov) > 0.2) {
      node.fov = fov;
      node.updateProjectionMatrix();
    }
  });

  return (
    <PerspectiveCamera ref={cam} makeDefault={enabled} fov={72} near={0.04} far={280} />
  );
}
