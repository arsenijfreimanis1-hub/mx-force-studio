"use client";

import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { ForceId, ForceVector } from "@/lib/mxb/types";

const G_LEN = 1.15;

export function ForceArrows({
  forces,
  massKg,
  hidden,
}: {
  forces: ForceVector[];
  massKg: number;
  hidden: Set<ForceId>;
}) {
  const scale = G_LEN / (massKg * 9.80665);

  return (
    <group>
      {forces.map((force) => {
        if (hidden.has(force.id) || force.magnitude < 8) return null;
        const length = Math.min(
          2.4,
          Math.max(0.18, force.magnitude * (force.kind === "moment" ? 0.012 : scale)),
        );
        return (
          <ForceArrow key={force.id} force={force} length={length} />
        );
      })}
    </group>
  );
}

function ForceArrow({ force, length }: { force: ForceVector; length: number }) {
  const dir = new THREE.Vector3(force.direction.x, force.direction.y, force.direction.z).normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const shaft = Math.max(0.08, length - 0.16);
  const origin = new THREE.Vector3(force.origin.x, force.origin.y, force.origin.z);

  return (
    <group position={origin} quaternion={quat}>
      <mesh position={[0, shaft / 2, 0]}>
        <cylinderGeometry args={[0.018, 0.018, shaft, 8]} />
        <meshStandardMaterial
          color={force.color}
          emissive={force.color}
          emissiveIntensity={0.35}
          roughness={0.35}
          metalness={0.1}
        />
      </mesh>
      <mesh position={[0, shaft + 0.07, 0]}>
        <coneGeometry args={[0.055, 0.14, 10]} />
        <meshStandardMaterial
          color={force.color}
          emissive={force.color}
          emissiveIntensity={0.5}
          roughness={0.3}
        />
      </mesh>
      <Html
        position={[0, length + 0.08, 0]}
        center
        sprite
        distanceFactor={8}
        style={{ pointerEvents: "none" }}
      >
        <div className="rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-white whitespace-nowrap">
          {force.shortName}
        </div>
      </Html>
    </group>
  );
}
