import { describe, expect, it } from 'vitest';
import { centredTextOrigin, visualFrame } from './placement';

const A4 = { x: 0, y: 0, width: 595, height: 842 };

describe('visualFrame', () => {
  it('is the identity for an unrotated page', () => {
    const frame = visualFrame(A4, 0);
    expect([frame.width, frame.height, frame.angle]).toEqual([595, 842, 0]);
    expect(frame.toPage(10, 20)).toEqual({ x: 10, y: 20 });
  });

  it('maps the displayed bottom-left corner of a /Rotate 90 page', () => {
    // Turned 90° clockwise, the page's top-left corner is shown bottom-left
    // and the page shows landscape.
    const frame = visualFrame(A4, 90);
    expect([frame.width, frame.height, frame.angle]).toEqual([842, 595, 90]);
    expect(frame.toPage(0, 0)).toEqual({ x: 595, y: 0 });
    expect(frame.toPage(842, 595)).toEqual({ x: 0, y: 842 });
  });

  it('maps 180 and 270 the same way, and normalises odd angles', () => {
    expect(visualFrame(A4, 180).toPage(0, 0)).toEqual({ x: 595, y: 842 });
    expect(visualFrame(A4, 270).toPage(0, 0)).toEqual({ x: 0, y: 842 });
    expect(visualFrame(A4, -90).angle).toBe(270);
    expect(visualFrame(A4, 450).angle).toBe(90);
  });

  it('honours a box that does not start at the origin', () => {
    const frame = visualFrame({ x: 50, y: 100, width: 200, height: 300 }, 0);
    expect(frame.toPage(0, 0)).toEqual({ x: 50, y: 100 });
  });
});

/** Where the centre of the text ends up, given the start point drawText gets. */
function centreOf(origin: { x: number; y: number }, width: number, height: number, angle: number) {
  const t = (angle * Math.PI) / 180;
  return {
    x: origin.x + (width / 2) * Math.cos(t) - (height / 2) * Math.sin(t),
    y: origin.y + (width / 2) * Math.sin(t) + (height / 2) * Math.cos(t),
  };
}

const page = { frameWidth: 595, frameHeight: 842, margin: 36 };

describe('centredTextOrigin', () => {
  it('centres unrotated text on its anchor', () => {
    const origin = centredTextOrigin({ cx: 300, cy: 400, width: 200, height: 30, angle: 0, ...page });
    expect(origin.x).toBeCloseTo(200);
    expect(origin.y).toBeCloseTo(385);
  });

  it('keeps rotated text centred on the anchor (it used to drift ~100pt)', () => {
    for (const angle of [45, -30, 90]) {
      const origin = centredTextOrigin({ cx: 297.5, cy: 421, width: 300, height: 35, angle, ...page });
      const centre = centreOf(origin, 300, 35, angle);
      expect(centre.x).toBeCloseTo(297.5);
      expect(centre.y).toBeCloseTo(421);
    }
  });

  it('pulls corner-anchored text back inside the margins', () => {
    const width = 300;
    const height = 35;
    const origin = centredTextOrigin({ cx: 0, cy: 842, width, height, angle: 45, ...page });
    const t = Math.PI / 4;
    const corners = [
      [0, 0],
      [width * Math.cos(t), width * Math.sin(t)],
      [-height * Math.sin(t), height * Math.cos(t)],
      [width * Math.cos(t) - height * Math.sin(t), width * Math.sin(t) + height * Math.cos(t)],
    ].map(([dx, dy]) => [origin.x + dx!, origin.y + dy!]);
    for (const [x, y] of corners) {
      expect(x).toBeGreaterThanOrEqual(36 - 1e-9);
      expect(x).toBeLessThanOrEqual(595 - 36 + 1e-9);
      expect(y).toBeGreaterThanOrEqual(36 - 1e-9);
      expect(y).toBeLessThanOrEqual(842 - 36 + 1e-9);
    }
  });
});
