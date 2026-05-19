import type {
  ManipulativeState,
  ManipulativeAction,
  FractionBar,
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

export function resetCounters(): void {
  segmentCounter = 0;
  barCounter = 0;
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

// ── Initial State ───────────────────────────────────────────────────

export const initialState: ManipulativeState = {
  bars: [],
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
          // Split one segment into two, both inherit the shaded state
          const newSegments = [...bar.segments];
          newSegments.splice(segIndex, 1, {
            id: target.id, // keep original id for animation
            shaded: target.shaded,
          }, {
            id: makeSegmentId(),
            shaded: target.shaded,
          });

          return { ...bar, segments: newSegments };
        }),
      };
    }

    case "SHADE": {
      return {
        ...state,
        bars: state.bars.map((bar) => {
          if (bar.id !== action.barId) return bar;
          return {
            ...bar,
            segments: bar.segments.map((seg) =>
              seg.id === action.segmentId
                ? { ...seg, shaded: !seg.shaded }
                : seg
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
          // Remove the right neighbor, keep the current
          newSegments.splice(segIndex + 1, 1);

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
      return { ...initialState, bars: [] };
    }

    case "SET_STATE": {
      resetCounters();
      return {
        ...state,
        bars: action.bars,
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

    default:
      return state;
  }
}

// ── Bar Factory (used by lesson setup) ──────────────────────────────

export { createBar };
