"use client";

import { Html } from "@react-three/drei";

/** Dirt paddock + a quiet heading mark so lean still reads. */
export function Paddock() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow={false}>
        <circleGeometry args={[22, 48]} />
        <meshStandardMaterial color="#9a754d" roughness={0.96} metalness={0} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <circleGeometry args={[7.5, 40]} />
        <meshStandardMaterial color="#7a5a3a" roughness={0.97} metalness={0} />
      </mesh>
      <mesh position={[-16, 1.1, -18]} scale={[7, 2.2, 4]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color="#5c6b4a" roughness={0.9} />
      </mesh>
      <mesh position={[14, 0.9, -20]} scale={[9, 1.8, 5]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color="#4d5c40" roughness={0.92} />
      </mesh>
      <mesh position={[2, 0.55, -22]} scale={[11, 1.4, 3.5]}>
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
        <ringGeometry args={[0.82, 0.9, 40]} />
        <meshBasicMaterial color="#d97706" transparent opacity={0.55} />
      </mesh>
      {showLabels ? (
        <>
          <Html position={[0, 0.05, 1.05]} center distanceFactor={6}>
            <div className="whitespace-nowrap text-[11px] font-bold tracking-wide text-amber-200">
              FRONT
            </div>
          </Html>
          <Html position={[1.05, 0.05, 0]} center distanceFactor={6}>
            <div className="whitespace-nowrap text-[11px] font-bold tracking-wide text-sky-200">
              RIGHT
            </div>
          </Html>
          <Html position={[-1.05, 0.05, 0]} center distanceFactor={6}>
            <div className="whitespace-nowrap text-[11px] font-bold tracking-wide text-rose-200">
              LEFT
            </div>
          </Html>
        </>
      ) : null}
    </group>
  );
}
