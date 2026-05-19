import { useCallback, useReducer, useState } from "react";
import {
  fractionReducer,
  initialState,
} from "../engine/fractionReducer";
import { useLessonRunner } from "../tutor/lessonRunner";
import { useTutorVoice } from "../voice/useTutorVoice";
import { FractionWorkspace } from "./FractionWorkspace";
import { TutorPanel } from "./TutorPanel";
import { ProgressIndicator } from "./ProgressIndicator";
import type { BarColor, Lesson } from "../engine/types";
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
    jumpTo,
  } = useLessonRunner({
    lesson,
    bars: manipState.bars,
    dispatch,
    totalSteps,
    getStepForNode,
  });

  // Speak each new tutor line through ElevenLabs (no-op without API key).
  const [muted, setMuted] = useState(false);
  useTutorVoice(lessonState.messages, muted);

  // While we're on a walkthrough node (a wait_for_action whose condition
  // is action_performed), only the expected gesture should do anything.
  // After the walkthrough, expectedAction is null and every gesture
  // works normally.
  const expectedAction =
    currentNode?.type === "wait_for_action" &&
    currentNode.condition?.type === "action_performed"
      ? currentNode.condition.action
      : null;
  const isLocked = (action: string) =>
    expectedAction !== null && expectedAction !== action;

  // ── Gesture handlers ────────────────────────────────────────────────

  const handleSegmentTap = useCallback(
    (barId: string, segmentId: string) => {
      if (isLocked("SHADE")) return;
      dispatch({ type: "SHADE", barId, segmentId });
      notifyAction("SHADE");
    },
    [expectedAction, notifyAction]
  );

  const handleSegmentDoubleTap = useCallback(
    (barId: string, segmentId: string) => {
      if (isLocked("SPLIT")) return;
      dispatch({ type: "SPLIT", barId, segmentId });
      notifyAction("SPLIT");
    },
    [expectedAction, notifyAction]
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
    [expectedAction, manipState.bars, notifyAction]
  );

  const handleSegmentDragEnd = useCallback(
    (
      barId: string,
      segmentId: string,
      x: number,
      y: number,
      dropTargetId: string | null
    ) => {
      if (isLocked("MOVE_SEGMENT")) return;
      // Combine-on-drop only outside the walkthrough; during the drag
      // step we want a drop to register as movement, not combine.
      if (dropTargetId && expectedAction === null) {
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
          return;
        }
      }
      dispatch({ type: "MOVE_SEGMENT", barId, segmentId, x, y });
      if (x !== 0 || y !== 0) notifyAction("MOVE_SEGMENT");
    },
    [expectedAction, manipState.bars, notifyAction]
  );

  const handleEmptyDoubleTap = useCallback(() => {
    if (isLocked("ADD_BAR")) return;
    const color =
      BAR_COLOR_CYCLE[manipState.bars.length % BAR_COLOR_CYCLE.length];
    dispatch({ type: "ADD_BAR", color });
    notifyAction("ADD_BAR");
  }, [expectedAction, manipState.bars.length, notifyAction]);

  // While we're on a walkthrough_* node, offer a Skip link in the chat
  // that jumps to the start of the real lesson.
  const inWalkthrough =
    currentNode?.id.startsWith("walkthrough_") ?? false;
  const handleSkipWalkthrough = useCallback(() => {
    jumpTo("intro_1");
  }, [jumpTo]);

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
          onOptionSelect={selectOption}
          onAdvance={advance}
          onSkipTutorial={inWalkthrough ? handleSkipWalkthrough : undefined}
        />
      </div>
    </div>
  );
}
