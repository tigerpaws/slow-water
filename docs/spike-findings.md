# Spike findings: Doty Ravine beaver-restoration timelapse

_2026-08-29. Validation spike per plan: fetch Sentinel-2 imagery for one beaver
restoration site, build a scrubbable timelapse + NDVI series, judge whether the result is
compelling and the architecture sound._

## Verdict: validated — proceed to the app

The change is visible, the pipeline works end-to-end on the intended production data path
(CDSE Sentinel Hub), and the costs are manageable. The most legible product is the
**tight-view NDVI composite sequence**: between summer 2016 and summer 2025 the riparian
corridor visibly widens from a fragmented thread into a broad continuous band, and it
stays green through the 2020–22 drought summers while the surrounding grassland bakes
yellow — the Fairfax-style story, visible to a non-expert in a 20-second scrub.

## What worked

- **Cloud handling**: per-window median composites with SCL cloud masking produced 40/40
  clean quarterly frames, 2016–2025, no manual scene picking. Scene availability was
  better than feared (651 scenes; every quarter had a ≤1%-cloud scene from 2017 on).
- **Server-side everything**: no raster code in our stack. Evalscripts computed the
  composites, NDVI colormap (fixed scale across frames), and display enhancement.
- **The generalization seam held**: nothing in the pipeline is site-specific; a new site
  is a new JSON in `sites/`.
- **Viewer**: preloading makes scrubbing instant; the RGB↔NDVI toggle earns its place
  (RGB for orientation/credibility, NDVI for the signal); the annotated NDVI chart with
  a cursor synced to the scrubber reads well even in this unstyled form.

## What we learned (design consequences for the app)

1. **Bbox-mean stats are too diluted.** Whole-AOI summer NDVI is flat (~0.36→0.38)
   because dry grassland and irrigated fields swamp the corridor signal. The Statistical
   API accepts polygons — the app needs (a) drawn/derived corridor masks and (b)
   treatment-vs-control reach comparison to produce the quantitative story. This is the
   single most important upgrade.
2. **Geocoding is not calibration.** The OSM point for "Doty Ravine" was ~3 km from the
   preserve; finding the true AOI took a landmark hunt plus a test frame. The app needs an
   interactive map picker over a satellite basemap, not a geocoder alone.
3. **The Sentinel-2 archive starts mid-2015**, so a ~2014 restoration has no clean
   "before" in it. The decades story (and proper baselines) needs the Landsat 30 m layer
   (Planetary Computer) as a second source.
4. **A whole-quarter median mutes single events.** Composites are ideal for the trend
   video; pinned real-date scenes (catalog lookup already built) should complement them
   for floods/fires. The "simple" mode exists but wasn't fetched this run.
5. **Curiosity hook**: the monthly series shows a sharp NDVI crash to ~0.1 in late 2021 —
   artifact or real event, worth checking; exactly the kind of anomaly the app should
   surface for investigation.

## Ops notes

- **Cost**: full run = 6,225 PUs (160 frames + 114 stat months) ≈ 16% of the free
  40k/month, which resets monthly. Composite cost scales with scenes×pixels×bands;
  capping composite inputs to the ~8 least-cloudy scenes per window would cut ~2–3×.
  Frame cache (idempotent fetch) means a site costs its PUs once — the app should cache
  generated frames in blob storage keyed by request params.
- **API quirks fixed in code**: Catalog API requires `Accept: application/geo+json`;
  network-level socket drops happen on long sequential runs (retry with backoff);
  tokens must be cached (token endpoint is rate-limited).
- **Timing**: ~15 min for 160 frames sequentially; parallelizing 3–4 requests would be
  safe within rate limits if the app generates on demand.
- **Scaling path if quota binds**: Sentinel Hub commercial plans (sold by Planet; same
  API, different endpoint) from ~€30/mo; PlanetScope 3 m daily imagery is available
  through the same API as a paid add-on and would resolve individual ponds.

## Addendum (2026-08-29): Tásmam Koyóm via the Planet provider

Second site fetched entirely through commercial Sentinel Hub on the Planet Insights
Platform (`--provider planet`), validating the paid scale-up path end to end: same API
shapes, same evalscripts, zero code changes beyond a provider registry. 112 frames +
83 stat months = 5,521 PUs on the 30-day trial. Notes:

