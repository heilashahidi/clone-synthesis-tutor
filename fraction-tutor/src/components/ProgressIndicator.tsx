import styles from "../styles/ProgressIndicator.module.css";

type ProgressIndicatorProps = {
  step: number;
  totalSteps: number;
  isComplete: boolean;
};

export function ProgressIndicator({
  step,
  totalSteps,
  isComplete,
}: ProgressIndicatorProps) {
  return (
    <div className={styles.container}>
      <span className={styles.title}>Fraction explorer</span>
      <span className={styles.step}>
        {isComplete ? "Complete ✓" : `Step ${step} of ${totalSteps}`}
      </span>
    </div>
  );
}
