# PIAT 6 Finance & Accounting --- Blueprint v1.0

## 1. Tujuan

Membangun aplikasi **PIAT 6 Finance & Accounting** sebagai aplikasi
standalone yang dapat langsung dipakai, tetapi sejak awal dirancang agar
kelak dapat diintegrasikan menjadi modul Finance & Accounting di PIAT 6
Super App.

Prinsip utama:

-   Input transaksi sesederhana mungkin.
-   Accounting Engine tetap mengikuti logika pembukuan PIAT 6.
-   Jurnal terbentuk otomatis dari jenis transaksi.
-   Laporan keuangan tidak diketik ulang.
-   Setiap transaksi memiliki audit trail.
-   Data dan API disiapkan untuk integrasi dengan 6Mart, Wallet,
    HRD/Payroll, Madrasah, Kepengasuhan, dan modul lain.
-   Excel laporan keuangan PIAT 6 menjadi baseline untuk validasi hasil
    sistem.

## 2. Arsitektur

``` text
                    PIAT 6 FINANCE & ACCOUNTING
                              |
        +---------------------+---------------------+
        |                     |                     |
   INPUT LAYER          ACCOUNTING ENGINE       REPORTING
        |                     |                     |
  Penerimaan             Jurnal otomatis      Neraca
  Pengeluaran             General Ledger      Pendapatan/Beban
  Jurnal Umum             Trial Balance       Perubahan Aset Bersih
  Piutang                 Closing             Arus Kas
  Hutang                                      Catatan Laporan
  Aset                                        Konsolidasi
  Persediaan
  Anggaran
        |
        +------------------ INTEGRATION ------------------+
                           |       |       |       |
                         6Mart   Wallet    HRD   Madrasah
```

## 3. Modul

### A. Dashboard

-   Dashboard Bendahara
-   Dashboard Yayasan An Nawawi
-   Dashboard per unit
-   Ringkasan kas/bank
-   Piutang
-   Aset
-   Pendapatan dan beban
-   Surplus/defisit
-   Anggaran vs realisasi
-   Grafik tren

### B. Master Data

-   Chart of Accounts / COA
-   Unit/entitas
-   Bank dan rekening
-   Customer/santri
-   Supplier
-   Pegawai
-   Produk
-   Kategori transaksi
-   Cost center / program / aktivitas
-   Tahun/periode akuntansi
-   Mapping jenis transaksi → akun

### C. Transaksi

-   Penerimaan kas
-   Pengeluaran kas
-   Transfer antar rekening
-   Jurnal umum
-   Penagihan/piutang
-   Pembayaran hutang
-   Penyesuaian
-   Closing periode

### D. Piutang

-   Piutang pendidikan
-   Piutang lain-lain
-   Kartu piutang
-   Aging piutang
-   Pembayaran piutang
-   Rekonsiliasi

### E. Persediaan

-   Master barang
-   Pembelian
-   Pengeluaran
-   Mutasi
-   Penyesuaian stok
-   Nilai persediaan

### F. Aset Tetap

-   Register aset
-   Lokasi
-   Tanggal perolehan
-   Nilai perolehan
-   Umur ekonomis
-   Penyusutan
-   Mutasi
-   Pelepasan

### G. Anggaran

-   Anggaran per unit/program
-   Anggaran per akun
-   Realisasi
-   Varians
-   Persentase serapan

### H. 6Mart

-   Penjualan
-   Pembelian
-   Persediaan
-   Kas/bank/wallet
-   Laba/rugi 6Mart
-   Neraca 6Mart
-   Aset 6Mart

### I. Laporan

-   Jurnal
-   General Ledger
-   Neraca Saldo
-   Laporan Posisi Keuangan
-   Laporan Pendapatan dan Beban
-   Perubahan Aset Bersih
-   Arus Kas
-   Piutang
-   Persediaan
-   Aset Tetap
-   Hutang/accrued expense
-   Anggaran vs realisasi
-   Laporan 6Mart
-   Konsolidasi
-   Catatan atas laporan keuangan

