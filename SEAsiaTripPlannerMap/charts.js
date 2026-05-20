/**
 * charts.js — Canvas-based chart rendering for temperature and rainfall data.
 * Provides animated, responsive charts with gradient fills and highlighted best months.
 */

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const CHART_COLORS = {
  tempHigh: '#f87171',
  tempHighGlow: 'rgba(248, 113, 113, 0.15)',
  tempLow: '#38bdf8',
  tempLowGlow: 'rgba(56, 189, 248, 0.15)',
  tempFill: 'rgba(129, 140, 248, 0.08)',
  rainfall: '#0ea5e9',
  rainfallGlow: 'rgba(14, 165, 233, 0.25)',
  gridLine: 'rgba(100, 116, 139, 0.12)',
  axisText: '#94a3b8',
  labelText: '#cbd5e1',
  bestMonthBg: 'rgba(52, 211, 153, 0.08)',
  bestMonthBorder: 'rgba(52, 211, 153, 0.25)',
  selectedMonth: 'rgba(14, 165, 233, 0.15)',
  selectedMonthBorder: 'rgba(14, 165, 233, 0.5)',
};

/**
 * ChartRenderer — renders temperature and rainfall charts onto canvas elements.
 */
export class ChartRenderer {
  constructor() {
    this._animationFrames = {};
    this._resizeObservers = [];
  }

