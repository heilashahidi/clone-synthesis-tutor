import { motion } from "framer-motion";
import type { BarColor } from "../engine/types";
import styles from "../styles/Segment.module.css";

const COLOR_MAP: Record<BarColor, { shaded: string; text: string }> = {
  teal: { shaded: "#5DCAA5", text: "#04342C" },
  blue: { shaded: "#85B7EB", text: "#042C53" },
  coral: { shaded: "#F0997B", text: "#4A1B0C" },
  purple: { shaded: "#AFA9EC", text: "#26215C" },
};

type SegmentProps = {
  id: string;
  shaded: boolean;
  color: BarColor;
  index: number;
  isSelected: boolean;
  onTap: () => void;
};

export function Segment({
  id,
  shaded,
  color,
  index,
  isSelected,
  onTap,
}: SegmentProps) {
  const colors = COLOR_MAP[color];

  return (
    <motion.div
      layoutId={id}
      className={`${styles.segment} ${isSelected ? styles.selected : ""}`}
      style={{
        flex: 1,
        backgroundColor: shaded ? colors.shaded : undefined,
        borderLeft: index > 0 ? "2px solid var(--border-color)" : "none",
      }}
      onClick={onTap}
      whileTap={{ scale: 0.96 }}
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
