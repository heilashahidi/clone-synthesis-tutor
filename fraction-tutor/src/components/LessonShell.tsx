import { useCallback, useMemo, useReducer, useState } from "react";
import {
  fractionReducer,
  initialState,
} from "../engine/fractionReducer";
import { useLessonRunner } from "../tutor/lessonRunner";
import { useTutorVoice } from "../voice/useTutorVoice";
import { FractionWorkspace } from "./FractionWorkspace";
import { TutorPanel } from "./TutorPanel";
import { ProgressIndicator } from "./ProgressIndicator";
import type {
  BarColor,
  Lesson,
  TutorialActionTrigger,
} from "../engine/types";
import styles from "../styles/LessonShell.module.css";

type LessonShellProps = {
  lesson: Lesson;
  totalSteps?: number;
  getStepForNode?: (nodeId: string) => number;
};

const BAR_COLOR_CYCLE: BarColor[] = ["teal", "blue", "coral", "purple"];

export function LessonShell({
  lesson,
  totalSteps,
  getStepForNode,
}: LessonShellProps) {
  const [manipState, dispatch] = useReducer(fractionReducer, initialState);

  const {
    state: lessonState,
    currentNode,
    advance,
    selectOption,
    notifyAction,
  } = useLessonRunner({
    lesson,
    bars: manipState.bars,
    dispatch,
    totalSteps,
    getStepForNode,
  });

  // Speak each new tutor line through ElevenLabs (no-op without API key).
  // `isSpeaking` is true while Lila is mid-sentence so we can hold the
  // Continue button until she finishes.
  const [muted, setMuted] = useState(false);
  const { isSpeaking } = useTutorVoice(lessonState.messages, muted);

  // Compute which gestures the student is allowed to use on the
  // current node. `null` = no restriction (e.g., dev/demo nodes
  // without an `allowedActions` list). An empty set means every
  // gesture is silently a no-op — that's the default for
  // message / prompt / check nodes where the only way forward is
  // a Continue or option-button tap.
  const allowedActions = useMemo<Set<TutorialActionTrigger> | null>(() => {
    if (!currentNode) return null;
    if (currentNode.type !== "wait_for_action") {
      return new Set<TutorialActionTrigger>(); // nothing allowed
    }
    if (currentNode.allowedActions) return new Set(currentNode.allowedActions);
    if (currentNode.condition?.type === "action_performed") {
      return new Set<TutorialActionTrigger>([currentNode.condition.action]);
    }
    return null; // wait_for_action with fraction_equals, no list: open
  }, [currentNode]);

  const isLocked = (action: TutorialActionTrigger) =>
    allowedActions !== null && !allowedActions.has(action);

  // ── Gesture handlers ────────────────────────────────────────────────

  const handleSegmentTap = useCallback(
    (barId: string, segmentId: string) => {
      if (isLocked("SHADE")) return;
      // The reducer enforces the contiguous-from-left rule so a
      // non-leftmost tap is dropped at the reducer level too.
      dispatch({ type: "SHADE", barId, segmentId });
      notifyAction("SHADE");
    },
    [allowedActions, notifyAction]
  );

  const handleSegmentDoubleTap = useCallback(
    (barId: string, segmentId: string) => {
      if (isLocked("SPLIT")) return;
      dispatch({ type: "SPLIT", barId, segmentId });
      notifyAction("SPLIT");
    },
    [allowedActions, notifyAction]
  );

  const handleSegmentLongPress = useCallback(
    (barId: string, segmentId: string) => {
      if (isLocked("REMOVE_SEGMENT")) return;
      // Don't let a long-press wipe out the last piece of a bar.
      const bar = manipState.bars.find((b) => b.id === barId);
      if (!bar || bar.segments.length <= 1) return;
      dispatch({ type: "REMOVE_SEGMENT", barId, segmentId });
      notifyAction("REMOVE_SEGMENT");
    },
    [allowedActions, manipState.bars, notifyAction]
  );

  // Returns true if the drag-end was handled (state changed); the
  // Segment uses the return value to decide whether to spring its
  // motion value back to the model position.
  const handleSegmentDragEnd = useCallback(
    (
      barId: string,
      segmentId: string,
      x: number,
      y: number,
      dropTargetId: string | null
    ): boolean => {
      // Combine path: only when COMBINE is allowed AND the drop
      // landed on an adjacent same-bar neighbor.
      if (dropTargetId && !isLocked("COMBINE")) {
        const sourceBar = manipState.bars.find((b) => b.id === barId);
        const sourceIdx =
          sourceBar?.segments.findIndex((s) => s.id === segmentId) ?? -1;
        let targetIdx = -1;
        let targetBarId: string | null = null;
        for (const bar of manipState.bars) {
          const ti = bar.segments.findIndex((s) => s.id === dropTargetId);
          if (ti !== -1) {
            targetIdx = ti;
            targetBarId = bar.id;
            break;
          }
        }
        if (
          targetBarId === barId &&
          sourceIdx >= 0 &&
          Math.abs(sourceIdx - targetIdx) === 1
        ) {
          const leftIdx = Math.min(sourceIdx, targetIdx);
          const leftId = sourceBar!.segments[leftIdx].id;
          dispatch({ type: "COMBINE", barId, segmentId: leftId });
          return true;
        }
      }
      if (isLocked("MOVE_SEGMENT")) return false; // segment should snap home
      dispatch({ type: "MOVE_SEGMENT", barId, segmentId, x, y });
      if (x !== 0 || y !== 0) notifyAction("MOVE_SEGMENT");
      return true;
    },
    [allowedActions, manipState.bars, notifyAction]
  );

  const handleEmptyDoubleTap = useCallback(() => {
    if (isLocked("ADD_BAR")) return;
    const color =
      BAR_COLOR_CYCLE[manipState.bars.length % BAR_COLOR_CYCLE.length];
    dispatch({ type: "ADD_BAR", color });
    notifyAction("ADD_BAR");
  }, [allowedActions, manipState.bars.length, notifyAction]);

  return (
    <div className={styles.shell}>
      <ProgressIndicator
        step={lessonState.step}
        totalSteps={lessonState.totalSteps}
        isComplete={lessonState.isComplete}
        muted={muted}
        onToggleMute={() => setMuted((m) => !m)}
      />

      <div className={styles.body}>
        <div className={styles.canvas}>
          <FractionWorkspace
            bars={manipState.bars}
            circles={manipState.circles}
            selectedSegmentId={manipState.selectedSegmentId}
            onSegmentTap={handleSegmentTap}
            onSegmentDoubleTap={handleSegmentDoubleTap}
            onSegmentLongPress={handleSegmentLongPress}
            onSegmentDragEnd={handleSegmentDragEnd}
            onEmptyDoubleTap={handleEmptyDoubleTap}
          />
        </div>

        <TutorPanel
          messages={lessonState.messages}
          currentNode={currentNode}
          isSpeaking={isSpeaking}
          onOptionSelect={selectOption}
          onAdvance={advance}
        />
      </div>
    </div>
  );
}
