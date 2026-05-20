/**
 * app.js — Main application logic for the SE Asia Weather Guide.
 * Handles scoring, state management, and UI coordination.
 */

import { COUNTRIES, MONTH_NAMES, MONTH_SHORT } from './data.js';
import { MapRenderer, scoreToColor } from './map.js';
import { ChartRenderer } from './charts.js';

// ─── Score Calculation ────────────────────────────────────────

/**
 * Calculate a favorability score (0–100) for a given country in a given month.
 * Weights: 40% temperature comfort, 60% low rainfall.
 */
function calculateScore(monthData) {
  // Temperature score: ideal range is 24–30°C for the high
  const avgTemp = (monthData.temp_high + monthData.temp_low) / 2;
  let tempScore;
  if (avgTemp >= 24 && avgTemp <= 30) {
    tempScore = 100;
  } else if (avgTemp < 24) {
    tempScore = Math.max(0, 100 - (24 - avgTemp) * 10);
  } else {
    tempScore = Math.max(0, 100 - (avgTemp - 30) * 12);
  }

  // Rainfall score: 0mm = 100, 600mm+ = 0, exponential decay
  const rainScore = Math.max(0, Math.min(100, 100 * Math.exp(-monthData.rainfall_mm / 200)));

  // Combined weighted score
  return Math.round(tempScore * 0.4 + rainScore * 0.6);
}

/**
 * Calculate scores for all countries for all months.
 * Returns { countryId: [score0, score1, ...score11] }
 */
function calculateAllScores() {
  const scores = {};
  Object.entries(COUNTRIES).forEach(([id, country]) => {
    scores[id] = country.months.map(m => calculateScore(m));
  });
  return scores;
}

/**
 * Get the average score across all countries for a given month.
 */
function getRegionAvgScore(allScores, monthIndex) {
  const countryIds = Object.keys(allScores);
  const sum = countryIds.reduce((acc, id) => acc + allScores[id][monthIndex], 0);
  return Math.round(sum / countryIds.length);
}

/**
 * Get score class name for CSS styling.
 */
function getScoreClass(score) {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  if (score >= 20) return 'poor';
  return 'bad';
}

/**
 * Get score label text.
 */
function getScoreLabel(score) {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  if (score >= 20) return 'Poor';
  return 'Avoid';
}


// ─── Application State ────────────────────────────────────────

const state = {
  selectedMonth: new Date().getMonth(), // Current month (0-indexed)
  selectedCountry: null,
  allScores: calculateAllScores()
};


// ─── UI Components ────────────────────────────────────────────

let mapRenderer;
let chartRenderer;

/**
 * Initialize the application.
 */
function init() {
  chartRenderer = new ChartRenderer();

  // Render the map
  const mapContainer = document.getElementById('map-container');
  mapRenderer = new MapRenderer(mapContainer);
  mapRenderer.render();

  mapRenderer.onCountryClick((id) => selectCountry(id));
  mapRenderer.onCountryHover((id) => {
    // Could add additional hover behavior here
  });

  // Build month bar
  buildMonthBar();

  // Set initial state
  selectMonth(state.selectedMonth);

  // Keyboard navigation
  document.addEventListener('keydown', handleKeyDown);

  console.log('🌏 SE Asia Weather Guide initialized');
}

/**
 * Build the month selector bar.
 */
function buildMonthBar() {
  const bar = document.getElementById('month-bar');
  bar.innerHTML = '';

  MONTH_SHORT.forEach((name, i) => {
    const btn = document.createElement('button');
    btn.className = 'month-bar__item';
    btn.textContent = name;
    btn.setAttribute('data-month', i);
    btn.setAttribute('aria-label', `${MONTH_NAMES[i]} — Regional score: ${getRegionAvgScore(state.allScores, i)}`);
    btn.setAttribute('id', `month-btn-${i}`);

    // Set score dot color
    const avgScore = getRegionAvgScore(state.allScores, i);
    btn.style.setProperty('--month-score-color', scoreToColor(avgScore));

    btn.addEventListener('click', () => selectMonth(i));
    bar.appendChild(btn);
  });
}

/**
 * Select a month — update map, month bar, and detail panel.
 */
function selectMonth(monthIndex) {
  state.selectedMonth = monthIndex;

  // Update month bar active state
  document.querySelectorAll('.month-bar__item').forEach((btn, i) => {
    btn.classList.toggle('month-bar__item--active', i === monthIndex);
  });

  // Update map colors for this month
  const monthScores = {};
  Object.keys(state.allScores).forEach(id => {
    monthScores[id] = state.allScores[id][monthIndex];
  });
  mapRenderer.updateScores(monthScores);

  // Update detail panel if a country is selected
  if (state.selectedCountry) {
    updateDetailPanel(state.selectedCountry);
  }
}

/**
 * Select a country — show detail panel with charts.
 */
function selectCountry(countryId) {
  state.selectedCountry = countryId;
  mapRenderer.setSelected(countryId);
  updateDetailPanel(countryId);
}

/**
 * Update the detail panel for a given country.
 */
