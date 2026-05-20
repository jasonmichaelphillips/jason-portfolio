/**
 * map.js — Interactive SVG map of Southeast Asia.
 * Uses real geographic boundary data from Natural Earth (via geodata.js).
 */

import { GEO_PATHS } from './geodata.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Sea/ocean labels positioned for the equirectangular projection */
const SEA_LABELS = [
  { text: 'South China Sea', x: 520, y: 390, fontSize: 15, rotate: -15 },
  { text: 'Andaman Sea', x: 130, y: 480, fontSize: 12, rotate: -70 },
  { text: 'Java Sea', x: 530, y: 780, fontSize: 12, rotate: 0 },
  { text: 'Celebes Sea', x: 730, y: 610, fontSize: 11, rotate: 0 },
  { text: 'Indian Ocean', x: 200, y: 830, fontSize: 14, rotate: 0 },
  { text: 'Pacific Ocean', x: 920, y: 200, fontSize: 13, rotate: -90 },
  { text: 'Gulf of Thailand', x: 360, y: 510, fontSize: 9, rotate: -30 },
  { text: 'Sulu Sea', x: 710, y: 480, fontSize: 10, rotate: 0 },
  { text: 'Philippine Sea', x: 870, y: 400, fontSize: 11, rotate: -80 },
  { text: 'Banda Sea', x: 780, y: 740, fontSize: 11, rotate: 0 },
  { text: 'Bay of Bengal', x: 55, y: 260, fontSize: 11, rotate: -80 },
  { text: 'Strait of Malacca', x: 205, y: 640, fontSize: 8, rotate: -55 },
];

