import type { MosaicMode, RenderKind } from "./types";

/**
 * Sentinel Hub evalscripts (V3), executed server-side per pixel.
 *
 * SCL (scene classification) classes masked as invalid: 0 no-data,
 * 1 saturated/defective, 3 cloud shadow, 8 cloud medium prob., 9 cloud high
 * prob., 10 thin cirrus. Snow (11) and water (6) are kept — they are real
 * surface conditions we want to see.
 *
 * "composite" mode uses mosaicking ORBIT: evaluatePixel receives one sample
 * per orbit in the window and we take the per-band median of cloud-free
 * samples. "simple" mode uses mosaicking SIMPLE with mosaickingOrder leastCC
 * set in the request's dataFilter.
 */

const SHARED_HELPERS = `
var CLOUD_SCL = [0, 1, 3, 8, 9, 10];

function isValid(s) {
  return s.dataMask === 1 && CLOUD_SCL.indexOf(s.SCL) === -1;
}

function median(values) {
  values.sort(function (a, b) { return a - b; });
  var mid = Math.floor(values.length / 2);
  return values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
}

// Display enhancement: Sentinel-2 reflectance true color is dark; boost and
// apply mild gamma. Constant across all frames so change between frames is real.
function enhance(v) {
  var x = 2.9 * v;
  x = x < 0 ? 0 : x > 1 ? 1 : x;
  return Math.pow(x, 0.95);
}

// Fixed NDVI color ramp (constant across frames): water/wet = blue,
// bare soil = tan, dense vegetation = dark green.
var NDVI_STOPS = [
  [-0.5, [0.05, 0.15, 0.35]],
  [-0.05, [0.25, 0.35, 0.5]],
  [0.05, [0.78, 0.72, 0.6]],
  [0.2, [0.87, 0.82, 0.46]],
  [0.35, [0.62, 0.72, 0.32]],
  [0.5, [0.3, 0.57, 0.2]],
  [0.65, [0.11, 0.42, 0.11]],
  [0.85, [0.02, 0.25, 0.06]]
];

function colorizeNdvi(v) {
  if (v <= NDVI_STOPS[0][0]) return NDVI_STOPS[0][1];
  for (var i = 1; i < NDVI_STOPS.length; i++) {
    if (v <= NDVI_STOPS[i][0]) {
      var t = (v - NDVI_STOPS[i - 1][0]) / (NDVI_STOPS[i][0] - NDVI_STOPS[i - 1][0]);
      var a = NDVI_STOPS[i - 1][1];
      var b = NDVI_STOPS[i][1];
      return [
        a[0] + t * (b[0] - a[0]),
        a[1] + t * (b[1] - a[1]),
        a[2] + t * (b[2] - a[2])
      ];
    }
  }
  return NDVI_STOPS[NDVI_STOPS.length - 1][1];
}
`;

const RGB_MEDIAN = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B02", "B03", "B04", "SCL", "dataMask"] }],
    output: { bands: 3 },
    mosaicking: "ORBIT"
  };
}
${SHARED_HELPERS}
function evaluatePixel(samples) {
  var valid = samples.filter(isValid);
  if (valid.length === 0) valid = samples.filter(function (s) { return s.dataMask === 1; });
  if (valid.length === 0) return [0, 0, 0];
  return [
    enhance(median(valid.map(function (s) { return s.B04; }))),
    enhance(median(valid.map(function (s) { return s.B03; }))),
    enhance(median(valid.map(function (s) { return s.B02; })))
  ];
}
`;

const NDVI_MEDIAN = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08", "SCL", "dataMask"] }],
    output: { bands: 3 },
    mosaicking: "ORBIT"
  };
}
${SHARED_HELPERS}
function evaluatePixel(samples) {
  var valid = samples.filter(isValid);
  if (valid.length === 0) return [0, 0, 0];
  var ndvis = valid.map(function (s) {
    return (s.B08 - s.B04) / (s.B08 + s.B04 + 1e-6);
  });
  return colorizeNdvi(median(ndvis));
}
`;

const RGB_SIMPLE = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B02", "B03", "B04", "dataMask"] }],
    output: { bands: 3 }
  };
}
${SHARED_HELPERS}
function evaluatePixel(s) {
  if (s.dataMask !== 1) return [0, 0, 0];
  return [enhance(s.B04), enhance(s.B03), enhance(s.B02)];
}
`;

const NDVI_SIMPLE = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08", "dataMask"] }],
    output: { bands: 3 }
  };
}
${SHARED_HELPERS}
function evaluatePixel(s) {
  if (s.dataMask !== 1) return [0, 0, 0];
  return colorizeNdvi((s.B08 - s.B04) / (s.B08 + s.B04 + 1e-6));
}
`;

/**
 * Statistical API script: per-pixel NDVI + NDWI with cloud pixels excluded
 * via dataMask, aggregated per interval by the API.
 */
export const STATS_EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B03", "B04", "B08", "SCL", "dataMask"] }],
    output: [
      { id: "ndvi", bands: 1, sampleType: "FLOAT32" },
      { id: "ndwi", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1 }
    ]
  };
}
var CLOUD_SCL = [0, 1, 3, 8, 9, 10];
function evaluatePixel(s) {
  var valid = s.dataMask === 1 && CLOUD_SCL.indexOf(s.SCL) === -1 ? 1 : 0;
  return {
    ndvi: [(s.B08 - s.B04) / (s.B08 + s.B04 + 1e-6)],
    ndwi: [(s.B03 - s.B08) / (s.B03 + s.B08 + 1e-6)],
    dataMask: [valid]
  };
}
`;

export function frameEvalscript(render: RenderKind, mode: MosaicMode): string {
  if (mode === "composite") return render === "rgb" ? RGB_MEDIAN : NDVI_MEDIAN;
  return render === "rgb" ? RGB_SIMPLE : NDVI_SIMPLE;
}
