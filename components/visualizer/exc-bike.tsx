"use client";

import { Suspense, memo, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { InnerStage } from "@/components/visualizer/inner-stage";
import { FrameCradles, MotionDeck } from "@/components/visualizer/motion-deck";
import { CRADLE_PAD_Y, RUBBER_CRUSH } from "@/lib/mxb/exc-mount";
import { MxRider } from "@/components/visualizer/mx-rider";
import { FRAME_CENTER_Y } from "@/components/visualizer/motocross-bike";
import { EXC_ASSEMBLIES, MODEL_URL, chassisSquat, partMeta, slug } from "@/lib/mxb/exc-parts";
import { isSplitMaterial, partBox, regionFor } from "@/lib/mxb/exc-split";
import { garageTextures } from "@/components/visualizer/garage-textures";
import { NARDO, NARDO_DARK } from "@/lib/mxb/finish";
import type { Telemetry } from "@/lib/mxb/types";
import type { FrameTravel, Pose6 } from "@/lib/mxb/motion";

export type ExcPartInfo = {
  id: string;
  label: string;
  assembly: string;
};

type RigPart = ExcPartInfo & { objects: THREE.Object3D[] };

type ExcRig = {
  root: THREE.Object3D;
  parts: RigPart[];
  steer: THREE.Group;
  /** Yaw that squares the bars to the bike at plugin steer 0. */
  restYaw: number;
  clutch: THREE.Group;
  frontBrake: THREE.Group;
  rearBrake: THREE.Group;
  shifter: THREE.Group;
};

function materialName(mesh: THREE.Mesh): string {
  const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  return (mat && "name" in mat && mat.name) || mesh.name || "Part";
}

/** Strip baked logos and repaint the shell: Nardo grey where it was orange, carbon where it was black. */
function debrandMaterials(root: THREE.Object3D) {
  const carbon = typeof document === "undefined" ? null : garageTextures().carbon;
  const nardo = new Set(["Orange_Plastics", "Fuel_Tank"]);
  const carbonNames = new Set(["Dark_Plastics", "Black", "Dark_Metal"]);
  const done = new Set<THREE.Material>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of list) {
      if (!(mat instanceof THREE.MeshStandardMaterial)) continue;
      if (done.has(mat)) continue;
      done.add(mat);
      if (mat.emissiveMap) {
        mat.emissiveMap.dispose();
        mat.emissiveMap = null;
        mat.emissive.set("#000000");
      }
      if (nardo.has(mat.name) || mat.name === "Orange_Metal") {
        if (mat.map) {
          mat.map.dispose();
          mat.map = null;
        }
        mat.color.set(mat.name === "Orange_Metal" ? NARDO_DARK : NARDO);
        mat.metalness = mat.name === "Orange_Metal" ? 0.18 : 0.04;
        mat.roughness = mat.name === "Orange_Metal" ? 0.72 : 0.9;
      } else if (carbonNames.has(mat.name)) {
        if (mat.map && mat.map !== carbon) mat.map.dispose();
        mat.map = carbon;
        mat.color.set("#1a1a1a");
        mat.metalness = 0.22;
        mat.roughness = 0.62;
      } else if (mat.name === "Black_Seat") {
        if (mat.map) {
          mat.map.dispose();
          mat.map = null;
        }
        mat.color.set("#121212");
        mat.metalness = 0.02;
        mat.roughness = 0.92;
      } else if (mat.name === "Front_Plate") {
        if (mat.map) {
          mat.map.dispose();
          mat.map = null;
        }
        mat.color.set(NARDO);
        mat.metalness = 0.04;
        mat.roughness = 0.9;
        mat.side = THREE.DoubleSide;
      }
      mat.needsUpdate = true;
    }
  });
}

/** Triangle corner → source vertex index, indexed or not. */
function cornerIndex(index: THREE.BufferAttribute | null, tri: number, corner: number) {
  return index ? index.getX(tri * 3 + corner) : tri * 3 + corner;
}

