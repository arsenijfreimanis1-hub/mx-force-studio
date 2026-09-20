"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Group } from "three";
import type { MutableRefObject, ReactNode } from "react";
import { telemetryFromSandbox } from "@/lib/mxb/demo";
import { gamepadActive, readFirstGamepad, sandboxFromGamepad } from "@/lib/mxb/gamepad";
import {
  PLATFORM_HOME_Y,
  stepMotion,
  type FrameTravel,
  type MotionFilter,
  type Pose6,
} from "@/lib/mxb/motion";
import { buildForceModel } from "@/lib/mxb/forces";
import type { BikeEvent, ForceModel, SandboxInputs, Telemetry } from "@/lib/mxb/types";

/** Visual follow of the washout pose — keeps jump drop under 0.3 s. */
export const VISUAL_POSE_TAU = 0.045;

export function ChassisRig({
  poseRef,
  telemetryRef,
  motionRef,
  travelRef,
  liveRef,
  padActiveRef,
  sandboxRef,
  eventRef,
  forcesRef,
  children,
}: {
  poseRef: MutableRefObject<Pose6>;
  telemetryRef: MutableRefObject<Telemetry>;
  motionRef: MutableRefObject<MotionFilter>;
  travelRef: MutableRefObject<FrameTravel>;
  liveRef: MutableRefObject<boolean>;
  padActiveRef: MutableRefObject<boolean>;
  sandboxRef: MutableRefObject<SandboxInputs>;
  eventRef: MutableRefObject<BikeEvent>;
  forcesRef: MutableRefObject<ForceModel>;
  children: ReactNode;
}) {
  const group = useRef<Group>(null);
  const lastMs = useRef(0);
  const clockRef = useRef(0);
  const visualPrimed = useRef(false);
  const targetQuat = useMemo(() => new THREE.Quaternion(), []);
  const targetPos = useMemo(() => new THREE.Vector3(), []);
  const euler = useMemo(() => new THREE.Euler(0, 0, 0, "YXZ"), []);

  useFrame(() => {
    const node = group.current;
    if (!node) return;
    const now = performance.now();
    const dt = lastMs.current
      ? Math.min(0.05, Math.max(0.0005, (now - lastMs.current) / 1000))
      : 1 / 60;
    lastMs.current = now;

    if (!liveRef.current) {
      const gp = readFirstGamepad();
      if (gp && gamepadActive(gp)) {
        sandboxRef.current = sandboxFromGamepad(gp, sandboxRef.current, dt);
        clockRef.current += dt;
        telemetryRef.current = telemetryFromSandbox(sandboxRef.current, clockRef.current);
        padActiveRef.current = true;
      } else {
        padActiveRef.current = false;
      }
    } else {
      padActiveRef.current = false;
    }

    const driving = liveRef.current || padActiveRef.current;
    const wasPrimed = motionRef.current.primed;
    if (driving) {
      poseRef.current = stepMotion(
        motionRef.current,
        telemetryRef.current,
        dt,
        travelRef.current,
      );
    }

    forcesRef.current = buildForceModel(telemetryRef.current, eventRef.current);

    const pose = poseRef.current;
    targetPos.set(pose.x, PLATFORM_HOME_Y + pose.y, pose.z);
    euler.set(pose.pitch, pose.yaw, pose.roll, "YXZ");
    targetQuat.setFromEuler(euler);

    if (!visualPrimed.current || !wasPrimed) {
      node.position.copy(targetPos);
      node.quaternion.copy(targetQuat);
      visualPrimed.current = true;
    } else {
      const a = 1 - Math.exp(-dt / VISUAL_POSE_TAU);
      node.position.lerp(targetPos, a);
      node.quaternion.slerp(targetQuat, a);
    }
    node.updateMatrix();
  }, -1);

  return (
    <group ref={group} position={[0, PLATFORM_HOME_Y, 0]}>
      {children}
    </group>
  );
}
