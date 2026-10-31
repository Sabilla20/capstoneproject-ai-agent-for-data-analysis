# 🎓 EduTrack AI – AI Agent untuk Analisis Data Akademik Mahasiswa

Aplikasi web **pure HTML/CSS/JavaScript** yang berjalan langsung di browser — tanpa Python, tanpa Flask, tanpa instalasi backend apapun. Buka file `index.html` dan langsung gunakan.

---

## 🚀 Cara Menjalankan

### Metode 1 — Buka Langsung (Paling Mudah)
```
Klik dua kali index.html → Buka di browser
```
> ⚠️ Beberapa fitur (upload file) mungkin terbatas pada browser Chrome/Edge dengan `file://`. Gunakan metode 2 untuk hasil terbaik.

### Metode 2 — Live Server (Direkomendasikan)
```bash
# Menggunakan VS Code Extension "Live Server"
# Klik kanan index.html → "Open with Live Server"

# Atau menggunakan Python HTTP server (jika Python tersedia)
python -m http.server 8080
# Buka: http://localhost:8080

# Atau menggunakan Node.js
npx serve .
# Buka: http://localhost:3000
```

### Tidak Ada Instalasi yang Wajib
Semua dependensi dimuat dari CDN:
- **Chart.js 4.4.3** — Visualisasi chart interaktif
- **SheetJS (XLSX 0.18.5)** — Baca/tulis file Excel

---

## 📁 Struktur Proyek

```
capstoneproject-ai-agent-for-data-analysis/
├── index.html              ← File utama, buka di browser
├── README.md
├── css/
│   └── style.css           ← Styling lengkap, modern, responsif
├── js/
│   ├── data-generator.js   ← Generator dataset dummy 1300+ baris (pure JS)
│   ├── data-analyzer.js    ← Semua fungsi analisis statistik
│   ├── ai-agent.js         ← AI Agent (mode lokal + opsional AI API)
│   ├── charts.js           ← Semua chart via Chart.js
│   ├── exporter.js         ← Ekspor CSV, Excel, HTML
│   └── app.js              ← Orchestrator utama, event binding
│
│   ── (Legacy Python/Streamlit — tidak digunakan, dapat dihapus) ──
├── app.py
├── generate_data.py
├── requirements.txt
└── utils/
    ├── data_generator.py
    ├── data_analyzer.py
    ├── ai_agent.py
    ├── visualizations.py
    └── report_exporter.py
```

---

## 🎯 Fitur Lengkap

| Halaman | Fitur |
|---------|-------|
| **🏠 Dashboard** | 8 KPI card, histogram distribusi nilai, pie grade, tren semester, perbandingan prodi, quick insights |
| **🤖 AI Agent** | Chat NLP bahasa Indonesia, 15+ intent, mode lokal gratis, mode API opsional |
| **📊 Visualisasi** | 9 chart interaktif dalam 6 tab: distribusi, semester, MK, prodi, scatter kehadiran, peta risiko |
| **💡 AI Insights** | 10+ temuan otomatis, threshold slider pendampingan, laporan kualitas data |
| **👨‍🎓 Data Mahasiswa** | Cari NIM/nama, peringkat top/bottom, filter MK & grade, tabel sortable |
| **📁 Ekspor** | CSV bersih, Excel multi-sheet, laporan HTML, download dataset demo |

---

## 🤖 AI Agent – Cara Kerja

### Mode Lokal (Default, Gratis, Tanpa Internet)
AI Agent menggunakan **NLP rule-based** dengan 15 kategori intent:
- Deteksi pertanyaan via regex bahasa Indonesia
- Memanggil fungsi analisis yang sesuai
- Jawaban berdasarkan data aktual — **tidak mengarang informasi**
- Fallback jujur jika pertanyaan tidak dikenali

### Mode API (Opsional, OpenAI-compatible)
Aktifkan di **AI Agent → Pengaturan AI Agent**:
1. Pilih "Mode API"
2. Masukkan API Key (format: `sk-...`)
3. Pilih model (gpt-4o-mini direkomendasikan)
4. Klik "Simpan Konfigurasi"

Mendukung **semua API OpenAI-compatible**: OpenAI, Groq, OpenRouter, Together AI, Mistral, dsb.

### Contoh Pertanyaan

```
✅ Siapa mahasiswa dengan nilai tertinggi?
✅ Siapa 5 mahasiswa dengan IPK tertinggi?
✅ Mata kuliah apa yang memiliki tingkat kelulusan terendah?
✅ Apakah kehadiran memengaruhi nilai mahasiswa?
✅ Tampilkan ringkasan statistik akademik
✅ Bagaimana tren nilai per semester?
✅ Tampilkan distribusi grade mahasiswa
✅ Siapa mahasiswa yang perlu pendampingan?
✅ Bagaimana perbandingan antar program studi?
✅ Berikan insight dan temuan akademik
✅ Bagaimana kualitas data saat ini?
✅ Cari mahasiswa bernama Budi
```

---

## 📊 Dataset Demo

Dataset dihasilkan secara **deterministik** oleh [`js/data-generator.js`](js/data-generator.js) menggunakan **LCG (Linear Congruential Generator)**:

- **≥1.300 baris** data akademik
- **260 mahasiswa unik**, 5 program studi, 8 mata kuliah per prodi
- Nilai mengikuti distribusi realistis (dipengaruhi ability + kehadiran + noise normal)
- ±1% *missing values* dan ±0.5% *duplikat* untuk latihan kualitas data
- Dihasilkan konsisten setiap kali halaman dimuat (seed deterministik)

---

## 📤 Upload Data Sendiri

Klik **Upload CSV / Excel** di sidebar. Format yang didukung:

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| NIM | string | Nomor Induk Mahasiswa |
| Nama | string | Nama lengkap |
| Program Studi | string | Nama program studi |
| Angkatan | integer | Tahun angkatan |
| Semester | integer | Semester aktif |
| Mata Kuliah | string | Nama mata kuliah |
| Nilai | float | Nilai 0–100 |
| Grade | string | A/B+/B/C+/C/D/E |
| IPK | float | 0.0–4.0 |
| Kehadiran (%) | float | 0–100 |

Kolom yang tidak tersedia akan diabaikan secara otomatis.

---

## 📦 Teknologi

| Teknologi | Fungsi |
|-----------|--------|
| HTML5 / CSS3 | Struktur & tampilan |
| JavaScript ES2022 | Logika analisis & UI |
| Chart.js 4.4.3 | Visualisasi chart |
| SheetJS (XLSX) | Baca Excel, ekspor Excel |
| Google Fonts / System UI | Tipografi |
| CDN-only | Tidak ada build step |

---

## 🔒 Keamanan & Privasi

- **API Key** tidak disimpan ke server manapun — hanya di memori browser selama tab aktif
- **Semua data** diproses di browser Anda (client-side), tidak dikirim ke manapun
- **Mode lokal** 100% offline setelah CDN dimuat pertama kali

---

## 📝 Lisensi

MIT License — bebas digunakan untuk keperluan akademik dan non-komersial.

---

*EduTrack AI v2.0 — Pure HTML/JS Web App · Dibuat untuk mata kuliah Kecerdasan Bisnis*
