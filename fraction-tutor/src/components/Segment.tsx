import { motion, type PanInfo } from "framer-motion";
import type { BarColor } from "../engine/types";
import styles from "../styles/Segment.module.css";

const COLOR_MAP: Record<BarColor, { shaded: string; text: string }> = {
  teal: { shaded: "#5DCAA5", text: "#04342C" },
  blue: { shaded: "#85B7EB", text: "#042C53" },
  coral: { shaded: "#F0997B", text: "#4A1B0C" },
  purple: { shaded: "#AFA9EC", text: "#26215C" },
};

const DRAG_THRESHOLD = 60;

type SegmentProps = {
  id: string;
  shaded: boolean;
  color: BarColor;
  index: number;
  isSelected: boolean;
  onTap: () => void;
  onDragSplit: () => void;
  onDragCombineLeft: (() => void) | null;
  onDragCombineRight: (() => void) | null;
};

export function Segment({
  id,
  shaded,
  color,
  index,
  isSelected,
  onTap,
  onDragSplit,
  onDragCombineLeft,
  onDragCombineRight,
}: SegmentProps) {
  const colors = COLOR_MAP[color];

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const ax = Math.abs(info.offset.x);
    const ay = Math.abs(info.offset.y);
    if (Math.max(ax, ay) < DRAG_THRESHOLD) return;

    if (ay > ax) {
      onDragSplit();
    } else if (info.offset.x > 0) {
      onDragCombineRight?.();
    } else {
      onDragCombineLeft?.();
    }
  };

  return (
    <motion.div
      layoutId={id}
      drag
      dragSnapToOrigin
      dragElastic={0.4}
      onTap={onTap}
      onDragEnd={handleDragEnd}
      className={`${styles.segment} ${isSelected ? styles.selected : ""}`}
      style={{
        flex: 1,
        backgroundColor: shaded ? colors.shaded : undefined,
        borderLeft: index > 0 ? "2px solid var(--border-color)" : "none",
      }}
      whileTap={{ scale: 0.96 }}
      whileDrag={{
        scale: 1.08,
        zIndex: 10,
        boxShadow: "0 12px 28px rgba(0, 0, 0, 0.2)",
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
