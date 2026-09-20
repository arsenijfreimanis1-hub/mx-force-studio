"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { MutableRefObject } from "react";
import * as THREE from "three";
import type { FrameTravel, Pose6 } from "@/lib/mxb/motion";
import { FRAME_BOTTOM } from "@/lib/mxb/motion";

const TRAIL_POINTS = 140;
const REST_Y = FRAME_BOTTOM.y;
const UP = new THREE.Vector3(0, 1, 0);

function Rod({
  poseRef,
  color,
  fromHome,
}: {
  poseRef: MutableRefObject<Pose6>;
  color: string;
  fromHome: boolean;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const start = useMemo(() => new THREE.Vector3(), []);
  const end = useMemo(() => new THREE.Vector3(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const node = mesh.current;
    if (!node) return;
    const pose = poseRef.current;
    if (fromHome) start.set(0, 0.03, 0);
    else start.set(pose.x, 0.02, pose.z);
    end.set(pose.x, pose.y + REST_Y, pose.z);
    dir.copy(end).sub(start);
    const len = dir.length();
    if (len < 1e-4) {
      node.visible = false;
      return;
    }
    node.visible = true;
    node.position.copy(start).add(end).multiplyScalar(0.5);
    node.quaternion.setFromUnitVectors(UP, dir.normalize());
    node.scale.set(1, len, 1);
  });

  return (
    <mesh ref={mesh} frustumCulled={false}>
      <cylinderGeometry args={[0.02, 0.02, 1, 8]} />
      <meshBasicMaterial color={color} transparent opacity={0.88} />
    </mesh>
  );
}

export function WorldMotionCues({
  poseRef,
  travel,
}: {
  poseRef: MutableRefObject<Pose6>;
  travel: FrameTravel;
}) {
  const trailGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(TRAIL_POINTS * 3), 3));
    g.setDrawRange(0, 0);
    return g;
  }, []);
  const footprint = useRef<THREE.Mesh>(null);
  const trailPts = useRef<number[]>([]);
  const sampleAcc = useRef(0);
  const last = useMemo(() => new THREE.Vector3(), []);
  const restY = REST_Y + 0.24;
  const trailLine = useMemo(() => {
    const mat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.75 });
    const line = new THREE.Line(trailGeom, mat);
    line.frustumCulled = false;
    return line;
  }, [trailGeom]);

  useFrame((_, dt) => {
    const pose = poseRef.current;
    if (footprint.current) {
      footprint.current.position.set(pose.x, 0.014, pose.z);
    }

    sampleAcc.current += dt;
    if (sampleAcc.current < 1 / 50) return;
    sampleAcc.current = 0;

    const x = pose.x;
    const y = pose.y + REST_Y;
    const z = pose.z;
    const pts = trailPts.current;
    if (pts.length >= 3) {
      const dx = x - last.x;
      const dy = y - last.y;
      const dz = z - last.z;
      const dist2 = dx * dx + dy * dy + dz * dz;
      if (dist2 > 0.55) {
        pts.length = 0;
      } else if (dist2 < 0.00035) {
        return;
      }
    }
    last.set(x, y, z);
    pts.push(x, y, z);
    const max = TRAIL_POINTS * 3;
    if (pts.length > max) pts.splice(0, pts.length - max);

    const attr = trailGeom.getAttribute("position") as THREE.BufferAttribute;
    const count = pts.length / 3;
    for (let i = 0; i < count; i++) {
      attr.setXYZ(i, pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]);
    }
    attr.needsUpdate = true;
    trailGeom.setDrawRange(0, count);
    trailGeom.computeBoundingSphere();
  });

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} receiveShadow>
        <circleGeometry args={[1.25, 48]} />
        <meshStandardMaterial color="#9a3412" roughness={0.85} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
        <ringGeometry args={[0.92, 1.18, 64]} />
        <meshBasicMaterial color="#fb923c" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.16, 24]} />
        <meshBasicMaterial color="#fde68a" />
      </mesh>

      <mesh position={[0.5, 0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.018, 0.018, 1, 8]} />
        <meshBasicMaterial color="#f87171" />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 1, 8]} />
        <meshBasicMaterial color="#4ade80" />
      </mesh>
      <mesh position={[0, 0.02, 0.5]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 1, 8]} />
        <meshBasicMaterial color="#60a5fa" />
      </mesh>

      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[0.5, 1.15, 2]} />
        <meshBasicMaterial color="#e2e8f0" wireframe transparent opacity={0.22} />
      </mesh>

      <mesh position={[0, restY, 0]}>
        <boxGeometry args={[travel.limitX * 2, travel.limitY * 2, travel.limitZ * 2]} />
        <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.22} />
      </mesh>

      <mesh ref={footprint} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.22, 0.34, 32]} />
        <meshBasicMaterial color="#7dd3fc" transparent opacity={0.9} />
      </mesh>

      <Rod poseRef={poseRef} color="#fbbf24" fromHome />
      <Rod poseRef={poseRef} color="#86efac" fromHome={false} />

      <primitive object={trailLine} />
    </group>
  );
}
