"use client";

import { Html } from "@react-three/drei";

/** Dirt paddock + a quiet heading mark so lean still reads. */
export function Paddock() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow={false}>
        <circleGeometry args={[12, 40]} />
        <meshStandardMaterial color="#9a754d" roughness={0.96} metalness={0} />
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
