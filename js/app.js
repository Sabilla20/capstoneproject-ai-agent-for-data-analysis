/**
 * js/app.js  –  EduTrack AI Orchestrator
 *
 * Satu titik masuk: satu DOMContentLoaded.
 * Urutan: init UI → load data → render halaman awal.
 */

'use strict';

/* ══════════════════════════════════════════════════════════════════════════
   Global state
══════════════════════════════════════════════════════════════════════════ */
const AppState = {
  records:     null,   // Array<Object>  –  data aktif (dummy atau upload)
  source:      'dummy',
  currentPage: 'dashboard',
  chatHistory: [],
};

/* ══════════════════════════════════════════════════════════════════════════
   Bootstrap  –  SATU event listener, SATU titik masuk
══════════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initSidebarButtons();
  initVizTabs();
  initMahasiswaTabs();
  initRiskSliders();
  initAgent();
  initExpor();
  initAIConfig();

  // Muat data demo lalu render halaman awal
  loadDummyData();
});

/* ══════════════════════════════════════════════════════════════════════════
   Navigasi
══════════════════════════════════════════════════════════════════════════ */
function initNav() {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', () => {
      const page = el.dataset.page;
      if (page) navigateTo(page);
      if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
      }
    });
  });

  document.getElementById('btn-menu')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
}

const PAGE_META = {
  dashboard:   { title: 'Dashboard',        sub: 'Ringkasan data akademik mahasiswa' },
  agent:       { title: 'AI Agent',          sub: 'Tanya jawab cerdas berbasis data aktual' },
  visualisasi: { title: 'Visualisasi',       sub: 'Chart interaktif analisis akademik' },
  insights:    { title: 'AI Insights',       sub: 'Temuan pola dan rekomendasi otomatis' },
  mahasiswa:   { title: 'Data Mahasiswa',    sub: 'Cari, peringkat, dan telusuri data' },
  ekspor:      { title: 'Ekspor Laporan',    sub: 'Unduh laporan dalam berbagai format' },
};

function navigateTo(page) {
  AppState.currentPage = page;

  // Aktifkan nav item
  document.querySelectorAll('.nav-item').forEach(el =>
    el.classList.toggle('active', el.dataset.page === page)
  );

  // Tampilkan section yang sesuai
  document.querySelectorAll('.page').forEach(el =>
    el.classList.toggle('active', el.id === `page-${page}`)
  );

  // Update topbar
  const meta = PAGE_META[page] || { title: page, sub: '' };
  const ttEl = document.getElementById('topbar-title');
  const sbEl = document.getElementById('topbar-sub');
  if (ttEl) ttEl.textContent = meta.title;
  if (sbEl) sbEl.textContent = meta.sub;

  // Render konten halaman jika data sudah ada
  if (AppState.records) renderPage(page);
}

