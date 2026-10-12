"use client";

import { Suspense, memo, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { InnerStage } from "@/components/visualizer/inner-stage";
import { CRADLE_PAD_Y, FrameCradles, MotionDeck } from "@/components/visualizer/motion-deck";
import { MxRider } from "@/components/visualizer/mx-rider";
import { FRAME_CENTER_Y } from "@/components/visualizer/motocross-bike";
import { EXC_ASSEMBLIES, MODEL_URL, chassisSquat, partMeta, slug } from "@/lib/mxb/exc-parts";
import { isSplitMaterial, partBox, regionFor } from "@/lib/mxb/exc-split";
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
};

function materialName(mesh: THREE.Mesh): string {
  const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  return (mat && "name" in mat && mat.name) || mesh.name || "Part";
}

/** Strip baked logos / KTM marks from plastics and tank; keep a clean shell. */
function debrandMaterials(root: THREE.Object3D) {
  const scrub = new Set(["Orange_Plastics", "Dark_Plastics", "Fuel_Tank", "Orange_Metal"]);
  const done = new Set<THREE.Material>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of list) {
      if (!(mat instanceof THREE.MeshStandardMaterial)) continue;
      if (!scrub.has(mat.name) || done.has(mat)) continue;
      done.add(mat);
      if (mat.map) {
        mat.map.dispose();
        mat.map = null;
      }
      if (mat.emissiveMap) {
        mat.emissiveMap.dispose();
        mat.emissiveMap = null;
      }
      if (mat.name === "Orange_Plastics") {
        mat.color.set("#e4570e");
        mat.metalness = 0.05;
        mat.roughness = 0.55;
      } else if (mat.name === "Dark_Plastics") {
        mat.color.set("#1c1917");
        mat.metalness = 0.04;
        mat.roughness = 0.65;
      } else if (mat.name === "Fuel_Tank") {
        mat.color.set("#e4570e");
        mat.metalness = 0.06;
        mat.roughness = 0.5;
      } else if (mat.name === "Orange_Metal") {
        mat.color.set("#c2410c");
        mat.metalness = 0.35;
        mat.roughness = 0.42;
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

  const glass = meshes.find((m) => materialName(m) === "Glass");
  const seat = meshes.find((m) => materialName(m) === "Black_Seat");
  if (glass && seat) {
    root.updateMatrixWorld(true);
    const g = new THREE.Box3().setFromObject(glass).getCenter(new THREE.Vector3());
    const s = new THREE.Box3().setFromObject(seat).getCenter(new THREE.Vector3());
    const dir = new THREE.Vector3(g.x - s.x, 0, g.z - s.z);
    if (dir.lengthSq() > 1e-6) {
      root.rotation.y = -Math.atan2(dir.x, dir.z);
    }
  }

  root.updateMatrixWorld(true);
  const frame = meshes.find((m) => materialName(m) === "Orange_Metal");
  const groundBox = frame
    ? new THREE.Box3().setFromObject(frame)
    : new THREE.Box3().setFromObject(root);
  const center = new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3());
  // Sit on the lower frame rails, not the tires — this is a bolted sim mount.
  root.position.set(-center.x, -groundBox.min.y, -center.z);
  root.updateMatrixWorld(true);

  // Shell regions are classified in this grounded space, so split before debranding.
  const pieces = splitMeshesByRegion(meshes);
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

  return { root, parts };
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

  useFrame(() => {
    const node = chassis.current;
    if (!node) return;
    const tel = telemetryRef.current;
    const { squat, pitch } = chassisSquat(tel.suspLength[0], tel.suspLength[1], liveRef.current);
    node.position.y = -squat;
    node.rotation.x = pitch;
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
}: {
  telemetryRef: MutableRefObject<Telemetry>;
  liveRef: MutableRefObject<boolean>;
  padActiveRef: MutableRefObject<boolean>;
  poseRef: MutableRefObject<Pose6>;
  travelRef: MutableRefObject<FrameTravel>;
  hiddenIds: string[];
  onParts: (parts: ExcPartInfo[]) => void;
}) {
  return (
    <group position={[0, FRAME_CENTER_Y, 0]}>
      <MotionDeck />
      <InnerStage poseRef={poseRef} travelRef={travelRef}>
        {/* Cradles + frame share this group so spars stay locked in the jaws. */}
        <group>
          <FrameCradles />
          <group position={[0, CRADLE_PAD_Y, 0]}>
            <Suspense fallback={null}>
              <ExcMesh
                telemetryRef={telemetryRef}
                liveRef={liveRef}
                hiddenIds={hiddenIds}
                onParts={onParts}
              />
            </Suspense>
            <MxRider telemetryRef={telemetryRef} liveRef={liveRef} padActiveRef={padActiveRef} />
          </group>
        </group>
      </InnerStage>
    </group>
  );
});
