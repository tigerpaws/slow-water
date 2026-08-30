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

// Fixed NDMI (moisture) color ramp: browns = dry, straw = neutral,
// teal/blue = moist vegetation and water.
var NDMI_STOPS = [
  [-0.5, [0.45, 0.27, 0.16]],
  [-0.2, [0.72, 0.55, 0.36]],
  [0.0, [0.85, 0.8, 0.62]],
  [0.15, [0.55, 0.72, 0.62]],
  [0.3, [0.22, 0.55, 0.55]],
  [0.5, [0.1, 0.35, 0.55]],
  [0.8, [0.04, 0.15, 0.4]]
];

function colorize(stops, v) {
  if (v <= stops[0][0]) return stops[0][1];
  for (var i = 1; i < stops.length; i++) {
    if (v <= stops[i][0]) {
      var t = (v - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
      var a = stops[i - 1][1];
      var b = stops[i][1];
      return [
        a[0] + t * (b[0] - a[0]),
        a[1] + t * (b[1] - a[1]),
        a[2] + t * (b[2] - a[2])
      ];
    }
  }
  return stops[stops.length - 1][1];
}

function colorizeNdvi(v) { return colorize(NDVI_STOPS, v); }
function colorizeNdmi(v) { return colorize(NDMI_STOPS, v); }
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

const NDMI_MEDIAN = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B08", "B11", "SCL", "dataMask"] }],
    output: { bands: 3 },
    mosaicking: "ORBIT"
  };
}
${SHARED_HELPERS}
function evaluatePixel(samples) {
  var valid = samples.filter(isValid);
  if (valid.length === 0) return [0, 0, 0];
  var ndmis = valid.map(function (s) {
    return (s.B08 - s.B11) / (s.B08 + s.B11 + 1e-6);
  });
  return colorizeNdmi(median(ndmis));
}
`;

const NDMI_SIMPLE = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B08", "B11", "dataMask"] }],
    output: { bands: 3 }
  };
}
${SHARED_HELPERS}
function evaluatePixel(s) {
  if (s.dataMask !== 1) return [0, 0, 0];
  return colorizeNdmi((s.B08 - s.B11) / (s.B08 + s.B11 + 1e-6));
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
    input: [{ bands: ["B03", "B04", "B08", "B11", "B12", "SCL", "dataMask"] }],
    output: [
      { id: "ndvi", bands: 1, sampleType: "FLOAT32" },
      { id: "ndwi", bands: 1, sampleType: "FLOAT32" },
      { id: "ndmi", bands: 1, sampleType: "FLOAT32" },
      { id: "nbr", bands: 1, sampleType: "FLOAT32" },
      { id: "water", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1 }
    ]
  };
}
var CLOUD_SCL = [0, 1, 3, 8, 9, 10];
function evaluatePixel(s) {
  var valid = s.dataMask === 1 && CLOUD_SCL.indexOf(s.SCL) === -1 ? 1 : 0;
  var ndwi = (s.B03 - s.B08) / (s.B03 + s.B08 + 1e-6);
  return {
    ndvi: [(s.B08 - s.B04) / (s.B08 + s.B04 + 1e-6)],
    ndwi: [ndwi],
    ndmi: [(s.B08 - s.B11) / (s.B08 + s.B11 + 1e-6)],
    nbr: [(s.B08 - s.B12) / (s.B08 + s.B12 + 1e-6)],
    water: [s.SCL === 6 || ndwi > 0 ? 1 : 0],
    dataMask: [valid]
  };
}
`;

export function frameEvalscript(render: RenderKind, mode: MosaicMode): string {
  if (mode === "composite") {
    return render === "rgb" ? RGB_MEDIAN : render === "ndvi" ? NDVI_MEDIAN : NDMI_MEDIAN;
  }
  return render === "rgb" ? RGB_SIMPLE : render === "ndvi" ? NDVI_SIMPLE : NDMI_SIMPLE;
}
