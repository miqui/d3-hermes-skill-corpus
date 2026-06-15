# d3-hermes-skill-corpus

Phase 1 local-only MVP for exploring the Hermes skill corpus as an interactive D3 hierarchy.

## What this is

- Loads Hermes skills from `~/.hermes/skills`
- Generates an app-consumable JSON corpus into `public/data/skills-corpus.json`
- Renders a collapsible tree explorer with a details panel
- Supports search/filter by skill name or tag
- Highlights related skills in the tree when a skill is selected
- Shows a markdown preview for the selected skill body
- Runs locally with Vite during development
- Runs in Docker for a self-contained local preview

## Stack

- React + TypeScript + Vite
- D3 hierarchy/tree layout
- Tiny Node corpus-generation script (`scripts/generate-corpus.mjs`)
- Express static server for Docker/runtime preview
- `marked` for lightweight markdown rendering

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
- markdown body content for preview rendering
- corpus stats such as total skills and max depth

## Run locally

Development mode:

```bash
npm run corpus:generate
npm run dev
```

Then open `http://localhost:5173`.

### Explorer usage notes

- Use the search box to filter the tree by skill name or tag.
- The tree keeps matching folders/ancestors visible so filtered results stay navigable.
- Selecting a skill highlights its related skills in the hierarchy.
- The details panel includes both metadata and a rendered markdown preview of the skill body.
- Related skill pills in the details panel can be clicked to jump directly to those skills when they resolve in the corpus.

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

## Notes for Phase 1.1

- The explorer still focuses on category/folder hierarchy plus skill metadata, with lightweight enhancements layered onto the existing Phase 1 structure.
- Search is intentionally simple and local: substring matching against skill names, slugs, and tags.
- Related-skill highlighting is tree-based rather than a separate overlay/graph.
- Docker could not be validated on this machine if the `docker` CLI is unavailable.
