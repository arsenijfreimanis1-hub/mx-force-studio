"use client";

import { useLayoutEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import type { MutableRefObject } from "react";
import * as THREE from "three";
import { riderEye } from "@/lib/mxb/rider-eye";
import type { FrameTravel, Pose6 } from "@/lib/mxb/motion";
import type { Telemetry } from "@/lib/mxb/types";

/**
 * First-person view from the rider's goggles. The eye matrix is written each
 * frame by MxRider; when the rider is hidden we fall back to a seat-height cam.
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
  const pos = useRef(new THREE.Vector3());
  const quat = useRef(new THREE.Quaternion());
  const scale = useRef(new THREE.Vector3());

  useLayoutEffect(() => {
    if (enabled && cam.current) set({ camera: cam.current });
    else if (garageCamRef.current) set({ camera: garageCamRef.current });
  }, [enabled, set, garageCamRef]);

  useFrame(() => {
    const node = cam.current;
    if (!enabled || !node) return;
    if (riderEye.ready) {
      // Eye matrix is world-space; this camera lives under ChassisRig.
      const parent = node.parent;
      if (parent) {
        parent.updateWorldMatrix(true, false);
        const local = new THREE.Matrix4().copy(parent.matrixWorld).invert().multiply(riderEye.matrix);
        local.decompose(pos.current, quat.current, scale.current);
        node.position.copy(pos.current);
        node.quaternion.copy(quat.current);
      }
    } else {
      // No rider mesh — sit above the seat looking chassis-forward.
      void poseRef;
      void travelRef;
      void telemetryRef;
      node.position.set(0, 1.55, -0.05);
      node.rotation.set(-0.12, Math.PI, 0, "YXZ");
    }
    if (Math.abs(node.fov - 72) > 0.2) {
      node.fov = 72;
      node.updateProjectionMatrix();
    }
  });

  return <PerspectiveCamera ref={cam} makeDefault={enabled} fov={72} near={0.05} far={280} />;
}
