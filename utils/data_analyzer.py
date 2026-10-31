"""
utils/data_analyzer.py
Fungsi-fungsi analisis data akademik yang dipanggil oleh AI Agent maupun dashboard.
"""
from __future__ import annotations

import pandas as pd
import numpy as np
from scipy import stats as scipy_stats


# ── Pembersihan data ─────────────────────────────────────────────────────────

def get_data_quality_report(df: pd.DataFrame) -> dict:
    """Ringkasan kualitas data: missing values & duplikat."""
    total = len(df)
    missing = df.isnull().sum()
    missing_pct = (missing / total * 100).round(2)
    n_dup = int(df.duplicated().sum())
    return {
        "total_baris": total,
        "total_kolom": len(df.columns),
        "missing_values": missing[missing > 0].to_dict(),
        "missing_pct": missing_pct[missing_pct > 0].to_dict(),
        "duplikat": n_dup,
        "duplikat_pct": round(n_dup / total * 100, 2),
    }


def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    """
    Kembalikan salinan DataFrame bersih:
    - duplikat dihapus
    - Nilai & Kehadiran yang kosong diisi median
    """
    df = df.drop_duplicates().copy()
    for col in ["Nilai", "Kehadiran (%)"]:
        if col in df.columns:
            median_val = df[col].median()
            df[col] = df[col].fillna(median_val)
    # Pastikan tipe numerik
    for col in ["Nilai", "IPK", "Kehadiran (%)", "Semester", "Angkatan"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


# ── Statistik ringkasan ──────────────────────────────────────────────────────

def get_summary_stats(df: pd.DataFrame) -> dict:
    """KPI utama dashboard."""
    df_clean = clean_data(df)
    unique_nim = df_clean["NIM"].nunique() if "NIM" in df_clean.columns else 0
    return {
        "total_mahasiswa": unique_nim,
        "total_data_entries": len(df_clean),
        "rata_nilai": round(df_clean["Nilai"].mean(), 2),
        "rata_ipk": round(df_clean["IPK"].mean(), 2),
        "rata_kehadiran": round(df_clean["Kehadiran (%)"].mean(), 2),
        "total_prodi": df_clean["Program Studi"].nunique() if "Program Studi" in df_clean.columns else 0,
        "total_mk": df_clean["Mata Kuliah"].nunique() if "Mata Kuliah" in df_clean.columns else 0,
    }


# ── Analisis mahasiswa ───────────────────────────────────────────────────────

def get_top_students(df: pd.DataFrame, n: int = 10, by: str = "IPK") -> pd.DataFrame:
    """Mahasiswa dengan IPK / Nilai tertinggi."""
    df_clean = clean_data(df)
    cols = ["NIM", "Nama", "Program Studi", "Angkatan", "Semester", "IPK", "Nilai", "Kehadiran (%)"]
    cols = [c for c in cols if c in df_clean.columns]
    per_mhs = df_clean.groupby(["NIM", "Nama", "Program Studi", "Angkatan"]).agg(
        IPK=("IPK", "mean"),
        Nilai=("Nilai", "mean"),
        Kehadiran=("Kehadiran (%)", "mean"),
        Semester=("Semester", "max"),
    ).reset_index()
    per_mhs["IPK"]       = per_mhs["IPK"].round(2)
    per_mhs["Nilai"]     = per_mhs["Nilai"].round(2)
    per_mhs["Kehadiran"] = per_mhs["Kehadiran"].round(1)
    sort_col = "IPK" if by == "IPK" else "Nilai"
    return per_mhs.nlargest(n, sort_col).reset_index(drop=True)


def get_bottom_students(df: pd.DataFrame, n: int = 10) -> pd.DataFrame:
    """Mahasiswa dengan IPK terendah (kandidat pendampingan)."""
    df_clean = clean_data(df)
    per_mhs = df_clean.groupby(["NIM", "Nama", "Program Studi", "Angkatan"]).agg(
        IPK=("IPK", "mean"),
        Nilai=("Nilai", "mean"),
        Kehadiran=("Kehadiran (%)", "mean"),
    ).reset_index()
    per_mhs = per_mhs.round({"IPK": 2, "Nilai": 2, "Kehadiran": 1})
    return per_mhs.nsmallest(n, "IPK").reset_index(drop=True)


def get_student_detail(df: pd.DataFrame, identifier: str) -> pd.DataFrame:
    """Cari mahasiswa berdasarkan NIM atau nama (case-insensitive)."""
    df_clean = clean_data(df)
    mask = (
        df_clean["NIM"].astype(str).str.contains(identifier, case=False, na=False)
        | df_clean["Nama"].astype(str).str.contains(identifier, case=False, na=False)
    )
    return df_clean[mask].copy()


# ── Analisis mata kuliah ─────────────────────────────────────────────────────

def get_course_stats(df: pd.DataFrame) -> pd.DataFrame:
    """Statistik per mata kuliah: rata-rata nilai, kelulusan, peserta."""
    df_clean = clean_data(df)
    grp = df_clean.groupby("Mata Kuliah").agg(
        Rata_Nilai=("Nilai", "mean"),
        Std_Nilai=("Nilai", "std"),
        Kehadiran_Rata=("Kehadiran (%)", "mean"),
        Jumlah_Peserta=("NIM", "count"),
    ).reset_index()

    # Tingkat kelulusan (nilai ≥ 45 = lulus)
    lulus = df_clean[df_clean["Nilai"] >= 45].groupby("Mata Kuliah")["NIM"].count().rename("Lulus")
    grp = grp.merge(lulus, on="Mata Kuliah", how="left")
    grp["Lulus"] = grp["Lulus"].fillna(0)
    grp["Tingkat_Kelulusan (%)"] = (grp["Lulus"] / grp["Jumlah_Peserta"] * 100).round(1)
    grp["Rata_Nilai"] = grp["Rata_Nilai"].round(2)
    grp["Std_Nilai"]  = grp["Std_Nilai"].round(2)
    grp["Kehadiran_Rata"] = grp["Kehadiran_Rata"].round(1)
    return grp.sort_values("Rata_Nilai", ascending=False).reset_index(drop=True)


def get_lowest_passing_course(df: pd.DataFrame) -> dict:
    """Mata kuliah dengan tingkat kelulusan terendah."""
    stats = get_course_stats(df)
    row = stats.nsmallest(1, "Tingkat_Kelulusan (%)").iloc[0]
    return {
        "mata_kuliah": row["Mata Kuliah"],
        "tingkat_kelulusan": row["Tingkat_Kelulusan (%)"],
        "rata_nilai": row["Rata_Nilai"],
        "jumlah_peserta": int(row["Jumlah_Peserta"]),
    }


def get_highest_passing_course(df: pd.DataFrame) -> dict:
    """Mata kuliah dengan tingkat kelulusan tertinggi."""
    stats = get_course_stats(df)
    row = stats.nlargest(1, "Tingkat_Kelulusan (%)").iloc[0]
    return {
        "mata_kuliah": row["Mata Kuliah"],
        "tingkat_kelulusan": row["Tingkat_Kelulusan (%)"],
        "rata_nilai": row["Rata_Nilai"],
        "jumlah_peserta": int(row["Jumlah_Peserta"]),
    }


# ── Analisis per program studi ────────────────────────────────────────────────

def get_prodi_stats(df: pd.DataFrame) -> pd.DataFrame:
    """Statistik per program studi."""
    df_clean = clean_data(df)
    grp = df_clean.groupby("Program Studi").agg(
        Jumlah_Mahasiswa=("NIM", "nunique"),
        Rata_Nilai=("Nilai", "mean"),
        Rata_IPK=("IPK", "mean"),
        Rata_Kehadiran=("Kehadiran (%)", "mean"),
    ).reset_index()
    return grp.round({"Rata_Nilai": 2, "Rata_IPK": 2, "Rata_Kehadiran": 1})


# ── Analisis semester ─────────────────────────────────────────────────────────

def get_semester_trend(df: pd.DataFrame) -> pd.DataFrame:
    """Tren rata-rata nilai & IPK per semester."""
    df_clean = clean_data(df)
    grp = df_clean.groupby("Semester").agg(
        Rata_Nilai=("Nilai", "mean"),
        Rata_IPK=("IPK", "mean"),
        Rata_Kehadiran=("Kehadiran (%)", "mean"),
        Jumlah_Entri=("NIM", "count"),
    ).reset_index().sort_values("Semester")
    return grp.round({"Rata_Nilai": 2, "Rata_IPK": 2, "Rata_Kehadiran": 1})


# ── Korelasi kehadiran – nilai ────────────────────────────────────────────────

def analyze_attendance_vs_grade(df: pd.DataFrame) -> dict:
    """Pearson correlation + interpretasi hubungan kehadiran-nilai."""
    df_clean = clean_data(df).dropna(subset=["Nilai", "Kehadiran (%)"])
    r, p = scipy_stats.pearsonr(df_clean["Kehadiran (%)"], df_clean["Nilai"])
    r = round(r, 3)
    p = round(p, 5)

    if abs(r) >= 0.7:
        kekuatan = "kuat"
    elif abs(r) >= 0.4:
        kekuatan = "sedang"
    elif abs(r) >= 0.2:
        kekuatan = "lemah"
    else:
        kekuatan = "sangat lemah / tidak ada"

    arah = "positif" if r > 0 else "negatif"
    signifikan = p < 0.05

    interpretasi = (
        f"Terdapat korelasi {arah} {kekuatan} antara kehadiran dan nilai "
        f"(r = {r}, p = {p}). "
    )
    if signifikan:
        interpretasi += "Korelasi ini signifikan secara statistik (p < 0.05). "
        if r > 0:
            interpretasi += "Artinya, mahasiswa yang lebih sering hadir cenderung mendapat nilai lebih tinggi."
        else:
            interpretasi += "Artinya, terdapat faktor lain yang lebih dominan memengaruhi nilai."
    else:
        interpretasi += "Namun korelasi ini tidak signifikan secara statistik (p ≥ 0.05)."

    return {
        "korelasi": r,
        "p_value": p,
        "kekuatan": kekuatan,
        "arah": arah,
        "signifikan": signifikan,
        "interpretasi": interpretasi,
        "n_sampel": len(df_clean),
    }


# ── Distribusi nilai ─────────────────────────────────────────────────────────

def get_grade_distribution(df: pd.DataFrame) -> pd.DataFrame:
    """Distribusi huruf mutu."""
    df_clean = clean_data(df)
    order = ["A", "B+", "B", "C+", "C", "D", "E"]
    if "Grade" not in df_clean.columns:
        # Generate dari Nilai
        def _g(v: float) -> str:
            if v >= 85: return "A"
            if v >= 75: return "B+"
            if v >= 65: return "B"
            if v >= 55: return "C+"
            if v >= 45: return "C"
            if v >= 35: return "D"
            return "E"
        df_clean["Grade"] = df_clean["Nilai"].apply(_g)
    dist = df_clean["Grade"].value_counts().reindex(order, fill_value=0).reset_index()
    dist.columns = ["Grade", "Jumlah"]
    dist["Persentase (%)"] = (dist["Jumlah"] / dist["Jumlah"].sum() * 100).round(1)
    return dist


# ── AI Insights ──────────────────────────────────────────────────────────────

def generate_insights(df: pd.DataFrame) -> list[str]:
    """
    Temukan pola akademik otomatis dan kembalikan list string insight.
    Semua pernyataan berbasis data aktual.
    """
    df_clean = clean_data(df)
    insights: list[str] = []

    # 1. Rata-rata umum
    avg_nilai    = df_clean["Nilai"].mean()
    avg_kehadiran = df_clean["Kehadiran (%)"].mean()
    insights.append(
        f"📊 Rata-rata nilai keseluruhan adalah **{avg_nilai:.1f}** dan rata-rata kehadiran **{avg_kehadiran:.1f}%**."
    )

    # 2. Prodi terbaik & terburuk
    prodi_stats = get_prodi_stats(df_clean)
    best_prodi  = prodi_stats.loc[prodi_stats["Rata_IPK"].idxmax()]
    worst_prodi = prodi_stats.loc[prodi_stats["Rata_IPK"].idxmin()]
    insights.append(
        f"🏆 Program studi dengan rata-rata IPK tertinggi: **{best_prodi['Program Studi']}** "
        f"(IPK = {best_prodi['Rata_IPK']:.2f})."
    )
    insights.append(
        f"⚠️ Program studi dengan rata-rata IPK terendah: **{worst_prodi['Program Studi']}** "
        f"(IPK = {worst_prodi['Rata_IPK']:.2f}) — mungkin perlu perhatian lebih."
    )

    # 3. Mata kuliah tersulit & termudah
    mk_stats  = get_course_stats(df_clean)
    mk_hard   = mk_stats.nsmallest(1, "Rata_Nilai").iloc[0]
    mk_easy   = mk_stats.nlargest(1, "Rata_Nilai").iloc[0]
    insights.append(
        f"📚 Mata kuliah dengan rata-rata nilai terendah: **{mk_hard['Mata Kuliah']}** "
        f"({mk_hard['Rata_Nilai']:.1f}), tingkat kelulusan {mk_hard['Tingkat_Kelulusan (%)']:.1f}%."
    )
    insights.append(
        f"✅ Mata kuliah dengan rata-rata nilai tertinggi: **{mk_easy['Mata Kuliah']}** "
        f"({mk_easy['Rata_Nilai']:.1f}), tingkat kelulusan {mk_easy['Tingkat_Kelulusan (%)']:.1f}%."
    )

    # 4. Korelasi kehadiran – nilai
    corr = analyze_attendance_vs_grade(df_clean)
    insights.append(f"🔗 {corr['interpretasi']}")

    # 5. Mahasiswa berisiko (Nilai < 50 DAN Kehadiran < 60%)
    at_risk = df_clean[(df_clean["Nilai"] < 50) & (df_clean["Kehadiran (%)"] < 60)]
    n_risk  = at_risk["NIM"].nunique()
    if n_risk > 0:
        insights.append(
            f"🚨 Terdapat **{n_risk} mahasiswa** dengan nilai <50 sekaligus kehadiran <60% — "
            f"kandidat pendampingan akademik prioritas."
        )
    else:
        insights.append("✅ Tidak ditemukan mahasiswa dengan nilai rendah sekaligus kehadiran sangat rendah.")

    # 6. Tren semester
    sem_trend = get_semester_trend(df_clean)
    if len(sem_trend) >= 2:
        first_val = sem_trend.iloc[0]["Rata_Nilai"]
        last_val  = sem_trend.iloc[-1]["Rata_Nilai"]
        diff      = last_val - first_val
        arah      = "meningkat" if diff > 0 else "menurun"
        insights.append(
            f"📈 Tren rata-rata nilai dari semester pertama ke semester terakhir **{arah}** "
            f"(Δ{abs(diff):.1f} poin)."
        )

    # 7. Kualitas data
    quality = get_data_quality_report(df)
    if quality["missing_values"]:
        cols_miss = ", ".join(quality["missing_values"].keys())
        insights.append(
            f"🔍 Data memiliki **{sum(quality['missing_values'].values())} nilai kosong** "
            f"pada kolom: {cols_miss}. Sudah diimputasi dengan median."
        )
    if quality["duplikat"] > 0:
        insights.append(
            f"🔁 Ditemukan **{quality['duplikat']} baris duplikat** ({quality['duplikat_pct']:.1f}%) "
            f"— telah dihapus pada analisis."
        )

    return insights


def get_at_risk_students(df: pd.DataFrame, nilai_threshold: float = 55,
                          kehadiran_threshold: float = 70) -> pd.DataFrame:
    """Mahasiswa yang butuh pendampingan berdasarkan nilai & kehadiran."""
    df_clean = clean_data(df)
    per_mhs = df_clean.groupby(["NIM", "Nama", "Program Studi", "Angkatan"]).agg(
        Rata_Nilai=("Nilai", "mean"),
        Rata_Kehadiran=("Kehadiran (%)", "mean"),
        IPK=("IPK", "mean"),
    ).reset_index().round({"Rata_Nilai": 2, "Rata_Kehadiran": 1, "IPK": 2})

    mask = (per_mhs["Rata_Nilai"] < nilai_threshold) | (per_mhs["Rata_Kehadiran"] < kehadiran_threshold)
    result = per_mhs[mask].copy()
    result["Status"] = "Butuh Pendampingan"
    result.loc[(result["Rata_Nilai"] < nilai_threshold) & (result["Rata_Kehadiran"] < kehadiran_threshold),
               "Status"] = "Prioritas Tinggi"
    return result.sort_values("Rata_Nilai").reset_index(drop=True)
