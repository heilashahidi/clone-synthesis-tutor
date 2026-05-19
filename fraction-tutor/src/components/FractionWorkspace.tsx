import { useRef } from "react";
import { FractionBar } from "./FractionBar";
import { fractionsEqual, barToFraction } from "../engine/conditions";
import type { FractionBar as FractionBarType } from "../engine/types";
import styles from "../styles/FractionWorkspace.module.css";

const DOUBLE_CLICK_MS = 320;

type FractionWorkspaceProps = {
  bars: FractionBarType[];
  selectedSegmentId: string | null;
  onSegmentTap: (barId: string, segmentId: string) => void;
  onSegmentDoubleTap: (barId: string, segmentId: string) => void;
  onSegmentLongPress: (barId: string, segmentId: string) => void;
  onSegmentDragEnd: (
    barId: string,
    segmentId: string,
    x: number,
    y: number,
    dropTargetId: string | null
  ) => void;
  onEmptyDoubleTap: () => void;
};

export function FractionWorkspace({
  bars,
  selectedSegmentId,
  onSegmentTap,
  onSegmentDoubleTap,
  onSegmentLongPress,
  onSegmentDragEnd,
  onEmptyDoubleTap,
}: FractionWorkspaceProps) {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const lastClickTime = useRef(0);

  const areEquivalent =
    bars.length >= 2 &&
    barToFraction(bars[0]).numerator > 0 &&
    barToFraction(bars[1]).numerator > 0 &&
    fractionsEqual(barToFraction(bars[0]), barToFraction(bars[1]));

  // Detect a double-click on empty workspace area (not on any segment).
  // Tracks two quick taps via timestamps so it works for both mouse
  // and touch.
  const handleWorkspaceClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-segment-id]")) {
      lastClickTime.current = 0;
      return;
    }
    const now = Date.now();
    if (now - lastClickTime.current < DOUBLE_CLICK_MS) {
      lastClickTime.current = 0;
      onEmptyDoubleTap();
    } else {
      lastClickTime.current = now;
    }
  };

  return (
    <div
      ref={workspaceRef}
      className={styles.workspace}
      onClick={handleWorkspaceClick}
    >
      {bars.map((bar) => (
        <FractionBar
          key={bar.id}
          bar={bar}
          selectedSegmentId={selectedSegmentId}
          dragBoundsRef={workspaceRef}
          onSegmentTap={onSegmentTap}
          onSegmentDoubleTap={onSegmentDoubleTap}
          onSegmentLongPress={onSegmentLongPress}
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
          Double-tap anywhere to add a bar
        </div>
      )}
    </div>
  );
}
