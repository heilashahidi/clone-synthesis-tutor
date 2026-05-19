# Architecture

## Overview

The Fraction Equivalence Tutor is a four-layer system: a manipulative engine that owns fraction state, a tutor layer that drives the lesson from a JSON script, a voice layer that speaks tutor messages aloud, and a UI layer that renders and captures input. Lessons are pluggable data + a small TS wrapper; the engine and runner are content-agnostic. Anthropic and ElevenLabs are reached through a small Cloudflare Worker proxy so their keys never end up in the public client bundle.

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
│  - Bar state         │ - JSON script│ - Calls    │
│  - Split/Shade/      │ - Step counter│   proxy   │
│    Combine/Move/     │ - LLM safety │   /tts     │
│    Remove/Shatter    │   net (wired)│ - Mute     │
└──────────────────────┴──────────────┴────────────┘
         ▲                        │                 │
         │   reads state /        ▼                 ▼
         └── dispatches actions ──┴── Worker proxy ─┘
                                  (/tutor, /tts)
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

The tutor is script-first. Every planned moment in the lesson — dialogue, prompts, hints — is written by a human and stored in JSON. The script is the voice the student hears the vast majority of the time. A Claude Haiku safety net (via the proxy) fires a single contextual second-chance hint when the student is stuck on a `wait_for_action` node that has opted in.

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
  llmFallthrough?: boolean; // Opt into the LLM second-chance hint

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
- **`action_performed`** is event-driven. The runner exposes `notifyAction(actionType)`; `LessonShell` calls it after every user-triggered dispatch. If the current node is waiting for that exact action, the runner advances. The current lesson uses fraction-state conditions; `action_performed` is available for any future lesson that wants to coach a specific gesture explicitly.

### Node types

- **message**: Tutor speaks the scripted `message`. A "Continue" button taps to the next node.
- **prompt**: Tutor speaks and shows response buttons; the student's choice picks the next node.
- **wait_for_action**: Tutor watches either bars (`fraction_equals`) or dispatched actions (`action_performed`) and advances on match. A scripted `hint` can fire after `hintDelay` seconds; if `llmFallthrough` is true, a contextual LLM hint fires another 15 s after that.
- **check**: Assessment with `isCorrect` flags on options; correct vs. known-incorrect routes to separate scripted branches.

### Lesson registry

Lessons live under `src/tutor/lessons/`. Each lesson is a JSON content file plus a TS wrapper that supplies its step-counter config. A registry binds the two and exposes a manifest that the host app picks from by id.

```
lessons/
├── equivalence.json     # Lesson content (one self-contained script)
├── equivalence.ts       # Wrapper: lesson + totalSteps + getStepForNode
└── index.ts             # LESSONS[], getLesson(id), getDefaultLesson()
```

**Lesson manifest**:

```typescript
type LessonManifest = {
  id: string;
  title: string;          // Splash title
  description: string;    // Splash subtitle
  lesson: Lesson;         // The script
  totalSteps: number;     // Progress indicator denominator
  getStepForNode: (nodeId: string) => number;
};
```

**Step counter.** The mapping from node id to step number lives next to each lesson's content in its TS wrapper. The runner takes `totalSteps` and `getStepForNode` as options and stays generic — no equivalence-specific prefix matching inside it.

**Adding a new fraction lesson:**

1. Author `my-lesson.json` (any LessonNode shape).
2. Author `my-lesson.ts` exporting `myLesson`, `myLessonTotalSteps`, `myLessonStep(nodeId)`.
3. Add a `LessonManifest` entry to `LESSONS` in `index.ts`.

The engine and runner need no changes. Lessons can teach gesture vocabulary in-context by interleaving short `message` nodes that explain the next move with `wait_for_action` nodes that watch for the resulting bar state — no separate walkthrough scaffolding required.

### LLM safety net

`src/tutor/llmSafetyNet.ts` exposes `handleUnrecognizedState(bars, taskDescription)` (Claude Haiku via the Worker proxy). `lessonRunner` schedules a second-chance hint 15 s after the scripted hint for any `wait_for_action` node that has `llmFallthrough: true` AND a proxy URL is configured. The LLM gets the live bar state and the node's prompt; its response is injected as a new tutor message and spoken like any other line.

- **Without a proxy URL** (`VITE_TUTOR_API_URL` unset), `isLlmConfigured()` returns false and the timer is never scheduled — the lesson runs entirely on the scripted script.
- **On timeout / failure**, the proxy or `handleUnrecognizedState` returns a generic scripted fallback (`"Hmm, that's not quite what we're looking for…"`) so the student never sees an error.
- **Misconception classification** and **unrecognized-state redirects** (the other two LLM cases from the original architecture) are not wired yet; the current script's known-wrong branches handle wrong answers.

## Layer 3: Voice Layer

`src/voice/elevenLabsVoice.ts` calls the Worker's **`POST /tts`** endpoint instead of ElevenLabs directly. The proxy holds `ELEVENLABS_API_KEY` as a Cloudflare secret and streams `audio/mpeg` back; the browser plays it through an `<audio>` element. `src/voice/useTutorVoice.ts` watches `lessonState.messages`, picks the latest *tutor* message, and speaks it — cancelling any in-flight playback so the chat never overlaps itself.

