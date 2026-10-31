"""
Script untuk menghasilkan dataset dummy akademik mahasiswa (≥1000 baris).
Jalankan sekali: python generate_data.py
"""

import pandas as pd
import numpy as np
import os
import random
from datetime import datetime, timedelta

random.seed(42)
np.random.seed(42)

# ── Konfigurasi ──────────────────────────────────────────────────────────────
TOTAL_MAHASISWA = 250  # × jumlah mata kuliah per mahasiswa → >1000 baris
PRODI_LIST = [
    "Teknik Informatika",
    "Sistem Informasi",
    "Manajemen",
    "Akuntansi",
    "Ilmu Komunikasi",
]
SEMESTER_LIST = [1, 2, 3, 4, 5, 6, 7, 8]
MATA_KULIAH_PER_PRODI = {
    "Teknik Informatika": [
        "Algoritma & Pemrograman", "Basis Data", "Jaringan Komputer",
        "Kecerdasan Buatan", "Pemrograman Web", "Sistem Operasi",
        "Rekayasa Perangkat Lunak", "Statistika"
    ],
    "Sistem Informasi": [
        "Analisis Sistem", "Basis Data", "E-Business",
        "Manajemen Proyek IT", "Pemrograman Web", "Sistem ERP",
        "Audit Sistem Informasi", "Statistika"
    ],
    "Manajemen": [
        "Manajemen SDM", "Manajemen Keuangan", "Pemasaran Digital",
        "Kewirausahaan", "Riset Operasi", "Akuntansi Manajemen",
        "Ekonomi Mikro", "Statistika Bisnis"
    ],
    "Akuntansi": [
        "Akuntansi Keuangan", "Perpajakan", "Audit",
        "Akuntansi Biaya", "Sistem Informasi Akuntansi",
        "Ekonomi Makro", "Manajemen Keuangan", "Statistika"
    ],
    "Ilmu Komunikasi": [
        "Komunikasi Massa", "Jurnalistik", "Public Relations",
        "Fotografi & Videografi", "Media Sosial", "Komunikasi Antarbudaya",
        "Semiotika", "Statistika Sosial"
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


def generate_nim(prodi_idx: int, angkatan: int, seq: int) -> str:
    return f"{angkatan}{prodi_idx+1:02d}{seq:04d}"


def generate_ipk(nilai_list: list) -> float:
    """Konversi rata-rata nilai ke skala IPK 4.0"""
    avg = np.mean(nilai_list)
    if avg >= 85:
        return round(min(4.0, 3.5 + (avg - 85) * 0.05), 2)
    elif avg >= 70:
        return round(2.75 + (avg - 70) * 0.05, 2)
    elif avg >= 55:
        return round(1.5 + (avg - 55) * 0.083, 2)
    else:
        return round(max(0.5, avg * 0.025), 2)


def get_grade_letter(nilai: float) -> str:
    if nilai >= 85:
        return "A"
    elif nilai >= 75:
        return "B+"
    elif nilai >= 65:
        return "B"
    elif nilai >= 55:
        return "C+"
    elif nilai >= 45:
        return "C"
    elif nilai >= 35:
        return "D"
    else:
        return "E"


def main():
    records = []
    angkatan_list = [2020, 2021, 2022, 2023]

    for i in range(TOTAL_MAHASISWA):
        prodi_idx = i % len(PRODI_LIST)
        prodi = PRODI_LIST[prodi_idx]
        angkatan = random.choice(angkatan_list)
        semester = random.choice(SEMESTER_LIST)
        nim = generate_nim(prodi_idx, angkatan % 100, i + 1)
        nama = f"{random.choice(NAMA_DEPAN)} {random.choice(NAMA_BELAKANG)}"

        # Profil kemampuan mahasiswa (0-1)
        ability = np.random.beta(5, 2)         # cenderung menengah-atas
        attendance_base = np.random.beta(6, 2)  # 70–95% umumnya

        mk_list = MATA_KULIAH_PER_PRODI[prodi]
        n_mk = random.randint(4, len(mk_list))
        selected_mk = random.sample(mk_list, n_mk)
        nilai_list = []

        for mk in selected_mk:
            # Nilai terpengaruh kemampuan + kehadiran + noise
            kehadiran = round(min(100.0, max(40.0,
                np.random.normal(attendance_base * 100, 8))), 1)
            base_nilai = ability * 60 + (kehadiran / 100) * 25
            noise = np.random.normal(0, 8)
            nilai = round(min(100.0, max(0.0, base_nilai + noise)), 1)
            nilai_list.append(nilai)

            records.append({
                "NIM": nim,
                "Nama": nama,
                "Program Studi": prodi,
                "Angkatan": angkatan,
                "Semester": semester,
                "Mata Kuliah": mk,
                "Nilai": nilai,
                "Grade": get_grade_letter(nilai),
                "Kehadiran (%)": kehadiran,
            })

        # Hitung IPK dari semua nilai mahasiswa ini
        ipk = generate_ipk(nilai_list)
        # Update IPK untuk semua baris mahasiswa ini (akan di-set setelah loop)
        for rec in records:
            if rec["NIM"] == nim:
                rec["IPK"] = ipk

    df = pd.DataFrame(records)

    # Pastikan kolom urut rapi
    df = df[["NIM", "Nama", "Program Studi", "Angkatan", "Semester",
             "Mata Kuliah", "Nilai", "Grade", "IPK", "Kehadiran (%)"]]

    # Tambah sedikit noise: 1% missing values di kolom Nilai & Kehadiran
    n_missing = max(1, int(len(df) * 0.01))
    missing_idx_nilai = np.random.choice(df.index, n_missing, replace=False)
    missing_idx_hadir = np.random.choice(df.index, n_missing, replace=False)
    df.loc[missing_idx_nilai, "Nilai"] = np.nan
    df.loc[missing_idx_hadir, "Kehadiran (%)"] = np.nan

    # Tambah ~0.5% duplikat
    dup_idx = np.random.choice(df.index, max(1, int(len(df) * 0.005)), replace=False)
    df = pd.concat([df, df.loc[dup_idx]], ignore_index=True)

    os.makedirs("data", exist_ok=True)
    df.to_csv("data/academic_data.csv", index=False, encoding="utf-8-sig")
    print(f"✅ Dataset berhasil dibuat: {len(df)} baris → data/academic_data.csv")
    print(df.head())
    print(df.dtypes)


if __name__ == "__main__":
    main()
