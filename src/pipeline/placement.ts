/**
 * Pure placement maths for text stamped onto existing PDF pages (watermarks
 * and page numbers). No pdf-lib here, so every rule is unit-testable in Node.
 *
 * Two things make "put this text at the bottom centre" harder than it looks:
 *
 *  1. pdf-lib rotates drawn text around its start point (the left end of the
 *     baseline), not around its centre. Centring rotated text therefore means
 *     backing the start point off along the ROTATED axes, not the page axes.
 *  2. A page can carry a /Rotate entry that turns it clockwise when displayed.
 *     "Bottom" is then a different edge of the page's own coordinate space,
 *     and the text has to turn with the page to read upright.
 *
 * Positions are worked out in the page's VISUAL frame — what a viewer shows,
 * origin bottom-left — and mapped back into page space at the very end.
 */

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VisualFrame {
  /** Width and height of the page as it is displayed. */
  width: number;
  height: number;
  /** Degrees to add to text so it reads upright on the displayed page. */
  angle: number;
  /** Map a point in the displayed frame back into page space. */
  toPage: (vx: number, vy: number) => { x: number; y: number };
}

/** The displayed frame of a page whose visible box is `box`, turned by `rotation`. */
export function visualFrame(box: Box, rotation: number): VisualFrame {
  const turn = (((Math.round(rotation / 90) * 90) % 360) + 360) % 360;
  const { x: ox, y: oy, width: w, height: h } = box;
  switch (turn) {
    case 90:
      return { width: h, height: w, angle: 90, toPage: (vx, vy) => ({ x: ox + w - vy, y: oy + vx }) };
    case 180:
      return {
        width: w,
        height: h,
        angle: 180,
        toPage: (vx, vy) => ({ x: ox + w - vx, y: oy + h - vy }),
      };
    case 270:
      return { width: h, height: w, angle: 270, toPage: (vx, vy) => ({ x: ox + vy, y: oy + h - vx }) };
    default:
      return { width: w, height: h, angle: 0, toPage: (vx, vy) => ({ x: ox + vx, y: oy + vy }) };
  }
}

export interface RotatedTextInput {
  /** Where the centre of the text should land, in the visual frame. */
  cx: number;
  cy: number;
  /** Measured text width and the height to centre on (cap height). */
  width: number;
  height: number;
  /** Text angle in degrees, counter-clockwise. */
  angle: number;
  /** Frame size and the margin the rotated text must stay inside. */
  frameWidth: number;
  frameHeight: number;
  margin: number;
}

/**
 * Start point for rotated text so that its centre sits on (cx, cy), then
 * nudged so the whole rotated box stays inside the frame's margins. A box
 * larger than the frame is centred instead, so it overflows evenly.
 */
export function centredTextOrigin(input: RotatedTextInput): { x: number; y: number } {
  const theta = (input.angle * Math.PI) / 180;
  const ux = Math.cos(theta);
  const uy = Math.sin(theta);
  // Baseline direction u, "up" direction v = u turned 90 degrees.
  const vx = -uy;
  const vy = ux;

  const ox = input.cx - (input.width / 2) * ux - (input.height / 2) * vx;
  const oy = input.cy - (input.width / 2) * uy - (input.height / 2) * vy;

  const corners = [
    [0, 0],
    [input.width * ux, input.width * uy],
    [input.height * vx, input.height * vy],
    [input.width * ux + input.height * vx, input.width * uy + input.height * vy],
  ].map(([dx, dy]) => [ox + dx!, oy + dy!] as const);

  const xs = corners.map(([x]) => x);
  const ys = corners.map(([, y]) => y);
  const shiftX = clampShift(Math.min(...xs), Math.max(...xs), input.margin, input.frameWidth - input.margin);
  const shiftY = clampShift(Math.min(...ys), Math.max(...ys), input.margin, input.frameHeight - input.margin);
  return { x: ox + shiftX, y: oy + shiftY };
}

/** How far to move [min, max] so it fits inside [lo, hi]. */
function clampShift(min: number, max: number, lo: number, hi: number): number {
  if (max - min > hi - lo) return (lo + hi) / 2 - (min + max) / 2;
  if (min < lo) return lo - min;
  if (max > hi) return hi - max;
  return 0;
}
