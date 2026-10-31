"""
utils/visualizations.py
Semua chart Plotly untuk EduTrack AI.
Setiap fungsi menerima DataFrame dan mengembalikan plotly.graph_objects.Figure.
"""
from __future__ import annotations

import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import pandas as pd
import numpy as np
from utils.data_analyzer import (
    clean_data,
    get_grade_distribution,
    get_course_stats,
    get_semester_trend,
    get_prodi_stats,
    get_at_risk_students,
)

# ── Palet warna konsisten ────────────────────────────────────────────────────
PALETTE = px.colors.qualitative.Set2
ACCENT  = "#3b82f6"   # biru utama
WARN    = "#f59e0b"   # kuning peringatan
DANGER  = "#ef4444"   # merah bahaya
SUCCESS = "#22c55e"   # hijau baik

_LAYOUT_DEFAULTS = dict(
    font_family="'Segoe UI', system-ui, sans-serif",
    plot_bgcolor="#ffffff",
    paper_bgcolor="#ffffff",
    margin=dict(l=40, r=40, t=60, b=40),
    legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
)


def _apply_layout(fig: go.Figure, title: str = "") -> go.Figure:
    fig.update_layout(title=dict(text=title, font_size=16, x=0.01), **_LAYOUT_DEFAULTS)
    fig.update_xaxes(showgrid=True, gridcolor="#e5e7eb", zeroline=False)
    fig.update_yaxes(showgrid=True, gridcolor="#e5e7eb", zeroline=False)
    return fig


# ── 1. Distribusi nilai (histogram + KDE overlay) ────────────────────────────

def plot_nilai_distribution(df: pd.DataFrame) -> go.Figure:
    df_clean = clean_data(df).dropna(subset=["Nilai"])
    fig = px.histogram(
        df_clean, x="Nilai",
        nbins=30,
        color_discrete_sequence=[ACCENT],
        opacity=0.8,
        labels={"Nilai": "Nilai", "count": "Frekuensi"},
    )
    # Tambah KDE
    from scipy.stats import gaussian_kde
    kde = gaussian_kde(df_clean["Nilai"].dropna())
    x_range = np.linspace(0, 100, 300)
    scale = len(df_clean) * (df_clean["Nilai"].max() - df_clean["Nilai"].min()) / 30
    fig.add_trace(go.Scatter(
        x=x_range, y=kde(x_range) * scale,
        mode="lines", name="Densitas",
        line=dict(color=DANGER, width=2),
    ))
    _apply_layout(fig, "📊 Distribusi Nilai Mahasiswa")
    fig.update_layout(xaxis_title="Nilai", yaxis_title="Frekuensi", bargap=0.05)
    return fig


# ── 2. Distribusi grade (pie chart) ──────────────────────────────────────────

def plot_grade_pie(df: pd.DataFrame) -> go.Figure:
    dist = get_grade_distribution(df)
    color_map = {
        "A": SUCCESS, "B+": "#4ade80", "B": ACCENT,
        "C+": "#60a5fa", "C": WARN, "D": "#fb923c", "E": DANGER,
    }
    colors = [color_map.get(g, "#9ca3af") for g in dist["Grade"]]
    fig = go.Figure(go.Pie(
        labels=dist["Grade"],
        values=dist["Jumlah"],
        hole=0.45,
        marker_colors=colors,
        textinfo="label+percent",
        hovertemplate="<b>%{label}</b><br>Jumlah: %{value}<br>Persentase: %{percent}<extra></extra>",
    ))
    _apply_layout(fig, "🎓 Distribusi Huruf Mutu")
    fig.update_layout(showlegend=True)
    return fig


# ── 3. Tren nilai & IPK per semester ─────────────────────────────────────────

def plot_semester_trend(df: pd.DataFrame) -> go.Figure:
    trend = get_semester_trend(df)
    fig = make_subplots(specs=[[{"secondary_y": True}]])
    fig.add_trace(go.Bar(
        x=trend["Semester"], y=trend["Rata_Nilai"],
        name="Rata-rata Nilai", marker_color=ACCENT, opacity=0.75,
    ), secondary_y=False)
    fig.add_trace(go.Scatter(
        x=trend["Semester"], y=trend["Rata_IPK"],
        name="Rata-rata IPK", mode="lines+markers",
        line=dict(color=DANGER, width=2.5),
        marker=dict(size=8),
    ), secondary_y=True)
    fig.update_layout(
        title=dict(text="📈 Perkembangan Prestasi Per Semester", font_size=16, x=0.01),
        xaxis_title="Semester",
        **_LAYOUT_DEFAULTS,
    )
    fig.update_yaxes(title_text="Rata-rata Nilai (0–100)", secondary_y=False,
                     showgrid=True, gridcolor="#e5e7eb")
    fig.update_yaxes(title_text="Rata-rata IPK (0–4)", secondary_y=True, showgrid=False)
    fig.update_xaxes(tickvals=sorted(trend["Semester"].unique()))
    return fig


