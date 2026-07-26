# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Attendance Portal is a React + Tailwind single-page app (Create React App) for club attendance management: member profiles, meeting/event scheduling ("attendance slots"), attendance marking, and per-member/per-event summaries, with a separate admin dashboard. Deployed at https://mdc-attendance-portal.vercel.app/.

## Commands

- `npm start` — run the CRA dev server
- `npm run build` — production build (output in `build/`)
- `npm test` — run tests via `react-scripts test` (Jest + Testing Library, watch mode). Pass a filename to scope to one test, e.g. `npm test -- App.test.js`, or `npm test -- --watchAll=false` for a single non-watch run.
- No lint script is defined; ESLint runs via CRA's built-in `react-app`/`react-app/jest` config during `start`/`build`.

## Architecture

**Almost the entire application lives in one file: `src/ClubPortal.jsx` (~2400 lines, single `App` component, default-exported and rendered from `src/index.js`).** There is no router and no component-splitting — screens are toggled via local state (`view`: `'login' | 'userDashboard' | 'adminDashboard'`, and `adminView`: `'dashboard' | 'manageUsers' | 'attendanceSlots'`) rendered through conditional JSX inside the same component. When making changes, expect to work within this one file rather than hunting across a component tree.

### Data layer: Firebase
- Firebase (Auth + Firestore) is initialized inline in `ClubPortal.jsx` via a `firebaseConfig` object read from `REACT_APP_FIREBASE_*` env vars (see `.env.example` — copy to `.env.local` and fill in real project credentials; `.env.local` is gitignored).
- Firestore collections are namespaced under `/artifacts/${appId}/public/data/...`, e.g. `.../users` and `.../attendance_slots`, where `appId` is derived from the Firebase config's `appId`.
- Data is kept live via `onSnapshot` listeners on the users and slots collections, set up in a `useEffect` gated on `isAuthReady && db && (isAdmin || userProfile)`.

### Auth model: Google sign-in, no self-registration
- The only sign-in path is "Sign in with Google" (`GoogleAuthProvider` + `signInWithPopup`, in `handleGoogleSignIn`). There is no email/password login, registration form, password reset, or change-password flow.
- Members and admins are **pre-seeded in Firestore** (by the admin, directly in the Firebase console or via a bulk import) rather than self-registering. Each `users` doc needs at least `email` and `isAdmin` (boolean); `status` (`'active' | 'inactive'`) gates login.
- On sign-in, `onAuthStateChanged` (in the Firebase-init `useEffect`) queries the `users` collection by `where('email', '==', user.email)` — not by UID, since a pre-seeded doc can't know its future Google UID in advance. No matching doc (or `status === 'inactive'`) shows an error message and signs the user back out; `isAdmin: true` routes to `adminDashboard`, otherwise `userDashboard`.
- There's an inactivity-based auto-logout timer (`remainingTime` state, 30 min) that clears session state, calls `signOut(auth)`, and returns to the login view.

### Domain model (client-side constants)
Dropdown/filter vocabularies are defined as arrays/maps near the top of `ClubPortal.jsx` and used throughout for member fields and slot categorization — check these when adding options rather than hardcoding new ones elsewhere:
- `domains`, `domainPriority` — club sub-teams (EB, DataVerse, WebArcs, CP, Content, Design, PR, Photography)
- `positions`, `positionPriority` — member roles (President down to Member)
- `years`, `yearPriority` — academic year
- `slotTypes` / `slotTypesMap` / `normalizeSlotType` — meeting/event categories (Event, Domain Meeting, Core Team Meeting), normalized (lowercased, spaces stripped) for matching against Firestore-stored values

### Styling
Tailwind CSS (via `@tailwindcss/postcss`), configured in `tailwind.config.js` scanning `src/**/*.{js,jsx,ts,tsx}`. Styling is done with utility classes directly in the JSX rather than separate stylesheet modules (`App.css`/`index.css` are minimal CRA boilerplate).

### Color palette
Brand colors are the `mdc` scale in `tailwind.config.js` (light-to-dark blue + white, sourced from `public/MDC_colourPalette.png`): `mdc-100` `#F9FCFF` (near-white) → `mdc-200` `#E7F1FF` → `mdc-300` `#D0E3FF` → `mdc-500` `#7096D1` → `mdc-700` `#334EAC` → `mdc-900` `#081F5C` (navy). Use these (`bg-mdc-*`, `text-mdc-*`, `border-mdc-*`) for nav, primary/secondary buttons, headings, page backgrounds, form-field borders/focus rings, and decorative stat tiles. Plain Tailwind `green`/`red`/`yellow` are kept intentionally for semantic meaning — active/inactive/pending badges, delete buttons, success/error messages — don't fold those into the blue scale.
