"use client";

import { useMemo } from "react";
import * as THREE from "three";

/** Small plate a new user can read as “the frame you sit on”. */
export function MotionDeck() {
  const plate = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#292524", metalness: 0.4, roughness: 0.5 }),
    [],
  );
  const front = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#f59e0b", metalness: 0.35, roughness: 0.4 }),
    [],
  );
  const rail = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#78716c", metalness: 0.45, roughness: 0.42 }),
    [],
  );

  return (
    <group position={[0, 0.02, 0]}>
      <mesh material={plate} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0.02]}>
        <planeGeometry args={[0.42, 0.72]} />
      </mesh>
      <mesh material={front} position={[0, 0.016, 0.36]}>
        <boxGeometry args={[0.44, 0.028, 0.055]} />
      </mesh>
      <mesh material={rail} position={[0.2, 0.01, 0.02]}>
        <boxGeometry args={[0.02, 0.016, 0.7]} />
      </mesh>
      <mesh material={rail} position={[-0.2, 0.01, 0.02]}>
        <boxGeometry args={[0.02, 0.016, 0.7]} />
      </mesh>
    </group>
  );
}
