"use client";

import { Suspense, memo, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { InnerStage } from "@/components/visualizer/inner-stage";
import { MotionDeck } from "@/components/visualizer/motion-deck";
import { FRAME_CENTER_Y, RiderTorso } from "@/components/visualizer/motocross-bike";
import {
  SX_ASSEMBLIES,
  SX_FRONT_RADIUS_M,
  SX_RAKE_RAD,
  SX_SWING_PIVOT_Y,
  SX_SWING_PIVOT_Z,
  SX_WHEELBASE_M,
  forkSlideM,
  swingPitchRad,
  sxRole,
  type SxRole,
} from "@/lib/mxb/sx-rig";
import type { Telemetry } from "@/lib/mxb/types";
import type { FrameTravel, Pose6 } from "@/lib/mxb/motion";

export const SX_MODEL_URL = "/models/ktm-sx-250.glb";

export type SxPartInfo = {
  id: string;
  label: string;
  assembly: string;
};

type RigPart = SxPartInfo & { object: THREE.Object3D };

type SxRig = {
  root: THREE.Object3D;
  fork: THREE.Group;
  steer: THREE.Group;
  swing: THREE.Group;
  frontWheel: THREE.Group;
  rearWheel: THREE.Group;
  forkBase: THREE.Quaternion;
  frontAxle: THREE.Vector3;
  axis: THREE.Vector3;
  parts: RigPart[];
};

const Y_AXIS = new THREE.Vector3(0, 1, 0);

function partIdOf(object: THREE.Object3D) {
  const id = (object.userData as { part_id?: unknown }).part_id;
  return typeof id === "string" ? id : null;
}

function prepareSxRig(source: THREE.Object3D): SxRig {
  const root = source;
  const parts: RigPart[] = [];
  let parent: THREE.Object3D = root;
  root.traverse((object) => {
    const id = partIdOf(object);
    if (!id) return;
    const data = object.userData as { label?: unknown; assembly?: unknown };
    parts.push({
      id,
      label: typeof data.label === "string" ? data.label : id,
      assembly: typeof data.assembly === "string" ? data.assembly : "Other",
      object,
    });
    if (object.parent) parent = object.parent;
  });

  const axis = new THREE.Vector3(0, Math.cos(SX_RAKE_RAD), -Math.sin(SX_RAKE_RAD)).normalize();
  const xAxis = new THREE.Vector3(1, 0, 0);
  const zAxis = new THREE.Vector3().crossVectors(xAxis, axis).normalize();
  const forkBase = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, axis, zAxis));
  const frontAxle = new THREE.Vector3(0, SX_FRONT_RADIUS_M, SX_WHEELBASE_M / 2);
  const swingPivot = new THREE.Vector3(0, SX_SWING_PIVOT_Y, SX_SWING_PIVOT_Z);

  const fork = new THREE.Group();
  const steer = new THREE.Group();
  const swing = new THREE.Group();
  const frontWheel = new THREE.Group();
  const rearWheel = new THREE.Group();
  fork.name = "sx-fork";
  steer.name = "sx-steer";
  swing.name = "sx-swing";
  frontWheel.name = "sx-front-wheel";
  rearWheel.name = "sx-rear-wheel";

  fork.position.copy(frontAxle);
  fork.quaternion.copy(forkBase);
  steer.position.copy(frontAxle);
  steer.quaternion.copy(forkBase);
  swing.position.copy(swingPivot);
  fork.add(frontWheel);
  swing.add(rearWheel);
  parent.add(fork, steer, swing);
  parent.updateWorldMatrix(true, true);

  const buckets: Record<SxRole, THREE.Object3D> = {
    chassis: parent,
    steer,
    fork,
    "front-wheel": frontWheel,
    swing,
    "rear-wheel": rearWheel,
  };
  for (const part of parts) {
    const role = sxRole(part.id, part.assembly);
    if (role === "chassis") continue;
    buckets[role].attach(part.object);
  }

  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });

  const order = new Map(SX_ASSEMBLIES.map((name, index) => [name, index]));
  parts.sort((a, b) => {
    const ao = order.get(a.assembly as (typeof SX_ASSEMBLIES)[number]) ?? 99;
    const bo = order.get(b.assembly as (typeof SX_ASSEMBLIES)[number]) ?? 99;
    if (ao !== bo) return ao - bo;
    return a.label.localeCompare(b.label);
  });

  return { root, fork, steer, swing, frontWheel, rearWheel, forkBase, frontAxle, axis, parts };
}

function SxMesh({
  telemetryRef,
  hiddenIds,
  onParts,
}: {
  telemetryRef: MutableRefObject<Telemetry>;
  hiddenIds: string[];
  onParts: (parts: SxPartInfo[]) => void;
}) {
  const gltf = useGLTF(SX_MODEL_URL);
  const rig = useMemo(() => prepareSxRig(gltf.scene.clone(true)), [gltf.scene]);
  const steerQ = useMemo(() => new THREE.Quaternion(), []);
  const reported = useRef(false);
  const invalidate = useThree((state) => state.invalidate);
  const hidden = useMemo(() => new Set(hiddenIds), [hiddenIds]);

  useEffect(() => {
    if (reported.current) return;
    reported.current = true;
    onParts(rig.parts.map(({ id, label, assembly }) => ({ id, label, assembly })));
  }, [onParts, rig.parts]);

  useLayoutEffect(() => {
    for (const part of rig.parts) part.object.visible = !hidden.has(part.id);
    invalidate();
  }, [hidden, invalidate, rig.parts]);

  useFrame((_, dt) => {
    const tel = telemetryRef.current;
    const steer = (tel.steer * Math.PI) / 180;
    const slide = forkSlideM(tel.suspLength[0]);
    steerQ.setFromAxisAngle(Y_AXIS, steer);
    rig.fork.quaternion.copy(rig.forkBase).multiply(steerQ);
    rig.steer.quaternion.copy(rig.forkBase).multiply(steerQ);
    rig.fork.position.copy(rig.frontAxle).addScaledVector(rig.axis, slide);
    rig.swing.rotation.x = swingPitchRad(tel.suspLength[1]);
    const step = Math.min(0.05, Math.max(0, dt));
    rig.frontWheel.rotation.x -= tel.wheelSpeed[0] * step;
    rig.rearWheel.rotation.x -= tel.wheelSpeed[1] * step;
  });

  return <primitive object={rig.root} />;
}

useGLTF.preload(SX_MODEL_URL);

export const SxBike = memo(function SxBike({
  telemetryRef,
  liveRef,
  padActiveRef,
  poseRef,
  travelRef,
  hiddenIds,
  onParts,
}: {
  telemetryRef: MutableRefObject<Telemetry>;
  liveRef: MutableRefObject<boolean>;
  padActiveRef: MutableRefObject<boolean>;
  poseRef: MutableRefObject<Pose6>;
  travelRef: MutableRefObject<FrameTravel>;
  hiddenIds: string[];
  onParts: (parts: SxPartInfo[]) => void;
}) {
  return (
    <group position={[0, FRAME_CENTER_Y, 0]}>
      <MotionDeck />
      <InnerStage poseRef={poseRef} travelRef={travelRef}>
        <group position={[0, -0.2, 0.02]}>
          <Suspense fallback={null}>
            <SxMesh telemetryRef={telemetryRef} hiddenIds={hiddenIds} onParts={onParts} />
          </Suspense>
          <group position={[0, 0.32, -0.13]}>
            <RiderTorso telemetryRef={telemetryRef} liveRef={liveRef} padActiveRef={padActiveRef} />
          </group>
        </group>
      </InnerStage>
    </group>
  );
});
