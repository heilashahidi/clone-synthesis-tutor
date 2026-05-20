import { useRef } from "react";
import { FractionBar } from "./FractionBar";
import { FractionCircle } from "./FractionCircle";
import type {
  FractionBar as FractionBarType,
  FractionCircle as FractionCircleType,
} from "../engine/types";
import styles from "../styles/FractionWorkspace.module.css";

const DOUBLE_CLICK_MS = 320;

type FractionWorkspaceProps = {
  bars: FractionBarType[];
  circles: FractionCircleType[];
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
  ) => boolean;
  onEmptyDoubleTap: () => void;
};

export function FractionWorkspace({
  bars,
  circles,
  selectedSegmentId,
  onSegmentTap,
  onSegmentDoubleTap,
  onSegmentLongPress,
  onSegmentDragEnd,
  onEmptyDoubleTap,
}: FractionWorkspaceProps) {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const lastClickTime = useRef(0);

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
      {circles.length > 0 && (
        <div className={styles.circleRow}>
          {circles.map((c) => (
            <FractionCircle key={c.id} circle={c} />
          ))}
        </div>
      )}
      {bars.length === 0 && circles.length === 0 && (
        <div className={styles.empty}>
          Double-tap anywhere to add a bar
        </div>
      )}
    </div>
  );
}
