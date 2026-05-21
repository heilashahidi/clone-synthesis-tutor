# Fraction Equivalence Tutor

A web app that teaches 9-year-olds fraction equivalence through interactive fraction bars, circles, and a scripted conversational tutor (Lila).

Students explore fractions by splitting, shading, smashing, and comparing rectangular bars and pie-style circles. When two shapes are lined up and the colored regions match, the equivalence is visible — no memorization required. A scripted tutor guides the student through the lesson with a warm, encouraging voice and ends with a freeform playground where the student builds their own equivalent fractions.

## Live URL

- **Production:** https://fraction-tutor-1l1.pages.dev

## How it works

The app presents fraction bars (and later, circles). The student uses gestures to manipulate them:

| Gesture | Effect |
|---|---|
| Single tap a piece | Color it / un-color it |
| Double-tap a piece | Split it into two halves |
| Long-press a piece | Smash the whole bar / circle (playground only) |
| Drag a piece onto its neighbor | Combine adjacent same-colored pieces |
| Double-tap empty space | Add a new bar (or circle, when the playground asks) |

A scripted tutor — voiced by an ElevenLabs TTS proxy — watches the student's actions and responds at key moments. When the student creates 2/4 on the second bar and it lines up with the 1/2 above, the tutor draws attention to the alignment. When the student picks a wrong answer, the tutor redirects based on the specific misconception (whole-number thinking, confusion about piece sizes). All dialogue is pre-written in `equivalence.json`.

The lesson follows an 8-step progression:

1. **Hook** — tutor shows 1/2 and 2/4 side by side and asks what the student notices.
2. **Color a whole, then watch a cut** — single-tap to color a 1/1 bar, then watch it cut into 2 equal pieces.
3. **First equivalence** — student cuts the second bar into 4 pieces and colors 2; sees 1/2 = 2/4.
4. **Second equivalence** — student builds an equivalent of 2/3 on a purple bar (any of 2/3, 4/6, 6/9, …).
5. **Non-example** — 1/2 vs 1/3: the colored portions don't line up.
6. **Circles** — same lessons re-stated with pie-style circles.
7. **Playground** — student adds their own bars and circles, builds equivalent fractions, and smashes them all at the end.
8. **Done!**

## Running locally

### Prerequisites

- Node.js 20+
- npm 10+
- An ElevenLabs API key (optional — without it the tutor still works, just without voice playback)

### Install and start

```bash
git clone <repo-url>
cd clone-synthesis-tutor/fraction-tutor

npm install
npm run dev
```

The app opens at `http://localhost:5173` (or the next free port).

### Environment variables

Create `fraction-tutor/.env`:

```
VITE_TUTOR_API_URL=https://fraction-tutor-proxy.heila-shahidi.workers.dev
```

The URL points at the Cloudflare Worker proxy that holds the ElevenLabs API key. If omitted, the app runs fully on scripted dialogue with no voice.

### Running the voice proxy locally

```bash
cd proxy

npm install
echo "ELEVENLABS_API_KEY=sk-..." > .dev.vars

npx wrangler dev
```

The proxy runs at `http://localhost:8787` and exposes `POST /tts`.

## Project structure

