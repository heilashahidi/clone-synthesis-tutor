# Architecture

## Overview

The Fraction Equivalence Tutor is a four-layer system: a manipulative engine that owns fraction state, a tutor layer that drives the lesson from a JSON script, a voice layer that speaks tutor messages aloud, and a UI layer that renders and captures input. Lessons are pluggable data + a small TS wrapper; the engine and runner are content-agnostic.

```
┌─────────────────────────────────────────────────┐
│                   UI Layer                       │
│  FractionWorkspace  │  TutorPanel  │  Splash     │
├─────────────────────┴──────────────┴─────────────┤
│               Lesson Shell (wiring)              │
├──────────────────────┬──────────────┬────────────┤
│  Manipulative Engine │ Tutor Layer  │ Voice      │
│  (useReducer)        │ (useLessonRunner)│ Layer  │
│                      │              │            │
│  - Bar state         │ - JSON script│ - ElevenLabs│
│  - Split/Shade/      │ - Step counter│   TTS      │
│    Combine/Move/     │ - LLM safety │ - Mute     │
│    Remove/Shatter    │   net        │   toggle   │
└──────────────────────┴──────────────┴────────────┘
         ▲                        │
         │    reads state /       │
         └── dispatches actions ──┘
```

## Layer 1: Manipulative Engine

The engine is a `useReducer` that manages an array of fraction bars. Each bar is an ordered list of segments with a shaded/unshaded state and an optional free-movement offset.

### State shape

```typescript
type Segment = {
  id: string;
  shaded: boolean;
  // Free-movement offset from the segment's home flex slot, in px.
  // Undefined / 0 means the segment sits in its bar slot.
  x?: number;
  y?: number;
};

type FractionBar = {
  id: string;
  segments: Segment[];
  color: "teal" | "blue" | "coral" | "purple";
};

type ManipulativeState = {
  bars: FractionBar[];
  selectedBarId: string | null;
  selectedSegmentId: string | null;
};
```

### Actions

| Action | Effect | Pedagogical purpose |
|--------|--------|---------------------|
| `SPLIT(barId, segmentId)` | Divides one segment into two equal segments (positions snap home) | Partitioning without changing the whole |
| `SHADE(barId, segmentId)` | Toggles a segment's shaded state | Build a fraction by selecting parts |
| `COMBINE(barId, segmentId)` | Merges a segment with its right neighbor (both must share shade); survivor snaps home | Inverse of splitting; pieces rejoin |
| `SHATTER(barId, segmentId, count)` | Replaces one segment with N equal pieces (positions snap home) | Quick way to divide a whole into many parts |
| `MOVE_SEGMENT(barId, segmentId, x, y)` | Saves a free-floating position offset for a segment | Lets the student arrange pieces like on a whiteboard |
| `REMOVE_SEGMENT(barId, segmentId)` | Removes a segment; drops the bar if empty | Lets the student take pieces away |
| `ADD_BAR(color)` | Appends a new bar with 1 unshaded segment | Creates a fresh bar for comparison |
| `RESET` | Clears all bars | Start over |
| `SET_STATE(bars)` | Replaces entire state (used by lesson setup) | Tutor can stage a specific configuration |
| `SELECT(barId, segmentId)` / `DESELECT` | Tracks a selected segment (kept for future use; current UI is gesture-driven) | — |

### Why useReducer over useState

Split, combine, and shatter have non-trivial logic (inserting / removing segments at specific indices, preserving shaded state, snapping positions). Multiple actions are dispatched in sequence when the tutor sets up a problem (`SET_STATE` then potentially others). A reducer keeps this deterministic and testable outside React.

## Layer 2: Tutor Layer

The tutor is script-first. Every planned moment in the lesson — dialogue, prompts, hints, gesture walkthrough — is written by a human and stored in JSON. The script is the voice the student hears 100% of the time today; the LLM safety net is a planned addition for unanticipated states.

### State machine

Each lesson is a JSON file with nodes. The runner tracks the current node and transitions on student actions or button taps.

```typescript
type LessonNode = {
  id: string;
  type: "message" | "prompt" | "wait_for_action" | "check";
  next?: string;            // Auto-advance target for message nodes (Continue tap)

  message: string;          // The exact tutor dialogue

  // For prompt and check nodes
  options?: {
    label: string;
    next: string;
    isCorrect?: boolean;
  }[];

  // For wait_for_action nodes
  condition?: LessonCondition;
  onMet?: string;
  hint?: string;            // Scripted hint shown after timeout
  hintDelay?: number;       // Seconds before hint shows (default 15)

  // For check nodes
  correctNext?: string;
  correctMessage?: string;
  incorrectNext?: string;
  incorrectMessage?: string;

  // Setup: stage the manipulative when entering this node
  setup?: {
    bars: Array<{ segments: number; shaded: number; color: BarColor }>;
  };
};
```

