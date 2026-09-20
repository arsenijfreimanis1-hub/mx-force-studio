"use client";

import type { MutableRefObject } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Grid, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { MotocrossBike } from "@/components/visualizer/motocross-bike";
import { ForceArrows } from "@/components/visualizer/force-arrows";
import { ChassisRig } from "@/components/visualizer/chassis-rig";
import { WorldMotionCues } from "@/components/visualizer/world-motion";
import type { FrameTravel, Pose6 } from "@/lib/mxb/motion";
import type { ForceId, ForceModel, Telemetry } from "@/lib/mxb/types";

export function BikeCanvas({
  telemetry,
  model,
  hidden,
  inspect,
  poseRef,
  travel,
}: {
  telemetry: Telemetry;
  model: ForceModel;
  hidden: Set<ForceId>;
  inspect: boolean;
  poseRef: MutableRefObject<Pose6>;
  travel: FrameTravel;
}) {
  return (
    <Canvas shadows dpr={[1, 1.5]} gl={{ antialias: true }}>
      <color attach="background" args={["#120e0b"]} />
      <fog attach="fog" args={["#120e0b", 12, 28]} />
      <PerspectiveCamera makeDefault position={[5.6, 2.6, 6.2]} fov={36} />
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

      <group>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[8, 48]} />
          <meshStandardMaterial color="#292018" roughness={0.95} />
        </mesh>
        <Grid
          args={[16, 16]}
          cellSize={0.5}
          cellThickness={0.55}
          cellColor="#3f2e22"
          sectionSize={1}
          sectionThickness={1.15}
          sectionColor="#7c4a1e"
          fadeDistance={14}
          fadeStrength={1.2}
          position={[0, 0.002, 0]}
        />
        <WorldMotionCues poseRef={poseRef} travel={travel} />
        <ChassisRig poseRef={poseRef}>
          <MotocrossBike telemetry={telemetry} />
          <ForceArrows forces={model.forces} massKg={model.massKg} hidden={hidden} />
        </ChassisRig>
        {model.airborne ? null : (
          <ContactShadows opacity={0.42} scale={12} blur={2.4} far={3.5} position={[0, 0.001, 0]} />
        )}
      </group>

      <OrbitControls
        enablePan={inspect}
        enableZoom
        enableRotate={inspect}
        maxPolarAngle={Math.PI / 2 - 0.04}
        minDistance={2.8}
        maxDistance={16}
        target={[0, 0.45, 0]}
      />
    </Canvas>
  );
}
