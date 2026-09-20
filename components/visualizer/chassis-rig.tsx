"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import type { MutableRefObject, ReactNode } from "react";
import {
  PLATFORM_HOME_Y,
  stepMotion,
  type FrameTravel,
  type MotionFilter,
  type Pose6,
} from "@/lib/mxb/motion";
import type { Telemetry } from "@/lib/mxb/types";

export function ChassisRig({
  poseRef,
  telemetryRef,
  motionRef,
  travelRef,
  playingRef,
  liveRef,
  children,
}: {
  poseRef: MutableRefObject<Pose6>;
  telemetryRef: MutableRefObject<Telemetry>;
  motionRef: MutableRefObject<MotionFilter>;
  travelRef: MutableRefObject<FrameTravel>;
  playingRef: MutableRefObject<boolean>;
  liveRef: MutableRefObject<boolean>;
  children: ReactNode;
}) {
  const group = useRef<Group>(null);
  const lastMs = useRef(0);

  useFrame(() => {
    const node = group.current;
    if (!node) return;
    const now = performance.now();
    const dt = lastMs.current
      ? Math.min(0.05, Math.max(0.0005, (now - lastMs.current) / 1000))
      : 1 / 60;
    lastMs.current = now;

    if (liveRef.current || playingRef.current) {
      poseRef.current = stepMotion(
        motionRef.current,
        telemetryRef.current,
        dt,
        travelRef.current,
      );
    }

    const pose = poseRef.current;
    node.position.set(pose.x, PLATFORM_HOME_Y + pose.y, pose.z);
    node.rotation.order = "YXZ";
    node.rotation.set(pose.pitch, pose.yaw, pose.roll);
    node.updateMatrix();
  }, -1);

  return (
    <group ref={group} position={[0, PLATFORM_HOME_Y, 0]}>
      {children}
    </group>
  );
}