Configuration:

- `VITE_TUTOR_API_URL` — the proxy URL (also gates `isVoiceConfigured()`)
- `VITE_ELEVENLABS_VOICE_ID` — voice id; the worker has a default if unset
- Worker model: `eleven_flash_v2_5` (low latency)

**Fraction pronunciation.** Before the request goes out, `toSpokenFractions` rewrites every `X/Y` pattern as `"X over Y"` (e.g., `"1/2"` → `"one over two"`). The chat bubble keeps the compact `1/2` display.

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

The toolbar is gone; gestures drive everything. While a `wait_for_action` node with an `action_performed` condition is active, only the expected gesture has any effect; everything else silently no-ops. On any other node (including `fraction_equals` waits) gestures are unrestricted.

| Gesture | Action |
|---|---|
| Tap a segment | `SHADE` |
| Double-tap a segment | `SPLIT` |
| Long-press a segment (~½ s, orange charge glow) | `REMOVE_SEGMENT` (blocked when the bar has only one segment) |
| Drag a segment | Free-floating move — saved as the segment's `x`, `y` |
| Drop a dragged segment on an adjacent same-shade neighbor | `COMBINE` |
| Double-tap empty workspace | `ADD_BAR` (color cycles teal → blue → coral → purple) |

### Touch targets

All interactive elements are minimum 48×48 px for child-friendly touch input. Fraction segments are 100 px tall and stretch to fill the workspace width. Response buttons in the tutor sidebar are full-width, ≥ 56 px tall.

### Animations

- **Split / Shatter**: framer-motion `layoutId` interpolates the new segments from the original position.
- **Shade**: Background color fades over 200 ms (CSS transition).
- **Combine**: The merged-away segment unmounts; the survivor's `layoutId` animates to the wider slot.
- **Free move**: `useMotionValue` follows the pointer during drag; releases spring to either the new position (if free move) or back to home (if a combine fires).
- **Equivalence reveal**: When two bars share a fraction, a teal "= Same amount!" badge fades in.

## Proxy (Cloudflare Worker)

`proxy/src/index.ts` is a small Worker with two routes:

| Route | Body | Response | Upstream |
|---|---|---|---|
| `POST /tutor` | `{ system, user }` | `{ text }` | Anthropic Messages API (Claude Haiku, max 160 tokens) |
| `POST /tts` | `{ text, voiceId? }` | `audio/mpeg` stream | ElevenLabs TTS (`eleven_flash_v2_5`) |

Secrets (Cloudflare `wrangler secret put`):
- `ANTHROPIC_API_KEY`
- `ELEVENLABS_API_KEY`

CORS is wildcard for now — fine for the demo, should be locked to the Pages origin before production. No rate limiting yet; a per-IP cap via Workers KV or Durable Objects is the natural next step.

## Data flow

```
Student taps / drags / holds a segment, or double-taps empty space
  → Segment / Workspace fires the matching handler
  → LessonShell:
      ├── (a) if the current node has an action_performed condition,
      │       no-ops unless the gesture matches the expected action
      ├── (b) dispatches the corresponding reducer action
      └── (c) calls runner.notifyAction(actionType)
  → Reducer updates bars
  → Two runner effects react:
      ├── bars change → if current node is wait_for_action with
      │   `fraction_equals`, advance after 600 ms if satisfied
      └── notifyAction(actionType) → if current node is wait_for_action
          with `action_performed` matching that action, advance after 400 ms
  → Tutor message updates
  → useTutorVoice fetches audio from the proxy and plays it
  → UI re-renders
```

If `wait_for_action` has `llmFallthrough: true`, a third timer is scheduled at `(hintDelay + 15) s`. When it fires, the runner calls the proxy's `/tutor` endpoint with the live bars and the node's prompt; the response is injected as a new tutor message.

Button taps in the tutor panel (Continue, option) call the runner's `advance` / `selectOption` directly — they bypass the action-notify path.

## Deployment

- **Frontend**: Cloudflare Pages.
  - URL: `https://fraction-tutor-1l1.pages.dev`
  - Build: `npm run build` in `fraction-tutor/` → `dist/`
  - Deploy: `npx wrangler pages deploy fraction-tutor/dist --project-name=fraction-tutor`
- **Proxy**: Cloudflare Workers.
  - URL: `https://fraction-tutor-proxy.heila-shahidi.workers.dev`
  - Deploy: `cd proxy && npx wrangler deploy`
  - Secrets: `npx wrangler secret put ANTHROPIC_API_KEY` / `... ELEVENLABS_API_KEY`

The frontend reads `VITE_TUTOR_API_URL` at build time and bakes the URL into the bundle. Switching environments (local dev vs. production) is a one-line `.env` change followed by `npm run build && wrangler pages deploy`.

## Offline behavior

The script and all UI logic are bundled and run client-side; the page itself works offline once cached. The voice layer and LLM safety net both require the proxy, so without a network the tutor's lines won't be spoken and the LLM hint never fires — but the lesson still progresses on Continue / option taps, gesture detection still works, and progress feedback (chat, equivalence indicator) is unaffected. Lesson progress could be persisted locally (e.g., via Capacitor Preferences) once iPad packaging is added.
