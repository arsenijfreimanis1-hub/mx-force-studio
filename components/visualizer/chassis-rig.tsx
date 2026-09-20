"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import type { MutableRefObject, ReactNode } from "react";
import type { Pose6 } from "@/lib/mxb/motion";

export function ChassisRig({
  poseRef,
  children,
}: {
  poseRef: MutableRefObject<Pose6>;
  children: ReactNode;
}) {
  const group = useRef<Group>(null);

  useFrame(() => {
    const node = group.current;
    if (!node) return;
    const pose = poseRef.current;
    node.position.set(pose.x, pose.y, pose.z);
    node.updateMatrix();
  });

  return (
    <group ref={group} position={[0, 0, 0]}>
      {children}
    </group>
  );
}
