"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { MutableRefObject } from "react";
import { DEFAULT_ROD_LENGTH, PLATFORM_HOME_Y, visualPitch, type FrameTravel, type Pose6 } from "@/lib/mxb/motion";
import { ROD_CORNERS, rodBaseCorner, rodDeckLocal } from "@/lib/mxb/rods";

const up = new THREE.Vector3(0, 1, 0);

export function MotionPedestal({
  poseRef,
  travelRef,
}: {
  poseRef: MutableRefObject<Pose6>;
  travelRef?: MutableRefObject<FrameTravel>;
}) {
  const rod0 = useRef<THREE.Mesh>(null);
  const rod1 = useRef<THREE.Mesh>(null);
  const rod2 = useRef<THREE.Mesh>(null);
  const rod3 = useRef<THREE.Mesh>(null);
  const top0 = useRef<THREE.Mesh>(null);
  const top1 = useRef<THREE.Mesh>(null);
  const top2 = useRef<THREE.Mesh>(null);
  const top3 = useRef<THREE.Mesh>(null);
  const uj0 = useRef<THREE.Mesh>(null);
  const uj1 = useRef<THREE.Mesh>(null);
  const uj2 = useRef<THREE.Mesh>(null);
  const uj3 = useRef<THREE.Mesh>(null);
  const railF = useRef<THREE.Mesh>(null);
  const railR = useRef<THREE.Mesh>(null);
  const railL = useRef<THREE.Mesh>(null);
  const railRi = useRef<THREE.Mesh>(null);
  const rods = [rod0, rod1, rod2, rod3];
  const tops = [top0, top1, top2, top3];
  const ujs = [uj0, uj1, uj2, uj3];
  const start = useMemo(() => new THREE.Vector3(), []);
  const end = useMemo(() => new THREE.Vector3(), []);
  const mid = useMemo(() => new THREE.Vector3(), []);
  const quat = useMemo(() => new THREE.Quaternion(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const euler = useMemo(() => new THREE.Euler(0, 0, 0, "YXZ"), []);
  const local = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const pose = poseRef.current;
    const restLen = travelRef?.current.rodLength ?? DEFAULT_ROD_LENGTH;
    const pitchSign = travelRef?.current.visualPitch ?? -1;
    const pitch = visualPitch(pose.pitch, pitchSign);
    euler.set(pitch, pose.yaw, pose.roll, "YXZ");

    const fl = rodBaseCorner(-1, 1, restLen);
    const width = Math.abs(fl.x) * 2 + 0.08;
    const depth = Math.abs(fl.z) * 2 + 0.08;
    if (railF.current) {
      railF.current.position.set(0, 0.04, fl.z);
      railF.current.scale.set(width, 0.045, 0.07);
    }
    if (railR.current) {
      railR.current.position.set(0, 0.04, -fl.z);
      railR.current.scale.set(width, 0.045, 0.07);
    }
    if (railL.current) {
      railL.current.position.set(fl.x, 0.04, 0);
      railL.current.scale.set(0.07, 0.045, depth);
    }
    if (railRi.current) {
      railRi.current.position.set(-fl.x, 0.04, 0);
      railRi.current.scale.set(0.07, 0.045, depth);
    }

    for (let i = 0; i < ROD_CORNERS.length; i++) {
      const mesh = rods[i].current;
      const ball = tops[i].current;
      const uj = ujs[i].current;
      if (!mesh) continue;
      const c = ROD_CORNERS[i];
      const base = rodBaseCorner(c.x, c.z, restLen);
      const deck = rodDeckLocal(c.x, c.z);
      start.set(base.x, base.y, base.z);
      if (uj) uj.position.copy(start);
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
      <mesh ref={railF}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#292524" metalness={0.45} roughness={0.5} />
      </mesh>
      <mesh ref={railR}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#292524" metalness={0.45} roughness={0.5} />
      </mesh>
      <mesh ref={railL}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#292524" metalness={0.45} roughness={0.5} />
      </mesh>
      <mesh ref={railRi}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#292524" metalness={0.45} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[0.22, 0.03, 0.18]} />
        <meshStandardMaterial color="#44403c" metalness={0.45} roughness={0.4} />
      </mesh>

      {ujs.map((ref, i) => (
        <mesh key={`uj-${ROD_CORNERS[i].id}`} ref={ref}>
          <sphereGeometry args={[0.026, 10, 8]} />
          <meshStandardMaterial color="#a8a29e" metalness={0.7} roughness={0.28} />
        </mesh>
      ))}

      {rods.map((ref, i) => (
        <mesh key={`rod-${ROD_CORNERS[i].id}`} ref={ref}>
          <cylinderGeometry args={[0.013, 0.018, 1, 8]} />
          <meshStandardMaterial color="#ea580c" metalness={0.55} roughness={0.35} />
        </mesh>
      ))}

      {tops.map((ref, i) => (
        <mesh key={`ball-${ROD_CORNERS[i].id}`} ref={ref}>
          <sphereGeometry args={[0.022, 10, 8]} />
          <meshStandardMaterial color="#d6d3d1" metalness={0.75} roughness={0.22} />
        </mesh>
      ))}
    </group>
  );
}