`LessonCondition` is a discriminated union with two flavors:

```typescript
type LessonCondition =
  | { type: "fraction_equals"; barIndex: number; target: Fraction }
  | {
      type: "action_performed";
      action:
        | "ADD_BAR"
        | "SHADE"
        | "SPLIT"
        | "MOVE_SEGMENT"
        | "REMOVE_SEGMENT";
    };
```

- **`fraction_equals`** is state-driven. The runner's `useEffect` on `bars` calls `checkCondition` after every change; when met, it advances to `onMet` after a 600 ms grace delay so the student sees their action land.
- **`action_performed`** is event-driven. The runner exposes `notifyAction(actionType)`; `LessonShell` calls it after every user-triggered dispatch. If the current node is waiting for that exact action, the runner advances. This powers the walkthrough's gesture coaching.

### Node types

- **message**: Tutor speaks the scripted `message`. A "Continue" button taps to the next node.
- **prompt**: Tutor speaks and shows response buttons; the student's choice picks the next node.
- **wait_for_action**: Tutor watches either bars (`fraction_equals`) or dispatched actions (`action_performed`) and advances on match. A scripted `hint` can fire after `hintDelay` seconds.
- **check**: Assessment with `isCorrect` flags on options; correct vs. known-incorrect routes to separate scripted branches.

### Lesson registry & composition

Lessons live under `src/tutor/lessons/`. Each lesson is a JSON content file plus a TS wrapper that supplies its step-counter config. A registry binds the two and exposes a manifest that the host app picks from by id.

```
lessons/
├── walkthrough.json     # Shared 5-step gesture fragment
├── walkthrough.ts       # `withWalkthrough(lesson)` composer
├── equivalence.json     # Lesson content (without walkthrough)
├── equivalence.ts       # Wrapper: totalSteps, getStepForNode
└── index.ts             # LESSONS[], getLesson(id), getDefaultLesson()
```

**Lesson manifest**:

```typescript
type LessonManifest = {
  id: string;
  title: string;          // Splash title
  description: string;    // Splash subtitle
  lesson: Lesson;         // Script (walkthrough already composed in)
  totalSteps: number;     // Progress indicator denominator
  getStepForNode: (nodeId: string) => number;
};
```

**Walkthrough composer.** `walkthrough.json` is a *fragment* — `{ startNode, exitNodeId, nodes }` — not a full lesson. `withWalkthrough(lesson)` splices its nodes into a lesson, rewires `lesson_intro.next` to point at the walkthrough's start, and rewires the walkthrough's exit node's `onMet` to the lesson's original body entry. Any future lesson with a `lesson_intro` node can opt into the same walkthrough by calling the composer.

**Step counter.** Previously hardcoded in the runner with `equivalence_`/`split_`/`quiz_` prefix matching, step-to-node mapping now lives next to each lesson's content in its TS wrapper. The runner accepts `totalSteps` and `getStepForNode` as options and stays generic.

**Adding a new fraction lesson:**

1. Author `my-lesson.json` (must include a `lesson_intro` message node if you want the shared walkthrough).
2. Author `my-lesson.ts` exporting `myLesson`, `myLessonTotalSteps`, `myLessonStep(nodeId)`.
3. Add a `LessonManifest` entry to `LESSONS` in `index.ts`. Wrap with `withWalkthrough(...)` if desired.

The engine and runner need no changes — they only handle fraction bars, but any fraction-based pedagogy fits.

### LLM safety net (planned)

The repo contains a placeholder `llmSafetyNet.ts` (Claude Haiku via a Cloudflare Worker proxy) but it is **not yet wired into the runner**. The intended design is:

1. **Unrecognized manipulative state.** If the student creates a fraction the script has no branch for, the LLM generates a short, contextual redirect.
2. **Misconception classification.** When a student gives a wrong answer outside known patterns, the LLM picks a tag (`WHOLE_NUMBER_THINKING`, `UNEQUAL_PARTITIONING`, `ADDITIVE_REASONING`, `OTHER`) and the runner branches to a scripted remediation node.
3. **Dynamic hints.** After the scripted hint plays and 15 more seconds pass, the LLM generates a second hint referencing the student's actual bar state.

All calls go through a proxy with a 2 second timeout; on failure the app falls back to a generic scripted message.

## Layer 3: Voice Layer

`src/voice/elevenLabsVoice.ts` calls ElevenLabs TTS for each tutor message. `src/voice/useTutorVoice.ts` is a hook that watches `lessonState.messages`, picks the latest *tutor* message, and speaks it — cancelling any in-flight playback so the chat never overlaps itself.

