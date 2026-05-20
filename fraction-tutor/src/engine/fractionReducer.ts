import type {
  ManipulativeState,
  ManipulativeAction,
  FractionBar,
  FractionCircle,
  Segment,
  BarColor,
} from "./types";

// ── Helpers ─────────────────────────────────────────────────────────

let segmentCounter = 0;

export function makeSegmentId(): string {
  return `seg-${++segmentCounter}`;
}

let barCounter = 0;

export function makeBarId(): string {
  return `bar-${++barCounter}`;
}

let circleCounter = 0;

export function makeCircleId(): string {
  return `circle-${++circleCounter}`;
}

export function resetCounters(): void {
  segmentCounter = 0;
  barCounter = 0;
  circleCounter = 0;
}

function createBar(
  segmentCount: number,
  shadedCount: number,
  color: BarColor
): FractionBar {
  const segments: Segment[] = [];
  for (let i = 0; i < segmentCount; i++) {
    segments.push({
      id: makeSegmentId(),
      shaded: i < shadedCount,
    });
  }
  return { id: makeBarId(), segments, color };
}

function createCircle(
  slices: number,
  shaded: number,
  color: BarColor
): FractionCircle {
  return { id: makeCircleId(), slices, shaded, color };
}

// ── Initial State ───────────────────────────────────────────────────

export const initialState: ManipulativeState = {
  bars: [],
  circles: [],
  selectedBarId: null,
  selectedSegmentId: null,
};

// ── Reducer ─────────────────────────────────────────────────────────

export function fractionReducer(
  state: ManipulativeState,
  action: ManipulativeAction
): ManipulativeState {
  switch (action.type) {
    case "SPLIT": {
      return {
        ...state,
        bars: state.bars.map((bar) => {
          if (bar.id !== action.barId) return bar;

          const segIndex = bar.segments.findIndex(
            (s) => s.id === action.segmentId
          );
          if (segIndex === -1) return bar;

          const target = bar.segments[segIndex];
          // Split one segment into two, both inherit the shaded state.
          // Both pieces snap to their home slot (no free-movement offset).
          const newSegments = [...bar.segments];
          newSegments.splice(segIndex, 1, {
            id: target.id, // keep original id for animation
            shaded: target.shaded,
            x: 0,
            y: 0,
          }, {
            id: makeSegmentId(),
            shaded: target.shaded,
            x: 0,
            y: 0,
          });

          return { ...bar, segments: newSegments };
        }),
      };
    }

    case "SHADE": {
      // The shaded portion of a bar must stay contiguous from the
      // left — so the visual fraction always matches the math
      // fraction (e.g., 2/4 is always the left half, never two
      // scattered pieces). Enforce that here, not in handlers, so
      // no client-side path can bypass it.
      return {
        ...state,
        bars: state.bars.map((bar) => {
          if (bar.id !== action.barId) return bar;
          const segIdx = bar.segments.findIndex(
            (s) => s.id === action.segmentId
          );
          if (segIdx < 0) return bar;
          const seg = bar.segments[segIdx];
          if (seg.shaded) {
            // Un-shading: only the rightmost shaded piece may flip.
            let rightmostShadedIdx = -1;
            for (let i = bar.segments.length - 1; i >= 0; i--) {
              if (bar.segments[i].shaded) {
                rightmostShadedIdx = i;
                break;
              }
            }
            if (segIdx !== rightmostShadedIdx) return bar;
          } else {
            // Shading: only the leftmost unshaded piece may flip.
            const leftmostUnshadedIdx = bar.segments.findIndex(
              (s) => !s.shaded
            );
            if (segIdx !== leftmostUnshadedIdx) return bar;
          }
          return {
            ...bar,
            segments: bar.segments.map((s) =>
              s.id === action.segmentId ? { ...s, shaded: !s.shaded } : s
            ),
          };
        }),
      };
    }

    case "COMBINE": {
      return {
        ...state,
        bars: state.bars.map((bar) => {
          if (bar.id !== action.barId) return bar;

          const segIndex = bar.segments.findIndex(
            (s) => s.id === action.segmentId
          );
          // Can't combine the last segment (no right neighbor)
          if (segIndex === -1 || segIndex >= bar.segments.length - 1)
            return bar;

          const current = bar.segments[segIndex];
          const next = bar.segments[segIndex + 1];

          // Both must have the same shaded state to combine
          if (current.shaded !== next.shaded) return bar;

          const newSegments = [...bar.segments];
          // Remove the right neighbor, keep the current.
          // Snap the survivor back to its home slot so it doesn't
          // remain at the drop point after a drag-combine.
          newSegments.splice(segIndex + 1, 1);
          newSegments[segIndex] = { ...current, x: 0, y: 0 };

          return { ...bar, segments: newSegments };
        }),
      };
    }

    case "ADD_BAR": {
      const newBar = createBar(1, 0, action.color);
      return {
        ...state,
        bars: [...state.bars, newBar],
      };
    }

    case "RESET": {
      resetCounters();
      return { ...initialState };
    }

    case "SET_STATE": {
      resetCounters();
      return {
        ...state,
        bars: action.bars,
        circles: action.circles,
        selectedBarId: null,
        selectedSegmentId: null,
      };
    }

    case "SELECT": {
      return {
        ...state,
        selectedBarId: action.barId,
        selectedSegmentId: action.segmentId,
      };
    }

    case "DESELECT": {
      return {
        ...state,
        selectedBarId: null,
        selectedSegmentId: null,
      };
    }

    case "SHATTER": {
      return {
        ...state,
        bars: state.bars.map((bar) => {
          if (bar.id !== action.barId) return bar;

          const segIndex = bar.segments.findIndex(
            (s) => s.id === action.segmentId
          );
          if (segIndex === -1 || action.count < 2) return bar;

          const target = bar.segments[segIndex];
          // Keep the original id on the first piece so framer-motion
          // animates it from the dragged segment's position.
          // All pieces snap to their home slot.
          const newPieces: Segment[] = [
            { id: target.id, shaded: target.shaded, x: 0, y: 0 },
          ];
          for (let i = 1; i < action.count; i++) {
            newPieces.push({
              id: makeSegmentId(),
              shaded: target.shaded,
              x: 0,
              y: 0,
            });
          }

          const newSegments = [...bar.segments];
          newSegments.splice(segIndex, 1, ...newPieces);

          return { ...bar, segments: newSegments };
        }),
      };
    }

    case "MOVE_SEGMENT": {
      return {
        ...state,
        bars: state.bars.map((bar) => {
          if (bar.id !== action.barId) return bar;
          return {
            ...bar,
            segments: bar.segments.map((seg) =>
              seg.id === action.segmentId
                ? { ...seg, x: action.x, y: action.y }
                : seg
            ),
          };
        }),
      };
    }

    case "REMOVE_SEGMENT": {
      // Remove a single segment; drop the whole bar if its last
      // segment is being removed.
      const bars = state.bars
        .map((bar) => {
          if (bar.id !== action.barId) return bar;
          return {
            ...bar,
            segments: bar.segments.filter((s) => s.id !== action.segmentId),
          };
        })
        .filter((bar) => bar.segments.length > 0);
      return { ...state, bars };
    }

    default:
      return state;
  }
}

// ── Factories (used by lesson setup) ────────────────────────────────

export { createBar, createCircle };
