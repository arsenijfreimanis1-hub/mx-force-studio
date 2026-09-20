"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { MutableRefObject } from "react";
import { FRAME_LOW_Y, PLATFORM_HOME_Y, type Pose6 } from "@/lib/mxb/motion";

const BOX_H = 0.14;
const BOX_Y = BOX_H * 0.5;
const ROD_TOP_LOCAL = new THREE.Vector3(0, FRAME_LOW_Y, 0.01);

export function MotionPedestal({ poseRef }: { poseRef: MutableRefObject<Pose6> }) {
  const rod = useRef<THREE.Mesh>(null);
  const start = useMemo(() => new THREE.Vector3(0, BOX_H, 0), []);
  const end = useMemo(() => new THREE.Vector3(), []);
  const mid = useMemo(() => new THREE.Vector3(), []);
  const quat = useMemo(() => new THREE.Quaternion(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const euler = useMemo(() => new THREE.Euler(0, 0, 0, "YXZ"), []);

  useFrame(() => {
    const mesh = rod.current;
    if (!mesh) return;
    const pose = poseRef.current;
    euler.set(pose.pitch, pose.yaw, pose.roll, "YXZ");
    end.copy(ROD_TOP_LOCAL).applyEuler(euler);
    end.x += pose.x;
    end.y += PLATFORM_HOME_Y + pose.y;
    end.z += pose.z;
    dir.copy(end).sub(start);
    const length = Math.max(0.1, dir.length());
    mid.copy(start).add(end).multiplyScalar(0.5);
    quat.setFromUnitVectors(up, dir.normalize());
    mesh.position.copy(mid);
    mesh.quaternion.copy(quat);
    mesh.scale.set(1, length, 1);
  });

  return (
    <group>
      <mesh position={[0, BOX_Y, 0]}>
        <boxGeometry args={[0.52, BOX_H, 0.38]} />
        <meshStandardMaterial color="#1c1917" metalness={0.35} roughness={0.55} />
      </mesh>
      <mesh position={[0, BOX_H + 0.01, 0]}>
        <boxGeometry args={[0.42, 0.018, 0.3]} />
        <meshStandardMaterial color="#44403c" metalness={0.4} roughness={0.45} />
      </mesh>
      <mesh ref={rod} position={[0, BOX_H + 0.3, 0]}>
        <cylinderGeometry args={[0.022, 0.028, 1, 8]} />
        <meshStandardMaterial color="#ea580c" metalness={0.55} roughness={0.35} />
      </mesh>
    </group>
  );
}
