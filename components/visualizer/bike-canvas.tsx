"use client";

import type { MutableRefObject } from "react";
import { Canvas } from "@react-three/fiber";
import { Grid, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { MotocrossBike } from "@/components/visualizer/motocross-bike";
import { ForceArrows } from "@/components/visualizer/force-arrows";
import { ChassisRig } from "@/components/visualizer/chassis-rig";
import { WorldMotionCues } from "@/components/visualizer/world-motion";
import {
  PLATFORM_HOME_Y,
  type FrameTravel,
  type MotionFilter,
  type Pose6,
} from "@/lib/mxb/motion";
import type { BikeEvent, ForceId, ForceModel, SandboxInputs, Telemetry } from "@/lib/mxb/types";

export function BikeCanvas({
  telemetryRef,
  hideForces,
  inspect,
  poseRef,
  motionRef,
  travelRef,
  liveRef,
  padActiveRef,
  sandboxRef,
  eventRef,
  forcesRef,
  hiddenRef,
  driving,
}: {
  telemetryRef: MutableRefObject<Telemetry>;
  hideForces: boolean;
  inspect: boolean;
  poseRef: MutableRefObject<Pose6>;
  motionRef: MutableRefObject<MotionFilter>;
  travelRef: MutableRefObject<FrameTravel>;
  liveRef: MutableRefObject<boolean>;
  padActiveRef: MutableRefObject<boolean>;
  sandboxRef: MutableRefObject<SandboxInputs>;
  eventRef: MutableRefObject<BikeEvent>;
  forcesRef: MutableRefObject<ForceModel>;
  hiddenRef: MutableRefObject<Set<ForceId>>;
  driving: boolean;
}) {
  return (
    <Canvas
      shadows={false}
      dpr={[1, 1.25]}
      frameloop={driving ? "always" : "demand"}
      gl={{ antialias: true }}
      onCreated={({ invalidate }) => invalidate()}
    >
      <color attach="background" args={["#120e0b"]} />
      <fog attach="fog" args={["#120e0b", 14, 32]} />
      <PerspectiveCamera makeDefault position={[3.6, 2.7, -5.4]} fov={36} />
      <ambientLight intensity={0.48} />
      <directionalLight position={[4, 10, 3]} intensity={2.05} />

      <group>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[8, 32]} />
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
        <WorldMotionCues />
        <ChassisRig
          poseRef={poseRef}
          telemetryRef={telemetryRef}
          motionRef={motionRef}
          travelRef={travelRef}
          liveRef={liveRef}
          padActiveRef={padActiveRef}
          sandboxRef={sandboxRef}
          eventRef={eventRef}
          forcesRef={forcesRef}
        >
          <MotocrossBike />
          {hideForces ? null : <ForceArrows forcesRef={forcesRef} hiddenRef={hiddenRef} />}
        </ChassisRig>
      </group>

      <OrbitControls
        enablePan={inspect}
        enableZoom
        enableRotate={inspect}
        maxPolarAngle={Math.PI / 2 - 0.04}
        minDistance={2.4}
        maxDistance={18}
        target={[0, PLATFORM_HOME_Y, 0]}
      />
    </Canvas>
  );
}
