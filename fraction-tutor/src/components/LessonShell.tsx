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

  // Tap a segment: select/deselect or shade depending on context
  const handleSegmentTap = useCallback(
    (barId: string, segmentId: string) => {
      if (
        manipState.selectedBarId === barId &&
        manipState.selectedSegmentId === segmentId
      ) {
        dispatch({ type: "SHADE", barId, segmentId });
      } else {
        dispatch({ type: "SELECT", barId, segmentId });
      }
    },
    [manipState.selectedBarId, manipState.selectedSegmentId]
  );

  // Long-press a segment: shatter into 4 equal pieces (all snap home)
  const handleSegmentSmash = useCallback(
    (barId: string, segmentId: string) => {
      dispatch({ type: "SHATTER", barId, segmentId, count: 4 });
      dispatch({ type: "DESELECT" });
    },
    []
  );

  // Drag end: if dropped on an adjacent same-bar same-shade neighbor,
  // combine; otherwise save the new free-floating position.
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
    },
    [manipState.bars]
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

      <div className={styles.body}>
        <div className={styles.canvas}>
          <FractionWorkspace
            bars={manipState.bars}
            selectedSegmentId={manipState.selectedSegmentId}
            onSegmentTap={handleSegmentTap}
            onSegmentSmash={handleSegmentSmash}
            onSegmentDragEnd={handleSegmentDragEnd}
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
        </div>

        <TutorPanel
          messages={lessonState.messages}
          currentNode={currentNode}
          onOptionSelect={selectOption}
          onAdvance={advance}
        />
      </div>
    </div>
  );
}
