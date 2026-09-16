"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Telemetry } from "@/lib/mxb/types";

const REAR_Z = -0.73;
const FRONT_R = 0.35;
const REAR_R = 0.32;

function metal(color: string, extras: THREE.MeshStandardMaterialParameters = {}) {
  return <meshStandardMaterial color={color} metalness={0.72} roughness={0.32} {...extras} />;
}

function KnobbyTire({
  radius,
  width,
  spinRef,
}: {
  radius: number;
  width: number;
  spinRef: React.RefObject<THREE.Group | null>;
}) {
  const knobs = useMemo(() => {
    const items: { rot: number; y: number }[] = [];
    for (let i = 0; i < 18; i++) items.push({ rot: (i / 18) * Math.PI * 2, y: 0 });
    return items;
  }, []);

  return (
    <group ref={spinRef}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <torusGeometry args={[radius - 0.045, 0.055, 10, 28]} />
        {metal("#1c1917", { metalness: 0.1, roughness: 0.78 })}
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[radius - 0.09, radius - 0.09, width * 0.7, 24]} />
        {metal("#d6d3d1")}
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.11, 0.018, 8, 18]} />
        {metal("#a8a29e")}
      </mesh>
      {knobs.map((knob, i) => (
        <mesh
          key={i}
          position={[
            Math.cos(knob.rot) * (radius - 0.012),
            Math.sin(knob.rot) * (radius - 0.012),
            0,
          ]}
          rotation={[0, 0, knob.rot]}
        >
          <boxGeometry args={[0.05, 0.028, width * 0.85]} />
          {metal("#292524", { metalness: 0.05, roughness: 0.9 })}
        </mesh>
      ))}
    </group>
  );
}

