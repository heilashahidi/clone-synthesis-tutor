import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Lesson,
  LessonNode,
  LessonRunnerState,
  TutorMessage,
  FractionBar,
  ManipulativeAction,
} from "../engine/types";
import { checkCondition } from "../engine/conditions";
import { createBar, resetCounters } from "../engine/fractionReducer";

let messageCounter = 0;

function makeTutorMessage(text: string, sender: "tutor" | "student" = "tutor"): TutorMessage {
  return {
    id: `msg-${++messageCounter}`,
    text,
    sender,
    timestamp: Date.now(),
  };
}

function getCurrentStep(nodeId: string): number {
  if (nodeId.startsWith("intro")) return 1;
  if (nodeId.startsWith("split")) return 2;
  if (nodeId.startsWith("equiv_challenge_1") || nodeId.startsWith("equiv_wait_1") || nodeId.startsWith("equiv_reveal_1") || nodeId.startsWith("equiv_question_1") || nodeId.startsWith("equiv_confirm_1") || nodeId.startsWith("equiv_misconception") || nodeId.startsWith("equiv_hint") || nodeId.startsWith("build")) return 3;
  if (nodeId.startsWith("equiv_challenge_2") || nodeId.startsWith("equiv_wait_2") || nodeId.startsWith("equiv_reveal_2") || nodeId.startsWith("equiv_question_2") || nodeId.startsWith("pattern")) return 4;
  if (nodeId.startsWith("non_example")) return 5;
  if (nodeId.startsWith("assessment") || nodeId.startsWith("quiz")) return 6;
  if (nodeId === "complete") return 7;
  return 1;
}

type UseLessonRunnerOptions = {
  lesson: Lesson;
  bars: FractionBar[];
  dispatch: React.Dispatch<ManipulativeAction>;
};

export function useLessonRunner({ lesson, bars, dispatch }: UseLessonRunnerOptions) {
  const [state, setState] = useState<LessonRunnerState>(() => ({
    currentNodeId: lesson.startNode,
    messages: [],
    isComplete: false,
    showHint: false,
    step: 1,
    totalSteps: 7,
  }));

  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasProcessedNode = useRef<string | null>(null);

  const currentNode: LessonNode | undefined = lesson.nodes[state.currentNodeId];

  // Process a node when we arrive at it
  const processNode = useCallback(
    (node: LessonNode) => {
      // Prevent double-processing
      if (hasProcessedNode.current === node.id) return;
      hasProcessedNode.current = node.id;

      // Run setup if present
      if (node.setup) {
        resetCounters();
        const newBars = node.setup.bars.map((b) =>
          createBar(b.segments, b.shaded, b.color)
        );
        dispatch({ type: "SET_STATE", bars: newBars });
      }

      // Add tutor message
      setState((prev) => ({
        ...prev,
        currentNodeId: node.id,
        step: getCurrentStep(node.id),
        showHint: false,
        isComplete: node.id === "complete",
        messages: [...prev.messages, makeTutorMessage(node.message)],
      }));

      // Clear any existing hint timer
      if (hintTimerRef.current) {
        clearTimeout(hintTimerRef.current);
        hintTimerRef.current = null;
      }

      // For wait_for_action nodes, set up hint timer
      if (node.type === "wait_for_action" && node.hint) {
        const delay = (node.hintDelay ?? 15) * 1000;
        hintTimerRef.current = setTimeout(() => {
          setState((prev) => {
            // Only show hint if we're still on this node
            if (prev.currentNodeId !== node.id) return prev;
            return {
              ...prev,
              showHint: true,
              messages: [...prev.messages, makeTutorMessage(node.hint!)],
            };
          });
        }, delay);
      }

      // For message nodes with auto-advance, don't auto-advance —
      // we'll use a "continue" button or delay
    },
    [dispatch]
  );

  // Process the initial node on mount
  useEffect(() => {
    const startNode = lesson.nodes[lesson.startNode];
    if (startNode) {
      processNode(startNode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check conditions when bars change (for wait_for_action nodes)
  useEffect(() => {
    if (!currentNode || currentNode.type !== "wait_for_action") return;
    if (!currentNode.condition || !currentNode.onMet) return;

    const met = checkCondition(currentNode.condition, bars);
    if (met) {
      const nextNode = lesson.nodes[currentNode.onMet];
      if (nextNode) {
        // Small delay so the student sees their action land first
        setTimeout(() => processNode(nextNode), 600);
      }
    }
  }, [bars, currentNode, lesson.nodes, processNode]);

  // Advance to the next message node (for "continue" taps)
  const advance = useCallback(() => {
    if (!currentNode?.next) return;
    const nextNode = lesson.nodes[currentNode.next];
    if (nextNode) {
      hasProcessedNode.current = null;
      processNode(nextNode);
    }
  }, [currentNode, lesson.nodes, processNode]);

  // Handle option selection (for prompt and check nodes)
  const selectOption = useCallback(
    (optionIndex: number) => {
      if (!currentNode?.options) return;
      const option = currentNode.options[optionIndex];
      if (!option) return;

      // Add student response as a message
      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, makeTutorMessage(option.label, "student")],
      }));

      // Navigate to the option's target node
      const nextNode = lesson.nodes[option.next];
      if (nextNode) {
        hasProcessedNode.current = null;
        // Small delay for the student to see their choice
        setTimeout(() => processNode(nextNode), 400);
      }
    },
    [currentNode, lesson.nodes, processNode]
  );

  // Cleanup hint timer
  useEffect(() => {
    return () => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    };
  }, []);

  return {
    state,
    currentNode,
    advance,
    selectOption,
  };
}
