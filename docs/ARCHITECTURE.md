# Architecture

## Overview

The Fraction Equivalence Tutor is a three-layer system: a manipulative engine that owns fraction state, a tutor layer that drives the lesson, and a UI layer that renders and captures input. These layers communicate through React state but have strict boundaries — the tutor can read and write manipulative state, but the UI only renders and forwards events.

```
┌─────────────────────────────────────────────────┐
│                   UI Layer                       │
│  FractionWorkspace  │  TutorPanel  │  Controls   │
├─────────────────────┴──────────────┴─────────────┤
│               Lesson Shell (wiring)              │
├──────────────────────┬───────────────────────────┤
│  Manipulative Engine │      Tutor Layer          │
│  (useReducer)        │  (useLessonRunner hook)   │
│                      │                           │
│  - Bar state         │  - JSON state machine     │
│  - Split / Shade /   │  - Scripted dialogue       │
│    Combine / Reset   │  - LLM safety net          │
│                      │    (edge cases only)       │
└──────────────────────┴───────────────────────────┘
         ▲                        │
         │    reads state /       │
         └── dispatches actions ──┘
```

## Layer 1: Manipulative Engine

The engine is a `useReducer` that manages an array of fraction bars. Each bar is an ordered list of segments with a shaded/unshaded state.

### State shape

```typescript
type Segment = {
  id: string;
  shaded: boolean;
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
| `SPLIT(barId, segmentId)` | Divides one segment into two equal segments | Shows partitioning without changing the whole |
| `SHADE(barId, segmentId)` | Toggles a segment's shaded state | Lets the student build a fraction by selecting parts |
| `COMBINE(barId, segmentId)` | Merges a segment with its right neighbor (both must be same shade state) | Shows that pieces can rejoin — inverse of splitting |
| `ADD_BAR(color)` | Appends a new bar with 1 unshaded segment | Creates a fresh bar for comparison |
| `RESET` | Clears all bars, returns to initial state | Lets the student start over |
| `SET_STATE(bars)` | Replaces entire state (used by tutor to set up problems) | Tutor can stage a specific configuration |

### Why useReducer over useState

The split action has non-trivial logic: splitting segment 2 of a 4-segment bar means inserting a new segment at index 2, reassigning IDs, and preserving shading on all other segments. Multiple actions can be dispatched in sequence when the tutor sets up a problem (SET_STATE then SHADE). A reducer keeps this deterministic and testable outside React.

## Layer 2: Tutor Layer

The tutor is script-first. Every planned moment in the lesson — dialogue, prompts, hints, feedback on correct and incorrect answers — is written by a human and stored in the lesson JSON. The script is the voice the student hears 90% of the time.

A lightweight LLM (Claude Haiku) acts as a safety net for the moments a script can't anticipate: unexpected manipulative states, unrecognized wrong answers, and dynamically generated hints that reference the student's specific bar configuration. The LLM never drives the lesson flow — it only speaks when the script has no path for what just happened.

### State machine

Each lesson is a JSON file with nodes. The runner tracks the current node and transitions based on student actions or responses.

```typescript
type LessonNode = {
  id: string;
  type: "message" | "prompt" | "wait_for_action" | "check";

  // Scripted dialogue (primary — always present)
  message: string;        // The exact tutor dialogue for this node

  // For prompts (student picks a response)
  options?: {
    label: string;
    next: string;         // Node ID to transition to
  }[];

  // For wait_for_action (tutor watches manipulative state)
  condition?: {
    type: "fraction_equals";
    barId: string;
    target: { numerator: number; denominator: number };
  };
  onMet: string;          // Node ID when condition is satisfied
  hint: string;           // Scripted hint shown after N seconds of no progress

  // For check (graded assessment)
  correctNext?: string;
  correctMessage: string;   // Scripted feedback for correct answer
  incorrectNext?: string;
  incorrectMessage: string; // Scripted feedback for known wrong answers

  // LLM fallthrough (only used when no scripted branch matches)
  llmFallthrough?: boolean; // If true, call LLM when student action doesn't match any branch
};
```

### Node types

- **message**: Tutor speaks the scripted `message`, then auto-advances to the next node. No LLM involved.
- **prompt**: Tutor speaks and presents response buttons. The student's choice determines the next node. All paths are scripted.
- **wait_for_action**: Tutor watches the manipulative state. When the student's bars match the `condition`, the lesson advances with the scripted message. If the student is stuck (no progress for 15 seconds), the scripted `hint` is shown.
- **check**: Tutor evaluates the student's answer. Correct and known-incorrect answers follow scripted branches. If the student's action doesn't match any known branch and `llmFallthrough` is true, the LLM is called.

### When the LLM is called

The LLM activates only in three situations:

**1. Unrecognized manipulative state.** The student creates a fraction the script doesn't have a branch for. For example, the script handles 2/4 (correct) and 1/4 (common error) but the student makes 3/5. The LLM receives the current bar state and generates a short, contextual redirect:

```
System: You are a warm, encouraging math tutor for a 9-year-old.
The student is learning fraction equivalence. The lesson script has
no branch for what the student just did. Gently redirect them back
to the task without giving the answer. Use 1-2 simple sentences.

