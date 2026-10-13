import * as THREE from "three";

/** Shared eye anchor so the POV camera can sit on the rider's goggles. */
export const riderEye = {
  matrix: new THREE.Matrix4(),
  ready: false,
};