/**
 * Group a mesh's triangles into connected shells. Vertices are welded on a
 * quantized position so shells that share a seam but not an index still join.
 */
function shellsOf(geo: THREE.BufferGeometry): number[][] {
  const pos = geo.getAttribute("position");
  const index = geo.getIndex();
  const triCount = index ? index.count / 3 : pos.count / 3;

  const weld = new Map<string, number>();
  const rep = new Int32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const key = `${Math.round(pos.getX(i) * 2000)},${Math.round(pos.getY(i) * 2000)},${Math.round(
      pos.getZ(i) * 2000,
    )}`;
    const seen = weld.get(key);
    if (seen === undefined) weld.set(key, i);
    rep[i] = seen === undefined ? i : seen;
  }

  const parent = new Int32Array(pos.count);
  for (let i = 0; i < parent.length; i++) parent[i] = i;
  const find = (a: number) => {
    let node = a;
    while (parent[node] !== node) {
      parent[node] = parent[parent[node]];
      node = parent[node];
    }
    return node;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  for (let t = 0; t < triCount; t++) {
    const a = rep[cornerIndex(index, t, 0)];
    const b = rep[cornerIndex(index, t, 1)];
    const c = rep[cornerIndex(index, t, 2)];
    union(a, b);
    union(b, c);
  }

  const groups = new Map<number, number[]>();
  for (let t = 0; t < triCount; t++) {
    const root = find(rep[cornerIndex(index, t, 0)]);
    const list = groups.get(root);
    if (list) list.push(t);
    else groups.set(root, [t]);
  }
  return [...groups.values()];
}

/** Rebuild one geometry from a triangle subset, keeping every attribute. */
function geometryFromTriangles(geo: THREE.BufferGeometry, tris: number[]): THREE.BufferGeometry {
  const index = geo.getIndex();
  const out = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(geo.attributes)) {
    const source = attr as THREE.BufferAttribute;
    const items = source.itemSize;
    const array = new Float32Array(tris.length * 3 * items);
    let write = 0;
    for (const t of tris) {
      for (let c = 0; c < 3; c++) {
        const v = cornerIndex(index, t, c);
        for (let k = 0; k < items; k++) array[write++] = source.array[v * items + k] as number;
      }
    }
    out.setAttribute(name, new THREE.BufferAttribute(array, items, source.normalized));
  }
  out.computeBoundingSphere();
  return out;
}

/**
 * Replace each one-mesh-per-material group with one mesh per named shell
 * region, so the panel can hide a single fender instead of all plastics.
 */
function splitMeshesByRegion(meshes: THREE.Mesh[]): { id: string; object: THREE.Object3D }[] {
  const out: { id: string; object: THREE.Object3D }[] = [];
  const box = new THREE.Box3();
  const point = new THREE.Vector3();

  for (const mesh of meshes) {
    const name = materialName(mesh);
    const parent = mesh.parent;
    if (!isSplitMaterial(name) || !parent) {
      out.push({ id: slug(name), object: mesh });
      continue;
    }

    const geo = mesh.geometry;
    const pos = geo.getAttribute("position");
    const index = geo.getIndex();
    const byRegion = new Map<string, number[]>();

    for (const shell of shellsOf(geo)) {
      box.makeEmpty();
      for (const t of shell) {
        for (let c = 0; c < 3; c++) {
          const v = cornerIndex(index, t, c);
          point.set(pos.getX(v), pos.getY(v), pos.getZ(v)).applyMatrix4(mesh.matrixWorld);
          box.expandByPoint(point);
        }
      }
      const region =
        regionFor(
          name,
          partBox(
            { x: box.min.x, y: box.min.y, z: box.min.z },
            { x: box.max.x, y: box.max.y, z: box.max.z },
          ),
        ) ?? slug(name);
      const list = byRegion.get(region);
      if (list) list.push(...shell);
      else byRegion.set(region, [...shell]);
    }

    for (const [region, tris] of byRegion) {
      const sub = new THREE.Mesh(geometryFromTriangles(geo, tris), mesh.material);
      sub.name = `${mesh.name || name}_${region}`;
      sub.position.copy(mesh.position);
      sub.quaternion.copy(mesh.quaternion);
      sub.scale.copy(mesh.scale);
      parent.add(sub);
      out.push({ id: region, object: sub });
    }
    parent.remove(mesh);
    geo.dispose();
  }

  return out;
}

