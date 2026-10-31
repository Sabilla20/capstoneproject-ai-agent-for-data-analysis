/**
 * js/ai-agent.js
 * AI Agent dengan dua mode:
 *   1. MODE LOKAL — NLP rule-based, jawaban 100% dari data aktual
 *   2. MODE API   — kirim pertanyaan + ringkasan data ke AI API (OpenAI-compatible)
 *
 * Tidak memerlukan API berbayar untuk mode lokal.
 */

'use strict';

/* ── Konfigurasi API ─────────────────────────────────────────────────────── */
const AgentConfig = {
  mode:    'local',     // 'local' | 'api'
  apiUrl:  'https://api.openai.com/v1/chat/completions',
  apiKey:  '',
  model:   'gpt-4o-mini',
};

function setAgentConfig(cfg) { Object.assign(AgentConfig, cfg); }

/* ── Pola intent (regex bahasa Indonesia) ──────────────────────────────────*/
const INTENTS = [
  { name: 'top_student_nilai', patterns: [
    /nilai\s*tertinggi/, /siapa.*terbaik/, /mahasiswa.*terbaik/,
    /nilai.*paling.*tinggi/, /siapa.*nilai.*tinggi/, /ranking\s*mahasiswa/,
    /peringkat\s*pertama/,
  ]},
  { name: 'top_student_ipk', patterns: [
    /ipk\s*tertinggi/, /siapa.*ipk.*tinggi/, /ipk.*terbaik/,
    /terbaik.*ipk/, /gpa\s*tertinggi/, /prestasi\s*terbaik/,
  ]},
  { name: 'bottom_student', patterns: [
    /nilai\s*terendah/, /ipk\s*terendah/, /paling\s*rendah/,
    /perlu\s*pendampingan/, /butuh\s*bantuan/, /mahasiswa.*risiko/,
    /at.?risk/, /siapa.*kesulitan/,
  ]},
  { name: 'course_stats', patterns: [
    /statistik\s*mata\s*kuliah/, /performa\s*mata\s*kuliah/,
    /nilai.*per.*mata\s*kuliah/, /rata.?rata.*mata\s*kuliah/,
    /daftar\s*mata\s*kuliah/,
  ]},
  { name: 'lowest_passing', patterns: [
    /kelulusan\s*terendah/, /paling\s*sulit/, /mata\s*kuliah\s*sulit/,
    /tingkat\s*gagal.*tertinggi/, /banyak.*tidak\s*lulus/,
    /gagal\s*paling\s*banyak/, /sulit.*dilulusin/,
  ]},
  { name: 'highest_passing', patterns: [
    /kelulusan\s*tertinggi/, /paling\s*mudah/, /mata\s*kuliah\s*mudah/,
    /lulus\s*terbanyak/, /semua.*lulus/,
  ]},
  { name: 'attendance_grade', patterns: [
    /kehadiran.*nilai/, /nilai.*kehadiran/, /absensi.*nilai/,
    /pengaruh\s*kehadiran/, /korelasi.*hadir/, /hadir.*berpengaruh/,
    /apakah\s*kehadiran/, /hubungan.*kehadiran/,
  ]},
  { name: 'summary', patterns: [
    /ringkasan/, /total\s*mahasiswa/, /jumlah\s*mahasiswa/,
    /statistik\s*umum/, /overview/, /gambaran\s*umum/,
    /berapa\s*mahasiswa/, /berapa\s*total/, /resume/,
  ]},
  { name: 'prodi_compare', patterns: [
    /program\s*studi/, /prodi/, /perbandingan.*prodi/,
    /prodi.*terbaik/, /jurusan/, /fakultas/,
  ]},
  { name: 'semester_trend', patterns: [
    /tren\s*semester/, /perkembangan\s*per\s*semester/,
    /nilai.*semester/, /semester.*nilai/, /prestasi.*semester/,
    /perubahan.*semester/,
  ]},
  { name: 'grade_dist', patterns: [
    /distribusi\s*nilai/, /distribusi\s*grade/, /berapa.*dapat\s*[aA]/,
    /huruf\s*mutu/, /sebaran\s*nilai/, /persen.*grade/,
  ]},
  { name: 'at_risk', patterns: [
    /mahasiswa\s*risiko/, /perlu\s*didampingi/, /perlu\s*perhatian/,
    /rekomendasi\s*pendampingan/, /siapa.*perlu\s*dibantu/, /butuh\s*bimbingan/,
  ]},
  { name: 'data_quality', patterns: [
    /kualitas\s*data/, /data\s*kosong/, /missing\s*value/,
    /duplikat/, /data\s*duplikat/, /data.*bersih/, /integritas\s*data/,
  ]},
  { name: 'insights', patterns: [
    /insight/, /temuan/, /pola.*akademik/, /analisis\s*otomatis/,
    /rekomendasi/, /kesimpulan/, /apa\s*yang\s*menarik/,
  ]},
  { name: 'search', patterns: [
    /cari.*mahasiswa/, /mahasiswa\s*bernama/, /data\s*mahasiswa/,
    /nim\s*\d+/, /informasi.*mahasiswa/, /tampilkan.*mahasiswa/,
  ]},
];

