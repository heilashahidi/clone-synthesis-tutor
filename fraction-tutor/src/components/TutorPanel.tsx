import { useEffect, useRef } from "react";
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
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const showOptions =
    currentNode &&
    (currentNode.type === "prompt" || currentNode.type === "check") &&
    currentNode.options &&
    currentNode.options.length > 0;

  const showContinue =
    currentNode &&
    currentNode.type === "message" &&
    currentNode.next;

  return (
    <div className={styles.panel}>
      <div className={styles.messages} ref={scrollRef}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`${styles.bubble} ${
              msg.sender === "student" ? styles.studentBubble : styles.tutorBubble
            }`}
          >
            {msg.sender === "tutor" && (
              <div className={styles.avatar}>
                <span>✦</span>
              </div>
            )}
            <p className={styles.text}>{msg.text}</p>
          </div>
        ))}
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
