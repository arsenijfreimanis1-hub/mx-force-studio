"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { MutableRefObject } from "react";
import type { ForceId, ForceModel, ForceVector } from "@/lib/mxb/types";

const G_LEN = 1.15;

const FORCE_IDS: ForceId[] = [
  "gravity",
  "frontNormal",
  "rearNormal",
  "drive",
  "frontBrake",
  "rearBrake",
  "longitudinal",
  "lateral",
  "vertical",
  "fork",
  "shock",
  "aero",
  "steer",
  "gyro",
];

export function ForceArrows({
  forcesRef,
  hiddenRef,
}: {
  forcesRef: MutableRefObject<ForceModel>;
  hiddenRef: MutableRefObject<Set<ForceId>>;
}) {
  return (
    <group>
      {FORCE_IDS.map((id) => (
        <ForceArrowSlot key={id} id={id} forcesRef={forcesRef} hiddenRef={hiddenRef} />
      ))}
    </group>
  );
}

function ForceArrowSlot({
  id,
  forcesRef,
  hiddenRef,
}: {
  id: ForceId;
  forcesRef: MutableRefObject<ForceModel>;
  hiddenRef: MutableRefObject<Set<ForceId>>;
}) {
  const group = useRef<THREE.Group>(null);
  const shaft = useRef<THREE.Mesh>(null);
  const head = useRef<THREE.Mesh>(null);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const quat = useMemo(() => new THREE.Quaternion(), []);

  useFrame(() => {
    const node = group.current;
    if (!node) return;
    const model = forcesRef.current;
    const force = model.forces.find((item) => item.id === id);
    if (!force || hiddenRef.current.has(id) || force.magnitude < 8) {
      node.visible = false;
      return;
    }
    node.visible = true;
    const scale = G_LEN / (model.massKg * 9.80665);
    const length = Math.min(
      2.4,
      Math.max(0.18, force.magnitude * (force.kind === "moment" ? 0.012 : scale)),
    );
    layoutArrow(force, length, node, shaft.current, head.current, dir, up, quat);
  });

  return (
    <group ref={group} visible={false} frustumCulled={false}>
      <mesh ref={shaft} position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 0.8, 8]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.35} metalness={0.1} />
      </mesh>
      <mesh ref={head} position={[0, 0.85, 0]}>
        <coneGeometry args={[0.055, 0.14, 10]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.3} />
      </mesh>
    </group>
  );
}

function layoutArrow(
  force: ForceVector,
  length: number,
  node: THREE.Group,
  shaft: THREE.Mesh | null,
  head: THREE.Mesh | null,
  dir: THREE.Vector3,
  up: THREE.Vector3,
  quat: THREE.Quaternion,
) {
  dir.set(force.direction.x, force.direction.y, force.direction.z);
  if (dir.lengthSq() < 1e-8) {
    node.visible = false;
    return;
  }
  dir.normalize();
  quat.setFromUnitVectors(up, dir);
  node.position.set(force.origin.x, force.origin.y, force.origin.z);
  node.quaternion.copy(quat);

  const shaftLen = Math.max(0.08, length - 0.16);
  if (shaft) {
    shaft.position.set(0, shaftLen / 2, 0);
    shaft.scale.set(1, shaftLen / 0.8, 1);
    const mat = shaft.material;
    if (!Array.isArray(mat) && "color" in mat) {
      (mat as THREE.MeshStandardMaterial).color.set(force.color);
      (mat as THREE.MeshStandardMaterial).emissive.set(force.color);
      (mat as THREE.MeshStandardMaterial).emissiveIntensity = 0.35;
    }
  }
  if (head) {
    head.position.set(0, shaftLen + 0.07, 0);
    const mat = head.material;
    if (!Array.isArray(mat) && "color" in mat) {
      (mat as THREE.MeshStandardMaterial).color.set(force.color);
      (mat as THREE.MeshStandardMaterial).emissive.set(force.color);
      (mat as THREE.MeshStandardMaterial).emissiveIntensity = 0.5;
    }
  }
}
