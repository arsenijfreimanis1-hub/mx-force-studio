/** World-space marks ahead of the helmet (+Z) so POV motion is readable. */
export const POV_HELMET_Z = 0.14;
export const POV_LANE_HALF = 1.18;
export const POV_CONE_Z = 2.15;
export const POV_POST_Z = 2.55;

export function povMarksAreAhead() {
  return POV_CONE_Z > POV_HELMET_Z && POV_POST_Z > POV_HELMET_Z;
}
