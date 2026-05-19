import styles from "../styles/ActionBar.module.css";

type ActionBarProps = {
  hasSelection: boolean;
  onSplit: () => void;
  onCombine: () => void;
  onShade: () => void;
  onReset: () => void;
};

export function ActionBar({
  hasSelection,
  onSplit,
  onCombine,
  onShade,
  onReset,
}: ActionBarProps) {
  return (
    <div className={styles.actionBar}>
      <button
        className={styles.button}
        onClick={onShade}
        disabled={!hasSelection}
      >
        <span className={styles.icon}>◐</span> Color
      </button>
      <button
        className={styles.button}
        onClick={onSplit}
        disabled={!hasSelection}
      >
        <span className={styles.icon}>✂</span> Split
      </button>
      <button
        className={styles.button}
        onClick={onCombine}
        disabled={!hasSelection}
      >
        <span className={styles.icon}>⊕</span> Combine
      </button>
      <button className={`${styles.button} ${styles.resetButton}`} onClick={onReset}>
        <span className={styles.icon}>↺</span> Reset
      </button>
    </div>
  );
}