/** Score to color mapping with smooth interpolation */
function scoreToColor(score) {
  const stops = [
    { score: 0,   r: 248, g: 113, b: 113 },  // coral
    { score: 25,  r: 251, g: 146, b: 60  },   // orange
    { score: 50,  r: 251, g: 191, b: 36  },   // amber
    { score: 75,  r: 163, g: 230, b: 53  },   // lime
    { score: 100, r: 52,  g: 211, b: 153 }    // emerald
  ];

  const clamped = Math.max(0, Math.min(100, score));

  let lower = stops[0];
  let upper = stops[stops.length - 1];

  for (let i = 0; i < stops.length - 1; i++) {
    if (clamped >= stops[i].score && clamped <= stops[i + 1].score) {
      lower = stops[i];
      upper = stops[i + 1];
      break;
    }
  }

  const range = upper.score - lower.score;
  const t = range === 0 ? 0 : (clamped - lower.score) / range;

  const r = Math.round(lower.r + (upper.r - lower.r) * t);
  const g = Math.round(lower.g + (upper.g - lower.g) * t);
  const b = Math.round(lower.b + (upper.b - lower.b) * t);

  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * MapRenderer — renders and manages the interactive SVG map
 * using real geographic boundary data.
 */
export class MapRenderer {
  constructor(containerElement) {
    this._container = containerElement;
    this._svg = null;
    this._tooltip = null;
    this._selectedId = null;
    this._scores = {};
    this._hoverCallback = null;
    this._clickCallback = null;
    this._countryGroups = {};
  }

  /** Render the SVG map into the container */
  render() {
    // Create SVG
    this._svg = document.createElementNS(SVG_NS, 'svg');
    this._svg.setAttribute('viewBox', '0 0 1000 900');
    this._svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    this._svg.style.width = '100%';
    this._svg.style.height = '100%';
    this._svg.setAttribute('role', 'img');
    this._svg.setAttribute('aria-label', 'Interactive map of Southeast Asia showing country weather scores');

    // Defs
    const defs = document.createElementNS(SVG_NS, 'defs');

    // Glow filter for selected country
    const glowFilter = document.createElementNS(SVG_NS, 'filter');
    glowFilter.setAttribute('id', 'selected-glow');
    glowFilter.setAttribute('x', '-30%');
    glowFilter.setAttribute('y', '-30%');
    glowFilter.setAttribute('width', '160%');
    glowFilter.setAttribute('height', '160%');
    const feGauss = document.createElementNS(SVG_NS, 'feGaussianBlur');
    feGauss.setAttribute('stdDeviation', '3');
    feGauss.setAttribute('result', 'blur');
    glowFilter.appendChild(feGauss);
    const feMerge = document.createElementNS(SVG_NS, 'feMerge');
    const fmn1 = document.createElementNS(SVG_NS, 'feMergeNode');
    fmn1.setAttribute('in', 'blur');
    feMerge.appendChild(fmn1);
    const fmn2 = document.createElementNS(SVG_NS, 'feMergeNode');
    fmn2.setAttribute('in', 'SourceGraphic');
    feMerge.appendChild(fmn2);
    glowFilter.appendChild(feMerge);
    defs.appendChild(glowFilter);

    // Ocean gradient background
    const oceanGrad = document.createElementNS(SVG_NS, 'radialGradient');
    oceanGrad.setAttribute('id', 'ocean-gradient');
    oceanGrad.setAttribute('cx', '50%');
    oceanGrad.setAttribute('cy', '45%');
    oceanGrad.setAttribute('r', '60%');
    const stop1 = document.createElementNS(SVG_NS, 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', 'rgba(14, 165, 233, 0.04)');
    oceanGrad.appendChild(stop1);
    const stop2 = document.createElementNS(SVG_NS, 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', 'transparent');
    oceanGrad.appendChild(stop2);
    defs.appendChild(oceanGrad);

    this._svg.appendChild(defs);

    // Ocean background
    const oceanBg = document.createElementNS(SVG_NS, 'rect');
    oceanBg.setAttribute('width', '1000');
    oceanBg.setAttribute('height', '900');
    oceanBg.setAttribute('fill', 'url(#ocean-gradient)');
    this._svg.appendChild(oceanBg);

    // Subtle latitude/longitude grid lines
    const gridGroup = document.createElementNS(SVG_NS, 'g');
    gridGroup.setAttribute('class', 'map-grid');
    // Longitude lines every 10 degrees (92-142)
    for (let lon = 100; lon <= 140; lon += 10) {
      const x = 20 + ((lon - 91) / (142 - 91)) * 960;
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', x);
      line.setAttribute('y1', '0');
      line.setAttribute('x2', x);
      line.setAttribute('y2', '900');
      line.setAttribute('stroke', 'rgba(100, 116, 139, 0.05)');
      line.setAttribute('stroke-width', '0.5');
      line.setAttribute('stroke-dasharray', '4 8');
      gridGroup.appendChild(line);
    }
    // Latitude lines every 10 degrees (-10 to 25)
    for (let lat = -10; lat <= 25; lat += 10) {
      const y = 20 + ((29 - lat) / (29 - (-12))) * 860;
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', '0');
      line.setAttribute('y1', y);
      line.setAttribute('x2', '1000');
      line.setAttribute('y2', y);
      line.setAttribute('stroke', 'rgba(100, 116, 139, 0.05)');
      line.setAttribute('stroke-width', '0.5');
      line.setAttribute('stroke-dasharray', '4 8');
      gridGroup.appendChild(line);
    }
    this._svg.appendChild(gridGroup);

    // Sea labels
    const seaGroup = document.createElementNS(SVG_NS, 'g');
    seaGroup.setAttribute('class', 'sea-labels');
    SEA_LABELS.forEach(label => {
      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('x', label.x);
      text.setAttribute('y', label.y);
      text.setAttribute('font-size', label.fontSize);
      text.setAttribute('font-family', 'Inter, system-ui, sans-serif');
      text.setAttribute('fill', 'rgba(100, 116, 139, 0.15)');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-style', 'italic');
      text.setAttribute('font-weight', '400');
      text.setAttribute('letter-spacing', '3px');
      if (label.rotate) {
        text.setAttribute('transform', `rotate(${label.rotate}, ${label.x}, ${label.y})`);
      }
      text.textContent = label.text;
      seaGroup.appendChild(text);
    });
    this._svg.appendChild(seaGroup);

    // Country paths from real GeoJSON data
    const countriesGroup = document.createElementNS(SVG_NS, 'g');
    countriesGroup.setAttribute('class', 'countries');

    // Render order: larger/background countries first, smaller ones on top
    const renderOrder = [
      'indonesia', 'malaysia', 'myanmar', 'thailand', 'philippines',
      'vietnam', 'laos', 'cambodia', 'timorleste', 'brunei', 'singapore'
    ];

    renderOrder.forEach(id => {
      const geo = GEO_PATHS[id];
      if (!geo) return;

      const group = document.createElementNS(SVG_NS, 'g');
      group.setAttribute('id', id);
      group.setAttribute('data-country', id);
      group.setAttribute('data-name', geo.name);
      group.setAttribute('class', 'country-group');
      group.setAttribute('tabindex', '0');
      group.setAttribute('role', 'button');
      group.setAttribute('aria-label', geo.name);
      group.style.cursor = 'pointer';

      // Render each polygon path
      geo.paths.forEach(d => {
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', d);
        path.setAttribute('class', 'country-path');
        path.setAttribute('fill', '#1e293b');
        path.setAttribute('stroke', 'rgba(148, 163, 184, 0.25)');
        path.setAttribute('stroke-width', '0.5');
        path.setAttribute('stroke-linejoin', 'round');
        group.appendChild(path);
      });

      // Event listeners
      group.addEventListener('mouseenter', (e) => this._onHover(id, e));
      group.addEventListener('mousemove', (e) => this._onMouseMove(e));
      group.addEventListener('mouseleave', () => this._onHoverEnd());
      group.addEventListener('click', () => this._onClick(id));
      group.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this._onClick(id);
        }
      });

      countriesGroup.appendChild(group);
      this._countryGroups[id] = group;
    });

    this._svg.appendChild(countriesGroup);

    // Country name labels (rendered on top of paths)
    const labelsGroup = document.createElementNS(SVG_NS, 'g');
    labelsGroup.setAttribute('class', 'country-labels');
    labelsGroup.style.pointerEvents = 'none';

    // Label positions (manually tuned for readability with real geography)
    const labelPositions = {
      myanmar:     { x: 125, y: 190, fontSize: 10 },
      thailand:    { x: 210, y: 310, fontSize: 10 },
      laos:        { x: 265, y: 245, fontSize: 9 },
      vietnam:     { x: 315, y: 280, fontSize: 9 },
      cambodia:    { x: 285, y: 365, fontSize: 8 },
      malaysia:    { x: 250, y: 560, fontSize: 8 },
      singapore:   { x: 261, y: 610, fontSize: 7 },
      indonesia:   { x: 450, y: 680, fontSize: 11 },
      philippines:  { x: 600, y: 295, fontSize: 9 },
      brunei:      { x: 464, y: 530, fontSize: 7 },
      timorleste:  { x: 677, y: 813, fontSize: 7 },
    };

    Object.entries(labelPositions).forEach(([id, pos]) => {
      const geo = GEO_PATHS[id];
      if (!geo) return;

      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('x', pos.x);
      text.setAttribute('y', pos.y);
      text.setAttribute('font-size', pos.fontSize);
      text.setAttribute('font-family', 'Inter, system-ui, sans-serif');
      text.setAttribute('fill', 'rgba(241, 245, 249, 0.7)');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'central');
      text.setAttribute('font-weight', '600');
      text.setAttribute('letter-spacing', '0.5px');
      text.setAttribute('class', 'country-label');
      // Add a subtle text shadow via stroke
      text.setAttribute('stroke', 'rgba(10, 15, 30, 0.6)');
      text.setAttribute('stroke-width', '3');
      text.setAttribute('paint-order', 'stroke');
      text.textContent = geo.name;
      labelsGroup.appendChild(text);
    });

    this._svg.appendChild(labelsGroup);
    this._container.appendChild(this._svg);

    // Create tooltip
    this._tooltip = document.createElement('div');
    this._tooltip.className = 'map-tooltip';
    this._tooltip.innerHTML = `
      <div class="map-tooltip__name"></div>
      <div class="map-tooltip__score">Score: <span></span></div>
    `;
    this._container.appendChild(this._tooltip);
  }

  /** Update country colors based on scores { countryId: score(0-100) } */
  updateScores(scores) {
    this._scores = scores;

    Object.entries(scores).forEach(([id, score]) => {
      const group = this._countryGroups[id];
      if (!group) return;

      const color = scoreToColor(score);
      const paths = group.querySelectorAll('.country-path');
      paths.forEach(path => {
        path.setAttribute('fill', color);
      });
    });
  }

  /** Set the selected country (highlight it) */
  setSelected(countryId) {
    // Remove previous selection
    if (this._selectedId && this._countryGroups[this._selectedId]) {
      const prevPaths = this._countryGroups[this._selectedId].querySelectorAll('.country-path');
      prevPaths.forEach(p => {
        p.classList.remove('selected');
        p.setAttribute('stroke', 'rgba(148, 163, 184, 0.25)');
        p.setAttribute('stroke-width', '0.5');
      });
    }

    this._selectedId = countryId;

    if (countryId && this._countryGroups[countryId]) {
      const paths = this._countryGroups[countryId].querySelectorAll('.country-path');
      paths.forEach(p => {
        p.classList.add('selected');
        p.setAttribute('stroke', '#0ea5e9');
        p.setAttribute('stroke-width', '1.5');
      });
    }
  }

  /** Set hover callback */
  onCountryHover(callback) {
    this._hoverCallback = callback;
  }

  /** Set click callback */
  onCountryClick(callback) {
    this._clickCallback = callback;
  }

  // ── Private ──

  _onHover(id, event) {
    if (this._hoverCallback) this._hoverCallback(id, event);

    const score = this._scores[id];
    const geo = GEO_PATHS[id];
    const name = geo?.name || id;

    this._tooltip.querySelector('.map-tooltip__name').textContent = name;
    this._tooltip.querySelector('.map-tooltip__score span').textContent =
      score !== undefined ? `${Math.round(score)}/100` : '—';

    if (score !== undefined) {
      this._tooltip.querySelector('.map-tooltip__score span').style.color = scoreToColor(score);
    }

    this._tooltip.classList.add('visible');
    this._onMouseMove(event);
  }

  _onMouseMove(event) {
    const rect = this._container.getBoundingClientRect();
    let x = event.clientX - rect.left + 15;
    let y = event.clientY - rect.top - 10;

    // Keep tooltip in bounds
    const tipW = 160;
    const tipH = 50;
    if (x + tipW > rect.width) {
      x = event.clientX - rect.left - tipW - 15;
    }
    if (y + tipH > rect.height) {
      y = rect.height - tipH - 10;
    }
    if (y < 0) y = 5;

    this._tooltip.style.left = `${x}px`;
    this._tooltip.style.top = `${y}px`;
  }

  _onHoverEnd() {
    if (this._hoverCallback) this._hoverCallback(null);
    this._tooltip.classList.remove('visible');
  }

  _onClick(id) {
    this.setSelected(id);
    if (this._clickCallback) this._clickCallback(id);
  }
}

export { scoreToColor };
