"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { DECK_HALF_L_DRAW, DECK_HALF_W_DRAW, DECK_PLATE_Y } from "@/lib/mxb/dims";
import { ROD_CORNERS } from "@/lib/mxb/rods";
import { garageTextures } from "@/components/visualizer/garage-textures";

/** Local Y of the rubber jaw pads relative to the FrameCradles group origin. */
export const CRADLE_PAD_Y = 0.128;
/** Where the frame spars are clamped, in plate Z. */
export const CLAMP_Z = [-0.2, 0.17] as const;

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
      {CLAMP_Z.map((z, i) => (
        <group key={`cradle-${i}`} position={[0, 0, z]}>
          {([-1, 1] as const).map((side) => (
            <group key={side} position={[side * 0.11, 0, 0]}>
              {/* Upright post off the stage */}
              <mesh material={dark} position={[0, 0.04, 0]} castShadow>
                <boxGeometry args={[0.05, 0.08, 0.09]} />
              </mesh>
              {/* Saddle the spar drops into */}
              <mesh material={steel} position={[0, 0.095, 0]} castShadow>
                <boxGeometry args={[0.044, 0.055, 0.085]} />
              </mesh>
              <mesh material={rubber} position={[0, CRADLE_PAD_Y - 0.008, 0]}>
                <cylinderGeometry args={[0.019, 0.019, 0.08, 12]} />
              </mesh>
              {/* Hinged cap over the top of the spar */}
              <mesh material={accent} position={[0, CRADLE_PAD_Y + 0.016, 0]} castShadow>
                <boxGeometry args={[0.05, 0.016, 0.07]} />
              </mesh>
              {/* Pinch bolts, one each side of the jaw */}
              {([-1, 1] as const).map((bz) => (
                <mesh
                  key={bz}
                  material={steel}
                  position={[0, CRADLE_PAD_Y + 0.004, bz * 0.03]}
                  rotation={[0, 0, Math.PI / 2]}
                >
                  <cylinderGeometry args={[0.006, 0.006, 0.052, 8]} />
                </mesh>
              ))}
            </group>
          ))}
          {/* Cross tie between the two posts */}
          <mesh material={steel} position={[0, 0.05, 0]} castShadow>
            <boxGeometry args={[0.26, 0.022, 0.045]} />
          </mesh>
        </group>
      ))}
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

      {/* Machined bolt pads where the cradle posts land. */}
      {CLAMP_Z.map((z) => (
        <mesh key={`pad-${z}`} material={steel} position={[0, 0.014, z]} receiveShadow>
          <boxGeometry args={[0.3, 0.01, 0.11]} />
        </mesh>
      ))}

      {/* Toe board at the front of the plate. */}
      <mesh material={accent} position={[0, 0.03, PLATE_L * 0.5 - 0.04]} castShadow>
        <boxGeometry args={[PLATE_W, 0.05, 0.05]} />
      </mesh>
      <mesh material={dark} position={[0, 0.058, PLATE_L * 0.5 - 0.04]}>
        <boxGeometry args={[PLATE_W * 0.5, 0.018, 0.045]} />
      </mesh>

      {/* Low side rails so a boot cannot slide off the edge. */}
      {([-1, 1] as const).map((side) => (
        <mesh key={`rail-${side}`} material={steel} position={[side * (PLATE_W * 0.5 - 0.02), 0.014, 0]} castShadow>
          <boxGeometry args={[0.035, 0.03, PLATE_L - 0.1]} />
        </mesh>
      ))}

      {/* Rider peg platforms, grip-taped. */}
      {([-1, 1] as const).map((side) => (
        <group key={`peg-${side}`} position={[side * 0.195, 0.03, 0.02]}>
          <mesh material={dark} castShadow>
            <boxGeometry args={[0.12, 0.028, 0.24]} />
          </mesh>
          <mesh material={rubber} position={[0, 0.019, 0]}>
            <boxGeometry args={[0.105, 0.012, 0.21]} />
          </mesh>
        </group>
      ))}

      {/* Rear grab hoop — how you move the machine and what a rider holds mounting. */}
      <mesh material={steel} position={[0, 0.11, -PLATE_L * 0.5 + 0.05]} castShadow>
        <torusGeometry args={[0.14, 0.013, 8, 20, Math.PI]} />
      </mesh>
      {([-1, 1] as const).map((side) => (
        <mesh key={`hoop-leg-${side}`} material={steel} position={[side * 0.14, 0.055, -PLATE_L * 0.5 + 0.05]} castShadow>
          <cylinderGeometry args={[0.013, 0.013, 0.11, 10]} />
        </mesh>
      ))}

      {/* Builder's plate. */}
      <mesh material={accent} position={[0, 0.014, -PLATE_L * 0.5 + 0.12]}>
        <boxGeometry args={[0.1, 0.004, 0.05]} />
      </mesh>
    </group>
  );
}
