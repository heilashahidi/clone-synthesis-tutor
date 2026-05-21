import styles from "../styles/ProgressIndicator.module.css";

type ProgressIndicatorProps = {
  step: number;
  totalSteps: number;
  isComplete: boolean;
  muted: boolean;
  onToggleMute: () => void;
};

export function ProgressIndicator({
  step,
  totalSteps,
  isComplete,
  muted,
  onToggleMute,
}: ProgressIndicatorProps) {
  const fillPct = isComplete
    ? 100
    : Math.max(0, Math.min(100, (step / totalSteps) * 100));

  return (
    <div className={styles.container}>
      <span className={styles.title}>Fraction explorer</span>
      <div className={styles.right}>
        <button
          type="button"
          className={styles.muteButton}
          onClick={onToggleMute}
          aria-label={muted ? "Turn voice on" : "Turn voice off"}
          aria-pressed={muted}
        >
          {muted ? <MutedIcon /> : <SpeakerIcon />}
        </button>
        <div className={styles.progressGroup}>
          <span className={styles.step}>
            {isComplete ? "Complete" : `Step ${step} of ${totalSteps}`}
          </span>
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-valuenow={isComplete ? totalSteps : step}
            aria-valuemin={0}
            aria-valuemax={totalSteps}
          >
            <div
              className={styles.progressFill}
              style={{ width: `${fillPct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SpeakerIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 5 6 9H2v6h4l5 4V5Z" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function MutedIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 5 6 9H2v6h4l5 4V5Z" />
      <line x1="22" y1="9" x2="16" y2="15" />
      <line x1="16" y1="9" x2="22" y2="15" />
    </svg>
  );
}