function detectIntent(query) {
  const q = query.toLowerCase();
  for (const intent of INTENTS) {
    for (const pat of intent.patterns) {
      if (pat.test(q)) return intent.name;
    }
  }
  return 'unknown';
}

function extractNumber(query, def = 10) {
  const m = query.match(/\b(\d+)\b/);
  if (m) {
    const n = parseInt(m[1]);
    return (n >= 1 && n <= 100) ? n : def;
  }
  return def;
}

function extractKeyword(query) {
  const stop = ['cari','mahasiswa','bernama','nim','data','tampilkan',
    'informasi','tentang','dengan','yang','siapa','nama'];
  return query.split(/\s+/).filter(t => !stop.includes(t.toLowerCase())).join(' ').trim() || query.trim();
}

function fmtNum(v) {
  const f = parseFloat(v);
  return isNaN(f) ? String(v) : (Number.isInteger(f) ? String(f) : f.toFixed(2));
}

/* ══════════════════════════════════════════════════════════════════════════
   Jawaban berbasis data lokal
══════════════════════════════════════════════════════════════════════════ */
function localAnswer(query, records) {
  if (!records || !records.length) {
    return { text: '⚠️ Tidak ada data yang tersedia. Silakan muat dataset terlebih dahulu.', data: null, intent: 'no_data' };
  }

  const intent = detectIntent(query);
  const n      = extractNumber(query);

  switch (intent) {

    case 'top_student_nilai': {
      const top = getTopStudents(records, n, 'Rata-rata Nilai');
      if (!top.length) return noData(intent);
      const lines = [`🏆 **${n} Mahasiswa dengan Nilai Tertinggi:**\n`];
      top.forEach((m,i) =>
        lines.push(`${i+1}. ${m.Nama} (${m.NIM}) — Nilai: ${fmtNum(m['Rata-rata Nilai'])}, IPK: ${fmtNum(m.IPK)}, Prodi: ${m['Program Studi']}`));
      return { text: lines.join('\n'), data: top, table: true, intent };
    }

    case 'top_student_ipk': {
      const top = getTopStudents(records, n, 'IPK');
      if (!top.length) return noData(intent);
      const lines = [`🎓 **${n} Mahasiswa dengan IPK Tertinggi:**\n`];
      top.forEach((m,i) =>
        lines.push(`${i+1}. ${m.Nama} (${m.NIM}) — IPK: ${fmtNum(m.IPK)}, Nilai: ${fmtNum(m['Rata-rata Nilai'])}, Prodi: ${m['Program Studi']}`));
      return { text: lines.join('\n'), data: top, table: true, intent };
    }

    case 'bottom_student': {
      const bot = getBottomStudents(records, n);
      if (!bot.length) return noData(intent);
      const lines = [`⚠️ **${n} Mahasiswa dengan IPK Terendah:**\n`];
      bot.forEach((m,i) =>
        lines.push(`${i+1}. ${m.Nama} (${m.NIM}) — IPK: ${fmtNum(m.IPK)}, Nilai: ${fmtNum(m['Rata-rata Nilai'])}, Kehadiran: ${fmtNum(m['Rata-rata Kehadiran'])}%, Prodi: ${m['Program Studi']}`));
      return { text: lines.join('\n'), data: bot, table: true, intent };
    }

    case 'course_stats': {
      const stats = getCourseStats(records);
      const best  = stats[0], worst = stats[stats.length - 1];
      const text  = `📚 **Statistik ${stats.length} Mata Kuliah:**\n\nNilai rata-rata tertinggi: **${best['Mata Kuliah']}** (${best['Rata-rata Nilai']})\nNilai rata-rata terendah: **${worst['Mata Kuliah']}** (${worst['Rata-rata Nilai']})\n\nLihat tabel di bawah untuk detail lengkap.`;
      return { text, data: stats, table: true, intent };
    }

    case 'lowest_passing': {
      const lo = getLowestPassingCourse(records);
      if (!lo) return noData(intent);
      return { text: `📉 Mata kuliah dengan **tingkat kelulusan terendah**:\n\n**${lo['Mata Kuliah']}**\n- Tingkat kelulusan: **${lo['Tingkat Kelulusan (%)']}%**\n- Rata-rata nilai: ${lo['Rata-rata Nilai']}\n- Jumlah peserta: ${lo['Jumlah Peserta']} mahasiswa\n\nMata kuliah ini mungkin perlu perhatian khusus dalam metode pengajaran.`, data: lo, intent };
    }

    case 'highest_passing': {
      const hi = getHighestPassingCourse(records);
      if (!hi) return noData(intent);
      return { text: `✅ Mata kuliah dengan **tingkat kelulusan tertinggi**:\n\n**${hi['Mata Kuliah']}**\n- Tingkat kelulusan: **${hi['Tingkat Kelulusan (%)']}%**\n- Rata-rata nilai: ${hi['Rata-rata Nilai']}\n- Jumlah peserta: ${hi['Jumlah Peserta']} mahasiswa`, data: hi, intent };
    }

    case 'attendance_grade': {
      const corr = analyzeAttendanceVsGrade(records);
      const text = `📊 **Analisis Hubungan Kehadiran dan Nilai:**\n\n${corr.interpretasi}\n\n- Koefisien korelasi Pearson: **r = ${corr.r}**\n- P-value: ≈ ${corr.p}\n- Kekuatan korelasi: ${corr.strength}\n- Jumlah sampel: ${corr.n.toLocaleString('id-ID')} entri data`;
      return { text, data: corr, intent };
    }

    case 'summary': {
      const s = getSummaryStats(records);
      return { text: `📋 **Ringkasan Statistik Akademik:**\n\n- Total mahasiswa: **${s.totalMahasiswa.toLocaleString('id-ID')}**\n- Total entri data: ${s.totalEntri.toLocaleString('id-ID')}\n- Rata-rata nilai: **${s.rataRataNilai}**\n- Rata-rata IPK: **${s.rataRataIPK}**\n- Rata-rata kehadiran: **${s.rataRataKehadiran}%**\n- Jumlah program studi: ${s.totalProdi}\n- Jumlah mata kuliah: ${s.totalMK}`, data: s, intent };
    }

    case 'prodi_compare': {
      const prodi = getProdiStats(records);
      const best  = prodi.reduce((a,b) => b['Rata-rata IPK'] > a['Rata-rata IPK'] ? b : a, prodi[0]);
      const lines = [`🏫 **Perbandingan Antar Program Studi:**\n`, `🥇 Terbaik: **${best['Program Studi']}** (IPK ${best['Rata-rata IPK']})\n`];
      prodi.forEach(p =>
        lines.push(`- ${p['Program Studi']}: ${p['Jumlah Mahasiswa']} mhs, Nilai ${p['Rata-rata Nilai']}, IPK ${p['Rata-rata IPK']}, Kehadiran ${p['Rata-rata Kehadiran']}%`));
      return { text: lines.join('\n'), data: prodi, table: true, intent };
    }

    case 'semester_trend': {
      const trend = getSemesterTrend(records);
      if (trend.length < 2) return noData(intent);
      const diff = round1(trend[trend.length-1]['Rata-rata Nilai'] - trend[0]['Rata-rata Nilai']);
      const arah = diff > 0 ? 'meningkat' : 'menurun';
      const lines = [`📈 **Tren Prestasi Per Semester:**\n`, `Dari semester ${trend[0].Semester} ke ${trend[trend.length-1].Semester}, rata-rata nilai **${arah}** sebesar ${Math.abs(diff)} poin.\n`];
      trend.forEach(t =>
        lines.push(`- Semester ${t.Semester}: Nilai ${t['Rata-rata Nilai']}, IPK ${t['Rata-rata IPK']}, Kehadiran ${t['Rata-rata Kehadiran']}%`));
      return { text: lines.join('\n'), data: trend, table: true, intent };
    }

    case 'grade_dist': {
      const dist  = getGradeDistribution(records);
      const total = dist.reduce((s,d) => s+d.Jumlah, 0);
      const lines = ['📊 **Distribusi Grade / Huruf Mutu:**\n'];
      dist.forEach(d => {
        const bar = '█'.repeat(Math.floor(d['Persentase (%)']/2));
        lines.push(`- **${d.Grade}**: ${d.Jumlah.toLocaleString('id-ID')} (${d['Persentase (%)']}%) ${bar}`);
      });
      lines.push(`\nTotal: ${total.toLocaleString('id-ID')} entri`);
      return { text: lines.join('\n'), data: dist, table: true, intent };
    }

    case 'at_risk': {
      const risk  = getAtRiskStudents(records);
      const nHigh = risk.filter(r => r.Status === 'Prioritas Tinggi').length;
      if (!risk.length) return { text: '✅ Tidak ditemukan mahasiswa yang perlu pendampingan berdasarkan ambang batas saat ini.', data: null, intent };
      return { text: `🚨 **Rekomendasi Pendampingan Mahasiswa:**\n\nDitemukan **${risk.length} mahasiswa** yang memerlukan perhatian.\n- Prioritas Tinggi: **${nHigh} mahasiswa**\n\nLihat tabel di bawah untuk daftar lengkap.`, data: risk, table: true, intent };
    }

    case 'data_quality': {
      const q     = getDataQuality(records);
      const miss  = Object.entries(q.missing || {}).map(([k,v])=>`${k}: ${v}`).join(', ') || 'Tidak ada';
      return { text: `🔍 **Laporan Kualitas Data:**\n\n- Total baris: ${q.total.toLocaleString('id-ID')}\n- Total kolom: ${q.columns}\n- Nilai kosong: ${miss}\n- Baris duplikat: ${q.duplicates} (${q.duplicatesPct}%)`, data: q, intent };
    }

    case 'insights': {
      const ins = generateInsights(records);
      const lines = ['🧠 **AI Insights – Temuan Pola Akademik:**\n'];
      ins.forEach((item, i) => lines.push(`${i+1}. ${item.text.replace(/<[^>]+>/g,'')}`));
      return { text: lines.join('\n'), data: ins, intent };
    }

    case 'search': {
      const kw     = extractKeyword(query);
      const found  = searchStudents(records, kw);
      if (!found.length) return { text: `❌ Tidak ditemukan data mahasiswa dengan kata kunci **"${kw}"**. Periksa ejaan nama atau nomor NIM.`, data: null, intent };
      const nims = new Set(found.map(r => r.NIM));
      return { text: `🔎 Ditemukan **${nims.size}** mahasiswa (${found.length} entri) untuk kata kunci **"${kw}"**.`, data: found, table: true, intent };
    }

    default: {
      const suggestions = [
        '- Siapa mahasiswa dengan nilai tertinggi?',
        '- Mata kuliah apa yang memiliki tingkat kelulusan terendah?',
        '- Apakah kehadiran memengaruhi nilai mahasiswa?',
        '- Tampilkan ringkasan statistik akademik',
        '- Berikan rekomendasi pendampingan mahasiswa',
        '- Tampilkan tren prestasi per semester',
        '- Bagaimana perbandingan antar program studi?',
        '- Tampilkan distribusi nilai',
        '- Berikan insight dan temuan akademik',
      ];
      return { text: `🤔 Maaf, saya belum memahami pertanyaan tersebut. Berikut contoh pertanyaan:\n\n${suggestions.join('\n')}`, data: null, intent: 'unknown' };
    }
  }
}

