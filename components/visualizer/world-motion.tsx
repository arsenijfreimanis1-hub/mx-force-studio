"use client";

import { Html } from "@react-three/drei";

/** Garage pad + heading marks so a new user can read lean vs front. */
export function WorldMotionCues() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
        <circleGeometry args={[0.78, 32]} />
        <meshStandardMaterial color="#9a3412" roughness={0.85} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
        <ringGeometry args={[0.58, 0.74, 48]} />
        <meshBasicMaterial color="#fb923c" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.1, 16]} />
        <meshBasicMaterial color="#fde68a" />
      </mesh>
      <Html position={[0, 0.04, 0.98]} center distanceFactor={6}>
        <div className="whitespace-nowrap text-[11px] font-bold tracking-wide text-amber-300">
          FRONT
        </div>
      </Html>
      <Html position={[0.98, 0.04, 0]} center distanceFactor={6}>
        <div className="whitespace-nowrap text-[11px] font-bold tracking-wide text-sky-300">
          RIGHT
        </div>
      </Html>
      <Html position={[-0.98, 0.04, 0]} center distanceFactor={6}>
        <div className="whitespace-nowrap text-[11px] font-bold tracking-wide text-rose-300">
          LEFT
        </div>
      </Html>
    </group>
  );
}
