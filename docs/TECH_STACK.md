# Tech Stack

## Core Application

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Language | TypeScript | 5.x | Type safety for fraction state, lesson schemas, API contracts |
| UI Framework | React | 18.x | Component model, state management via useReducer, hooks |
| Build Tool | Vite | 5.x | Fast HMR during development, optimized production builds |
| Native Shell | Capacitor | 6.x | Wraps the web app as a native iPad app for App Store distribution |

## UI and Interaction

| Library | Purpose | Why this over alternatives |
|---------|---------|---------------------------|
| framer-motion | Split/combine/shade animations, layout transitions | `layoutId` handles the fraction split animation natively — segments redistribute within a flex container and framer interpolates position. CSS transitions can't do layout-driven animation. |
| @use-gesture/react | Touch gesture recognition (tap, drag, pinch) | Composable gesture hooks that work with framer-motion. Pointer Events API would work for taps but drag-to-combine and pinch-to-split need velocity, direction, and threshold logic that this library handles cleanly. |
| CSS Modules | Scoped component styles | No runtime cost, no class name collisions. Tailwind is viable but the manipulative needs precise pixel control over segment sizing and border placement that utility classes make verbose. |

## Tutor and AI

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Lesson Script | JSON state machine | Primary tutor voice. All planned dialogue, hints, feedback, and branching logic is authored by a human and stored as JSON nodes. This is what the student hears 90% of the time. Readable and editable by curriculum designers without touching code. |
| LLM (safety net) | Claude Haiku (claude-haiku-4-5-20251001) | Handles edge cases the script can't anticipate: unrecognized manipulative states, misconception classification for unexpected wrong answers, and dynamic second-chance hints. Called only when no scripted branch matches. Sub-second latency, lowest cost in the Claude family. |
| API Proxy | Cloudflare Worker | Holds the Anthropic API key server-side. Rate limits requests. Adds a 2-second timeout — if the LLM doesn't respond in time, the app falls back to a generic scripted redirect. Single file deployment, no infrastructure to manage. |

## Capacitor Plugins

| Plugin | Purpose |
|--------|---------|
| @capacitor/haptics | Vibration feedback on split, combine, and correct-answer events. Reinforces physical interaction metaphor. |
| @capacitor/screen-orientation | Locks to landscape. Fraction bars need horizontal width for visual comparison. |
| @capacitor/status-bar | Hides the iOS status bar for full-screen immersion. |
| @capacitor/preferences | Local key-value storage for lesson progress persistence between sessions. |
| @capacitor/splash-screen | Custom launch screen while the web view initializes. |

## Development Tooling

| Tool | Purpose |
|------|---------|
| ESLint + Prettier | Code formatting and linting. Enforces consistent style across components. |
| Vitest | Unit tests for the fraction reducer (split, combine, shade logic) and lesson runner (state machine transitions). Fast, Vite-native. |
| Playwright | End-to-end tests for lesson flow. Simulates tapping segments, choosing responses, and verifying the tutor advances correctly. Runs headless in CI. |
| Storybook | Visual development of FractionBar and Segment components in isolation. Useful for tuning animations and testing different segment counts without running the full app. |

## Deployment

| Concern | Approach |
|---------|----------|
| iPad App | Capacitor builds an Xcode project. Archive and submit to App Store via Xcode or Fastlane. TestFlight for beta distribution. |
| API Proxy | Cloudflare Workers. Deploy with `wrangler deploy`. Free tier handles 100k requests/day, which covers thousands of lesson sessions. |
| CI/CD | GitHub Actions. On push: lint, test (Vitest + Playwright), build. On tag: Capacitor sync, Xcode archive, TestFlight upload via Fastlane. |

## Why Not...

| Alternative | Reason for exclusion |
|-------------|----------------------|
| Next.js / Remix | This is a single-page, single-lesson app with no routing, no SSR, no SEO needs. A meta-framework adds complexity with zero benefit. Vite + React is the minimal correct choice. |
| Redux / Zustand | The app has one reducer (fraction state) and one hook (lesson runner). React's built-in useReducer + useContext handles this without a third-party state library. |
| Canvas / SVG for bars | Fraction bars are axis-aligned rectangles. CSS flexbox renders them natively with zero hit-detection code. Canvas would require manual layout math and tap coordinate mapping. SVG is viable but adds DOM weight for something flex does trivially. |
| Tailwind CSS | Works well for content layouts but the manipulative requires precise control: exact pixel borders between segments, calculated flex ratios for unequal splits, animation-coordinated styles. CSS Modules give direct control without fighting utility class abstractions. |
| React Native | Capacitor lets you write standard React with standard CSS and deploy to iPad. React Native requires a different component set (View, Text, StyleSheet), different animation primitives (Animated, Reanimated), and different gesture handling (react-native-gesture-handler). The trade-off only pays off if you need deep native integration, which this app doesn't. |
| GPT-4o-mini | Claude Haiku is faster for this use case and the Anthropic API has simpler streaming semantics. Either model would work — the safety-net task (short redirects and single-tag classification) is simple enough that model choice is a cost/latency decision, not a capability one. |
| No LLM (pure script) | Viable — the app works fully without the LLM using scripted dialogue alone. But a pure script can't handle every possible manipulative state a student might create. Without the LLM safety net, unrecognized actions fall through to a generic "try again" message, which feels robotic after the second time. The LLM also enables misconception classification without hand-coding every possible error pattern. Cost is negligible (a few LLM calls per session at fractions of a cent each). |
| Firebase / Supabase | No user accounts, no shared data, no real-time sync needed. Lesson progress is local (Capacitor Preferences). Adding a backend database is premature for a single-lesson app. |
