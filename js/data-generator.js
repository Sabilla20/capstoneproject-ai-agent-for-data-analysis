/**
 * js/data-generator.js
 * Menghasilkan dataset dummy akademik ≥1000 baris menggunakan JavaScript murni.
 * Deterministik dengan LCG PRNG sehingga hasilnya konsisten setiap muat.
 */

'use strict';

/* ── Seeded PRNG (LCG) ──────────────────────────────────────────────────────*/
class SeededRandom {
  constructor(seed = 42) { this.seed = seed >>> 0; }
  next() {
    this.seed = (Math.imul(1664525, this.seed) + 1013904223) >>> 0;
    return this.seed / 0xFFFFFFFF;
  }
  nextInt(min, max) { return Math.floor(this.next() * (max - min + 1)) + min; }
  nextFloat(min, max) { return this.next() * (max - min) + min; }
  choice(arr) { return arr[this.nextInt(0, arr.length - 1)]; }
  sample(arr, n) {
    const copy = [...arr];
    const result = [];
    for (let i = 0; i < n && copy.length; i++) {
      const idx = this.nextInt(0, copy.length - 1);
      result.push(copy.splice(idx, 1)[0]);
    }
    return result;
  }
  /** Beta-ish distribution via two uniform draws (Box-Muller not needed here) */
  beta(a, b) {
    // Simple approximation using mean=a/(a+b), variance small
    const mu = a / (a + b);
    const noise = (this.next() - 0.5) * 0.25;
    return Math.min(0.98, Math.max(0.02, mu + noise));
  }
  normal(mean, std) {
    // Box-Muller
    const u1 = this.next() || 1e-10;
    const u2 = this.next();
    const z  = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + std * z;
  }
}

/* ── Konstanta ──────────────────────────────────────────────────────────────*/
const PRODI_LIST = [
  'Teknik Informatika', 'Sistem Informasi', 'Manajemen',
  'Akuntansi', 'Ilmu Komunikasi',
];

const MK_PER_PRODI = {
  'Teknik Informatika': [
    'Algoritma & Pemrograman', 'Basis Data', 'Jaringan Komputer',
    'Kecerdasan Buatan', 'Pemrograman Web', 'Sistem Operasi',
    'Rekayasa Perangkat Lunak', 'Statistika',
  ],
  'Sistem Informasi': [
    'Analisis Sistem', 'Basis Data', 'E-Business',
    'Manajemen Proyek IT', 'Pemrograman Web', 'Sistem ERP',
    'Audit Sistem Informasi', 'Statistika',
  ],
  'Manajemen': [
    'Manajemen SDM', 'Manajemen Keuangan', 'Pemasaran Digital',
    'Kewirausahaan', 'Riset Operasi', 'Akuntansi Manajemen',
    'Ekonomi Mikro', 'Statistika Bisnis',
  ],
  'Akuntansi': [
    'Akuntansi Keuangan', 'Perpajakan', 'Audit',
    'Akuntansi Biaya', 'Sistem Informasi Akuntansi',
    'Ekonomi Makro', 'Manajemen Keuangan', 'Statistika',
  ],
  'Ilmu Komunikasi': [
    'Komunikasi Massa', 'Jurnalistik', 'Public Relations',
    'Fotografi & Videografi', 'Media Sosial', 'Komunikasi Antarbudaya',
    'Semiotika', 'Statistika Sosial',
  ],
};

const NAMA_DEPAN = [
  'Adi','Budi','Citra','Dewi','Eka','Fajar','Gilang','Hana','Indra','Joko',
  'Kartika','Lutfi','Maya','Nanda','Okta','Putri','Rizky','Sari','Taufik',
  'Umar','Vina','Wahyu','Xena','Yusuf','Zahra','Agus','Bagas','Cyntia',
  'Dimas','Elsa','Firman','Gita','Hendra','Ira','Johan','Kirana','Laras',
  'Mira','Nico','Olivia','Pandu','Qori','Reza','Sinta','Tomi','Ulfa',
  'Vicky','Wulan','Yanti','Zaki',
];
const NAMA_BELAKANG = [
  'Pratama','Susanto','Wulandari','Setiawan','Nugroho','Hidayat','Rahayu',
  'Kurniawan','Permata','Santoso','Lestari','Utama','Wijaya','Saputra',
  'Dewantara','Puspita','Ramadhan','Azzahra','Prasetyo','Yusrianto',
  'Mahendra','Fitriani','Nuraini','Adiputra','Harahap','Sinaga','Manurung',
  'Situmorang','Simanjuntak','Pakpahan',
];
const ANGKATAN_LIST  = [2020, 2021, 2022, 2023];
const SEMESTER_LIST  = [1, 2, 3, 4, 5, 6, 7, 8];
const TOTAL_MAHASISWA = 260;

/* ── Helper ─────────────────────────────────────────────────────────────────*/
function gradeFromNilai(n) {
  if (n >= 85) return 'A';
  if (n >= 75) return 'B+';
  if (n >= 65) return 'B';
  if (n >= 55) return 'C+';
  if (n >= 45) return 'C';
  if (n >= 35) return 'D';
  return 'E';
}

