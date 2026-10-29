# Check-in Kunjungan dan Halaqoh — Petunjuk Integrasi

Aplikasi menggunakan satu Google Spreadsheet untuk dua alur QR:
- **Kunjungan**: kode lama berawalan `KS-`; hasil menampilkan Bpk, Ibu, Wali Santri dari, Alamat, dan Kelas.
- **Halaqoh**: kode berawalan `HQ-`; hasil hanya menampilkan Nama Santri, Kelas Berapa, Siapa yang akan Konsultasi, Lokasi Konsultasi, Pertanyaan yang akan diajukan, dan Jadwal Konsultasi 08:00–09:00 WIB.

Kode sumber front end: [konsultasi.html](https://github.com/pesantrenasshidqu/checkin-acara/blob/main/konsultasi.html)
Kode sumber Apps Script: [apps-script/Code.gs](https://github.com/pesantrenasshidqu/checkin-acara/blob/main/apps-script/Code.gs)

## 1. Struktur spreadsheet

### Tab `Sheet1` — Data Kunjungan

Pertahankan tab ini dan jangan mengganti nama jika aplikasi lama sudah memakai tab tersebut. Kolom:
- A: Nama Santri
- B: Nama Bapak Wali Santri
- C: Nama Ibu Wali Santri
- D: Alamat
- E: Kelas
- F: Status
- G: Waktu Check-in
- H: QR
- I: Link QR
- J: Kode QR (`KS-`)

Kode Kunjungan dan status scan yang sudah ada dipertahankan oleh fungsi persiapan.

### Tab `Permohonan Halaqoh` — Data formulir konsultasi

Baris pertama adalah header. A:H berisi data formulir:
- A: Timestamp
- B: Email Address
- C: Nama Santri
- D: Kelas Berapa
- E: Siapa yang akan Konsultasi
- F: Perkiraan Konsultasi pukul berapa
- G: Lokasi Konsultasi
- H: Pertanyaan yang akan diajukan

Kolom I:M dipakai oleh sistem:
- I: Status Check-in
- J: Waktu Check-in
- K: QR
- L: Link QR
- M: Kode QR (`HQ-`)

## 2. Tambahkan tab Halaqoh ke spreadsheet yang sedang dipakai

1. Unduh file workbook gabungan dari percakapan yang menyiapkannya: `DATA-KUNJUNGAN-DAN-HALAQOH.xlsx`.
2. Buka file tersebut di Google Sheets. Jika masih terbuka sebagai file Excel, pilih **File → Save as Google Sheets**.
3. Pada tab `Permohonan Halaqoh`, buka menu tab lalu pilih **Copy to → Existing spreadsheet**.
4. Pilih spreadsheet Data Kunjungan yang sudah dipakai aplikasi.
5. Jika nama hasil salinan berbeda, ubah nama tab persis menjadi `Permohonan Halaqoh`.
6. Jangan hapus atau mengganti tab `Sheet1`.

Data pribadi, alamat, email, dan pertanyaan konsultasi tetap berada di spreadsheet; jangan menaruh baris data tersebut di repo GitHub publik.

## 3. Terapkan backend Apps Script

1. Buka spreadsheet utama → **Extensions → Apps Script**.
2. Buka file `apps-script/Code.gs` dari repo ini dan salin seluruh isinya ke project Apps Script yang terikat ke spreadsheet utama, menggantikan kode lama.
3. Simpan. Pastikan fungsi yang tersedia adalah `siapkanDataHalaqoh`.
4. Pilih fungsi `siapkanDataHalaqoh` lalu klik **Run** dan beri izin yang diminta.
5. Fungsi ini menyiapkan kolom I:M, mempertahankan kode `HQ-` yang sudah valid, membuat kode untuk data baru, serta memperbarui QR dan tautannya.
6. Untuk memperbarui web app yang telah digunakan halaman GitHub, buka **Deploy → Manage deployments → Edit** pada deployment yang ada, pilih **New version**, lalu **Deploy**. Pertahankan URL deployment yang sama agar konstanta `API_URL` di halaman tidak perlu diganti.
7. Pada menu spreadsheet **Konsultasi Santri**, tersedia persiapan Kunjungan dan Halaqoh secara terpisah, serta tombol cetak QR Kunjungan dan cetak QR Halaqoh ke Google Docs.

## 4. Cara kerja scan

- QR `KS-`: data diproses dari tab `Sheet1`; hasil tetap menampilkan identitas wali dan santri untuk Kunjungan.
- QR `HQ-`: data diproses dari tab `Permohonan Halaqoh`; hasil hanya menampilkan enam informasi Halaqoh yang diminta.
- Scan pertama mengubah status menjadi `SUDAH DISCAN/DIPAKAI` dan mencatat waktu scan.
- Scan ulang menampilkan status kuning dan mempertahankan waktu scan pertama.
- QR tidak dikenal menampilkan status `QR TIDAK TERDAFTAR`.

## 5. Cetak kartu QR Halaqoh

Setelah kode terbaru pada `apps-script/Code.gs` disalin ke Apps Script dan disimpan, buka ulang spreadsheet atau refresh halaman agar menu `Konsultasi Santri` diperbarui.

- Pilih **Konsultasi Santri → Cetak semua QR Halaqoh ke Google Docs**.
- Sistem membaca nama, kelas, dan kode QR dari tab `Permohonan Halaqoh`; layout 3 kolom × 4 kartu per halaman.
- Kartu berisi label HALAQOH, QR, nama santri, kelas, jadwal 08:00–09:00 WIB, serta kode `HQ-`.
- Pertanyaan konsultasi tidak dicetak ke kartu QR agar informasi pribadi tidak tersebar tanpa keperluan.
- Dokumen terbuka lewat dialog; di Google Docs pilih **File → Print**.
- Tombol **Cetak semua QR Kunjungan ke Google Docs** yang lama tetap khusus Kunjungan. Gunakan tombol Halaqoh untuk mencetak data Halaqoh.

## 6. Simpan semua foto QR ke satu folder Google Drive

Di menu spreadsheet **Konsultasi Santri**, pilih **Simpan QR Tahfidz & Halaqoh ke Drive (per kelas)**.

Struktur folder yang dibuat:
- `QR Santri - Tahfidz dan Halaqoh/Tahfidz/<nama kelas>/`
- `QR Santri - Tahfidz dan Halaqoh/Halaqoh/<nama kelas>/`

Sumber data:
- Folder **Tahfidz** membaca tab `Sheet1`: nama santri di kolom A, kelas di kolom E, kode QR di kolom J.
- Folder **Halaqoh** membaca tab `Permohonan Halaqoh`: nama santri di kolom C, kelas di kolom D, kode QR di kolom M.

Setiap gambar disimpan sebagai PNG dengan format nama `Nama Santri - KODE.png`. Sistem membuat QR dari kode yang sudah ada; kode QR dan status scan tidak diubah. Kalau tombol dijalankan lagi, file dengan nama sama dilewati agar tidak menggandakan gambar. Proses ini memerlukan izin Google Drive dan UrlFetchApp saat pertama kali dijalankan.

Untuk mengaktifkan menu baru, salin seluruh isi `apps-script/Code.gs` terbaru ke project Apps Script yang terikat ke spreadsheet utama, klik **Save**, lalu muat ulang Google Sheets dan beri izin saat diminta.

## 7. Tautan aplikasi

- HP pemindai: https://pesantrenasshidqu.github.io/checkin-acara/konsultasi.html?mode=hp
- Proyektor: https://pesantrenasshidqu.github.io/checkin-acara/konsultasi.html?mode=layar

Catatan: perubahan pada file Apps Script di GitHub hanya memperbarui sumber kode di repo. Backend web app baru aktif setelah kode disalin ke Apps Script yang terikat spreadsheet dan deployment dibuat ke versi baru.
