"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { MutableRefObject } from "react";
import { garageTextures } from "@/components/visualizer/garage-textures";
import { DEFAULT_ROD_STROKE } from "@/lib/mxb/dims";
import { NARDO } from "@/lib/mxb/finish";
import { PLATFORM_HOME_Y, visualPitch, type FrameTravel, type Pose6 } from "@/lib/mxb/motion";
import { ROD_CORNERS, defaultRestRodLength, rodBaseCorner, rodDeckLocal } from "@/lib/mxb/rods";

const up = new THREE.Vector3(0, 1, 0);

/**
 * Barrel length is fixed, as it is on a real cylinder — the rod is what moves.
 * It has to swallow the full stroke plus end caps and still be shorter than the
 * strut is when fully retracted, otherwise the drawing asks for a cylinder
 * shorter than its own body.
 */
const BARREL_LEN = Math.min(
  defaultRestRodLength() - DEFAULT_ROD_STROKE - 0.08,
  DEFAULT_ROD_STROKE * 2 + 0.05,
);

/**
 * The four actuators and the welded base they stand on. Each leg is a trunnion
 * foot, a fixed barrel, a chrome rod, and a rod-end bearing into the plate
 * clevis — the load path a manufacturer would check first. The base is a
 * perimeter frame that stops at the feet rather than a full floor pan, so the
 * machine's footprint is only as big as it needs to be.
 */
