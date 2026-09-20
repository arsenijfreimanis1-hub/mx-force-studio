/**
 * PiBoSo / MaxTM chassis frame: X right, Y up, Z forward.
 * `m_aafRot` is a row-major 3×3 that already includes lean and wheelie.
 */

export type AttitudeDeg = {
  yaw: number;
  pitch: number;
  roll: number;
};

function col(rot: number[], column: number): [number, number, number] {
  return [rot[column], rot[3 + column], rot[6 + column]];
}

export function isRotMatrix(rot: number[] | undefined): rot is number[] {
  if (!rot || rot.length < 9) return false;
  for (let i = 0; i < 9; i++) {
    if (!Number.isFinite(rot[i])) return false;
  }
  const [ux, uy, uz] = col(rot, 1);
  const [fx, fy, fz] = col(rot, 2);
  const upN = Math.hypot(ux, uy, uz);
  const fwdN = Math.hypot(fx, fy, fz);
  return upN > 0.5 && upN < 1.5 && fwdN > 0.5 && fwdN < 1.5;
}

/** Degrees. PiBoSo Euler / lean: negative roll = left, +pitch = nose up. */
export function attitudeFromRot(rot: number[]): AttitudeDeg | null {
  if (!isRotMatrix(rot)) return null;
  const [upX, upY, upZ] = col(rot, 1);
  const [fwdX, , fwdZ] = col(rot, 2);
  const roll = (Math.atan2(-upX, upY) * 180) / Math.PI;
  const pitch = (Math.atan2(upZ, Math.hypot(upX, upY)) * 180) / Math.PI;
  const yaw = (Math.atan2(fwdX, fwdZ) * 180) / Math.PI;
  return { yaw, pitch, roll };
}

export function resolveAttitude(tel: {
  yaw: number;
  pitch: number;
  roll: number;
  rot?: number[];
}): AttitudeDeg {
  return attitudeFromRot(tel.rot ?? []) ?? { yaw: tel.yaw, pitch: tel.pitch, roll: tel.roll };
}

export function rzRoll(degAngle: number): number[] {
  const r = (degAngle * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}

export function rxPitch(degAngle: number): number[] {
  const r = (degAngle * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [1, 0, 0, 0, c, -s, 0, s, c];
}
