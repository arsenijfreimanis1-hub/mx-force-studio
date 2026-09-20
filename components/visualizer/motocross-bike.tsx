"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { Telemetry } from "@/lib/mxb/types";
import { FRONT_R, REAR_R, REAR_Z } from "@/lib/mxb/defaults";

function metal(color: string, extras: THREE.MeshStandardMaterialParameters = {}) {
  return <meshStandardMaterial color={color} metalness={0.7} roughness={0.34} {...extras} />;
}

type Vec = [number, number, number];

const UP = new THREE.Vector3(0, 1, 0);

/** A straight round tube between two points — the skeleton's only building block. */
function Tube({
  from,
  to,
  radius = 0.02,
  color = "#e5e7eb",
}: {
  from: Vec;
  to: Vec;
  radius?: number;
  color?: string;
}) {
  const { position, quaternion, length } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const dir = b.clone().sub(a);
    const len = dir.length();
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const quat = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());
    return { position: mid, quaternion: quat, length: len };
  }, [from, to]);

  return (
    <mesh position={position} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, length, 10]} />
      {metal(color)}
    </mesh>
  );
}

/** Thin wheel-position ring — marks where the tyre sits, no knobs, no spin. */
function WheelRing({ radius }: { radius: number }) {
  return (
    <mesh rotation={[0, Math.PI / 2, 0]}>
      <torusGeometry args={[radius, 0.02, 8, 40]} />
      {metal("#9ca3af", { metalness: 0.4, roughness: 0.6 })}
    </mesh>
  );
}

export function MotocrossBike({ telemetry }: { telemetry: Telemetry }) {
  const forkTravel = Math.max(0, 0.31 - telemetry.suspLength[0]);
  const shockTravel = Math.max(0, 0.315 - telemetry.suspLength[1]);
  const steer = THREE.MathUtils.degToRad(telemetry.steer);
  const roll = THREE.MathUtils.degToRad(telemetry.roll);
  const pitch = THREE.MathUtils.degToRad(telemetry.pitch);

  // Steering-head crown and the frame joints that hang off it.
  const crown: Vec = [0, 0.62, 0.55];
  const swingPivot: Vec = [0, 0.12, -0.14];
  const lowerFront: Vec = [0, 0.06, 0.18];
  const shockTop: Vec = [0, 0.44, -0.16];

  // Rear axle rises toward the chassis as the shock compresses.
  const rearAxleY = 0.02 + shockTravel * 0.45;
  const rearAxle: Vec = [0, rearAxleY, REAR_Z];
  const shockLower: Vec = [0, rearAxleY + 0.12, REAR_Z + 0.28];

  // Fork length in the steering frame; the slider retracts under compression.
  const forkLen = 0.6 - forkTravel * 0.42;

  return (
    <group rotation={[pitch, 0, roll]}>
      <group position={[0, FRONT_R - forkTravel * 0.55, 0]}>
        {/* rear wheel position ring */}
        <group position={rearAxle}>
          <WheelRing radius={REAR_R} />
        </group>

        {/* swingarm */}
        <Tube from={swingPivot} to={rearAxle} radius={0.022} color="#cbd5e1" />

        {/* rear shock */}
        <Tube from={shockTop} to={shockLower} radius={0.026} color="#f97316" />

        {/* frame skeleton: backbone + downtube + cradle */}
        <Tube from={crown} to={shockTop} radius={0.024} color="#f8fafc" />
        <Tube from={crown} to={lowerFront} radius={0.024} color="#f8fafc" />
        <Tube from={lowerFront} to={swingPivot} radius={0.022} color="#e2e8f0" />
        <Tube from={shockTop} to={swingPivot} radius={0.02} color="#e2e8f0" />

        {/* steering head */}
        <mesh position={crown} rotation={[-0.33, 0, 0]}>
          <cylinderGeometry args={[0.032, 0.032, 0.16, 12]} />
          {metal("#a1a1aa")}
        </mesh>

        {/* steering assembly: forks, front wheel, handlebar (rake, then steer) */}
        <group position={crown} rotation={[-0.33, 0, 0]}>
          <group rotation={[0, steer, 0]}>
            {/* fork legs */}
            <mesh position={[0.1, -forkLen / 2, 0]}>
              <cylinderGeometry args={[0.02, 0.02, forkLen, 10]} />
              {metal("#e5e7eb")}
            </mesh>
            <mesh position={[-0.1, -forkLen / 2, 0]}>
              <cylinderGeometry args={[0.02, 0.02, forkLen, 10]} />
              {metal("#e5e7eb")}
            </mesh>
            {/* front wheel position ring at the fork ends */}
            <group position={[0, -forkLen, 0]}>
              <WheelRing radius={FRONT_R} />
            </group>
            {/* handlebar */}
            <mesh position={[0, 0.14, -0.02]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.014, 0.014, 0.5, 8]} />
              {metal("#d4d4d8")}
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}
