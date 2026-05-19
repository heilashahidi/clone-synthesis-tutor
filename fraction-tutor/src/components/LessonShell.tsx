import { useReducer, useCallback } from "react";
import { fractionReducer, initialState, createBar, resetCounters } from "../engine/fractionReducer";
import { useLessonRunner } from "../tutor/lessonRunner";
import { FractionWorkspace } from "./FractionWorkspace";
import { ActionBar } from "./ActionBar";
import { TutorPanel } from "./TutorPanel";
import { ProgressIndicator } from "./ProgressIndicator";
import type { Lesson } from "../engine/types";
import styles from "../styles/LessonShell.module.css";

type LessonShellProps = {
  lesson: Lesson;
};

export function LessonShell({ lesson }: LessonShellProps) {
  const [manipState, dispatch] = useReducer(fractionReducer, initialState);

  const { state: lessonState, currentNode, advance, selectOption } =
    useLessonRunner({
      lesson,
      bars: manipState.bars,
      dispatch,
    });

  // Handle segment tap: select/deselect or shade depending on context
  const handleSegmentTap = useCallback(
    (barId: string, segmentId: string) => {
      if (
        manipState.selectedBarId === barId &&
        manipState.selectedSegmentId === segmentId
      ) {
        // Tap same segment = toggle shade
        dispatch({ type: "SHADE", barId, segmentId });
      } else {
        // Tap new segment = select it
        dispatch({ type: "SELECT", barId, segmentId });
      }
    },
    [manipState.selectedBarId, manipState.selectedSegmentId]
  );

  const handleSplit = useCallback(() => {
    if (manipState.selectedBarId && manipState.selectedSegmentId) {
      dispatch({
        type: "SPLIT",
        barId: manipState.selectedBarId,
        segmentId: manipState.selectedSegmentId,
      });
      dispatch({ type: "DESELECT" });
    }
  }, [manipState.selectedBarId, manipState.selectedSegmentId]);

  const handleCombine = useCallback(() => {
    if (manipState.selectedBarId && manipState.selectedSegmentId) {
      dispatch({
        type: "COMBINE",
        barId: manipState.selectedBarId,
        segmentId: manipState.selectedSegmentId,
      });
      dispatch({ type: "DESELECT" });
    }
  }, [manipState.selectedBarId, manipState.selectedSegmentId]);

  const handleShade = useCallback(() => {
    if (manipState.selectedBarId && manipState.selectedSegmentId) {
      dispatch({
        type: "SHADE",
        barId: manipState.selectedBarId,
        segmentId: manipState.selectedSegmentId,
      });
    }
  }, [manipState.selectedBarId, manipState.selectedSegmentId]);

  const handleReset = useCallback(() => {
    dispatch({ type: "DESELECT" });
    if (currentNode?.setup) {
      resetCounters();
      const newBars = currentNode.setup.bars.map((b) =>
        createBar(b.segments, b.shaded, b.color)
      );
      dispatch({ type: "SET_STATE", bars: newBars });
    }
  }, [currentNode]);

  return (
    <div className={styles.shell}>
      <ProgressIndicator
        step={lessonState.step}
        totalSteps={lessonState.totalSteps}
        isComplete={lessonState.isComplete}
      />

      <FractionWorkspace
        bars={manipState.bars}
        selectedSegmentId={manipState.selectedSegmentId}
        onSegmentTap={handleSegmentTap}
      />

      {!lessonState.isComplete && (
        <ActionBar
          hasSelection={!!manipState.selectedSegmentId}
          onSplit={handleSplit}
          onCombine={handleCombine}
          onShade={handleShade}
          onReset={handleReset}
        />
      )}

      <TutorPanel
        messages={lessonState.messages}
        currentNode={currentNode}
        onOptionSelect={selectOption}
        onAdvance={advance}
      />
    </div>
  );
}
