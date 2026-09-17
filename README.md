# Thinking Space

A personal workspace for organising PhD research: notes, task boards, a reading list with PDF annotation, a calendar and a daily dashboard.

Live site: https://thinking-space.web.app

## Features

- **Notes** — rich-text editor (BlockNote) with paper citations, Word/PDF export and focus mode
- **Boards** — Kanban boards with priorities, tags and due dates
- **Reading list** — papers with status, collections, BibTeX/APA/MLA/Chicago/IEEE citations, PDF viewer with quote capture, and per-paper note tabs
- **Calendar** — month view of your events, deadlines, task due dates and (optionally) Google Calendar, with a schedule and to-do list for each day
- **Dashboard** — deadlines, today's schedule, to-dos, quick capture, focus timer and recent notes
- **Demo mode** — try everything without signing in; demo work can be imported when you create an account
- Dark mode, e-reader mode, installable PWA with offline support

## Tech

React 19, Vite, Tailwind CSS 3, Firebase (Auth, Firestore, Storage, Hosting).

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in the Firebase web app config
npm run dev
```

The `VITE_FIREBASE_*` values come from Firebase console → Project settings → Your apps.

Other scripts:

```bash
npm run lint      # ESLint
npm run build     # production build to dist/
npm run preview   # serve the production build locally
```

## Data model

Everything a user owns lives under `users/{uid}/` in Firestore:

| Collection | Contents |
| --- | --- |
| `sections` | Notes, boards and folders (a tree via `parentId`); boards embed `columns` and `tasks` |
| `papers`, `paperCollections` | Reading list |
| `calendarItems` | Calendar events and per-day to-dos |
| `deadlines`, `scheduleBlocks`, `dashboardTodos`, `quickCaptures` | Dashboard widgets |
| `profile/info` | Display name and email |

PDFs are stored in Firebase Storage under `users/{uid}/papers/`.

Security rules are versioned in `firestore.rules` and `storage.rules`. They are **not** deployed by CI; deploy them with:

```bash
firebase deploy --only firestore:rules,storage
```

## Deployment

GitHub Actions builds and deploys to Firebase Hosting:

- pushes to `main` deploy the live site
- pull requests get a preview channel URL

The build reads the `VITE_FIREBASE_*` repository secrets.

## Google Calendar sync (optional)

1. In Google Cloud console for the Firebase project, enable the **Google Calendar API**.
2. On the OAuth consent screen, add the `https://www.googleapis.com/auth/calendar.readonly` scope (and add yourself as a test user while the app is in testing).
3. In the app, open Calendar → **Connect Google Calendar**. Access lasts an hour, after which the button offers **Reconnect**.
