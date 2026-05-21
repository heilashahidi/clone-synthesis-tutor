import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Lesson,
  LessonNode,
  LessonRunnerState,
  TutorMessage,
  FractionBar,
  FractionCircle,
  ManipulativeAction,
  TutorialActionTrigger,
} from "../engine/types";
import { checkCondition } from "../engine/conditions";
import { createBar, createCircle } from "../engine/fractionReducer";

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
  circles: FractionCircle[];
  dispatch: React.Dispatch<ManipulativeAction>;
  /** Maps a node id to its step number for the progress indicator. */
  getStepForNode?: (nodeId: string) => number;
  /** Total number of steps in the progress indicator. */
  totalSteps?: number;
};

export type PendingSetup = {
  bars: FractionBar[];
  circles: ReturnType<typeof createCircle>[];
};

export function useLessonRunner({
  lesson,
  bars,
  circles,
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
  const delayedSetupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Stash the pending setup payload alongside the timer so we can
  // catch up (apply it immediately) if the student advances before
  // the delay fires. Without this, a fast-clicking student can skip
  // past cut_intro and leave the bar at its previous state.
  const pendingDelayedSetupRef = useRef<PendingSetup | null>(null);
  const hasProcessedNode = useRef<string | null>(null);

  // Pending setup queued up by a `setupAfterMessage: true` node.
  // LessonShell watches this and applies it when the voice finishes
  // speaking the node's line (or after a fallback delay when voice
  // is muted/unavailable), then calls `clearPendingSetup`.
  const [pendingSetup, setPendingSetup] = useState<PendingSetup | null>(null);

  const currentNode: LessonNode | undefined = lesson.nodes[state.currentNodeId];

  const processNode = useCallback(
    (node: LessonNode) => {
      if (hasProcessedNode.current === node.id) return;
      hasProcessedNode.current = node.id;

      // If the previous node had a pending setupDelayMs and we're
      // navigating away before it fired, apply that setup right now
      // (catch-up) instead of dropping it on the floor. Then clear
      // the timer.
      if (delayedSetupTimerRef.current) {
        clearTimeout(delayedSetupTimerRef.current);
        delayedSetupTimerRef.current = null;
        if (pendingDelayedSetupRef.current) {
          dispatch({
            type: "SET_STATE",
            bars: pendingDelayedSetupRef.current.bars,
            circles: pendingDelayedSetupRef.current.circles,
          });
          pendingDelayedSetupRef.current = null;
        }
      }

      if (node.setup) {
        // IDs intentionally NOT reset here. If we reset, the new
        // bars/segments get IDs (bar-1, seg-1...) that collide with
        // the old bars still in React's state, and React reconciles
        // them as the same components — leading to mixed colors and
        // duplicate-numbered segments across a setup boundary. Just
        // let the counters keep growing; collisions vanish.
        const newBars = (node.setup.bars ?? []).map((b) =>
          createBar(b.segments, b.shaded, b.color)
        );
        const newCircles = (node.setup.circles ?? []).map((c) =>
          createCircle(c.slices, c.shaded, c.color)
        );
        if (node.setupAfterMessage) {
          setPendingSetup({ bars: newBars, circles: newCircles });
        } else if (typeof node.setupDelayMs === "number") {
          setPendingSetup(null);
          pendingDelayedSetupRef.current = { bars: newBars, circles: newCircles };
          delayedSetupTimerRef.current = setTimeout(() => {
            delayedSetupTimerRef.current = null;
            if (pendingDelayedSetupRef.current) {
              dispatch({
                type: "SET_STATE",
                bars: pendingDelayedSetupRef.current.bars,
                circles: pendingDelayedSetupRef.current.circles,
              });
              pendingDelayedSetupRef.current = null;
            }
          }, node.setupDelayMs);
        } else {
          setPendingSetup(null);
          dispatch({ type: "SET_STATE", bars: newBars, circles: newCircles });
        }
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

  const clearPendingSetup = useCallback(() => setPendingSetup(null), []);

  // True between the moment a wait_for_action's condition fires and
  // the moment we navigate to the next node. While true, LessonShell
  // locks all gestures so post-success taps don't shade extra pieces
  // during the 400-600ms celebratory pause.
  const [isAdvancing, setIsAdvancing] = useState(false);

  // Reset the advance lock whenever we land on a new node.
  useEffect(() => {
    setIsAdvancing(false);
  }, [state.currentNodeId]);

  // Check fraction_equals / fraction_exact conditions when bars or
  // circles change. The condition's barIndex / circleIndex decides
  // which collection it reads.
  useEffect(() => {
    if (!currentNode || currentNode.type !== "wait_for_action") return;
    if (!currentNode.condition || !currentNode.onMet) return;
    if (
      currentNode.condition.type !== "fraction_equals" &&
      currentNode.condition.type !== "fraction_exact" &&
      currentNode.condition.type !== "screen_clear"
    )
      return;
    if (isAdvancing) return;

    const met = checkCondition(currentNode.condition, bars, circles);
    if (met) {
      const nextNode = lesson.nodes[currentNode.onMet];
      if (nextNode) {
        setIsAdvancing(true);
        setTimeout(() => processNode(nextNode), 600);
      }
    }
  }, [bars, circles, currentNode, lesson.nodes, processNode, isAdvancing]);

  // Event-driven advance: call this after the student performs a
  // reducer action so any wait_for_action node listening for that
  // specific action can fire.
  const notifyAction = useCallback(
    (action: TutorialActionTrigger) => {
      if (!currentNode || currentNode.type !== "wait_for_action") return;
      if (!currentNode.condition || !currentNode.onMet) return;
      if (currentNode.condition.type !== "action_performed") return;
      if (currentNode.condition.action !== action) return;
      if (isAdvancing) return;
      setIsAdvancing(true);

      const nextNode = lesson.nodes[currentNode.onMet];
      if (nextNode) {
        setTimeout(() => processNode(nextNode), 400);
      }
    },
    [currentNode, lesson.nodes, processNode, isAdvancing]
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
      if (delayedSetupTimerRef.current) clearTimeout(delayedSetupTimerRef.current);
    };
  }, []);

  return {
    state,
    currentNode,
    advance,
    selectOption,
    notifyAction,
    jumpTo,
    pendingSetup,
    clearPendingSetup,
    isAdvancing,
  };
}
