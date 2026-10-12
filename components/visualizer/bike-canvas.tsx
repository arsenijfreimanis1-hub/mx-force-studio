"use client";

import { useLayoutEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  Grid,
  Lightformer,
  OrbitControls,
  PerspectiveCamera,
} from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { ExcBike, type ExcPartInfo } from "@/components/visualizer/exc-bike";
import { ForceArrows } from "@/components/visualizer/force-arrows";
import { ChassisRig } from "@/components/visualizer/chassis-rig";
import { RiderPov } from "@/components/visualizer/rider-pov";
import { Paddock, PovLandmarks, SkyDome, WorldMotionCues } from "@/components/visualizer/world-motion";
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

/** Pulled in and raised for the compact cradle — the old frame was set for a rig half again as tall. */
const ORBIT_HOME = new THREE.Vector3(2.6, 1.85, -3.4);
const ORBIT_TARGET = new THREE.Vector3(0, PLATFORM_HOME_Y + 0.85, 0);

function GarageOrbit({
  pov,
  inspect,
  orbitCam,
}: {
  pov: boolean;
  inspect: boolean;
  orbitCam: MutableRefObject<THREE.PerspectiveCamera | null>;
}) {
  const controls = useRef<OrbitControlsImpl>(null);
  const savedPos = useRef(ORBIT_HOME.clone());
  const savedQuat = useRef(new THREE.Quaternion());
  const savedTarget = useRef(ORBIT_TARGET.clone());
  const homed = useRef(false);
  const set = useThree((s) => s.set);

  useFrame(() => {
    const cam = orbitCam.current;
    const ctl = controls.current;
    if (!cam || !ctl || !homed.current || pov) return;
    savedPos.current.copy(cam.position);
    savedQuat.current.copy(cam.quaternion);
    savedTarget.current.copy(ctl.target);
  });

  useLayoutEffect(() => {
    const cam = orbitCam.current;
    if (!cam) return;
    cam.name = "garage-orbit";
    if (!homed.current) {
      cam.position.copy(ORBIT_HOME);
      cam.lookAt(ORBIT_TARGET);
      savedPos.current.copy(cam.position);
      savedQuat.current.copy(cam.quaternion);
      homed.current = true;
    }
    if (pov) return;
    cam.position.copy(savedPos.current);
    cam.quaternion.copy(savedQuat.current);
    const ctl = controls.current;
    if (ctl) {
      ctl.object = cam;
      ctl.target.copy(savedTarget.current);
      ctl.enabled = true;
      ctl.update();
    } else {
      cam.lookAt(savedTarget.current);
    }
    cam.updateProjectionMatrix();
    set({ camera: cam });
  }, [pov, set, orbitCam]);

  return (
    <>
      <PerspectiveCamera ref={orbitCam} makeDefault={!pov} fov={46} near={0.08} far={400} />
      <OrbitControls
        ref={controls}
        makeDefault={!pov}
        enabled={!pov}
        enablePan={inspect && !pov}
        enableZoom={!pov}
        enableRotate={inspect && !pov}
        maxPolarAngle={Math.PI / 2 + 0.28}
        minDistance={1.35}
        maxDistance={16}
        target={ORBIT_TARGET.toArray()}
      />
    </>
  );
}

function StudioScene(props: {
  pov: boolean;
  inspect: boolean;
  telemetryRef: MutableRefObject<Telemetry>;
  hideForces: boolean;
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
  showPadLabels: boolean;
  harnessRef?: MutableRefObject<HarnessState>;
  ridePhaseRef?: MutableRefObject<RidePhaseFilter>;
  hiddenParts: string[];
  onParts: (parts: ExcPartInfo[]) => void;
}) {
  const orbitCam = useRef<THREE.PerspectiveCamera>(null);
  const {
    pov,
    inspect,
    telemetryRef,
    hideForces,
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
    showPadLabels,
    harnessRef,
    ridePhaseRef,
    hiddenParts,
    onParts,
  } = props;
  return (
    <>
      <color attach="background" args={["#100d0b"]} />
      <fog attach="fog" args={pov ? ["#100d0b", 7, 22] : ["#100d0b", 10, 28]} />
      <SkyDome />
      <GarageOrbit pov={pov} inspect={inspect} orbitCam={orbitCam} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[3, 6, 3]}
        intensity={1.7}
        color="#fff1d6"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
      >
        <orthographicCamera attach="shadow-camera" args={[-2.5, 2.5, 2.5, -2.5, 0.5, 16]} />
      </directionalLight>
      <spotLight
        position={[-3, 4, -2]}
        intensity={0.95}
        angle={0.7}
        penumbra={0.6}
        color="#fdba74"
      />
      <Environment resolution={64} environmentIntensity={0.6}>
        <Lightformer form="rect" intensity={3} position={[0, 4, 0]} rotation-x={Math.PI / 2} scale={[6, 6, 1]} />
        <Lightformer form="rect" intensity={1.5} position={[4, 1.5, 2]} rotation-y={-Math.PI / 3} scale={[4, 2, 1]} />
        <Lightformer
          form="rect"
          intensity={1.2}
          color="#fdba74"
          position={[-4, 1.5, -2]}
          rotation-y={Math.PI / 3}
          scale={[4, 2, 1]}
        />
      </Environment>
      <group>
        <Paddock />
        <Grid
          args={[12, 12]}
          cellSize={0.1}
          cellThickness={0.5}
          cellColor="#2e2219"
          sectionSize={0.5}
          sectionThickness={1}
          sectionColor="#6b3f1a"
          fadeDistance={11}
          fadeStrength={1.5}
          position={[0, 0.001, 0]}
        />
        <ContactShadows
          position={[0, 0.002, 0]}
          opacity={0.45}
          scale={6}
          blur={2.4}
          far={1.6}
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
          <RiderPov
            enabled={pov}
            telemetryRef={telemetryRef}
            garageCamRef={orbitCam}
            poseRef={poseRef}
            travelRef={travelRef}
          />
          <ExcBike
            telemetryRef={telemetryRef}
            liveRef={liveRef}
            padActiveRef={padActiveRef}
            poseRef={poseRef}
            travelRef={travelRef}
            hiddenIds={hiddenParts}
            onParts={onParts}
          />
          {hideForces ? null : <ForceArrows forcesRef={forcesRef} hiddenRef={hiddenRef} />}
        </ChassisRig>
      </group>
    </>
  );
}

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
  hiddenParts,
  onParts,
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
  hiddenParts: string[];
  onParts: (parts: ExcPartInfo[]) => void;
}) {
  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 2]}
      frameloop={driving ? "always" : "demand"}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onCreated={({ invalidate }) => invalidate()}
    >
      <StudioScene
        pov={pov}
        inspect={inspect}
        telemetryRef={telemetryRef}
        hideForces={hideForces}
        poseRef={poseRef}
        motionRef={motionRef}
        travelRef={travelRef}
        liveRef={liveRef}
        connectRef={connectRef}
        padActiveRef={padActiveRef}
        sandboxRef={sandboxRef}
        eventRef={eventRef}
        forcesRef={forcesRef}
        hiddenRef={hiddenRef}
        driving={driving}
        showPadLabels={showPadLabels}
        harnessRef={harnessRef}
        ridePhaseRef={ridePhaseRef}
        hiddenParts={hiddenParts}
        onParts={onParts}
      />
    </Canvas>
  );
}
