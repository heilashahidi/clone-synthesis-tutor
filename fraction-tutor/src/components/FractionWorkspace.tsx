import { useRef } from "react";
import { FractionBar } from "./FractionBar";
import { FractionCircle } from "./FractionCircle";
import type {
  FractionBar as FractionBarType,
  FractionCircle as FractionCircleType,
} from "../engine/types";
import styles from "../styles/FractionWorkspace.module.css";

// Matches the OS-default mouse double-click delay (≈500ms on macOS
// and Windows). Earlier it was 320ms, which silently dropped any
// mouse double-click slower than that.
const DOUBLE_CLICK_MS = 500;
// After we fire onEmptyDoubleTap, suppress duplicate fires for a
// brief window — both onClick-timestamp logic and the native
// onDoubleClick handler can race for the same gesture on mouse.
const DEDUPE_MS = 250;

type FractionWorkspaceProps = {
  bars: FractionBarType[];
  circles: FractionCircleType[];
  selectedSegmentId: string | null;
  showBarLabels?: boolean;
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
  onCircleTap?: (circleId: string) => void;
  onCircleDoubleTap?: (circleId: string) => void;
  onCircleLongPress?: (circleId: string) => void;
};

export function FractionWorkspace({
  bars,
  circles,
  selectedSegmentId,
  showBarLabels = true,
  onSegmentTap,
  onSegmentDoubleTap,
  onSegmentLongPress,
  onSegmentDragEnd,
  onEmptyDoubleTap,
  onCircleTap,
  onCircleDoubleTap,
  onCircleLongPress,
}: FractionWorkspaceProps) {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const lastClickTime = useRef(0);
  const lastFiredAt = useRef(0);

  const isOnSegmentOrCircle = (target: EventTarget) => {
    const el = target as HTMLElement;
    return Boolean(
      el.closest("[data-segment-id]") || el.closest("svg")
    );
  };

  const fireEmptyTap = () => {
    const now = Date.now();
    if (now - lastFiredAt.current < DEDUPE_MS) return;
    lastFiredAt.current = now;
    onEmptyDoubleTap();
  };

  // Two paths feed into fireEmptyTap so we catch both mouse and touch:
  //   - onDoubleClick: browser-native, fires on real mouse double-clicks
  //     regardless of timing.
  //   - onClick timestamp: needed for touch, where dblclick is typically
  //     not synthesized.
  // The DEDUPE_MS guard above stops a single mouse double-click from
  // firing twice when both paths see it.
  const handleWorkspaceClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isOnSegmentOrCircle(e.target)) {
      lastClickTime.current = 0;
      return;
    }
    const now = Date.now();
    if (now - lastClickTime.current < DOUBLE_CLICK_MS) {
      lastClickTime.current = 0;
      fireEmptyTap();
    } else {
      lastClickTime.current = now;
    }
  };

  const handleWorkspaceDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isOnSegmentOrCircle(e.target)) return;
    fireEmptyTap();
  };

  return (
    <div
      ref={workspaceRef}
      className={styles.workspace}
      onClick={handleWorkspaceClick}
      onDoubleClick={handleWorkspaceDoubleClick}
    >
      {bars.map((bar) => (
        <FractionBar
          key={bar.id}
          bar={bar}
          selectedSegmentId={selectedSegmentId}
          dragBoundsRef={workspaceRef}
          showLabel={showBarLabels}
          onSegmentTap={onSegmentTap}
          onSegmentDoubleTap={onSegmentDoubleTap}
          onSegmentLongPress={onSegmentLongPress}
          onSegmentDragEnd={onSegmentDragEnd}
        />
      ))}
      {circles.length > 0 && (
        <div className={styles.circleRow}>
          {circles.map((c) => (
            <FractionCircle
              key={c.id}
              circle={c}
              onTap={onCircleTap}
              onDoubleTap={onCircleDoubleTap}
              onLongPress={onCircleLongPress}
            />
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