const STEER_PARTS = [
  "handlebar",
  "grip_l",
  "grip_r",
  "bar_controls",
  "handguard_l",
  "handguard_r",
  "bar_mounts",
  "triple_clamp",
  "lower_clamp",
];
const NAMED_CONTROLS = ["clutch_lever", "brake_lever", "shift_lever", "rear_brake_pedal"] as const;

function carbonMetal() {
  const map = typeof document === "undefined" ? null : garageTextures().carbon;
  return new THREE.MeshStandardMaterial({
    color: "#1a1a1a",
    map,
    metalness: 0.22,
    roughness: 0.62,
  });
}

/** Procedural blade used only when the Blender-named mesh is missing. */
function hingeLever() {
  const group = new THREE.Group();
  const mat = carbonMetal();
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0035, 0.1, 12), mat);
  arm.geometry.translate(0, 0.05, 0.012);
  arm.castShadow = true;
  group.add(arm);
  const perch = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.018, 10), mat);
  perch.rotation.z = Math.PI / 2;
  group.add(perch);
  return group;
}

function findNamedMesh(root: THREE.Object3D, name: string): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  root.traverse((object) => {
    if (found) return;
    if (object.name === name || object.name.startsWith(`${name}_`) || object.name.endsWith(name)) {
      found = object;
    }
  });
  return found;
}

/**
 * Wrap a mesh so rotation about the hinge origin animates it.
 * `axisInParent` becomes the hinge local +Z (the pull / kick axis).
 */
function hingeAround(
  object: THREE.Object3D,
  parent: THREE.Object3D,
  axisInParent?: THREE.Vector3,
): THREE.Group {
  parent.updateMatrixWorld(true);
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const hinge = new THREE.Group();
  hinge.name = `${object.name}_hinge`;
  parent.add(hinge);
  hinge.position.copy(parent.worldToLocal(center.clone()));
  if (axisInParent && axisInParent.lengthSq() > 1e-8) {
    const z = axisInParent.clone().normalize();
    const x = new THREE.Vector3(0, 1, 0).cross(z);
    if (x.lengthSq() < 1e-6) x.set(1, 0, 0).cross(z);
    x.normalize();
    const y = new THREE.Vector3().crossVectors(z, x).normalize();
    hinge.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  }
  hinge.updateMatrixWorld(true);
  // attach keeps the mesh world pose while parenting under the oriented hinge.
  hinge.attach(object);
  if (axisInParent) hinge.userData.pull = "z";
  return hinge;
}

