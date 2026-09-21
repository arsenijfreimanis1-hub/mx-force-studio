"use client";

import { memo, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { MutableRefObject } from "react";
import { isRiderPad, readBodyStick, readFirstGamepad } from "@/lib/mxb/gamepad";
import { idleRider, riderFromTelemetry } from "@/lib/mxb/rider";
import { BIKE_SCALE } from "@/lib/mxb/motion";
import type { Telemetry } from "@/lib/mxb/types";
import { MotionDeck } from "@/components/visualizer/motion-deck";

type Vec = [number, number, number];

const Y_UP = new THREE.Vector3(0, 1, 0);

/** Seat / cradle height above the motion-base origin. */
export const FRAME_CENTER_Y = 0.55;

const HALF = 0.09;
const CROWN: Vec = [0, 0.62, 0.55];
const SWING_PIVOT: Vec = [0, 0.28, -0.14];
const LOWER_FRONT: Vec = [0, 0.28, 0.18];
const SHOCK_TOP: Vec = [0, 0.44, -0.16];
const SHOCK_LOWER: Vec = [0, 0.3, -0.42];
const STUB_L: Vec = [0.1, 0.52, 0.58];
const STUB_R: Vec = [-0.1, 0.52, 0.58];
const STUB_END_L: Vec = [0.1, 0.42, 0.62];
const STUB_END_R: Vec = [-0.1, 0.42, 0.62];

function offsetX(point: Vec, x: number): Vec {
  return [x, point[1], point[2]];
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
  const mesh = useRef<THREE.Mesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  const length = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);

  const align = () => {
    const node = mesh.current;
    if (!node || length < 1e-6) return;
    node.position.set((from[0] + to[0]) * 0.5, (from[1] + to[1]) * 0.5, (from[2] + to[2]) * 0.5);
    const dir = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]).multiplyScalar(1 / length);
    node.quaternion.setFromUnitVectors(Y_UP, dir);
  };

  useLayoutEffect(() => {
    align();
    invalidate();
  });

  return (
    <mesh ref={mesh} material={material}>
      <cylinderGeometry args={[radius, radius, length, 8]} />
    </mesh>
  );
}

function SeatBean({
  telemetryRef,
  liveRef,
  padActiveRef,
}: {
  telemetryRef: MutableRefObject<Telemetry>;
  liveRef: MutableRefObject<boolean>;
  padActiveRef: MutableRefObject<boolean>;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const last = useRef(idleRider());
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.7 }),
    [],
  );

  useFrame((_, dt) => {
    const node = mesh.current;
    if (!node) return;
    const active = liveRef.current || padActiveRef.current;
    const gp = liveRef.current ? readFirstGamepad() : null;
    const stick = isRiderPad(gp) ? readBodyStick(gp) : undefined;
    const want = active ? riderFromTelemetry(telemetryRef.current, stick) : idleRider();
    const a = active ? 1 - Math.exp(-Math.min(0.05, dt) / 0.07) : 1;
    const pose = last.current;
    pose.stand += (want.stand - pose.stand) * a;
    pose.lean += (want.lean - pose.lean) * a;
    pose.foreAft += (want.foreAft - pose.foreAft) * a;
    node.position.set(0, 0.86 + pose.stand * 0.12, 0.02 + pose.foreAft);
    node.rotation.set(pose.stand * -0.12, 0, pose.lean);
    const s = 1 + pose.stand * 0.08;
    node.scale.set(s, 1 + pose.stand * 0.15, s);
  });

  return (
    <mesh ref={mesh} position={[0, 0.86, 0.02]} material={mat}>
      <sphereGeometry args={[0.11, 10, 8]} />
    </mesh>
  );
}

function SteerBars({
  telemetryRef,
  bar,
}: {
  telemetryRef: MutableRefObject<Telemetry>;
  bar: THREE.MeshStandardMaterial;
}) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const node = group.current;
    if (!node) return;
    const steer = (telemetryRef.current.steer * Math.PI) / 180;
    const a = 1 - Math.exp(-Math.min(0.05, dt) / 0.05);
    node.rotation.y += (steer - node.rotation.y) * a;
  });
  return (
    <group ref={group} position={[0, 0.74, 0.52]}>
      <mesh position={[0, -0.08, 0]} material={bar}>
        <cylinderGeometry args={[0.016, 0.016, 0.16, 8]} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]} material={bar}>
        <cylinderGeometry args={[0.022, 0.022, 0.56, 8]} />
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
    <group scale={BIKE_SCALE}>
    <group position={[0, FRAME_CENTER_Y, 0]}>
      <MotionDeck />
      {([-HALF, HALF] as const).map((x) => (
        <group key={x}>
          <Tube from={offsetX(CROWN, x)} to={offsetX(SHOCK_TOP, x)} radius={0.032} material={chrome} />
          <Tube from={offsetX(CROWN, x)} to={offsetX(LOWER_FRONT, x)} radius={0.032} material={chrome} />
          <Tube from={offsetX(LOWER_FRONT, x)} to={offsetX(SWING_PIVOT, x)} radius={0.03} material={rail} />
          <Tube from={offsetX(SHOCK_TOP, x)} to={offsetX(SWING_PIVOT, x)} radius={0.028} material={rail} />
        </group>
      ))}
      <Tube from={offsetX(CROWN, -HALF)} to={offsetX(CROWN, HALF)} radius={0.03} material={clampMat} />
      <Tube from={offsetX(SWING_PIVOT, -HALF)} to={offsetX(SWING_PIVOT, HALF)} radius={0.028} material={rail} />
      <Tube from={SHOCK_TOP} to={SHOCK_LOWER} radius={0.04} material={shock} />
      <Tube from={STUB_L} to={STUB_END_L} radius={0.026} material={stub} />
      <Tube from={STUB_R} to={STUB_END_R} radius={0.026} material={stub} />

      <mesh position={CROWN} rotation={[-0.33, 0, 0]} material={clampMat}>
        <cylinderGeometry args={[0.042, 0.042, 0.18, 8]} />
      </mesh>
      <SteerBars telemetryRef={telemetryRef} bar={bar} />
      <SeatBean telemetryRef={telemetryRef} liveRef={liveRef} padActiveRef={padActiveRef} />
    </group>
    </group>
  );
});
