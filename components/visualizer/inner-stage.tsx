"use client";

import { useMemo, useRef } from "react";
import type { ReactNode, MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import * as THREE from "three";
import { garageTextures } from "@/components/visualizer/garage-textures";
import { DECK_PLATE_Y } from "@/lib/mxb/dims";
import { STAGE_TRAVEL_X, STAGE_TRAVEL_Z, stageOffset } from "@/lib/mxb/stage";
import type { FrameTravel, Pose6 } from "@/lib/mxb/motion";

/** Root of the stage: straight onto the load-plate top skin. */
const ROOT_Y = DECK_PLATE_Y + 0.012;
/** Sway carriage plate, clear of the lower rails on its bearing blocks. */
const SWAY_Y = 0.08;
/** Slewing ring on top of the surge carriage. */
const YAW_Y = 0.075;
const STACK_Y = ROOT_Y + SWAY_Y + YAW_Y;
/** How far the frame sits above the plate so the clamps clear the stage. */
export const FRAME_ON_STAGE_Y = 0.26;

/** Rails are the carriage length plus full travel each way, so nothing runs off the end. */
const SWAY_CAR_X = 0.2;
const SWAY_RAIL_X = SWAY_CAR_X + STAGE_TRAVEL_X * 2;
const SURGE_CAR_Z = 0.18;
const SURGE_RAIL_Z = SURGE_CAR_Z + STAGE_TRAVEL_Z * 2 + 0.02;
const RAIL_R = 0.012;
const LOWER_RAIL_Z = 0.11;
const UPPER_RAIL_X = 0.09;

/**
 * Surge, sway, and yaw stage between the load plate and the bike. The four
 * actuators under the plate only heave, pitch, and roll — spending their stroke
 * on horizontal slide would cost the lean angle that makes this rig worth
 * building. So those three axes get their own stacked linear stage: two
 * profile rails across for sway, two fore-aft for surge, and a slewing ring
 * for yaw, each sized to its rated travel.
 */
export function InnerStage({
  poseRef,
  travelRef,
  children,
}: {
  poseRef: MutableRefObject<Pose6>;
  travelRef: MutableRefObject<FrameTravel>;
  children: ReactNode;
}) {
  const sway = useRef<Group>(null);
  const surge = useRef<Group>(null);
  const yaw = useRef<Group>(null);
  const tex = garageTextures();
  const steel = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#4a433c",
        map: tex.diamond,
        metalness: 0.78,
        roughness: 0.36,
      }),
    [tex],
  );
  const dark = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#2a3138",
        map: tex.brushed,
        metalness: 0.72,
        roughness: 0.36,
      }),
    [tex],
  );
  const accent = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#ff6a00",
        map: tex.paint,
        metalness: 0.35,
        roughness: 0.4,
      }),
    [tex],
  );
  const chrome = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#cfcac4",
        map: tex.brushed,
        metalness: 0.92,
        roughness: 0.16,
      }),
    [tex],
  );
  const alloy = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#8a8178",
        map: tex.brushed,
        metalness: 0.74,
        roughness: 0.32,
      }),
    [tex],
  );

  useFrame(() => {
    const offset = stageOffset(poseRef.current, travelRef.current);
    if (sway.current) sway.current.position.x = offset.x;
    if (surge.current) surge.current.position.z = offset.z;
    if (yaw.current) yaw.current.rotation.y = offset.yaw;
  });

  return (
    <group position={[0, ROOT_Y, 0]}>
      {/* Rail bed bolted flat to the load plate */}
      <mesh material={dark} position={[0, 0.014, 0]} receiveShadow castShadow>
        <boxGeometry args={[SWAY_RAIL_X + 0.04, 0.028, LOWER_RAIL_Z * 2 + 0.08]} />
      </mesh>

      {/* Sway rails, running across the bike */}
      {([-1, 1] as const).map((side) => (
        <group key={`sway-rail-${side}`} position={[0, 0.045, side * LOWER_RAIL_Z]}>
          <mesh material={chrome} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[RAIL_R, RAIL_R, SWAY_RAIL_X, 12]} />
          </mesh>
          {/* End supports double as hard stops */}
          {([-1, 1] as const).map((end) => (
            <mesh key={end} material={steel} position={[(end * SWAY_RAIL_X) / 2, -0.005, 0]} castShadow>
              <boxGeometry args={[0.03, 0.05, 0.045]} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Sway drive screw down the middle */}
      <mesh material={alloy} position={[0, 0.045, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.009, 0.009, SWAY_RAIL_X - 0.06, 10]} />
      </mesh>
      <mesh material={accent} position={[-SWAY_RAIL_X / 2 + 0.01, 0.045, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.028, 0.028, 0.07, 12]} />
      </mesh>

      <group ref={sway} position={[0, SWAY_Y, 0]}>
        {/* Sway carriage plate */}
        <mesh material={steel} castShadow receiveShadow>
          <boxGeometry args={[SWAY_CAR_X, 0.02, SURGE_RAIL_Z + 0.04]} />
        </mesh>
        {/* Bearing blocks riding the lower rails */}
        {([-1, 1] as const).map((side) =>
          ([-1, 1] as const).map((pair) => (
            <mesh
              key={`block-${side}-${pair}`}
              material={dark}
              position={[pair * (SWAY_CAR_X / 2 - 0.035), -0.025, side * LOWER_RAIL_Z]}
              castShadow
            >
              <boxGeometry args={[0.05, 0.04, 0.052]} />
            </mesh>
          )),
        )}
        {/* Nut block on the sway screw */}
        <mesh material={alloy} position={[0, -0.025, 0]} castShadow>
          <boxGeometry args={[0.05, 0.035, 0.04]} />
        </mesh>

        {/* Surge rails, running fore and aft */}
        {([-1, 1] as const).map((side) => (
          <group key={`surge-rail-${side}`} position={[side * UPPER_RAIL_X, 0.028, 0]}>
            <mesh material={chrome} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[RAIL_R, RAIL_R, SURGE_RAIL_Z, 12]} />
            </mesh>
            {([-1, 1] as const).map((end) => (
              <mesh key={end} material={steel} position={[0, -0.004, (end * SURGE_RAIL_Z) / 2]} castShadow>
                <boxGeometry args={[0.045, 0.048, 0.03]} />
              </mesh>
            ))}
          </group>
        ))}
        <mesh material={accent} position={[0, 0.028, SURGE_RAIL_Z / 2 - 0.01]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.026, 0.026, 0.065, 12]} />
        </mesh>

        <group ref={surge}>
          {/* Surge carriage plate */}
          <mesh material={steel} position={[0, 0.055, 0]} castShadow receiveShadow>
            <boxGeometry args={[SWAY_CAR_X - 0.02, 0.018, SURGE_CAR_Z]} />
          </mesh>
          {([-1, 1] as const).map((side) =>
            ([-1, 1] as const).map((pair) => (
              <mesh
                key={`sblock-${side}-${pair}`}
                material={dark}
                position={[side * UPPER_RAIL_X, 0.03, pair * (SURGE_CAR_Z / 2 - 0.03)]}
                castShadow
              >
                <boxGeometry args={[0.05, 0.038, 0.048]} />
              </mesh>
            )),
          )}

          <group ref={yaw} position={[0, YAW_Y, 0]}>
            {/* Slewing ring: outer race, toothed inner, and the drive pinion */}
            <mesh material={dark} castShadow>
              <cylinderGeometry args={[0.085, 0.09, 0.022, 24]} />
            </mesh>
            <mesh material={alloy} position={[0, 0.013, 0]}>
              <torusGeometry args={[0.062, 0.009, 8, 24]} />
            </mesh>
            <mesh material={accent} position={[0, 0.016, 0]}>
              <cylinderGeometry args={[0.045, 0.045, 0.008, 18]} />
            </mesh>
            <mesh material={alloy} position={[0.075, 0.004, 0]} castShadow>
              <cylinderGeometry args={[0.018, 0.018, 0.045, 12]} />
            </mesh>
            <group position={[0, FRAME_ON_STAGE_Y - STACK_Y, 0]}>{children}</group>
          </group>
        </group>
      </group>
    </group>
  );
}