  /**
   * Render a temperature chart (dual line: high/low) into a canvas element.
   * @param {HTMLCanvasElement} canvas
   * @param {Array<{temp_high: number, temp_low: number}>} months - 12 month data
   * @param {number[]} bestMonths - 0-indexed best month indices
   * @param {number} selectedMonth - currently selected month (0-indexed)
   */
  renderTemperatureChart(canvas, months, bestMonths = [], selectedMonth = 0) {
    this._setupCanvas(canvas);
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    const padding = { top: 30, right: 20, bottom: 40, left: 45 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    // Find data range
    const allTemps = months.flatMap(m => [m.temp_high, m.temp_low]);
    const minTemp = Math.floor(Math.min(...allTemps) / 5) * 5 - 5;
    const maxTemp = Math.ceil(Math.max(...allTemps) / 5) * 5 + 5;
    const tempRange = maxTemp - minTemp;

    const xStep = chartW / 11;

    const getX = (i) => padding.left + i * xStep;
    const getY = (temp) => padding.top + chartH - ((temp - minTemp) / tempRange) * chartH;

    // Animate
    this._animate(canvas.id || 'temp', (progress) => {
      ctx.clearRect(0, 0, w, h);

      // Draw best month backgrounds
      bestMonths.forEach(mi => {
        const x = getX(mi) - xStep / 2;
        ctx.fillStyle = CHART_COLORS.bestMonthBg;
        ctx.fillRect(x, padding.top, xStep, chartH);
        ctx.strokeStyle = CHART_COLORS.bestMonthBorder;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, padding.top + chartH);
        ctx.moveTo(x + xStep, padding.top);
        ctx.lineTo(x + xStep, padding.top + chartH);
        ctx.stroke();
        ctx.setLineDash([]);
      });

      // Draw selected month highlight
      if (selectedMonth >= 0 && selectedMonth < 12) {
        const x = getX(selectedMonth) - xStep / 2;
        ctx.fillStyle = CHART_COLORS.selectedMonth;
        ctx.fillRect(x, padding.top, xStep, chartH);
        ctx.strokeStyle = CHART_COLORS.selectedMonthBorder;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, padding.top, xStep, chartH);
      }

      // Grid lines
      const gridSteps = 5;
      for (let i = 0; i <= gridSteps; i++) {
        const temp = minTemp + (tempRange / gridSteps) * i;
        const y = getY(temp);
        ctx.strokeStyle = CHART_COLORS.gridLine;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(w - padding.right, y);
        ctx.stroke();

        // Y-axis labels
        ctx.fillStyle = CHART_COLORS.axisText;
        ctx.font = '11px Inter, system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${Math.round(temp)}°`, padding.left - 8, y);
      }

      // Month labels (X-axis)
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      MONTH_SHORT.forEach((m, i) => {
        ctx.fillStyle = i === selectedMonth ? CHART_COLORS.labelText : CHART_COLORS.axisText;
        ctx.font = i === selectedMonth ? 'bold 11px Inter, system-ui, sans-serif' : '11px Inter, system-ui, sans-serif';
        ctx.fillText(m, getX(i), padding.top + chartH + 10);
      });

      // Title
      ctx.fillStyle = CHART_COLORS.labelText;
      ctx.font = '600 13px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('Temperature (°C)', padding.left, 8);

      const animatedMonths = Math.min(12, Math.floor(progress * 14));

      // Fill between high and low lines
      if (animatedMonths >= 2) {
        ctx.beginPath();
        for (let i = 0; i < animatedMonths; i++) {
          const x = getX(i);
          const y = getY(months[i].temp_high);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        for (let i = animatedMonths - 1; i >= 0; i--) {
          ctx.lineTo(getX(i), getY(months[i].temp_low));
        }
        ctx.closePath();
        ctx.fillStyle = CHART_COLORS.tempFill;
        ctx.fill();
      }

      // Draw high temperature line
      this._drawLine(ctx, months.slice(0, animatedMonths), 'temp_high', getX, getY, CHART_COLORS.tempHigh, 2.5);
      this._drawDots(ctx, months.slice(0, animatedMonths), 'temp_high', getX, getY, CHART_COLORS.tempHigh, CHART_COLORS.tempHighGlow);

      // Draw low temperature line
      this._drawLine(ctx, months.slice(0, animatedMonths), 'temp_low', getX, getY, CHART_COLORS.tempLow, 2.5);
      this._drawDots(ctx, months.slice(0, animatedMonths), 'temp_low', getX, getY, CHART_COLORS.tempLow, CHART_COLORS.tempLowGlow);

      // Legend
      const legendY = 8;
      const legendX = w - padding.right;
      ctx.textAlign = 'right';
      ctx.font = '11px Inter, system-ui, sans-serif';

      ctx.fillStyle = CHART_COLORS.tempHigh;
      ctx.beginPath();
      ctx.arc(legendX - 80, legendY + 6, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = CHART_COLORS.axisText;
      ctx.fillText('High', legendX - 62, legendY + 10);

      ctx.fillStyle = CHART_COLORS.tempLow;
      ctx.beginPath();
      ctx.arc(legendX - 36, legendY + 6, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = CHART_COLORS.axisText;
      ctx.fillText('Low', legendX - 18, legendY + 10);
    });
  }

  /**
   * Render a rainfall bar chart into a canvas element.
   * @param {HTMLCanvasElement} canvas
   * @param {Array<{rainfall_mm: number}>} months - 12 month data
   * @param {number[]} bestMonths - 0-indexed best month indices
   * @param {number} selectedMonth - currently selected month (0-indexed)
   */
  renderRainfallChart(canvas, months, bestMonths = [], selectedMonth = 0) {
    this._setupCanvas(canvas);
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    const padding = { top: 30, right: 20, bottom: 40, left: 45 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    const maxRain = Math.ceil(Math.max(...months.map(m => m.rainfall_mm)) / 50) * 50 + 50;
    const xStep = chartW / 12;
    const barWidth = xStep * 0.6;

    const getX = (i) => padding.left + i * xStep + xStep / 2;
    const getBarHeight = (rain) => (rain / maxRain) * chartH;

    this._animate(canvas.id || 'rain', (progress) => {
      ctx.clearRect(0, 0, w, h);

      // Best month backgrounds
      bestMonths.forEach(mi => {
        const x = getX(mi) - xStep / 2;
        ctx.fillStyle = CHART_COLORS.bestMonthBg;
        ctx.fillRect(x, padding.top, xStep, chartH);
      });

      // Selected month highlight
      if (selectedMonth >= 0 && selectedMonth < 12) {
        const x = getX(selectedMonth) - xStep / 2;
        ctx.fillStyle = CHART_COLORS.selectedMonth;
        ctx.fillRect(x, padding.top, xStep, chartH);
        ctx.strokeStyle = CHART_COLORS.selectedMonthBorder;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, padding.top, xStep, chartH);
      }

      // Grid lines
      const gridSteps = 5;
      for (let i = 0; i <= gridSteps; i++) {
        const rain = (maxRain / gridSteps) * i;
        const y = padding.top + chartH - (rain / maxRain) * chartH;
        ctx.strokeStyle = CHART_COLORS.gridLine;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(w - padding.right, y);
        ctx.stroke();

        ctx.fillStyle = CHART_COLORS.axisText;
        ctx.font = '11px Inter, system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${Math.round(rain)}`, padding.left - 8, y);
      }

      // Bars
      months.forEach((m, i) => {
        const x = getX(i);
        const barH = getBarHeight(m.rainfall_mm) * progress;
        const barY = padding.top + chartH - barH;

        // Gradient bar
        const gradient = ctx.createLinearGradient(0, barY, 0, padding.top + chartH);
        const intensity = m.rainfall_mm / maxRain;
        if (intensity > 0.6) {
          gradient.addColorStop(0, '#0ea5e9');
          gradient.addColorStop(1, '#3b82f6');
        } else if (intensity > 0.3) {
          gradient.addColorStop(0, '#38bdf8');
          gradient.addColorStop(1, '#0ea5e9');
        } else {
          gradient.addColorStop(0, '#67e8f9');
          gradient.addColorStop(1, '#22d3ee');
        }

        // Bar shadow
        ctx.fillStyle = CHART_COLORS.rainfallGlow;
        ctx.beginPath();
        ctx.roundRect(x - barWidth / 2 - 2, barY - 2, barWidth + 4, barH + 4, 4);
        ctx.fill();

        // Actual bar
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x - barWidth / 2, barY, barWidth, barH, [4, 4, 0, 0]);
        ctx.fill();

        // Value label on top of bar (only show if animation is mostly done)
        if (progress > 0.8 && m.rainfall_mm > 0) {
          ctx.fillStyle = CHART_COLORS.labelText;
          ctx.font = '10px Inter, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(`${m.rainfall_mm}`, x, barY - 4);
        }
      });

      // Month labels
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      MONTH_SHORT.forEach((m, i) => {
        ctx.fillStyle = i === selectedMonth ? CHART_COLORS.labelText : CHART_COLORS.axisText;
        ctx.font = i === selectedMonth ? 'bold 11px Inter, system-ui, sans-serif' : '11px Inter, system-ui, sans-serif';
        ctx.fillText(m, getX(i), padding.top + chartH + 10);
      });

      // Title
      ctx.fillStyle = CHART_COLORS.labelText;
      ctx.font = '600 13px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('Rainfall (mm)', padding.left, 8);

      // Unit label on right
      ctx.fillStyle = CHART_COLORS.axisText;
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('mm/month', w - padding.right, 10);
    });
  }

  /**
   * Set up canvas for high-DPI rendering
   */
  _setupCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
  }