# ── 4. Tingkat kelulusan per mata kuliah (horizontal bar) ────────────────────

def plot_course_passing_rate(df: pd.DataFrame) -> go.Figure:
    stats = get_course_stats(df).sort_values("Tingkat_Kelulusan (%)").tail(20)
    colors = [
        DANGER if v < 60 else WARN if v < 80 else SUCCESS
        for v in stats["Tingkat_Kelulusan (%)"]
    ]
    fig = go.Figure(go.Bar(
        x=stats["Tingkat_Kelulusan (%)"],
        y=stats["Mata Kuliah"],
        orientation="h",
        marker_color=colors,
        text=stats["Tingkat_Kelulusan (%)"].astype(str) + "%",
        textposition="outside",
        hovertemplate="<b>%{y}</b><br>Kelulusan: %{x}%<extra></extra>",
    ))
    _apply_layout(fig, "🎯 Tingkat Kelulusan Per Mata Kuliah")
    fig.update_layout(
        xaxis_title="Tingkat Kelulusan (%)", xaxis_range=[0, 115],
        yaxis_title="", height=max(350, len(stats) * 32),
    )
    return fig


# ── 5. Perbandingan rata-rata nilai antar mata kuliah ─────────────────────────

def plot_course_comparison(df: pd.DataFrame) -> go.Figure:
    stats = get_course_stats(df).sort_values("Rata_Nilai", ascending=False).head(20)
    fig = go.Figure(go.Bar(
        x=stats["Mata Kuliah"],
        y=stats["Rata_Nilai"],
        marker_color=px.colors.sequential.Blues[3:],
        text=stats["Rata_Nilai"].round(1),
        textposition="outside",
        error_y=dict(type="data", array=stats["Std_Nilai"], visible=True),
        hovertemplate=(
            "<b>%{x}</b><br>Rata-rata: %{y:.1f}<br>"
            "Std Dev: %{customdata:.1f}<extra></extra>"
        ),
        customdata=stats["Std_Nilai"],
    ))
    _apply_layout(fig, "📚 Perbandingan Nilai Rata-rata Antar Mata Kuliah")
    fig.update_layout(
        xaxis_title="Mata Kuliah", yaxis_title="Rata-rata Nilai",
        xaxis_tickangle=-35, yaxis_range=[0, 115],
    )
    return fig


# ── 6. Scatter: kehadiran vs nilai ───────────────────────────────────────────

def plot_attendance_vs_grade(df: pd.DataFrame) -> go.Figure:
    df_clean = clean_data(df).dropna(subset=["Nilai", "Kehadiran (%)"])
    sample   = df_clean.sample(min(1000, len(df_clean)), random_state=42)

    fig = px.scatter(
        sample,
        x="Kehadiran (%)", y="Nilai",
        color="Program Studi" if "Program Studi" in sample.columns else None,
        opacity=0.55,
        color_discrete_sequence=PALETTE,
        hover_data=["Nama", "NIM", "Mata Kuliah"] if all(
            c in sample.columns for c in ["Nama", "NIM", "Mata Kuliah"]) else None,
        labels={"Kehadiran (%)": "Kehadiran (%)", "Nilai": "Nilai"},
    )
    # Tambah garis tren
    z = np.polyfit(df_clean["Kehadiran (%)"], df_clean["Nilai"], 1)
    p = np.poly1d(z)
    x_line = np.linspace(df_clean["Kehadiran (%)"].min(), df_clean["Kehadiran (%)"].max(), 100)
    fig.add_trace(go.Scatter(
        x=x_line, y=p(x_line),
        mode="lines", name="Tren",
        line=dict(color=DANGER, width=2.5, dash="dash"),
    ))
    _apply_layout(fig, "🔗 Hubungan Kehadiran dan Nilai")
    fig.update_layout(xaxis_title="Kehadiran (%)", yaxis_title="Nilai")
    return fig


# ── 7. Perbandingan prodi (radar / grouped bar) ───────────────────────────────

def plot_prodi_radar(df: pd.DataFrame) -> go.Figure:
    prodi = get_prodi_stats(df)
    labels_id = ["Rata-rata Nilai", "Rata-rata IPK (×25)", "Rata-rata Kehadiran (%)"]

    fig = go.Figure()
    for _, row in prodi.iterrows():
        # Normalisasi agar sebanding: IPK → ×25 (skala 0–100)
        values = [
            row["Rata_Nilai"],
            row["Rata_IPK"] * 25,
            row["Rata_Kehadiran"],
        ]
        fig.add_trace(go.Scatterpolar(
            r=values + [values[0]],
            theta=labels_id + [labels_id[0]],
            fill="toself", name=row["Program Studi"], opacity=0.6,
        ))
    fig.update_layout(
        polar=dict(radialaxis=dict(visible=True, range=[0, 100])),
        title=dict(text="🏫 Perbandingan Program Studi (Radar)", font_size=16, x=0.01),
        **{k: v for k, v in _LAYOUT_DEFAULTS.items() if k not in ("plot_bgcolor",)},
    )
    return fig


