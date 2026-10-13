"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { MutableRefObject, RefObject } from "react";
import { isRiderPad, readBodyStick, readFirstGamepad } from "@/lib/mxb/gamepad";
import { idleRider, riderFromTelemetry } from "@/lib/mxb/rider";
import { riderEye } from "@/lib/mxb/rider-eye";
import type { Telemetry } from "@/lib/mxb/types";
import { NARDO } from "@/lib/mxb/finish";
import { garageTextures } from "@/components/visualizer/garage-textures";

/**
 * Hip joint height in bike-local meters. The EXC seat tops out near y 0.78
 * after the frame is grounded, so the pelvis rides just above that.
 */
const HIP_Y = 0.86;
const HIP_Z = -0.22;

/** Lathe profile: [radius, height] up the torso from the belt to the collar. */
const TORSO_PROFILE: [number, number][] = [
  [0.105, 0.0],
  [0.12, 0.05],
  [0.126, 0.11],
  [0.134, 0.18],
  [0.146, 0.24],
  [0.152, 0.29],
  [0.138, 0.33],
  [0.1, 0.36],
  [0.07, 0.375],
];

const CHEST_PROFILE: [number, number][] = [
  [0.138, 0.12],
  [0.152, 0.18],
  [0.158, 0.24],
  [0.156, 0.29],
  [0.13, 0.325],
];

const PELVIS_PROFILE: [number, number][] = [
  [0.07, -0.13],
  [0.1, -0.1],
  [0.115, -0.05],
  [0.118, 0.0],
  [0.11, 0.04],
];

function lathe(profile: [number, number][], segments = 20) {
  return new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(Math.max(0.001, r), y)),
    segments,
  );
}

/**
 * Procedural motocross rider. Everything is a capsule, sphere, tapered
 * cylinder, or lathe-turned shell — no boxes — so the silhouette reads like
 * a rider in gear rather than a stack of crates.
 */
