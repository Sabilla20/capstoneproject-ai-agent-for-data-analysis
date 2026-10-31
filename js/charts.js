/**
 * js/charts.js
 * Semua visualisasi menggunakan Chart.js.
 * Setiap fungsi menerima data dan id canvas, mengembalikan Chart instance.
 */

'use strict';

// Warna global
const COLORS = {
  blue:   '#3b82f6', blue2:   '#1d4ed8', sky:    '#0ea5e9',
  green:  '#22c55e', emerald: '#10b981', teal:   '#14b8a6',
  yellow: '#f59e0b', orange:  '#f97316',
  red:    '#ef4444', rose:    '#f43f5e',
  purple: '#7c3aed', violet:  '#8b5cf6',
  gray:   '#6b7280', slate:   '#64748b',
};

const PALETTE = [
  COLORS.blue, COLORS.green, COLORS.yellow, COLORS.red, COLORS.purple,
  COLORS.sky, COLORS.orange, COLORS.emerald,
];

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: { labels: { font: { family: "'Segoe UI', system-ui, sans-serif", size: 11 }, color: '#374151' } },
    tooltip: { backgroundColor: '#1e293b', titleFont: { size: 12 }, bodyFont: { size: 11 }, padding: 10, cornerRadius: 6 },
  },
  animation: { duration: 600, easing: 'easeOutQuart' },
};

// Store for chart instances so we can destroy on re-render
const _charts = {};

function destroyChart(id) {
  if (_charts[id]) { _charts[id].destroy(); delete _charts[id]; }
}

function getCtx(id) {
  const canvas = document.getElementById(id);
  if (!canvas) return null;
  destroyChart(id);
  return canvas.getContext('2d');
}

/* ── 1. Histogram distribusi nilai ─────────────────────────────────────────*/
function renderValueDistribution(records, canvasId) {
  const ctx = getCtx(canvasId); if (!ctx) return;
  const clean = cleanData(records);
  const values = clean.map(r => r.Nilai).filter(v => v !== null);

  // Histogram bins 0-10, 10-20, ..., 90-100
  const bins = Array.from({length: 10}, (_,i) => ({ label: `${i*10}–${i*10+10}`, count: 0 }));
  values.forEach(v => {
    const idx = Math.min(9, Math.floor(v / 10));
    bins[idx].count++;
  });

  _charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: bins.map(b => b.label),
      datasets: [{
        label: 'Jumlah Mahasiswa',
        data: bins.map(b => b.count),
        backgroundColor: bins.map((_,i) => {
          const v = i * 10 + 5;
          return v >= 75 ? COLORS.green+'cc' : v >= 55 ? COLORS.blue+'cc' : COLORS.red+'cc';
        }),
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      ...CHART_DEFAULTS,
      scales: {
        x: { title: { display: true, text: 'Rentang Nilai', color: '#6b7280' }, grid: { display: false } },
        y: { title: { display: true, text: 'Jumlah', color: '#6b7280' }, grid: { color: '#f3f4f6' }, beginAtZero: true },
      },
    },
  });
}

