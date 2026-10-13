/**
 * Remeasure Orange_Metal outer-rail underside after prepareExcBike grounding.
 * Run: node scripts/measure-exc-rails.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const glbPath = join(root, "public", "models", "ktm-450-exc.glb");

function materialName(mesh) {
  const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  return (mat && mat.name) || mesh.name || "";
}

function prepare(source) {
  const bike = source.clone(true);
  bike.rotation.z = 0.11;
  const meshes = [];
  bike.traverse((o) => {
    if (o.isMesh) meshes.push(o);
  });
  const nose = meshes.find((m) => materialName(m) === "Fuel_Tank");
  const seat = meshes.find((m) => materialName(m) === "Black_Seat");
  if (nose && seat) {
    bike.updateMatrixWorld(true);
    const g = new THREE.Box3().setFromObject(nose).getCenter(new THREE.Vector3());
    const s = new THREE.Box3().setFromObject(seat).getCenter(new THREE.Vector3());
    const dir = new THREE.Vector3(g.x - s.x, 0, g.z - s.z);
    if (dir.lengthSq() > 1e-6) bike.rotation.y = -Math.atan2(dir.x, dir.z);
  }
  bike.updateMatrixWorld(true);
  const frame = meshes.find((m) => materialName(m) === "Orange_Metal");
  const groundBox = frame ? new THREE.Box3().setFromObject(frame) : new THREE.Box3().setFromObject(bike);
  const center = new THREE.Box3().setFromObject(bike).getCenter(new THREE.Vector3());
  bike.position.set(-center.x, -groundBox.min.y, -center.z);
  bike.updateMatrixWorld(true);
  return { bike, frame };
}

function railSlices(frame, zs) {
  const pos = frame.geometry.getAttribute("position");
  const out = [];
  for (const z of zs) {
    let minY = Infinity;
    let maxAbsX = 0;
    const half = 0.025;
    for (let i = 0; i < pos.count; i++) {
      const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(frame.matrixWorld);
      if (Math.abs(v.z - z) > half) continue;
      if (Math.abs(v.x) < 0.08) continue;
      if (v.y < minY) minY = v.y;
      if (Math.abs(v.x) > maxAbsX) maxAbsX = Math.abs(v.x);
    }
    if (Number.isFinite(minY)) out.push({ z, x: +maxAbsX.toFixed(3), y: +minY.toFixed(3) });
    else out.push({ z, x: null, y: null });
  }
  return out;
}

const buffer = readFileSync(glbPath);
const loader = new GLTFLoader();
loader.parse(
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  "",
  (gltf) => {
    const { bike, frame } = prepare(gltf.scene);
    if (!frame) {
      console.error("No Orange_Metal");
      process.exit(1);
    }
    const zs = [-0.2, -0.15, -0.1, 0.05, 0.08, 0.1];
    const slices = railSlices(frame, zs);
    console.log("FRAME_RAIL_PROFILE candidates:");
    for (const s of slices) console.log(JSON.stringify(s));
    const box = new THREE.Box3().setFromObject(frame);
    console.log("frame AABB", {
      min: box.min.toArray().map((n) => +n.toFixed(3)),
      max: box.max.toArray().map((n) => +n.toFixed(3)),
    });
    const named = [];
    bike.traverse((o) => {
      if (o.name && /front_plate|clutch|brake|shift|rear_brake|Glass/i.test(o.name)) named.push(o.name);
    });
    console.log("named", named);
  },
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
