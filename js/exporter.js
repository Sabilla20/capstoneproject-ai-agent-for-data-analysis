/**
 * js/exporter.js
 * Ekspor data ke CSV, Excel (via SheetJS), dan HTML.
 */

'use strict';

/* ── CSV ─────────────────────────────────────────────────────────────────── */
function downloadCSV(records, filename = 'edutrack_data.csv') {
  const csv  = datasetToCSV(records);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename);
}

/* ── Excel (SheetJS) ─────────────────────────────────────────────────────── */
function downloadExcel(records, filename = 'edutrack_laporan.xlsx') {
  if (typeof XLSX === 'undefined') {
    showToast('SheetJS belum dimuat. Pastikan koneksi internet tersedia.', 'error');
    return;
  }
  const clean   = cleanData(records);
  const wb      = XLSX.utils.book_new();

  // Sheet 1: Data lengkap
  const ws1 = XLSX.utils.json_to_sheet(clean);
  XLSX.utils.book_append_sheet(wb, ws1, 'Data Lengkap');

  // Sheet 2: Ringkasan
  const stats = getSummaryStats(records);
  const ws2   = XLSX.utils.json_to_sheet(Object.entries(stats).map(([k,v]) => ({ Metrik: k, Nilai: v })));
  XLSX.utils.book_append_sheet(wb, ws2, 'Ringkasan');

  // Sheet 3: Per Mata Kuliah
  const ws3 = XLSX.utils.json_to_sheet(getCourseStats(records));
  XLSX.utils.book_append_sheet(wb, ws3, 'Per Mata Kuliah');

  // Sheet 4: Per Prodi
  const ws4 = XLSX.utils.json_to_sheet(getProdiStats(records));
  XLSX.utils.book_append_sheet(wb, ws4, 'Per Prodi');

  // Sheet 5: Tren Semester
  const ws5 = XLSX.utils.json_to_sheet(getSemesterTrend(records));
  XLSX.utils.book_append_sheet(wb, ws5, 'Tren Semester');

  // Sheet 6: Top 20 Mahasiswa
  const ws6 = XLSX.utils.json_to_sheet(getTopStudents(records, 20, 'IPK'));
  XLSX.utils.book_append_sheet(wb, ws6, 'Top 20 Mahasiswa');

  // Sheet 7: Mahasiswa Berisiko
  const ws7 = XLSX.utils.json_to_sheet(getAtRiskStudents(records));
  XLSX.utils.book_append_sheet(wb, ws7, 'Mahasiswa Berisiko');

  XLSX.writeFile(wb, filename);
}

