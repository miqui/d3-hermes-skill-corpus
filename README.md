# d3-hermes-skill-corpus

Phase 1 local-only MVP for exploring the Hermes skill corpus as an interactive D3 hierarchy.

## What this is

- Loads Hermes skills from `~/.hermes/skills`
- Generates an app-consumable JSON corpus into `public/data/skills-corpus.json`
- Renders a collapsible tree explorer with a details panel
- Runs locally with Vite during development
- Runs in Docker for a self-contained local preview

## Stack

- React + TypeScript + Vite
- D3 hierarchy/tree layout
- Tiny Node corpus-generation script (`scripts/generate-corpus.mjs`)
- Express static server for Docker/runtime preview

## Project structure

```text
.
├── compose.yaml
├── Dockerfile
├── public/data/skills-corpus.json
├── scripts/generate-corpus.mjs
├── server.mjs
├── src/
│   ├── components/
│   ├── lib/
│   ├── App.tsx
│   ├── main.tsx
│   ├── styles.css
│   └── types.ts
└── README.md
```

## Prerequisites

- Node.js 22+
- npm
- Hermes skill corpus available at `~/.hermes/skills`
- Docker Desktop or equivalent if you want the containerized run

## Generate the corpus

From the repo root:

```bash
npm install
npm run corpus:generate
```

Optional custom paths:

```bash
npm run corpus:generate -- --source ~/.hermes/skills --output public/data/skills-corpus.json
```

The generated JSON includes:

- hierarchy tree nodes for D3
- flattened skill metadata list
- tags and related-skill references
- corpus stats such as total skills and max depth

## Run locally

Development mode:

```bash
npm run corpus:generate
npm run dev
```

Then open `http://localhost:5173`.

Preview production build locally:

```bash
npm run corpus:generate
npm run build
npm run serve
```

Then open `http://localhost:4173`.

## Run with Docker

Build and run with Compose:

```bash
docker compose up --build
```

This mounts your local Hermes skills directory read-only into the container at `/skills-ro`, regenerates the corpus there, builds the frontend, and serves the app on `http://localhost:4173`.

## Available scripts

- `npm run dev` — Vite dev server
- `npm run build` — TypeScript check + production build
- `npm run preview` — Vite preview server
- `npm run corpus:generate` — generate `public/data/skills-corpus.json`
- `npm run serve` — serve the built app with Express
- `npm run docker:start` — container startup command

## Notes for Phase 1

- The explorer currently focuses on category/folder hierarchy plus skill metadata.
- It is local-only and intended as a clean scaffold for future GitHub publication.
- Docker could not be validated on this machine if the `docker` CLI is unavailable.

## Next logical enhancements

- search/filter by tag or skill name
- graph overlays for `related_skills`
- markdown preview for selected skills
- richer corpus extraction from additional files under each skill directory
