/**
 * js/app.js
 * Orchestrator utama EduTrack AI.
 * Menghubungkan semua modul: data, analyzer, AI agent, charts, exporter.
 */

'use strict';

/* ══════════════════════════════════════════════════════════════════════════
   State
══════════════════════════════════════════════════════════════════════════ */
const AppState = {
  records:   null,    // array of row objects (aktif, bisa dari dummy atau upload)
  source:    'dummy', // 'dummy' | 'upload'
  chatHistory: [],
  currentPage: 'dashboard',
};

/* ══════════════════════════════════════════════════════════════════════════
   Bootstrap
══════════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initSidebar();
  loadDummyData();
  initAIConfig();
});

/* ── Navigasi ────────────────────────────────────────────────────────────── */
function initNav() {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', () => {
      const page = el.dataset.page;
      if (!page) return;
      navigateTo(page);
      // Close sidebar on mobile
      if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
      }
    });
  });

  document.getElementById('btn-menu')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
}

function navigateTo(page) {
  AppState.currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === page));
  document.querySelectorAll('.page').forEach(el => el.classList.toggle('active', el.id === `page-${page}`));
  const titles = {
    dashboard:   { title: 'Dashboard', sub: 'Ringkasan data akademik mahasiswa' },
    agent:       { title: 'AI Agent', sub: 'Tanya jawab cerdas berbasis data aktual' },
    visualisasi: { title: 'Visualisasi', sub: 'Chart interaktif analisis akademik' },
    insights:    { title: 'AI Insights', sub: 'Temuan pola dan rekomendasi otomatis' },
    mahasiswa:   { title: 'Data Mahasiswa', sub: 'Cari, peringkat, dan telusuri data' },
    ekspor:      { title: 'Ekspor Laporan', sub: 'Unduh laporan dalam berbagai format' },
  };
  const t = titles[page] || { title: '', sub: '' };
  document.getElementById('topbar-title').textContent = t.title;
  document.getElementById('topbar-sub').textContent   = t.sub;

  // Render page-specific content
  if (AppState.records) {
    renderPage(page);
  }
}

function renderPage(page) {
  switch (page) {
    case 'dashboard':   renderDashboard();   break;
    case 'visualisasi': renderVisualisasi(); break;
    case 'insights':    renderInsights();    break;
    case 'mahasiswa':   renderMahasiswa();   break;
    case 'ekspor':      renderEkspor();      break;
  }
}

/* ── Sidebar ─────────────────────────────────────────────────────────────── */
function initSidebar() {
  // Load Demo
  document.getElementById('btn-load-demo')?.addEventListener('click', loadDummyData);

  // Upload
  document.getElementById('upload-zone')?.addEventListener('click', () => {
    document.getElementById('file-input').click();
  });
  document.getElementById('upload-zone')?.addEventListener('dragover', e => {
    e.preventDefault();
    document.getElementById('upload-zone').style.borderColor = '#3b82f6';
  });
  document.getElementById('upload-zone')?.addEventListener('dragleave', () => {
    document.getElementById('upload-zone').style.borderColor = '';
  });
  document.getElementById('upload-zone')?.addEventListener('drop', e => {
    e.preventDefault();
    document.getElementById('upload-zone').style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  });
  document.getElementById('file-input')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) handleFileUpload(file);
    e.target.value = '';
  });
}

function loadDummyData() {
  showToast('Memuat dataset demo...', 'info');
  setTimeout(() => {
    AppState.records = getDummyDataset();
    AppState.source  = 'dummy';
    onDataLoaded();
    showToast(`✅ Dataset demo dimuat: ${AppState.records.length.toLocaleString('id-ID')} baris`, 'success');
  }, 100);
}

