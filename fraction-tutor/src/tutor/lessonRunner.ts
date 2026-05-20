import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Lesson,
  LessonNode,
  LessonRunnerState,
  TutorMessage,
  FractionBar,
  ManipulativeAction,
  TutorialActionTrigger,
} from "../engine/types";
import { checkCondition } from "../engine/conditions";
import { createBar, createCircle, resetCounters } from "../engine/fractionReducer";
import { handleUnrecognizedState } from "./llmSafetyNet";
import { isLlmConfigured } from "./tutorApi";

// Time (ms) between the scripted hint and the LLM "second-chance"
// hint. The runner only schedules the LLM hint when a proxy is
// configured (VITE_TUTOR_API_URL) and the node opts in via
// `llmFallthrough: true`.
const LLM_HINT_AFTER_SCRIPTED_MS = 15_000;

let messageCounter = 0;

function makeTutorMessage(text: string, sender: "tutor" | "student" = "tutor"): TutorMessage {
  return {
    id: `msg-${++messageCounter}`,
    text,
    sender,
    timestamp: Date.now(),
  };
}

type UseLessonRunnerOptions = {
  lesson: Lesson;
  bars: FractionBar[];
  dispatch: React.Dispatch<ManipulativeAction>;
  /** Maps a node id to its step number for the progress indicator. */
  getStepForNode?: (nodeId: string) => number;
  /** Total number of steps in the progress indicator. */
  totalSteps?: number;
};

export function useLessonRunner({
  lesson,
  bars,
  dispatch,
  getStepForNode = () => 1,
  totalSteps = 1,
}: UseLessonRunnerOptions) {
  const [state, setState] = useState<LessonRunnerState>(() => ({
    currentNodeId: lesson.startNode,
    messages: [],
    isComplete: false,
    showHint: false,
    step: getStepForNode(lesson.startNode),
    totalSteps,
  }));

  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const llmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasProcessedNode = useRef<string | null>(null);

  // Async LLM callbacks fire after a delay, so they need a live
  // handle on the current bars rather than the captured value.
  const barsRef = useRef(bars);
  barsRef.current = bars;

  const currentNode: LessonNode | undefined = lesson.nodes[state.currentNodeId];

  const processNode = useCallback(
    (node: LessonNode) => {
      if (hasProcessedNode.current === node.id) return;
      hasProcessedNode.current = node.id;

      if (node.setup) {
        resetCounters();
        const newBars = (node.setup.bars ?? []).map((b) =>
          createBar(b.segments, b.shaded, b.color)
        );
        const newCircles = (node.setup.circles ?? []).map((c) =>
          createCircle(c.slices, c.shaded, c.color)
        );
        dispatch({ type: "SET_STATE", bars: newBars, circles: newCircles });
      }

      setState((prev) => ({
        ...prev,
        currentNodeId: node.id,
        step: getStepForNode(node.id),
        showHint: false,
        isComplete: node.id === "complete",
        messages: [...prev.messages, makeTutorMessage(node.message)],
      }));

      if (hintTimerRef.current) {
        clearTimeout(hintTimerRef.current);
        hintTimerRef.current = null;
      }
      if (llmTimerRef.current) {
        clearTimeout(llmTimerRef.current);
        llmTimerRef.current = null;
      }

      if (node.type === "wait_for_action" && node.hint) {
        const scriptedDelay = (node.hintDelay ?? 15) * 1000;
        hintTimerRef.current = setTimeout(() => {
          setState((prev) => {
            if (prev.currentNodeId !== node.id) return prev;
            return {
              ...prev,
              showHint: true,
              messages: [...prev.messages, makeTutorMessage(node.hint!)],
            };
          });
        }, scriptedDelay);

        // LLM second-chance hint: fires after the scripted hint when
        // the node opts in via `llmFallthrough` AND a proxy is wired.
        // Uses the current bars to generate a contextual nudge.
        if (node.llmFallthrough && isLlmConfigured()) {
          const llmDelay = scriptedDelay + LLM_HINT_AFTER_SCRIPTED_MS;
          llmTimerRef.current = setTimeout(async () => {
            const helpText = await handleUnrecognizedState(
              barsRef.current,
              node.message
            );
            setState((prev) => {
              if (prev.currentNodeId !== node.id) return prev;
              return {
                ...prev,
                messages: [...prev.messages, makeTutorMessage(helpText)],
              };
            });
          }, llmDelay);
        }
      }
    },
    [dispatch, getStepForNode]
  );

  // Process the initial node on mount.
  useEffect(() => {
    const startNode = lesson.nodes[lesson.startNode];
    if (startNode) processNode(startNode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check fraction_equals conditions when bars change.
  useEffect(() => {
    if (!currentNode || currentNode.type !== "wait_for_action") return;
    if (!currentNode.condition || !currentNode.onMet) return;
    if (currentNode.condition.type !== "fraction_equals") return;

    const met = checkCondition(currentNode.condition, bars);
    if (met) {
      const nextNode = lesson.nodes[currentNode.onMet];
      if (nextNode) {
        setTimeout(() => processNode(nextNode), 600);
      }
    }
  }, [bars, currentNode, lesson.nodes, processNode]);

  // Event-driven advance: call this after the student performs a
  // reducer action so any wait_for_action node listening for that
  // specific action can fire.
  const notifyAction = useCallback(
    (action: TutorialActionTrigger) => {
      if (!currentNode || currentNode.type !== "wait_for_action") return;
      if (!currentNode.condition || !currentNode.onMet) return;
      if (currentNode.condition.type !== "action_performed") return;
      if (currentNode.condition.action !== action) return;

      const nextNode = lesson.nodes[currentNode.onMet];
      if (nextNode) {
        setTimeout(() => processNode(nextNode), 400);
      }
    },
    [currentNode, lesson.nodes, processNode]
  );

  const advance = useCallback(() => {
    if (!currentNode?.next) return;
    const nextNode = lesson.nodes[currentNode.next];
    if (nextNode) {
      hasProcessedNode.current = null;
      processNode(nextNode);
    }
  }, [currentNode, lesson.nodes, processNode]);

  const selectOption = useCallback(
    (optionIndex: number) => {
      if (!currentNode?.options) return;
      const option = currentNode.options[optionIndex];
      if (!option) return;

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, makeTutorMessage(option.label, "student")],
      }));

      const nextNode = lesson.nodes[option.next];
      if (nextNode) {
        hasProcessedNode.current = null;
        setTimeout(() => processNode(nextNode), 400);
      }
    },
    [currentNode, lesson.nodes, processNode]
  );

  // Imperatively jump to a node (useful for skip / debug shortcuts).
  const jumpTo = useCallback(
    (nodeId: string) => {
      const target = lesson.nodes[nodeId];
      if (!target) return;
      hasProcessedNode.current = null;
      processNode(target);
    },
    [lesson.nodes, processNode]
  );

  useEffect(() => {
    return () => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      if (llmTimerRef.current) clearTimeout(llmTimerRef.current);
    };
  }, []);

  return {
    state,
    currentNode,
    advance,
    selectOption,
    notifyAction,
    jumpTo,
  };
}