/* ── HTML Report ─────────────────────────────────────────────────────────── */
function downloadHTMLReport(records) {
  const stats    = getSummaryStats(records);
  const courses  = getCourseStats(records).slice(0, 15);
  const prodi    = getProdiStats(records);
  const dist     = getGradeDistribution(records);
  const top10    = getTopStudents(records, 10, 'IPK');
  const risk     = getAtRiskStudents(records).slice(0, 15);
  const corr     = analyzeAttendanceVsGrade(records);
  const insights = generateInsights(records);
  const quality  = getDataQuality(records);
  const ts       = new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });

  const tableHTML = (rows, cols) => {
    if (!rows.length) return '<p style="color:#6b7280">Tidak ada data.</p>';
    const header = cols.map(c => `<th>${c}</th>`).join('');
    const body   = rows.map(r => `<tr>${cols.map(c => `<td>${r[c] ?? '—'}</td>`).join('')}</tr>`).join('');
    return `<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
  };

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Laporan Akademik – EduTrack AI</title>
<style>
body{font-family:'Segoe UI',system-ui,sans-serif;margin:0;padding:0;background:#f7f8fa;color:#1f2328}
.wrap{max-width:1100px;margin:0 auto;padding:32px 24px}
h1{color:#1e40af;font-size:1.8rem;margin-bottom:4px}
h2{color:#1e40af;font-size:1.1rem;border-left:4px solid #3b82f6;padding-left:10px;margin:28px 0 12px}
.kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin:20px 0}
.kpi-card{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:18px;text-align:center}
.kpi-val{font-size:1.8rem;font-weight:800;color:#3b82f6}
.kpi-lbl{font-size:.75rem;color:#57606a;margin-top:4px}
table{width:100%;border-collapse:collapse;font-size:.82rem;margin-top:8px}
th{background:#e0e7ff;padding:9px 10px;text-align:left;font-weight:700;border-bottom:2px solid #e5e7eb}
td{padding:7px 10px;border-bottom:1px solid #f3f4f6}
tr:hover td{background:#f8f9ff}
.insight-item{background:#fff;border:1px solid #e5e7eb;border-left:4px solid #3b82f6;border-radius:8px;padding:12px 16px;margin-bottom:8px;font-size:.85rem;line-height:1.6}
.corr-box{background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px;font-size:.85rem}
.footer{text-align:center;font-size:.72rem;color:#9ca3af;border-top:1px solid #e5e7eb;margin-top:48px;padding-top:16px}
</style>
</head>
<body>
<div class="wrap">
  <h1>📊 EduTrack AI – Laporan Analisis Akademik</h1>
  <p style="color:#57606a">Digenerate: <strong>${ts}</strong> &nbsp;|&nbsp; Total data: <strong>${stats.totalEntri.toLocaleString('id-ID')} entri</strong></p>

  <h2>📋 Ringkasan Statistik</h2>
  <div class="kpi-grid">
    <div class="kpi-card"><div class="kpi-val">${stats.totalMahasiswa.toLocaleString('id-ID')}</div><div class="kpi-lbl">Total Mahasiswa</div></div>
    <div class="kpi-card"><div class="kpi-val">${stats.rataRataNilai}</div><div class="kpi-lbl">Rata-rata Nilai</div></div>
    <div class="kpi-card"><div class="kpi-val">${stats.rataRataIPK}</div><div class="kpi-lbl">Rata-rata IPK</div></div>
    <div class="kpi-card"><div class="kpi-val">${stats.rataRataKehadiran}%</div><div class="kpi-lbl">Rata-rata Kehadiran</div></div>
    <div class="kpi-card"><div class="kpi-val">${stats.totalProdi}</div><div class="kpi-lbl">Program Studi</div></div>
    <div class="kpi-card"><div class="kpi-val">${stats.totalMK}</div><div class="kpi-lbl">Mata Kuliah</div></div>
  </div>

  <h2>🧠 AI Insights</h2>
  ${insights.map(i => `<div class="insight-item">${i.text}</div>`).join('')}

  <h2>🔗 Korelasi Kehadiran – Nilai</h2>
  <div class="corr-box">
    <p>${corr.interpretasi}</p>
    <p>r = <strong>${corr.r}</strong> | p ≈ ${corr.p} | N = ${corr.n.toLocaleString('id-ID')}</p>
  </div>

  <h2>🏆 Top 10 Mahasiswa (IPK Tertinggi)</h2>
  ${tableHTML(top10, ['NIM','Nama','Program Studi','Angkatan','Semester','IPK','Rata-rata Nilai','Rata-rata Kehadiran'])}

  <h2>📚 Statistik Mata Kuliah</h2>
  ${tableHTML(courses, ['Mata Kuliah','Rata-rata Nilai','Std Nilai','Jumlah Peserta','Lulus','Tingkat Kelulusan (%)'])}

  <h2>🏫 Perbandingan Program Studi</h2>
  ${tableHTML(prodi, ['Program Studi','Jumlah Mahasiswa','Rata-rata Nilai','Rata-rata IPK','Rata-rata Kehadiran'])}

  <h2>🎓 Distribusi Huruf Mutu</h2>
  ${tableHTML(dist, ['Grade','Jumlah','Persentase (%)'])}

  <h2>🚨 Mahasiswa yang Butuh Pendampingan</h2>
  ${risk.length ? tableHTML(risk, ['NIM','Nama','Program Studi','Angkatan','Semester','Rata-rata Nilai','Rata-rata Kehadiran','IPK','Status']) : '<p>Tidak ada mahasiswa yang terdeteksi berisiko.</p>'}

  <h2>🔍 Kualitas Data</h2>
  <ul style="font-size:.85rem;line-height:1.8">
    <li>Total baris: ${quality.total.toLocaleString('id-ID')}</li>
    <li>Total kolom: ${quality.columns}</li>
    <li>Nilai kosong: ${JSON.stringify(quality.missing)}</li>
    <li>Duplikat: ${quality.duplicates} baris (${quality.duplicatesPct}%)</li>
  </ul>

  <div class="footer">Laporan dihasilkan oleh EduTrack AI &mdash; Pure HTML/JS App</div>
</div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  triggerDownload(blob, `edutrack_laporan_${dateStamp()}.html`);
}

/* ── Util ─────────────────────────────────────────────────────────────────── */
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}

function dateStamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}_${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}`;
}

/* ── Download dummy CSV ──────────────────────────────────────────────────── */
function downloadDummyCSV() {
  const records = getDummyDataset();
  downloadCSV(records, `academic_data_${dateStamp()}.csv`);
}
