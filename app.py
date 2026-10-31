"""
app.py – EduTrack AI: AI Agent untuk Analisis Data Akademik Mahasiswa
Jalankan dengan: streamlit run app.py
"""
from __future__ import annotations

import datetime
import pandas as pd
import streamlit as st

# ── Konfigurasi halaman ───────────────────────────────────────────────────────
st.set_page_config(
    page_title="EduTrack AI – Analisis Akademik",
    page_icon="🎓",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Import modul internal ─────────────────────────────────────────────────────
from utils.data_generator import load_or_generate
from utils.data_analyzer import (
    get_summary_stats,
    get_top_students,
    get_bottom_students,
    get_course_stats,
    get_prodi_stats,
    get_semester_trend,
    analyze_attendance_vs_grade,
    get_grade_distribution,
    get_at_risk_students,
    generate_insights,
    get_data_quality_report,
    clean_data,
)
from utils.visualizations import (
    plot_nilai_distribution,
    plot_grade_pie,
    plot_semester_trend,
    plot_course_passing_rate,
    plot_course_comparison,
    plot_attendance_vs_grade,
    plot_prodi_radar,
    plot_prodi_grouped_bar,
    plot_ipk_boxplot,
    plot_heatmap_nilai,
    plot_risk_scatter,
)
from utils.ai_agent import ask_agent
from utils.report_exporter import export_csv, export_excel, export_html_report

# ── CSS kustom ────────────────────────────────────────────────────────────────
st.markdown("""
<style>
  /* ── Global ── */
  [data-testid="stAppViewContainer"] { background: #f7f8fa; }
  [data-testid="stSidebar"] { background: #1e293b; }
  [data-testid="stSidebar"] * { color: #e2e8f0 !important; }
  [data-testid="stSidebar"] .stRadio label { color: #e2e8f0 !important; }

  /* ── KPI cards ── */
  .kpi-card {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 20px 16px;
    text-align: center;
    box-shadow: 0 1px 4px rgba(0,0,0,.06);
  }
  .kpi-val { font-size: 2rem; font-weight: 700; color: #3b82f6; line-height: 1.1; }
  .kpi-lbl { font-size: 0.8rem; color: #57606a; margin-top: 4px; }
  .kpi-icon { font-size: 1.5rem; }

  /* ── Chat bubbles ── */
  .chat-user {
    background: #dbeafe; border-radius: 16px 16px 4px 16px;
    padding: 12px 16px; margin: 8px 0; max-width: 80%;
    margin-left: auto; font-size: 0.92rem;
  }
  .chat-agent {
    background: #ffffff; border: 1px solid #e5e7eb;
    border-radius: 16px 16px 16px 4px;
    padding: 14px 18px; margin: 8px 0; max-width: 85%;
    box-shadow: 0 1px 3px rgba(0,0,0,.07); font-size: 0.92rem;
  }
  .chat-label-user { text-align: right; font-size: 0.72rem; color: #64748b; margin-bottom: 2px; }
  .chat-label-agent { font-size: 0.72rem; color: #64748b; margin-bottom: 2px; }

  /* ── Section header ── */
  .section-title {
    font-size: 1.25rem; font-weight: 700; color: #1e293b;
    border-left: 4px solid #3b82f6; padding-left: 10px;
    margin: 20px 0 12px 0;
  }
  /* ── Insight boxes ── */
  .insight-item {
    background: #fff; border: 1px solid #e5e7eb; border-radius: 8px;
    padding: 14px 16px; margin-bottom: 10px;
    font-size: 0.9rem; line-height: 1.6;
  }
  /* ── Hide streamlit branding ── */
  #MainMenu, footer { visibility: hidden; }
</style>
""", unsafe_allow_html=True)


# ── State management ──────────────────────────────────────────────────────────
if "df" not in st.session_state:
    st.session_state.df = None
if "chat_history" not in st.session_state:
    st.session_state.chat_history = []
if "data_source" not in st.session_state:
    st.session_state.data_source = "dummy"


# ── Fungsi pembantu UI ────────────────────────────────────────────────────────

def kpi_card(icon: str, value: str, label: str) -> str:
    return f"""
    <div class="kpi-card">
      <div class="kpi-icon">{icon}</div>
      <div class="kpi-val">{value}</div>
      <div class="kpi-lbl">{label}</div>
    </div>"""


def section_title(text: str) -> None:
    st.markdown(f'<div class="section-title">{text}</div>', unsafe_allow_html=True)


def chat_bubble_user(msg: str) -> None:
    st.markdown(
        f'<div class="chat-label-user">Anda</div>'
        f'<div class="chat-user">{msg}</div>',
        unsafe_allow_html=True,
    )


def chat_bubble_agent(msg: str) -> None:
    st.markdown(
        '<div class="chat-label-agent">🤖 EduTrack AI</div>'
        f'<div class="chat-agent">{msg}</div>',
        unsafe_allow_html=True,
    )


# ── Sidebar ───────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("## 🎓 EduTrack AI")
    st.markdown("**Analisis Data Akademik Mahasiswa**")
    st.divider()

    # Navigasi
    menu = st.radio(
        "Navigasi",
        ["🏠 Dashboard", "🤖 AI Agent", "📊 Visualisasi", "💡 AI Insights",
         "👨‍🎓 Data Mahasiswa", "📁 Ekspor Laporan"],
        key="menu",
    )

    st.divider()
    st.markdown("### 📂 Sumber Data")

    data_opt = st.radio(
        "Pilih sumber data:",
        ["Dataset Demo (Otomatis)", "Upload CSV/Excel"],
        key="data_option",
    )

    if data_opt == "Dataset Demo (Otomatis)":
        if st.button("🔄 Muat Dataset Demo", use_container_width=True):
            with st.spinner("Memuat dataset..."):
                st.session_state.df = load_or_generate("data/academic_data.csv")
                st.session_state.data_source = "dummy"
            st.success(f"✅ Dataset dimuat: {len(st.session_state.df):,} baris")
        # Auto-load on first run
        if st.session_state.df is None:
            with st.spinner("Memuat dataset demo..."):
                st.session_state.df = load_or_generate("data/academic_data.csv")
                st.session_state.data_source = "dummy"
    else:
        uploaded = st.file_uploader(
            "Upload file CSV atau Excel",
            type=["csv", "xlsx", "xls"],
            help="Pastikan file memiliki kolom: NIM, Nama, Nilai, IPK, Kehadiran (%)",
        )
        if uploaded:
            try:
                if uploaded.name.endswith(".csv"):
                    df_up = pd.read_csv(uploaded, encoding="utf-8-sig")
                else:
                    df_up = pd.read_excel(uploaded)
                st.session_state.df = df_up
                st.session_state.data_source = "upload"
                st.success(f"✅ File berhasil dimuat: {len(df_up):,} baris")
            except Exception as e:
                st.error(f"❌ Gagal membaca file: {e}")

    if st.session_state.df is not None:
        df_cur = st.session_state.df
        st.divider()
        st.markdown("### 🔎 Filter Data")

        sel_prodi: list = []
        sel_angk:  list = []
        sel_sem         = None

        # Filter Prodi
        if "Program Studi" in df_cur.columns:
            prodi_opts = ["Semua"] + sorted(df_cur["Program Studi"].dropna().unique().tolist())
            sel_prodi = st.multiselect("Program Studi", prodi_opts[1:], default=[])

        # Filter Semester
        if "Semester" in df_cur.columns:
            sem_min = int(df_cur["Semester"].dropna().min())
            sem_max = int(df_cur["Semester"].dropna().max())
            if sem_min < sem_max:
                sel_sem = st.slider("Rentang Semester", sem_min, sem_max, (sem_min, sem_max))
            else:
                sel_sem = (sem_min, sem_max)

        # Filter Angkatan
        if "Angkatan" in df_cur.columns:
            angk_opts = sorted(df_cur["Angkatan"].dropna().unique().astype(int).tolist())
            sel_angk  = st.multiselect("Angkatan", angk_opts, default=[])

        # Terapkan filter
        df_filtered = df_cur.copy()
        if sel_prodi:
            df_filtered = df_filtered[df_filtered["Program Studi"].isin(sel_prodi)]
        if sel_sem is not None and "Semester" in df_filtered.columns:
            df_filtered = df_filtered[
                df_filtered["Semester"].between(sel_sem[0], sel_sem[1])
            ]
        if sel_angk:
            df_filtered = df_filtered[df_filtered["Angkatan"].isin(sel_angk)]

        st.caption(f"Menampilkan **{len(df_filtered):,}** dari {len(df_cur):,} baris data")
        st.session_state.df_filtered = df_filtered
    else:
        st.session_state.df_filtered = None

    st.divider()
    st.caption("EduTrack AI v1.0 · Tanpa API Berbayar")


# ── Ambil dataframe yang digunakan ────────────────────────────────────────────
df: pd.DataFrame | None = st.session_state.get("df_filtered") or st.session_state.df


# ══════════════════════════════════════════════════════════════════════════════
# PAGE: Dashboard
# ══════════════════════════════════════════════════════════════════════════════

if menu == "🏠 Dashboard":
    st.markdown("# 🎓 EduTrack AI – Dashboard Akademik")
    st.markdown(
        "Selamat datang! Aplikasi ini membantu Anda menganalisis data akademik mahasiswa "
        "secara interaktif menggunakan AI Agent berbasis data aktual.",
    )

    if df is None or df.empty:
        st.info("👈 Muat dataset terlebih dahulu melalui sidebar kiri.")
        st.stop()

    stats = get_summary_stats(df)

    # ── KPI Row ──────────────────────────────────────────────────────────────
    c1, c2, c3, c4, c5, c6 = st.columns(6)
    kpis = [
        (c1, "👥", f"{stats['total_mahasiswa']:,}", "Total Mahasiswa"),
        (c2, "📝", str(stats['rata_nilai']), "Rata-rata Nilai"),
        (c3, "🎓", str(stats['rata_ipk']), "Rata-rata IPK"),
        (c4, "📅", f"{stats['rata_kehadiran']}%", "Rata-rata Kehadiran"),
        (c5, "🏫", str(stats['total_prodi']), "Program Studi"),
        (c6, "📚", str(stats['total_mk']), "Mata Kuliah"),
    ]
    for col, icon, val, lbl in kpis:
        with col:
            st.markdown(kpi_card(icon, val, lbl), unsafe_allow_html=True)

    st.divider()

    # ── Row 1: Distribusi nilai + Grade pie ──────────────────────────────────
    section_title("📊 Distribusi Nilai")
    col_l, col_r = st.columns([3, 2])
    with col_l:
        st.plotly_chart(plot_nilai_distribution(df), use_container_width=True)
    with col_r:
        st.plotly_chart(plot_grade_pie(df), use_container_width=True)

    # ── Row 2: Tren semester ─────────────────────────────────────────────────
    section_title("📈 Perkembangan Prestasi Per Semester")
    st.plotly_chart(plot_semester_trend(df), use_container_width=True)

    # ── Row 3: Prodi comparison ──────────────────────────────────────────────
    section_title("🏫 Perbandingan Program Studi")
    col_l2, col_r2 = st.columns(2)
    with col_l2:
        st.plotly_chart(plot_prodi_grouped_bar(df), use_container_width=True)
    with col_r2:
        st.plotly_chart(plot_ipk_boxplot(df), use_container_width=True)

    # ── Row 4: Kualitas data ringkasan ───────────────────────────────────────
    section_title("🔍 Kualitas Data")
    quality = get_data_quality_report(df)
    qc1, qc2, qc3, qc4 = st.columns(4)
    qc1.metric("Total Baris", f"{quality['total_baris']:,}")
    qc2.metric("Total Kolom", quality["total_kolom"])
    qc3.metric("Nilai Kosong", sum(quality["missing_values"].values()) if quality["missing_values"] else 0)
    qc4.metric("Duplikat", quality["duplikat"])


# ══════════════════════════════════════════════════════════════════════════════
# PAGE: AI Agent
# ══════════════════════════════════════════════════════════════════════════════

elif menu == "🤖 AI Agent":
    st.markdown("# 🤖 AI Agent – Tanya Jawab Berbasis Data")
    st.markdown(
        "Ajukan pertanyaan dalam **bahasa Indonesia**. "
        "AI Agent akan menjawab berdasarkan data aktual — **tidak mengarang informasi**."
    )

    if df is None or df.empty:
        st.info("👈 Muat dataset terlebih dahulu melalui sidebar kiri.")
        st.stop()

    # Contoh pertanyaan
    with st.expander("💡 Contoh Pertanyaan", expanded=False):
        examples = [
            "Siapa mahasiswa dengan nilai tertinggi?",
            "Siapa 5 mahasiswa dengan IPK tertinggi?",
            "Mata kuliah apa yang memiliki tingkat kelulusan terendah?",
            "Apakah kehadiran memengaruhi nilai mahasiswa?",
            "Tampilkan ringkasan statistik akademik",
            "Bagaimana tren nilai per semester?",
            "Tampilkan distribusi grade mahasiswa",
            "Siapa mahasiswa yang perlu pendampingan?",
            "Bagaimana perbandingan antar program studi?",
            "Berikan insight dan temuan akademik",
            "Bagaimana kualitas data saat ini?",
        ]
        for ex in examples:
            if st.button(ex, key=f"ex_{ex[:20]}"):
                st.session_state.pending_query = ex

    # Form input
    with st.form("chat_form", clear_on_submit=True):
        user_input = st.text_input(
            "Pertanyaan Anda:",
            placeholder="Contoh: Siapa mahasiswa dengan nilai tertinggi?",
            key="chat_input",
        )
        submitted = st.form_submit_button("Kirim ➤", use_container_width=False)

    # Ambil pertanyaan dari tombol contoh jika ada
    if "pending_query" in st.session_state:
        user_input = st.session_state.pop("pending_query")
        submitted  = True

    if submitted and user_input.strip():
        with st.spinner("🤔 AI Agent sedang menganalisis..."):
            response = ask_agent(user_input.strip(), df)
        st.session_state.chat_history.append({
            "role": "user", "content": user_input.strip(),
        })
        st.session_state.chat_history.append({
            "role": "agent", "content": response.answer,
            "data": response.data, "intent": response.intent,
        })

    # Tampilkan riwayat chat
    if st.session_state.chat_history:
        st.divider()
        section_title("💬 Riwayat Percakapan")
        for msg in reversed(st.session_state.chat_history):
            if msg["role"] == "user":
                chat_bubble_user(msg["content"])
            else:
                chat_bubble_agent(msg["content"].replace("\n", "<br>"))
                # Tampilkan tabel data jika tersedia
                if msg.get("data") is not None and isinstance(msg["data"], pd.DataFrame) and not msg["data"].empty:
                    with st.expander("📋 Lihat Data Pendukung"):
                        st.dataframe(msg["data"], use_container_width=True, height=250)

        if st.button("🗑️ Hapus Riwayat Chat"):
            st.session_state.chat_history = []
            st.rerun()
    else:
        st.info("Belum ada percakapan. Ajukan pertanyaan di atas untuk memulai.")


# ══════════════════════════════════════════════════════════════════════════════
# PAGE: Visualisasi
# ══════════════════════════════════════════════════════════════════════════════

elif menu == "📊 Visualisasi":
    st.markdown("# 📊 Visualisasi Data Akademik")

    if df is None or df.empty:
        st.info("👈 Muat dataset terlebih dahulu melalui sidebar kiri.")
        st.stop()

    viz_tabs = st.tabs([
        "Distribusi Nilai", "Tren Semester", "Mata Kuliah",
        "Program Studi", "Kehadiran vs Nilai", "Peta Risiko", "Heatmap",
    ])

    with viz_tabs[0]:
        section_title("📊 Distribusi Nilai & Grade")
        c1, c2 = st.columns([3, 2])
        with c1:
            st.plotly_chart(plot_nilai_distribution(df), use_container_width=True)
        with c2:
            st.plotly_chart(plot_grade_pie(df), use_container_width=True)
        with st.expander("📋 Tabel Distribusi Grade"):
            st.dataframe(get_grade_distribution(df), use_container_width=True)

    with viz_tabs[1]:
        section_title("📈 Tren Nilai & IPK Per Semester")
        st.plotly_chart(plot_semester_trend(df), use_container_width=True)
        with st.expander("📋 Data Tren"):
            st.dataframe(get_semester_trend(df), use_container_width=True)

    with viz_tabs[2]:
        section_title("📚 Analisis Mata Kuliah")
        st.plotly_chart(plot_course_passing_rate(df), use_container_width=True)
        st.plotly_chart(plot_course_comparison(df), use_container_width=True)
        with st.expander("📋 Statistik Lengkap Mata Kuliah"):
            st.dataframe(get_course_stats(df), use_container_width=True)

    with viz_tabs[3]:
        section_title("🏫 Perbandingan Program Studi")
        c1, c2 = st.columns(2)
        with c1:
            st.plotly_chart(plot_prodi_grouped_bar(df), use_container_width=True)
        with c2:
            st.plotly_chart(plot_prodi_radar(df), use_container_width=True)
        st.plotly_chart(plot_ipk_boxplot(df), use_container_width=True)
        with st.expander("📋 Tabel Perbandingan Prodi"):
            st.dataframe(get_prodi_stats(df), use_container_width=True)

    with viz_tabs[4]:
        section_title("🔗 Hubungan Kehadiran & Nilai")
        st.plotly_chart(plot_attendance_vs_grade(df), use_container_width=True)
        corr = analyze_attendance_vs_grade(df)
        ci1, ci2, ci3 = st.columns(3)
        ci1.metric("Korelasi Pearson (r)", corr["korelasi"])
        ci2.metric("P-Value", corr["p_value"])
        ci3.metric("Kekuatan", corr["kekuatan"].title())
        st.info(corr["interpretasi"])

    with viz_tabs[5]:
        section_title("🚨 Peta Risiko Akademik")
        st.plotly_chart(plot_risk_scatter(df), use_container_width=True)
        risk_df = get_at_risk_students(df)
        n_total   = len(risk_df)
        n_high    = len(risk_df[risk_df["Status"] == "Prioritas Tinggi"])
        col_m1, col_m2 = st.columns(2)
        col_m1.metric("Total Mahasiswa Berisiko", n_total)
        col_m2.metric("Prioritas Tinggi", n_high)
        with st.expander("📋 Daftar Mahasiswa Berisiko"):
            if not risk_df.empty:
                st.dataframe(risk_df, use_container_width=True)
            else:
                st.success("Tidak ada mahasiswa yang terdeteksi berisiko.")

    with viz_tabs[6]:
        section_title("🌡️ Heatmap Nilai: Prodi × Mata Kuliah")
        st.plotly_chart(plot_heatmap_nilai(df), use_container_width=True)


# ══════════════════════════════════════════════════════════════════════════════
# PAGE: AI Insights
# ══════════════════════════════════════════════════════════════════════════════

elif menu == "💡 AI Insights":
    st.markdown("# 💡 AI Insights – Temuan Pola Akademik")
    st.markdown(
        "Sistem secara otomatis mendeteksi pola dan anomali dalam data akademik "
        "berdasarkan perhitungan statistik."
    )

    if df is None or df.empty:
        st.info("👈 Muat dataset terlebih dahulu melalui sidebar kiri.")
        st.stop()

    with st.spinner("🧠 AI sedang menganalisis pola data..."):
        insights = generate_insights(df)

    section_title("🔍 Temuan Otomatis")
    for ins in insights:
        st.markdown(f'<div class="insight-item">{ins}</div>', unsafe_allow_html=True)

    st.divider()
    section_title("🚨 Rekomendasi Pendampingan Mahasiswa")

    col_thresh1, col_thresh2 = st.columns(2)
    with col_thresh1:
        nilai_thresh = st.slider("Ambang Batas Nilai", 30, 70, 55, key="ins_nilai")
    with col_thresh2:
        hadir_thresh = st.slider("Ambang Batas Kehadiran (%)", 40, 90, 70, key="ins_hadir")

    risk_df = get_at_risk_students(df, nilai_thresh, hadir_thresh)

    if risk_df.empty:
        st.success(
            f"✅ Tidak ada mahasiswa dengan rata-rata nilai <{nilai_thresh} "
            f"atau kehadiran <{hadir_thresh}% berdasarkan filter saat ini."
        )
    else:
        n_high = len(risk_df[risk_df["Status"] == "Prioritas Tinggi"])
        st.warning(
            f"⚠️ Ditemukan **{len(risk_df)}** mahasiswa yang memerlukan perhatian "
            f"({n_high} prioritas tinggi)."
        )
        tab_all, tab_high = st.tabs(["Semua", "Prioritas Tinggi Saja"])
        with tab_all:
            st.dataframe(risk_df, use_container_width=True)
        with tab_high:
            df_high = risk_df[risk_df["Status"] == "Prioritas Tinggi"]
            if df_high.empty:
                st.info("Tidak ada mahasiswa prioritas tinggi.")
            else:
                st.dataframe(df_high, use_container_width=True)

    st.divider()
    section_title("🔍 Kualitas Data")
    quality = get_data_quality_report(df)
    qcol1, qcol2, qcol3, qcol4 = st.columns(4)
    qcol1.metric("Total Baris", f"{quality['total_baris']:,}")
    qcol2.metric("Total Kolom", quality["total_kolom"])
    missing_total = sum(quality["missing_values"].values()) if quality["missing_values"] else 0
    qcol3.metric("Nilai Kosong", missing_total)
    qcol4.metric("Baris Duplikat", quality["duplikat"])

    if quality["missing_values"]:
        with st.expander("Detail Nilai Kosong"):
            miss_df = pd.DataFrame([
                {"Kolom": k, "Jumlah Kosong": v, "Persentase (%)": pct}
                for (k, v), pct in zip(
                    quality["missing_values"].items(),
                    quality["missing_pct"].values()
                )
            ])
            st.dataframe(miss_df, use_container_width=True)


# ══════════════════════════════════════════════════════════════════════════════
# PAGE: Data Mahasiswa
# ══════════════════════════════════════════════════════════════════════════════

elif menu == "👨‍🎓 Data Mahasiswa":
    st.markdown("# 👨‍🎓 Data & Pencarian Mahasiswa")

    if df is None or df.empty:
        st.info("👈 Muat dataset terlebih dahulu melalui sidebar kiri.")
        st.stop()

    search_tabs = st.tabs(["🔎 Cari Mahasiswa", "🏆 Top Mahasiswa", "📋 Semua Data"])

    with search_tabs[0]:
        section_title("🔎 Cari Mahasiswa")
        col_s1, col_s2 = st.columns([2, 1])
        with col_s1:
            keyword = st.text_input("Masukkan Nama atau NIM:", placeholder="cth: Budi Pratama atau 200104")
        with col_s2:
            search_btn = st.button("Cari", use_container_width=True, type="primary")

        if search_btn and keyword.strip():
            df_clean = clean_data(df)
            mask = (
                df_clean["NIM"].astype(str).str.contains(keyword.strip(), case=False, na=False)
                | df_clean["Nama"].astype(str).str.contains(keyword.strip(), case=False, na=False)
            )
            result = df_clean[mask]
            if result.empty:
                st.warning(f"Tidak ditemukan data untuk kata kunci: **{keyword}**")
            else:
                n_mhs = result["NIM"].nunique()
                st.success(f"Ditemukan **{n_mhs}** mahasiswa ({len(result)} entri data)")
                # Ringkasan per mahasiswa
                summary_mhs = result.groupby(["NIM", "Nama", "Program Studi", "Angkatan"]).agg(
                    Semester=("Semester", "max"),
                    IPK=("IPK", "mean"),
                    Rata_Nilai=("Nilai", "mean"),
                    Kehadiran=("Kehadiran (%)", "mean"),
                    Jumlah_MK=("Mata Kuliah", "nunique"),
                ).reset_index().round({"IPK": 2, "Rata_Nilai": 2, "Kehadiran": 1})
                st.dataframe(summary_mhs, use_container_width=True)

                with st.expander("Detail Semua Mata Kuliah"):
                    st.dataframe(result, use_container_width=True, height=300)

    with search_tabs[1]:
        section_title("🏆 Peringkat Mahasiswa")
        sort_by = st.radio("Urutkan berdasarkan:", ["IPK", "Nilai"], horizontal=True, key="sort_rank")
        n_show  = st.slider("Tampilkan berapa mahasiswa:", 5, 50, 10, key="n_rank")

        top_df = get_top_students(df, n=n_show, by=sort_by)
        if not top_df.empty:
            # Tambah nomor peringkat
            top_df.insert(0, "Peringkat", range(1, len(top_df) + 1))
            st.dataframe(top_df, use_container_width=True, height=400)
        else:
            st.info("Data tidak tersedia.")

        st.divider()
        section_title("⚠️ Mahasiswa Butuh Perhatian (IPK Terendah)")
        bot_df = get_bottom_students(df, n=n_show)
        if not bot_df.empty:
            bot_df.insert(0, "Peringkat", range(1, len(bot_df) + 1))
            st.dataframe(bot_df, use_container_width=True, height=300)

    with search_tabs[2]:
        section_title("📋 Dataset Lengkap")
        df_clean_show = clean_data(df)

        # Filter tambahan di halaman ini
        sel_mk = "Semua"
        sel_gr = "Semua"
        col_f1, col_f2 = st.columns(2)
        with col_f1:
            if "Mata Kuliah" in df_clean_show.columns:
                mk_opts = ["Semua"] + sorted(df_clean_show["Mata Kuliah"].dropna().unique().tolist())
                sel_mk  = st.selectbox("Mata Kuliah", mk_opts, key="data_mk")
        with col_f2:
            if "Grade" in df_clean_show.columns:
                gr_opts = ["Semua"] + sorted(df_clean_show["Grade"].dropna().unique().tolist())
                sel_gr  = st.selectbox("Grade", gr_opts, key="data_grade")

        df_show = df_clean_show.copy()
        if sel_mk != "Semua":
            df_show = df_show[df_show["Mata Kuliah"] == sel_mk]
        if sel_gr != "Semua":
            df_show = df_show[df_show["Grade"] == sel_gr]

        st.caption(f"Menampilkan {len(df_show):,} baris")
        st.dataframe(df_show, use_container_width=True, height=450)


# ══════════════════════════════════════════════════════════════════════════════
# PAGE: Ekspor Laporan
# ══════════════════════════════════════════════════════════════════════════════

elif menu == "📁 Ekspor Laporan":
    st.markdown("# 📁 Ekspor Laporan Analisis")
    st.markdown(
        "Unduh hasil analisis dalam berbagai format untuk keperluan pelaporan dan dokumentasi."
    )

    if df is None or df.empty:
        st.info("👈 Muat dataset terlebih dahulu melalui sidebar kiri.")
        st.stop()

    ts_file = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")

    st.divider()
    section_title("📊 Ringkasan Data yang Akan Diekspor")
    stats = get_summary_stats(df)
    ec1, ec2, ec3 = st.columns(3)
    ec1.metric("Total Mahasiswa", f"{stats['total_mahasiswa']:,}")
    ec2.metric("Total Entri", f"{stats['total_data_entries']:,}")
    ec3.metric("Rata-rata IPK", stats["rata_ipk"])

    st.divider()
    section_title("📥 Pilihan Format Ekspor")

    exp_c1, exp_c2, exp_c3 = st.columns(3)

    with exp_c1:
        st.markdown("#### 📄 CSV")
        st.markdown("Dataset bersih, siap diimpor ke Excel / software lain.")
        csv_data = export_csv(df)
        st.download_button(
            label="⬇️ Unduh CSV",
            data=csv_data,
            file_name=f"edutrack_data_{ts_file}.csv",
            mime="text/csv",
            use_container_width=True,
        )

    with exp_c2:
        st.markdown("#### 📊 Excel (Multi-Sheet)")
        st.markdown("Laporan lengkap dalam 7 sheet terpisah.")
        with st.spinner("Menyiapkan Excel..."):
            excel_data = export_excel(df)
        st.download_button(
            label="⬇️ Unduh Excel",
            data=excel_data,
            file_name=f"edutrack_laporan_{ts_file}.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            use_container_width=True,
        )

    with exp_c3:
        st.markdown("#### 🌐 Laporan HTML")
        st.markdown("Laporan lengkap siap kirim / cetak via browser.")
        html_data = export_html_report(df)
        st.download_button(
            label="⬇️ Unduh Laporan HTML",
            data=html_data.encode("utf-8"),
            file_name=f"edutrack_laporan_{ts_file}.html",
            mime="text/html",
            use_container_width=True,
        )

    st.divider()
    section_title("🔍 Preview Isi Laporan")
    with st.expander("Preview Ringkasan Statistik"):
        stats_df = pd.DataFrame([
            {"Metrik": k.replace("_", " ").title(), "Nilai": v}
            for k, v in stats.items()
        ])
        st.dataframe(stats_df, use_container_width=True)
    with st.expander("Preview Top 10 Mahasiswa"):
        st.dataframe(get_top_students(df, n=10), use_container_width=True)
    with st.expander("Preview Statistik Mata Kuliah"):
        st.dataframe(get_course_stats(df), use_container_width=True)
