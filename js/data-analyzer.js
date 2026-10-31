/**
 * js/data-analyzer.js
 * Fungsi analisis data akademik — JavaScript murni, tanpa backend.
 * Dipanggil oleh AI Agent, chart engine, dan dashboard.
 */

'use strict';

/* ── Util ────────────────────────────────────────────────────────────────── */
function isNum(v) { return v !== null && v !== undefined && !isNaN(v); }
function avg(arr) {
  const nums = arr.filter(isNum);
  return nums.length ? nums.reduce((a,b) => a+b, 0) / nums.length : 0;
}
function round2(v) { return Math.round(v * 100) / 100; }
function round1(v) { return Math.round(v * 10) / 10; }

/* ── Pembersihan ─────────────────────────────────────────────────────────── */
function cleanData(records) {
  // Remove duplicates (same NIM + MK)
  const seen = new Set();
  const unique = records.filter(r => {
    const key = `${r.NIM}||${r['Mata Kuliah']}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Impute missing Nilai & Kehadiran with median
  const nilaiVals     = unique.map(r => r.Nilai).filter(isNum).sort((a,b)=>a-b);
  const kehadVals     = unique.map(r => r['Kehadiran (%)']).filter(isNum).sort((a,b)=>a-b);
  const medianNilai   = nilaiVals[Math.floor(nilaiVals.length/2)] ?? 70;
  const medianKehad   = kehadVals[Math.floor(kehadVals.length/2)] ?? 80;

  return unique.map(r => ({
    ...r,
    Nilai:           isNum(r.Nilai)            ? +r.Nilai           : medianNilai,
    'Kehadiran (%)': isNum(r['Kehadiran (%)']) ? +r['Kehadiran (%)'] : medianKehad,
    IPK:             isNum(r.IPK)              ? +r.IPK             : 0,
  }));
}

/* ── Kualitas data ───────────────────────────────────────────────────────── */
function getDataQuality(records) {
  const total = records.length;
  if (!total) return { total: 0, duplicates: 0, missing: {} };

  // Count duplicates
  const seen = new Set();
  let dup = 0;
  records.forEach(r => {
    const key = `${r.NIM}||${r['Mata Kuliah']}`;
    seen.has(key) ? dup++ : seen.add(key);
  });

  const fields = ['Nilai','IPK','Kehadiran (%)'];
  const missing = {};
  fields.forEach(f => {
    const n = records.filter(r => r[f] === null || r[f] === undefined || r[f] === '').length;
    if (n) missing[f] = n;
  });

  return {
    total,
    columns: Object.keys(records[0] || {}).length,
    duplicates: dup,
    duplicatesPct: round2(dup / total * 100),
    missing,
    missingTotal: Object.values(missing).reduce((a,b)=>a+b,0),
  };
}

/* ── Ringkasan statistik ─────────────────────────────────────────────────── */
function getSummaryStats(records) {
  const clean = cleanData(records);
  const nims  = new Set(clean.map(r => r.NIM));
  return {
    totalMahasiswa:   nims.size,
    totalEntri:       clean.length,
    rataRataNilai:    round2(avg(clean.map(r => r.Nilai))),
    rataRataIPK:      round2(avg(clean.map(r => r.IPK))),
    rataRataKehadiran:round2(avg(clean.map(r => r['Kehadiran (%)']))),
    totalProdi:       new Set(clean.map(r => r['Program Studi'])).size,
    totalMK:          new Set(clean.map(r => r['Mata Kuliah'])).size,
  };
}

/* ── Per-mahasiswa aggregation ───────────────────────────────────────────── */
function aggregatePerMahasiswa(records) {
  const clean = cleanData(records);
  const map   = {};
  clean.forEach(r => {
    if (!map[r.NIM]) {
      map[r.NIM] = {
        NIM: r.NIM, Nama: r.Nama, 'Program Studi': r['Program Studi'],
        Angkatan: r.Angkatan, Semester: r.Semester,
        nilaiArr: [], kehadArr: [], ipkArr: [], mkSet: new Set(),
      };
    }
    const m = map[r.NIM];
    m.nilaiArr.push(r.Nilai);
    m.kehadArr.push(r['Kehadiran (%)']);
    m.ipkArr.push(r.IPK);
    m.mkSet.add(r['Mata Kuliah']);
    if (r.Semester > m.Semester) m.Semester = r.Semester;
  });
  return Object.values(map).map(m => ({
    NIM:              m.NIM,
    Nama:             m.Nama,
    'Program Studi':  m['Program Studi'],
    Angkatan:         m.Angkatan,
    Semester:         m.Semester,
    'Rata-rata Nilai':round2(avg(m.nilaiArr)),
    IPK:              round2(avg(m.ipkArr)),
    'Rata-rata Kehadiran':round1(avg(m.kehadArr)),
    'Jumlah MK':      m.mkSet.size,
  }));
}

/* ── Top / Bottom students ───────────────────────────────────────────────── */
function getTopStudents(records, n = 10, by = 'IPK') {
  const per = aggregatePerMahasiswa(records);
  const key = by === 'IPK' ? 'IPK' : 'Rata-rata Nilai';
  return per.sort((a,b) => b[key] - a[key]).slice(0, n);
}

function getBottomStudents(records, n = 10) {
  const per = aggregatePerMahasiswa(records);
  return per.sort((a,b) => a['IPK'] - b['IPK']).slice(0, n);
}

function searchStudents(records, keyword) {
  const kw = keyword.toLowerCase().trim();
  if (!kw) return [];
  const clean = cleanData(records);
  return clean.filter(r =>
    String(r.NIM).toLowerCase().includes(kw) ||
    String(r.Nama).toLowerCase().includes(kw)
  );
}

/* ── Mata kuliah ─────────────────────────────────────────────────────────── */
function getCourseStats(records) {
  const clean = cleanData(records);
  const map   = {};
  clean.forEach(r => {
    const mk = r['Mata Kuliah'];
    if (!map[mk]) map[mk] = { nilaiArr: [], kehadArr: [], total: 0, lulus: 0 };
    const m = map[mk];
    m.nilaiArr.push(r.Nilai);
    m.kehadArr.push(r['Kehadiran (%)']);
    m.total++;
    if (r.Nilai >= 45) m.lulus++;
  });
  return Object.entries(map).map(([mk, m]) => {
    const avgN = avg(m.nilaiArr);
    const std  = stdDev(m.nilaiArr);
    return {
      'Mata Kuliah': mk,
      'Rata-rata Nilai': round2(avgN),
      'Std Nilai': round2(std),
      'Kehadiran Rata': round1(avg(m.kehadArr)),
      'Jumlah Peserta': m.total,
      'Lulus': m.lulus,
      'Tingkat Kelulusan (%)': round1(m.lulus / m.total * 100),
    };
  }).sort((a,b) => b['Rata-rata Nilai'] - a['Rata-rata Nilai']);
}

function stdDev(arr) {
  const nums = arr.filter(isNum);
  if (nums.length < 2) return 0;
  const m = avg(nums);
  return Math.sqrt(nums.reduce((s,v) => s + (v-m)**2, 0) / (nums.length - 1));
}

function getLowestPassingCourse(records) {
  const stats = getCourseStats(records);
  return stats.reduce((lo, c) =>
    c['Tingkat Kelulusan (%)'] < lo['Tingkat Kelulusan (%)'] ? c : lo, stats[0]);
}

function getHighestPassingCourse(records) {
  const stats = getCourseStats(records);
  return stats.reduce((hi, c) =>
    c['Tingkat Kelulusan (%)'] > hi['Tingkat Kelulusan (%)'] ? c : hi, stats[0]);
}

/* ── Program studi ───────────────────────────────────────────────────────── */
function getProdiStats(records) {
  const clean = cleanData(records);
  const map   = {};
  clean.forEach(r => {
    const p = r['Program Studi'];
    if (!map[p]) map[p] = { nilaiArr: [], ipkArr: [], kehadArr: [], nims: new Set() };
    const m = map[p];
    m.nilaiArr.push(r.Nilai);
    m.ipkArr.push(r.IPK);
    m.kehadArr.push(r['Kehadiran (%)']);
    m.nims.add(r.NIM);
  });
  return Object.entries(map).map(([prodi, m]) => ({
    'Program Studi': prodi,
    'Jumlah Mahasiswa': m.nims.size,
    'Rata-rata Nilai': round2(avg(m.nilaiArr)),
    'Rata-rata IPK': round2(avg(m.ipkArr)),
    'Rata-rata Kehadiran': round1(avg(m.kehadArr)),
  }));
}

/* ── Tren semester ───────────────────────────────────────────────────────── */
function getSemesterTrend(records) {
  const clean = cleanData(records);
  const map   = {};
  clean.forEach(r => {
    const s = r.Semester;
    if (!map[s]) map[s] = { nilaiArr: [], ipkArr: [], kehadArr: [], count: 0 };
    const m = map[s];
    m.nilaiArr.push(r.Nilai);
    m.ipkArr.push(r.IPK);
    m.kehadArr.push(r['Kehadiran (%)']);
    m.count++;
  });
  return Object.entries(map)
    .map(([sem, m]) => ({
      Semester: +sem,
      'Rata-rata Nilai': round2(avg(m.nilaiArr)),
      'Rata-rata IPK': round2(avg(m.ipkArr)),
      'Rata-rata Kehadiran': round1(avg(m.kehadArr)),
      'Jumlah Entri': m.count,
    }))
    .sort((a,b) => a.Semester - b.Semester);
}

/* ── Distribusi grade ────────────────────────────────────────────────────── */
function getGradeDistribution(records) {
  const clean  = cleanData(records);
  const order  = ['A','B+','B','C+','C','D','E'];
  const counts = {};
  order.forEach(g => counts[g] = 0);
  clean.forEach(r => {
    const g = r.Grade || gradeFromNilai(r.Nilai);
    if (counts[g] !== undefined) counts[g]++;
  });
  const total = clean.length;
  return order.map(g => ({
    Grade: g,
    Jumlah: counts[g],
    'Persentase (%)': round1(counts[g] / total * 100),
  }));
}

function gradeFromNilai(n) {
  if (n >= 85) return 'A';
  if (n >= 75) return 'B+';
  if (n >= 65) return 'B';
  if (n >= 55) return 'C+';
  if (n >= 45) return 'C';
  if (n >= 35) return 'D';
  return 'E';
}

/* ── Korelasi Pearson ────────────────────────────────────────────────────── */
function pearsonCorrelation(xArr, yArr) {
  const n  = xArr.length;
  const mx = avg(xArr), my = avg(yArr);
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xArr[i] - mx, dy = yArr[i] - my;
    num += dx * dy; dx2 += dx*dx; dy2 += dy*dy;
  }
  return (dx2 && dy2) ? num / Math.sqrt(dx2 * dy2) : 0;
}

function analyzeAttendanceVsGrade(records) {
  const clean = cleanData(records)
    .filter(r => isNum(r.Nilai) && isNum(r['Kehadiran (%)']));
  const xArr = clean.map(r => r['Kehadiran (%)']);
  const yArr = clean.map(r => r.Nilai);
  const r    = round2(pearsonCorrelation(xArr, yArr));
  const n    = clean.length;

  // Approximate p-value from t-distribution
  const t    = r * Math.sqrt((n-2) / (1 - r*r));
  const p    = approxTwoTailP(t, n - 2);

  const strength = Math.abs(r) >= 0.7 ? 'kuat'
    : Math.abs(r) >= 0.4 ? 'sedang'
    : Math.abs(r) >= 0.2 ? 'lemah'
    : 'sangat lemah';
  const direction = r > 0 ? 'positif' : 'negatif';
  const sig       = p < 0.05;

  let interpretasi = `Terdapat korelasi ${direction} ${strength} antara kehadiran dan nilai (r = ${r}, p ≈ ${round2(p)}). `;
  if (sig) {
    interpretasi += `Korelasi ini signifikan secara statistik (p < 0.05). `;
    interpretasi += r > 0
      ? 'Artinya, mahasiswa yang lebih sering hadir cenderung mendapat nilai lebih tinggi.'
      : 'Artinya, terdapat faktor lain yang lebih dominan memengaruhi nilai.';
  } else {
    interpretasi += 'Namun korelasi ini tidak signifikan secara statistik (p ≥ 0.05).';
  }

  // Linear regression for chart trendline
  const mxA = avg(xArr), myA = avg(yArr);
  let cov = 0, varX = 0;
  xArr.forEach((x,i) => { cov += (x-mxA)*(yArr[i]-myA); varX += (x-mxA)**2; });
  const slope = varX ? cov/varX : 0;
  const intercept = myA - slope * mxA;

  return { r, p: round2(p), strength, direction, sig, interpretasi, n, slope, intercept };
}

// Approximate two-tailed p-value from t and df (Wilson-Hilferty)
function approxTwoTailP(t, df) {
  if (!isFinite(t) || df < 1) return 1;
  const x  = df / (df + t*t);
  const p2 = incompleteBeta(x, df/2, 0.5);
  return Math.min(1, p2);
}

function incompleteBeta(x, a, b) {
  // Approximation using continued fraction (Lentz)
  if (x <= 0) return 0; if (x >= 1) return 1;
  const lbeta = lgamma(a) + lgamma(b) - lgamma(a+b);
  const front = Math.exp(Math.log(x)*a + Math.log(1-x)*b - lbeta) / a;
  const cf    = betaCF(x, a, b);
  return front * cf;
}
function betaCF(x, a, b) {
  const MAX = 200, EPS = 3e-7;
  let h = 1, c = 1, d = 1 - (a+b)*x/(a+1);
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1/d; h = d;
  for (let m = 1; m <= MAX; m++) {
    let aa = m*(b-m)*x/((a+2*m-1)*(a+2*m));
    d = 1 + aa*d; if (Math.abs(d)<1e-30) d=1e-30;
    c = 1 + aa/c; if (Math.abs(c)<1e-30) c=1e-30;
    d = 1/d; h *= d*c;
    aa = -(a+m)*(a+b+m)*x/((a+2*m)*(a+2*m+1));
    d = 1 + aa*d; if (Math.abs(d)<1e-30) d=1e-30;
    c = 1 + aa/c; if (Math.abs(c)<1e-30) c=1e-30;
    d = 1/d; const del = d*c; h *= del;
    if (Math.abs(del-1) < EPS) break;
  }
  return h;
}
function lgamma(z) {
  // Lanczos approximation
  const g = 7;
  const C = [0.99999999999980993,676.5203681218851,-1259.1392167224028,
    771.32342877765313,-176.61502916214059,12.507343278686905,
    -0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI*z)) - lgamma(1-z);
  z -= 1;
  let x = C[0];
  for (let i = 1; i < g+2; i++) x += C[i]/(z+i);
  const t = z + g + 0.5;
  return 0.5*Math.log(2*Math.PI) + (z+0.5)*Math.log(t) - t + Math.log(x);
}

/* ── Mahasiswa berisiko ───────────────────────────────────────────────────── */
function getAtRiskStudents(records, nilaiThreshold = 55, kehadThreshold = 70) {
  const per = aggregatePerMahasiswa(records);
  return per
    .filter(m =>
      m['Rata-rata Nilai'] < nilaiThreshold ||
      m['Rata-rata Kehadiran'] < kehadThreshold
    )
    .map(m => {
      const both = m['Rata-rata Nilai'] < nilaiThreshold && m['Rata-rata Kehadiran'] < kehadThreshold;
      return { ...m, Status: both ? 'Prioritas Tinggi' : 'Butuh Perhatian' };
    })
    .sort((a,b) => a['Rata-rata Nilai'] - b['Rata-rata Nilai']);
}

/* ── AI Insights ─────────────────────────────────────────────────────────── */
function generateInsights(records) {
  const clean    = cleanData(records);
  const insights = [];

  const stats   = getSummaryStats(records);
  const prodi   = getProdiStats(records);
  const courses = getCourseStats(records);
  const corr    = analyzeAttendanceVsGrade(records);
  const quality = getDataQuality(records);
  const trend   = getSemesterTrend(records);
  const risk    = getAtRiskStudents(records);

  insights.push({
    type: 'info',
    text: `Rata-rata nilai keseluruhan adalah <strong>${stats.rataRataNilai}</strong> dan rata-rata kehadiran <strong>${stats.rataRataKehadiran}%</strong> dari <strong>${stats.totalMahasiswa.toLocaleString('id-ID')}</strong> mahasiswa.`,
  });

  const bestProdi  = prodi.reduce((a,b) => b['Rata-rata IPK'] > a['Rata-rata IPK'] ? b : a, prodi[0]);
  const worstProdi = prodi.reduce((a,b) => b['Rata-rata IPK'] < a['Rata-rata IPK'] ? b : a, prodi[0]);
  insights.push({
    type: 'success',
    text: `Program studi dengan rata-rata IPK tertinggi: <strong>${bestProdi['Program Studi']}</strong> (IPK = ${bestProdi['Rata-rata IPK']}).`,
  });
  insights.push({
    type: 'warn',
    text: `Program studi dengan rata-rata IPK terendah: <strong>${worstProdi['Program Studi']}</strong> (IPK = ${worstProdi['Rata-rata IPK']}) — mungkin perlu perhatian lebih.`,
  });

  const hardCourse = courses.reduce((a,b) => b['Rata-rata Nilai'] < a['Rata-rata Nilai'] ? b : a, courses[0]);
  const easyCourse = courses.reduce((a,b) => b['Rata-rata Nilai'] > a['Rata-rata Nilai'] ? b : a, courses[0]);
  insights.push({
    type: 'danger',
    text: `Mata kuliah dengan rata-rata nilai terendah: <strong>${hardCourse['Mata Kuliah']}</strong> (${hardCourse['Rata-rata Nilai']}), tingkat kelulusan ${hardCourse['Tingkat Kelulusan (%)']}%.`,
  });
  insights.push({
    type: 'success',
    text: `Mata kuliah dengan rata-rata nilai tertinggi: <strong>${easyCourse['Mata Kuliah']}</strong> (${easyCourse['Rata-rata Nilai']}), tingkat kelulusan ${easyCourse['Tingkat Kelulusan (%)']}%.`,
  });

  insights.push({ type: 'info', text: corr.interpretasi });

  const nRisk  = risk.length;
  const nHigh  = risk.filter(r => r.Status === 'Prioritas Tinggi').length;
  if (nRisk) {
    insights.push({
      type: 'danger',
      text: `Terdapat <strong>${nRisk} mahasiswa</strong> yang memerlukan perhatian, ${nHigh} di antaranya prioritas tinggi (nilai rendah <em>dan</em> kehadiran rendah).`,
    });
  } else {
    insights.push({ type: 'success', text: 'Tidak ditemukan mahasiswa dengan nilai rendah sekaligus kehadiran sangat rendah.' });
  }

  if (trend.length >= 2) {
    const first = trend[0]['Rata-rata Nilai'];
    const last  = trend[trend.length-1]['Rata-rata Nilai'];
    const diff  = round1(last - first);
    const arah  = diff > 0 ? 'meningkat' : 'menurun';
    insights.push({
      type: diff > 0 ? 'success' : 'warn',
      text: `Tren rata-rata nilai dari semester ${trend[0].Semester} ke ${trend[trend.length-1].Semester} <strong>${arah}</strong> (Δ${Math.abs(diff)} poin).`,
    });
  }

  if (quality.missingTotal > 0) {
    const cols = Object.entries(quality.missing).map(([k,v])=>`${k}: ${v}`).join(', ');
    insights.push({ type: 'warn', text: `Data memiliki <strong>${quality.missingTotal} nilai kosong</strong> pada kolom: ${cols}. Sudah diimputasi dengan median.` });
  }
  if (quality.duplicates > 0) {
    insights.push({ type: 'warn', text: `Ditemukan <strong>${quality.duplicates} baris duplikat</strong> (${quality.duplicatesPct}%) — telah dihapus pada analisis.` });
  }

  // Distribution insight
  const dist = getGradeDistribution(records);
  const gradeA = dist.find(d => d.Grade === 'A');
  const gradeE = dist.find(d => d.Grade === 'E');
  if (gradeA) insights.push({ type: 'info', text: `Sebanyak <strong>${gradeA['Persentase (%)']}%</strong> mahasiswa meraih grade A (nilai ≥ 85).` });
  if (gradeE && gradeE.Jumlah > 0) insights.push({ type: 'danger', text: `Terdapat <strong>${gradeE.Jumlah} entri</strong> dengan grade E (nilai < 35) yang perlu ditindaklanjuti.` });

  return insights;
}