  /**
   * Animate a chart drawing
   */
  _animate(id, drawFn) {
    // Cancel any existing animation for this chart
    if (this._animationFrames[id]) {
      cancelAnimationFrame(this._animationFrames[id]);
    }

    const duration = 800;
    const start = performance.now();

    const tick = (now) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);

      drawFn(eased);

      if (progress < 1) {
        this._animationFrames[id] = requestAnimationFrame(tick);
      }
    };

    // Check reduced motion preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      drawFn(1);
    } else {
      this._animationFrames[id] = requestAnimationFrame(tick);
    }
  }

  /**
   * Draw a line connecting data points
   */
  _drawLine(ctx, data, key, getX, getY, color, lineWidth = 2) {
    if (data.length < 2) return;

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();

    for (let i = 0; i < data.length; i++) {
      const x = getX(i);
      const y = getY(data[i][key]);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        // Smooth curve between points
        const prevX = getX(i - 1);
        const prevY = getY(data[i - 1][key]);
        const cpX = (prevX + x) / 2;
        ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
      }
    }
    ctx.stroke();
  }

  /**
   * Draw dots at data points
   */
  _drawDots(ctx, data, key, getX, getY, color, glowColor) {
    data.forEach((d, i) => {
      const x = getX(i);
      const y = getY(d[key]);

      // Glow
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fillStyle = glowColor;
      ctx.fill();

      // Dot
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // White center
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
    });
  }

  /**
   * Clean up animations
   */
  destroy() {
    Object.values(this._animationFrames).forEach(id => cancelAnimationFrame(id));
    this._resizeObservers.forEach(ro => ro.disconnect());
  }
}
