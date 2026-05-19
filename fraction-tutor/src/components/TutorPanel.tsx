import type { TutorMessage, LessonNode } from "../engine/types";
import styles from "../styles/TutorPanel.module.css";

type TutorPanelProps = {
  messages: TutorMessage[];
  currentNode: LessonNode | undefined;
  onOptionSelect: (index: number) => void;
  onAdvance: () => void;
};

export function TutorPanel({
  messages,
  currentNode,
  onOptionSelect,
  onAdvance,
}: TutorPanelProps) {
  const showOptions =
    currentNode &&
    (currentNode.type === "prompt" || currentNode.type === "check") &&
    currentNode.options &&
    currentNode.options.length > 0;

  const showContinue =
    currentNode &&
    currentNode.type === "message" &&
    currentNode.next;

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

        {showContinue && (
          <button className={styles.continueButton} onClick={onAdvance}>
            Continue →
          </button>
        )}
      </div>
    </div>
  );
}
