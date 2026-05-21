// ── Manipulative State ──────────────────────────────────────────────

export type BarColor = "teal" | "blue" | "coral" | "purple";

export type Segment = {
  id: string;
  shaded: boolean;
  // Free-movement offset from the segment's home flex slot, in px.
  // Undefined / 0 means the segment is sitting in its bar slot.
  x?: number;
  y?: number;
};

export type FractionBar = {
  id: string;
  segments: Segment[];
  color: BarColor;
};

// Circles are read-only visuals — no gestures, no contiguity rules.
// `shaded` is the count of wedges colored in, starting from the top
// (12 o'clock) and going clockwise.
export type FractionCircle = {
  id: string;
  slices: number;
  shaded: number;
  color: BarColor;
};

export type ManipulativeState = {
  bars: FractionBar[];
  circles: FractionCircle[];
  selectedBarId: string | null;
  selectedSegmentId: string | null;
};

// ── Reducer Actions ─────────────────────────────────────────────────

export type ManipulativeAction =
  | { type: "SPLIT"; barId: string; segmentId: string }
  | { type: "SHADE"; barId: string; segmentId: string }
  | { type: "COMBINE"; barId: string; segmentId: string }
  | { type: "ADD_BAR"; color: BarColor }
  | { type: "ADD_CIRCLE"; color: BarColor }
  | { type: "SPLIT_CIRCLE"; circleId: string }
  | { type: "SHADE_CIRCLE"; circleId: string }
  | { type: "SMASH"; targetType: "bar" | "circle"; id: string }
  | { type: "RESET" }
  | { type: "SET_STATE"; bars: FractionBar[]; circles: FractionCircle[] }
  | { type: "SELECT"; barId: string; segmentId: string }
  | { type: "DESELECT" }
  | { type: "SHATTER"; barId: string; segmentId: string; count: number }
  | {
      type: "MOVE_SEGMENT";
      barId: string;
      segmentId: string;
      x: number;
      y: number;
    }
  | { type: "REMOVE_SEGMENT"; barId: string; segmentId: string };

// ── Derived Fraction ────────────────────────────────────────────────

export type Fraction = {
  numerator: number;
  denominator: number;
};

// ── Lesson Types ────────────────────────────────────────────────────

export type LessonCondition =
  | { type: "fraction_equals"; barIndex?: number; circleIndex?: number; target: Fraction }
  | { type: "fraction_exact"; barIndex?: number; circleIndex?: number; target: Fraction }
  | { type: "screen_clear" }
  | {
      type: "action_performed";
      action:
        | "ADD_BAR"
        | "ADD_CIRCLE"
        | "SHADE"
        | "SPLIT"
        | "COMBINE"
        | "MOVE_SEGMENT"
        | "REMOVE_SEGMENT"
        | "SMASH";
    };

export type TutorialActionTrigger = Extract<
  LessonCondition,
  { type: "action_performed" }
>["action"];

export type LessonOption = {
  label: string;
  next: string;
  isCorrect?: boolean;
};

export type LessonNode = {
  id: string;
  type: "message" | "prompt" | "wait_for_action" | "check";
  next?: string;

  // Scripted dialogue (primary)
  message: string;

  // For prompt and check nodes
  options?: LessonOption[];

  // For wait_for_action nodes
  condition?: LessonCondition;
  onMet?: string;
  hint?: string;
  hintDelay?: number; // seconds before hint shows (default 15)

  // For check nodes
  correctNext?: string;
  correctMessage?: string;
  incorrectNext?: string;
  incorrectMessage?: string;

  // Restrict which gestures the student can use while on this node.
  // Only honored for wait_for_action nodes. If omitted on a
  // wait_for_action with a fraction_equals condition, all gestures
  // are allowed. message / prompt / check nodes always lock all
  // gestures (the only way forward is the Continue / option buttons).
  allowedActions?: TutorialActionTrigger[];

  // When true, the `setup` dispatch is deferred until after the tutor
  // voice finishes speaking the node's message (with a small padding).
  // If voice is muted or unavailable, a fixed fallback delay is used.
  // Use this for "watch what happens" dramatic reveals.
  setupAfterMessage?: boolean;

  // Apply `setup` this many milliseconds after entering the node
  // (regardless of voice). Use when you want the manipulative to
  // change during a specific moment of the spoken line — tuned so
  // the cut/reveal lands toward the end of the voice playback.
  setupDelayMs?: number;

  // When true, FractionBar labels (e.g. "1/2") are hidden on this
  // node. Use on prompt/check nodes that ask the student to name the
  // visible fraction — otherwise the on-screen label gives it away.
  hideFractionLabels?: boolean;

  // Setup: configure the manipulative at this step. A node sets up
  // bars, circles, or both — whichever it doesn't list is cleared.
  setup?: {
    bars?: Array<{
      segments: number;
      shaded: number;
      color: BarColor;
    }>;
    circles?: Array<{
      slices: number;
      shaded: number;
      color: BarColor;
    }>;
  };
};

export type Lesson = {
  id: string;
  title: string;
  startNode: string;
  nodes: Record<string, LessonNode>;
};

// ── Tutor State ─────────────────────────────────────────────────────

export type TutorMessage = {
  id: string;
  text: string;
  sender: "tutor" | "student";
  timestamp: number;
};

export type LessonRunnerState = {
  currentNodeId: string;
  messages: TutorMessage[];
  isComplete: boolean;
  showHint: boolean;
  step: number;
  totalSteps: number;
};
