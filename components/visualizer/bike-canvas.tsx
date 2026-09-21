"use client";

import type { MutableRefObject } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { MotocrossBike } from "@/components/visualizer/motocross-bike";
import { ForceArrows } from "@/components/visualizer/force-arrows";
import { ChassisRig } from "@/components/visualizer/chassis-rig";
import { RiderPov } from "@/components/visualizer/rider-pov";
import { Paddock, PovLandmarks, WorldMotionCues } from "@/components/visualizer/world-motion";
import { MotionPedestal } from "@/components/visualizer/support-rod";
import {
  PLATFORM_HOME_Y,
  type FrameTravel,
  type MotionFilter,
  type Pose6,
} from "@/lib/mxb/motion";
import type { HarnessState } from "@/lib/mxb/harness";
import type { RidePhaseFilter } from "@/lib/mxb/crash";
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
  harnessRef,
  ridePhaseRef,
  pov = false,
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
  harnessRef?: MutableRefObject<HarnessState>;
  ridePhaseRef?: MutableRefObject<RidePhaseFilter>;
  pov?: boolean;
}) {
  return (
    <Canvas
      shadows={false}
      dpr={[1, 1.25]}
      frameloop={driving ? "always" : "demand"}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onCreated={({ invalidate }) => invalidate()}
    >
      <color attach="background" args={["#8fb4d4"]} />
      <fog attach="fog" args={pov ? ["#c8b89c", 22, 44] : ["#c8b89c", 12, 30]} />
      <mesh>
        <sphereGeometry args={[pov ? 40 : 22, 24, 16]} />
        <meshBasicMaterial color="#8eb7d9" side={1} />
      </mesh>
      <PerspectiveCamera makeDefault={!pov} position={[1.38, 0.98, -1.72]} fov={38} />
      <hemisphereLight color="#fff1d6" groundColor="#7a5a3c" intensity={0.85} />
      <directionalLight position={[8, 10, 4]} intensity={1.7} color="#ffe7c2" />

      <group>
        <Paddock />
        <ContactShadows
          position={[0, 0.002, 0]}
          opacity={0.35}
          scale={4.6}
          blur={2.2}
          far={1.8}
          frames={driving ? Infinity : 1}
        />
        <WorldMotionCues showLabels={showPadLabels} />
        <PovLandmarks />
        <MotionPedestal poseRef={poseRef} travelRef={travelRef} />
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
          harnessRef={harnessRef}
          ridePhaseRef={ridePhaseRef}
        >
          <RiderPov enabled={pov} telemetryRef={telemetryRef} />
          <MotocrossBike telemetryRef={telemetryRef} liveRef={liveRef} padActiveRef={padActiveRef} />
          {hideForces ? null : <ForceArrows forcesRef={forcesRef} hiddenRef={hiddenRef} />}
        </ChassisRig>
      </group>

      {pov ? null : (
        <OrbitControls
          enablePan={inspect}
          enableZoom
          enableRotate={inspect}
          maxPolarAngle={Math.PI / 2 - 0.04}
          minDistance={0.7}
          maxDistance={4.2}
          target={[0, PLATFORM_HOME_Y + 0.28, 0]}
        />
      )}
    </Canvas>
  );
}
