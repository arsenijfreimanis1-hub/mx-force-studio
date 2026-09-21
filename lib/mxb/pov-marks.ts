/** World-space marks ahead of the helmet (+Z) so POV motion is readable. */
export const POV_HELMET_Z = 0.14;
export const POV_GATE_Z = 2.05;
export const POV_LANE_HALF = 1.18;
export const POV_CENTERLINE_ZS = [1.6, 2.6, 3.7, 4.9, 6.2, 7.6, 9.2, 11, 13, 15.2, 17.6, 20.2];
export const POV_POST_ZS = [2.2, 4.0, 6.0, 8.2, 10.6, 13.2, 16, 19];
export const POV_BANNER_Z = 12.4;

export function povMarksAreAhead() {
  return (
    POV_GATE_Z > POV_HELMET_Z &&
    POV_CENTERLINE_ZS.every((z) => z > POV_HELMET_Z) &&
    POV_POST_ZS.every((z) => z > POV_HELMET_Z) &&
    POV_BANNER_Z > POV_GATE_Z
  );
}
