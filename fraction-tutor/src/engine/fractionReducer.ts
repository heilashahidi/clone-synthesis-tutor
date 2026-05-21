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

// Safety net: force every bar's shaded segments to be packed at the
// left. Preserves segment IDs (and any drag offsets), only reassigns
// the `shaded` flag based on the total count. The SHADE rule already
// enforces this at the action level — this normalization is here so a
// bar can never end up visually non-contiguous even if some path
// slipped past the rule.
function normalizeBars(state: ManipulativeState): ManipulativeState {
  let changed = false;
  const bars = state.bars.map((bar) => {
    const shadedCount = bar.segments.filter((s) => s.shaded).length;
    let barChanged = false;
    const segments = bar.segments.map((s, i) => {
      const wantShaded = i < shadedCount;
      if (s.shaded === wantShaded) return s;
      barChanged = true;
      return { ...s, shaded: wantShaded };
    });
    if (!barChanged) return bar;
    changed = true;
    return { ...bar, segments };
  });
  return changed ? { ...state, bars } : state;
}

export function fractionReducer(
  state: ManipulativeState,
  action: ManipulativeAction
): ManipulativeState {
  return normalizeBars(fractionReducerInner(state, action));
}

function fractionReducerInner(
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
      // scattered pieces). But we DON'T reject taps on the "wrong"
      // block — that produced silent no-ops which kids read as a
      // broken UI. Instead, any tap on an unshaded block adds one
      // to the shaded count (fills the next slot from the left),
      // and any tap on a shaded block removes one (clears the
      // rightmost shaded). normalizeBars below packs them to the
      // left for the visual.
      return {
        ...state,
        bars: state.bars.map((bar) => {
          if (bar.id !== action.barId) return bar;
          const segIdx = bar.segments.findIndex(
            (s) => s.id === action.segmentId
          );
          if (segIdx < 0) return bar;
          const seg = bar.segments[segIdx];
          const currentCount = bar.segments.filter((s) => s.shaded).length;
          const newCount = seg.shaded
            ? Math.max(0, currentCount - 1)
            : Math.min(bar.segments.length, currentCount + 1);
          if (newCount === currentCount) return bar;
          return {
            ...bar,
            segments: bar.segments.map((s, i) => ({
              ...s,
              shaded: i < newCount,
            })),
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

    case "ADD_CIRCLE": {
      const newCircle = createCircle(1, 0, action.color);
      return {
        ...state,
        circles: [...state.circles, newCircle],
      };
    }

    case "SPLIT_CIRCLE": {
      return {
        ...state,
        circles: state.circles.map((c) => {
          if (c.id !== action.circleId) return c;
          // Splitting increases slice count by 1. Shaded count stays
          // the same (the previously-colored area gets divided up
          // among the new finer slices — visually it shrinks unless
          // the student colors more).
          return { ...c, slices: c.slices + 1 };
        }),
      };
    }

    case "SHADE_CIRCLE": {
      return {
        ...state,
        circles: state.circles.map((c) => {
          if (c.id !== action.circleId) return c;
          // Each tap cycles the shaded count up by 1; when all wedges
          // are shaded the next tap wraps back to 0. So a kid who
          // over-shades can keep tapping to come back around.
          return { ...c, shaded: (c.shaded + 1) % (c.slices + 1) };
        }),
      };
    }

    case "SMASH": {
      if (action.targetType === "bar") {
        return {
          ...state,
          bars: state.bars.filter((b) => b.id !== action.id),
        };
      }
      return {
        ...state,
        circles: state.circles.filter((c) => c.id !== action.id),
      };
    }

    case "RESET": {
      resetCounters();
      return { ...initialState };
    }

    case "SET_STATE": {
      // Don't reset counters — the action.bars were already created
      // with fresh IDs by processNode, and resetting now would just
      // make any LATER createBar collide with these.
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
