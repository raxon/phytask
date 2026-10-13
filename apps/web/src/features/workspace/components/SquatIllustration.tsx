import { createSquatPose } from '../model/squat-pose';

const point = ({ x, y }: { x: number; y: number }) => `${x.toFixed(1)},${y.toFixed(1)}`;
const behind = (position: { x: number; y: number }) => point({ ...position, x: position.x - 6 });

export function SquatIllustration({ kneeAngle }: { kneeAngle: number | null }) {
  const pose = createSquatPose(kneeAngle);
  const foot = { x: pose.ankle.x + 18, y: pose.ankle.y };

  return (
    <div className="squat-illustration" aria-hidden="true">
      <svg
        viewBox="0 0 150 150"
        fill="none"
        data-testid="squat-illustration"
        data-knee-angle={pose.angle.toFixed(1)}
      >
        <circle cx="75" cy="75" r="64" fill="#e8f5ef" />
        <path
          d={`M${behind(pose.hip)}L${behind(pose.knee)}L${behind(pose.ankle)}L${behind(foot)}M${point({ x: pose.shoulder.x - 3, y: pose.shoulder.y + 4 })}L${point({ x: pose.hand.x - 4, y: pose.hand.y + 4 })}`}
          stroke="#6a9c8d"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={pose.head.x.toFixed(1)} cy={pose.head.y.toFixed(1)} r="9" fill="#6a9c8d" />
        <g stroke="#1f6d5a" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round">
          <path
            d={`M${point(pose.hip)}L${point(pose.knee)}L${point(pose.ankle)}L${point(foot)}`}
            data-testid="squat-front-leg"
          />
          <path d={`M${point(pose.hip)}L${point(pose.shoulder)}L${point(pose.hand)}`} />
          <path
            d={`M${point(pose.shoulder)}L${point({ x: (pose.shoulder.x + pose.head.x) / 2, y: (pose.shoulder.y + pose.head.y) / 2 })}`}
          />
        </g>
        <path d="M36 129h78" stroke="#b4d5c7" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  );
}
