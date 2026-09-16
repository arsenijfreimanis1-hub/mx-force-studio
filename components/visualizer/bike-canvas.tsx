"use client";

import { Canvas } from "@react-three/fiber";
import { ContactShadows, Grid, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { MotocrossBike } from "@/components/visualizer/motocross-bike";
import { ForceArrows } from "@/components/visualizer/force-arrows";
import type { ForceId, ForceModel, Telemetry } from "@/lib/mxb/types";

export function BikeCanvas({
  telemetry,
  model,
  hidden,
  inspect,
}: {
  telemetry: Telemetry;
  model: ForceModel;
  hidden: Set<ForceId>;
  inspect: boolean;
}) {
  return (
    <Canvas shadows dpr={[1, 2]} gl={{ antialias: true }}>
      <color attach="background" args={["#120e0b"]} />
      <fog attach="fog" args={["#120e0b", 8, 22]} />
      <PerspectiveCamera makeDefault position={[3.4, 1.6, 3.8]} fov={38} />
      <ambientLight intensity={0.5} />
      <hemisphereLight args={["#dbeafe", "#3a2a1c", 0.7]} />
      <directionalLight
        position={[4, 8, 3]}
        intensity={2.1}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight position={[-5, 4, -3]} intensity={0.6} color="#93c5fd" />
      <spotLight position={[-3, 5, 2]} intensity={1.1} angle={0.6} penumbra={0.5} color="#fdba74" />

      <group position={[0, 0, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[6, 48]} />
          <meshStandardMaterial color="#292018" roughness={0.95} />
        </mesh>
        <Grid
          args={[12, 12]}
          cellSize={0.5}
          cellThickness={0.6}
          cellColor="#3f2e22"
          sectionSize={2}
          sectionThickness={1.1}
          sectionColor="#7c4a1e"
          fadeDistance={10}
          fadeStrength={1.4}
          position={[0, 0.002, 0]}
        />
        <MotocrossBike telemetry={telemetry} />
        <ForceArrows forces={model.forces} massKg={model.massKg} hidden={hidden} />
        {model.airborne ? null : <ContactShadows opacity={0.45} scale={8} blur={2.2} far={2.5} />}
      </group>

      <OrbitControls
        enablePan={inspect}
        enableZoom
        enableRotate={inspect}
        maxPolarAngle={Math.PI / 2 - 0.04}
        minDistance={2.4}
        maxDistance={9}
        target={[0, 0.7, 0]}
      />
    </Canvas>
  );
}
