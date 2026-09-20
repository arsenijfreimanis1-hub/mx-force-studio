"use client";

import { memo, useMemo } from "react";
import * as THREE from "three";

type Vec = [number, number, number];

const UP = new THREE.Vector3(0, 1, 0);

/** Seat / cradle height above the motion-base origin. */
export const FRAME_CENTER_Y = 0.55;

const CROWN: Vec = [0, 0.62, 0.55];
const SWING_PIVOT: Vec = [0, 0.28, -0.14];
const LOWER_FRONT: Vec = [0, 0.28, 0.18];
const SHOCK_TOP: Vec = [0, 0.44, -0.16];
const SHOCK_LOWER: Vec = [0, 0.3, -0.42];
const STUB_L: Vec = [0.1, 0.52, 0.58];
const STUB_R: Vec = [-0.1, 0.52, 0.58];
const STUB_END_L: Vec = [0.1, 0.42, 0.62];
const STUB_END_R: Vec = [-0.1, 0.42, 0.62];

function tubePose(from: Vec, to: Vec) {
  const start = new THREE.Vector3(...from);
  const end = new THREE.Vector3(...to);
  const dir = end.clone().sub(start);
  const length = dir.length();
  const mid = start.clone().add(end).multiplyScalar(0.5);
  const quat = new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize());
  return { position: mid, quaternion: quat, length };
}

function Tube({
  from,
  to,
  radius = 0.02,
  material,
}: {
  from: Vec;
  to: Vec;
  radius?: number;
  material: THREE.MeshStandardMaterial;
}) {
  const { position, quaternion, length } = useMemo(() => tubePose(from, to), [from, to]);

  return (
    <mesh position={position} quaternion={quaternion} material={material}>
      <cylinderGeometry args={[radius, radius, length, 8]} />
    </mesh>
  );
}

function RiderDummy() {
  return (
    <group position={[0, 0.92, 0.02]}>
      <mesh position={[0, 0.16, 0]}>
        <capsuleGeometry args={[0.09, 0.28, 4, 8]} />
        <meshStandardMaterial color="#1e293b" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.42, 0.02]}>
        <sphereGeometry args={[0.095, 12, 10]} />
        <meshStandardMaterial color="#334155" roughness={0.45} metalness={0.15} />
      </mesh>
    </group>
  );
}

/** MX chassis only — no wheels, swingarm, or lower fork legs. */
export const MotocrossBike = memo(function MotocrossBike() {
  const chrome = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#f8fafc", metalness: 0.7, roughness: 0.34 }),
    [],
  );
  const rail = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#e2e8f0", metalness: 0.7, roughness: 0.34 }),
    [],
  );
  const stub = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#e5e7eb", metalness: 0.7, roughness: 0.34 }),
    [],
  );
  const shock = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#f97316", metalness: 0.7, roughness: 0.34 }),
    [],
  );
  const clampMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#a1a1aa", metalness: 0.7, roughness: 0.34 }),
    [],
  );
  const bar = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#d4d4d8", metalness: 0.7, roughness: 0.34 }),
    [],
  );

  return (
    <group position={[0, FRAME_CENTER_Y, 0]}>
      <Tube from={CROWN} to={SHOCK_TOP} radius={0.024} material={chrome} />
      <Tube from={CROWN} to={LOWER_FRONT} radius={0.024} material={chrome} />
      <Tube from={LOWER_FRONT} to={SWING_PIVOT} radius={0.022} material={rail} />
      <Tube from={SHOCK_TOP} to={SWING_PIVOT} radius={0.02} material={rail} />
      <Tube from={SHOCK_TOP} to={SHOCK_LOWER} radius={0.026} material={shock} />
      <Tube from={STUB_L} to={STUB_END_L} radius={0.018} material={stub} />
      <Tube from={STUB_R} to={STUB_END_R} radius={0.018} material={stub} />

      <mesh position={CROWN} rotation={[-0.33, 0, 0]} material={clampMat}>
        <cylinderGeometry args={[0.032, 0.032, 0.16, 10]} />
      </mesh>
      <mesh position={[0, 0.74, 0.52]} rotation={[0, 0, Math.PI / 2]} material={bar}>
        <cylinderGeometry args={[0.014, 0.014, 0.5, 8]} />
      </mesh>

      <RiderDummy />
    </group>
  );
});
