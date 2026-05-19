// Lesson registry.
//
// To add a new lesson:
//   1. Author the script JSON (e.g., `multiplying-fractions.json`)
//      following the Lesson type in ../../engine/types.ts.
//   2. Author a small TS wrapper (e.g., `multiplying-fractions.ts`)
//      that exports the lesson + its step-counter config.
//   3. Import below and add a LessonManifest entry to LESSONS.
//
// The host of this app picks which lesson to render by id; the
// LessonShell component is the only thing that needs to be mounted.

import type { Lesson } from "../../engine/types";
import {
  equivalenceLesson,
  equivalenceStep,
  equivalenceTotalSteps,
} from "./equivalence";

export type LessonManifest = {
  /** Stable id used for routing / selection. */
  id: string;
  /** Shown on the start splash and any lesson picker. */
  title: string;
  /** One-line description shown on the splash. */
  description: string;
  /** The script that drives the chat + canvas. */
  lesson: Lesson;
  /** Total step count for the progress indicator. */
  totalSteps: number;
  /** Maps a node id to its step number (1..totalSteps). */
  getStepForNode: (nodeId: string) => number;
};

export const LESSONS: LessonManifest[] = [
  {
    id: "equivalence",
    title: "Fraction Explorer",
    description:
      "Discover how fractions that look different can mean the same thing.",
    lesson: equivalenceLesson,
    totalSteps: equivalenceTotalSteps,
    getStepForNode: equivalenceStep,
  },
];

export const DEFAULT_LESSON_ID = "equivalence";

export function getLesson(id: string): LessonManifest | undefined {
  return LESSONS.find((l) => l.id === id);
}

export function getDefaultLesson(): LessonManifest {
  return getLesson(DEFAULT_LESSON_ID) ?? LESSONS[0];
}
