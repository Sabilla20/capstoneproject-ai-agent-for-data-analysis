"""
utils/ai_agent.py
AI Agent berbasis rule/NLP lokal — memahami pertanyaan bahasa Indonesia,
memilih fungsi analisis yang tepat, mengembalikan jawaban berbasis data aktual.
Tidak memerlukan API berbayar.
"""
from __future__ import annotations

import re
import pandas as pd
from utils.data_analyzer import (
    get_summary_stats,
    get_top_students,
    get_bottom_students,
    get_student_detail,
    get_course_stats,
    get_lowest_passing_course,
    get_highest_passing_course,
    get_prodi_stats,
    get_semester_trend,
    analyze_attendance_vs_grade,
    get_grade_distribution,
    get_at_risk_students,
    generate_insights,
    get_data_quality_report,
    clean_data,
)

# ── Tipe respons ─────────────────────────────────────────────────────────────

class AgentResponse:
    """Hasil dari AI Agent."""
    def __init__(
        self,
        answer: str,
        data: pd.DataFrame | dict | list | None = None,
        chart_hint: str | None = None,
        intent: str = "unknown",
    ) -> None:
        self.answer    = answer        # Teks jawaban bahasa Indonesia
        self.data      = data          # Data pendukung (opsional)
        self.chart_hint = chart_hint   # Saran jenis chart (opsional)
        self.intent    = intent        # Label intent yang terdeteksi


# ── Pola intent ──────────────────────────────────────────────────────────────

_INTENTS: list[tuple[str, list[str]]] = [
    # (nama_intent, [pola_regex, ...])
    ("top_student_nilai", [
        r"nilai\s*tertinggi", r"siapa.*terbaik", r"mahasiswa.*terbaik",
        r"terbaik.*mahasiswa", r"nilai.*paling.*tinggi",
        r"siapa.*nilai.*tinggi", r"ranking\s*mahasiswa",
    ]),
    ("top_student_ipk", [
        r"ipk\s*tertinggi", r"siapa.*ipk.*tinggi", r"ipk.*terbaik",
        r"terbaik.*ipk", r"gpa\s*tertinggi",
    ]),
    ("bottom_student", [
        r"nilai\s*terendah", r"ipk\s*terendah", r"paling\s*rendah",
        r"perlu\s*pendampingan", r"butuh\s*bantuan", r"mahasiswa.*risiko",
        r"at.?risk", r"siapa.*kesulitan",
    ]),
    ("course_stats", [
        r"statistik\s*mata\s*kuliah", r"performa\s*mata\s*kuliah",
        r"nilai.*per.*mata\s*kuliah", r"rata.?rata.*mata\s*kuliah",
        r"daftar\s*mata\s*kuliah",
    ]),
    ("lowest_passing_course", [
        r"kelulusan\s*terendah", r"paling\s*sulit", r"mata\s*kuliah\s*sulit",
        r"tingkat\s*gagal.*tertinggi", r"banyak.*tidak\s*lulus",
        r"gagal\s*paling\s*banyak",
    ]),
    ("highest_passing_course", [
        r"kelulusan\s*tertinggi", r"paling\s*mudah", r"mata\s*kuliah\s*mudah",
        r"semua.*lulus", r"lulus\s*terbanyak",
    ]),
    ("attendance_vs_grade", [
        r"kehadiran.*nilai", r"nilai.*kehadiran", r"absensi.*nilai",
        r"pengaruh\s*kehadiran", r"korelasi.*hadir", r"hadir.*berpengaruh",
        r"apakah\s*kehadiran", r"hubungan.*kehadiran",
    ]),
    ("summary_stats", [
        r"ringkasan", r"total\s*mahasiswa", r"jumlah\s*mahasiswa",
        r"statistik\s*umum", r"overview", r"gambaran\s*umum",
        r"berapa\s*mahasiswa", r"berapa\s*total",
    ]),
    ("prodi_comparison", [
        r"program\s*studi", r"prodi", r"perbandingan.*prodi",
        r"prodi.*terbaik", r"jurusan",
    ]),
    ("semester_trend", [
        r"tren\s*semester", r"perkembangan\s*per\s*semester",
        r"nilai.*semester", r"semester.*nilai", r"prestasi.*semester",
    ]),
    ("grade_distribution", [
        r"distribusi\s*nilai", r"distribusi\s*grade", r"berapa.*dapat\s*[aA]",
        r"huruf\s*mutu", r"sebaran\s*nilai",
    ]),
    ("at_risk_students", [
        r"mahasiswa\s*risiko", r"perlu\s*didampingi", r"perlu\s*perhatian",
        r"rekomendasi\s*pendampingan", r"siapa.*perlu\s*dibantu",
    ]),
    ("data_quality", [
        r"kualitas\s*data", r"data\s*kosong", r"missing\s*value",
        r"duplikat", r"data\s*duplikat", r"data.*bersih",
    ]),
    ("insights", [
        r"insight", r"temuan", r"pola.*akademik", r"analisis\s*otomatis",
        r"rekomendasi", r"kesimpulan",
    ]),
    ("search_student", [
        r"cari.*mahasiswa", r"mahasiswa\s*bernama", r"data\s*mahasiswa",
        r"nim\s*\d+", r"informasi.*mahasiswa",
    ]),
]


