#!/usr/bin/env node
/**
 * Generates SVG path data from Natural Earth GeoJSON for SE Asian countries.
 * Downloads real country boundaries and projects to SVG coordinates.
 */

import { writeFileSync } from 'fs';
import https from 'https';

const SE_ASIA = {
  'MMR': 'myanmar',
  'THA': 'thailand',
  'LAO': 'laos',
  'VNM': 'vietnam',
  'KHM': 'cambodia',
  'MYS': 'malaysia',
  'SGP': 'singapore',
  'IDN': 'indonesia',
  'PHL': 'philippines',
  'BRN': 'brunei',
  'TLS': 'timorleste'
};

// Equirectangular projection bounds for SE Asia
const BOUNDS = {
  lonMin: 91, lonMax: 142,
  latMin: -12, latMax: 29
};
const VIEW_WIDTH = 1000;
const VIEW_HEIGHT = 900;
const PADDING = 20;

function project(lon, lat) {
  const x = PADDING + ((lon - BOUNDS.lonMin) / (BOUNDS.lonMax - BOUNDS.lonMin)) * (VIEW_WIDTH - 2 * PADDING);
  const y = PADDING + ((BOUNDS.latMax - lat) / (BOUNDS.latMax - BOUNDS.latMin)) * (VIEW_HEIGHT - 2 * PADDING);
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
}

function coordsToPath(rings) {
  return rings.map(ring => {
    return ring.map((point, i) => {
      const [x, y] = project(point[0], point[1]);
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    }).join(' ') + ' Z';
  }).join(' ');
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const doFetch = (u) => {
      https.get(u, { headers: { 'User-Agent': 'node-map-gen' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return doFetch(res.headers.location);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
        res.on('error', reject);
      }).on('error', reject);
    };
    doFetch(url);
  });
}

// Filter out tiny polygon rings (too small to see)
function isSignificantRing(ring, minArea) {
  if (ring.length < 4) return false;
  // Shoelace formula for approximate area in degrees^2
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    area += ring[i][0] * ring[i+1][1] - ring[i+1][0] * ring[i][1];
  }
  return Math.abs(area / 2) > minArea;
}

async function main() {
  console.log('Downloading Natural Earth 50m countries GeoJSON...');
  const url = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson';

  let raw;
  try {
    raw = await fetchUrl(url);
  } catch (e) {
    console.log('50m failed, trying 110m...');
    raw = await fetchUrl('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson');
  }
  const geojson = JSON.parse(raw);

  console.log(`Loaded ${geojson.features.length} countries`);

  const result = {};

  for (const feature of geojson.features) {
    const iso = feature.properties.ISO_A3 || feature.properties.ADM0_A3;
    // Also check ISO_A3_EH for edge cases
    const isoEh = feature.properties.ISO_A3_EH;
    const id = SE_ASIA[iso] || SE_ASIA[isoEh];
    if (!id) continue;

    const name = feature.properties.NAME || feature.properties.ADMIN;
    console.log(`  Processing: ${name} (${iso}) -> ${id}`);

    const geom = feature.geometry;
    const paths = [];

    // Min area threshold: filter out tiny islands
    const minArea = (id === 'singapore' || id === 'brunei') ? 0.001 : 0.01;

    if (geom.type === 'Polygon') {
      const path = coordsToPath(geom.coordinates);
      if (path.length > 10) paths.push(path);
    } else if (geom.type === 'MultiPolygon') {
      for (const polygon of geom.coordinates) {
        // Check if any ring is significant
        if (polygon.some(ring => isSignificantRing(ring, minArea))) {
          const path = coordsToPath(polygon);
          if (path.length > 10) paths.push(path);
        }
      }
    }

    result[id] = { name, paths };
  }

  // Generate JS module
  let output = `/**
 * geodata.js — Real country boundary paths for SE Asian countries.
 * Auto-generated from Natural Earth 50m data.
 * Projection: Equirectangular (lon ${BOUNDS.lonMin}-${BOUNDS.lonMax}, lat ${BOUNDS.latMin}-${BOUNDS.latMax})
 * ViewBox: 0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}
 * DO NOT EDIT MANUALLY.
 */

export const GEO_PATHS = {\n`;

  for (const [id, data] of Object.entries(result)) {
    output += `  ${id}: {\n`;
    output += `    name: ${JSON.stringify(data.name)},\n`;
    output += `    paths: [\n`;
    for (const path of data.paths) {
      output += `      "${path}",\n`;
    }
    output += `    ]\n`;
    output += `  },\n`;
  }

  output += '};\n';

  const outPath = new URL('./geodata.js', import.meta.url).pathname;
  writeFileSync(outPath, output);
  console.log(`\\nWrote geodata.js (${(output.length / 1024).toFixed(1)} KB) with ${Object.keys(result).length} countries`);

  // Verify
  for (const [id, data] of Object.entries(result)) {
    console.log(`  ${id}: ${data.paths.length} path(s)`);
  }
}

main().catch(console.error);
