"use client";

import type { MutableRefObject } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls, PerspectiveCamera, Sky } from "@react-three/drei";
import { MotocrossBike } from "@/components/visualizer/motocross-bike";
import { ForceArrows } from "@/components/visualizer/force-arrows";
import { ChassisRig } from "@/components/visualizer/chassis-rig";
import { Paddock, WorldMotionCues } from "@/components/visualizer/world-motion";
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
  showPadLabels = true,
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
  showPadLabels?: boolean;
}) {
  return (
    <Canvas
      shadows={false}
      dpr={[1, 1.25]}
      frameloop={driving ? "always" : "demand"}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onCreated={({ invalidate }) => invalidate()}
    >
      <color attach="background" args={["#87a0b8"]} />
      <fog attach="fog" args={["#c4b49a", 14, 42]} />
      <Sky inclination={0.47} azimuth={0.22} mieCoefficient={0.006} rayleigh={1.2} turbidity={6} />
      <PerspectiveCamera makeDefault position={[1.35, 1.05, -2.15]} fov={40} />
      <hemisphereLight color="#fff4e0" groundColor="#6b5340" intensity={0.7} />
      <directionalLight position={[6, 8, 3]} intensity={1.55} color="#ffe6b8" />

      <group>
        <Paddock />
        <ContactShadows
          position={[0, 0.002, 0]}
          opacity={0.35}
          scale={8}
          blur={2.2}
          far={2.5}
          frames={driving ? Infinity : 1}
        />
        <WorldMotionCues showLabels={showPadLabels} />
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
        minDistance={0.95}
        maxDistance={7}
        target={[0, PLATFORM_HOME_Y, 0]}
      />
    </Canvas>
  );
}
