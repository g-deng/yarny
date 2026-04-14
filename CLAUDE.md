# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Yarny is a pattern/yarn management app built as a monorepo with an Expo/React Native mobile frontend and an Express.js backend.

## Monorepo Structure

- **`/mobile`** — Expo 54 + React Native app (TypeScript)
- **`/backend`** — Express.js API server (JavaScript)

## Development Commands

### Mobile (`/mobile`)
```bash
npm start          # Start Expo dev server
npm run ios        # Run on iOS simulator
npm run android    # Run on Android emulator
npm run web        # Run in browser
npm run lint       # ESLint via expo lint
```

### Backend (`/backend`)
```bash
npm start          # Start Express server (port 3000)
```

## Architecture

### Mobile App
- **Expo Router** with file-based routing in `app/`
- **Auth gate**: `app/welcome.tsx` (username-based signup/login) precedes the tab stack
- **Bottom tab navigation** in `app/(tabs)/_layout.tsx`: Home (`index.tsx`), Search (`search.tsx`), Create (`create.tsx`), Stats (`stats.tsx`), Profile (`profile.tsx`)
- **Project screens** under `app/project/[id]/`: `active.tsx` (row-by-row tracker), `details.tsx` (overview + sections), `pdf.tsx` (PDF viewer)
- **Project creation**: handled inline in the Create tab (`app/(tabs)/create.tsx`) — title, image, PDF, public toggle in one form
- **Profile editing**: `app/edit-profile.tsx`, reached from the Profile tab
- **Theme system**: Colors/fonts defined in `constants/theme.ts`, accessed via `useThemeColor()` hook. `ThemedText` and `ThemedView` components auto-apply light/dark mode colors
- **Platform-aware components**: `ui/icon-symbol.tsx` uses SF Symbols on iOS, Material Icons on Android/web (separate `.ios.ts` and `.web.ts` files)
- **Path aliases**: `@/*` maps to mobile root (e.g., `@/components`, `@/hooks`)
- **Experimental features enabled**: React Compiler, New Architecture (in `app.json`)
- **Client modules**: API client in `services/api.ts`, Supabase client in `services/supabase.ts`, user helpers in `services/user.ts`; current user exposed via `hooks/use-user.ts` (`useUser()`)

### Backend
- Standard Express MVC with Jade views, morgan logging, cookie-parser
- Routes in `routes/`, views in `views/`, static files in `public/`
- Entry point: `bin/www`
- Postgres pool in `db.js`; Supabase admin client in `supabase.js`
- Schema bootstrap/reset helpers: `db-init.js`, `db-reset.js`

## Database Schema
-- Users (username-based signup/login; no password)
CREATE TABLE users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username    text UNIQUE NOT NULL,
  created_at  timestamptz DEFAULT now()
);

-- Projects
CREATE TABLE projects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES users(id) ON DELETE CASCADE,
  title           text NOT NULL,
  image_url       text,
  pdf_url         text,             -- Supabase Storage public URL of the source PDF
  is_public       boolean DEFAULT false,
  total_yards     numeric,          -- extracted by AI from PDF
  total_rows      int,              -- extracted by AI (sum of all rows)
  created_at      timestamptz DEFAULT now(),
  last_worked_at  timestamptz
);

-- Sections (e.g. "Granny Squares", "Cup (R)", "Cup (L)")
CREATE TABLE sections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid REFERENCES projects(id) ON DELETE CASCADE,
  title       text NOT NULL,
  position    int NOT NULL
);

-- Rows (individual instructions within a section)
CREATE TABLE rows (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id   uuid REFERENCES sections(id) ON DELETE CASCADE,
  row_number   int NOT NULL,
  instruction  text NOT NULL,
  position     int NOT NULL          -- global position across whole project, for % calc
);

-- Progress (one record per user+project; also doubles as the "tracking" join
-- row — inserting a progress row is how a user picks up someone else's public
-- project to work on. There is no separate user_projects table.)
CREATE TABLE progress (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid REFERENCES users(id) ON DELETE CASCADE,
  project_id          uuid REFERENCES projects(id) ON DELETE CASCADE,
  current_row_id      uuid REFERENCES rows(id),
  rows_completed      int DEFAULT 0,
  updated_at          timestamptz DEFAULT now(),
  UNIQUE(user_id, project_id)
);

-- Progress log (append-only, for stats history chart)
CREATE TABLE progress_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES users(id) ON DELETE CASCADE,
  project_id  uuid REFERENCES projects(id) ON DELETE CASCADE,
  rows_added  int NOT NULL,           -- how many rows done in this session
  logged_at   timestamptz DEFAULT now()
);

