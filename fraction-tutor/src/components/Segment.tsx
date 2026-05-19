import { useEffect, useRef, useState } from "react";
import {
  animate,
  motion,
  type PanInfo,
  useMotionValue,
} from "framer-motion";
import type { BarColor } from "../engine/types";
import styles from "../styles/Segment.module.css";

const COLOR_MAP: Record<BarColor, { shaded: string; text: string }> = {
  teal: { shaded: "#5DCAA5", text: "#04342C" },
  blue: { shaded: "#85B7EB", text: "#042C53" },
  coral: { shaded: "#F0997B", text: "#4A1B0C" },
  purple: { shaded: "#AFA9EC", text: "#26215C" },
};

const LONG_PRESS_MS = 500;

type SegmentProps = {
  id: string;
  shaded: boolean;
  color: BarColor;
  index: number;
  isSelected: boolean;
  x: number;
  y: number;
  onTap: () => void;
  onSmash: () => void;
  onDragEnd: (x: number, y: number, dropTargetId: string | null) => void;
};

export function Segment({
  id,
  shaded,
  color,
  index,
  isSelected,
  x,
  y,
  onTap,
  onSmash,
  onDragEnd: onDragEndProp,
}: SegmentProps) {
  const colors = COLOR_MAP[color];
  const xMotion = useMotionValue(x);
  const yMotion = useMotionValue(y);

  // Spring the segment back to its home slot when the model resets x/y
  // (e.g. after COMBINE or SHATTER). On a normal MOVE_SEGMENT the
  // motion value already matches (x, y), so animate is a no-op.
  useEffect(() => {
    const controls = animate(xMotion, x, {
      type: "spring",
      stiffness: 350,
      damping: 30,
    });
    return () => controls.stop();
  }, [x, xMotion]);
  useEffect(() => {
    const controls = animate(yMotion, y, {
      type: "spring",
      stiffness: 350,
      damping: 30,
    });
    return () => controls.stop();
  }, [y, yMotion]);

  const [isHolding, setIsHolding] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasLongPress = useRef(false);

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setIsHolding(false);
  };

  const handleTapStart = () => {
    wasLongPress.current = false;
    setIsHolding(true);
    longPressTimer.current = setTimeout(() => {
      wasLongPress.current = true;
      longPressTimer.current = null;
      setIsHolding(false);
      onSmash();
    }, LONG_PRESS_MS);
  };

  const handleTap = () => {
    clearLongPress();
    if (!wasLongPress.current) onTap();
  };

  const handleTapCancel = () => {
    clearLongPress();
  };

  const handleDragStart = () => {
    clearLongPress();
  };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (wasLongPress.current) {
      wasLongPress.current = false;
      return;
    }
    const newX = xMotion.get();
    const newY = yMotion.get();

    // Find any segment under the drop point (excluding self).
    // elementsFromPoint returns deep matches so we see through
    // the dragged element itself.
    const els = document.elementsFromPoint(info.point.x, info.point.y);
    let dropTargetId: string | null = null;
    for (const el of els) {
      const segId = (el as HTMLElement).dataset?.segmentId;
      if (segId && segId !== id) {
        dropTargetId = segId;
        break;
      }
    }

    onDragEndProp(newX, newY, dropTargetId);
  };

  const isElevated = x !== 0 || y !== 0;

  return (
    <motion.div
      layoutId={id}
      data-segment-id={id}
      drag
      dragMomentum={false}
      style={{
        x: xMotion,
        y: yMotion,
        flex: 1,
        zIndex: isElevated ? 5 : 1,
        backgroundColor: shaded ? colors.shaded : undefined,
        borderLeft: index > 0 ? "2px solid var(--border-color)" : "none",
      }}
      onTapStart={handleTapStart}
      onTap={handleTap}
      onTapCancel={handleTapCancel}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`${styles.segment} ${isSelected ? styles.selected : ""} ${
        isHolding ? styles.holding : ""
      }`}
      whileTap={{ scale: 0.96 }}
      whileDrag={{
        scale: 1.08,
        zIndex: 10,
        boxShadow:
          "0 0 24px rgba(96, 165, 250, 0.25), 0 16px 40px rgba(0, 0, 0, 0.8)",
      }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
    >
      <span
        className={styles.label}
        style={{
          color: shaded ? colors.text : undefined,
        }}
      >
        {index + 1}
      </span>
    </motion.div>
  );
}
