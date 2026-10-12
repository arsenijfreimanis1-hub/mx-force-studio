"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { DECK_HALF_L_DRAW, DECK_HALF_W_DRAW, DECK_PLATE_Y } from "@/lib/mxb/dims";
import { CRADLE_PAD_Y, FRAME_CLAMPS } from "@/lib/mxb/exc-mount";
import { ROD_CORNERS } from "@/lib/mxb/rods";
import { garageTextures } from "@/components/visualizer/garage-textures";

export { CRADLE_PAD_Y };

const PLATE_W = DECK_HALF_W_DRAW * 2 + 0.08;
const PLATE_L = DECK_HALF_L_DRAW * 2 + 0.12;
const PLATE_T = 0.05;

function useDeckMaterials() {
  const tex = garageTextures();
  return useMemo(() => {
    const plate = new THREE.MeshStandardMaterial({
      color: "#2f2a24",
      map: tex.diamond,
      metalness: 0.72,
      roughness: 0.4,
    });
    const plateTop = new THREE.MeshStandardMaterial({
      color: "#3d3630",
      map: tex.diamond,
      metalness: 0.68,
      roughness: 0.38,
    });
    const accent = new THREE.MeshStandardMaterial({
      color: "#ea580c",
      map: tex.paint,
      metalness: 0.32,
      roughness: 0.42,
    });
    const steel = new THREE.MeshStandardMaterial({
      color: "#6b6560",
      map: tex.brushed,
      metalness: 0.78,
      roughness: 0.32,
    });
    const dark = new THREE.MeshStandardMaterial({
      color: "#1c1916",
      map: tex.brushed,
      metalness: 0.7,
      roughness: 0.4,
    });
    const rubber = new THREE.MeshStandardMaterial({
      color: "#111010",
      roughness: 0.92,
      metalness: 0.02,
    });
    return { plate, plateTop, accent, steel, dark, rubber };
  }, [tex]);
}

/**
 * Frame cradle clamps that ride with the bike (inside InnerStage).
 * The lower spars sit in rubber-lined jaws and are pinched by a hinged cap —
 * the same way a shop stand holds a chassis, so nothing rests on the tires.
 */
export function FrameCradles() {
  const { accent, steel, dark, rubber } = useDeckMaterials();

  return (
    <group>
      {FRAME_CLAMPS.map((clamp) => {
        const jaw = CRADLE_PAD_Y + clamp.lift;
        return (
          <group key={clamp.id} position={[0, 0, clamp.z]}>
            {/* Cross tie carrying both jaws back to the yaw ring */}
            <mesh material={steel} position={[0, 0.03, 0]} castShadow>
              <boxGeometry args={[clamp.x * 2 + 0.05, 0.026, 0.05]} />
            </mesh>
            {([-1, 1] as const).map((side) => (
              <group key={side} position={[side * clamp.x, 0, 0]}>
                {/* Post up from the tie, sized to this rail's height */}
                <mesh material={dark} position={[0, (jaw - 0.03) * 0.5 + 0.015, 0]} castShadow>
                  <boxGeometry args={[0.042, jaw - 0.03, 0.055]} />
                </mesh>
                {/* Saddle the rail drops into, rubber lined */}
                <mesh material={steel} position={[0, jaw - 0.022, 0]} castShadow>
                  <boxGeometry args={[0.05, 0.03, 0.075]} />
                </mesh>
                <mesh material={rubber} position={[0, jaw - 0.006, 0]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.014, 0.014, 0.07, 12]} />
                </mesh>
                {/* Hinged cap pinched over the rail */}
                <mesh material={accent} position={[0, jaw + 0.016, 0]} castShadow>
                  <boxGeometry args={[0.052, 0.014, 0.062]} />
                </mesh>
                {([-1, 1] as const).map((bz) => (
                  <mesh
                    key={bz}
                    material={steel}
                    position={[0, jaw + 0.006, bz * 0.032]}
                    rotation={[0, 0, Math.PI / 2]}
                  >
                    <cylinderGeometry args={[0.005, 0.005, 0.05, 8]} />
                  </mesh>
                ))}
              </group>
            ))}
          </group>
        );
      })}
    </group>
  );
}

/**
 * The load plate. Flat welded top, box-section ribs underneath, and a rod-end
 * clevis at each of the four actuator corners so the load path from cylinder to
 * plate is something you can point at on a drawing.
 */
export function MotionDeck() {
  const { plate, plateTop, accent, steel, dark, rubber } = useDeckMaterials();

  return (
    <group position={[0, DECK_PLATE_Y, 0]}>
      {/* Plate: top face at local y = 0, which is DECK_ATTACH_Y in rig space. */}
      <mesh material={plate} position={[0, -PLATE_T * 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[PLATE_W, PLATE_T, PLATE_L]} />
      </mesh>
      <mesh material={plateTop} position={[0, 0.006, 0]} receiveShadow>
        <boxGeometry args={[PLATE_W - 0.04, 0.012, PLATE_L - 0.05]} />
      </mesh>

      {/* Box-section ribs under the plate, on the actuator lines. */}
      {([-1, 1] as const).map((side) => (
        <mesh
          key={`rib-z-${side}`}
          material={dark}
          position={[side * DECK_HALF_W_DRAW, -PLATE_T - 0.03, 0]}
          castShadow
        >
          <boxGeometry args={[0.06, 0.06, PLATE_L - 0.06]} />
        </mesh>
      ))}
      {([-1, 1] as const).map((side) => (
        <mesh
          key={`rib-x-${side}`}
          material={dark}
          position={[0, -PLATE_T - 0.03, side * DECK_HALF_L_DRAW]}
          castShadow
        >
          <boxGeometry args={[PLATE_W - 0.06, 0.06, 0.06]} />
        </mesh>
      ))}

      {/* Rod-end clevis at each actuator corner. */}
      {ROD_CORNERS.map((c) => (
        <group
          key={`clevis-${c.id}`}
          position={[c.x * DECK_HALF_W_DRAW, -PLATE_T - 0.03, c.z * DECK_HALF_L_DRAW]}
        >
          {([-1, 1] as const).map((cheek) => (
            <mesh key={cheek} material={steel} position={[cheek * 0.034, 0, 0]} castShadow>
              <boxGeometry args={[0.014, 0.075, 0.075]} />
            </mesh>
          ))}
          <mesh material={steel} position={[0, -0.016, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.013, 0.013, 0.095, 10]} />
          </mesh>
        </group>
      ))}

      {/*
        Nothing else stands on this plate. The sway carriage sweeps almost its
        whole area, so a toe board or a grab hoop here would be a shear point
        and the rider's feet belong on the bike's own pegs. Only the machined
        rail pads and the builder's plate, both under the carriage.
      */}
      {([-1, 1] as const).map((side) => (
        <mesh key={`bolt-pad-${side}`} material={steel} position={[0, 0.014, side * 0.11]} receiveShadow>
          <boxGeometry args={[0.46, 0.008, 0.07]} />
        </mesh>
      ))}

      {/* Lifting eyes, outboard of anything that moves. */}
      {([-1, 1] as const).map((side) => (
        <mesh
          key={`eye-${side}`}
          material={steel}
          position={[side * (PLATE_W * 0.5 - 0.015), -0.02, PLATE_L * 0.5 - 0.03]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
        >
          <torusGeometry args={[0.02, 0.006, 8, 14]} />
        </mesh>
      ))}

      <mesh material={accent} position={[0, -0.012, PLATE_L * 0.5 + 0.001]}>
        <boxGeometry args={[0.11, 0.028, 0.004]} />
      </mesh>
    </group>
  );
}