function updateDetailPanel(countryId) {
  const country = COUNTRIES[countryId];
  if (!country) return;

  const panel = document.getElementById('detail-panel');
  const placeholder = document.getElementById('detail-placeholder');
  const scores = state.allScores[countryId];
  const currentScore = scores[state.selectedMonth];
  const scoreClass = getScoreClass(currentScore);
  const scoreLabel = getScoreLabel(currentScore);

  // Hide placeholder, show panel
  placeholder.style.display = 'none';
  panel.style.display = 'block';
  // Re-trigger animation
  panel.style.animation = 'none';
  panel.offsetHeight; // Force reflow
  panel.style.animation = '';

  // Header
  panel.querySelector('.detail-panel__country-emoji').textContent = country.emoji;
  panel.querySelector('.detail-panel__country-name').textContent = country.name;
  panel.querySelector('.detail-panel__country-capital').textContent = country.capital;

  // Score
  const scoreCircle = panel.querySelector('.detail-panel__score-circle');
  scoreCircle.textContent = currentScore;
  scoreCircle.className = `detail-panel__score-circle detail-panel__score-circle--${scoreClass}`;
  // Re-trigger scale animation
  const scoreSection = panel.querySelector('.detail-panel__score');
  scoreSection.style.animation = 'none';
  scoreSection.offsetHeight;
  scoreSection.style.animation = '';

  panel.querySelector('.detail-panel__score-class').textContent = scoreLabel;
  panel.querySelector('.detail-panel__score-month').textContent =
    `for ${MONTH_NAMES[state.selectedMonth]}`;

  // Weather summary for current month
  const monthData = country.months[state.selectedMonth];
  panel.querySelector('.detail-panel__temp-summary').innerHTML =
    `<span class="temp-high">${monthData.temp_high}°C</span> / <span class="temp-low">${monthData.temp_low}°C</span>`;
  panel.querySelector('.detail-panel__rain-summary').textContent =
    `${monthData.rainfall_mm} mm rainfall`;

  // Charts
  const tempCanvas = document.getElementById('temp-chart');
  const rainCanvas = document.getElementById('rain-chart');

  // Small delay to let the panel render before drawing charts
  requestAnimationFrame(() => {
    chartRenderer.renderTemperatureChart(tempCanvas, country.months, country.bestMonths, state.selectedMonth);
    chartRenderer.renderRainfallChart(rainCanvas, country.months, country.bestMonths, state.selectedMonth);
  });

  // Best months
  const bestMonthsList = panel.querySelector('.best-months-list');
  bestMonthsList.innerHTML = '';
  country.bestMonths
    .sort((a, b) => a - b)
    .forEach(mi => {
      const span = document.createElement('span');
      span.className = 'best-months-list__item';
      span.textContent = MONTH_NAMES[mi];
      if (mi === state.selectedMonth) {
        span.style.background = 'rgba(14, 165, 233, 0.2)';
        span.style.borderColor = 'rgba(14, 165, 233, 0.4)';
        span.style.color = '#38bdf8';
      }
      span.addEventListener('click', () => selectMonth(mi));
      span.style.cursor = 'pointer';
      bestMonthsList.appendChild(span);
    });

  // Notes
  panel.querySelector('.detail-panel__notes-text').textContent = country.notes;

  // All months mini-table
  const monthsGrid = panel.querySelector('.detail-panel__months-grid');
  monthsGrid.innerHTML = '';
  MONTH_SHORT.forEach((name, i) => {
    const score = scores[i];
    const div = document.createElement('div');
    div.className = `months-grid__item ${i === state.selectedMonth ? 'months-grid__item--selected' : ''}`;
    div.innerHTML = `
      <span class="months-grid__month">${name}</span>
      <span class="months-grid__score" style="color: ${scoreToColor(score)}">${score}</span>
    `;
    div.addEventListener('click', () => selectMonth(i));
    div.style.cursor = 'pointer';
    monthsGrid.appendChild(div);
  });
}

/**
 * Close the detail panel.
 */
function closeDetailPanel() {
  state.selectedCountry = null;
  mapRenderer.setSelected(null);

  const panel = document.getElementById('detail-panel');
  const placeholder = document.getElementById('detail-placeholder');

  panel.style.display = 'none';
  placeholder.style.display = 'flex';
}

/**
 * Handle keyboard navigation.
 */
function handleKeyDown(e) {
  if (e.key === 'Escape' && state.selectedCountry) {
    closeDetailPanel();
  }

  // Left/Right arrows to change month
  if (e.key === 'ArrowLeft' && !e.target.closest('.detail-panel')) {
    e.preventDefault();
    const newMonth = (state.selectedMonth - 1 + 12) % 12;
    selectMonth(newMonth);
  }
  if (e.key === 'ArrowRight' && !e.target.closest('.detail-panel')) {
    e.preventDefault();
    const newMonth = (state.selectedMonth + 1) % 12;
    selectMonth(newMonth);
  }
}


// ─── Expose close handler globally ────────────────────────────
window.closeDetailPanel = closeDetailPanel;


// ─── Start ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
