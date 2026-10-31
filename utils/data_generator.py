"""
utils/data_generator.py
Menghasilkan dataset dummy akademik mahasiswa (≥1000 baris) secara deterministik.
"""
from __future__ import annotations

import os
import random
import numpy as np
import pandas as pd

_SEED = 42
random.seed(_SEED)
np.random.seed(_SEED)

# ── Konstanta ────────────────────────────────────────────────────────────────
TOTAL_MAHASISWA = 260   # × rata-rata 5 MK → ~1 300 baris sebelum duplikat
PRODI_LIST = [
    "Teknik Informatika",
    "Sistem Informasi",
    "Manajemen",
    "Akuntansi",
    "Ilmu Komunikasi",
]
ANGKATAN_LIST = [2020, 2021, 2022, 2023]
SEMESTER_LIST  = [1, 2, 3, 4, 5, 6, 7, 8]

MK_PER_PRODI: dict[str, list[str]] = {
    "Teknik Informatika": [
        "Algoritma & Pemrograman", "Basis Data", "Jaringan Komputer",
        "Kecerdasan Buatan", "Pemrograman Web", "Sistem Operasi",
        "Rekayasa Perangkat Lunak", "Statistika",
    ],
    "Sistem Informasi": [
        "Analisis Sistem", "Basis Data", "E-Business",
        "Manajemen Proyek IT", "Pemrograman Web", "Sistem ERP",
        "Audit Sistem Informasi", "Statistika",
    ],
    "Manajemen": [
        "Manajemen SDM", "Manajemen Keuangan", "Pemasaran Digital",
        "Kewirausahaan", "Riset Operasi", "Akuntansi Manajemen",
        "Ekonomi Mikro", "Statistika Bisnis",
    ],
    "Akuntansi": [
        "Akuntansi Keuangan", "Perpajakan", "Audit",
        "Akuntansi Biaya", "Sistem Informasi Akuntansi",
        "Ekonomi Makro", "Manajemen Keuangan", "Statistika",
    ],
    "Ilmu Komunikasi": [
        "Komunikasi Massa", "Jurnalistik", "Public Relations",
        "Fotografi & Videografi", "Media Sosial", "Komunikasi Antarbudaya",
        "Semiotika", "Statistika Sosial",
    ],
}

NAMA_DEPAN = [
    "Adi", "Budi", "Citra", "Dewi", "Eka", "Fajar", "Gilang", "Hana",
    "Indra", "Joko", "Kartika", "Lutfi", "Maya", "Nanda", "Okta",
    "Putri", "Rizky", "Sari", "Taufik", "Umar", "Vina", "Wahyu",
    "Xena", "Yusuf", "Zahra", "Agus", "Bagas", "Cyntia", "Dimas", "Elsa",
    "Firman", "Gita", "Hendra", "Ira", "Johan", "Kirana", "Laras", "Mira",
    "Nico", "Olivia", "Pandu", "Qori", "Reza", "Sinta", "Tomi", "Ulfa",
    "Vicky", "Wulan", "Yanti", "Zaki",
]
NAMA_BELAKANG = [
    "Pratama", "Susanto", "Wulandari", "Setiawan", "Nugroho", "Hidayat",
    "Rahayu", "Kurniawan", "Permata", "Santoso", "Lestari", "Utama",
    "Wijaya", "Saputra", "Dewantara", "Puspita", "Ramadhan", "Azzahra",
    "Prasetyo", "Yusrianto", "Mahendra", "Fitriani", "Nuraini", "Adiputra",
    "Harahap", "Sinaga", "Manurung", "Situmorang", "Simanjuntak", "Pakpahan",
]


# ── Fungsi pembantu ──────────────────────────────────────────────────────────
def _nim(prodi_idx: int, angkatan_yy: int, seq: int) -> str:
    return f"{angkatan_yy}{prodi_idx + 1:02d}{seq:04d}"


def _grade_letter(nilai: float) -> str:
    if nilai >= 85:  return "A"
    if nilai >= 75:  return "B+"
    if nilai >= 65:  return "B"
    if nilai >= 55:  return "C+"
    if nilai >= 45:  return "C"
    if nilai >= 35:  return "D"
    return "E"