- Planet's migration moved OAuth client creation to the Account app at
  `insights.planet.com/account` (the API key shown in the UI does NOT work for
  `services.sentinel-hub.com` — OAuth client credentials are required).
- The story reads even better than Doty: intact meadow (2019–mid-2021) → Dixie Fire
  scar (Q3 2021) → meadow recovery outpacing the burned forest around it → beaver-era
  wetland expansion (2023+). Summer bbox NDVI: 0.63 (2019) → 0.32 (2021) → ~0.5 (2025),
  with the meadow floor visibly greener than pre-fire while burned uplands stay bare —
  another argument for polygon stats (meadow vs. burned-forest masks would separate the
  two signals cleanly).
- Bbox-mean NDWI does not show the reported +22% water coverage; water needs per-pixel
  classification (SCL water class or NDWI threshold area), not an AOI mean.
- Winter frames at ~1,370 m are snow-covered — expected, and the seasonal cadence
  handles it; summer frames carry the story.

## Addendum (2026-08-29): treatment/control analysis areas

Both sites now carry named analysis areas (treatment / control / reference boxes in the
site configs), per-area monthly series for NDVI, NDMI (moisture), NBR (burn), and an
open-water fraction — all computed server-side per area (~250–320 PUs per site) — plus
area overlays on the frames and a multi-series, metric-switchable chart in the viewer.

What the comparative numbers say:

- **Tásmam Koyóm is the showcase.** All three areas crashed in the 2021 fire (summer
  NDVI: meadow 0.58→0.37, upper meadow 0.47→0.25, burned forest 0.48→0.27). The
  treatment meadow rebounded above its pre-fire baseline by 2023 (0.71); the burned
  forest is stuck near 0.4 and declining (delayed tree mortality). NDMI shows the
  treatment meadow as the wettest area in every year with the smallest fire-year loss.
- **Absolute cross-area comparisons mislead.** Doty's "control" (upstream corridor) has
  *higher* absolute NDVI than the treatment floodplain — mature tree canopy vs. wetland
  mosaic. Trends and deltas are the honest lens; the app should chart divergence from a
  baseline year, not raw levels, when comparing areas.
- **The grassland reference works as intended** — flat 0.21–0.26 every summer at Doty,
  a clean climate baseline.
- **Sentinel-2 cannot verify CDFW's "+22% water coverage."** The NDWI>0 open-water
  fraction reads ~0% in all areas (beaver ponds and channels are sub-pixel at 10–20 m,
  and often vegetation-covered); the one nonzero reading (2021) is a burn-surface
  artifact. Water-area claims need sub-meter imagery (NAIP, PlanetScope). NDMI is the
  workable moisture proxy at Sentinel-2 scale.
- Area boxes are first-pass, image-derived approximations; several carry explicit
  "verify with site contacts" notes in the configs.

## Addendum (2026-08-29): monthly cadence experiment

Both sites re-fetched at monthly cadence into separate `-monthly` site folders
(quarterly kept intact), run in parallel on the two providers — Doty via CDSE
(468 frames, 6,305 PUs), Tásmam via Planet (336 frames, 5,465 PUs). Verdict:

- **Monthly earns its place around events.** The Dixie Fire resolves into three
  distinct frames — July 2021 (smoke approaching), August (valley shrouded mid-fire),
  September (fresh char with the green meadow core surviving) — where the quarterly
  Q3 composite blended all three into mush. The September frame is the single best
  image of the fire-refugium story.
- **Coverage held up better than expected**: Tásmam 84/84 months usable; Doty 117/120
  (three cloudy winters empty). Even January 2023 (atmospheric-river month) composited
  cleanly from 2–4 scenes.
- **Cost surprise: monthly ≈ quarterly in total PUs** for the same time span (~6.3k vs
  ~6.2k at Doty). Composite cost scales with total scenes processed, not window count —
  each scene is just processed once into whichever window contains it.
- **App implication**: cadence should be a user-facing dial — monthly (or finer) around
  events of interest, seasonal for decade-scale trends; the same cached scenes serve both.

## Next steps (in rough order)

1. Polygon AOIs + treatment/control stats (the scientific core).
2. Re-run pipeline on a site from the user's wife's group (new JSON only).
3. Landsat layer for pre-2015 baselines and decades-scale stories.
4. LLM event research → auto-annotated timelines with citations.
5. Real UI, deploy to Vercel (API routes proxying CDSE, blob cache for frames).
