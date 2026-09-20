"use client";

import { memo, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { MutableRefObject } from "react";
import { idleRider, riderFromTelemetry } from "@/lib/mxb/rider";
import type { Telemetry } from "@/lib/mxb/types";

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

function RiderDummy({
  telemetryRef,
  liveRef,
  padActiveRef,
}: {
  telemetryRef: MutableRefObject<Telemetry>;
  liveRef: MutableRefObject<boolean>;
  padActiveRef: MutableRefObject<boolean>;
}) {
  const group = useRef<THREE.Group>(null);
  const hips = useRef<THREE.Mesh>(null);
  const leftLeg = useRef<THREE.Mesh>(null);
  const rightLeg = useRef<THREE.Mesh>(null);
  const last = useRef(idleRider());

  useFrame((_, dt) => {
    const node = group.current;
    if (!node) return;
    const active = liveRef.current || padActiveRef.current;
    const want = active ? riderFromTelemetry(telemetryRef.current) : idleRider();
    const a = active ? 1 - Math.exp(-Math.min(0.05, dt) / 0.1) : 1;
    const pose = last.current;
    pose.stand += (want.stand - pose.stand) * a;
    pose.lean += (want.lean - pose.lean) * a;
    pose.foreAft += (want.foreAft - pose.foreAft) * a;
    node.position.set(0, 0.78 + pose.stand * 0.16, 0.04 + pose.foreAft);
    node.rotation.set(pose.stand * -0.18, 0, pose.lean);
    if (hips.current) hips.current.scale.set(1, 1 + pose.stand * 0.12, 1);
    const squat = 0.55 - pose.stand * 0.28;
    if (leftLeg.current) leftLeg.current.rotation.x = squat;
    if (rightLeg.current) rightLeg.current.rotation.x = squat;
  });

  const kit = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.7 }),
    [],
  );
  const lid = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#334155", roughness: 0.45, metalness: 0.15 }),
    [],
  );
  const limb = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.75 }),
    [],
  );

  return (
    <group ref={group} position={[0, 0.78, 0.04]}>
      <mesh ref={hips} position={[0, 0.14, 0]} material={kit}>
        <capsuleGeometry args={[0.085, 0.24, 3, 6]} />
      </mesh>
      <mesh position={[0, 0.38, 0.02]} material={lid}>
        <sphereGeometry args={[0.088, 8, 6]} />
      </mesh>
      <mesh position={[0.11, 0.02, 0.02]} rotation={[0.15, 0, 0.2]} material={limb}>
        <capsuleGeometry args={[0.038, 0.2, 3, 5]} />
      </mesh>
      <mesh position={[-0.11, 0.02, 0.02]} rotation={[0.15, 0, -0.2]} material={limb}>
        <capsuleGeometry args={[0.038, 0.2, 3, 5]} />
      </mesh>
      <mesh ref={leftLeg} position={[0.07, -0.16, 0.04]} rotation={[0.55, 0, 0]} material={limb}>
        <capsuleGeometry args={[0.04, 0.22, 3, 5]} />
      </mesh>
      <mesh ref={rightLeg} position={[-0.07, -0.16, 0.04]} rotation={[0.55, 0, 0]} material={limb}>
        <capsuleGeometry args={[0.04, 0.22, 3, 5]} />
      </mesh>
    </group>
  );
}

/** MX chassis only — no wheels, swingarm, or lower fork legs. */
export const MotocrossBike = memo(function MotocrossBike({
  telemetryRef,
  liveRef,
  padActiveRef,
}: {
  telemetryRef: MutableRefObject<Telemetry>;
  liveRef: MutableRefObject<boolean>;
  padActiveRef: MutableRefObject<boolean>;
}) {
  const chrome = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#cbd5e1", metalness: 0.55, roughness: 0.42 }),
    [],
  );
  const rail = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#94a3b8", metalness: 0.5, roughness: 0.46 }),
    [],
  );
  const stub = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#e2e8f0", metalness: 0.45, roughness: 0.4 }),
    [],
  );
  const shock = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#ea580c", metalness: 0.55, roughness: 0.38 }),
    [],
  );
  const clampMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#64748b", metalness: 0.5, roughness: 0.4 }),
    [],
  );
  const bar = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#cbd5e1", metalness: 0.45, roughness: 0.4 }),
    [],
  );

  return (
    <group position={[0, FRAME_CENTER_Y, 0]}>
      <Tube from={CROWN} to={SHOCK_TOP} radius={0.038} material={chrome} />
      <Tube from={CROWN} to={LOWER_FRONT} radius={0.038} material={chrome} />
      <Tube from={LOWER_FRONT} to={SWING_PIVOT} radius={0.034} material={rail} />
      <Tube from={SHOCK_TOP} to={SWING_PIVOT} radius={0.032} material={rail} />
      <Tube from={SHOCK_TOP} to={SHOCK_LOWER} radius={0.04} material={shock} />
      <Tube from={STUB_L} to={STUB_END_L} radius={0.026} material={stub} />
      <Tube from={STUB_R} to={STUB_END_R} radius={0.026} material={stub} />

      <mesh position={CROWN} rotation={[-0.33, 0, 0]} material={clampMat}>
        <cylinderGeometry args={[0.042, 0.042, 0.18, 8]} />
      </mesh>
      <mesh position={[0, 0.74, 0.52]} rotation={[0, 0, Math.PI / 2]} material={bar}>
        <cylinderGeometry args={[0.02, 0.02, 0.52, 8]} />
      </mesh>

      <RiderDummy telemetryRef={telemetryRef} liveRef={liveRef} padActiveRef={padActiveRef} />
    </group>
  );
});
