# Slow Water

Environmental change, seen from orbit. A prototype app that turns satellite imagery of
stream-restoration sites into explorable data and step-by-step evidence stories.

**Two modes:**

- **Explore** (`/explore/[siteId]`) — scrub a decade of Sentinel-2 frames (quarterly and
  monthly granularities; true-color, NDVI greenness, NDMI moisture renders), compare 1–3
  panes side by side, overlay treatment/control analysis areas, chart per-area metrics,
  and capture canvas states as story steps. A chat assistant (Claude Sonnet via the
  Vercel AI SDK) can drive the canvas, query the site's real statistics, and draft steps.
- **View** (`/view/[storyId]`) — walk through a story step by step: each step restores a
  canvas state and presents narration, a "look here" pointer, and fact chips.

**Prototype scope:** two demo sites are checked into the repo (`public/demo/`, ~100MB of
WebP frames + stats) — [Doty Ravine](https://placerlandtrust.org/beavers/) (Placer County
beaver/process-based restoration) and Tásmam Koyóm (Humbug Valley — Maidu land return,
the 2021 Dixie Fire, and CDFW's 2023 beaver release). The full app would fetch imagery
for any location on demand. Two demo stories ship in `src/data/stories/`; user-created
stories live in localStorage with JSON export/import.

## Run it

```
npm install
npm run dev
```

For the chat assistant, add to `.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-…
```

## Data pipeline (offline tooling)

The pipeline lives entirely in `pipeline/`, separate from the app; it shares only the
domain types in `src/lib/domain.ts` and `src/lib/geo.ts`. It talks to the Sentinel Hub
APIs (Copernicus Data Space free tier and/or the commercial service on Planet):

```
npx tsx pipeline/fetch-timelapse.ts pipeline/sites/<site>.json   # frames + per-area stats
npx tsx pipeline/build-demo-data.ts                              # → public/demo (WebP, manifests)
```

Site definitions (AOI, views, events, analysis areas) are JSON files in
`pipeline/sites/` — a new site is a new file, no code changes. Pipeline credentials go
in `.env.local` (see `.env.example`). Raw PNG output lands in `pipeline/data/`
(gitignored); `build-demo-data` bakes it into the checked-in `public/demo/`.

Findings from the validation phase are in `docs/spike-findings.md`.

## Deploy

Standard Next.js on Vercel; set `ANTHROPIC_API_KEY` as an environment variable.