export function MotionPedestal({
  poseRef,
  travelRef,
}: {
  poseRef: MutableRefObject<Pose6>;
  travelRef?: MutableRefObject<FrameTravel>;
}) {
  const barrel0 = useRef<THREE.Group>(null);
  const barrel1 = useRef<THREE.Group>(null);
  const barrel2 = useRef<THREE.Group>(null);
  const barrel3 = useRef<THREE.Group>(null);
  const rod0 = useRef<THREE.Mesh>(null);
  const rod1 = useRef<THREE.Mesh>(null);
  const rod2 = useRef<THREE.Mesh>(null);
  const rod3 = useRef<THREE.Mesh>(null);
  const top0 = useRef<THREE.Mesh>(null);
  const top1 = useRef<THREE.Mesh>(null);
  const top2 = useRef<THREE.Mesh>(null);
  const top3 = useRef<THREE.Mesh>(null);
  const barrels = [barrel0, barrel1, barrel2, barrel3];
  const rods = [rod0, rod1, rod2, rod3];
  const tops = [top0, top1, top2, top3];
  const start = useMemo(() => new THREE.Vector3(), []);
  const end = useMemo(() => new THREE.Vector3(), []);
  const barrelMid = useMemo(() => new THREE.Vector3(), []);
  const rodMid = useMemo(() => new THREE.Vector3(), []);
  const quat = useMemo(() => new THREE.Quaternion(), []);
  const prevQuat = useMemo(() => ROD_CORNERS.map(() => new THREE.Quaternion()), []);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const euler = useMemo(() => new THREE.Euler(0, 0, 0, "YXZ"), []);
  const local = useMemo(() => new THREE.Vector3(), []);
  const fl = useMemo(() => rodBaseCorner(-1, 1), []);
  const baseX = Math.abs(fl.x);
  const baseZ = Math.abs(fl.z);
  const beam = 0.09;
  const tex = garageTextures();

  const steel = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#3f3a34",
        map: tex.diamond,
        metalness: 0.78,
        roughness: 0.36,
      }),
    [tex],
  );
  const barrel = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#1f2937",
        map: tex.brushed,
        metalness: 0.7,
        roughness: 0.35,
      }),
    [tex],
  );
  const chrome = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#d6d3d1",
        map: tex.brushed,
        metalness: 0.92,
        roughness: 0.18,
      }),
    [tex],
  );
  const accent = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: NARDO,
        roughness: 0.86,
        metalness: 0.05,
      }),
    [],
  );
  const joint = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#a8a29e",
        map: tex.brushed,
        metalness: 0.85,
        roughness: 0.25,
      }),
    [tex],
  );

  useFrame(() => {
    const pose = poseRef.current;
    const pitchSign = travelRef?.current.visualPitch ?? -1;
    const pitch = visualPitch(pose.pitch, pitchSign);
    euler.set(pitch, 0, pose.roll, "YXZ");

    for (let i = 0; i < ROD_CORNERS.length; i++) {
      const barrelGroup = barrels[i].current;
      const rodMesh = rods[i].current;
      const ball = tops[i].current;
      if (!barrelGroup || !rodMesh) continue;
      const c = ROD_CORNERS[i];
      const base = rodBaseCorner(c.x, c.z);
      const deck = rodDeckLocal(c.x, c.z);
      start.set(base.x, base.y, base.z);
      local.set(deck.x, deck.y, deck.z).applyEuler(euler);
      // Stop under the plate, in the clevis, so the rod never comes up through the stage.
      end.set(local.x, local.y + PLATFORM_HOME_Y + pose.y - 0.09, local.z);
      dir.copy(end).sub(start);
      const length = Math.max(BARREL_LEN + 0.03, dir.length());
      dir.normalize();
      quat.setFromUnitVectors(up, dir);
      if (quat.dot(prevQuat[i]) < 0) quat.set(-quat.x, -quat.y, -quat.z, -quat.w);
      prevQuat[i].copy(quat);

      // Barrel is bolted to the trunnion and never changes length.
      barrelMid.copy(start).addScaledVector(dir, BARREL_LEN * 0.5);
      barrelGroup.position.copy(barrelMid);
      barrelGroup.quaternion.copy(quat);

      // Rod runs from inside the barrel up to the plate clevis.
      const rodLen = length - BARREL_LEN + 0.06;
      rodMid.copy(end).addScaledVector(dir, -rodLen * 0.5);
      rodMesh.position.copy(rodMid);
      rodMesh.quaternion.copy(quat);
      rodMesh.scale.set(1, rodLen, 1);

      if (ball) ball.position.copy(end);
    }
  });

  return (
    <group>
      {/* Perimeter base frame: it stops at the feet, no floor pan. */}
      {([-1, 1] as const).map((side) => (
        <mesh
          key={`beam-z-${side}`}
          position={[side * baseX, beam * 0.5, 0]}
          material={steel}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[beam, beam, baseZ * 2 + beam]} />
        </mesh>
      ))}
      {([-1, 1] as const).map((side) => (
        <mesh
          key={`beam-x-${side}`}
          position={[0, beam * 0.5, side * baseZ]}
          material={steel}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[baseX * 2 - beam, beam, beam]} />
        </mesh>
      ))}
      {/* Diagonal-equivalent cross ties through the middle of the frame. */}
      <mesh position={[0, beam * 0.4, 0]} material={steel} castShadow>
        <boxGeometry args={[0.06, 0.05, baseZ * 2 - beam]} />
      </mesh>
      <mesh position={[0, beam * 0.4, 0]} material={steel} castShadow>
        <boxGeometry args={[baseX * 2 - beam, 0.05, 0.06]} />
      </mesh>

      {/* Anchor pads — this is how the machine is bolted to the shop floor. */}
      {ROD_CORNERS.map((c) => (
        <group key={`foot-${c.id}`} position={[c.x * baseX, 0, c.z * baseZ]}>
          <mesh position={[0, 0.008, 0]} material={steel} receiveShadow>
            <boxGeometry args={[0.16, 0.016, 0.16]} />
          </mesh>
          {([-1, 1] as const).map((bx) =>
            ([-1, 1] as const).map((bz) => (
              <mesh key={`${bx}-${bz}`} position={[bx * 0.055, 0.021, bz * 0.055]} material={joint}>
                <cylinderGeometry args={[0.011, 0.011, 0.014, 8]} />
              </mesh>
            )),
          )}
          {/* Trunnion: the barrel pivots on this pin. */}
          {([-1, 1] as const).map((cheek) => (
            <mesh
              key={`cheek-${cheek}`}
              position={[cheek * 0.045, 0.05, 0]}
              material={steel}
              castShadow
            >
              <boxGeometry args={[0.016, 0.07, 0.08]} />
            </mesh>
          ))}
          <mesh position={[0, 0.07, 0]} rotation={[0, 0, Math.PI / 2]} material={joint} castShadow>
            <cylinderGeometry args={[0.014, 0.014, 0.11, 10]} />
          </mesh>
        </group>
      ))}

      {/* Mounting step, bolted to the base frame so it does not move with the bike. */}
      <group position={[-(baseX + 0.13), 0, 0]}>
        <mesh position={[0, 0.17, 0]} material={steel} castShadow receiveShadow>
          <boxGeometry args={[0.24, 0.018, 0.4]} />
        </mesh>
        <mesh position={[0, 0.182, 0]} material={accent}>
          <boxGeometry args={[0.21, 0.006, 0.36]} />
        </mesh>
        {([-1, 1] as const).map((side) => (
          <mesh key={side} position={[0.0, 0.085, side * 0.16]} material={steel} castShadow>
            <boxGeometry args={[0.2, 0.17, 0.03]} />
          </mesh>
        ))}
        <mesh position={[0.1, 0.17, 0]} material={steel} castShadow>
          <boxGeometry args={[0.13, 0.016, 0.07]} />
        </mesh>
      </group>

      {/* Drive cabinet, behind the frame where it can be opened. */}
      <group position={[0, 0, -(baseZ + 0.16)]}>
        <mesh position={[0, 0.21, 0]} material={steel} castShadow receiveShadow>
          <boxGeometry args={[0.4, 0.42, 0.22]} />
        </mesh>
        <mesh position={[0, 0.24, 0.112]} material={accent}>
          <boxGeometry args={[0.3, 0.26, 0.006]} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[0, 0.07 + i * 0.022, 0.112]} material={joint}>
            <boxGeometry args={[0.26, 0.008, 0.008]} />
          </mesh>
        ))}
        <mesh position={[0.15, 0.44, 0]} material={accent} castShadow>
          <cylinderGeometry args={[0.022, 0.022, 0.04, 12]} />
        </mesh>
      </group>

      {/* Actuators: trunnion-mounted barrel, sliding rod, rod-end bearing. */}
      {barrels.map((ref, i) => (
        <group key={`barrel-${ROD_CORNERS[i].id}`} ref={ref}>
          <mesh material={barrel} castShadow>
            <cylinderGeometry args={[0.044, 0.044, BARREL_LEN, 32]} />
          </mesh>
          {([-1, 1] as const).map((cap) => (
            <mesh key={cap} position={[0, (cap * BARREL_LEN) / 2, 0]} material={joint} castShadow>
              <cylinderGeometry args={[0.05, 0.05, 0.026, 16]} />
            </mesh>
          ))}
          {/* Hose ports at the blind end. */}
          <mesh position={[0.046, -BARREL_LEN * 0.3, 0]} material={accent} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.012, 0.012, 0.03, 8]} />
          </mesh>
          <mesh position={[0.046, -BARREL_LEN * 0.18, 0]} material={accent} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.012, 0.012, 0.03, 8]} />
          </mesh>
          {/* Stroke label stripe. */}
          <mesh position={[0, BARREL_LEN * 0.28, 0]} material={accent}>
            <cylinderGeometry args={[0.0445, 0.0445, 0.02, 16]} />
          </mesh>
        </group>
      ))}

      {rods.map((ref, i) => (
        <mesh key={`rod-${ROD_CORNERS[i].id}`} ref={ref} material={chrome} castShadow>
          <cylinderGeometry args={[0.022, 0.022, 1, 32]} />
        </mesh>
      ))}

      {tops.map((ref, i) => (
        <mesh key={`ball-${ROD_CORNERS[i].id}`} ref={ref} material={joint} castShadow>
          <sphereGeometry args={[0.032, 14, 12]} />
        </mesh>
      ))}
    </group>
  );
}
