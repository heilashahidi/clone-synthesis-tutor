import type { BarColor, FractionCircle as FractionCircleType } from "../engine/types";
import styles from "../styles/FractionCircle.module.css";

const COLOR_MAP: Record<BarColor, { shaded: string }> = {
  teal: { shaded: "#5DCAA5" },
  blue: { shaded: "#85B7EB" },
  coral: { shaded: "#F0997B" },
  purple: { shaded: "#AFA9EC" },
};

const SIZE = 220;
const RADIUS = 100;
const CENTER = SIZE / 2;

// Wedge `i` spans the angle from `i/slices` to `(i+1)/slices` of a full
// turn, measured clockwise from the top (12 o'clock). We rotate the
// shaded fill in from the top so it lines up with how kids read pie
// slices.
function wedgePath(index: number, slices: number): string {
  if (slices === 1) {
    // A full circle can't be drawn with a single arc command, so do
    // it as two half-arcs.
    return [
      `M ${CENTER} ${CENTER - RADIUS}`,
      `A ${RADIUS} ${RADIUS} 0 1 1 ${CENTER} ${CENTER + RADIUS}`,
      `A ${RADIUS} ${RADIUS} 0 1 1 ${CENTER} ${CENTER - RADIUS}`,
      "Z",
    ].join(" ");
  }
  const a1 = (2 * Math.PI * index) / slices - Math.PI / 2;
  const a2 = (2 * Math.PI * (index + 1)) / slices - Math.PI / 2;
  const x1 = CENTER + RADIUS * Math.cos(a1);
  const y1 = CENTER + RADIUS * Math.sin(a1);
  const x2 = CENTER + RADIUS * Math.cos(a2);
  const y2 = CENTER + RADIUS * Math.sin(a2);
  const largeArc = a2 - a1 > Math.PI ? 1 : 0;
  return [
    `M ${CENTER} ${CENTER}`,
    `L ${x1} ${y1}`,
    `A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${x2} ${y2}`,
    "Z",
  ].join(" ");
}

type FractionCircleProps = {
  circle: FractionCircleType;
};

export function FractionCircle({ circle }: FractionCircleProps) {
  const fill = COLOR_MAP[circle.color].shaded;
  const wedges = Array.from({ length: circle.slices }, (_, i) => i);

  return (
    <div className={styles.row}>
      <span className={styles.fractionLabel}>
        {circle.shaded}/{circle.slices}
      </span>
      <svg
        className={styles.circle}
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        aria-label={`Circle showing ${circle.shaded} of ${circle.slices} slices colored`}
      >
        {wedges.map((i) => (
          <path
            key={i}
            d={wedgePath(i, circle.slices)}
            fill={i < circle.shaded ? fill : "rgba(255, 255, 255, 0.02)"}
            stroke="rgba(255, 255, 255, 0.18)"
            strokeWidth={2}
            strokeLinejoin="round"
          />
        ))}
      </svg>
    </div>
  );
}