function noData(intent) {
  return { text: '⚠️ Data tidak tersedia untuk analisis ini.', data: null, intent };
}

function round1(v) { return Math.round(v * 10) / 10; }

/* ══════════════════════════════════════════════════════════════════════════
   Jawaban berbasis AI API (OpenAI-compatible)
══════════════════════════════════════════════════════════════════════════ */
async function apiAnswer(query, records) {
  if (!AgentConfig.apiKey) {
    return { text: '⚠️ API Key belum dikonfigurasi. Silakan masukkan API Key di panel Pengaturan AI atau gunakan Mode Lokal.', data: null, intent: 'api_missing' };
  }

  const stats  = getSummaryStats(records);
  const prodi  = getProdiStats(records);
  const top5   = getTopStudents(records, 5, 'IPK');
  const lo     = getLowestPassingCourse(records);
  const corr   = analyzeAttendanceVsGrade(records);

  const context = `
Dataset Akademik Mahasiswa:
- Total mahasiswa: ${stats.totalMahasiswa}
- Total entri: ${stats.totalEntri}
- Rata-rata nilai: ${stats.rataRataNilai}
- Rata-rata IPK: ${stats.rataRataIPK}
- Rata-rata kehadiran: ${stats.rataRataKehadiran}%
- Program studi: ${prodi.map(p=>`${p['Program Studi']}(IPK ${p['Rata-rata IPK']})`).join(', ')}
- Top 5 IPK: ${top5.map(m=>`${m.Nama}(${m.IPK})`).join(', ')}
- Mata kuliah kelulusan terendah: ${lo ? `${lo['Mata Kuliah']} (${lo['Tingkat Kelulusan (%)']}%)` : 'N/A'}
- Korelasi kehadiran-nilai: r=${corr.r} (${corr.strength}, ${corr.sig?'signifikan':'tidak signifikan'})
`.trim();

  const messages = [
    { role: 'system', content: `Kamu adalah AI Agent untuk analisis data akademik mahasiswa. Jawab HANYA berdasarkan data berikut (jangan mengarang):\n\n${context}\n\nGunakan bahasa Indonesia. Jawab ringkas dan faktual.` },
    { role: 'user', content: query },
  ];

  try {
    const res = await fetch(AgentConfig.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AgentConfig.apiKey}`,
      },
      body: JSON.stringify({ model: AgentConfig.model, messages, max_tokens: 600, temperature: 0.3 }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }
    const json = await res.json();
    const text = json.choices?.[0]?.message?.content || 'Tidak ada respons dari AI.';
    return { text: `🤖 ${text}`, data: null, intent: 'api' };
  } catch (e) {
    return { text: `❌ Gagal menghubungi AI API: ${e.message}\n\nBeralih ke mode lokal untuk analisis berbasis data.`, data: null, intent: 'api_error' };
  }
}

/* ── Entry point ─────────────────────────────────────────────────────────── */
async function askAgent(query, records) {
  if (AgentConfig.mode === 'api' && AgentConfig.apiKey) {
    return apiAnswer(query, records);
  }
  return localAnswer(query, records);
}
