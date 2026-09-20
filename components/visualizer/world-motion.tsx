"use client";

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
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0.88]}>
        <coneGeometry args={[0.08, 0.16, 3]} />
        <meshBasicMaterial color="#fbbf24" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[0.88, 0.012, 0]}>
        <coneGeometry args={[0.055, 0.11, 3]} />
        <meshBasicMaterial color="#38bdf8" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, -Math.PI / 2]} position={[-0.88, 0.012, 0]}>
        <coneGeometry args={[0.055, 0.11, 3]} />
        <meshBasicMaterial color="#f87171" />
      </mesh>
    </group>
  );
}