function renderPage(page) {
  switch (page) {
    case 'dashboard':   renderDashboard();   break;
    case 'visualisasi': renderVisualisasi(); break;
    case 'insights':    renderInsights();    break;
    case 'mahasiswa':   renderMahasiswa();   break;
    case 'ekspor':      renderEkspor();      break;
    // 'agent' tidak perlu re-render chart
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Data Loading
══════════════════════════════════════════════════════════════════════════ */
function loadDummyData() {
  showToast('Memuat dataset demo…', 'info');

  // Gunakan setTimeout agar UI dapat merender toast lebih dahulu
  setTimeout(() => {
    try {
      AppState.records = getDummyDataset();
      AppState.source  = 'dummy';
      onDataReady('demo');
    } catch (e) {
      showToast('❌ Gagal generate data: ' + e.message, 'error');
    }
  }, 50);
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
        onDataReady('CSV');
      } catch (err) {
        showToast('❌ Gagal membaca CSV: ' + err.message, 'error');
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
        onDataReady('Excel');
      } catch (err) {
        showToast('❌ Gagal membaca Excel: ' + err.message, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  } else {
    showToast('Format tidak didukung. Gunakan .csv / .xlsx', 'error');
  }
}

/** Dipanggil setiap kali data baru berhasil dimuat */
function onDataReady(label) {
  const n     = AppState.records.length;
  const badge = document.getElementById('data-badge');
  if (badge) {
    badge.textContent    = `${n.toLocaleString('id-ID')} baris dimuat`;
    badge.style.display  = 'inline-block';
  }

  const infoEl = document.getElementById('topbar-info');
  if (infoEl) infoEl.textContent = `${label} · ${n.toLocaleString('id-ID')} entri`;

  populateSidebarFilters();
  populateMKGradeFilters();
  renderPage(AppState.currentPage);   // render halaman yang sedang aktif

  showToast(`✅ Data dimuat (${n.toLocaleString('id-ID')} baris)`, 'success');
}

/* ══════════════════════════════════════════════════════════════════════════
   Sidebar Buttons
══════════════════════════════════════════════════════════════════════════ */
function initSidebarButtons() {
  // Tombol muat demo
  document.getElementById('btn-load-demo')?.addEventListener('click', loadDummyData);

  // Upload zone – klik ke input tersembunyi
  const zone  = document.getElementById('upload-zone');
  const input = document.getElementById('file-input');

  zone?.addEventListener('click', e => {
    // Hindari trigger ganda jika klik pada input itu sendiri
    if (e.target !== input) input?.click();
  });

  zone?.addEventListener('dragover', e => {
    e.preventDefault();
    zone.style.borderColor = '#3b82f6';
  });
  zone?.addEventListener('dragleave', () => {
    zone.style.borderColor = '';
  });
  zone?.addEventListener('drop', e => {
    e.preventDefault();
    zone.style.borderColor = '';
    const file = e.dataTransfer?.files[0];
    if (file) handleFileUpload(file);
  });

  input?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) handleFileUpload(file);
    e.target.value = '';   // reset agar file yang sama bisa diupload ulang
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   Filter Sidebar
══════════════════════════════════════════════════════════════════════════ */
function populateSidebarFilters() {
  const records = AppState.records;
  if (!records) return;

  // Filter Prodi
  const prodis  = [...new Set(records.map(r => r['Program Studi']).filter(Boolean))].sort();
  const selPrd  = document.getElementById('filter-prodi');
  if (selPrd) {
    selPrd.innerHTML = '<option value="">Semua Prodi</option>' +
      prodis.map(p => `<option value="${p}">${p}</option>`).join('');
    selPrd.onchange = () => renderPage(AppState.currentPage);
  }

  // Filter Angkatan
  const angkatan = [...new Set(records.map(r => r.Angkatan).filter(Boolean))].sort();
  const selAng   = document.getElementById('filter-angkatan');
  if (selAng) {
    selAng.innerHTML = '<option value="">Semua Angkatan</option>' +
      angkatan.map(a => `<option value="${a}">${a}</option>`).join('');
    selAng.onchange = () => renderPage(AppState.currentPage);
  }

  // Slider Semester
  const sems   = records.map(r => +r.Semester).filter(v => v > 0);
  const minSem = sems.length ? Math.min(...sems) : 1;
  const maxSem = sems.length ? Math.max(...sems) : 8;
  const slider = document.getElementById('filter-semester');
  const semLbl = document.getElementById('filter-sem-label');
  if (slider) {
    slider.min   = minSem;
    slider.max   = maxSem;
    slider.value = maxSem;
    if (semLbl) semLbl.textContent = `1 – ${maxSem}`;
    slider.oninput = () => {
      if (semLbl) semLbl.textContent = `1 – ${slider.value}`;
      renderPage(AppState.currentPage);
    };
  }
}

function populateMKGradeFilters() {
  const records = AppState.records;
  if (!records) return;

  // Filter Mata Kuliah (halaman Data Mahasiswa)
  const mks  = [...new Set(records.map(r => r['Mata Kuliah']).filter(Boolean))].sort();
  const sMK  = document.getElementById('filter-mk');
  if (sMK) {
    sMK.innerHTML = '<option value="">Semua Mata Kuliah</option>' +
      mks.map(m => `<option value="${m}">${m}</option>`).join('');
    sMK.onchange  = () => renderFilteredTable();
  }

  // Filter Grade
  const sGr = document.getElementById('filter-grade');
  if (sGr) {
    sGr.innerHTML = '<option value="">Semua Grade</option>' +
      ['A','B+','B','C+','C','D','E'].map(g => `<option value="${g}">${g}</option>`).join('');
    sGr.onchange  = () => renderFilteredTable();
  }
}

/** Kembalikan records yang sudah difilter sesuai kontrol sidebar */
function getFilteredRecords() {
  let recs   = AppState.records || [];
  const prodi  = document.getElementById('filter-prodi')?.value;
  const angk   = document.getElementById('filter-angkatan')?.value;
  const semMax = Number(document.getElementById('filter-semester')?.value) || 8;

  if (prodi) recs = recs.filter(r => r['Program Studi'] === prodi);
  if (angk)  recs = recs.filter(r => String(r.Angkatan) === angk);
  recs = recs.filter(r => !r.Semester || Number(r.Semester) <= semMax);
  return recs;
}

/* ══════════════════════════════════════════════════════════════════════════
   PAGE: Dashboard
══════════════════════════════════════════════════════════════════════════ */
function renderDashboard() {
  const recs = getFilteredRecords();
  if (!recs.length) return;

  const stats   = getSummaryStats(recs);
  const quality = getDataQuality(AppState.records);

  // KPI cards
  setById('kpi-mahasiswa', stats.totalMahasiswa.toLocaleString('id-ID'));
  setById('kpi-nilai',     stats.rataRataNilai);
  setById('kpi-ipk',       stats.rataRataIPK);
  setById('kpi-kehadiran', stats.rataRataKehadiran + '%');
  setById('kpi-prodi',     stats.totalProdi);
  setById('kpi-mk',        stats.totalMK);
  setById('kpi-missing',   quality.missingTotal);
  setById('kpi-duplikat',  quality.duplicates);

  // Charts
  renderValueDistribution(recs,   'chart-dist');
  renderGradePie(recs,            'chart-grade-pie');
  renderSemesterTrend(recs,       'chart-semester');
  renderProdiGroupedBar(recs,     'chart-prodi-bar');
  renderIPKByProdi(recs,          'chart-ipk-prodi');

  // Quick Insights (3 teratas)
  const container = document.getElementById('quick-insights');
  if (container) {
    const ins = generateInsights(recs).slice(0, 3);
    container.innerHTML = ins
      .map(i => `<div class="insight-item ${i.type}">${i.text}</div>`)
      .join('');
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   PAGE: Visualisasi
══════════════════════════════════════════════════════════════════════════ */
function renderVisualisasi() {
  const recs = getFilteredRecords();
  if (!recs.length) return;

  renderValueDistribution(recs,  'viz-chart-dist');
  renderGradePie(recs,           'viz-chart-grade');
  renderSemesterTrend(recs,      'viz-chart-semester');
  renderCoursePassingRate(recs,  'viz-chart-passing');
  renderCourseComparison(recs,   'viz-chart-course');
  renderAttendanceScatter(recs,  'viz-chart-scatter');
  renderProdiGroupedBar(recs,    'viz-chart-prodi');
  renderProdiRadar(recs,         'viz-chart-radar');
  renderRiskScatter(recs,        'viz-chart-risk');

  const corr = analyzeAttendanceVsGrade(recs);
  setById('corr-r',      corr.r);
  setById('corr-p',      corr.p);
  setById('corr-str',    corr.strength.charAt(0).toUpperCase() + corr.strength.slice(1));
  setById('corr-interp', corr.interpretasi);

  renderTableById('tbl-courses', getCourseStats(recs),
    ['Mata Kuliah','Rata-rata Nilai','Std Nilai','Jumlah Peserta','Lulus','Tingkat Kelulusan (%)']);
}

/* ── Tab switching (Visualisasi) ────────────────────────────────────────── */
function initVizTabs() {
  document.querySelectorAll('#page-visualisasi .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#page-visualisasi .tab-btn')
        .forEach(b => b.classList.remove('active'));
      document.querySelectorAll('#page-visualisasi .tab-panel')
        .forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab)?.classList.add('active');
      // Re-render chart yang ada di tab baru agar tidak blank
      if (AppState.records) renderVisualisasi();
    });
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   PAGE: AI Insights
══════════════════════════════════════════════════════════════════════════ */
function renderInsights() {
  const recs = getFilteredRecords();
  if (!recs.length) return;

  // Insight cards
  const grid = document.getElementById('insights-grid');
  if (grid) {
    grid.innerHTML = generateInsights(recs)
      .map(i => `<div class="insight-item ${i.type}">${i.text}</div>`)
      .join('');
  }

  // Tabel risiko
  renderRiskTable(recs);

  // Kualitas data
  const q = getDataQuality(AppState.records);
  setById('qual-total',   q.total.toLocaleString('id-ID'));
  setById('qual-cols',    q.columns);
  setById('qual-missing', q.missingTotal);
  setById('qual-dup',     q.duplicates);

  const missDetail = document.getElementById('miss-detail');
  if (missDetail) {
    if (Object.keys(q.missing || {}).length) {
      missDetail.innerHTML = Object.entries(q.missing)
        .map(([k, v]) =>
          `<div class="legend-row">
             <span class="legend-dot" style="background:var(--warn)"></span>
             ${k}: <strong>${v}</strong> kosong
             (${round2(v / q.total * 100)}%)
           </div>`
        ).join('');
    } else {
      missDetail.innerHTML = '<span style="color:var(--success)">✅ Tidak ada nilai kosong.</span>';
    }
  }
}

function renderRiskTable(recs) {
  const nilaiT = Number(document.getElementById('risk-nilai')?.value) || 55;
  const kehadT = Number(document.getElementById('risk-kehad')?.value) || 70;
  const risk   = getAtRiskStudents(recs, nilaiT, kehadT);
  const nHigh  = risk.filter(r => r.Status === 'Prioritas Tinggi').length;

  setById('risk-count', risk.length);
  setById('risk-high',  nHigh);

  renderTableById(
    'tbl-risk', risk,
    ['NIM','Nama','Program Studi','Angkatan','Rata-rata Nilai','Rata-rata Kehadiran','IPK','Status'],
    row => row.Status === 'Prioritas Tinggi' ? 'danger' : ''
  );
}

function initRiskSliders() {
  ['risk-nilai', 'risk-kehad'].forEach(id => {
    const el  = document.getElementById(id);
    const lbl = document.getElementById(id + '-val');
    if (!el) return;
    el.oninput = () => {
      if (lbl) lbl.textContent = el.value;
      if (AppState.records) renderRiskTable(getFilteredRecords());
    };
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   PAGE: Data Mahasiswa
══════════════════════════════════════════════════════════════════════════ */
function renderMahasiswa() {
  const recs = getFilteredRecords();
  if (!recs.length) return;

  // Tab Peringkat
  renderTableById('tbl-top', getTopStudents(recs, 20, 'IPK'),
    ['NIM','Nama','Program Studi','Angkatan','Semester','Rata-rata Nilai','IPK','Rata-rata Kehadiran']);
  renderTableById('tbl-bottom', getBottomStudents(recs, 20),
    ['NIM','Nama','Program Studi','Angkatan','Semester','Rata-rata Nilai','IPK','Rata-rata Kehadiran']);

  // Tab Semua Data (max 200 rows on first load, filter controls reduce it)
  renderFilteredTable();
}

function initMahasiswaTabs() {
  document.querySelectorAll('#page-mahasiswa .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#page-mahasiswa .tab-btn')
        .forEach(b => b.classList.remove('active'));
      document.querySelectorAll('#page-mahasiswa .tab-panel')
        .forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab)?.classList.add('active');
    });
  });

  // Cari
  document.getElementById('search-btn')?.addEventListener('click', doSearch);
  document.getElementById('search-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') doSearch();
  });
}

