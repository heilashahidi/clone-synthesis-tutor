import type { Lesson, LessonNode } from "../../engine/types";
import fragment from "./walkthrough.json";

/**
 * Shape of a shared script fragment that can be spliced into a lesson.
 *  - `startNode`    – the fragment's first node id
 *  - `exitNodeId`   – the node whose `onMet` the composer rewrites to
 *                     point at the lesson's body entry
 *  - `nodes`        – the fragment's nodes (keyed by id)
 */
type WalkthroughFragment = {
  startNode: string;
  exitNodeId: string;
  nodes: Record<string, LessonNode>;
};

const FRAGMENT = fragment as WalkthroughFragment;

/**
 * Splice the shared walkthrough into a lesson script.
 *
 * The lesson must have a `lesson_intro` node whose `next` field
 * points at its body entry node. The composer rewires:
 *
 *   lesson_intro.next   -> <walkthrough start>
 *   <walkthrough exit>  -> <whatever lesson_intro was pointing to>
 *
 * Lessons without a `lesson_intro` are returned unchanged.
 */
export function withWalkthrough(lesson: Lesson): Lesson {
  const intro = lesson.nodes["lesson_intro"];
  if (!intro || !intro.next) return lesson;

  const exitTarget = intro.next;
  const exitNode = FRAGMENT.nodes[FRAGMENT.exitNodeId];

  return {
    ...lesson,
    nodes: {
      ...lesson.nodes,
      ...FRAGMENT.nodes,
      lesson_intro: { ...intro, next: FRAGMENT.startNode },
      [FRAGMENT.exitNodeId]: { ...exitNode, onMet: exitTarget },
    },
  };
}
