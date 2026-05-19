import { FractionBar } from "./FractionBar";
import { fractionsEqual, barToFraction } from "../engine/conditions";
import type { FractionBar as FractionBarType } from "../engine/types";
import styles from "../styles/FractionWorkspace.module.css";

type FractionWorkspaceProps = {
  bars: FractionBarType[];
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

export function FractionWorkspace({
  bars,
  selectedSegmentId,
  onSegmentTap,
  onSegmentSmash,
  onSegmentDragEnd,
}: FractionWorkspaceProps) {
  const areEquivalent =
    bars.length >= 2 &&
    barToFraction(bars[0]).numerator > 0 &&
    barToFraction(bars[1]).numerator > 0 &&
    fractionsEqual(barToFraction(bars[0]), barToFraction(bars[1]));

  return (
    <div className={styles.workspace}>
      {bars.map((bar) => (
        <FractionBar
          key={bar.id}
          bar={bar}
          selectedSegmentId={selectedSegmentId}
          onSegmentTap={onSegmentTap}
          onSegmentSmash={onSegmentSmash}
          onSegmentDragEnd={onSegmentDragEnd}
        />
      ))}
      {areEquivalent && (
        <div className={styles.equivalenceIndicator}>
          <span className={styles.equalsSign}>=</span>
          <span className={styles.equalsText}>Same amount!</span>
        </div>
      )}
      {bars.length === 0 && (
        <div className={styles.empty}>
          Waiting for the tutor to set up the bars...
        </div>
      )}
    </div>
  );
}