```
clone-synthesis-tutor/
├── fraction-tutor/                # The Vite + React app
│   ├── src/
│   │   ├── engine/
│   │   │   ├── types.ts           # All type definitions (FractionBar, Segment, FractionCircle, LessonNode, …)
│   │   │   ├── fractionReducer.ts # Bar/circle state machine (split, shade, combine, smash, add, …)
│   │   │   └── conditions.ts      # Checks if bars/circles match a target fraction or screen_clear
│   │   ├── tutor/
│   │   │   ├── lessonRunner.ts    # State machine hook (useLessonRunner)
│   │   │   └── lessons/
│   │   │       ├── equivalence.json # The full lesson script (~100 nodes incl. playground)
│   │   │       ├── equivalence.ts   # Wrapper: lesson + totalSteps + step-for-node mapping
│   │   │       └── index.ts         # Lesson registry
│   │   ├── components/
│   │   │   ├── App.tsx              # sessionStorage-gated splash → LessonShell
│   │   │   ├── Splash.tsx           # Start screen (also captures the gesture browsers require for audio)
│   │   │   ├── LessonShell.tsx      # Top-level layout, wires engine + tutor + UI + voice
│   │   │   ├── FractionWorkspace.tsx# Renders bars + circles, owns empty-area double-tap
│   │   │   ├── FractionBar.tsx      # Single bar (flex row of segments)
│   │   │   ├── FractionCircle.tsx   # Single circle (SVG wedges, interactive)
│   │   │   ├── Segment.tsx          # Single tappable piece (gestures, drag, long-press)
│   │   │   ├── TutorPanel.tsx       # Latest tutor message + Continue / option buttons
│   │   │   └── ProgressIndicator.tsx# Step X of 8 + gradient progress bar
│   │   ├── voice/
│   │   │   ├── elevenLabsVoice.ts   # Talks to the proxy's /tts endpoint
│   │   │   └── useTutorVoice.ts     # Plays each new tutor message, isSpeaking flag
│   │   ├── styles/                  # CSS Modules (one per component + global.css)
│   │   └── main.tsx
│   ├── index.html                   # Loads Nunito from Google Fonts
│   └── package.json
├── proxy/                           # Cloudflare Worker for ElevenLabs TTS
│   ├── src/index.ts
│   └── wrangler.toml
├── docs/
│   ├── ARCHITECTURE.md              # Engine, tutor, voice, deployment
│   └── TECH_STACK.md                # Library choices + rationale
└── README.md
```

## Lesson design

The lesson script (`fraction-tutor/src/tutor/lessons/equivalence.json`) defines a graph of nodes. Each node has a type:

- **message** — Tutor speaks a pre-written line. The student taps **Continue** to advance. Some message nodes include a `setup` field that configures the bars/circles for the next step.
- **prompt** — Tutor speaks and presents 2–3 tappable response buttons. Options are shuffled per visit so the correct answer isn't always first; "I'm not sure" / "I cannot tell" stay pinned to the bottom. The student's choice determines the next node.
- **wait_for_action** — Tutor watches the manipulative. When the student's state matches a target condition (e.g., bar 2 shows 2/4 shaded, or the screen is clear), the lesson advances. A scripted hint appears after a configurable timeout.
- **check** — Assessment node; same shape as `prompt` but used for quiz-style branches.

Condition types: `fraction_equals` (cross-multiplication match), `fraction_exact` (literal numerator/denominator), `action_performed` (student fires a specific gesture), `screen_clear` (no bars and no circles).

Per-node knobs added during UX tuning:

- `setupDelayMs` — defers the `setup` dispatch by N ms so the cut animation lands during the spoken line, not after.
- `setupAfterMessage` — defers the `setup` until voice finishes speaking (with fallback for muted users).
- `allowedActions` — explicitly restrict which gestures are accepted; defaults are inferred from the condition.
- `hideFractionLabels` — hides the "X/Y" label next to each bar so it doesn't give away the answer on the cut quiz.

## Testing

```bash
cd fraction-tutor
npx tsc --noEmit -p tsconfig.app.json   # type check
npm run build                            # production build
npm run dev                              # dev server with HMR
```

Unit and E2E tests are planned but not yet scaffolded.

## Deployment

### Frontend (Cloudflare Pages)

```bash
cd fraction-tutor
npm run build
npx wrangler pages deploy dist --project-name=fraction-tutor --commit-dirty=true
```

The deploy prints a deploy-specific URL (`<hash>.fraction-tutor-1l1.pages.dev`) plus updates the production `https://fraction-tutor-1l1.pages.dev`.

### Voice proxy (Cloudflare Workers)

```bash
cd proxy
npx wrangler secret put ELEVENLABS_API_KEY   # one-time
npx wrangler deploy
```

## Offline behavior

Script and all UI logic are bundled and run client-side; the page works offline once the bundle is cached. The voice layer requires the proxy — without a network, the tutor's lines aren't spoken but the lesson still progresses normally on Continue / option taps. `App.tsx` persists `started` in `sessionStorage` so a dev-server reload doesn't bounce the student back to the splash.

## License

[To be determined]