function mountControls(root: THREE.Object3D, byId: Map<string, RigPart>) {
  const steer = new THREE.Group();
  steer.name = "steer";
  root.add(steer);

  // Pivot on the stem / bar mounts, not the midpoint of the handguards.
  const pivotParts = [
    ...(byId.get("bar_mounts")?.objects ?? []),
    ...(byId.get("triple_clamp")?.objects ?? []),
    ...(byId.get("handlebar")?.objects ?? []),
  ];
  const barObjects = STEER_PARTS.flatMap((id) => byId.get(id)?.objects ?? []);
  root.updateMatrixWorld(true);
  if (pivotParts.length || barObjects.length) {
    const box = new THREE.Box3();
    for (const object of pivotParts.length ? pivotParts : barObjects) box.expandByObject(object);
    const center = box.getCenter(new THREE.Vector3());
    // Keep the stem on the bike centerline so the bar does not orbit sideways.
    const local = root.worldToLocal(center);
    local.x = 0;
    steer.position.copy(local);
    steer.updateMatrixWorld(true);
    for (const object of barObjects) steer.attach(object);
  }

  // Square the bar to +Z at rest so a parked bike is not already steered.
  let restYaw = 0;
  const gripL = byId.get("grip_l")?.objects[0];
  const gripR = byId.get("grip_r")?.objects[0];
  steer.updateMatrixWorld(true);
  if (gripL && gripR) {
    const left = steer.worldToLocal(new THREE.Box3().setFromObject(gripL).getCenter(new THREE.Vector3()));
    const right = steer.worldToLocal(new THREE.Box3().setFromObject(gripR).getCenter(new THREE.Vector3()));
    // Bar axis left→right should lie on +X; cancel any yaw that twists it.
    restYaw = -Math.atan2(right.z - left.z, right.x - left.x);
  } else {
    const bar = byId.get("handlebar")?.objects[0];
    if (bar) {
      const box = new THREE.Box3().setFromObject(bar);
      const a = steer.worldToLocal(box.min.clone());
      const b = steer.worldToLocal(box.max.clone());
      restYaw = -Math.atan2(b.z - a.z, b.x - a.x);
    }
  }
  steer.rotation.y = restYaw;
  steer.updateMatrixWorld(true);

  const namedClutch = findNamedMesh(root, "clutch_lever");
  const namedBrake = findNamedMesh(root, "brake_lever");
  const namedShift = findNamedMesh(root, "shift_lever");
  const namedRear = findNamedMesh(root, "rear_brake_pedal");
  // After restYaw, the bar lies on +X in steer space — lever pull is about that axis.
  const barAxis = new THREE.Vector3(1, 0, 0);
  // Peg pedals kick about the bike lateral axis in root space.
  const pegAxis = new THREE.Vector3(1, 0, 0);

  let clutch: THREE.Group;
  let frontBrake: THREE.Group;
  if (namedClutch) {
    clutch = hingeAround(namedClutch, steer, barAxis);
  } else {
    clutch = hingeLever();
    if (gripL) {
      const c = new THREE.Box3().setFromObject(gripL).getCenter(new THREE.Vector3());
      const local = steer.worldToLocal(c);
      local.x *= 0.72;
      clutch.position.copy(local);
    } else clutch.position.set(-0.22, 0.15, 0.05);
    steer.add(clutch);
  }
  if (namedBrake) {
    frontBrake = hingeAround(namedBrake, steer, barAxis);
  } else {
    frontBrake = hingeLever();
    if (gripR) {
      const c = new THREE.Box3().setFromObject(gripR).getCenter(new THREE.Vector3());
      const local = steer.worldToLocal(c);
      local.x *= 0.72;
      frontBrake.position.copy(local);
    } else frontBrake.position.set(0.22, 0.15, 0.05);
    steer.add(frontBrake);
  }

  let rearBrake: THREE.Group;
  let shifter: THREE.Group;
  if (namedRear) {
    rearBrake = hingeAround(namedRear, root, pegAxis);
  } else {
    rearBrake = hingeLever();
    rearBrake.position.set(0.14, 0.18, 0);
    rearBrake.rotation.z = -0.4;
    root.add(rearBrake);
  }
  if (namedShift) {
    shifter = hingeAround(namedShift, root, pegAxis);
  } else {
    shifter = hingeLever();
    shifter.position.set(-0.14, 0.18, 0);
    shifter.rotation.z = 0.4;
    root.add(shifter);
  }

  return { steer, restYaw, clutch, frontBrake, rearBrake, shifter };
}

/** Hide any leftover Glass — the MX number board is a separate toggleable part. */
function hideGlass(root: THREE.Object3D) {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (mat && "name" in mat && mat.name === "Glass") mesh.visible = false;
  });
}

/**
 * Upright the Sketchfab lean, face +Z, and ground on the frame rails
 * so the bike bolts into the motion cradle (wheels are usually hidden).
 */
