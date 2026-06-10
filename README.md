# Gundam War Database Frontend

React frontend for the Gundam War search site and deck builder.

## Scope

This repository is the frontend application only.

Tracked here:
- `src/`
- `public/` except generated image folders
- `package.json` and `package-lock.json`
- local verification scripts in `scripts/`
- `.env.example`

Managed outside this repository:
- source CSV data in the workspace-root `csv/`
- data maintenance scripts in the workspace-root `scripts/`
- raw image archive in the workspace-root `jpg/`
- generated deployment images synced into `public/card-images*` and `public/basic-g-images*`

## Local development

1. Copy `.env.example` to `.env.local` when you need local overrides.
2. Install dependencies with `npm install`.
3. Start the app with `npm start`.

## Build and deploy

- `npm run build` creates the production build in `build/`.
- Production static files are deployed separately to `/var/www/build`.
- Runtime configuration such as Google login should stay in environment files or the API config endpoint, not hard-coded in the app.

## Version-control notes

- Generated image directories are ignored on purpose because they are large deployment artifacts.
- Temporary screenshots, build test outputs, editor files, and local SQL session files are ignored.
- When frontend behavior changes, commit the source files first, then sync deployment artifacts separately.
