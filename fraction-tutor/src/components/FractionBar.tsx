import { useEffect, useRef, useState, type RefObject } from "react";
import { LayoutGroup } from "framer-motion";
import { Segment } from "./Segment";
import { barToFraction, fractionToString } from "../engine/conditions";
import type { BarColor, FractionBar as FractionBarType } from "../engine/types";
import styles from "../styles/FractionBar.module.css";

// Tints used on an unshaded bar's outline so kids can recognize
// e.g. "the blue bar" before any pieces are colored. Kept low-alpha
// so they don't compete visually with a fully shaded segment.
const BORDER_TINT: Record<BarColor, string> = {
  teal: "rgba(93, 202, 165, 0.55)",
  blue: "rgba(133, 183, 235, 0.55)",
  coral: "rgba(240, 153, 123, 0.55)",
  purple: "rgba(175, 169, 236, 0.55)",
};

const BG_TINT: Record<BarColor, string> = {
  teal: "rgba(93, 202, 165, 0.08)",
  blue: "rgba(133, 183, 235, 0.08)",
  coral: "rgba(240, 153, 123, 0.08)",
  purple: "rgba(175, 169, 236, 0.08)",
};

type FractionBarProps = {
  bar: FractionBarType;
  selectedSegmentId: string | null;
  dragBoundsRef: RefObject<HTMLDivElement | null>;
  showLabel?: boolean;
  onSegmentTap: (barId: string, segmentId: string) => void;
  onSegmentDoubleTap: (barId: string, segmentId: string) => void;
  onSegmentLongPress: (barId: string, segmentId: string) => void;
  onSegmentDragEnd: (
    barId: string,
    segmentId: string,
    x: number,
    y: number,
    dropTargetId: string | null
  ) => boolean;
};

export function FractionBar({
  bar,
  selectedSegmentId,
  dragBoundsRef,
  showLabel = true,
  onSegmentTap,
  onSegmentDoubleTap,
  onSegmentLongPress,
  onSegmentDragEnd,
}: FractionBarProps) {
  const fraction = barToFraction(bar);
  const label = fractionToString(fraction);

  // Pulse the bar briefly whenever a new segment is added (e.g., a
  // SPLIT). Compares against the previous render's count and arms a
  // CSS animation class for 500ms when it grows.
  const prevCount = useRef(bar.segments.length);
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (bar.segments.length > prevCount.current) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 500);
      prevCount.current = bar.segments.length;
      return () => clearTimeout(t);
    }
    prevCount.current = bar.segments.length;
  }, [bar.segments.length]);

  return (
    <div className={styles.row}>
      <span
        className={styles.fractionLabel}
        style={showLabel ? undefined : { visibility: "hidden" }}
      >
        {label}
      </span>
      <div
        className={`${styles.bar} ${pulse ? styles.barPulse : ""}`}
        style={{
          borderColor: BORDER_TINT[bar.color],
          background: BG_TINT[bar.color],
        }}
      >
        <LayoutGroup id={bar.id}>
          {bar.segments.map((seg, i) => (
            <Segment
              key={seg.id}
              id={seg.id}
              shaded={seg.shaded}
              color={bar.color}
              index={i}
              isSelected={selectedSegmentId === seg.id}
              x={seg.x ?? 0}
              y={seg.y ?? 0}
              dragBoundsRef={dragBoundsRef}
              onTap={() => onSegmentTap(bar.id, seg.id)}
              onDoubleTap={() => onSegmentDoubleTap(bar.id, seg.id)}
              onLongPress={() => onSegmentLongPress(bar.id, seg.id)}
              onDragEnd={(x, y, dropTargetId) =>
                onSegmentDragEnd(bar.id, seg.id, x, y, dropTargetId)
              }
            />
          ))}
        </LayoutGroup>
      </div>
    </div>
  );
}
