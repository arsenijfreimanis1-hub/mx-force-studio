"use client";

import { useMemo } from "react";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { garageTextures } from "@/components/visualizer/garage-textures";
import { POV_CONE_Z, POV_LANE_HALF, POV_POST_Z } from "@/lib/mxb/pov-marks";

const ISLAND_R = 3.8;

const SUN = new THREE.Vector3(0.42, 0.62, -0.28).normalize();

/** Warm shop void behind the bay. Fog still owns near depth; this dome fills the far field. */
export function SkyDome() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { sunDir: { value: SUN } },
        vertexShader: `
          varying vec3 vDir;
          void main() {
            vec4 world = modelMatrix * vec4(position, 1.0);
            vDir = world.xyz;
            gl_Position = projectionMatrix * viewMatrix * world;
          }
        `,
        fragmentShader: `
          varying vec3 vDir;
          uniform vec3 sunDir;
          void main() {
            vec3 dir = normalize(vDir);
            float h = dir.y;
            vec3 zenith = vec3(0.06, 0.045, 0.035);
            vec3 mid = vec3(0.12, 0.08, 0.055);
            vec3 horizon = vec3(0.22, 0.12, 0.07);
            vec3 col = mix(horizon, mid, smoothstep(0.0, 0.22, h));
            col = mix(col, zenith, smoothstep(0.15, 0.78, h));
            if (h < 0.0) col = mix(horizon, vec3(0.05, 0.04, 0.03), smoothstep(0.0, -0.4, h));
            float sun = pow(max(dot(dir, sunDir), 0.0), 700.0);
            float glow = pow(max(dot(dir, sunDir), 0.0), 5.0);
            col += vec3(1.0, 0.68, 0.32) * sun * 0.35;
            col += vec3(0.9, 0.45, 0.18) * glow * 0.22;
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      }),
    [],
  );

  return (
    <mesh frustumCulled={false} material={material}>
      <sphereGeometry args={[160, 48, 32]} />
    </mesh>
  );
}

const CLOUDS: Array<[number, number, number, number]> = [
  [-6.5, 4.2, -3, 2.4],
  [5.5, 3.6, 2.5, 2.1],
  [1.5, 6.8, -8, 3.2],
  [-3, -4.2, 5, 3.4],
  [5, -5.5, -3, 2.8],
];

export function CloudBank() {
  const material = useMemo(() => {
    const map = garageTextures().cloud;
    return new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, opacity: 0.9 });
  }, []);
  return (
    <group>
      {CLOUDS.map(([x, y, z, s], i) => (
        <sprite key={i} position={[x, y, z]} scale={[s * 2.4, s * 1.35, 1]} material={material} />
      ))}
    </group>
  );
}

/** Warm concrete bay under the SX — shop floor colors from the mx-hub inspector. */
export function Paddock() {
  const slab = useMemo(() => {
    const map = garageTextures().dirt.clone();
    map.repeat.set(4, 4);
    map.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ color: "#1c1612", map, roughness: 0.92, metalness: 0.04 });
  }, []);
  const pad = useMemo(() => {
    const map = garageTextures().brushed.clone();
    map.repeat.set(2.4, 2.4);
    map.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ color: "#2a221c", map, roughness: 0.78, metalness: 0.18 });
  }, []);
  const keel = useMemo(() => {
    const map = garageTextures().rockTile;
    return new THREE.MeshStandardMaterial({
      color: "#171310",
      map,
      roughness: 0.9,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
  }, []);
  const crate = useMemo(() => {
    const map = garageTextures().paint;
    return new THREE.MeshStandardMaterial({ color: "#3a2a1c", map, roughness: 0.7, metalness: 0.08 });
  }, []);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} material={slab} receiveShadow>
        <circleGeometry args={[ISLAND_R, 64]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0]} material={pad} receiveShadow>
        <circleGeometry args={[2.35, 48]} />
      </mesh>
      <mesh position={[0, -0.08, 0]} material={keel}>
        <cylinderGeometry args={[ISLAND_R + 0.05, ISLAND_R - 0.15, 0.18, 48]} />
      </mesh>
      <mesh position={[0, -0.85, 0]} material={keel}>
        <cylinderGeometry args={[ISLAND_R - 0.2, 3.7, 1.45, 40, 1, true]} />
      </mesh>
      <mesh position={[0, -2.35, 0]} material={keel}>
        <cylinderGeometry args={[3.65, 0.28, 2.35, 32]} />
      </mesh>
      <mesh position={[3.35, 0.22, 2.1]} material={crate} castShadow>
        <boxGeometry args={[0.55, 0.42, 0.4]} />
      </mesh>
      <mesh position={[-3.55, 0.18, -1.8]} material={crate} castShadow>
        <boxGeometry args={[0.48, 0.34, 0.36]} />
      </mesh>
    </group>
  );
}

export function WorldMotionCues({ showLabels = true }: { showLabels?: boolean }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
        <ringGeometry args={[0.52, 0.58, 36]} />
        <meshBasicMaterial color="#d97706" transparent opacity={0.55} />
      </mesh>
      {showLabels ? (
        <>
          <Html position={[0, 0.05, 0.68]} center distanceFactor={4.2}>
            <div className="whitespace-nowrap text-[11px] font-bold tracking-wide text-amber-200">
              FRONT
            </div>
          </Html>
          <Html position={[0.68, 0.05, 0]} center distanceFactor={4.2}>
            <div className="whitespace-nowrap text-[11px] font-bold tracking-wide text-sky-200">
              RIGHT
            </div>
          </Html>
          <Html position={[-0.68, 0.05, 0]} center distanceFactor={4.2}>
            <div className="whitespace-nowrap text-[11px] font-bold tracking-wide text-rose-200">
              LEFT
            </div>
          </Html>
        </>
      ) : null}
    </group>
  );
}

function TrafficCone({ x, z, color }: { x: number; z: number; color: string }) {
  const material = useMemo(() => {
    const map = garageTextures().paint;
    return new THREE.MeshStandardMaterial({ color, map, roughness: 0.62, metalness: 0.04 });
  }, [color]);
  return (
    <mesh position={[x, 0.18, z]} material={material}>
      <coneGeometry args={[0.12, 0.36, 8]} />
    </mesh>
  );
}

function StripePost({ x, z }: { x: number; z: number }) {
  const post = useMemo(() => {
    const map = garageTextures().paint;
    return new THREE.MeshStandardMaterial({ color: "#1f2937", map, roughness: 0.78, metalness: 0.08 });
  }, []);
  const cap = useMemo(() => {
    const map = garageTextures().paint;
    return new THREE.MeshStandardMaterial({ color: "#facc15", map, roughness: 0.42, metalness: 0.12 });
  }, []);
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.95, 0]} material={post}>
        <boxGeometry args={[0.07, 1.9, 0.07]} />
      </mesh>
      <mesh position={[0, 1.62, 0]} material={cap}>
        <boxGeometry args={[0.1, 0.22, 0.1]} />
      </mesh>
    </group>
  );
}

/** One cone pair and one post pair — enough to read POV motion, not a whole lane. */
export function PovLandmarks() {
  return (
    <group>
      <TrafficCone x={-POV_LANE_HALF} z={POV_CONE_Z} color="#f97316" />
      <TrafficCone x={POV_LANE_HALF} z={POV_CONE_Z} color="#f8fafc" />
      <StripePost x={-POV_LANE_HALF - 0.38} z={POV_POST_Z} />
      <StripePost x={POV_LANE_HALF + 0.38} z={POV_POST_Z} />
    </group>
  );
}
