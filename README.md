# satellite

A research tool for understanding environmental change through satellite imagery: pick a
place, a time range, and an intent; get a scrubbable, annotated image sequence plus the
quantitative series (NDVI, moisture, water) that show whether something real is happening.

**Current status: validation spike.** We're testing the core premise on one site —
[Doty Ravine Preserve](https://placerlandtrust.org/beavers/), a beaver/process-based stream
restoration in Placer County, CA — before building the full app.

## Setup

1. Register a free account at [dataspace.copernicus.eu](https://dataspace.copernicus.eu)
   (Copernicus Data Space Ecosystem — free tier includes 40k processing units/month).
2. In the CDSE Dashboard → User Settings → OAuth clients, create a client and copy the ID
   and secret.
3. `cp .env.example .env.local` and fill in the credentials.
4. `npm install`

## Fetch a timelapse

```
npx tsx scripts/fetch-timelapse.ts sites/doty-ravine.json coverage    # scene availability (cheap)
npx tsx scripts/fetch-timelapse.ts sites/doty-ravine.json calibrate   # one test frame to verify the AOI
npx tsx scripts/fetch-timelapse.ts sites/doty-ravine.json             # everything: frames + stats
```

Frames land in `public/timelapses/<site>/`; the fetch is idempotent (existing frames are
skipped) to protect the processing-unit quota.

## View it

```
npm run dev
```

Open http://localhost:3000 — scrub the sequence (arrow keys / space work), toggle
RGB ↔ NDVI and context ↔ tight views, and check the monthly NDVI chart with restoration
and drought periods annotated.

## Adding a site

A new use case is a new JSON file in `sites/` (see `src/lib/pipeline/types.ts` for the
schema) — center point, view widths, time range, cadence, and known events. No code changes.
