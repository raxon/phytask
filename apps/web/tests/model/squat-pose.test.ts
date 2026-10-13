import { describe, expect, it } from 'vitest';
import { createSquatPose, type SquatPose } from '../../src/features/workspace/model/squat-pose';

function measuredKneeAngle({ hip, knee, ankle }: SquatPose): number {
  const upper = { x: hip.x - knee.x, y: hip.y - knee.y };
  const lower = { x: ankle.x - knee.x, y: ankle.y - knee.y };
  const dot = upper.x * lower.x + upper.y * lower.y;
  const cosine = dot / (Math.hypot(upper.x, upper.y) * Math.hypot(lower.x, lower.y));
  return (Math.acos(Math.min(1, Math.max(-1, cosine))) * 180) / Math.PI;
}

describe('squat avatar geometry', () => {
  it.each([0, 60, 90, 100, 160, 180])(
    'draws the requested internal knee angle of %s degrees',
    (angle) => {
      const pose = createSquatPose(angle);
      expect(measuredKneeAngle(pose)).toBeCloseTo(angle, 5);
      expect(Math.hypot(pose.knee.x - pose.ankle.x, pose.knee.y - pose.ankle.y)).toBeCloseTo(28);
      expect(Math.hypot(pose.hip.x - pose.knee.x, pose.hip.y - pose.knee.y)).toBeCloseTo(28);
    },
  );

  it('lowers the hips and moves them back during a deep squat', () => {
    const standing = createSquatPose(180);
    const squat = createSquatPose(90);
    expect(squat.hip.y).toBeGreaterThan(standing.hip.y);
    expect(squat.hip.x).toBeLessThan(standing.hip.x);
    expect(squat.knee.x).toBeGreaterThan(standing.knee.x);
    expect(squat.shoulder.y).toBeLessThan(squat.hip.y);
    expect(squat.head.y).toBeLessThan(squat.shoulder.y);
  });

  it('keeps the ankle planted through the full range of movement', () => {
    for (let angle = 0; angle <= 180; angle += 1) {
      expect(createSquatPose(angle).ankle).toEqual({ x: 76, y: 124 });
    }
  });

  it('keeps every joint finite and inside the avatar view box', () => {
    for (let angle = 0; angle <= 180; angle += 1) {
      const { ankle, knee, hip, shoulder, head, hand } = createSquatPose(angle);
      for (const point of [ankle, knee, hip, shoulder, head, hand]) {
        expect(Number.isFinite(point.x)).toBe(true);
        expect(Number.isFinite(point.y)).toBe(true);
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.x).toBeLessThanOrEqual(150);
        expect(point.y).toBeGreaterThanOrEqual(0);
        expect(point.y).toBeLessThanOrEqual(150);
      }
    }
  });

  it.each([null, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'falls back to standing for an unavailable or non-finite angle %s',
    (angle) => {
      expect(createSquatPose(angle)).toEqual(createSquatPose(180));
    },
  );

  it.each([181.6, 200, Number.MAX_VALUE])(
    'draws a straight knee for an angle above 180: %s',
    (angle) => {
      const pose = createSquatPose(angle);
      expect(pose.angle).toBe(180);
      expect(measuredKneeAngle(pose)).toBeCloseTo(180, 5);
      expect(pose).toEqual(createSquatPose(180));
    },
  );

  it.each([-0.1, -90, -Number.MAX_VALUE])(
    'clamps a negative visualization angle to zero: %s',
    (angle) => {
      const pose = createSquatPose(angle);
      expect(pose.angle).toBe(0);
      expect(measuredKneeAngle(pose)).toBeCloseTo(0, 5);
      expect(pose).toEqual(createSquatPose(0));
    },
  );
});
