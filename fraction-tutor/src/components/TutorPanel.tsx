import { useEffect, useMemo, useState } from "react";
import type { TutorMessage, LessonNode } from "../engine/types";
import styles from "../styles/TutorPanel.module.css";

// Minimum time the Continue button stays hidden after a new message
// arrives, even if voice never starts (muted, autoplay blocked, proxy
// down). Gives kids time to read at least the opening of the line.
const MIN_HOLD_MS = 1500;

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

  // Shuffle the option order each time we land on a new prompt/check
  // node so the correct answer isn't always first. "Give up" options
  // (e.g. "I am not sure", "I cannot tell") stay pinned to the bottom
  // — they're the last-resort path, not a regular answer choice. We
  // shuffle indices into the original options array so onOptionSelect
  // still routes to the right `next`.
  const shuffledOptionIndices = useMemo(() => {
    if (!currentNode?.options) return [];
    const giveUp: number[] = [];
    const candidates: number[] = [];
    currentNode.options.forEach((opt, i) => {
      if (/i\s*(am\s+not|cannot|can'?t|'m\s+not)\s+(sure|tell)/i.test(opt.label)) {
        giveUp.push(i);
      } else {
        candidates.push(i);
      }
    });
    for (let j = candidates.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1));
      [candidates[j], candidates[k]] = [candidates[k], candidates[j]];
    }
    return [...candidates, ...giveUp];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNode?.id]);

  // Show only the latest tutor message — no chat history, no student
  // echoes. The student's "answer" is whichever option button they tap.
  const latest = [...messages]
    .reverse()
    .find((m) => m.sender === "tutor");

  // Reserve space for the Continue button as soon as we're on a
  // message node — but only once the message itself has arrived in
  // state. Gating on `latest` avoids the first-load flash where the
  // button would render visible for a frame before `isSpeaking`
  // could flip true (useLayoutEffect in useTutorVoice fires when the
  // new message lands, not on initial mount). The button then stays
  // mounted but invisible and disabled until `isSpeaking` flips
  // false — this way there's no layout shift, just a smooth fade-in
  // when she's done.
  const hasContinue =
    Boolean(latest) &&
    currentNode &&
    currentNode.type === "message" &&
    Boolean(currentNode.next);

  // Hold the button hidden for MIN_HOLD_MS after each new message even
  // if voice never starts (muted, autoplay blocked, proxy down). That
  // way kids never see Continue appear instantly on a fresh line.
  const [heldMessageId, setHeldMessageId] = useState<string | null>(
    latest?.id ?? null
  );
  useEffect(() => {
    if (!latest) return;
    setHeldMessageId(latest.id);
    const t = setTimeout(() => setHeldMessageId(null), MIN_HOLD_MS);
    return () => clearTimeout(t);
  }, [latest?.id]);

  const continueReady =
    hasContinue && !isSpeaking && heldMessageId !== latest?.id;

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
            <div className={styles.bubbleBody}>
              <div className={styles.tutorName}>Lila</div>
              <p className={styles.text}>{latest.text}</p>
            </div>
          </div>
        )}
      </div>

      <div className={styles.actions}>
        {showOptions &&
          shuffledOptionIndices.map((origIdx) => {
            const opt = currentNode.options![origIdx];
            return (
              <button
                key={origIdx}
                className={styles.optionButton}
                onClick={() => onOptionSelect(origIdx)}
              >
                {opt.label}
              </button>
            );
          })}

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
