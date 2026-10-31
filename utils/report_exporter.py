"""
utils/report_exporter.py
Ekspor laporan analisis ke CSV, Excel, dan HTML.
"""
from __future__ import annotations

import io
import datetime
import pandas as pd
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
    get_data_quality_report,
    generate_insights,
    clean_data,
)

_NOW = lambda: datetime.datetime.now().strftime("%d %B %Y %H:%M")  # noqa: E731


# ── Export CSV ────────────────────────────────────────────────────────────────

def export_csv(df: pd.DataFrame) -> bytes:
    """Export seluruh dataset (sudah dibersihkan) ke CSV."""
    return clean_data(df).to_csv(index=False, encoding="utf-8-sig").encode("utf-8-sig")


# ── Export Excel ──────────────────────────────────────────────────────────────

def export_excel(df: pd.DataFrame) -> bytes:
    """
    Export multi-sheet Excel:
    Sheet 1: Data Lengkap
    Sheet 2: Ringkasan Statistik
    Sheet 3: Per Mata Kuliah
    Sheet 4: Per Program Studi
    Sheet 5: Tren Semester
    Sheet 6: Mahasiswa Berisiko
    """
    output = io.BytesIO()
    df_clean = clean_data(df)

    summary_raw = get_summary_stats(df_clean)
    summary_df  = pd.DataFrame([
        {"Metrik": k.replace("_", " ").title(), "Nilai": v}
        for k, v in summary_raw.items()
    ])

    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df_clean.to_excel(writer, sheet_name="Data Lengkap", index=False)
        summary_df.to_excel(writer, sheet_name="Ringkasan", index=False)
        get_course_stats(df_clean).to_excel(writer, sheet_name="Per Mata Kuliah", index=False)
        get_prodi_stats(df_clean).to_excel(writer, sheet_name="Per Prodi", index=False)
        get_semester_trend(df_clean).to_excel(writer, sheet_name="Tren Semester", index=False)
        get_at_risk_students(df_clean).to_excel(writer, sheet_name="Mahasiswa Berisiko", index=False)
        get_top_students(df_clean, n=20).to_excel(writer, sheet_name="Top 20 Mahasiswa", index=False)

    output.seek(0)
    return output.getvalue()


# ── Export HTML ───────────────────────────────────────────────────────────────

