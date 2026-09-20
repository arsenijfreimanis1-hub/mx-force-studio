"use client";

/** Garage pad only — trail, tethers, and RGB rods are gone. */
export function WorldMotionCues() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
        <circleGeometry args={[1.25, 32]} />
        <meshStandardMaterial color="#9a3412" roughness={0.85} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
        <ringGeometry args={[0.92, 1.18, 48]} />
        <meshBasicMaterial color="#fb923c" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.16, 16]} />
        <meshBasicMaterial color="#fde68a" />
      </mesh>
    </group>
  );
}