def _ipk_from_values(nilai_list: list[float]) -> float:
    avg = float(np.mean(nilai_list))
    if avg >= 85:
        return round(min(4.0, 3.5 + (avg - 85) * 0.05), 2)
    if avg >= 70:
        return round(2.75 + (avg - 70) * 0.05, 2)
    if avg >= 55:
        return round(1.5 + (avg - 55) * 0.083, 2)
    return round(max(0.5, avg * 0.025), 2)


# ── Generator utama ──────────────────────────────────────────────────────────
def generate_dataset() -> pd.DataFrame:
    """Buat DataFrame akademik dummy ≥1000 baris dan kembalikan."""
    rng_local = np.random.RandomState(_SEED)
    rand_local = random.Random(_SEED)

    records: list[dict] = []
    nim_to_nilai: dict[str, list[float]] = {}

    for i in range(TOTAL_MAHASISWA):
        prodi_idx = i % len(PRODI_LIST)
        prodi     = PRODI_LIST[prodi_idx]
        angkatan  = rand_local.choice(ANGKATAN_LIST)
        semester  = rand_local.choice(SEMESTER_LIST)
        nim       = _nim(prodi_idx, angkatan % 100, i + 1)
        nama      = f"{rand_local.choice(NAMA_DEPAN)} {rand_local.choice(NAMA_BELAKANG)}"

        ability          = float(rng_local.beta(5, 2))       # 0‒1
        attendance_base  = float(rng_local.beta(6, 2))       # 0‒1

        mk_list   = MK_PER_PRODI[prodi]
        n_mk      = rand_local.randint(4, len(mk_list))
        selected  = rand_local.sample(mk_list, n_mk)

        nim_to_nilai[nim] = []
        for mk in selected:
            kehadiran = round(float(np.clip(
                rng_local.normal(attendance_base * 100, 8), 40, 100)), 1)
            base  = ability * 60 + (kehadiran / 100) * 25
            nilai = round(float(np.clip(
                rng_local.normal(base, 8), 0, 100)), 1)
            nim_to_nilai[nim].append(nilai)

            records.append({
                "NIM": nim,
                "Nama": nama,
                "Program Studi": prodi,
                "Angkatan": angkatan,
                "Semester": semester,
                "Mata Kuliah": mk,
                "Nilai": nilai,
                "Grade": _grade_letter(nilai),
                "IPK": 0.0,          # placeholder – di-update setelah loop
                "Kehadiran (%)": kehadiran,
            })

    # Update IPK per mahasiswa
    nim_to_ipk = {nim: _ipk_from_values(vals) for nim, vals in nim_to_nilai.items()}
    for rec in records:
        rec["IPK"] = nim_to_ipk[rec["NIM"]]

    df = pd.DataFrame(records, columns=[
        "NIM", "Nama", "Program Studi", "Angkatan", "Semester",
        "Mata Kuliah", "Nilai", "Grade", "IPK", "Kehadiran (%)",
    ])

    # Sisipkan ±1% missing values di Nilai & Kehadiran
    n_missing = max(1, int(len(df) * 0.01))
    idx_v = rng_local.choice(df.index, n_missing, replace=False)
    idx_k = rng_local.choice(df.index, n_missing, replace=False)
    df.loc[idx_v, "Nilai"]        = np.nan
    df.loc[idx_k, "Kehadiran (%)"] = np.nan

    # Tambah ±0.5% duplikat
    n_dup  = max(1, int(len(df) * 0.005))
    dup_idx = rng_local.choice(df.index, n_dup, replace=False)
    df = pd.concat([df, df.loc[dup_idx]], ignore_index=True)

    return df


def load_or_generate(csv_path: str = "data/academic_data.csv") -> pd.DataFrame:
    """
    Muat dataset dari *csv_path* jika sudah ada;
    jika belum, generate → simpan → kembalikan.
    """
    if os.path.exists(csv_path):
        return pd.read_csv(csv_path, encoding="utf-8-sig")

    df = generate_dataset()
    os.makedirs(os.path.dirname(csv_path), exist_ok=True)
    df.to_csv(csv_path, index=False, encoding="utf-8-sig")
    return df