def export_html_report(df: pd.DataFrame) -> str:
    """Buat laporan HTML lengkap yang dapat dibuka di browser."""
    df_clean     = clean_data(df)
    stats        = get_summary_stats(df_clean)
    course_stats = get_course_stats(df_clean).head(15)
    prodi_stats  = get_prodi_stats(df_clean)
    grade_dist   = get_grade_distribution(df_clean)
    top_10       = get_top_students(df_clean, n=10)
    risk_mhs     = get_at_risk_students(df_clean).head(15)
    corr         = analyze_attendance_vs_grade(df_clean)
    insights     = generate_insights(df_clean)
    quality      = get_data_quality_report(df)
    ts           = _NOW()

    def _df_to_html(df_: pd.DataFrame, table_id: str = "") -> str:
        return df_.to_html(
            index=False, border=0, classes="report-table",
            table_id=table_id, na_rep="—",
        )

    insight_html = "".join(f"<li>{ins}</li>" for ins in insights)

    css = """
<style>
  body { font-family: 'Segoe UI', system-ui, sans-serif; margin: 0; padding: 0;
         background: #f7f8fa; color: #1f2328; }
  .container { max-width: 1100px; margin: 0 auto; padding: 32px 24px; }
  h1 { color: #1e40af; font-size: 2rem; margin-bottom: 0.25rem; }
  h2 { color: #1e40af; font-size: 1.25rem; border-left: 4px solid #3b82f6;
       padding-left: 12px; margin-top: 2rem; }
  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
              gap: 16px; margin: 24px 0; }
  .kpi-card { background: #ffffff; border: 1px solid #e5e7eb; border-radius: 10px;
              padding: 20px; text-align: center; }
  .kpi-card .val { font-size: 2rem; font-weight: 700; color: #3b82f6; }
  .kpi-card .lbl { font-size: 0.8rem; color: #57606a; margin-top: 4px; }
  .report-table { width: 100%; border-collapse: collapse; font-size: 0.85rem;
                  margin-top: 12px; }
  .report-table th { background: #e0e7ff; padding: 8px 10px; text-align: left; }
  .report-table td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; }
  .report-table tr:hover td { background: #f0f4ff; }
  .insight-box { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px;
                 padding: 20px; margin-top: 12px; }
  .insight-box li { margin-bottom: 8px; }
  .corr-box { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px;
              padding: 18px; margin-top: 12px; }
  .footer { text-align: center; font-size: 0.75rem; color: #9ca3af;
            border-top: 1px solid #e5e7eb; margin-top: 48px; padding-top: 16px; }
</style>
"""

    html = f"""<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Laporan Analisis Akademik – EduTrack AI</title>
  {css}
</head>
<body>
<div class="container">
  <h1>📊 EduTrack AI – Laporan Analisis Akademik</h1>
  <p style="color:#57606a">Digenerate pada: <strong>{ts}</strong> &nbsp;|&nbsp;
  Total data: <strong>{stats['total_data_entries']:,} entri</strong></p>

  <h2>📋 Ringkasan Statistik</h2>
  <div class="kpi-grid">
    <div class="kpi-card"><div class="val">{stats['total_mahasiswa']:,}</div>
      <div class="lbl">Total Mahasiswa</div></div>
    <div class="kpi-card"><div class="val">{stats['rata_nilai']}</div>
      <div class="lbl">Rata-rata Nilai</div></div>
    <div class="kpi-card"><div class="val">{stats['rata_ipk']}</div>
      <div class="lbl">Rata-rata IPK</div></div>
    <div class="kpi-card"><div class="val">{stats['rata_kehadiran']}%</div>
      <div class="lbl">Rata-rata Kehadiran</div></div>
    <div class="kpi-card"><div class="val">{stats['total_prodi']}</div>
      <div class="lbl">Program Studi</div></div>
    <div class="kpi-card"><div class="val">{stats['total_mk']}</div>
      <div class="lbl">Mata Kuliah</div></div>
  </div>

  <h2>🧠 AI Insights</h2>
  <div class="insight-box"><ul>{insight_html}</ul></div>

  <h2>🔗 Korelasi Kehadiran–Nilai</h2>
  <div class="corr-box">
    <p>{corr['interpretasi']}</p>
    <p>Koefisien Pearson: <strong>r = {corr['korelasi']}</strong> |
    P-value: {corr['p_value']} |
    N sampel: {corr['n_sampel']:,}</p>
  </div>

  <h2>🏆 Top 10 Mahasiswa (IPK Tertinggi)</h2>
  {_df_to_html(top_10)}

  <h2>📚 Statistik Mata Kuliah</h2>
  {_df_to_html(course_stats)}

  <h2>🏫 Perbandingan Program Studi</h2>
  {_df_to_html(prodi_stats)}

  <h2>🎓 Distribusi Huruf Mutu</h2>
  {_df_to_html(grade_dist)}

  <h2>🚨 Mahasiswa yang Butuh Pendampingan</h2>
  {_df_to_html(risk_mhs) if not risk_mhs.empty else "<p>Tidak ada mahasiswa yang terdeteksi berisiko.</p>"}

  <h2>🔍 Kualitas Data</h2>
  <ul>
    <li>Total baris: {quality['total_baris']:,}</li>
    <li>Total kolom: {quality['total_kolom']}</li>
    <li>Nilai kosong: {quality['missing_values'] or "Tidak ada"}</li>
    <li>Duplikat: {quality['duplikat']} baris ({quality['duplikat_pct']}%)</li>
  </ul>

  <div class="footer">Laporan ini dihasilkan secara otomatis oleh EduTrack AI &mdash; Powered by IBM Bob</div>
</div>
</body>
</html>"""
    return html
