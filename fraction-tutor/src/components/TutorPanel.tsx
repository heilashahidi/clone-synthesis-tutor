import type { TutorMessage, LessonNode } from "../engine/types";
import styles from "../styles/TutorPanel.module.css";

type TutorPanelProps = {
  messages: TutorMessage[];
  currentNode: LessonNode | undefined;
  isSpeaking: boolean;
  onOptionSelect: (index: number) => void;
  onAdvance: () => void;
};

export function TutorPanel({
  messages,
  currentNode,
  isSpeaking,
  onOptionSelect,
  onAdvance,
}: TutorPanelProps) {
  const showOptions =
    currentNode &&
    (currentNode.type === "prompt" || currentNode.type === "check") &&
    currentNode.options &&
    currentNode.options.length > 0;

  // Reserve space for the Continue button as soon as we're on a
  // message node, even while Lila is still talking. The button stays
  // mounted but invisible and disabled until `isSpeaking` flips
  // false — this way there's no layout shift, just a smooth fade-in
  // when she's done. (Muted / autoplay-blocked / proxy-off all leave
  // `isSpeaking` false, so it never strands the UI.)
  const hasContinue =
    currentNode &&
    currentNode.type === "message" &&
    Boolean(currentNode.next);
  const continueReady = hasContinue && !isSpeaking;

  // Show only the latest tutor message — no chat history, no student
  // echoes. The student's "answer" is whichever option button they tap.
  const latest = [...messages]
    .reverse()
    .find((m) => m.sender === "tutor");

  return (
    <div className={styles.panel}>
      <div className={styles.messages}>
        {latest && (
          <div
            key={latest.id}
            className={`${styles.bubble} ${styles.tutorBubble}`}
          >
            <div className={styles.avatar}>
              <span>✦</span>
            </div>
            <p className={styles.text}>{latest.text}</p>
          </div>
        )}
      </div>

      <div className={styles.actions}>
        {showOptions &&
          currentNode.options!.map((opt, i) => (
            <button
              key={i}
              className={styles.optionButton}
              onClick={() => onOptionSelect(i)}
            >
              {opt.label}
            </button>
          ))}

        {hasContinue && (
          <button
            className={`${styles.continueButton} ${
              continueReady ? styles.continueButtonReady : ""
            }`}
            onClick={onAdvance}
            disabled={!continueReady}
            aria-hidden={!continueReady}
          >
            Continue →
          </button>
        )}
      </div>
    </div>
  );
}
