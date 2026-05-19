# Fraction Equivalence Tutor

An iPad app that teaches 9-year-olds fraction equivalence through interactive fraction bars and a scripted conversational tutor.

Students explore fractions by splitting, shading, and comparing rectangular bars. When two bars are lined up and the shaded regions match, the equivalence is visible — no memorization required. A scripted tutor guides the student through the lesson with a warm, encouraging voice. A lightweight LLM (Claude Haiku) acts as a safety net for edge cases the script can't anticipate — unexpected student actions, misconception classification, and dynamic hints when the student is stuck beyond what the script covers.

## How it works

The app presents two stacked fraction bars of equal width. The student taps a segment to select it (highlighted with a blue outline), then uses the action buttons to manipulate it:

- **Color** toggles a selected segment between shaded and unshaded
- **Split** divides a selected segment into two equal pieces
- **Combine** merges a selected segment with its right neighbor (both must be the same shade)
- **Reset** restores the bars to the current step's starting configuration

Tapping the same segment twice also toggles its shade as a shortcut.

The scripted tutor watches the student's actions and responds at key moments. When the student creates 2/4 on the second bar and it lines up with the 1/2 above, the tutor draws attention to the alignment. When the student picks a wrong answer, the tutor redirects based on the specific misconception (whole-number thinking, confusion about piece sizes). All dialogue is pre-written in the lesson script. The LLM only activates when the student does something the script has no branch for.

The lesson follows a fixed 7-step progression:

1. Introduction — tutor explains the fraction bar, student explores tapping
2. Splitting — tutor demonstrates splitting into 2 pieces, introduces 1/2
3. Build 2/4 — student splits the second bar into 4 pieces, shades 2, sees alignment with 1/2
4. Generalize — repeat the equivalence discovery with 2/3 = 4/6
5. Non-example — student checks whether 1/2 = 1/3 (it doesn't line up)
6. Assessment — 3 quiz questions with increasing difficulty
7. Completion

## Running locally

### Prerequisites

- Node.js 20+
- npm 10+
- Xcode 15+ (only needed for iPad deployment)
- An Anthropic API key (optional — enables the LLM safety net for edge cases; the app is fully functional without it using scripted dialogue only)

### Install and start

```bash
git clone <repo-url>
cd fraction-tutor

npm install

# Start the dev server
npm run dev
```

The app opens at `http://localhost:5173`. Use Chrome DevTools device emulation set to iPad landscape (1194 x 834) for the intended layout.

### Environment variables

Create a `.env` file in the project root:

```
VITE_TUTOR_API_URL=http://localhost:8787
```

This points to the API proxy that holds your Anthropic key. See the proxy section below. If omitted, the app runs fully on scripted dialogue with no LLM calls.

### Running the API proxy locally

```bash
cd proxy

npm install

# Set your API key
echo "ANTHROPIC_API_KEY=sk-ant-..." > .dev.vars

# Start the local proxy
npx wrangler dev
```

The proxy runs at `http://localhost:8787` and forwards requests to the Anthropic API with your key attached.

### Building for iPad

```bash
# Install Capacitor (one-time)
npm install @capacitor/core @capacitor/cli
npx cap init fraction-tutor com.example.fractiontutor
npm install @capacitor/ios
npx cap add ios

# Build and sync
npm run build
npx cap sync ios

# Open in Xcode
npx cap open ios
```

In Xcode, select your iPad (or simulator), then Build and Run.

## Project structure

```
fraction-tutor/
├── src/
│   ├── engine/
│   │   ├── types.ts              # All type definitions (FractionBar, Segment, LessonNode, etc.)
│   │   ├── fractionReducer.ts    # Bar state and actions (split, shade, combine, select)
│   │   └── conditions.ts         # Checks if bars match a target fraction
│   ├── tutor/
│   │   ├── lessonRunner.ts       # State machine hook (useLessonRunner)
│   │   ├── llmSafetyNet.ts      # LLM edge case handler (unrecognized states, classification)
│   │   ├── tutorApi.ts           # Calls the proxy endpoint with 2s timeout
│   │   └── lessons/
│   │       └── equivalence.json  # Full lesson script (30+ nodes, all scripted dialogue)
│   ├── components/
│   │   ├── LessonShell.tsx       # Top-level layout, wires engine + tutor + UI
│   │   ├── FractionWorkspace.tsx # Renders all bars + equivalence indicator
│   │   ├── FractionBar.tsx       # Single bar (flex row of segments with fraction label)
│   │   ├── Segment.tsx           # Single tappable piece (framer-motion layoutId)
│   │   ├── ActionBar.tsx         # Color, Split, Combine, Reset buttons
│   │   ├── TutorPanel.tsx        # Chat bubbles and response buttons
│   │   └── ProgressIndicator.tsx # Step X of 7 display
│   ├── styles/                   # CSS Modules (one per component + global.css)
│   ├── App.tsx                   # Loads lesson JSON, renders LessonShell
│   └── main.tsx                  # React root
├── proxy/                        # Cloudflare Worker (not yet scaffolded)
│   ├── src/
│   │   └── index.ts
│   ├── wrangler.toml
│   └── package.json
├── ios/                          # Generated by Capacitor (not yet initialized)
├── vite.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── ARCHITECTURE.md
├── TECH_STACK.md
└── README.md
```

## Lesson design

The lesson script (`src/tutor/lessons/equivalence.json`) defines a sequence of nodes. Each node has a type:

- **message** — Tutor speaks a pre-written line. The student taps "Continue" to advance. Some message nodes include a `setup` field that configures the fraction bars for the next step.
- **prompt** — Tutor speaks and presents 2-3 tappable response buttons. The student's choice determines the next node. All paths are scripted with specific branches for correct answers, common misconceptions, and "I'm not sure."
- **wait_for_action** — Tutor watches the fraction bars. When the student's manipulative state matches a target condition (e.g., bar 2 shows 2/4 shaded), the lesson advances with scripted dialogue. A scripted hint appears after a configurable timeout (default 15 seconds). Nodes with `llmFallthrough: true` will call the LLM if the student creates a fraction the script doesn't cover.
- **check** — Assessment node. Presents multiple-choice options with `isCorrect` flags. Correct and incorrect answers follow separate scripted branches.

## Offline support

The entire lesson — all dialogue, hints, feedback, and assessment — is scripted and bundled in the app. The app is fully functional offline. The only difference without network connectivity is that the LLM safety net is unavailable, so unrecognized student actions fall through to a generic scripted redirect instead of a contextual LLM-generated response. Lesson progress persists locally via Capacitor Preferences (once Capacitor is added).

## Current status

What's built and working:
- Full engine layer (types, reducer, conditions)
- Complete lesson script with 30+ nodes covering the full pedagogical arc
- Lesson runner state machine with hint timers and condition checking
- All 7 UI components with CSS Modules
- LLM safety net module (wired but dormant without proxy)
- Clean TypeScript build, zero errors

What's planned but not yet added:
- Capacitor integration for iPad deployment
- Cloudflare Worker proxy for the LLM
- @use-gesture/react for drag-to-combine and pinch-to-split
- @capacitor/haptics for vibration feedback
- Vitest unit tests, Playwright E2E tests, Storybook

## Testing

```bash
# Type check
npx tsc --noEmit

# Build
npm run build

# Dev server
npm run dev
```

Unit tests (Vitest) and E2E tests (Playwright) are planned but not yet scaffolded.

## Deployment

### iPad (App Store / TestFlight)

```bash
npm run build
npx cap sync ios
# Open Xcode, archive, upload to App Store Connect
```

### API proxy (Cloudflare Workers)

```bash
cd proxy
npx wrangler deploy
```

Set the `ANTHROPIC_API_KEY` secret in the Cloudflare dashboard. The free tier supports 100k requests/day.

## License

[To be determined]
