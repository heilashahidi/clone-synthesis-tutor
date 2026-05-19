import { useCallback, useState } from "react";
import type { TutorMessage } from "../engine/types";

// Each step waits for the student to perform a specific reducer action.
// When they do, the tutor chat advances to the next step.

export type TutorialStep =
  | "tap-color"
  | "split"
  | "drag"
  | "remove"
  | "add-bar";

export type TutorialAction =
  | "SHADE"
  | "SPLIT"
  | "MOVE_SEGMENT"
  | "REMOVE_SEGMENT"
  | "ADD_BAR";

// Ordered so the student first creates a bar to play with, then
// learns the per-piece gestures on it.
export const STEP_ORDER: TutorialStep[] = [
  "add-bar",
  "tap-color",
  "split",
  "drag",
  "remove",
];

export const STEP_INFO: Record<
  TutorialStep,
  { trigger: TutorialAction; text: string }
> = {
  "add-bar": {
    trigger: "ADD_BAR",
    text: "Hi! I'm Lila. Before we play with fractions, let's learn a few moves. First, tap any empty space twice and a new bar will pop up.",
  },
  "tap-color": {
    trigger: "SHADE",
    text: "Nice work! Now try tapping a piece to color it in.",
  },
  split: {
    trigger: "SPLIT",
    text: "Great. Now tap a piece two times quickly and watch it split in half.",
  },
  drag: {
    trigger: "MOVE_SEGMENT",
    text: "You can also move pieces around. Drag any piece across the screen.",
  },
  remove: {
    trigger: "REMOVE_SEGMENT",
    text: "Last one — hold a piece for a moment to take it away. After this we'll start exploring fractions!",
  },
};

/** Build a TutorMessage from a tutorial step so the chat can render it. */
export function tutorialMessage(step: TutorialStep): TutorMessage {
  return {
    id: `tutorial-${step}`,
    text: STEP_INFO[step].text,
    sender: "tutor",
    timestamp: Date.now(),
  };
}

const STORAGE_KEY = "fraction-tutor-tutorial-done";

function loadInitialStep(): TutorialStep | null {
  if (typeof window === "undefined") return "tap-color";
  try {
    return window.localStorage.getItem(STORAGE_KEY) ? null : "tap-color";
  } catch {
    return "tap-color";
  }
}

function markDone() {
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // localStorage may be unavailable; ignore.
  }
}

/**
 * Tracks which guided step the student is on and exposes an
 * `advance(action)` that the parent calls after dispatching a
 * reducer action.
 */
export function useTutorialProgress() {
  const [step, setStep] = useState<TutorialStep | null>(loadInitialStep);

  const advance = useCallback((action: TutorialAction) => {
    setStep((prev) => {
      if (prev === null) return prev;
      if (STEP_INFO[prev].trigger !== action) return prev;
      const idx = STEP_ORDER.indexOf(prev);
      const next = STEP_ORDER[idx + 1] ?? null;
      if (next === null) markDone();
      return next;
    });
  }, []);

  const skip = useCallback(() => {
    markDone();
    setStep(null);
  }, []);

  return { step, advance, skip };
}
