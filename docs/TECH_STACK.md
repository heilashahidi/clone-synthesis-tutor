# Tech Stack

## Core Application

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Language | TypeScript | 6.x | Type safety for fraction state, lesson schemas, voice API contracts |
| UI Framework | React | 19.x | Component model, state via useReducer + hooks |
| Build Tool | Vite | 8.x | Fast HMR during dev; hashed, tree-shaken production bundles |

The app ships as a single-page web app deployed to Cloudflare Pages. Native iPad packaging (Capacitor) is a possible next step but not part of the current build.

## UI and Interaction

| Library | Purpose | Why this over alternatives |
|---------|---------|---------------------------|
| framer-motion | Drag handling, `whileTap` press feedback, motion values, layout animations | Built-in drag with pointer/touch parity, `useMotionValue` for spring-back animations on rejected drags, `whileTap` for instant scale-down feedback. Replaces having to hand-roll pointer event tracking. |
| CSS Modules | Scoped component styles | No runtime cost, no class name collisions. Pairs with a few global CSS files for body / fonts / grid background. |
| Google Fonts (Nunito) | Body font, weights 400–900 | Rounded geometric sans-serif that reads well for kids and stays legible at small sizes. Loaded from `fonts.googleapis.com` via `<link>` in `index.html`. |

`:has()` is used in `FractionBar.module.css` to animate the whole bar when any child segment has `data-holding="true"` (smash charge animation). Supported in all modern browsers since 2023.

## Tutor

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Lesson Script | JSON state machine | The entire tutor voice. Every line of dialogue, every branch, every hint — authored by a human and stored as nodes in `equivalence.json`. Readable and editable by curriculum designers without touching code. |

No LLM is wired into the current build. An earlier version had a Claude Haiku safety net for unrecognized manipulative states; it was removed when the script grew comprehensive enough to cover the lesson surface without it. The `llmFallthrough` flag still appears on a few wait nodes in the JSON but is currently inert.

## Voice

| Component | Technology | Purpose |
|-----------|-----------|---------|
| TTS provider | ElevenLabs (`eleven_flash_v2_5`) | Low-latency synthesis. The Cloudflare Worker proxy holds the API key; the browser only sees the proxy URL. |
| Voice proxy | Cloudflare Worker | `POST /tts` accepts `{ text, voiceId? }` and streams `audio/mpeg`. Holds `ELEVENLABS_API_KEY` as a Cloudflare secret. |
| Audio playback | HTML `<audio>` element | The Worker streams MPEG bytes back, the browser plays them. Mute / autoplay-block / proxy-down all fall through gracefully to "voice has ended" so the UI never strands. |

The Splash "Start" button exists primarily to capture the user gesture browsers require before they'll allow audio playback.

## Development Tooling

| Tool | Status | Purpose |
|------|--------|---------|
| ESLint | Installed | Code linting via `npm run lint`. |
| `tsc -p tsconfig.app.json` | Installed | Type check (`npx tsc --noEmit -p tsconfig.app.json`). Vite uses esbuild for builds, so type errors only surface via tsc. |
| Vitest | Add later | Unit tests for the fraction reducer (split, shade, combine, smash, circle ops) and lesson runner transitions. |
| Playwright | Add later | E2E tests for lesson flow. Simulates gestures, choosing responses, walking the lesson to completion. |

## Deployment

| Concern | Approach |
|---------|----------|
| Frontend | Cloudflare Pages. `npm run build` → `npx wrangler pages deploy dist --project-name=fraction-tutor --commit-dirty=true`. |
| Voice proxy | Cloudflare Workers. `cd proxy && npx wrangler deploy`. ELEVENLABS_API_KEY set via `wrangler secret put`. |
| Git | A single `origin` remote with two push URLs (GitHub + GitLab) so one `git push origin main` updates both hosts. |

## Why Not...

| Alternative | Reason for exclusion |
|-------------|----------------------|
| Next.js / Remix | Single-page, single-lesson app with no routing, no SSR, no SEO needs. Vite + React is the minimal correct choice. |
| Redux / Zustand | One reducer (fraction state) and one custom hook (lesson runner). React's built-in `useReducer` + hooks handle it. |
| Canvas / SVG for bars | Fraction bars are axis-aligned rectangles. CSS flexbox renders them natively with zero hit-detection code. |
| SVG-only for circles | Circles ARE SVG — wedge paths drawn with `M / L / A` commands. Hit detection on the wedge SVG element fires React pointer events directly. |
| Tailwind CSS | The manipulative wants precise pixel control over segment sizing, borders, and animation coordination. CSS Modules give that without fighting utility class abstractions. |
| React Native | A web app deploys to every screen size with one codebase. React Native would require a parallel component set, different gesture handling, and different animation primitives — only worth it for deep native integration the app doesn't need. |
| LLM-driven tutoring | The script covers the lesson surface comprehensively (~100 nodes). Adding an LLM trades determinism, accessibility, and offline-friendliness for marginal flexibility. The earlier safety-net version was removed. |
| Firebase / Supabase | No user accounts, no shared data, no real-time sync. Lesson progress is browser-local (sessionStorage). |
