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
import {
  tutorialMessage,
  useTutorialProgress,
} from "./useTutorialProgress";
import type { BarColor, Lesson } from "../engine/types";
import styles from "../styles/LessonShell.module.css";

type LessonShellProps = {
  lesson: Lesson;
};

const BAR_COLOR_CYCLE: BarColor[] = ["teal", "blue", "coral", "purple"];

export function LessonShell({ lesson }: LessonShellProps) {
  const [manipState, dispatch] = useReducer(fractionReducer, initialState);

  // The chat itself runs the walkthrough; the AI lesson is paused
  // until the tutorial finishes (or the student skips it).
  const {
    step: tutorialStep,
    advance: advanceTutorial,
    skip: skipTutorial,
  } = useTutorialProgress();

  const lessonActive = tutorialStep === null;

  const { state: lessonState, currentNode, advance, selectOption } =
    useLessonRunner({
      lesson,
      bars: manipState.bars,
      dispatch,
      active: lessonActive,
    });

  // The tutor chat shows either the tutorial step (as if Lila were
  // speaking it) or the live lesson messages.
  const displayMessages = useMemo(() => {
    if (tutorialStep) return [tutorialMessage(tutorialStep)];
    return lessonState.messages;
  }, [tutorialStep, lessonState.messages]);

  // Speak whatever the chat is showing.
  const [muted, setMuted] = useState(false);
  useTutorVoice(displayMessages, muted);

  // ── Gesture handlers ────────────────────────────────────────────────

  const handleSegmentTap = useCallback(
    (barId: string, segmentId: string) => {
      dispatch({ type: "SHADE", barId, segmentId });
      advanceTutorial("SHADE");
    },
    [advanceTutorial]
  );

  const handleSegmentDoubleTap = useCallback(
    (barId: string, segmentId: string) => {
      dispatch({ type: "SPLIT", barId, segmentId });
      advanceTutorial("SPLIT");
    },
    [advanceTutorial]
  );

  const handleSegmentLongPress = useCallback(
    (barId: string, segmentId: string) => {
      dispatch({ type: "REMOVE_SEGMENT", barId, segmentId });
      advanceTutorial("REMOVE_SEGMENT");
    },
    [advanceTutorial]
  );

  const handleSegmentDragEnd = useCallback(
    (
      barId: string,
      segmentId: string,
      x: number,
      y: number,
      dropTargetId: string | null
    ) => {
      if (dropTargetId) {
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
      if (x !== 0 || y !== 0) advanceTutorial("MOVE_SEGMENT");
    },
    [manipState.bars, advanceTutorial]
  );

  const handleEmptyDoubleTap = useCallback(() => {
    const color =
      BAR_COLOR_CYCLE[manipState.bars.length % BAR_COLOR_CYCLE.length];
    dispatch({ type: "ADD_BAR", color });
    advanceTutorial("ADD_BAR");
  }, [manipState.bars.length, advanceTutorial]);

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
          messages={displayMessages}
          currentNode={lessonActive ? currentNode : undefined}
          onOptionSelect={selectOption}
          onAdvance={advance}
          onSkipTutorial={lessonActive ? undefined : skipTutorial}
        />
      </div>
    </div>
  );
}
