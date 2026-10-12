"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { MutableRefObject } from "react";
import { isRiderPad, readBodyStick, readFirstGamepad } from "@/lib/mxb/gamepad";
import { idleRider, riderFromTelemetry } from "@/lib/mxb/rider";
import type { Telemetry } from "@/lib/mxb/types";
import { FRAME_ORIGIN_Y } from "@/lib/mxb/motion";
import { garageTextures } from "@/components/visualizer/garage-textures";

/** Chassis origin above the motion-base origin. The deck and stage hang off this. */
export const FRAME_CENTER_Y = FRAME_ORIGIN_Y;

export function RiderTorso({
  telemetryRef,
  liveRef,
  padActiveRef,
}: {
  telemetryRef: MutableRefObject<Telemetry>;
  liveRef: MutableRefObject<boolean>;
  padActiveRef: MutableRefObject<boolean>;
}) {
  const group = useRef<THREE.Group>(null);
  const chest = useRef<THREE.Group>(null);
  const last = useRef(idleRider());
  const suit = useMemo(() => {
    const map = garageTextures().leather;
    return new THREE.MeshStandardMaterial({ color: "#2a241c", map, roughness: 0.72, metalness: 0.06 });
  }, []);
  const pants = useMemo(() => {
    const map = garageTextures().leather;
    return new THREE.MeshStandardMaterial({ color: "#141210", map, roughness: 0.8, metalness: 0.04 });
  }, []);
  const helmetMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#f4efe6", roughness: 0.32, metalness: 0.35 }),
    [],
  );
  const visor = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#1a120c", roughness: 0.15, metalness: 0.6 }),
    [],
  );

  useFrame((_, dt) => {
    const node = group.current;
    const chestNode = chest.current;
    if (!node || !chestNode) return;
    const gp = readFirstGamepad();
    const stick = isRiderPad(gp) ? readBodyStick(gp) : undefined;
    const active = liveRef.current || Boolean(gp?.connected) || padActiveRef.current;
    const want = active ? riderFromTelemetry(telemetryRef.current, stick) : idleRider();
    const a = active ? 1 - Math.exp(-Math.min(0.05, dt) / 0.07) : 1;
    const pose = last.current;
    pose.stand += (want.stand - pose.stand) * a;
    pose.lean += (want.lean - pose.lean) * a;
    pose.foreAft += (want.foreAft - pose.foreAft) * a;
    const sit = 1 - pose.stand;
    node.position.set(pose.lean * 0.03, 0.6 + pose.stand * 0.1, -0.02 + pose.foreAft);
    node.rotation.set(sit * 0.08, 0, pose.lean * 0.85);
    chestNode.rotation.x = 0.18 * sit;
  });

  return (
    <group ref={group} position={[0, 0.6, -0.02]}>
      <mesh material={pants} position={[0, 0.05, -0.01]}>
        <boxGeometry args={[0.2, 0.1, 0.14]} />
      </mesh>
      <mesh material={pants} position={[-0.07, -0.02, 0.02]} rotation={[0.7, 0, 0.15]}>
        <capsuleGeometry args={[0.035, 0.1, 4, 8]} />
      </mesh>
      <mesh material={pants} position={[0.07, -0.02, 0.02]} rotation={[0.7, 0, -0.15]}>
        <capsuleGeometry args={[0.035, 0.1, 4, 8]} />
      </mesh>
      <group ref={chest} position={[0, 0.2, 0.02]}>
        <mesh material={suit} position={[0, 0.1, 0.03]}>
          <boxGeometry args={[0.22, 0.26, 0.14]} />
        </mesh>
        <mesh material={suit} position={[0, 0.2, 0.02]} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.045, 0.22, 4, 8]} />
        </mesh>
        <mesh material={suit} position={[-0.15, 0.08, 0.18]} rotation={[1.35, 0.2, 0.25]}>
          <capsuleGeometry args={[0.03, 0.22, 4, 8]} />
        </mesh>
        <mesh material={suit} position={[0.15, 0.08, 0.18]} rotation={[1.35, -0.2, -0.25]}>
          <capsuleGeometry args={[0.03, 0.22, 4, 8]} />
        </mesh>
        <mesh material={suit} position={[0, 0.28, 0.03]}>
          <cylinderGeometry args={[0.04, 0.05, 0.07, 10]} />
        </mesh>
        <mesh material={helmetMat} position={[0, 0.38, 0.04]}>
          <sphereGeometry args={[0.09, 16, 12]} />
        </mesh>
        <mesh material={visor} position={[0, 0.36, 0.14]}>
          <boxGeometry args={[0.13, 0.045, 0.03]} />
        </mesh>
      </group>
    </group>
  );
}