function prepareExcBike(source: THREE.Object3D): ExcRig {
  const root = source.clone(true);

  // Undo kickstand lean in the download (~6° toward -X when facing +Z).
  root.rotation.z = 0.11;

  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) meshes.push(o);
  });

  const nose = meshes.find((m) => materialName(m) === "Fuel_Tank");
  const seat = meshes.find((m) => materialName(m) === "Black_Seat");
  if (nose && seat) {
    root.updateMatrixWorld(true);
    const g = new THREE.Box3().setFromObject(nose).getCenter(new THREE.Vector3());
    const s = new THREE.Box3().setFromObject(seat).getCenter(new THREE.Vector3());
    // Tank sits ahead of the seat; face that direction (+Z).
    const dir = new THREE.Vector3(g.x - s.x, 0, g.z - s.z);
    if (dir.lengthSq() > 1e-6) {
      root.rotation.y = -Math.atan2(dir.x, dir.z);
    }
  }

  root.updateMatrixWorld(true);
  const frame = meshes.find((m) => materialName(m) === "Orange_Metal");
  const center = new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3());
  // Ground on real Orange_Metal verts — Box3 AABB corners sit below the mesh after yaw.
  let minY = Infinity;
  if (frame) {
    const pos = frame.geometry.getAttribute("position");
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(frame.matrixWorld);
      if (v.y < minY) minY = v.y;
    }
  } else {
    minY = new THREE.Box3().setFromObject(root).min.y;
  }
  // Sit on the lower frame rails, not the tires — this is a bolted sim mount.
  root.position.set(-center.x, -minY, -center.z);
  root.updateMatrixWorld(true);

  // Named Blender controls + the MX number board stay whole — do not shell-split them.
  const keepWhole = new Set<THREE.Mesh>();
  for (const mesh of meshes) {
    const n = mesh.name;
    if (n === "front_plate" || n.startsWith("front_plate")) {
      keepWhole.add(mesh);
      continue;
    }
    if (NAMED_CONTROLS.some((id) => n === id || n.startsWith(`${id}_`) || n.endsWith(id))) {
      keepWhole.add(mesh);
    }
  }
  const toSplit = meshes.filter((m) => !keepWhole.has(m));
  const pieces = splitMeshesByRegion(toSplit);
  for (const mesh of keepWhole) {
    const n = mesh.name;
    const id =
      n === "front_plate" || n.startsWith("front_plate")
        ? "front_plate"
        : (NAMED_CONTROLS.find(
            (name) => n === name || n.startsWith(`${name}_`) || n.endsWith(name),
          ) ?? slug(materialName(mesh)));
    if (id === "front_plate") {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        if (mat instanceof THREE.MeshStandardMaterial) mat.side = THREE.DoubleSide;
      }
    }
    pieces.push({ id, object: mesh });
  }
  debrandMaterials(root);

  const byId = new Map<string, RigPart>();
  for (const { id, object } of pieces) {
    const meta = partMeta(id);
    object.castShadow = true;
    object.receiveShadow = true;
    object.userData.part_id = id;
    object.userData.label = meta.label;
    object.userData.assembly = meta.assembly;
    const part = byId.get(id);
    if (part) part.objects.push(object);
    else byId.set(id, { id, label: meta.label, assembly: meta.assembly, objects: [object] });
  }

  const order = new Map(EXC_ASSEMBLIES.map((name, index) => [name, index]));
  const parts = [...byId.values()].sort((a, b) => {
    const ao = order.get(a.assembly as (typeof EXC_ASSEMBLIES)[number]) ?? 99;
    const bo = order.get(b.assembly as (typeof EXC_ASSEMBLIES)[number]) ?? 99;
    if (ao !== bo) return ao - bo;
    return a.label.localeCompare(b.label);
  });

  const controls = mountControls(root, byId);
  hideGlass(root);

  return { root, parts, ...controls };
}

