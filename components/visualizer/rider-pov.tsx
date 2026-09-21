"use client";

import { useLayoutEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import type { MutableRefObject } from "react";
import * as THREE from "three";
import type { Telemetry } from "@/lib/mxb/types";

/**
 * MX Bikes first-person dynamic: helmet cam, looks chassis-forward,
 * extra look-into-steer and a little pitch from the live Euler.
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

  useLayoutEffect(() => {
    if (enabled && cam.current) set({ camera: cam.current });
    else set({ camera: garageCam });
  }, [enabled, set, garageCam]);

  useFrame(() => {
    const node = cam.current;
    if (!enabled || !node) return;
    const tel = telemetryRef.current;
    const steer = (tel.steer * Math.PI) / 180;
    const lookYaw = -steer * 0.24 + ((tel.yawRate * Math.PI) / 180) * 0.035;
    const lookPitch = -0.16 + ((tel.pitch * Math.PI) / 180) * 0.14;
    node.position.set(0, 0.74, 0.14);
    node.rotation.set(lookPitch, Math.PI + lookYaw, 0, "YXZ");
    if (node.fov !== 76) {
      node.fov = 76;
      node.updateProjectionMatrix();
    }
  });

  if (!enabled) return null;
  return <PerspectiveCamera ref={cam} makeDefault fov={76} near={0.04} far={48} />;
}