function doSearch() {
  const kw   = document.getElementById('search-input')?.value?.trim() || '';
  const recs = getFilteredRecords();
  const res  = document.getElementById('search-results');

  if (!kw) {
    showToast('Masukkan kata kunci pencarian.', 'info');
    return;
  }

  const found = searchStudents(recs, kw);

  if (!found.length) {
    if (res) res.innerHTML =
      `<div class="empty-state">
         <div class="es-icon">🔍</div>
         <h3>Tidak Ditemukan</h3>
         <p>Tidak ada mahasiswa dengan kata kunci "<strong>${kw}</strong>".</p>
       </div>`;
    return;
  }

  renderTableById('search-results', found,
    ['NIM','Nama','Program Studi','Angkatan','Semester','Mata Kuliah','Nilai','Grade','IPK','Kehadiran (%)']);
  showToast(`Ditemukan ${found.length} entri untuk "${kw}"`, 'success');
}

function renderFilteredTable() {
  let recs  = cleanData(getFilteredRecords());
  const mk  = document.getElementById('filter-mk')?.value;
  const gr  = document.getElementById('filter-grade')?.value;

  if (mk) recs = recs.filter(r => r['Mata Kuliah'] === mk);
  if (gr) recs = recs.filter(r => r.Grade === gr);

  const countEl = document.getElementById('tbl-count');
  if (countEl) countEl.textContent = `${recs.length.toLocaleString('id-ID')} baris`;

  renderTableById('tbl-mahasiswa', recs.slice(0, 500),
    ['NIM','Nama','Program Studi','Angkatan','Semester','Mata Kuliah','Nilai','Grade','IPK','Kehadiran (%)']);
}