function ExcMesh({
  telemetryRef,
  liveRef,
  hiddenIds,
  onParts,
}: {
  telemetryRef: MutableRefObject<Telemetry>;
  liveRef: MutableRefObject<boolean>;
  hiddenIds: string[];
  onParts: (parts: ExcPartInfo[]) => void;
}) {
  const gltf = useGLTF(MODEL_URL);
  const rig = useMemo(() => prepareExcBike(gltf.scene), [gltf.scene]);
  const chassis = useRef<THREE.Group>(null);
  const reported = useRef(false);
  const invalidate = useThree((state) => state.invalidate);
  const hidden = useMemo(() => new Set(hiddenIds), [hiddenIds]);

  useEffect(() => {
    if (reported.current) return;
    reported.current = true;
    onParts(rig.parts.map(({ id, label, assembly }) => ({ id, label, assembly })));
  }, [onParts, rig.parts]);

  useLayoutEffect(() => {
    for (const part of rig.parts) {
      const show = !hidden.has(part.id);
      for (const object of part.objects) object.visible = show;
    }
    invalidate();
  }, [hidden, invalidate, rig.parts]);

  const gear = useRef(0);
  const kick = useRef(0);

  useFrame((_, dt) => {
    const node = chassis.current;
    if (!node) return;
    const tel = telemetryRef.current;
    const { squat, pitch } = chassisSquat(tel.suspLength[0], tel.suspLength[1], liveRef.current);
    node.position.y = -squat;
    node.rotation.x = pitch;
    // Negative steer = right, matching the plugin. restYaw keeps 0 centered.
    rig.steer.rotation.y = rig.restYaw + (tel.steer * Math.PI) / 180;
    // Named levers pull about hinge local +Z (bar / peg axis); procedural sticks use z/x as built.
    rig.clutch.rotation.z = tel.clutch * 0.7;
    rig.frontBrake.rotation.z = -tel.frontBrake * 0.7;
    const rearPull = rig.rearBrake.userData.pull === "z" ? "z" : "x";
    const shiftPull = rig.shifter.userData.pull === "z" ? "z" : "x";
    rig.rearBrake.rotation[rearPull] = -tel.rearBrake * 0.55;
    if (tel.gear !== gear.current) {
      kick.current = Math.sign(tel.gear - gear.current) * 0.65;
      gear.current = tel.gear;
    }
    kick.current *= Math.exp(-Math.min(0.05, dt) * 8);
    rig.shifter.rotation[shiftPull] = kick.current;
  });

  return (
    <group ref={chassis}>
      <primitive object={rig.root} />
    </group>
  );
}

useGLTF.preload(MODEL_URL);

export const ExcBike = memo(function ExcBike({
  telemetryRef,
  liveRef,
  padActiveRef,
  poseRef,
  travelRef,
  hiddenIds,
  onParts,
  showRider = true,
  pov = false,
}: {
  telemetryRef: MutableRefObject<Telemetry>;
  liveRef: MutableRefObject<boolean>;
  padActiveRef: MutableRefObject<boolean>;
  poseRef: MutableRefObject<Pose6>;
  travelRef: MutableRefObject<FrameTravel>;
  hiddenIds: string[];
  onParts: (parts: ExcPartInfo[]) => void;
  showRider?: boolean;
  pov?: boolean;
}) {
  return (
    <group position={[0, FRAME_CENTER_Y, 0]}>
      <MotionDeck />
      <InnerStage poseRef={poseRef} travelRef={travelRef}>
        {/* Cradles + frame share this group so spars stay locked in the jaws. */}
        <group>
          <FrameCradles />
          <group position={[0, CRADLE_PAD_Y - RUBBER_CRUSH, 0]}>
            <Suspense fallback={null}>
              <ExcMesh
                telemetryRef={telemetryRef}
                liveRef={liveRef}
                hiddenIds={hiddenIds}
                onParts={onParts}
              />
            </Suspense>
            {showRider ? (
              <MxRider
                telemetryRef={telemetryRef}
                liveRef={liveRef}
                padActiveRef={padActiveRef}
                hideHelmet={pov}
              />
            ) : null}
          </group>
        </group>
      </InnerStage>
    </group>
  );
});
