import { GEO_PATHS } from './geodata.js';

function getBBox(paths) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const path of paths) {
    const coords = path.match(/[A-Z]?\s*([0-9.-]+),([0-9.-]+)/g);
    if (!coords) continue;
    for (const coord of coords) {
      const [_, x, y] = coord.match(/([0-9.-]+),([0-9.-]+)/);
      const nx = parseFloat(x), ny = parseFloat(y);
      if (nx < minX) minX = nx;
      if (nx > maxX) maxX = nx;
      if (ny < minY) minY = ny;
      if (ny > maxY) maxY = ny;
    }
  }
  return { minX, minY, maxX, maxY };
}

const positions = {};
for (const [id, data] of Object.entries(GEO_PATHS)) {
  const bbox = getBBox(data.paths);
  const cx = (bbox.minX + bbox.maxX) / 2;
  const cy = (bbox.minY + bbox.maxY) / 2;
  positions[id] = { cx: Math.round(cx), cy: Math.round(cy) };
}

console.log(JSON.stringify(positions, null, 2));
