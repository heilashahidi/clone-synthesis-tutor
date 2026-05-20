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
  // 1 — opening hook + definition
  if (nodeId.startsWith("hook_") || nodeId.startsWith("define_")) return 1;
  // 2 — basic mechanics: color a whole, then watch a cut
  if (nodeId.startsWith("shade_") || nodeId.startsWith("cut_")) return 2;
  // 3 — first equivalence challenge (split + make 2/4)
  if (nodeId.startsWith("split_") || nodeId.startsWith("equiv_")) return 3;
  // 4 — second challenge (2/3 ≡ 4/6) and the pattern reveal
  if (nodeId.startsWith("challenge_2_") || nodeId.startsWith("pattern_"))
    return 4;
  // 5 — non-example (1/2 vs 1/3)
  if (nodeId.startsWith("non_example_")) return 5;
  // 6 — assessment quiz
  if (nodeId.startsWith("assessment_") || nodeId.startsWith("quiz_")) return 6;
  // 7 — done
  if (nodeId === "complete") return 7;
  return 1;
}
