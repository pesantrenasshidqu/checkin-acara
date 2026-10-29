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
7. Pada menu spreadsheet **Konsultasi Santri**, tersedia persiapan Kunjungan dan persiapan Halaqoh yang terpisah.

## 4. Cara kerja scan

- QR `KS-`: data diproses dari tab `Sheet1`; hasil tetap menampilkan identitas wali dan santri untuk Kunjungan.
- QR `HQ-`: data diproses dari tab `Permohonan Halaqoh`; hasil hanya menampilkan enam informasi Halaqoh yang diminta.
- Scan pertama mengubah status menjadi `SUDAH DISCAN/DIPAKAI` dan mencatat waktu scan.
- Scan ulang menampilkan status kuning dan mempertahankan waktu scan pertama.
- QR tidak dikenal menampilkan status `QR TIDAK TERDAFTAR`.

## 5. Tautan aplikasi

- HP pemindai: https://pesantrenasshidqu.github.io/checkin-acara/konsultasi.html?mode=hp
- Proyektor: https://pesantrenasshidqu.github.io/checkin-acara/konsultasi.html?mode=layar

Catatan: perubahan pada file Apps Script di GitHub hanya memperbarui sumber kode di repo. Backend web app baru aktif setelah kode disalin ke Apps Script yang terikat spreadsheet dan deployment dibuat ke versi baru.
