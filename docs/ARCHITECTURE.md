# Architecture

## Overview

The Fraction Equivalence Tutor is a four-layer system: a manipulative engine that owns bar and circle state, a tutor layer that drives the lesson from a JSON script, a voice layer that speaks tutor messages aloud, and a UI layer that renders and captures input. Lessons are pluggable data + a small TS wrapper; the engine and runner are content-agnostic. ElevenLabs is reached through a Cloudflare Worker proxy so the API key never lands in the public client bundle.

```
┌──────────────────────────────────────────────────────┐
│                      UI Layer                         │
│ FractionWorkspace │ TutorPanel │ ProgressIndicator    │
│  FractionBar / FractionCircle / Segment │ Splash      │
├───────────────────┴────────────┴─────────────────────┤
│                Lesson Shell (wiring)                  │
├──────────────────────┬──────────────┬─────────────────┤
│  Manipulative Engine │ Tutor Layer  │ Voice Layer     │
│  (useReducer)        │ (useLessonRunner)│ (useTutorVoice)│
│                      │              │                 │
│  - Bars + circles    │ - JSON script│ - Calls proxy   │
│  - Split, shade,     │ - Step graph │   /tts          │
│    combine, smash,   │ - Conditions │ - Mute toggle   │
│    add bar/circle    │ - Hint timers│                 │
└──────────────────────┴──────┬───────┴────────┬────────┘
         ▲                    ▼                ▼
         └── dispatches ──────┴── Worker proxy ┘
                                  (POST /tts)
```

## Layer 1: Manipulative Engine

The engine is a `useReducer` that manages two arrays — `bars` and `circles`. Bars are ordered lists of segments with a shaded/unshaded flag and an optional free-movement offset. Circles are simpler: a slice count and a shaded-slice count.

### State shape

```typescript
type BarColor = "teal" | "blue" | "coral" | "purple";

type Segment = {
  id: string;
  shaded: boolean;
  x?: number;  // free-movement offset
  y?: number;
};

type FractionBar = {
  id: string;
  segments: Segment[];
  color: BarColor;
};

type FractionCircle = {
  id: string;
  slices: number;
  shaded: number;       // number of wedges colored from 12 o'clock CW
  color: BarColor;
};

type ManipulativeState = {
  bars: FractionBar[];
  circles: FractionCircle[];
  selectedBarId: string | null;
  selectedSegmentId: string | null;
};
```

### Actions

