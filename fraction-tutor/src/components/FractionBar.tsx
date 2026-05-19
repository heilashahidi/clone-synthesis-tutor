import { LayoutGroup } from "framer-motion";
import { Segment } from "./Segment";
import { barToFraction, fractionToString } from "../engine/conditions";
import type { FractionBar as FractionBarType } from "../engine/types";
import styles from "../styles/FractionBar.module.css";

type FractionBarProps = {
  bar: FractionBarType;
  selectedSegmentId: string | null;
  onSegmentTap: (barId: string, segmentId: string) => void;
  onSegmentSplit: (barId: string, segmentId: string) => void;
  onSegmentCombine: (barId: string, segmentId: string) => void;
};

export function FractionBar({
  bar,
  selectedSegmentId,
  onSegmentTap,
  onSegmentSplit,
  onSegmentCombine,
}: FractionBarProps) {
  const fraction = barToFraction(bar);
  const label = fractionToString(fraction);

  return (
    <div className={styles.row}>
      <span className={styles.fractionLabel}>{label}</span>
      <div className={styles.bar}>
        <LayoutGroup id={bar.id}>
          {bar.segments.map((seg, i) => {
            const leftNeighborId = i > 0 ? bar.segments[i - 1].id : null;
            const hasRightNeighbor = i < bar.segments.length - 1;
            return (
              <Segment
                key={seg.id}
                id={seg.id}
                shaded={seg.shaded}
                color={bar.color}
                index={i}
                isSelected={selectedSegmentId === seg.id}
                onTap={() => onSegmentTap(bar.id, seg.id)}
                onDragSplit={() => onSegmentSplit(bar.id, seg.id)}
                onDragCombineRight={
                  hasRightNeighbor
                    ? () => onSegmentCombine(bar.id, seg.id)
                    : null
                }
                onDragCombineLeft={
                  leftNeighborId
                    ? () => onSegmentCombine(bar.id, leftNeighborId)
                    : null
                }
              />
            );
          })}
        </LayoutGroup>
      </div>
    </div>
  );
}
