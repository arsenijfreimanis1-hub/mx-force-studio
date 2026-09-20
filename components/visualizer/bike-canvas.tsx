"use client";

import type { MutableRefObject } from "react";
import { Canvas } from "@react-three/fiber";
import { Grid, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { MotocrossBike } from "@/components/visualizer/motocross-bike";
import { ForceArrows } from "@/components/visualizer/force-arrows";
import { ChassisRig } from "@/components/visualizer/chassis-rig";
import { WorldMotionCues } from "@/components/visualizer/world-motion";
import { MotionPedestal } from "@/components/visualizer/support-rod";
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
  connectRef,
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
  connectRef: MutableRefObject<boolean>;
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
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onCreated={({ invalidate }) => invalidate()}
    >
      <color attach="background" args={["#120e0b"]} />
      <fog attach="fog" args={["#120e0b", 8, 18]} />
      <PerspectiveCamera makeDefault position={[1.55, 1.42, -3.15]} fov={38} />
      <ambientLight intensity={0.52} />
      <directionalLight position={[3, 7, 2]} intensity={2.05} />

      <group>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[5.5, 32]} />
          <meshStandardMaterial color="#292018" roughness={0.95} />
        </mesh>
        <Grid
          args={[10, 10]}
          cellSize={0.35}
          cellThickness={0.55}
          cellColor="#3f2e22"
          sectionSize={0.7}
          sectionThickness={1.15}
          sectionColor="#7c4a1e"
          fadeDistance={9}
          fadeStrength={1.2}
          position={[0, 0.002, 0]}
        />
        <WorldMotionCues />
        <MotionPedestal poseRef={poseRef} />
        <ChassisRig
          poseRef={poseRef}
          telemetryRef={telemetryRef}
          motionRef={motionRef}
          travelRef={travelRef}
          liveRef={liveRef}
          connectRef={connectRef}
          padActiveRef={padActiveRef}
          sandboxRef={sandboxRef}
          eventRef={eventRef}
          forcesRef={forcesRef}
        >
          <MotocrossBike telemetryRef={telemetryRef} liveRef={liveRef} padActiveRef={padActiveRef} />
          {hideForces ? null : <ForceArrows forcesRef={forcesRef} hiddenRef={hiddenRef} />}
        </ChassisRig>
      </group>

      <OrbitControls
        enablePan={inspect}
        enableZoom
        enableRotate={inspect}
        maxPolarAngle={Math.PI / 2 - 0.04}
        minDistance={1.2}
        maxDistance={10}
        target={[0, PLATFORM_HOME_Y, 0]}
      />
    </Canvas>
  );
}
