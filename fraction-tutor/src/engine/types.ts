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

export type ManipulativeState = {
  bars: FractionBar[];
  selectedBarId: string | null;
  selectedSegmentId: string | null;
};

// ── Reducer Actions ─────────────────────────────────────────────────

export type ManipulativeAction =
  | { type: "SPLIT"; barId: string; segmentId: string }
  | { type: "SHADE"; barId: string; segmentId: string }
  | { type: "COMBINE"; barId: string; segmentId: string }
  | { type: "ADD_BAR"; color: BarColor }
  | { type: "RESET" }
  | { type: "SET_STATE"; bars: FractionBar[] }
  | { type: "SELECT"; barId: string; segmentId: string }
  | { type: "DESELECT" }
  | { type: "SHATTER"; barId: string; segmentId: string; count: number }
  | {
      type: "MOVE_SEGMENT";
      barId: string;
      segmentId: string;
      x: number;
      y: number;
    };

// ── Derived Fraction ────────────────────────────────────────────────

export type Fraction = {
  numerator: number;
  denominator: number;
};

// ── Lesson Types ────────────────────────────────────────────────────

export type LessonCondition = {
  type: "fraction_equals";
  barIndex: number;
  target: Fraction;
};

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

  // LLM safety net
  llmFallthrough?: boolean;

  // Setup: configure the manipulative at this step
  setup?: {
    bars: Array<{
      segments: number;
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