## 4. UX Input --- dibuat sangat sederhana

Pengguna rutin tidak dipaksa memilih debit/kredit.

Contoh tombol:

-   -   Penerimaan
-   -   Pengeluaran
-   -   Transfer
-   -   Jurnal Penyesuaian
-   -   Pembelian Aset
-   -   Pembayaran Piutang
-   -   Pembayaran Hutang

Contoh Penerimaan:

``` text
Tanggal
Jenis penerimaan
Unit
Pihak terkait
Rekening penerima
Nominal
Keterangan
Bukti transaksi
[ Simpan & Posting ]
```

Sistem menentukan jurnal berdasarkan mapping.

Contoh:

``` text
Penerimaan pembayaran piutang SPP
        ↓
Debit  Kas/Bank
Kredit Piutang Pendidikan
        ↓
General Ledger
        ↓
Neraca Saldo
        ↓
Laporan Keuangan
```

## 5. Accounting Engine

Mesin wajib menjaga prinsip:

-   Total debit = total kredit.
-   Nomor jurnal unik.
-   Periode yang sudah ditutup tidak boleh diedit sembarangan.
-   Koreksi dilakukan melalui jurnal koreksi/adjustment.
-   Semua posting memiliki sumber transaksi.
-   Semua perubahan penting masuk audit log.

Struktur transaksi minimal:

``` text
transaction
journal_header
journal_line
account
unit
contact
period
attachment
audit_log
```

## 6. Dashboard Yayasan An Nawawi Bondowoso

Dashboard khusus pengelola Yayasan, bukan dashboard operasional
bendahara.

### KPI utama

1.  **Total Kas & Setara Kas**
2.  **Total Piutang**
3.  **Total Persediaan**
4.  **Total Aset Pesantren**
5.  **Total Kewajiban**
6.  **Total Aset Bersih/Dana**
7.  **Surplus/Defisit Bulan Berjalan**
8.  **Surplus/Defisit Tahun Berjalan**
9.  **Realisasi Anggaran**
10. **Saldo Dana Terikat/Tidak Terikat** bila struktur akuntansi
    menggunakannya.

### Tampilan

``` text
YAYASAN AN NAWAWI
Dashboard Keuangan PIAT 6
Periode: September 2026

┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ KAS & BANK   │ │ PIUTANG      │ │ TOTAL ASET   │
│ Rp ...       │ │ Rp ...       │ │ Rp ...       │
└──────────────┘ └──────────────┘ └──────────────┘

┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ SURPLUS/     │ │ SURPLUS/     │ │ KEWAJIBAN    │
│ DEFISIT BLN  │ │ DEFISIT THN  │ │ Rp ...       │
│ Rp ...       │ │ Rp ...       │
└──────────────┘ └──────────────┘
```

### Grafik

-   Tren kas & setara kas per bulan.
-   Tren surplus/defisit bulanan.
-   Pendapatan vs beban.
-   Anggaran vs realisasi.
-   Komposisi aset.
-   Piutang per kategori/umur.
-   Kontribusi Pendidikan vs 6Mart/unit usaha.
-   Tren 12 bulan.

Dashboard harus memiliki filter: - Periode - Unit - Entitas - Kategori

dan tombol drill-down dari KPI → laporan → transaksi sumber.

## 7. Hak Akses

### Super Admin

Semua konfigurasi.

### Accounting/Admin Keuangan

Input, posting, koreksi sesuai kewenangan.

### Bendahara

Transaksi kas/bank dan laporan yang diperlukan.

### Kepala Keuangan/Mudir

Review, approval, laporan.

### Yayasan

Read-only dashboard dan laporan strategis; akses transaksi detail hanya
bila diberi hak.

### Auditor

Read-only + audit trail.

## 8. Keamanan & Audit

