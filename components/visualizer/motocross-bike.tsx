"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { MutableRefObject } from "react";
import type { Telemetry } from "@/lib/mxb/types";
import { FRONT_R, REAR_R, REAR_Z } from "@/lib/mxb/defaults";

function metal(color: string, extras: THREE.MeshStandardMaterialParameters = {}) {
  return <meshStandardMaterial color={color} metalness={0.7} roughness={0.34} {...extras} />;
}

type Vec = [number, number, number];

const UP = new THREE.Vector3(0, 1, 0);

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

function WheelRing({ radius }: { radius: number }) {
  return (
    <mesh rotation={[0, Math.PI / 2, 0]}>
      <torusGeometry args={[radius, 0.02, 8, 40]} />
      {metal("#9ca3af", { metalness: 0.4, roughness: 0.6 })}
    </mesh>
  );
}

/** Simple rider mass on the seat — the vestibular point the 6DOF deck is cueing. */
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

export function MotocrossBike({
  telemetryRef,
  suspMaxRef,
}: {
  telemetryRef: MutableRefObject<Telemetry>;
  suspMaxRef: MutableRefObject<[number, number]>;
}) {
  const chassis = useRef<THREE.Group>(null);
  const rearHub = useRef<THREE.Group>(null);
  const forkGroup = useRef<THREE.Group>(null);
  const steerGroup = useRef<THREE.Group>(null);
  const frontWheel = useRef<THREE.Group>(null);

  useFrame(() => {
    const tel = telemetryRef.current;
    const maxF = Math.max(0.12, suspMaxRef.current[0] || 0.31);
    const maxR = Math.max(0.12, suspMaxRef.current[1] || 0.315);
    const forkTravel = Math.max(0, maxF - tel.suspLength[0]);
    const shockTravel = Math.max(0, maxR - tel.suspLength[1]);
    const steer = THREE.MathUtils.degToRad(tel.steer);

    if (chassis.current) {
      chassis.current.position.y = FRONT_R - forkTravel * 0.55;
    }
    if (rearHub.current) {
      rearHub.current.position.y = 0.02 + shockTravel * 0.45;
    }
    if (steerGroup.current) {
      steerGroup.current.rotation.y = steer;
    }
    const forkLen = 0.6 - forkTravel * 0.42;
    if (forkGroup.current) {
      forkGroup.current.scale.y = forkLen / 0.6;
    }
    if (frontWheel.current) {
      frontWheel.current.position.y = -forkLen;
    }
  });

  const crown: Vec = [0, 0.62, 0.55];
  const swingPivot: Vec = [0, 0.12, -0.14];
  const lowerFront: Vec = [0, 0.06, 0.18];
  const shockTop: Vec = [0, 0.44, -0.16];
  const rearAxle: Vec = [0, 0.02, REAR_Z];
  const shockLower: Vec = [0, 0.14, REAR_Z + 0.28];

  return (
    <group>
      <group ref={chassis} position={[0, FRONT_R, 0]}>
        <group ref={rearHub} position={[0, 0.02, 0]}>
          <group position={[0, 0, REAR_Z]}>
            <WheelRing radius={REAR_R} />
          </group>
        </group>

        <Tube from={swingPivot} to={rearAxle} radius={0.022} color="#cbd5e1" />
        <Tube from={shockTop} to={shockLower} radius={0.026} color="#f97316" />
        <Tube from={crown} to={shockTop} radius={0.024} color="#f8fafc" />
        <Tube from={crown} to={lowerFront} radius={0.024} color="#f8fafc" />
        <Tube from={lowerFront} to={swingPivot} radius={0.022} color="#e2e8f0" />
        <Tube from={shockTop} to={swingPivot} radius={0.02} color="#e2e8f0" />

        <mesh position={crown} rotation={[-0.33, 0, 0]}>
          <cylinderGeometry args={[0.032, 0.032, 0.16, 12]} />
          {metal("#a1a1aa")}
        </mesh>

        <group position={crown} rotation={[-0.33, 0, 0]}>
          <group ref={steerGroup}>
            <group ref={forkGroup} position={[0, -0.3, 0]}>
              <mesh position={[0.1, 0, 0]}>
                <cylinderGeometry args={[0.02, 0.02, 0.6, 10]} />
                {metal("#e5e7eb")}
              </mesh>
              <mesh position={[-0.1, 0, 0]}>
                <cylinderGeometry args={[0.02, 0.02, 0.6, 10]} />
                {metal("#e5e7eb")}
              </mesh>
            </group>
            <group ref={frontWheel} position={[0, -0.6, 0]}>
              <WheelRing radius={FRONT_R} />
            </group>
            <mesh position={[0, 0.14, -0.02]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.014, 0.014, 0.5, 8]} />
              {metal("#d4d4d8")}
            </mesh>
          </group>
        </group>

        <RiderDummy />
      </group>
    </group>
  );
}