export function MxRider({
  telemetryRef,
  liveRef,
  padActiveRef,
  hideHelmet = false,
}: {
  telemetryRef: MutableRefObject<Telemetry>;
  liveRef: MutableRefObject<boolean>;
  padActiveRef: MutableRefObject<boolean>;
  /** POV looks out through the goggles — hide the shell so the camera is not inside plastic. */
  hideHelmet?: boolean;
}) {
  const root = useRef<THREE.Group>(null);
  const hips = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const foreL = useRef<THREE.Group>(null);
  const foreR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const shinL = useRef<THREE.Group>(null);
  const shinR = useRef<THREE.Group>(null);
  const last = useRef(idleRider());
  const tex = garageTextures();

  useEffect(() => {
    return () => {
      riderEye.ready = false;
    };
  }, []);

  const geo = useMemo(
    () => ({
      torso: lathe(TORSO_PROFILE),
      chest: lathe(CHEST_PROFILE),
      pelvis: lathe(PELVIS_PROFILE),
    }),
    [],
  );

  const mat = useMemo(() => {
    const jersey = new THREE.MeshStandardMaterial({
      color: "#1e3a5f",
      map: tex.leather,
      roughness: 0.74,
      metalness: 0.04,
    });
    const accent = new THREE.MeshStandardMaterial({
      color: NARDO,
      roughness: 0.9,
      metalness: 0.04,
    });
    const pants = new THREE.MeshStandardMaterial({
      color: "#121212",
      map: tex.carbon,
      roughness: 0.7,
      metalness: 0.16,
    });
    const boot = new THREE.MeshStandardMaterial({
      color: "#0b0b0c",
      map: tex.leather,
      roughness: 0.52,
      metalness: 0.18,
    });
    const bootPlate = new THREE.MeshStandardMaterial({
      color: "#3f3f46",
      map: tex.brushed,
      roughness: 0.42,
      metalness: 0.5,
    });
    const helmet = new THREE.MeshStandardMaterial({
      color: "#f4efe6",
      roughness: 0.26,
      metalness: 0.32,
    });
    const visor = new THREE.MeshStandardMaterial({
      color: "#0d1220",
      roughness: 0.1,
      metalness: 0.6,
    });
    const goggle = new THREE.MeshStandardMaterial({
      color: "#1f2937",
      roughness: 0.55,
      metalness: 0.1,
    });
    const glove = new THREE.MeshStandardMaterial({
      color: "#1c1917",
      map: tex.leather,
      roughness: 0.66,
      metalness: 0.08,
    });
    const brace = new THREE.MeshStandardMaterial({
      color: "#d6d3d1",
      roughness: 0.4,
      metalness: 0.2,
    });
    return { jersey, accent, pants, boot, bootPlate, helmet, visor, goggle, glove, brace };
  }, [tex]);

  useFrame((_, dt) => {
    const node = root.current;
    if (!node || !hips.current || !torso.current || !head.current) return;
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
    node.position.set(pose.lean * 0.04, HIP_Y + pose.stand * 0.13, HIP_Z + pose.foreAft * 0.08);
    node.rotation.set(sit * 0.1 + pose.foreAft * 0.15, 0, pose.lean * 0.55);

    hips.current.rotation.x = sit * 0.3;
    torso.current.rotation.x = 0.3 * sit - pose.foreAft * 0.2;
    torso.current.rotation.z = pose.lean * 0.22;
    head.current.rotation.z = -pose.lean * 0.42;
    head.current.rotation.x = -0.24 * sit - 0.05;

    // Arms stay on the grips: standing drops the shoulders toward the bar.
    const reach = pose.stand * 0.12;
    if (armL.current) armL.current.rotation.set(-0.78 - reach, 0.16, 0.2 + pose.lean * 0.18);
    if (armR.current) armR.current.rotation.set(-0.78 - reach, -0.16, -0.2 + pose.lean * 0.18);
    if (foreL.current) foreL.current.rotation.x = -0.5 + reach * 0.5;
    if (foreR.current) foreR.current.rotation.x = -0.5 + reach * 0.5;

    // Standing straightens the knees; sitting folds them over the pegs.
    const knee = 1.16 - pose.stand * 0.5;
    if (legL.current) legL.current.rotation.set(-0.94 + pose.stand * 0.42, 0.1, 0.16);
    if (legR.current) legR.current.rotation.set(-0.94 + pose.stand * 0.42, -0.1, -0.16);
    if (shinL.current) shinL.current.rotation.x = knee;
    if (shinR.current) shinR.current.rotation.x = knee;

    // Eye sits on the goggle lens, just outside the shell.
    head.current.updateWorldMatrix(true, false);
    const eye = new THREE.Vector3(0, 0.012, 0.1);
    eye.applyMatrix4(head.current.matrixWorld);
    const forward = new THREE.Vector3(0, 0, 1).transformDirection(head.current.matrixWorld);
    const up = new THREE.Vector3(0, 1, 0).transformDirection(head.current.matrixWorld);
    const look = eye.clone().add(forward);
    riderEye.matrix.lookAt(eye, look, up);
    riderEye.matrix.setPosition(eye);
    riderEye.ready = true;
  });

  const leg = (
    side: 1 | -1,
    legRef: RefObject<THREE.Group | null>,
    shinRef: RefObject<THREE.Group | null>,
  ) => (
    <group ref={legRef} position={[side * 0.1, -0.02, 0.01]} rotation={[-0.94, side * 0.1, side * 0.16]}>
      {/* Thigh */}
      <mesh material={mat.pants} position={[0, -0.18, 0]} castShadow>
        <capsuleGeometry args={[0.072, 0.2, 6, 14]} />
      </mesh>
      {/* Knee brace */}
      <mesh material={mat.brace} position={[0, -0.35, 0.012]} scale={[1, 0.9, 1.1]} castShadow>
        <sphereGeometry args={[0.062, 16, 12]} />
      </mesh>
      <group ref={shinRef} position={[0, -0.37, 0]} rotation={[1.16, 0, 0]}>
        {/* Shin */}
        <mesh material={mat.pants} position={[0, -0.15, 0]} castShadow>
          <capsuleGeometry args={[0.055, 0.17, 6, 14]} />
        </mesh>
        {/* Boot cuff, ankle, toe — all rounded */}
        <mesh material={mat.boot} position={[0, -0.26, 0]} castShadow>
          <cylinderGeometry args={[0.072, 0.062, 0.14, 16]} />
        </mesh>
        <mesh material={mat.bootPlate} position={[0, -0.2, 0.004]} castShadow>
          <cylinderGeometry args={[0.075, 0.074, 0.035, 16]} />
        </mesh>
        <mesh material={mat.boot} position={[0, -0.33, 0.01]} scale={[1, 0.82, 1.15]} castShadow>
          <sphereGeometry args={[0.062, 16, 12]} />
        </mesh>
        <mesh
          material={mat.boot}
          position={[0, -0.36, 0.08]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[1, 1, 0.62]}
          castShadow
        >
          <capsuleGeometry args={[0.045, 0.08, 6, 14]} />
        </mesh>
        <mesh material={mat.bootPlate} position={[0, -0.385, 0.05]} scale={[1, 0.3, 1.5]}>
          <sphereGeometry args={[0.05, 14, 10]} />
        </mesh>
      </group>
    </group>
  );

  const arm = (
    side: 1 | -1,
    armRef: RefObject<THREE.Group | null>,
    foreRef: RefObject<THREE.Group | null>,
  ) => (
    <group
      ref={armRef}
      position={[side * 0.16, 0.29, 0.01]}
      rotation={[-0.78, side * 0.16, side * 0.2]}
    >
      {/* Shoulder cap keeps the jersey round where a box would corner */}
      <mesh material={mat.jersey} scale={[1, 0.95, 1]} castShadow>
        <sphereGeometry args={[0.062, 16, 12]} />
      </mesh>
      <mesh material={mat.jersey} position={[0, -0.12, 0]} castShadow>
        <capsuleGeometry args={[0.052, 0.14, 6, 14]} />
      </mesh>
      <group ref={foreRef} position={[0, -0.24, 0]} rotation={[-0.5, 0, 0]}>
        <mesh material={mat.jersey} position={[0, -0.05, 0]} castShadow>
          <sphereGeometry args={[0.05, 14, 12]} />
        </mesh>
        <mesh material={mat.jersey} position={[0, -0.14, 0]} castShadow>
          <capsuleGeometry args={[0.044, 0.13, 6, 14]} />
        </mesh>
        {/* Glove wrapped on the grip */}
        <mesh material={mat.glove} position={[0, -0.25, 0.01]} scale={[1, 1, 0.85]} castShadow>
          <capsuleGeometry args={[0.044, 0.05, 6, 14]} />
        </mesh>
        <mesh
          material={mat.glove}
          position={[0, -0.28, 0.035]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[1, 1, 0.8]}
          castShadow
        >
          <capsuleGeometry args={[0.028, 0.05, 6, 12]} />
        </mesh>
      </group>
    </group>
  );

  return (
    <group ref={root} position={[0, HIP_Y, HIP_Z]}>
      <group ref={hips}>
        {/* Pelvis / seat contact */}
        <mesh
          material={mat.pants}
          geometry={geo.pelvis}
          scale={[1, 1, 0.86]}
          castShadow
          receiveShadow
        />
        <mesh material={mat.pants} position={[0, -0.05, 0]} scale={[1, 0.72, 0.9]} castShadow>
          <sphereGeometry args={[0.12, 18, 14]} />
        </mesh>

        {leg(-1, legL, shinL)}
        {leg(1, legR, shinR)}

        <group ref={torso} position={[0, 0.02, 0.01]}>
          {/* Jersey over a turned torso profile, flattened front-to-back */}
          <mesh material={mat.jersey} geometry={geo.torso} scale={[1, 1, 0.8]} castShadow receiveShadow />
          {/* Chest protector shell */}
          <mesh material={mat.accent} geometry={geo.chest} scale={[1.03, 1, 0.84]} castShadow />
          {/* Belt */}
          <mesh material={mat.pants} position={[0, 0.015, 0]} scale={[1, 1, 0.84]} castShadow>
            <cylinderGeometry args={[0.116, 0.112, 0.045, 20]} />
          </mesh>

          {arm(-1, armL, foreL)}
          {arm(1, armR, foreR)}

          {/* Neck brace */}
          <mesh material={mat.brace} position={[0, 0.375, 0.005]} rotation={[0.1, 0, 0]} castShadow>
            <torusGeometry args={[0.082, 0.022, 10, 20]} />
          </mesh>
          <mesh material={mat.jersey} position={[0, 0.39, 0]} castShadow>
            <cylinderGeometry args={[0.046, 0.055, 0.06, 14]} />
          </mesh>

          <group ref={head} position={[0, 0.44, 0.012]} rotation={[-0.05, 0, 0]}>
            {hideHelmet ? null : (
              <>
                <mesh material={mat.helmet} scale={[1, 1.02, 1.06]} castShadow>
                  <sphereGeometry args={[0.112, 22, 18]} />
                </mesh>
                <mesh
                  material={mat.helmet}
                  position={[0, -0.062, 0.062]}
                  rotation={[0.22, 0, 0]}
                  scale={[1, 0.62, 0.78]}
                  castShadow
                >
                  <sphereGeometry args={[0.098, 20, 14]} />
                </mesh>
                <mesh material={mat.visor} position={[0, -0.072, 0.108]} rotation={[0.3, 0, 0]} scale={[1, 0.5, 0.35]}>
                  <sphereGeometry args={[0.052, 16, 12]} />
                </mesh>
                <mesh material={mat.visor} position={[0, 0.012, 0.086]} scale={[1.12, 0.62, 0.42]} castShadow>
                  <sphereGeometry args={[0.078, 18, 14]} />
                </mesh>
                <mesh material={mat.goggle} position={[0, 0.012, 0.07]} rotation={[0.08, 0, 0]} scale={[1.1, 0.8, 1]}>
                  <torusGeometry args={[0.072, 0.014, 10, 22]} />
                </mesh>
                <mesh material={mat.accent} position={[0, 0.03, -0.03]} rotation={[Math.PI / 2, 0, 0]} scale={[1.04, 1.04, 1]}>
                  <torusGeometry args={[0.108, 0.016, 8, 24]} />
                </mesh>
                <mesh
                  material={mat.helmet}
                  position={[0, 0.072, 0.082]}
                  rotation={[-0.42, 0, 0]}
                  scale={[1.25, 0.16, 1]}
                  castShadow
                >
                  <sphereGeometry args={[0.078, 18, 12]} />
                </mesh>
              </>
            )}
          </group>
        </group>
      </group>
    </group>
  );
}