/* ── 2. Pie/Doughnut distribusi grade ───────────────────────────────────────*/
function renderGradePie(records, canvasId) {
  const ctx = getCtx(canvasId); if (!ctx) return;
  const dist = getGradeDistribution(records);
  const gradeColors = { A: COLORS.green, 'B+': COLORS.emerald, B: COLORS.blue, 'C+': COLORS.sky, C: COLORS.yellow, D: COLORS.orange, E: COLORS.red };

  _charts[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: dist.map(d => d.Grade),
      datasets: [{
        data: dist.map(d => d.Jumlah),
        backgroundColor: dist.map(d => gradeColors[d.Grade] || COLORS.gray),
        borderWidth: 2, borderColor: '#fff', hoverOffset: 8,
      }],
    },
    options: {
      ...CHART_DEFAULTS,
      cutout: '50%',
      plugins: {
        ...CHART_DEFAULTS.plugins,
        legend: { position: 'right', labels: { font: { size: 11 }, padding: 10 } },
        tooltip: {
          ...CHART_DEFAULTS.plugins.tooltip,
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.parsed.toLocaleString('id-ID')} (${dist[ctx.dataIndex]['Persentase (%)']}%)`,
          },
        },
      },
    },
  });
}

/* ── 3. Bar + Line tren semester ────────────────────────────────────────────*/
function renderSemesterTrend(records, canvasId) {
  const ctx = getCtx(canvasId); if (!ctx) return;
  const trend = getSemesterTrend(records);

  _charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: trend.map(t => `Semester ${t.Semester}`),
      datasets: [
        {
          label: 'Rata-rata Nilai',
          data: trend.map(t => t['Rata-rata Nilai']),
          backgroundColor: COLORS.blue + '99',
          borderColor: COLORS.blue, borderWidth: 1.5,
          borderRadius: 5, yAxisID: 'y',
        },
        {
          label: 'Rata-rata IPK (×25)',
          data: trend.map(t => round2(t['Rata-rata IPK'] * 25)),
          type: 'line', tension: 0.4,
          borderColor: COLORS.red, pointBackgroundColor: COLORS.red,
          backgroundColor: 'transparent', borderWidth: 2.5,
          pointRadius: 5, yAxisID: 'y',
        },
      ],
    },
    options: {
      ...CHART_DEFAULTS,
      scales: {
        y: { beginAtZero: false, min: 40, max: 100, title: { display: true, text: 'Nilai / IPK×25', color: '#6b7280' }, grid: { color: '#f3f4f6' } },
        x: { grid: { display: false } },
      },
    },
  });
}

/* ── 4. Horizontal bar tingkat kelulusan per MK ─────────────────────────────*/
function renderCoursePassingRate(records, canvasId) {
  const ctx = getCtx(canvasId); if (!ctx) return;
  const stats = getCourseStats(records).slice(0, 15).reverse();

  _charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: stats.map(s => s['Mata Kuliah']),
      datasets: [{
        label: 'Tingkat Kelulusan (%)',
        data: stats.map(s => s['Tingkat Kelulusan (%)']),
        backgroundColor: stats.map(s =>
          s['Tingkat Kelulusan (%)'] < 60 ? COLORS.red+'cc'
          : s['Tingkat Kelulusan (%)'] < 80 ? COLORS.yellow+'cc'
          : COLORS.green+'cc'),
        borderRadius: 4,
        borderSkipped: false,
      }],
    },
    options: {
      ...CHART_DEFAULTS,
      indexAxis: 'y',
      scales: {
        x: { beginAtZero: true, max: 110, title: { display: true, text: 'Tingkat Kelulusan (%)' }, grid: { color: '#f3f4f6' } },
        y: { ticks: { font: { size: 10 } }, grid: { display: false } },
      },
      plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } },
    },
  });
}

/* ── 5. Bar perbandingan nilai rata-rata per MK ─────────────────────────────*/
function renderCourseComparison(records, canvasId) {
  const ctx = getCtx(canvasId); if (!ctx) return;
  const stats = getCourseStats(records).slice(0, 15);

  _charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: stats.map(s => s['Mata Kuliah']),
      datasets: [{
        label: 'Rata-rata Nilai',
        data: stats.map(s => s['Rata-rata Nilai']),
        backgroundColor: PALETTE.concat(PALETTE).slice(0, stats.length).map(c => c+'cc'),
        borderRadius: 5, borderSkipped: false,
      }],
    },
    options: {
      ...CHART_DEFAULTS,
      scales: {
        y: { beginAtZero: false, min: 40, max: 100, title: { display: true, text: 'Rata-rata Nilai' }, grid: { color: '#f3f4f6' } },
        x: { ticks: { maxRotation: 35, font: { size: 10 } }, grid: { display: false } },
      },
      plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } },
    },
  });
}

/* ── 6. Scatter kehadiran vs nilai ──────────────────────────────────────────*/
function renderAttendanceScatter(records, canvasId) {
  const ctx = getCtx(canvasId); if (!ctx) return;
  const clean = cleanData(records).filter(r => r.Nilai !== null && r['Kehadiran (%)'] !== null);

  // Sample max 800 points for performance
  const sample = clean.length > 800 ? (() => {
    const step = Math.ceil(clean.length / 800);
    return clean.filter((_, i) => i % step === 0);
  })() : clean;

  // Trendline
  const corr  = analyzeAttendanceVsGrade(records);
  const xMin  = Math.min(...sample.map(r => r['Kehadiran (%)']));
  const xMax  = Math.max(...sample.map(r => r['Kehadiran (%)']));
  const trendData = [
    { x: xMin, y: round2(corr.slope * xMin + corr.intercept) },
    { x: xMax, y: round2(corr.slope * xMax + corr.intercept) },
  ];

  // Color by prodi
  const prodiList = [...new Set(sample.map(r => r['Program Studi']))];
  const datasets  = prodiList.map((prodi, i) => ({
    label: prodi,
    data: sample.filter(r => r['Program Studi'] === prodi).map(r => ({ x: r['Kehadiran (%)'], y: r.Nilai })),
    backgroundColor: PALETTE[i % PALETTE.length] + '88',
    pointRadius: 3.5, pointHoverRadius: 6,
  }));

  // Add trendline
  datasets.push({
    label: 'Garis Tren',
    data: trendData,
    type: 'line',
    borderColor: COLORS.red,
    backgroundColor: 'transparent',
    borderWidth: 2.5,
    borderDash: [5, 4],
    pointRadius: 0,
    tension: 0,
    order: -1,
  });

  _charts[canvasId] = new Chart(ctx, {
    type: 'scatter',
    data: { datasets },
    options: {
      ...CHART_DEFAULTS,
      scales: {
        x: { title: { display: true, text: 'Kehadiran (%)' }, min: 35, max: 105, grid: { color: '#f3f4f6' } },
        y: { title: { display: true, text: 'Nilai' }, min: 0, max: 105, grid: { color: '#f3f4f6' } },
      },
      plugins: { ...CHART_DEFAULTS.plugins, legend: { position: 'top' } },
    },
  });
}

/* ── 7. Radar chart perbandingan prodi ──────────────────────────────────────*/
function renderProdiRadar(records, canvasId) {
  const ctx = getCtx(canvasId); if (!ctx) return;
  const prodi = getProdiStats(records);

  _charts[canvasId] = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Rata-rata Nilai', 'IPK (×25)', 'Kehadiran (%)'],
      datasets: prodi.map((p, i) => ({
        label: p['Program Studi'],
        data: [p['Rata-rata Nilai'], round2(p['Rata-rata IPK'] * 25), p['Rata-rata Kehadiran']],
        backgroundColor: PALETTE[i % PALETTE.length] + '33',
        borderColor: PALETTE[i % PALETTE.length],
        borderWidth: 2, pointRadius: 4,
      })),
    },
    options: {
      ...CHART_DEFAULTS,
      scales: {
        r: {
          beginAtZero: false, min: 50, max: 100,
          ticks: { stepSize: 10, font: { size: 9 } },
          grid: { color: '#e5e7eb' },
          pointLabels: { font: { size: 11 } },
        },
      },
      plugins: { ...CHART_DEFAULTS.plugins, legend: { position: 'bottom' } },
    },
  });
}

/* ── 8. Grouped bar perbandingan prodi ──────────────────────────────────────*/
function renderProdiGroupedBar(records, canvasId) {
  const ctx = getCtx(canvasId); if (!ctx) return;
  const prodi = getProdiStats(records);

  _charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: prodi.map(p => p['Program Studi'].replace(' ', '\n')),
      datasets: [
        { label: 'Rata-rata Nilai', data: prodi.map(p => p['Rata-rata Nilai']), backgroundColor: COLORS.blue+'cc', borderRadius: 4 },
        { label: 'Rata-rata Kehadiran (%)', data: prodi.map(p => p['Rata-rata Kehadiran']), backgroundColor: COLORS.green+'cc', borderRadius: 4 },
      ],
    },
    options: {
      ...CHART_DEFAULTS,
      scales: {
        y: { beginAtZero: false, min: 50, max: 100, grid: { color: '#f3f4f6' } },
        x: { ticks: { font: { size: 10 } }, grid: { display: false } },
      },
    },
  });
}

/* ── 9. Line IPK per prodi ───────────────────────────────────────────────── */
function renderIPKByProdi(records, canvasId) {
  const ctx = getCtx(canvasId); if (!ctx) return;
  const prodi = getProdiStats(records).sort((a,b) => b['Rata-rata IPK'] - a['Rata-rata IPK']);

  _charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: prodi.map(p => p['Program Studi']),
      datasets: [{
        label: 'Rata-rata IPK',
        data: prodi.map(p => p['Rata-rata IPK']),
        backgroundColor: PALETTE.slice(0, prodi.length).map(c => c+'cc'),
        borderRadius: 5,
        borderSkipped: false,
      }],
    },
    options: {
      ...CHART_DEFAULTS,
      scales: {
        y: { beginAtZero: false, min: 1.5, max: 4.0, title: { display: true, text: 'IPK' }, grid: { color: '#f3f4f6' } },
        x: { ticks: { font: { size: 10 } }, grid: { display: false } },
      },
      plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } },
    },
  });
}

/* ── 10. Risk scatter (canvas fallback) ─────────────────────────────────────*/
function renderRiskScatter(records, canvasId) {
  const ctx = getCtx(canvasId); if (!ctx) return;
  const per = aggregatePerMahasiswa(records);

  const normal = per.filter(m => m['Rata-rata Nilai'] >= 55 && m['Rata-rata Kehadiran'] >= 70);
  const attn   = per.filter(m => (m['Rata-rata Nilai'] < 55 || m['Rata-rata Kehadiran'] < 70)
                                && !(m['Rata-rata Nilai'] < 55 && m['Rata-rata Kehadiran'] < 70));
  const high   = per.filter(m => m['Rata-rata Nilai'] < 55 && m['Rata-rata Kehadiran'] < 70);

  const makeDS = (label, data, color) => ({
    label, data: data.map(m => ({ x: m['Rata-rata Kehadiran'], y: m['Rata-rata Nilai'] })),
    backgroundColor: color, pointRadius: 5, pointHoverRadius: 7,
  });

  _charts[canvasId] = new Chart(ctx, {
    type: 'scatter',
    data: { datasets: [
      makeDS('Normal', normal, COLORS.green+'99'),
      makeDS('Butuh Perhatian', attn, COLORS.yellow+'bb'),
      makeDS('Prioritas Tinggi', high, COLORS.red+'bb'),
    ]},
    options: {
      ...CHART_DEFAULTS,
      scales: {
        x: { title: { display: true, text: 'Rata-rata Kehadiran (%)' }, min: 35, max: 105, grid: { color: '#f3f4f6' } },
        y: { title: { display: true, text: 'Rata-rata Nilai' }, min: 0, max: 105, grid: { color: '#f3f4f6' } },
      },
      plugins: {
        ...CHART_DEFAULTS.plugins,
        annotation: undefined, // no annotation plugin needed
      },
    },
    plugins: [{
      id: 'thresholdLines',
      afterDraw(chart) {
        const { ctx: c, scales: { x, y } } = chart;
        c.save();
        c.setLineDash([5,4]);
        c.strokeStyle = COLORS.red + 'aa';
        c.lineWidth = 1.5;
        // horizontal at y=55
        const yPx = y.getPixelForValue(55);
        c.beginPath(); c.moveTo(x.left, yPx); c.lineTo(x.right, yPx); c.stroke();
        // vertical at x=70
        const xPx = x.getPixelForValue(70);
        c.beginPath(); c.moveTo(xPx, y.top); c.lineTo(xPx, y.bottom); c.stroke();
        c.restore();
      },
    }],
  });
}

/* ── Helper ─────────────────────────────────────────────────────────────────*/
function round2(v) { return Math.round(v * 100) / 100; }

/* ── Refresh all charts on resize ───────────────────────────────────────────*/
window.addEventListener('resize', () => {
  Object.values(_charts).forEach(c => c && c.resize && c.resize());
});