| Action | Effect |
|---|---|
| `SPLIT(barId, segmentId)` | Divides one segment into two equal segments. Both inherit shaded state. |
| `SHADE(barId, segmentId)` | Tap on unshaded ⇒ shaded count goes up by 1; tap on shaded ⇒ count goes down by 1. `normalizeBars` packs the shaded count to the left so the visual is always contiguous-from-left. |
| `COMBINE(barId, segmentId)` | Merges a segment with its right neighbor (both must share shade). |
| `SHATTER(barId, segmentId, count)` | Replaces one segment with N equal pieces. (Defined but not currently used by the script.) |
| `MOVE_SEGMENT(barId, segmentId, x, y)` | Saves a free-floating position offset. |
| `REMOVE_SEGMENT(barId, segmentId)` | Removes a single segment (falls back when SMASH isn't allowed). |
| `ADD_BAR(color)` | Appends a new bar with 1 unshaded segment. |
| `ADD_CIRCLE(color)` | Appends a new circle (1 slice, 0 shaded). |
| `SPLIT_CIRCLE(circleId)` | Slice count `+= 1`. |
| `SHADE_CIRCLE(circleId)` | Shaded count cycles `0 → 1 → … → slices → 0`. |
| `SMASH(targetType, id)` | Removes a whole bar OR circle (used by the playground). |
| `RESET` | Clears everything. |
| `SET_STATE(bars, circles)` | Replaces both arrays (used by lesson `setup`). |
| `SELECT` / `DESELECT` | Tracks a selected segment (legacy; current UI is gesture-driven). |

The reducer is wrapped by `normalizeBars` — a safety net that re-packs each bar's shaded count to the left after every action. Even if a path through the code produces non-contiguous shading, the visual result stays contiguous.

### Why useReducer over useState

Split, combine, and shatter have non-trivial logic (inserting / removing segments at specific indices, preserving shaded state, snapping positions). Multiple actions can be dispatched in sequence when the tutor sets up a problem. A reducer keeps this deterministic and testable outside React.

### ID generation

`makeBarId` / `makeSegmentId` / `makeCircleId` use monotonically-increasing counters that are **not** reset between setups. Earlier code reset the counters on `SET_STATE`, which caused new bars/segments to collide with old IDs still in React's reconciliation tree — producing mixed-color and duplicate-numbered segments across a setup boundary. Counters now keep growing so each setup gets fresh globally-unique IDs.

## Layer 2: Tutor Layer

The tutor is script-only. Every line of dialogue and every branching decision is authored by a human and stored in JSON. There is no LLM in the current build — the lesson runs entirely on the scripted script. (An earlier version had a Claude-based safety net for unrecognized states; it was removed.)

### State machine

Each lesson is a JSON file with nodes. The runner tracks the current node and transitions on student actions or button taps.

```typescript
type LessonNode = {
  id: string;
  type: "message" | "prompt" | "wait_for_action" | "check";
  next?: string;            // auto-advance for message nodes

  message: string;          // tutor dialogue (also fed to TTS)

  // prompt / check
  options?: { label: string; next: string; isCorrect?: boolean }[];

  // wait_for_action
  condition?: LessonCondition;
  onMet?: string;
  hint?: string;
  hintDelay?: number;       // seconds, default 15

  // Restrict which gestures are accepted on this node. Inferred from
  // the condition when omitted (e.g. action_performed → just that
  // action; fraction_equals/exact → all gestures open).
  allowedActions?: TutorialActionTrigger[];

  // Hide bar labels on this node so the visible "X/Y" doesn't spoil
  // the answer on the cut question.
  hideFractionLabels?: boolean;

  // Defer the setup dispatch until the spoken line is mostly done.
  // Either: wait for voice end + 400ms padding (setupAfterMessage),
  // or fire after a fixed delay regardless (setupDelayMs).
  setupAfterMessage?: boolean;
  setupDelayMs?: number;

  setup?: {
    bars?: Array<{ segments: number; shaded: number; color: BarColor }>;
    circles?: Array<{ slices: number; shaded: number; color: BarColor }>;
  };
};
```

`LessonCondition` is a discriminated union:

```typescript
type LessonCondition =
  | { type: "fraction_equals"; barIndex?: number; circleIndex?: number; target: Fraction }
  | { type: "fraction_exact";  barIndex?: number; circleIndex?: number; target: Fraction }
  | { type: "screen_clear" }
  | { type: "action_performed"; action: TutorialActionTrigger };
```

- **`fraction_equals`** uses cross-multiplication (`a*d === b*c`), so `1/2` matches `2/4`, `3/6`, etc.
- **`fraction_exact`** requires the exact numerator/denominator pair. Used when the lesson narrative depends on a specific cut count (e.g., "make exactly 2/4" should not fire on 1/2).
- **`screen_clear`** fires when both `bars` and `circles` are empty — used by the playground's smash-everything finale.
- **`action_performed`** fires on a specific gesture (`ADD_BAR`, `ADD_CIRCLE`, `SHADE`, `SPLIT`, `COMBINE`, `MOVE_SEGMENT`, `REMOVE_SEGMENT`, `SMASH`).

`fraction_equals` / `fraction_exact` / `screen_clear` are state-driven — a `useEffect` on `bars + circles` calls `checkCondition` after every change; when met, the lesson advances after a 600 ms grace delay so the student sees their action land. `action_performed` is event-driven via `notifyAction`.

### isAdvancing lock

Once a wait condition fires, the runner sets `isAdvancing = true` and schedules the 400–600 ms advance. While `isAdvancing` is true, `allowedActions` is forced to the empty set in `LessonShell` so post-success taps can't shade extra pieces during the celebratory pause. The flag clears when the new node lands.

### setupDelayMs catch-up

When the student advances away from a node whose `setupDelayMs` timer hasn't fired yet, the runner applies the queued setup *immediately* (catch-up) before processing the new node. Without this, the bar state would lag behind the narration if the student clicks Continue faster than the delay.

### Lesson registry

Lessons live under `src/tutor/lessons/`. Each lesson is a JSON content file plus a TS wrapper that supplies its step-counter config. A registry exposes a manifest the host app picks from by id.

```typescript
type LessonManifest = {
  id: string;
  title: string;
  description: string;
  lesson: Lesson;
  totalSteps: number;
  getStepForNode: (nodeId: string) => number;
};
```

The current lesson maps node-id prefixes to 8 steps (`hook_/define_` → 1, `shade_/cut_` → 2, `split_/equiv_/build_bridge` → 3, `challenge_2_/pattern_` → 4, `non_example_` → 5, `circle_` → 6, `play_` → 7, `complete` → 8).

## Layer 3: Voice Layer

`src/voice/elevenLabsVoice.ts` calls the Worker's **`POST /tts`** endpoint instead of ElevenLabs directly. The proxy holds `ELEVENLABS_API_KEY` as a Cloudflare secret and streams `audio/mpeg` back; the browser plays it through an `<audio>` element.

`src/voice/useTutorVoice.ts` watches `lessonState.messages`, picks the latest tutor message, and speaks it — cancelling any in-flight playback so the chat never overlaps itself. It uses `useLayoutEffect` (not `useEffect`) so `isSpeaking` flips to `true` before the browser paints, eliminating the first-load flash of the Continue button.

Configuration:

- `VITE_TUTOR_API_URL` — the proxy URL (also gates `isVoiceConfigured()`)
- `VITE_ELEVENLABS_VOICE_ID` — voice id; the worker has a default if unset
- Worker model: `eleven_flash_v2_5` (low latency)

**Fraction pronunciation.** Before each request, `toSpokenFractions` rewrites every `X/Y` pattern as `"X over Y"` (so `1/2` → `"one over two"`). The on-screen label keeps the compact `1/2` display.

**Continue button hold.** The Continue button stays hidden until *both*: voice has finished speaking AND at least 1.5 s has passed since the message arrived. So the button never flashes immediately, and muted / no-proxy users still get a brief reading window before they can advance.

**Browser autoplay.** Browsers block audio until the user has clicked once. The `Splash` start screen exists primarily to capture that first gesture before `LessonShell` mounts. The `started` flag is persisted in `sessionStorage` so a Vite dev reload doesn't bounce the student back to splash.

## Layer 4: UI Layer

The UI receives state, dispatches gestures, and makes no pedagogical decisions.

### Layout

```
┌──────────────────────────────────────────────────┐
│  Fraction explorer       🔊  STEP 3 OF 8  [━━━━] │
├──────────────────────────────────────────────────┤
│                                                  │
│  1/2  [████████████░░░░░░░░░░░░]                │
│                                  ✦ LILA          │
│  2/4  [██████░░│██████░░░░░░░░░]   Look at these │
│                                    bars …        │
│                                                  │
│                                  [ option 1 ]    │
│                                  [ option 2 ]    │
└──────────────────────────────────────────────────┘
```

A grid background fills the page. The header shows the lesson title, mute toggle, a "STEP N OF 8" caption, and a gradient progress bar. The workspace (left, flex-grow) holds bars stacked vertically and circles below them. The tutor sidebar (right) shows the latest message under a "LILA" label and any option / Continue buttons.

### Gesture model

The toolbar is gone; gestures drive everything. While a `wait_for_action` node is active, gestures outside its `allowedActions` silently no-op.

| Gesture | Action |
|---|---|
| Tap a segment | `SHADE` |
| Double-tap a segment | `SPLIT` |
| Long-press a segment | `SMASH` (whole bar) if allowed; otherwise `REMOVE_SEGMENT` |
| Drag a segment, drop on adjacent same-shade neighbor | `COMBINE` |
| Drag a segment elsewhere | Free-floating move; saved as `x, y` on the segment |
| Tap a circle | `SHADE_CIRCLE` |
| Double-tap a circle | `SPLIT_CIRCLE` |
| Long-press a circle | `SMASH` (whole circle) |
| Double-tap empty workspace | `ADD_BAR` (default) or `ADD_CIRCLE` (when only ADD_CIRCLE is allowed) |

The empty-area double-tap listens to both the native `dblclick` (mouse) and a 500 ms timestamp window on `click` (touch), with a 250 ms dedupe guard so a single mouse gesture doesn't fire both paths.

`DOUBLE_TAP_MS` in `Segment` is 280 ms — short enough that two quick single-taps don't look like one tap colored two blocks.

### Visual feedback

- **Empty bars are colored.** A bar with 0 shaded pieces still shows its identity via a low-alpha tinted border + faint background wash matching `bar.color` — so "the blue bar" is recognizable before any pieces are colored.
- **Bar pulse on cut.** Each time a bar gains a new segment, the bar div briefly pulses with a lavender ring.
- **Smash charge.** When the student long-presses a segment while `SMASH` is allowed, a CSS `:has([data-holding="true"])` selector on the bar wrapper triggers an orange "barCharge" animation across the *whole* bar — making clear that the whole bar will disappear, not just the held piece.
- **Sparkle.** The Splash and Lila avatar share an animated gradient sparkle (`✦`).

### Touch targets and font

All interactive elements are minimum 48 × 48 px. Fraction segments are 100 px tall. Body font is Nunito (400–900 weights, loaded from Google Fonts in `index.html`).

## Proxy (Cloudflare Worker)

`proxy/src/index.ts` is a small Worker exposing one route:

| Route | Body | Response | Upstream |
|---|---|---|---|
| `POST /tts` | `{ text, voiceId? }` | `audio/mpeg` stream | ElevenLabs TTS (`eleven_flash_v2_5`) |

Secrets (via `wrangler secret put`):
- `ELEVENLABS_API_KEY`

CORS is wildcard — fine for the demo; lock to the Pages origin before production.

## Data flow

```
Student gesture
  → Segment / FractionCircle / FractionWorkspace fires the handler
  → LessonShell:
      ├── if node forbids this gesture or isAdvancing is true → no-op
      ├── dispatches the corresponding reducer action
      └── calls runner.notifyAction(actionType)
  → Reducer updates bars/circles → normalizeBars packs shaded to the left
  → Two runner effects react:
      ├── bars/circles change → fraction_equals / fraction_exact /
      │   screen_clear conditions → advance after 600 ms if met
      └── notifyAction(actionType) → action_performed condition →
          advance after 400 ms
  → New tutor message lands in state
  → useTutorVoice fetches audio from the proxy and plays it
  → TutorPanel re-renders; Continue gated on isSpeaking AND 1.5s hold
```

Button taps in the tutor panel (Continue, option) call the runner's `advance` / `selectOption` directly — they bypass the action-notify path.

## Deployment

- **Frontend**: Cloudflare Pages.
  - URL: `https://fraction-tutor-1l1.pages.dev`
  - Build: `npm run build` in `fraction-tutor/` → `dist/`
  - Deploy: `npx wrangler pages deploy fraction-tutor/dist --project-name=fraction-tutor --commit-dirty=true`
- **Proxy**: Cloudflare Workers.
  - URL: `https://fraction-tutor-proxy.heila-shahidi.workers.dev`
  - Deploy: `cd proxy && npx wrangler deploy`
  - Secrets: `npx wrangler secret put ELEVENLABS_API_KEY`

The frontend reads `VITE_TUTOR_API_URL` at build time and bakes the URL into the bundle. Switching environments (local dev vs. production) is a one-line `.env` change followed by rebuild + redeploy.

Git remotes use a single `origin` with two push URLs (GitHub + GitLab), so `git push origin main` fans out to both.

## Offline behavior

Script and all UI logic are bundled and run client-side; the page works offline once cached. The voice layer requires the proxy — without a network, the tutor's lines aren't spoken but the lesson still progresses normally on Continue / option taps.