/* ══════════════════════════════════════════════════════════════════════════
   PAGE: Ekspor
══════════════════════════════════════════════════════════════════════════ */
function renderEkspor() {
  const recs  = getFilteredRecords();
  if (!recs.length) return;
  const stats = getSummaryStats(recs);

  setById('exp-mahasiswa', stats.totalMahasiswa.toLocaleString('id-ID'));
  setById('exp-entri',     stats.totalEntri.toLocaleString('id-ID'));
  setById('exp-ipk',       stats.rataRataIPK);

  renderTableById('exp-tbl-top', getTopStudents(recs, 10, 'IPK'),
    ['NIM','Nama','Program Studi','IPK','Rata-rata Nilai']);
  renderTableById('exp-tbl-courses', getCourseStats(recs),
    ['Mata Kuliah','Rata-rata Nilai','Jumlah Peserta','Tingkat Kelulusan (%)']);
}

function initExpor() {
  const guard = () => {
    if (!AppState.records) { showToast('Muat data terlebih dahulu.', 'error'); return false; }
    return true;
  };
  document.getElementById('btn-dl-csv')?.addEventListener('click', () => {
    if (!guard()) return;
    downloadCSV(getFilteredRecords(), `edutrack_data_${dateStamp()}.csv`);
    showToast('✅ CSV diunduh!', 'success');
  });
  document.getElementById('btn-dl-excel')?.addEventListener('click', () => {
    if (!guard()) return;
    downloadExcel(getFilteredRecords(), `edutrack_laporan_${dateStamp()}.xlsx`);
    showToast('✅ Excel diunduh!', 'success');
  });
  document.getElementById('btn-dl-html')?.addEventListener('click', () => {
    if (!guard()) return;
    downloadHTMLReport(getFilteredRecords());
    showToast('✅ Laporan HTML diunduh!', 'success');
  });
  document.getElementById('btn-dl-dummy-csv')?.addEventListener('click', () => {
    downloadDummyCSV();
    showToast('✅ Dataset demo CSV diunduh!', 'success');
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   PAGE: AI Agent
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

  // Chip buttons
  document.querySelectorAll('.chip').forEach(c => {
    c.addEventListener('click', async () => {
      await sendMessage(c.textContent.trim());
    });
  });

  // Clear chat
  document.getElementById('btn-clear-chat')?.addEventListener('click', () => {
    AppState.chatHistory = [];
    const area = document.getElementById('chat-area');
    if (area) {
      // Hapus semua kecuali bubble selamat datang pertama (opsional)
      area.innerHTML = '';
      appendChatBubble('agent',
        'Riwayat dihapus. Silakan ajukan pertanyaan baru tentang data akademik.');
    }
    showToast('Riwayat chat dihapus', 'info');
  });
}

async function sendMessage(query) {
  if (!AppState.records) {
    appendChatBubble('agent', '⚠️ Data belum dimuat. Klik "Muat Dataset Demo" di sidebar terlebih dahulu.');
    return;
  }

  appendChatBubble('user', query);
  scrollChatBottom();

  const thinking = appendChatBubble('agent', '⏳ Menganalisis…');
  try {
    const res = await askAgent(query, AppState.records);
    thinking.remove();

    const bubble = appendChatBubble('agent', res.text);

    // Tampilkan tombol "Lihat data" jika ada tabel pendukung
    if (res.data && res.table && Array.isArray(res.data) && res.data.length) {
      const allowedCols = Object.keys(res.data[0]).filter(
        k => !['nilaiArr','kehadArr','ipkArr','mkSet'].includes(k)
      );
      const btnWrap = document.createElement('div');
      btnWrap.style.marginTop = '6px';

      const btn = document.createElement('button');
      btn.className   = 'chat-data-btn';
      btn.textContent = `📋 Lihat data (${res.data.length} baris)`;
      let expanded    = false;

      btn.onclick = () => {
        expanded = !expanded;
        const existing = btnWrap.querySelector('.inline-table');
        if (expanded && !existing) {
          const wrapper        = document.createElement('div');
          wrapper.className    = 'inline-table';
          wrapper.style.cssText = 'margin-top:8px;max-height:240px;overflow:auto;border-radius:6px';
          renderTableInEl(wrapper, res.data.slice(0, 50), allowedCols);
          btnWrap.appendChild(wrapper);
          btn.textContent = '▲ Sembunyikan';
        } else if (!expanded && existing) {
          existing.remove();
          btn.textContent = `📋 Lihat data (${res.data.length} baris)`;
        }
      };

      btnWrap.appendChild(btn);
      bubble.querySelector('.chat-bubble')?.appendChild(btnWrap);
    }
  } catch (err) {
    thinking.remove();
    appendChatBubble('agent', `❌ Terjadi kesalahan: ${err.message}`);
  }

  scrollChatBottom();
}

/** Tambah bubble chat, kembalikan elemen wrapper (bisa di-.remove()) */
function appendChatBubble(role, text) {
  const area = document.getElementById('chat-area');
  if (!area) return { remove: () => {}, querySelector: () => null };

  const wrap   = document.createElement('div');
  wrap.className = `chat-msg ${role}`;

  const lbl  = document.createElement('div');
  lbl.className   = 'chat-label';
  lbl.textContent = role === 'user' ? 'Anda' : '🤖 EduTrack AI';

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  // Markdown-lite: **bold** dan baris baru
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

/* ── AI Config panel ─────────────────────────────────────────────────────── */
function initAIConfig() {
  const modeEl = document.getElementById('ai-mode');
  const apiEl  = document.getElementById('api-fields');

  modeEl?.addEventListener('change', function () {
    if (apiEl) apiEl.style.display = this.value === 'api' ? 'block' : 'none';
  });

  document.getElementById('btn-save-config')?.addEventListener('click', () => {
    const mode  = modeEl?.value || 'local';
    const key   = document.getElementById('ai-apikey')?.value?.trim() || '';
    const model = document.getElementById('ai-model')?.value  || 'gpt-4o-mini';
    const url   = document.getElementById('ai-url')?.value?.trim()
                  || 'https://api.openai.com/v1/chat/completions';
    setAgentConfig({ mode, apiKey: key, model, apiUrl: url });
    showToast(`✅ Konfigurasi disimpan (mode: ${mode})`, 'success');
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   Ekspor Tab switching (dipanggil inline dari HTML)
══════════════════════════════════════════════════════════════════════════ */
function switchExpTab(btn, tabId) {
  document.querySelectorAll('#page-ekspor .tab-btn')
    .forEach(b => b.classList.remove('active'));
  document.querySelectorAll('#page-ekspor .tab-panel')
    .forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(tabId)?.classList.add('active');
}

/* ══════════════════════════════════════════════════════════════════════════
   Helpers
══════════════════════════════════════════════════════════════════════════ */
function setById(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? '—';
}

function renderTableById(id, rows, cols, rowClassFn = null) {
  const el = document.getElementById(id);
  if (el) renderTableInEl(el, rows, cols, rowClassFn);
}

function renderTableInEl(el, rows, cols, rowClassFn = null) {
  if (!rows || !rows.length) {
    el.innerHTML =
      '<div class="empty-state" style="padding:24px">' +
      '<div class="es-icon">📭</div><p>Tidak ada data.</p></div>';
    return;
  }

  const headerHTML = cols
    .map(c => `<th data-col="${c}">${c}</th>`)
    .join('');

  const bodyHTML = rows.map(r => {
    const cls = rowClassFn ? rowClassFn(r) : '';
    const tds = cols.map(c => {
      const v  = r[c];
      const vs = (v === null || v === undefined) ? '—' : String(v);

      if (c === 'Status') {
        const bc = v === 'Prioritas Tinggi' ? 'badge-danger' : 'badge-warn';
        return `<td><span class="badge ${bc}">${vs}</span></td>`;
      }
      if (c === 'Grade') {
        const bc = ['A','B+'].includes(v) ? 'badge-success'
                 : (v === 'E' || v === 'D') ? 'badge-danger'
                 : 'badge-info';
        return `<td><span class="badge ${bc}">${vs}</span></td>`;
      }
      return `<td>${vs}</td>`;
    }).join('');

    return `<tr class="${cls}">${tds}</tr>`;
  }).join('');

  el.innerHTML =
    `<div class="table-wrapper">
       <table>
         <thead><tr>${headerHTML}</tr></thead>
         <tbody>${bodyHTML}</tbody>
       </table>
     </div>`;

  // Klik header untuk sort
  el.querySelectorAll('thead th').forEach(th => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      const dir = th.classList.contains('sort-asc') ? -1 : 1;
      el.querySelectorAll('thead th').forEach(h =>
        h.classList.remove('sort-asc', 'sort-desc')
      );
      th.classList.add(dir === 1 ? 'sort-asc' : 'sort-desc');
      const sorted = [...rows].sort((a, b) => {
        const av = a[col], bv = b[col];
        if (av == null) return 1;
        if (bv == null) return -1;
        return typeof av === 'number'
          ? dir * (av - bv)
          : dir * String(av).localeCompare(String(bv), 'id');
      });
      renderTableInEl(el, sorted, cols, rowClassFn);
    });
  });
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast       = document.createElement('div');
  toast.className   = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function round2(v) { return Math.round(v * 100) / 100; }

function dateStamp() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
    '_',
    String(d.getHours()).padStart(2, '0'),
    String(d.getMinutes()).padStart(2, '0'),
  ].join('');
}