def _detect_intent(query: str) -> str:
    q = query.lower()
    for intent_name, patterns in _INTENTS:
        for pat in patterns:
            if re.search(pat, q):
                return intent_name
    return "unknown"


def _extract_number(query: str, default: int = 10) -> int:
    """Ekstrak angka dari query, misal 'top 5 mahasiswa' → 5."""
    m = re.search(r"\b(\d+)\b", query)
    if m:
        val = int(m.group(1))
        return val if 1 <= val <= 100 else default
    return default


def _extract_name_or_nim(query: str) -> str:
    """Coba ekstrak nama / NIM dari query."""
    # Hapus kata-kata umum, sisakan kemungkinan nama/NIM
    stopwords = [
        "cari", "mahasiswa", "bernama", "nim", "data", "tampilkan",
        "informasi", "tentang", "dengan", "yang", "siapa",
    ]
    tokens = query.split()
    candidate = " ".join(t for t in tokens if t.lower() not in stopwords)
    return candidate.strip() or query.strip()


def _fmt_number(val) -> str:
    try:
        f = float(val)
        return f"{f:.2f}" if f != int(f) else str(int(f))
    except Exception:
        return str(val)


# ── Fungsi utama ─────────────────────────────────────────────────────────────

def ask_agent(query: str, df: pd.DataFrame) -> AgentResponse:
    """
    Terima pertanyaan bahasa Indonesia, analisis data, kembalikan AgentResponse.
    Semua jawaban berdasarkan data aktual — tidak mengarang.
    """
    if df is None or df.empty:
        return AgentResponse(
            answer="⚠️ Tidak ada data yang tersedia untuk dianalisis. Silakan muat dataset terlebih dahulu.",
            intent="no_data",
        )

    intent = _detect_intent(query)
    n      = _extract_number(query)

    # ── top_student_nilai ───────────────────────────────────────────────────
    if intent == "top_student_nilai":
        top = get_top_students(df, n=n, by="Nilai")
        if top.empty:
            return AgentResponse("Tidak ditemukan data mahasiswa.", intent=intent)
        mahasiswa = top.iloc[0]
        lines = [
            f"🏆 **{n} Mahasiswa dengan Nilai Tertinggi:**\n",
        ]
        for i, row in top.iterrows():
            lines.append(
                f"{i+1}. **{row['Nama']}** ({row['NIM']}) — "
                f"Nilai: {_fmt_number(row['Nilai'])}, IPK: {_fmt_number(row['IPK'])}, "
                f"Prodi: {row['Program Studi']}"
            )
        answer = "\n".join(lines)
        return AgentResponse(answer=answer, data=top, chart_hint="bar_nilai", intent=intent)

    # ── top_student_ipk ─────────────────────────────────────────────────────
    if intent == "top_student_ipk":
        top = get_top_students(df, n=n, by="IPK")
        if top.empty:
            return AgentResponse("Tidak ditemukan data mahasiswa.", intent=intent)
        lines = [f"🎓 **{n} Mahasiswa dengan IPK Tertinggi:**\n"]
        for i, row in top.iterrows():
            lines.append(
                f"{i+1}. **{row['Nama']}** ({row['NIM']}) — "
                f"IPK: {_fmt_number(row['IPK'])}, Nilai: {_fmt_number(row['Nilai'])}, "
                f"Prodi: {row['Program Studi']}"
            )
        return AgentResponse(answer="\n".join(lines), data=top, chart_hint="bar_ipk", intent=intent)

    # ── bottom_student ───────────────────────────────────────────────────────
    if intent == "bottom_student":
        bot = get_bottom_students(df, n=n)
        if bot.empty:
            return AgentResponse("Tidak ditemukan data mahasiswa.", intent=intent)
        lines = [f"⚠️ **{n} Mahasiswa dengan IPK Terendah (Kandidat Pendampingan):**\n"]
        for i, row in bot.iterrows():
            lines.append(
                f"{i+1}. **{row['Nama']}** ({row['NIM']}) — "
                f"IPK: {_fmt_number(row['IPK'])}, Nilai: {_fmt_number(row['Nilai'])}, "
                f"Kehadiran: {_fmt_number(row['Kehadiran'])}%, Prodi: {row['Program Studi']}"
            )
        return AgentResponse(answer="\n".join(lines), data=bot, intent=intent)

    # ── course_stats ─────────────────────────────────────────────────────────
    if intent == "course_stats":
        stats = get_course_stats(df)
        answer = (
            f"📚 **Statistik {len(stats)} Mata Kuliah:**\n\n"
            f"Rata-rata nilai tertinggi: **{stats.iloc[0]['Mata Kuliah']}** "
            f"({stats.iloc[0]['Rata_Nilai']:.1f})\n"
            f"Rata-rata nilai terendah: **{stats.iloc[-1]['Mata Kuliah']}** "
            f"({stats.iloc[-1]['Rata_Nilai']:.1f})\n\n"
            "Lihat tabel di bawah untuk detail lengkap."
        )
        return AgentResponse(answer=answer, data=stats, chart_hint="course_bar", intent=intent)

    # ── lowest_passing_course ────────────────────────────────────────────────
    if intent == "lowest_passing_course":
        info = get_lowest_passing_course(df)
        answer = (
            f"📉 Mata kuliah dengan **tingkat kelulusan terendah** adalah:\n\n"
            f"**{info['mata_kuliah']}**\n"
            f"- Tingkat kelulusan: **{info['tingkat_kelulusan']}%**\n"
            f"- Rata-rata nilai: {info['rata_nilai']:.1f}\n"
            f"- Jumlah peserta: {info['jumlah_peserta']} mahasiswa\n\n"
            "Mata kuliah ini mungkin memerlukan perhatian khusus dalam metode pengajaran atau materi."
        )
        return AgentResponse(answer=answer, data=info, intent=intent)

    # ── highest_passing_course ───────────────────────────────────────────────
    if intent == "highest_passing_course":
        info = get_highest_passing_course(df)
        answer = (
            f"✅ Mata kuliah dengan **tingkat kelulusan tertinggi** adalah:\n\n"
            f"**{info['mata_kuliah']}**\n"
            f"- Tingkat kelulusan: **{info['tingkat_kelulusan']}%**\n"
            f"- Rata-rata nilai: {info['rata_nilai']:.1f}\n"
            f"- Jumlah peserta: {info['jumlah_peserta']} mahasiswa"
        )
        return AgentResponse(answer=answer, data=info, intent=intent)

    # ── attendance_vs_grade ──────────────────────────────────────────────────
    if intent == "attendance_vs_grade":
        corr = analyze_attendance_vs_grade(df)
        answer = (
            f"📊 **Analisis Hubungan Kehadiran dan Nilai:**\n\n"
            f"{corr['interpretasi']}\n\n"
            f"- Koefisien korelasi Pearson: **r = {corr['korelasi']}**\n"
            f"- P-value: {corr['p_value']}\n"
            f"- Kekuatan korelasi: {corr['kekuatan']}\n"
            f"- Jumlah sampel: {corr['n_sampel']:,} entri data"
        )
        return AgentResponse(answer=answer, data=corr, chart_hint="scatter_attendance", intent=intent)

    # ── summary_stats ────────────────────────────────────────────────────────
    if intent == "summary_stats":
        stats = get_summary_stats(df)
        answer = (
            f"📋 **Ringkasan Statistik Akademik:**\n\n"
            f"- Total mahasiswa: **{stats['total_mahasiswa']:,}**\n"
            f"- Total entri data: {stats['total_data_entries']:,}\n"
            f"- Rata-rata nilai: **{stats['rata_nilai']}**\n"
            f"- Rata-rata IPK: **{stats['rata_ipk']}**\n"
            f"- Rata-rata kehadiran: **{stats['rata_kehadiran']}%**\n"
            f"- Jumlah program studi: {stats['total_prodi']}\n"
            f"- Jumlah mata kuliah: {stats['total_mk']}"
        )
        return AgentResponse(answer=answer, data=stats, intent=intent)

    # ── prodi_comparison ─────────────────────────────────────────────────────
    if intent == "prodi_comparison":
        prodi = get_prodi_stats(df)
        best  = prodi.loc[prodi["Rata_IPK"].idxmax()]
        lines = [
            "🏫 **Perbandingan Antar Program Studi:**\n",
            f"🥇 Terbaik: **{best['Program Studi']}** (IPK {best['Rata_IPK']:.2f})\n",
        ]
        for _, row in prodi.iterrows():
            lines.append(
                f"- {row['Program Studi']}: {row['Jumlah_Mahasiswa']} mhs, "
                f"Rata-rata nilai {row['Rata_Nilai']:.1f}, IPK {row['Rata_IPK']:.2f}, "
                f"Kehadiran {row['Rata_Kehadiran']:.1f}%"
            )
        return AgentResponse(answer="\n".join(lines), data=prodi, chart_hint="prodi_bar", intent=intent)

    # ── semester_trend ───────────────────────────────────────────────────────
    if intent == "semester_trend":
        trend = get_semester_trend(df)
        first_val = trend.iloc[0]["Rata_Nilai"] if len(trend) else 0
        last_val  = trend.iloc[-1]["Rata_Nilai"] if len(trend) else 0
        diff      = last_val - first_val
        arah      = "meningkat" if diff > 0 else "menurun"
        lines = [
            f"📈 **Tren Prestasi Per Semester:**\n",
            f"Dari semester {int(trend['Semester'].min())} ke {int(trend['Semester'].max())}, "
            f"rata-rata nilai **{arah}** sebesar {abs(diff):.1f} poin.\n",
        ]
        for _, row in trend.iterrows():
            lines.append(
                f"- Semester {int(row['Semester'])}: Nilai {row['Rata_Nilai']:.1f}, "
                f"IPK {row['Rata_IPK']:.2f}, Kehadiran {row['Rata_Kehadiran']:.1f}%"
            )
        return AgentResponse(answer="\n".join(lines), data=trend, chart_hint="semester_line", intent=intent)

    # ── grade_distribution ───────────────────────────────────────────────────
    if intent == "grade_distribution":
        dist = get_grade_distribution(df)
        total = dist["Jumlah"].sum()
        lines = ["📊 **Distribusi Grade / Huruf Mutu:**\n"]
        for _, row in dist.iterrows():
            bar_len = int(row["Persentase (%)"] / 2)
            lines.append(
                f"- **{row['Grade']}**: {row['Jumlah']:,} mhs ({row['Persentase (%)']:.1f}%) "
                f"{'█' * bar_len}"
            )
        lines.append(f"\nTotal: {total:,} entri")
        return AgentResponse(answer="\n".join(lines), data=dist, chart_hint="grade_pie", intent=intent)

    # ── at_risk_students ─────────────────────────────────────────────────────
    if intent == "at_risk_students":
        risk = get_at_risk_students(df)
        n_risk   = len(risk)
        n_high   = len(risk[risk["Status"] == "Prioritas Tinggi"])
        if n_risk == 0:
            answer = "✅ Tidak ditemukan mahasiswa yang perlu pendampingan berdasarkan ambang batas nilai dan kehadiran saat ini."
        else:
            answer = (
                f"🚨 **Rekomendasi Pendampingan Mahasiswa:**\n\n"
                f"Ditemukan **{n_risk} mahasiswa** yang perlu perhatian "
                f"(nilai rata-rata <55 atau kehadiran <70%).\n"
                f"- Prioritas Tinggi (kedua kondisi terpenuhi): **{n_high} mahasiswa**\n\n"
                "Lihat tabel di bawah untuk daftar lengkap."
            )
        return AgentResponse(answer=answer, data=risk if n_risk > 0 else None, intent=intent)

    # ── data_quality ─────────────────────────────────────────────────────────
    if intent == "data_quality":
        quality = get_data_quality_report(df)
        miss_info = (
            ", ".join(f"{k}: {v}" for k, v in quality["missing_values"].items())
            if quality["missing_values"] else "Tidak ada"
        )
        answer = (
            f"🔍 **Laporan Kualitas Data:**\n\n"
            f"- Total baris: {quality['total_baris']:,}\n"
            f"- Total kolom: {quality['total_kolom']}\n"
            f"- Nilai kosong (missing): {miss_info}\n"
            f"- Baris duplikat: {quality['duplikat']} ({quality['duplikat_pct']}%)"
        )
        return AgentResponse(answer=answer, data=quality, intent=intent)

    # ── insights ─────────────────────────────────────────────────────────────
    if intent == "insights":
        ins = generate_insights(df)
        answer = "🧠 **AI Insights – Temuan Pola Akademik:**\n\n" + "\n\n".join(ins)
        return AgentResponse(answer=answer, data=ins, intent=intent)

    # ── search_student ────────────────────────────────────────────────────────
    if intent == "search_student":
        keyword = _extract_name_or_nim(query)
        if not keyword:
            return AgentResponse(
                "Masukkan nama atau NIM mahasiswa yang ingin dicari.", intent=intent
            )
        result = get_student_detail(df, keyword)
        if result.empty:
            return AgentResponse(
                f"❌ Tidak ditemukan data mahasiswa dengan kata kunci **'{keyword}'**. "
                "Periksa ejaan nama atau nomor NIM.",
                intent=intent,
            )
        mhs_info = result.groupby(["NIM", "Nama", "Program Studi"]).agg(
            Semester=("Semester", "max"),
            IPK=("IPK", "mean"),
            Rata_Nilai=("Nilai", "mean"),
            Kehadiran=("Kehadiran (%)", "mean"),
        ).reset_index()
        lines = [f"🔎 Ditemukan **{len(mhs_info)}** mahasiswa untuk kata kunci **'{keyword}'**:\n"]
        for _, row in mhs_info.iterrows():
            lines.append(
                f"- **{row['Nama']}** | NIM: {row['NIM']} | {row['Program Studi']} | "
                f"Semester {int(row['Semester'])} | IPK {row['IPK']:.2f} | "
                f"Nilai {row['Rata_Nilai']:.1f} | Kehadiran {row['Kehadiran']:.1f}%"
            )
        return AgentResponse(answer="\n".join(lines), data=result, intent=intent)

    # ── unknown ───────────────────────────────────────────────────────────────
    suggestions = [
        "- Siapa mahasiswa dengan nilai tertinggi?",
        "- Mata kuliah apa yang memiliki tingkat kelulusan terendah?",
        "- Apakah kehadiran memengaruhi nilai mahasiswa?",
        "- Tampilkan ringkasan statistik akademik",
        "- Berikan rekomendasi pendampingan mahasiswa",
        "- Tampilkan tren prestasi per semester",
        "- Bagaimana perbandingan antar program studi?",
        "- Tampilkan distribusi nilai",
    ]
    answer = (
        "🤔 Maaf, saya belum memahami pertanyaan tersebut. Berikut contoh pertanyaan yang dapat saya jawab:\n\n"
        + "\n".join(suggestions)
    )
    return AgentResponse(answer=answer, intent="unknown")