function handleFileUpload(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv')) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const records = parseCSV(e.target.result);
        if (!records.length) throw new Error('File kosong atau format tidak dikenali.');
        AppState.records = records;
        AppState.source  = 'upload';
        onDataLoaded();
        showToast(`✅ File CSV dimuat: ${records.length.toLocaleString('id-ID')} baris`, 'success');
      } catch (err) {
        showToast(`❌ Gagal membaca CSV: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file, 'UTF-8');
  } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const records = parseExcel(e.target.result);
        if (!records.length) throw new Error('File kosong atau format tidak dikenali.');
        AppState.records = records;
        AppState.source  = 'upload';
        onDataLoaded();
        showToast(`✅ File Excel dimuat: ${records.length.toLocaleString('id-ID')} baris`, 'success');
      } catch (err) {
        showToast(`❌ Gagal membaca Excel: ${err.message}`, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  } else {
    showToast('Format file tidak didukung. Gunakan CSV atau XLSX.', 'error');
  }
}

function onDataLoaded() {
  const n = AppState.records.length;
  const badge = document.getElementById('data-badge');
  if (badge) { badge.textContent = `${n.toLocaleString('id-ID')} baris dimuat`; badge.style.display = 'inline-block'; }
  populateFilters();
  populateMKFilter();
  renderPage(AppState.currentPage);
}

/* ── Filters ─────────────────────────────────────────────────────────────── */
function populateFilters() {
  const records = AppState.records;
  if (!records) return;

  // Prodi filter
  const prodi  = [...new Set(records.map(r => r['Program Studi']).filter(Boolean))].sort();
  const selPrd = document.getElementById('filter-prodi');
  if (selPrd) {
    selPrd.innerHTML = '<option value="">Semua Prodi</option>' +
      prodi.map(p => `<option value="${p}">${p}</option>`).join('');
    selPrd.onchange = () => renderPage(AppState.currentPage);
  }

  // Angkatan filter
  const angk   = [...new Set(records.map(r => r.Angkatan).filter(Boolean))].sort();
  const selAng = document.getElementById('filter-angkatan');
  if (selAng) {
    selAng.innerHTML = '<option value="">Semua Angkatan</option>' +
      angk.map(a => `<option value="${a}">${a}</option>`).join('');
    selAng.onchange = () => renderPage(AppState.currentPage);
  }

  // Semester slider
  const sems   = records.map(r => +r.Semester).filter(Boolean);
  const minSem = Math.min(...sems), maxSem = Math.max(...sems);
  const slider = document.getElementById('filter-semester');
  const semLbl = document.getElementById('filter-sem-label');
  if (slider) {
    slider.min = minSem; slider.max = maxSem; slider.value = maxSem;
    if (semLbl) semLbl.textContent = `1 – ${maxSem}`;
    slider.oninput = () => {
      if (semLbl) semLbl.textContent = `1 – ${slider.value}`;
      renderPage(AppState.currentPage);
    };
  }
}

function getFilteredRecords() {
  let records = AppState.records || [];
  const prodi  = document.getElementById('filter-prodi')?.value;
  const angk   = document.getElementById('filter-angkatan')?.value;
  const semMax = +document.getElementById('filter-semester')?.value || 8;
  if (prodi) records = records.filter(r => r['Program Studi'] === prodi);
  if (angk)  records = records.filter(r => String(r.Angkatan) === angk);
  records = records.filter(r => !r.Semester || +r.Semester <= semMax);
  return records;
}

/* ══════════════════════════════════════════════════════════════════════════
   Page: Dashboard
══════════════════════════════════════════════════════════════════════════ */
function renderDashboard() {
  const records = getFilteredRecords();
  if (!records.length) return;
  const stats = getSummaryStats(records);

  setById('kpi-mahasiswa',  stats.totalMahasiswa.toLocaleString('id-ID'));
  setById('kpi-nilai',      stats.rataRataNilai);
  setById('kpi-ipk',        stats.rataRataIPK);
  setById('kpi-kehadiran',  stats.rataRataKehadiran + '%');
  setById('kpi-prodi',      stats.totalProdi);
  setById('kpi-mk',         stats.totalMK);

  // Quality metrics
  const quality = getDataQuality(AppState.records);
  setById('kpi-missing',    quality.missingTotal);
  setById('kpi-duplikat',   quality.duplicates);

  // Charts
  renderValueDistribution(records, 'chart-dist');
  renderGradePie(records, 'chart-grade-pie');
  renderSemesterTrend(records, 'chart-semester');
  renderProdiGroupedBar(records, 'chart-prodi-bar');
  renderIPKByProdi(records, 'chart-ipk-prodi');

  // Quick insights (top 3)
  const insights = generateInsights(records).slice(0, 3);
  const container = document.getElementById('quick-insights');
  if (container) {
    container.innerHTML = insights.map(i =>
      `<div class="insight-item ${i.type}">${i.text}</div>`
    ).join('');
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Page: Visualisasi
══════════════════════════════════════════════════════════════════════════ */
function renderVisualisasi() {
  const records = getFilteredRecords();
  if (!records.length) return;

  renderValueDistribution(records, 'viz-chart-dist');
  renderGradePie(records, 'viz-chart-grade');
  renderSemesterTrend(records, 'viz-chart-semester');
  renderCoursePassingRate(records, 'viz-chart-passing');
  renderCourseComparison(records, 'viz-chart-course');
  renderAttendanceScatter(records, 'viz-chart-scatter');
  renderProdiGroupedBar(records, 'viz-chart-prodi');
  renderProdiRadar(records, 'viz-chart-radar');
  renderRiskScatter(records, 'viz-chart-risk');

  // Correlation info
  const corr = analyzeAttendanceVsGrade(records);
  setById('corr-r',    corr.r);
  setById('corr-p',    corr.p);
  setById('corr-str',  corr.strength.charAt(0).toUpperCase() + corr.strength.slice(1));
  setById('corr-interp', corr.interpretasi);

  // Course table
  renderTableById('tbl-courses', getCourseStats(records),
    ['Mata Kuliah','Rata-rata Nilai','Std Nilai','Jumlah Peserta','Lulus','Tingkat Kelulusan (%)']);
}

/* ── Tabs in Visualisasi ────────────────────────────────────────────────── */
function initVizTabs() {
  document.querySelectorAll('#page-visualisasi .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      document.querySelectorAll('#page-visualisasi .tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('#page-visualisasi .tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(target)?.classList.add('active');
      // Re-render charts in newly visible tab
      if (AppState.records) renderVisualisasi();
    });
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   Page: Insights
══════════════════════════════════════════════════════════════════════════ */
function renderInsights() {
  const records = getFilteredRecords();
  if (!records.length) return;

  const insights   = generateInsights(records);
  const container  = document.getElementById('insights-grid');
  if (container) {
    container.innerHTML = insights.map(i =>
      `<div class="insight-item ${i.type}">${i.text}</div>`
    ).join('');
  }

  // Risk table with threshold sliders
  renderRiskTable(records);

  // Quality report
  const q = getDataQuality(AppState.records);
  setById('qual-total',   q.total.toLocaleString('id-ID'));
  setById('qual-cols',    q.columns);
  setById('qual-missing', q.missingTotal);
  setById('qual-dup',     q.duplicates);

  const missDetail = document.getElementById('miss-detail');
  if (missDetail) {
    if (Object.keys(q.missing).length) {
      missDetail.innerHTML = Object.entries(q.missing).map(([k,v]) =>
        `<div class="legend-row"><span class="legend-dot" style="background:var(--warn)"></span> ${k}: <strong>${v}</strong> kosong (${round2(v/q.total*100)}%)</div>`
      ).join('');
    } else {
      missDetail.innerHTML = '<span style="color:var(--success)">✅ Tidak ada nilai kosong.</span>';
    }
  }
}

function renderRiskTable(records) {
  const nilaiT = +document.getElementById('risk-nilai')?.value || 55;
  const kehadT = +document.getElementById('risk-kehad')?.value || 70;
  const risk   = getAtRiskStudents(records, nilaiT, kehadT);
  const nHigh  = risk.filter(r => r.Status === 'Prioritas Tinggi').length;

  setById('risk-count', risk.length);
  setById('risk-high',  nHigh);

  renderTableById('tbl-risk', risk,
    ['NIM','Nama','Program Studi','Angkatan','Rata-rata Nilai','Rata-rata Kehadiran','IPK','Status'],
    r => r.Status === 'Prioritas Tinggi' ? 'danger' : 'warn');
}

function initRiskSliders() {
  ['risk-nilai', 'risk-kehad'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const lbl = document.getElementById(id + '-val');
    el.oninput = () => {
      if (lbl) lbl.textContent = el.value;
      if (AppState.records) renderRiskTable(getFilteredRecords());
    };
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   Page: Data Mahasiswa
══════════════════════════════════════════════════════════════════════════ */
function renderMahasiswa() {
  const records = getFilteredRecords();
  if (!records.length) return;
  // Initially show full table
  renderTableById('tbl-mahasiswa', cleanData(records).slice(0, 200),
    ['NIM','Nama','Program Studi','Angkatan','Semester','Mata Kuliah','Nilai','Grade','IPK','Kehadiran (%)']);

  // Top & bottom
  renderTableById('tbl-top', getTopStudents(records, 20, 'IPK'),
    ['NIM','Nama','Program Studi','Angkatan','Semester','Rata-rata Nilai','IPK','Rata-rata Kehadiran']);
  renderTableById('tbl-bottom', getBottomStudents(records, 20),
    ['NIM','Nama','Program Studi','Angkatan','Semester','Rata-rata Nilai','IPK','Rata-rata Kehadiran']);
}

function initMahasiswaTabs() {
  document.querySelectorAll('#page-mahasiswa .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#page-mahasiswa .tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('#page-mahasiswa .tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab)?.classList.add('active');
    });
  });

  // Search
  document.getElementById('search-btn')?.addEventListener('click', doSearch);
  document.getElementById('search-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

  // MK filter for full table
  document.getElementById('filter-mk')?.addEventListener('change', () => {
    if (AppState.records) renderFilteredTable();
  });
  document.getElementById('filter-grade')?.addEventListener('change', () => {
    if (AppState.records) renderFilteredTable();
  });
}

function doSearch() {
  const kw      = document.getElementById('search-input')?.value?.trim();
  const records = getFilteredRecords();
  if (!kw) { showToast('Masukkan kata kunci pencarian.', 'info'); return; }
  const found = searchStudents(records, kw);
  if (!found.length) {
    document.getElementById('search-results')?.innerHTML = `<div class="empty-state"><div class="es-icon">🔍</div><h3>Tidak Ditemukan</h3><p>Tidak ada mahasiswa dengan kata kunci "<strong>${kw}</strong>".</p></div>`;
    return;
  }
  renderTableById('search-results', found,
    ['NIM','Nama','Program Studi','Angkatan','Semester','Mata Kuliah','Nilai','Grade','IPK','Kehadiran (%)']);
  showToast(`Ditemukan ${found.length} entri untuk "${kw}"`, 'success');
}

function populateMKFilter() {
  const records = AppState.records;
  if (!records) return;
  const mks = [...new Set(records.map(r => r['Mata Kuliah']).filter(Boolean))].sort();
  const sel = document.getElementById('filter-mk');
  if (sel) sel.innerHTML = '<option value="">Semua Mata Kuliah</option>' + mks.map(m => `<option>${m}</option>`).join('');
  const grades = ['A','B+','B','C+','C','D','E'];
  const gSel = document.getElementById('filter-grade');
  if (gSel) gSel.innerHTML = '<option value="">Semua Grade</option>' + grades.map(g => `<option>${g}</option>`).join('');
}

function renderFilteredTable() {
  let records = cleanData(getFilteredRecords());
  const mk    = document.getElementById('filter-mk')?.value;
  const grade = document.getElementById('filter-grade')?.value;
  if (mk)    records = records.filter(r => r['Mata Kuliah'] === mk);
  if (grade) records = records.filter(r => r.Grade === grade);
  renderTableById('tbl-mahasiswa', records.slice(0, 500),
    ['NIM','Nama','Program Studi','Angkatan','Semester','Mata Kuliah','Nilai','Grade','IPK','Kehadiran (%)']);
  document.getElementById('tbl-count')?.textContent && (document.getElementById('tbl-count').textContent = `${records.length.toLocaleString('id-ID')} baris`);
}

/* ══════════════════════════════════════════════════════════════════════════
   Page: Ekspor
══════════════════════════════════════════════════════════════════════════ */
function renderEkspor() {
  const records = getFilteredRecords();
  if (!records.length) return;
  const stats = getSummaryStats(records);
  setById('exp-mahasiswa', stats.totalMahasiswa.toLocaleString('id-ID'));
  setById('exp-entri',     stats.totalEntri.toLocaleString('id-ID'));
  setById('exp-ipk',       stats.rataRataIPK);

  // Preview tables
  renderTableById('exp-tbl-top', getTopStudents(records, 10, 'IPK'),
    ['NIM','Nama','Program Studi','IPK','Rata-rata Nilai']);
  renderTableById('exp-tbl-courses', getCourseStats(records),
    ['Mata Kuliah','Rata-rata Nilai','Jumlah Peserta','Tingkat Kelulusan (%)']);
}

function initExpor() {
  document.getElementById('btn-dl-csv')?.addEventListener('click', () => {
    if (!AppState.records) return showToast('Muat data terlebih dahulu.','error');
    downloadCSV(getFilteredRecords(), `edutrack_data_${dateStamp()}.csv`);
    showToast('✅ CSV diunduh!','success');
  });
  document.getElementById('btn-dl-excel')?.addEventListener('click', () => {
    if (!AppState.records) return showToast('Muat data terlebih dahulu.','error');
    downloadExcel(getFilteredRecords(), `edutrack_laporan_${dateStamp()}.xlsx`);
    showToast('✅ Excel diunduh!','success');
  });
  document.getElementById('btn-dl-html')?.addEventListener('click', () => {
    if (!AppState.records) return showToast('Muat data terlebih dahulu.','error');
    downloadHTMLReport(getFilteredRecords());
    showToast('✅ Laporan HTML diunduh!','success');
  });
  document.getElementById('btn-dl-dummy-csv')?.addEventListener('click', () => {
    downloadDummyCSV();
    showToast('✅ Dataset demo CSV diunduh!','success');
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   Page: AI Agent
══════════════════════════════════════════════════════════════════════════ */
function initAgent() {
  const form  = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');

  form?.addEventListener('submit', async e => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;
    input.value = '';
    await sendMessage(q);
  });

  document.querySelectorAll('.chip').forEach(c => {
    c.addEventListener('click', async () => {
      await sendMessage(c.textContent.trim());
    });
  });

  document.getElementById('btn-clear-chat')?.addEventListener('click', () => {
    AppState.chatHistory = [];
    const area = document.getElementById('chat-area');
    if (area) area.innerHTML = '';
    showToast('Riwayat chat dihapus','info');
  });
}

async function sendMessage(query) {
  const records = AppState.records;
  appendChatBubble('user', query);
  scrollChatBottom();

  const thinking = appendChatBubble('agent', '⏳ Menganalisis...', true);
  try {
    const res = await askAgent(query, records);
    thinking.remove();
    const bubble = appendChatBubble('agent', res.text);

    if (res.data && res.table && Array.isArray(res.data) && res.data.length) {
      const cols    = Object.keys(res.data[0]).filter(k => !['nilaiArr','kehadArr','ipkArr','mkSet'].includes(k));
      const btnWrap = document.createElement('div');
      btnWrap.style.marginTop = '6px';
      const btn = document.createElement('button');
      btn.className = 'chat-data-btn';
      btn.textContent = `📋 Lihat data (${res.data.length} baris)`;
      let expanded = false;
      btn.onclick = () => {
        expanded = !expanded;
        const existing = btnWrap.querySelector('.inline-table');
        if (expanded && !existing) {
          const wrapper = document.createElement('div');
          wrapper.className = 'inline-table';
          wrapper.style = 'margin-top:8px; max-height:240px; overflow:auto; border-radius:6px';
          renderTableInEl(wrapper, res.data.slice(0, 50), cols);
          btnWrap.appendChild(wrapper);
          btn.textContent = '▲ Sembunyikan';
        } else if (!expanded && existing) {
          existing.remove();
          btn.textContent = `📋 Lihat data (${res.data.length} baris)`;
        }
      };
      btnWrap.appendChild(btn);
      bubble.querySelector('.chat-bubble').appendChild(btnWrap);
    }
  } catch (err) {
    thinking.remove();
    appendChatBubble('agent', `❌ Terjadi kesalahan: ${err.message}`);
  }
  scrollChatBottom();
}

function appendChatBubble(role, text, isTemp = false) {
  const area = document.getElementById('chat-area');
  if (!area) return { remove: () => {} };
  const wrap = document.createElement('div');
  wrap.className = `chat-msg ${role}`;
  const lbl  = document.createElement('div');
  lbl.className = 'chat-label';
  lbl.textContent = role === 'user' ? 'Anda' : '🤖 EduTrack AI';
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  // Render markdown-lite: **bold**, \n
  bubble.innerHTML = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
  wrap.appendChild(lbl);
  wrap.appendChild(bubble);
  area.appendChild(wrap);
  return wrap;
}

function scrollChatBottom() {
  const area = document.getElementById('chat-area');
  if (area) area.scrollTop = area.scrollHeight;
}

/* ── AI Config ───────────────────────────────────────────────────────────── */
function initAIConfig() {
  document.getElementById('btn-save-config')?.addEventListener('click', () => {
    const mode  = document.getElementById('ai-mode')?.value || 'local';
    const key   = document.getElementById('ai-apikey')?.value?.trim() || '';
    const model = document.getElementById('ai-model')?.value || 'gpt-4o-mini';
    const url   = document.getElementById('ai-url')?.value?.trim() || 'https://api.openai.com/v1/chat/completions';
    setAgentConfig({ mode, apiKey: key, model, apiUrl: url });
    showToast(`✅ Konfigurasi disimpan (mode: ${mode})`, 'success');
    document.getElementById('ai-mode')?.dispatchEvent(new Event('change'));
  });
  document.getElementById('ai-mode')?.addEventListener('change', function() {
    const apiFields = document.getElementById('api-fields');
    if (apiFields) apiFields.style.display = this.value === 'api' ? 'block' : 'none';
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   Helpers
══════════════════════════════════════════════════════════════════════════ */
function setById(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function renderTableById(id, rows, cols, rowClassFn = null) {
  const el = document.getElementById(id);
  if (!el) return;
  renderTableInEl(el, rows, cols, rowClassFn);
}

function renderTableInEl(el, rows, cols, rowClassFn = null) {
  if (!rows || !rows.length) {
    el.innerHTML = '<div class="empty-state" style="padding:24px"><div class="es-icon">📭</div><p>Tidak ada data.</p></div>';
    return;
  }
  const headerHTML = cols.map(c => `<th data-col="${c}">${c}</th>`).join('');
  const bodyHTML   = rows.map(r => {
    const cls = rowClassFn ? rowClassFn(r) : '';
    const tds = cols.map(c => {
      const v  = r[c];
      const vs = v === null || v === undefined ? '—' : String(v);
      // Badge for Status
      if (c === 'Status') {
        const bClass = v === 'Prioritas Tinggi' ? 'badge-danger' : 'badge-warn';
        return `<td><span class="badge ${bClass}">${vs}</span></td>`;
      }
      // Badge for Grade
      if (c === 'Grade') {
        const bClass = ['A','B+'].includes(v) ? 'badge-success' : v === 'E' || v === 'D' ? 'badge-danger' : 'badge-info';
        return `<td><span class="badge ${bClass}">${vs}</span></td>`;
      }
      return `<td>${vs}</td>`;
    }).join('');
    return `<tr class="${cls}">${tds}</tr>`;
  }).join('');

  el.innerHTML = `<div class="table-wrapper"><table><thead><tr>${headerHTML}</tr></thead><tbody>${bodyHTML}</tbody></table></div>`;

  // Sortable
  el.querySelectorAll('thead th').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      const dir = th.classList.contains('sort-asc') ? -1 : 1;
      el.querySelectorAll('thead th').forEach(h => h.classList.remove('sort-asc','sort-desc'));
      th.classList.add(dir === 1 ? 'sort-asc' : 'sort-desc');
      const sorted = [...rows].sort((a,b) => {
        const av = a[col], bv = b[col];
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        return typeof av === 'number' ? dir*(av-bv) : dir*String(av).localeCompare(String(bv));
      });
      renderTableInEl(el, sorted, cols, rowClassFn);
    });
  });
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function round2(v) { return Math.round(v * 100) / 100; }
function dateStamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}_${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}`;
}

/* ── Init page-specific interactions (called once after DOM ready) ─────── */
document.addEventListener('DOMContentLoaded', () => {
  initVizTabs();
  initMahasiswaTabs();
  initRiskSliders();
  initAgent();
  initExpor();
  // Default active page
  navigateTo('dashboard');
});
