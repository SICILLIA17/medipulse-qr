// MediPulse Interactive Clinical SVG Charts
// Renders responsive longitudinal trend visualizations for Vitals & Laboratory Biomarkers

(function(root) {
  class ClinicalCharts {
    // Generate dual-series Blood Pressure chart (Systolic + Diastolic)
    static renderBloodPressureChart(containerId, vitalsTimeline, options = {}) {
      const container = document.getElementById(containerId);
      if (!container) return;

      const validPoints = (vitalsTimeline || [])
        .filter(v => v.systolic && v.diastolic)
        .map(v => ({
          date: v.date.slice(0, 10),
          fullDate: v.date,
          systolic: v.systolic,
          diastolic: v.diastolic,
          recordedBy: v.recordedBy || 'Clinician'
        }));

      if (validPoints.length === 0) {
        container.innerHTML = `<div class="py-12 text-center text-xs text-slate-400">No blood pressure trend records available.</div>`;
        return;
      }

      const width = options.width || 640;
      const height = options.height || 220;
      const padLeft = 45;
      const padRight = 20;
      const padTop = 25;
      const padBottom = 35;

      const plotW = width - padLeft - padRight;
      const plotH = height - padTop - padBottom;

      // Fixed clinical scale: 50 to 180 mmHg
      const minY = 50;
      const maxY = 180;
      const scaleY = (val) => padTop + plotH - ((val - minY) / (maxY - minY)) * plotH;
      const scaleX = (idx) => padLeft + (validPoints.length === 1 ? plotW / 2 : (idx / (validPoints.length - 1)) * plotW);

      // Normal reference band: 60 - 120 mmHg
      const normTop = scaleY(120);
      const normBottom = scaleY(60);
      const normH = normBottom - normTop;

      // Points for lines
      const sysCoords = validPoints.map((p, i) => `${scaleX(i)},${scaleY(p.systolic)}`);
      const diaCoords = validPoints.map((p, i) => `${scaleX(i)},${scaleY(p.diastolic)}`);

      const svg = `
        <svg viewBox="0 0 ${width} ${height}" class="w-full h-auto overflow-visible select-none">
          <!-- Background Grid & Clinical Normal Band -->
          <rect x="${padLeft}" y="${normTop}" width="${plotW}" height="${normH}" fill="#ecfdf5" opacity="0.8" />
          <line x1="${padLeft}" y1="${normTop}" x2="${padLeft + plotW}" y2="${normTop}" stroke="#10b981" stroke-dasharray="3,3" stroke-width="1" />
          <text x="${padLeft + 5}" y="${normTop - 4}" fill="#059669" font-size="9" font-weight="700">Target Normal (<120 mmHg)</text>

          <!-- Horizontal Guidelines -->
          ${[60, 80, 100, 120, 140, 160].map(yVal => `
            <line x1="${padLeft}" y1="${scaleY(yVal)}" x2="${padLeft + plotW}" y2="${scaleY(yVal)}" stroke="#f1f5f9" stroke-width="1" />
            <text x="${padLeft - 6}" y="${scaleY(yVal) + 3}" text-anchor="end" fill="#94a3b8" font-size="9" font-family="monospace">${yVal}</text>
          `).join('')}

          <!-- Systolic Line (Rose/Amber) -->
          <polyline points="${sysCoords.join(' ')}" fill="none" stroke="#e11d48" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          
          <!-- Diastolic Line (Teal) -->
          <polyline points="${diaCoords.join(' ')}" fill="none" stroke="#0d9488" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />

          <!-- Interactive Data Points -->
          ${validPoints.map((p, i) => `
            <g class="cursor-pointer group">
              <!-- Systolic circle -->
              <circle cx="${scaleX(i)}" cy="${scaleY(p.systolic)}" r="4.5" fill="#e11d48" stroke="#ffffff" stroke-width="2" />
              <text x="${scaleX(i)}" y="${scaleY(p.systolic) - 8}" text-anchor="middle" font-size="9" font-weight="bold" fill="#e11d48" class="opacity-0 group-hover:opacity-100 transition">${p.systolic}</text>

              <!-- Diastolic circle -->
              <circle cx="${scaleX(i)}" cy="${scaleY(p.diastolic)}" r="4.5" fill="#0d9488" stroke="#ffffff" stroke-width="2" />
              <text x="${scaleX(i)}" y="${scaleY(p.diastolic) + 14}" text-anchor="middle" font-size="9" font-weight="bold" fill="#0d9488" class="opacity-0 group-hover:opacity-100 transition">${p.diastolic}</text>

              <!-- X-axis date -->
              <text x="${scaleX(i)}" y="${height - padBottom + 16}" text-anchor="middle" fill="#64748b" font-size="8.5" font-family="monospace">${p.date.slice(5)}</text>
            </g>
          `).join('')}
        </svg>
      `;

      // Calculate statistics
      const latest = validPoints[validPoints.length - 1];
      const avgSys = Math.round(validPoints.reduce((s, p) => s + p.systolic, 0) / validPoints.length);
      const avgDia = Math.round(validPoints.reduce((s, p) => s + p.diastolic, 0) / validPoints.length);

      container.innerHTML = `
        <div class="space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div class="flex items-center gap-4">
              <span class="flex items-center gap-1.5"><span class="w-3 h-1 bg-rose-600 rounded"></span> <strong class="text-slate-800">Systolic</strong></span>
              <span class="flex items-center gap-1.5"><span class="w-3 h-1 bg-teal-600 rounded"></span> <strong class="text-slate-800">Diastolic</strong></span>
              <span class="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Normal Range: < 120/80</span>
            </div>
            <div class="text-slate-500 font-mono text-[11px]">
              Latest: <strong class="text-slate-900">${latest.systolic}/${latest.diastolic} mmHg</strong> • Avg: ${avgSys}/${avgDia}
            </div>
          </div>
          <div class="bg-white p-3 rounded-2xl border border-slate-100 shadow-inner">
            ${svg}
          </div>
        </div>
      `;
    }

    // Generate Single Metric Trend Chart (Heart Rate, SpO2, Glucose, Temp)
    static renderSingleMetricChart(containerId, dataPoints, options = {}) {
      const container = document.getElementById(containerId);
      if (!container) return;

      const valid = (dataPoints || []).filter(d => d.value !== null && !isNaN(d.value));
      if (valid.length === 0) {
        container.innerHTML = `<div class="py-10 text-center text-xs text-slate-400">No telemetry recorded for this metric.</div>`;
        return;
      }

      const label = options.label || 'Metric';
      const unit = options.unit || '';
      const color = options.color || '#0d9488';
      const targetMin = options.targetMin;
      const targetMax = options.targetMax;

      const width = options.width || 640;
      const height = options.height || 180;
      const padLeft = 40;
      const padRight = 20;
      const padTop = 20;
      const padBottom = 30;

      const plotW = width - padLeft - padRight;
      const plotH = height - padTop - padBottom;

      const vals = valid.map(d => d.value);
      let minVal = Math.min(...vals, targetMin ?? vals[0]);
      let maxVal = Math.max(...vals, targetMax ?? vals[0]);
      const margin = (maxVal - minVal) * 0.15 || 5;
      minVal = Math.floor(minVal - margin);
      maxVal = Math.ceil(maxVal + margin);

      const scaleY = (val) => padTop + plotH - ((val - minVal) / (maxVal - minVal)) * plotH;
      const scaleX = (idx) => padLeft + (valid.length === 1 ? plotW / 2 : (idx / (valid.length - 1)) * plotW);

      const coords = valid.map((p, i) => `${scaleX(i)},${scaleY(p.value)}`);

      let targetBandSvg = '';
      if (targetMin !== undefined && targetMax !== undefined) {
        const topY = scaleY(targetMax);
        const botY = scaleY(targetMin);
        targetBandSvg = `
          <rect x="${padLeft}" y="${topY}" width="${plotW}" height="${botY - topY}" fill="#ecfdf5" opacity="0.8" />
          <line x1="${padLeft}" y1="${topY}" x2="${padLeft + plotW}" y2="${topY}" stroke="#10b981" stroke-dasharray="2,2" stroke-width="1" />
        `;
      }

      const svg = `
        <svg viewBox="0 0 ${width} ${height}" class="w-full h-auto overflow-visible select-none">
          ${targetBandSvg}
          
          <!-- Polyline Trend -->
          <polyline points="${coords.join(' ')}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />

          <!-- Interactive Data Points -->
          ${valid.map((p, i) => `
            <g class="cursor-pointer group">
              <circle cx="${scaleX(i)}" cy="${scaleY(p.value)}" r="4" fill="${color}" stroke="#ffffff" stroke-width="2" />
              <text x="${scaleX(i)}" y="${scaleY(p.value) - 7}" text-anchor="middle" font-size="8.5" font-weight="bold" fill="${color}" class="opacity-0 group-hover:opacity-100 transition">${p.value}</text>
              <text x="${scaleX(i)}" y="${height - padBottom + 15}" text-anchor="middle" fill="#64748b" font-size="8" font-family="monospace">${p.date.slice(5)}</text>
            </g>
          `).join('')}
        </svg>
      `;

      const latest = valid[valid.length - 1].value;
      const avg = (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1);

      container.innerHTML = `
        <div class="space-y-2">
          <div class="flex items-center justify-between text-xs">
            <span class="font-bold text-slate-800 flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${color}"></span> ${label} Trend
            </span>
            <span class="font-mono text-slate-500 text-[11px]">Latest: <strong class="text-slate-900">${latest} ${unit}</strong> • Avg: ${avg}</span>
          </div>
          <div class="bg-white p-3 rounded-2xl border border-slate-100 shadow-inner">
            ${svg}
          </div>
        </div>
      `;
    }
  }

  root.ClinicalCharts = ClinicalCharts;
})(typeof window !== 'undefined' ? window : globalThis);
