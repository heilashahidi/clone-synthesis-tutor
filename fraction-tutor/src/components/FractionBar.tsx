import { LayoutGroup } from "framer-motion";
import { Segment } from "./Segment";
import { barToFraction, fractionToString } from "../engine/conditions";
import type { FractionBar as FractionBarType } from "../engine/types";
import styles from "../styles/FractionBar.module.css";

type FractionBarProps = {
  bar: FractionBarType;
  selectedSegmentId: string | null;
  onSegmentTap: (barId: string, segmentId: string) => void;
  onSegmentSmash: (barId: string, segmentId: string) => void;
  onSegmentDragEnd: (
    barId: string,
    segmentId: string,
    x: number,
    y: number,
    dropTargetId: string | null
  ) => void;
};

export function FractionBar({
  bar,
  selectedSegmentId,
  onSegmentTap,
  onSegmentSmash,
  onSegmentDragEnd,
}: FractionBarProps) {
  const fraction = barToFraction(bar);
  const label = fractionToString(fraction);

  return (
    <div className={styles.row}>
      <span className={styles.fractionLabel}>{label}</span>
      <div className={styles.bar}>
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
              onTap={() => onSegmentTap(bar.id, seg.id)}
              onSmash={() => onSegmentSmash(bar.id, seg.id)}
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