function ipkFromAvg(avg) {
  if (avg >= 85) return Math.min(4.0, +(3.5 + (avg - 85) * 0.05).toFixed(2));
  if (avg >= 70) return +(2.75 + (avg - 70) * 0.05).toFixed(2);
  if (avg >= 55) return +(1.5  + (avg - 55) * 0.083).toFixed(2);
  return Math.max(0.5, +(avg * 0.025).toFixed(2));
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/* ── Generator utama ────────────────────────────────────────────────────────*/
function generateDataset() {
  const rng     = new SeededRandom(42);
  const records = [];

  for (let i = 0; i < TOTAL_MAHASISWA; i++) {
    const prodiIdx  = i % PRODI_LIST.length;
    const prodi     = PRODI_LIST[prodiIdx];
    const angkatan  = rng.choice(ANGKATAN_LIST);
    const semester  = rng.choice(SEMESTER_LIST);
    const seq       = String(i + 1).padStart(4, '0');
    const nim       = `${String(angkatan).slice(-2)}${String(prodiIdx + 1).padStart(2,'0')}${seq}`;
    const nama      = `${rng.choice(NAMA_DEPAN)} ${rng.choice(NAMA_BELAKANG)}`;

    const ability       = rng.beta(5, 2);       // ~0.6–0.85
    const attendBase    = rng.beta(6, 2);       // ~0.7–0.9

    const mkList    = MK_PER_PRODI[prodi];
    const nMk       = rng.nextInt(4, mkList.length);
    const selected  = rng.sample(mkList, nMk);
    const nilaiList = [];

    for (const mk of selected) {
      const kehadiran = +clamp(rng.normal(attendBase * 100, 8), 40, 100).toFixed(1);
      const base      = ability * 60 + (kehadiran / 100) * 25;
      const nilai     = +clamp(rng.normal(base, 8), 0, 100).toFixed(1);
      nilaiList.push(nilai);

      records.push({
        NIM:              nim,
        Nama:             nama,
        'Program Studi':  prodi,
        Angkatan:         angkatan,
        Semester:         semester,
        'Mata Kuliah':    mk,
        Nilai:            nilai,
        Grade:            gradeFromNilai(nilai),
        IPK:              0,           // filled below
        'Kehadiran (%)':  kehadiran,
      });
    }

    const ipk = ipkFromAvg(nilaiList.reduce((a,b)=>a+b,0)/nilaiList.length);
    // Update IPK for all rows of this student
    for (let j = records.length - selected.length; j < records.length; j++) {
      records[j].IPK = ipk;
    }
  }

  // Insert ~1% missing values
  const nMissing = Math.max(1, Math.floor(records.length * 0.01));
  for (let m = 0; m < nMissing; m++) {
    const idx = rng.nextInt(0, records.length - 1);
    records[idx].Nilai = null;
  }
  for (let m = 0; m < nMissing; m++) {
    const idx = rng.nextInt(0, records.length - 1);
    records[idx]['Kehadiran (%)'] = null;
  }

  // Insert ~0.5% duplicates
  const nDup = Math.max(1, Math.floor(records.length * 0.005));
  const dupSlice = records.slice(0, nDup).map(r => ({ ...r }));
  records.push(...dupSlice);

  return records;
}

/* ── CSV builder ────────────────────────────────────────────────────────────*/
function datasetToCSV(records) {
  if (!records.length) return '';
  const cols = Object.keys(records[0]);
  const header = cols.join(',');
  const rows   = records.map(r =>
    cols.map(c => {
      const v = r[c];
      if (v === null || v === undefined) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g,'""')}"` : s;
    }).join(',')
  );
  return [header, ...rows].join('\r\n');
}

/* ── Cached dataset ─────────────────────────────────────────────────────────*/
let _cachedDataset = null;

function getDummyDataset() {
  if (!_cachedDataset) _cachedDataset = generateDataset();
  return _cachedDataset;
}

function resetDataset() { _cachedDataset = null; }

/* ── Parse uploaded CSV ─────────────────────────────────────────────────────*/
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVRow(lines[0]);
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVRow(lines[i]);
    if (vals.length !== headers.length) continue;
    const rec = {};
    headers.forEach((h, j) => {
      const v = vals[j].trim();
      // Auto-numeric
      const num = parseFloat(v);
      rec[h] = (!isNaN(num) && v !== '') ? num : (v === '' ? null : v);
    });
    records.push(rec);
  }
  return records;
}

function parseCSVRow(line) {
  const result = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i+1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) {
      result.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

/* ── Parse uploaded Excel via SheetJS (global XLSX) ────────────────────────*/
function parseExcel(arrayBuffer) {
  if (typeof XLSX === 'undefined') throw new Error('SheetJS (XLSX) belum dimuat.');
  const wb  = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
  const ws  = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { defval: null });
  // Normalize numeric fields
  const numFields = ['Nilai','IPK','Kehadiran (%)','Semester','Angkatan'];
  return raw.map(r => {
    const rec = { ...r };
    numFields.forEach(f => {
      if (rec[f] !== null && rec[f] !== undefined && rec[f] !== '') {
        const n = parseFloat(rec[f]);
        rec[f] = isNaN(n) ? null : n;
      }
    });
    return rec;
  });
}