User: The student was asked to make a fraction equal to 1/2.
They made a bar with 5 segments and shaded 3 (showing 3/5).
The first bar shows 1/2.
```

**2. Misconception classification.** When a student gives a wrong answer that doesn't match a known pattern, the LLM classifies the likely misconception so the state machine can branch to the right remediation path:

```
The student was asked to make a fraction equal to 1/2.
They created a bar with 3 segments and shaded 2.

Classify the likely misconception:
- WHOLE_NUMBER_THINKING (believes larger numbers = larger fractions)
- UNEQUAL_PARTITIONING (doesn't realize parts must be equal)
- ADDITIVE_REASONING (added 1 to numerator and denominator)
- OTHER

Respond with only the classification tag.
```

The returned tag maps to a scripted remediation branch. So even here, the LLM only classifies — the remediation dialogue is still scripted.

**3. Dynamic hints.** When the student is stuck and has already seen the scripted hint, the LLM generates a second hint that references the student's exact bar configuration ("You've got 3 pieces colored out of 6. Look at the first bar — can you see where the 3 colored pieces end?"). This only fires after the scripted hint has been shown and a further 15 seconds have passed.

### LLM call behavior

All LLM calls go through a proxy endpoint with a 2-second timeout. If the call fails or times out, the app falls back to a generic scripted message ("Try looking at the bars again. Do the colored parts line up?"). The student never sees a loading state or error. The LLM is invisible infrastructure — when it works, the tutor feels slightly more responsive to unusual situations. When it doesn't, the scripted lesson continues without interruption.

## Layer 3: UI Layer

The UI is a dumb rendering layer. It receives state and dispatches events. It makes no pedagogical decisions.

### Layout (iPad landscape)

```
┌──────────────────────────────────────────────────┐
│  Fraction explorer                    Step 2/5   │
├──────────────────────────────────────────────────┤
│                                                  │
│  1/2  [████████████░░░░░░░░░░░░]                │
│                                                  │
│  2/4  [██████░░░░░░│██████░░░░░░]               │
│                                                  │
│  (alignment line showing equivalence)            │
│                                                  │
├──────────────────────────────────────────────────┤
│  [Split] [Combine] [New bar] [Reset]             │
├──────────────────────────────────────────────────┤
│  🤖 Nice work! What do you notice about the      │
│     shaded parts?                                │
│                                                  │
│  [They're the same!]    [I'm not sure]           │
└──────────────────────────────────────────────────┘
```

The manipulative workspace occupies roughly 60% of the vertical space. The tutor panel sits at the bottom. Action buttons live between them. This prioritizes the visual comparison, which is where the learning happens.

### Touch targets

All interactive elements are minimum 48x48px for child-friendly touch input. Fraction segments stretch to fill available width, so they naturally exceed this minimum on iPad. Response buttons are full-width, 56px tall.

### Animations

- **Split**: The target segment's border appears at center and the two halves slide apart over 300ms (framer-motion `layoutId`)
- **Shade**: Background color fades in over 200ms (CSS transition)
- **Combine**: Two segments slide together, border dissolves over 300ms
- **Equivalence reveal**: When two bars are equivalent, a dotted alignment line animates between them from left to right

## Data flow

```
Student taps segment
  → UI dispatches SHADE(barId, segmentId)
  → Reducer updates state
  → LessonRunner checks if current node's condition is met
    → If yes: advances to next node, renders scripted message
    → If no match and llmFallthrough is enabled: calls LLM for redirect
    → If no match and no LLM: renders generic scripted fallback
    → If condition not yet met: does nothing (student keeps exploring)
  → UI re-renders with new bar state and any new tutor message
```

## API proxy

A single serverless function (Cloudflare Worker) sits between the app and the Anthropic API.

```
iPad App → HTTPS POST → Cloudflare Worker → Anthropic API
                         (holds API key)
                         (rate limits by session)
                         (returns response or timeout)
```

The proxy adds rate limiting (max 60 requests per session per hour) and strips any student data from logs. The only data sent to the LLM is the lesson context and manipulative state — never personal information.

## Offline behavior

The lesson is fully functional offline. All tutor dialogue, hints, feedback, and assessment prompts are scripted and bundled in the app. The LLM only supplements edge cases (unrecognized student actions, misconception classification, dynamic second-chance hints). When offline, these edge cases fall back to generic scripted redirects like "Try looking at the bars again. Do the colored parts line up?" The pedagogical experience is complete without any network connectivity. Lesson progress persists locally via Capacitor Preferences.
