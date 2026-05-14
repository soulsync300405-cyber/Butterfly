# SoulSync

AI-powered mental wellness companion app — culturally aware (Hinglish), clinically supervised, with gamified quests, EQ learning, and a full psychologist portal.

## Run & Operate

- `pnpm --filter @workspace/soulsync run dev` — run the frontend (port via `$PORT`)
- `pnpm --filter @workspace/soulsync run typecheck` — full typecheck
- `pnpm run typecheck` — full workspace typecheck

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite + Tailwind v4 + shadcn/ui
- Animations: Framer Motion
- Charts: Recharts
- State: Zustand (persisted to localStorage, key `soulsync_v1`)
- Routing: internal state machine (no URL router — single page)

## Where things live

- `artifacts/soulsync/src/App.tsx` — root screen router (landing → onboarding → student app / psych portal)
- `artifacts/soulsync/src/lib/store.ts` — Zustand store (UserProfile, Companion, Settings)
- `artifacts/soulsync/src/lib/data.ts` — all mock data (quests, courses, psychologists, patients, etc.)
- `artifacts/soulsync/src/pages/Landing.tsx` — role-select landing
- `artifacts/soulsync/src/pages/Onboarding.tsx` — 3-step onboarding with companion customization
- `artifacts/soulsync/src/pages/StudentApp.tsx` — main student app (Chat, Quests, EQ Learning, Psych, Analytics, Settings tabs) — all tabs inline in one file
- `artifacts/soulsync/src/pages/PsychLogin.tsx` — psychologist license verification
- `artifacts/soulsync/src/pages/PsychDashboard.tsx` — psychologist portal (Triage, Analytics, Reports, Notifications, Settings tabs)
- `artifacts/soulsync/src/components/AnimeAvatar.tsx` — animated SVG anime avatar (6 styles, 3 genders, speaking animation)
- `artifacts/soulsync/src/components/MusicPlayer.tsx` — Spotify-style player (playlist, volume, progress)
- `artifacts/soulsync/src/components/CallUI.tsx` — video/voice call UI with permission request flow
- `artifacts/soulsync/src/index.css` — full Tailwind theme (beige/green palette, Outfit + Syne fonts)

## Architecture decisions

- No backend — fully frontend with mocked/in-memory data
- Zustand persist keeps user profile, companion config, completed quests, and psych notes in localStorage
- All tabs for both StudentApp and PsychDashboard are co-located in their parent file to reduce import surface
- Anime avatar is pure CSS/SVG — no external assets, fully animated with Framer Motion
- Session override is exposed directly in the ChatTab header for psychologist use

## Product

- **Landing**: Role picker (Student or Psychologist)
- **Onboarding**: Name → wellness tags → companion designer (name, gender, appearance, voice, language)
- **Student App**:
  - Chat: AI companion (Asha/custom) with Hinglish responses, typing indicator, voice recording UI, vision analysis modal, session override panel, companion customizer, call (video/voice)
  - Quests: 12 gamified wellness quests with step-by-step walkthrough + XP rewards
  - EQ Learning: Netflix-style course browser with full video player UI and AI companion commentary
  - Talk to Psychologist: 4 psychologist cards with scheduling slots, inline messaging, call/video
  - Analytics: 4 recharts (mood trend, sessions, quest completion donut, emotion breakdown)
  - Settings: Companion, notifications, privacy, app preferences
- **Psychologist Portal**:
  - Triage: Patient list with risk scores, status filters, patient detail modal (overview, chat history, visual logs, notes), session override, call patient
  - Analytics: Practice analytics with recharts (risk distribution, session frequency, outcomes)
  - Reports: Session reports with PDF download simulation
  - Notifications: Read/unread management with type filtering
  - Settings: Availability, emergency protocol, notification preferences

## User preferences

- Beige/green color theme (forest green `hsl(145 33% 26%)`, beige background `hsl(40 40% 94%)`)
- Outfit font for body, Syne/serif for headings
- Hinglish AI responses by default
- Anime avatar with 6 appearance styles

## Gotchas

- The app uses `AnimatePresence mode="wait"` at the root — always provide a unique `key` prop on each screen child
- `useStore` returns `null` for `user`/`companion` on fresh load — check before rendering StudentApp
- StudentApp is a large file (~700 lines) by design — all tab components are defined inside it
