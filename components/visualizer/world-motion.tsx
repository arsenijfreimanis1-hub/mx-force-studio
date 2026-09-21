"use client";

import { Html } from "@react-three/drei";
import {
  POV_BANNER_Z,
  POV_CENTERLINE_ZS,
  POV_GATE_Z,
  POV_LANE_HALF,
  POV_POST_ZS,
} from "@/lib/mxb/pov-marks";

/** Dirt paddock + a quiet heading mark so lean still reads. */
export function Paddock() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow={false}>
        <circleGeometry args={[12, 40]} />
        <meshStandardMaterial color="#9a754d" roughness={0.96} metalness={0} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.015, 11]}>
        <planeGeometry args={[6.4, 26]} />
        <meshStandardMaterial color="#8a6844" roughness={0.97} metalness={0} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <circleGeometry args={[4.2, 36]} />
        <meshStandardMaterial color="#7a5a3a" roughness={0.97} metalness={0} />
      </mesh>
      <mesh position={[-8, 0.7, -10]} scale={[3.6, 1.2, 2.1]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color="#5c6b4a" roughness={0.9} />
      </mesh>
      <mesh position={[7.5, 0.55, -11]} scale={[4.4, 1.0, 2.4]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color="#4d5c40" roughness={0.92} />
      </mesh>
      <mesh position={[1.2, 0.35, -12]} scale={[5.5, 0.8, 1.8]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color="#6a5a3c" roughness={0.94} />
      </mesh>
    </group>
  );
}

export function WorldMotionCues({ showLabels = true }: { showLabels?: boolean }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
        <ringGeometry args={[0.52, 0.58, 36]} />
        <meshBasicMaterial color="#d97706" transparent opacity={0.55} />
      </mesh>
      {showLabels ? (
        <>
          <Html position={[0, 0.05, 0.68]} center distanceFactor={4.2}>
            <div className="whitespace-nowrap text-[11px] font-bold tracking-wide text-amber-200">
              FRONT
            </div>
          </Html>
          <Html position={[0.68, 0.05, 0]} center distanceFactor={4.2}>
            <div className="whitespace-nowrap text-[11px] font-bold tracking-wide text-sky-200">
              RIGHT
            </div>
          </Html>
          <Html position={[-0.68, 0.05, 0]} center distanceFactor={4.2}>
            <div className="whitespace-nowrap text-[11px] font-bold tracking-wide text-rose-200">
              LEFT
            </div>
          </Html>
        </>
      ) : null}
    </group>
  );
}

function TrafficCone({ x, z, color }: { x: number; z: number; color: string }) {
  return (
    <mesh position={[x, 0.18, z]}>
      <coneGeometry args={[0.12, 0.36, 8]} />
      <meshStandardMaterial color={color} roughness={0.68} metalness={0} />
    </mesh>
  );
}

function StripePost({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.95, 0]}>
        <boxGeometry args={[0.07, 1.9, 0.07]} />
        <meshStandardMaterial color="#1f2937" roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.62, 0]}>
        <boxGeometry args={[0.1, 0.22, 0.1]} />
        <meshStandardMaterial color="#facc15" roughness={0.45} />
      </mesh>
    </group>
  );
}

/** Fixed world marks in front of the rider so surge, sway, and lean read in POV. */
export function PovLandmarks() {
  return (
    <group>
      {POV_CENTERLINE_ZS.map((z) => (
        <mesh key={`dash-${z}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.014, z]}>
          <planeGeometry args={[0.1, 0.52]} />
          <meshBasicMaterial color="#f4e4b0" />
        </mesh>
      ))}
      {POV_POST_ZS.map((z, i) => {
        const side = POV_LANE_HALF + (i % 2) * 0.06;
        const cone = i % 2 === 0 ? "#f97316" : "#f8fafc";
        return (
          <group key={`pair-${z}`}>
            <TrafficCone x={-side} z={z} color={cone} />
            <TrafficCone x={side} z={z} color={i % 2 === 0 ? "#f8fafc" : "#f97316"} />
            {i % 2 === 1 ? (
              <>
                <StripePost x={-side - 0.42} z={z} />
                <StripePost x={side + 0.42} z={z} />
              </>
            ) : null}
          </group>
        );
      })}
      <group position={[0, 0, POV_GATE_Z]}>
        <mesh position={[-1.55, 1.15, 0]}>
          <boxGeometry args={[0.08, 2.3, 0.08]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
        <mesh position={[1.55, 1.15, 0]}>
          <boxGeometry args={[0.08, 2.3, 0.08]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
        <mesh position={[0, 2.22, 0]}>
          <boxGeometry args={[3.22, 0.24, 0.08]} />
          <meshStandardMaterial color="#dc2626" />
        </mesh>
        <mesh position={[0, 1.98, 0.02]}>
          <boxGeometry args={[1.15, 0.14, 0.02]} />
          <meshBasicMaterial color="#fef3c7" />
        </mesh>
      </group>
      <group position={[0, 0, POV_BANNER_Z]}>
        <mesh position={[-2.1, 1.35, 0]}>
          <boxGeometry args={[0.09, 2.7, 0.09]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
        <mesh position={[2.1, 1.35, 0]}>
          <boxGeometry args={[0.09, 2.7, 0.09]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
        <mesh position={[0, 2.55, 0]}>
          <boxGeometry args={[4.3, 0.28, 0.08]} />
          <meshStandardMaterial color="#2563eb" />
        </mesh>
      </group>
    </group>
  );
}
