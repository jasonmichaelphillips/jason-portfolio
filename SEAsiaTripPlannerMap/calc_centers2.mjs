import { GEO_PATHS } from './geodata.js';

function getPolygonAreaAndCentroid(pts) {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const p1 = pts[i];
    const p2 = pts[j];
    const f = p1.x * p2.y - p2.x * p1.y;
    area += f;
    cx += (p1.x + p2.x) * f;
    cy += (p1.y + p2.y) * f;
  }
  area /= 2;
  cx = cx / (6 * area);
  cy = cy / (6 * area);
  return { area: Math.abs(area), cx, cy };
}

function parsePathToPoints(pathStr) {
  const points = [];
  const coords = pathStr.match(/[A-Z]?\s*([0-9.-]+),([0-9.-]+)/g);
  if (!coords) return points;
  for (const coord of coords) {
    const [_, x, y] = coord.match(/([0-9.-]+),([0-9.-]+)/);
    points.push({ x: parseFloat(x), y: parseFloat(y) });
  }
  return points;
}

const positions = {};
for (const [id, data] of Object.entries(GEO_PATHS)) {
  let maxArea = -1;
  let bestCentroid = null;
  for (const pathStr of data.paths) {
    const pts = parsePathToPoints(pathStr);
    if (pts.length < 3) continue;
    const { area, cx, cy } = getPolygonAreaAndCentroid(pts);
    if (area > maxArea) {
      maxArea = area;
      bestCentroid = { cx: Math.round(cx), cy: Math.round(cy) };
    }
  }
  if (id === 'malaysia') {
     // For Malaysia, we might want to place it on the larger landmass or in between.
     // Peninsular Malaysia vs East Malaysia.
     // The centroid of the largest might be on Borneo. Let's see.
  }
  positions[id] = bestCentroid;
}

console.log(JSON.stringify(positions, null, 2));