export function MotocrossBike({ telemetry }: { telemetry: Telemetry }) {
  const frontSpin = useRef<THREE.Group>(null);
  const rearSpin = useRef<THREE.Group>(null);
  const angle = useRef({ f: 0, r: 0 });

  const forkTravel = Math.max(0, 0.31 - telemetry.suspLength[0]);
  const shockTravel = Math.max(0, 0.315 - telemetry.suspLength[1]);
  const steer = THREE.MathUtils.degToRad(telemetry.steer);
  const roll = THREE.MathUtils.degToRad(telemetry.roll);
  const pitch = THREE.MathUtils.degToRad(telemetry.pitch);

  useFrame((_, dt) => {
    angle.current.f += (telemetry.wheelSpeed[0] / FRONT_R) * dt;
    angle.current.r += (telemetry.wheelSpeed[1] / REAR_R) * dt;
    if (frontSpin.current) frontSpin.current.rotation.x = angle.current.f;
    if (rearSpin.current) rearSpin.current.rotation.x = angle.current.r;
  });

  const swing = shockTravel * 0.55;
  const riderLean = -roll * 0.15;

  return (
    <group rotation={[pitch, 0, roll]}>
      <group position={[0, FRONT_R - forkTravel * 0.55, 0]}>
        {/* rear wheel */}
        <group position={[0, 0, REAR_Z]}>
          <KnobbyTire radius={REAR_R} width={0.12} spinRef={rearSpin} />
          <mesh position={[0.07, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.09, 0.09, 0.04, 16]} />
            {metal("#e11d48")}
          </mesh>
        </group>

        {/* swingarm */}
        <mesh
          position={[0.04, 0.02 - swing * 0.15, REAR_Z + 0.32]}
          rotation={[0.18 + swing, 0, 0]}
        >
          <boxGeometry args={[0.045, 0.035, 0.62]} />
          {metal("#d6d3d1")}
        </mesh>
        <mesh
          position={[-0.04, 0.02 - swing * 0.15, REAR_Z + 0.32]}
          rotation={[0.18 + swing, 0, 0]}
        >
          <boxGeometry args={[0.045, 0.035, 0.62]} />
          {metal("#d6d3d1")}
        </mesh>

        {/* shock */}
        <mesh
          position={[0.07, 0.38 - shockTravel * 0.4, -0.22]}
          rotation={[0.55, 0, 0.12]}
        >
          <cylinderGeometry args={[0.028, 0.032, 0.32 - shockTravel * 0.25, 10]} />
          {metal("#f97316")}
        </mesh>
        <mesh position={[0.07, 0.5 - shockTravel * 0.35, -0.16]} rotation={[0.55, 0, 0.12]}>
          <cylinderGeometry args={[0.018, 0.018, 0.14, 8]} />
          {metal("#e5e7eb")}
        </mesh>

        {/* frame backbone */}
        <mesh position={[0, 0.48, -0.08]} rotation={[0.55, 0, 0]}>
          <boxGeometry args={[0.05, 0.04, 0.72]} />
          {metal("#f8fafc")}
        </mesh>
        <mesh position={[0, 0.42, 0.18]} rotation={[-0.9, 0, 0]}>
          <boxGeometry args={[0.045, 0.035, 0.42]} />
          {metal("#f8fafc")}
        </mesh>
        <mesh position={[0, 0.28, -0.08]} rotation={[1.15, 0, 0]}>
          <boxGeometry args={[0.04, 0.03, 0.38]} />
          {metal("#e2e8f0")}
        </mesh>

        {/* engine */}
        <mesh position={[0, 0.32, 0.02]} castShadow>
          <boxGeometry args={[0.22, 0.28, 0.32]} />
          {metal("#3f3f46")}
        </mesh>
        <mesh position={[0.12, 0.34, 0.02]}>
          <cylinderGeometry args={[0.07, 0.07, 0.08, 12]} />
          {metal("#a1a1aa")}
        </mesh>
        <mesh position={[-0.02, 0.18, 0.18]} rotation={[0.4, 0, 0]}>
          <boxGeometry args={[0.16, 0.08, 0.18]} />
          {metal("#27272a")}
        </mesh>
        <mesh position={[0.02, 0.55, 0.08]}>
          <cylinderGeometry args={[0.045, 0.05, 0.16, 10]} />
          {metal("#d4d4d8")}
        </mesh>
        <mesh position={[0.04, 0.62, 0.22]} rotation={[1.1, 0, 0]}>
          <cylinderGeometry args={[0.022, 0.028, 0.28, 8]} />
          {metal("#78716c")}
        </mesh>

        {/* radiator / shrouds */}
        <mesh position={[0.13, 0.58, 0.28]} rotation={[0.1, 0.15, 0]}>
          <boxGeometry args={[0.04, 0.28, 0.22]} />
          {metal("#fb923c", { metalness: 0.35, roughness: 0.45 })}
        </mesh>
        <mesh position={[-0.13, 0.58, 0.28]} rotation={[0.1, -0.15, 0]}>
          <boxGeometry args={[0.04, 0.28, 0.22]} />
          {metal("#fb923c", { metalness: 0.35, roughness: 0.45 })}
        </mesh>
        <mesh position={[0, 0.7, 0.32]}>
          <boxGeometry args={[0.18, 0.12, 0.08]} />
          {metal("#f8fafc")}
        </mesh>
        <mesh position={[0, 0.7, 0.365]}>
          <boxGeometry args={[0.12, 0.08, 0.01]} />
          {metal("#111827")}
        </mesh>

        {/* tank / seat */}
        <mesh position={[0, 0.78, 0.08]}>
          <boxGeometry args={[0.2, 0.12, 0.38]} />
          {metal("#fff7ed", { metalness: 0.2, roughness: 0.5 })}
        </mesh>
        <mesh position={[0, 0.8, -0.28]}>
          <boxGeometry args={[0.16, 0.1, 0.42]} />
          {metal("#1c1917", { metalness: 0.15, roughness: 0.7 })}
        </mesh>
        <mesh position={[0, 0.74, -0.52]}>
          <boxGeometry args={[0.14, 0.08, 0.16]} />
          {metal("#292524")}
        </mesh>

        {/* rear fender */}
        <mesh position={[0, 0.62, -0.7]} rotation={[-0.35, 0, 0]}>
          <boxGeometry args={[0.18, 0.03, 0.28]} />
          {metal("#fb923c", { metalness: 0.3 })}
        </mesh>

        {/* pegs */}
        <mesh position={[0.14, 0.22, -0.12]}>
          <boxGeometry args={[0.1, 0.02, 0.05]} />
          {metal("#a8a29e")}
        </mesh>
        <mesh position={[-0.14, 0.22, -0.12]}>
          <boxGeometry args={[0.1, 0.02, 0.05]} />
          {metal("#a8a29e")}
        </mesh>

        {/* steering head + forks */}
        <group position={[0, 0.78, 0.48]} rotation={[0.48, 0, 0]}>
          <group rotation={[0, steer, 0]}>
            <mesh position={[0.08, -0.28 - forkTravel * 0.5, 0]}>
              <cylinderGeometry args={[0.022, 0.022, 0.72 + forkTravel * 0.1, 10]} />
              {metal("#e5e7eb")}
            </mesh>
            <mesh position={[-0.08, -0.28 - forkTravel * 0.5, 0]}>
              <cylinderGeometry args={[0.022, 0.022, 0.72 + forkTravel * 0.1, 10]} />
              {metal("#e5e7eb")}
            </mesh>
            <mesh position={[0.08, -0.02, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 0.28, 10]} />
              {metal("#a1a1aa")}
            </mesh>
            <mesh position={[-0.08, -0.02, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 0.28, 10]} />
              {metal("#a1a1aa")}
            </mesh>
            <mesh position={[0, 0.08, 0]}>
              <boxGeometry args={[0.22, 0.04, 0.05]} />
              {metal("#d4d4d8")}
            </mesh>
            <mesh position={[0, 0.18, -0.02]}>
              <boxGeometry args={[0.72, 0.03, 0.03]} />
              {metal("#e5e7eb")}
            </mesh>
            <mesh position={[0.36, 0.18, 0]}>
              <boxGeometry args={[0.04, 0.08, 0.09]} />
              {metal("#111827")}
            </mesh>
            <mesh position={[-0.36, 0.18, 0]}>
              <boxGeometry args={[0.04, 0.08, 0.09]} />
              {metal("#111827")}
            </mesh>
            <mesh position={[0, 0.22, 0.04]}>
              <boxGeometry args={[0.16, 0.08, 0.08]} />
              {metal("#fb923c")}
            </mesh>
            <group position={[0, -0.62 - forkTravel, 0.12]}>
              <KnobbyTire radius={FRONT_R} width={0.1} spinRef={frontSpin} />
            </group>
            <mesh position={[0, 0.42, 0.18]} rotation={[0.8, 0, 0]}>
              <boxGeometry args={[0.2, 0.03, 0.22]} />
              {metal("#fff7ed", { metalness: 0.25 })}
            </mesh>
          </group>
        </group>

        {/* rider */}
        <group position={[0, 0.82, -0.12]} rotation={[0.35 + pitch * 0.2, 0, riderLean]}>
          <mesh position={[0, 0.16, 0.02]}>
            <boxGeometry args={[0.22, 0.28, 0.16]} />
            {metal("#0f172a", { metalness: 0.1, roughness: 0.65 })}
          </mesh>
          <mesh position={[0, 0.42, 0.04]}>
            <sphereGeometry args={[0.11, 16, 16]} />
            {metal("#f97316", { metalness: 0.4, roughness: 0.35 })}
          </mesh>
          <mesh position={[0, 0.44, 0.12]}>
            <boxGeometry args={[0.14, 0.06, 0.04]} />
            {metal("#082f49", { roughness: 0.2, metalness: 0.3, transparent: true, opacity: 0.55 })}
          </mesh>
          <mesh position={[0.16, 0.08, 0.22]} rotation={[-0.9, 0.2, 0.4]}>
            <boxGeometry args={[0.07, 0.07, 0.38]} />
            {metal("#fb923c", { metalness: 0.2 })}
          </mesh>
          <mesh position={[-0.16, 0.08, 0.22]} rotation={[-0.9, -0.2, -0.4]}>
            <boxGeometry args={[0.07, 0.07, 0.38]} />
            {metal("#fb923c", { metalness: 0.2 })}
          </mesh>
          <mesh position={[0.1, -0.22, 0.02]} rotation={[0.6, 0, 0.15]}>
            <boxGeometry args={[0.08, 0.32, 0.1]} />
            {metal("#1e3a5f", { metalness: 0.15 })}
          </mesh>
          <mesh position={[-0.1, -0.22, 0.02]} rotation={[0.6, 0, -0.15]}>
            <boxGeometry args={[0.08, 0.32, 0.1]} />
            {metal("#1e3a5f", { metalness: 0.15 })}
          </mesh>
          <mesh position={[0.12, -0.4, 0.12]} rotation={[0.2, 0, 0]}>
            <boxGeometry args={[0.09, 0.08, 0.22]} />
            {metal("#111827")}
          </mesh>
          <mesh position={[-0.12, -0.4, 0.12]} rotation={[0.2, 0, 0]}>
            <boxGeometry args={[0.09, 0.08, 0.22]} />
            {metal("#111827")}
          </mesh>
        </group>
      </group>
    </group>
  );
}
