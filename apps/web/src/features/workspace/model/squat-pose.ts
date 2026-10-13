export interface Point {
  x: number;
  y: number;
}

export interface SquatPose {
  angle: number;
  ankle: Point;
  knee: Point;
  hip: Point;
  shoulder: Point;
  head: Point;
  hand: Point;
}

const radians = (degrees: number) => (degrees * Math.PI) / 180;

export function createSquatPose(angle: number | null): SquatPose {
  const displayAngle =
    angle !== null && Number.isFinite(angle) ? Math.min(180, Math.max(0, angle)) : 180;
  const flex = 180 - displayAngle;
  const depth = Math.min(1, flex / 90);
  const shinLean = radians(depth * 22);
  const thighLean = radians(flex - depth * 22);
  const ankle = { x: 76, y: 124 };
  const knee = {
    x: ankle.x + 28 * Math.sin(shinLean),
    y: ankle.y - 28 * Math.cos(shinLean),
  };
  const hip = {
    x: knee.x - 28 * Math.sin(thighLean),
    y: knee.y - 28 * Math.cos(thighLean),
  };

  // A stylized forward torso lean balances the squat while the foot stays planted.
  const torsoLean = radians(depth * 28);
  const shoulder = {
    x: hip.x + 30 * Math.sin(torsoLean),
    y: hip.y - 30 * Math.cos(torsoLean),
  };
  const head = {
    x: shoulder.x + 14 * Math.sin(torsoLean),
    y: shoulder.y - 14 * Math.cos(torsoLean),
  };
  const hand = { x: shoulder.x + 35, y: shoulder.y + 2 };

  return { angle: displayAngle, ankle, knee, hip, shoulder, head, hand };
}