-- Comments
CREATE TABLE comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES users(id) ON DELETE CASCADE,
  project_id  uuid REFERENCES projects(id) ON DELETE CASCADE,
  row_id      uuid REFERENCES rows(id),   -- nullable, comment on specific row
  body        text NOT NULL,
  created_at  timestamptz DEFAULT now()
);

## Backend API Routes
# Users
POST   /api/users                                 create user (username), returns User
GET    /api/users/by-username/:username           lookup by username (used by login)
GET    /api/users/:userId                         get user info
PATCH  /api/users/:userId                         update user (e.g. rename)
GET    /api/users/:userId/public-projects         public projects authored by this user

# Projects
POST   /api/projects                              create project shell (title, image_url, is_public, user_id)
GET    /api/projects                              all public projects (community feed)
GET    /api/projects/:id                          project + sections + rows + derived stats
DELETE /api/projects/:id                          delete project

# PDF Parsing (the AI step)
POST   /api/projects/:id/parse-pdf                body: { pdf_url } → backend fetches, AI extracts, saves sections/rows/total_yards/total_rows/pdf_url
                                                  (client uploads the PDF to Supabase Storage first, then hands over the public URL)

# Progress & Tracking
GET    /api/users/:userId/projects                user's own + tracked projects with current progress + derived yards_used
POST   /api/users/:userId/projects/:id/add        start tracking a public project (creates a progress row)
DELETE /api/users/:userId/projects/:id/track      stop tracking a project (deletes the progress row)
PATCH  /api/users/:userId/projects/:id/progress   body: { rows_to_add: 1 } → increments rows_completed, appends progress_log
POST   /api/users/:userId/projects/:id/restart    reset progress back to row 0
GET    /api/users/:userId/activity-log            raw progress_log entries for history views
GET    /api/users/:userId/stats                   aggregated: today/week/all-time rows + yards

# Comments
POST   /api/projects/:id/comments                 create a comment (optionally tied to a row)
GET    /api/projects/:id/comments                 all comments on a project
GET    /api/projects/:id/comments/inline          comments grouped for inline display in the tracker
GET    /api/rows/:rowId/comments                  comments for a specific row
DELETE /api/comments/:commentId                   delete a comment

# Uploads
POST   /api/upload/image                          multipart image upload → Supabase Storage → returns { url }
                                                  (optional proxy; mobile currently uploads directly to Supabase)

## Implementation Notes

- User auth: username-only (no passwords). `welcome.tsx` offers signup and login modes; `signUp` calls `POST /api/users`, `logIn` calls `GET /api/users/by-username/:username`. The resulting user ID is persisted in AsyncStorage under `@yarny_user_id` and consumed via the `UserContext` / `useUser()` hook. `logOut` just clears storage.
- Tracking model: a user "owns" any project where `projects.user_id = their id`, and "tracks" any other public project for which they've inserted a `progress` row. `GET /api/users/:userId/projects` returns both.
- PDFs are uploaded from the mobile client directly to Supabase Storage, then their public URL is sent to the backend for AI parsing. The backend stores the URL on `projects.pdf_url` and the extracted structure in `sections`/`rows`.
- Yards used: derived at read time as `(rows_completed / total_rows) * total_yards`.
- Image uploads: two paths exist. Mobile currently uploads directly to Supabase Storage via `@/services/api#uploadImage`. The backend proxy route (`POST /api/upload/image`) exists but is not wired from the client today.
- Supabase: mobile client in `mobile/services/supabase.ts`; backend client in `backend/supabase.js`.

## AI PDF Parsing

- Route: `POST /api/projects/:id/parse-pdf` (see `backend/routes/pdf.js`)
- Input: `{ pdf_url }` in the JSON body (public Supabase Storage URL)
- Pipeline: backend downloads the PDF, extracts raw text with `pdf-parse`, then sends the text to **OpenRouter** (`x-ai/grok-4.1-fast`) via the `openai` SDK pointed at `https://openrouter.ai/api/v1`. Auth uses `OPENROUTER_API_KEY`.
- Prompt instructs the model to expand repeats ("Repeat rows X and Y until N rows") into individual row entries, use the largest size for multi-size patterns, and emit strict JSON (no markdown fences).
- Output: extracts `total_yards`, `total_rows`, and `sections[]` (each with `rows[]`), then writes them + `pdf_url` back to the DB in a single transaction.
