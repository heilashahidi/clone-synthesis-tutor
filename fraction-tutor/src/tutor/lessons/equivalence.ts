// The pure JSON is the script (content). This wrapper attaches the
// lesson-specific configuration the engine needs to drive it:
//   - totalSteps  : how many sections the progress indicator should show
//   - stepForNode : maps a node id to its step number (1..totalSteps)
//
// New lessons add their own wrapper module with the same shape; the
// engine itself stays generic.

import type { Lesson } from "../../engine/types";
import json from "./equivalence.json";

export const equivalenceLesson = json as Lesson;

export const equivalenceTotalSteps = 7;

export function equivalenceStep(nodeId: string): number {
  if (nodeId.startsWith("lesson_intro")) return 1;
  if (nodeId.startsWith("intro")) return 1;
  if (nodeId.startsWith("split")) return 2;
  if (
    nodeId.startsWith("equiv_challenge_1") ||
    nodeId.startsWith("equiv_wait_1") ||
    nodeId.startsWith("equiv_reveal_1") ||
    nodeId.startsWith("equiv_question_1") ||
    nodeId.startsWith("equiv_confirm_1") ||
    nodeId.startsWith("equiv_misconception") ||
    nodeId.startsWith("equiv_hint") ||
    nodeId.startsWith("build")
  )
    return 3;
  if (
    nodeId.startsWith("equiv_challenge_2") ||
    nodeId.startsWith("equiv_wait_2") ||
    nodeId.startsWith("equiv_reveal_2") ||
    nodeId.startsWith("equiv_question_2") ||
    nodeId.startsWith("pattern")
  )
    return 4;
  if (nodeId.startsWith("non_example")) return 5;
  if (nodeId.startsWith("assessment") || nodeId.startsWith("quiz")) return 6;
  if (nodeId === "complete") return 7;
  return 1;
}