Configuration:

- `VITE_ELEVENLABS_API_KEY` (required for voice; voice is a no-op without it)
- `VITE_ELEVENLABS_VOICE_ID` (default: Lila)
- Model: `eleven_flash_v2_5` for low latency

**Fraction pronunciation.** Before sending text to ElevenLabs, `toSpokenFractions` rewrites every `X/Y` pattern as `"X over Y"` (e.g., `"1/2"` → `"one over two"`). The chat bubble keeps the compact `1/2` display.

**Browser autoplay.** Browsers block audio until the user has clicked once. The `Splash` start screen exists primarily to capture that first gesture before `LessonShell` mounts; once started, every tutor line speaks automatically.

**Mute.** A speaker icon in the header toggles a `muted` flag passed to `useTutorVoice`. Going muted stops any in-flight audio immediately; subsequent messages aren't fetched.

## Layer 4: UI Layer

The UI is a dumb rendering layer. It receives state, dispatches events, and makes no pedagogical decisions.

### Layout (iPad landscape)

```
┌──────────────────────────────────────────────────┐
│  Fraction explorer              🔊  Step 3/7    │
├──────────────────────────────────────────────────┤
│                                                  │
│  1/2  [████████████░░░░░░░░░░░░]                │
│                                  ✦ Look at these │
│  2/4  [██████░░░░░░│██████░░░░░░] bars …        │
│                                                  │
│  = Same amount!  (when equivalent)               │
│                                                  │
│                                  [ option 1 ]    │
│                                  [ option 2 ]    │
│                                                  │
└──────────────────────────────────────────────────┘
```

A black grid background fills the page. The header has the lesson title, the mute toggle, and the step counter. The workspace (left, flex-grow) holds the fraction bars on the grid. The tutor sidebar (right, 360 px) shows the latest tutor message and any option / Continue buttons.

### Gesture model

The toolbar is gone; gestures drive everything. While a `wait_for_action` walkthrough node is active, only the expected gesture has any effect; everything else silently no-ops. Outside the walkthrough, all gestures are unrestricted.

| Gesture | Action |
|---|---|
| Tap a segment | `SHADE` |
| Double-tap a segment | `SPLIT` |
| Long-press a segment (~½ s, orange charge glow) | `REMOVE_SEGMENT` (blocked when the bar has only one segment) |
| Drag a segment | Free-floating move — saved as the segment's `x`, `y` |
| Drop a dragged segment on an adjacent same-shade neighbor | `COMBINE` |
| Double-tap empty workspace | `ADD_BAR` (color cycles teal → blue → coral → purple) |
| Tap Skip walkthrough (during walkthrough_*) | Runner jumps to `intro_1` |

### Touch targets

All interactive elements are minimum 48×48 px for child-friendly touch input. Fraction segments are 100 px tall and stretch to fill the workspace width. Response buttons in the tutor sidebar are full-width, ≥ 56 px tall.

### Animations

- **Split / Shatter**: framer-motion `layoutId` interpolates the new segments from the original position.
- **Shade**: Background color fades over 200 ms (CSS transition).
- **Combine**: The merged-away segment unmounts; the survivor's `layoutId` animates to the wider slot.
- **Free move**: `useMotionValue` follows the pointer during drag; releases spring to either the new position (if free move) or back to home (if a combine fires).
- **Equivalence reveal**: When two bars share a fraction, a teal "= Same amount!" badge fades in.

## Data flow

```
Student taps / drags / holds a segment, or double-taps empty space
  → Segment / Workspace fires the matching handler
  → LessonShell:
      ├── (a) checks the active walkthrough's expectedAction; no-ops if mismatched
      ├── (b) dispatches the corresponding reducer action
      └── (c) calls runner.notifyAction(actionType)
  → Reducer updates bars
  → Two runner effects react:
      ├── bars change → if current node is wait_for_action with
      │   `fraction_equals`, advance after 600 ms if satisfied
      └── notifyAction(actionType) → if current node is wait_for_action
          with `action_performed` matching that action, advance after 400 ms
  → Tutor message updates
  → useTutorVoice speaks the new message (cancels any in-flight audio)
  → UI re-renders
```

Button taps in the tutor panel (Continue, option, Skip walkthrough) call the runner's `advance` / `selectOption` / `jumpTo` directly — they bypass the action-notify path.

## Offline behavior

The lesson is fully functional offline. All tutor dialogue, hints, feedback, and assessment prompts are scripted and bundled in the app. The (planned) LLM safety net only supplements edge cases; when offline these would fall back to a generic scripted redirect. Lesson progress could be persisted locally (e.g., via Capacitor Preferences) once iPad packaging is added.