def plot_prodi_grouped_bar(df: pd.DataFrame) -> go.Figure:
    prodi = get_prodi_stats(df)
    fig = go.Figure()
    metrics = {
        "Rata-rata Nilai": ("Rata_Nilai", ACCENT),
        "Rata-rata Kehadiran (%)": ("Rata_Kehadiran", SUCCESS),
    }
    for label, (col, color) in metrics.items():
        fig.add_trace(go.Bar(
            name=label,
            x=prodi["Program Studi"],
            y=prodi[col],
            marker_color=color,
            text=prodi[col].round(1),
            textposition="outside",
        ))
    _apply_layout(fig, "🏫 Perbandingan Nilai & Kehadiran Per Program Studi")
    fig.update_layout(
        barmode="group",
        xaxis_title="Program Studi", yaxis_title="Skor",
        xaxis_tickangle=-15,
    )
    return fig


# ── 8. IPK per prodi (box plot) ──────────────────────────────────────────────

def plot_ipk_boxplot(df: pd.DataFrame) -> go.Figure:
    df_clean = clean_data(df)
    fig = px.box(
        df_clean, x="Program Studi", y="IPK",
        color="Program Studi",
        color_discrete_sequence=PALETTE,
        points="outliers",
        labels={"Program Studi": "Program Studi", "IPK": "IPK"},
    )
    _apply_layout(fig, "📦 Distribusi IPK Per Program Studi")
    fig.update_layout(showlegend=False, xaxis_tickangle=-15)
    return fig


# ── 9. Heatmap nilai per prodi × mata kuliah ─────────────────────────────────

def plot_heatmap_nilai(df: pd.DataFrame) -> go.Figure:
    df_clean = clean_data(df)
    if "Program Studi" not in df_clean.columns or "Mata Kuliah" not in df_clean.columns:
        return go.Figure()
    pivot = df_clean.pivot_table(
        values="Nilai", index="Program Studi", columns="Mata Kuliah", aggfunc="mean"
    ).round(1)
    fig = go.Figure(go.Heatmap(
        z=pivot.values,
        x=pivot.columns.tolist(),
        y=pivot.index.tolist(),
        colorscale="Blues",
        text=pivot.values.round(1),
        texttemplate="%{text}",
        hovertemplate="Prodi: %{y}<br>MK: %{x}<br>Nilai: %{z:.1f}<extra></extra>",
    ))
    _apply_layout(fig, "🌡️ Heatmap Nilai: Program Studi × Mata Kuliah")
    fig.update_layout(
        xaxis_tickangle=-40,
        height=max(350, len(pivot.index) * 60),
    )
    return fig


# ── 10. Scatter mahasiswa berisiko ────────────────────────────────────────────

def plot_risk_scatter(df: pd.DataFrame) -> go.Figure:
    df_clean = clean_data(df)
    per_mhs = df_clean.groupby(["NIM", "Nama", "Program Studi"]).agg(
        Rata_Nilai=("Nilai", "mean"),
        Rata_Kehadiran=("Kehadiran (%)", "mean"),
        IPK=("IPK", "mean"),
    ).reset_index()

    per_mhs["Risiko"] = "Normal"
    per_mhs.loc[
        (per_mhs["Rata_Nilai"] < 55) | (per_mhs["Rata_Kehadiran"] < 70), "Risiko"
    ] = "Perlu Perhatian"
    per_mhs.loc[
        (per_mhs["Rata_Nilai"] < 55) & (per_mhs["Rata_Kehadiran"] < 70), "Risiko"
    ] = "Prioritas Tinggi"

    color_discrete = {"Normal": SUCCESS, "Perlu Perhatian": WARN, "Prioritas Tinggi": DANGER}
    fig = px.scatter(
        per_mhs, x="Rata_Kehadiran", y="Rata_Nilai",
        color="Risiko", color_discrete_map=color_discrete,
        hover_data=["Nama", "NIM", "Program Studi", "IPK"],
        labels={"Rata_Kehadiran": "Rata-rata Kehadiran (%)", "Rata_Nilai": "Rata-rata Nilai"},
        opacity=0.75,
    )
    # Garis ambang batas
    fig.add_vline(x=70,  line_dash="dash", line_color=WARN,   annotation_text="Kehadiran 70%")
    fig.add_hline(y=55,  line_dash="dash", line_color=DANGER, annotation_text="Nilai 55")
    _apply_layout(fig, "🚨 Peta Risiko Akademik Mahasiswa")
    fig.update_layout(xaxis_title="Rata-rata Kehadiran (%)", yaxis_title="Rata-rata Nilai")
    return fig
