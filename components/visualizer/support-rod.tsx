"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { MutableRefObject } from "react";
import { PLATFORM_HOME_Y, type Pose6 } from "@/lib/mxb/motion";
import { DECK_HALF_L, ROD_CORNERS, rodBaseCorner, rodDeckLocal } from "@/lib/mxb/rods";

const up = new THREE.Vector3(0, 1, 0);

export function MotionPedestal({ poseRef }: { poseRef: MutableRefObject<Pose6> }) {
  const rod0 = useRef<THREE.Mesh>(null);
  const rod1 = useRef<THREE.Mesh>(null);
  const rod2 = useRef<THREE.Mesh>(null);
  const rod3 = useRef<THREE.Mesh>(null);
  const top0 = useRef<THREE.Mesh>(null);
  const top1 = useRef<THREE.Mesh>(null);
  const top2 = useRef<THREE.Mesh>(null);
  const top3 = useRef<THREE.Mesh>(null);
  const rods = [rod0, rod1, rod2, rod3];
  const tops = [top0, top1, top2, top3];
  const hinge = useRef<THREE.Group>(null);
  const start = useMemo(() => new THREE.Vector3(), []);
  const end = useMemo(() => new THREE.Vector3(), []);
  const mid = useMemo(() => new THREE.Vector3(), []);
  const quat = useMemo(() => new THREE.Quaternion(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const euler = useMemo(() => new THREE.Euler(0, 0, 0, "YXZ"), []);
  const local = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const pose = poseRef.current;
    euler.set(pose.pitch, pose.yaw, pose.roll, "YXZ");
    if (hinge.current) {
      hinge.current.position.set(pose.x, PLATFORM_HOME_Y + pose.y, pose.z);
      hinge.current.rotation.set(pose.pitch, pose.yaw, pose.roll, "YXZ");
    }
    for (let i = 0; i < ROD_CORNERS.length; i++) {
      const mesh = rods[i].current;
      const ball = tops[i].current;
      if (!mesh) continue;
      const c = ROD_CORNERS[i];
      const base = rodBaseCorner(c.x, c.z);
      const deck = rodDeckLocal(c.x, c.z);
      start.set(base.x, base.y, base.z);
      local.set(deck.x, deck.y, deck.z).applyEuler(euler);
      end.set(local.x + pose.x, local.y + PLATFORM_HOME_Y + pose.y, local.z + pose.z);
      dir.copy(end).sub(start);
      const length = Math.max(0.12, dir.length());
      mid.copy(start).add(end).multiplyScalar(0.5);
      quat.setFromUnitVectors(up, dir.normalize());
      mesh.position.copy(mid);
      mesh.quaternion.copy(quat);
      mesh.scale.set(1, length, 1);
      if (ball) ball.position.copy(end);
    }
  });

  return (
    <group>
      <mesh position={[0, 0.04, 0.82]} rotation={[0, 0, 0]}>
        <boxGeometry args={[1.42, 0.045, 0.07]} />
        <meshStandardMaterial color="#292524" metalness={0.45} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.04, -0.82]}>
        <boxGeometry args={[1.42, 0.045, 0.07]} />
        <meshStandardMaterial color="#292524" metalness={0.45} roughness={0.5} />
      </mesh>
      <mesh position={[0.67, 0.04, 0]}>
        <boxGeometry args={[0.07, 0.045, 1.72]} />
        <meshStandardMaterial color="#292524" metalness={0.45} roughness={0.5} />
      </mesh>
      <mesh position={[-0.67, 0.04, 0]}>
        <boxGeometry args={[0.07, 0.045, 1.72]} />
        <meshStandardMaterial color="#292524" metalness={0.45} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[0.28, 0.03, 0.22]} />
        <meshStandardMaterial color="#44403c" metalness={0.45} roughness={0.4} />
      </mesh>

      {ROD_CORNERS.map((c) => {
        const base = rodBaseCorner(c.x, c.z);
        return (
          <mesh key={`uj-${c.id}`} position={[base.x, base.y, base.z]}>
            <sphereGeometry args={[0.032, 10, 8]} />
            <meshStandardMaterial color="#a8a29e" metalness={0.7} roughness={0.28} />
          </mesh>
        );
      })}

      {rods.map((ref, i) => (
        <mesh key={`rod-${ROD_CORNERS[i].id}`} ref={ref}>
          <cylinderGeometry args={[0.016, 0.022, 1, 8]} />
          <meshStandardMaterial color="#ea580c" metalness={0.55} roughness={0.35} />
        </mesh>
      ))}

      {tops.map((ref, i) => (
        <mesh key={`ball-${ROD_CORNERS[i].id}`} ref={ref}>
          <sphereGeometry args={[0.028, 10, 8]} />
          <meshStandardMaterial color="#d6d3d1" metalness={0.75} roughness={0.22} />
        </mesh>
      ))}

      <group ref={hinge}>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.04, 0]}>
          <cylinderGeometry args={[0.018, 0.018, DECK_HALF_L * 2 + 0.08, 10]} />
          <meshStandardMaterial color="#78716c" metalness={0.65} roughness={0.3} />
        </mesh>
        <mesh position={[0, -0.04, DECK_HALF_L * 0.55]}>
          <boxGeometry args={[0.08, 0.05, 0.055]} />
          <meshStandardMaterial color="#57534e" metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh position={[0, -0.04, -DECK_HALF_L * 0.55]}>
          <boxGeometry args={[0.08, 0.05, 0.055]} />
          <meshStandardMaterial color="#57534e" metalness={0.5} roughness={0.4} />
        </mesh>
      </group>
    </group>
  );
}