-   Login aman.
-   Role-based access control.
-   Approval workflow.
-   Audit log.
-   Timestamp.
-   User ID.
-   Riwayat perubahan.
-   Attachment bukti transaksi.
-   Lock periode.
-   Backup.
-   Export laporan.

## 9. Integrasi masa depan

Standalone sekarang:

``` text
PIAT 6 Finance & Accounting
```

Nanti:

``` text
PIAT 6 SUPER APP
|
+-- Kepengasuhan
+-- Madrasah
+-- HRD
+-- Rumah Tangga
+-- Poskestren
+-- 6Mart
+-- Wallet
+-- Finance & Accounting  <--- modul ini
+-- Yayasan Monitoring
```

Integrasi utama:

-   6Mart → penjualan/pembelian/persediaan.
-   Wallet → penerimaan/pembayaran.
-   HRD → payroll.
-   Madrasah → tagihan/penerimaan pendidikan.
-   Kepengasuhan → transaksi terkait program.
-   Yayasan → dashboard konsolidasi.

## 10. Strategi migrasi Excel

Jangan langsung mematikan Excel.

Tahap:

1.  Mapping COA Excel.
2.  Mapping jenis transaksi.
3.  Import master data.
4.  Import saldo awal.
5.  Uji jurnal.
6.  Bandingkan laporan Web App dengan Excel.
7.  Parallel run.
8.  Rekonsiliasi.
9.  Go-live.
10. Excel menjadi arsip/reference.

Target validasi:

-   Neraca.
-   Pendapatan & beban.
-   Arus kas.
-   Piutang.
-   Aset.
-   Persediaan.
-   6Mart.
-   Konsolidasi.

## 11. Prinsip penting untuk pembangunan

Jangan membuat "Excel versi web".

Yang dipertahankan adalah **logika akuntansinya**.

Yang diubah adalah pengalaman pengguna:

``` text
Excel:
Input detail → banyak kolom → formula → laporan

Web App:
Pilih jenis transaksi → isi form sederhana
→ sistem membuat jurnal
→ sistem posting
→ laporan otomatis
```

## 12. Tahapan pembangunan

### Phase A --- Foundation

-   Auth
-   Role
-   Master data
-   COA
-   Unit
-   Periode
-   Audit log

### Phase B --- Core Accounting

-   Penerimaan
-   Pengeluaran
-   Transfer
-   Jurnal umum
-   Posting
-   GL
-   Trial Balance

### Phase C --- Supporting Accounting

-   Piutang
-   Hutang
-   Persediaan
-   Aset tetap
-   Penyusutan
-   Anggaran

### Phase D --- Reporting

-   Neraca
-   Pendapatan/Beban
-   Perubahan Aset Bersih
-   Arus Kas
-   Catatan
-   Konsolidasi
-   Export PDF/Excel

### Phase E --- 6Mart & Integration

-   POS
-   Inventory
-   Wallet
-   Integrasi HRD
-   Integrasi Madrasah
-   API

### Phase F --- Yayasan Dashboard

-   Executive KPI
-   Grafik
-   Drill-down
-   Perbandingan periode
-   Monitoring unit

## 13. Kriteria selesai

Aplikasi dianggap siap dipakai apabila:

-   Bendahara dapat mencatat transaksi rutin tanpa memahami jurnal
    secara manual.
-   Setiap transaksi menghasilkan jurnal yang benar.
-   Debit dan kredit selalu balance.
-   Laporan utama dapat dihasilkan otomatis.
-   Saldo Web App dapat direkonsiliasi dengan Excel.
-   Periode dapat dikunci.
-   Semua perubahan penting dapat diaudit.
-   Dashboard Yayasan dapat membaca posisi keuangan tanpa membuka
    workbook accounting.

## 14. Catatan desain

Dashboard Yayasan harus bersifat **executive dashboard**: ringkas,
visual, profesional, dan drill-down.

Jangan menampilkan terlalu banyak angka sekaligus. Fokus awal pada:
**Kas → Piutang → Aset → Kewajiban → Surplus/Defisit → Anggaran →
Tren.**
