# Checkin Konsultasi Santri — Petunjuk pemasangan

Sistem ini terpisah dari check-in acara dan kepulangan. Halaman GitHub menggunakan `konsultasi.html`; backend memakai Apps Script yang diikat ke spreadsheet konsultasi.

## Struktur spreadsheet

Tab yang dipakai: `Sheet1`. Fungsi persiapan mencari baris pertama yang tampak seperti data santri (nama santri, nama ayah/ibu, dan alamat atau kelas), jadi judul acara pada baris 4 tidak dianggap sebagai santri.

- A: Nama Santri
- B: Ayah
- C: Ibu
- D: Alamat
- E: Kelas
- F: Status (dibuat otomatis)
- G: Waktu Check-in (dibuat otomatis)
- H: QR (gambar otomatis)
- I: Link QR (tautan otomatis)
- J: Kode QR (kode unik yang terlihat di kolom terakhir)

Jangan edit manual kolom F:J setelah menjalankan persiapan, kecuali memang sedang memperbaiki data. Fungsi persiapan dapat dijalankan ulang: kode `KS-...` yang valid, status, dan waktu check-in dipertahankan; kode yang rusak/mengandung teks header akan diperbaiki dan rumus QR diperbarui. Jika tab bukan bernama `Sheet1`, ubah `SHEET_NAME` pada `Code.gs` sesuai nama tab.

## A. Pasang backend Apps Script

1. Buka spreadsheet konsultasi yang benar.
2. Pilih **Extensions → Apps Script** agar project terikat ke spreadsheet konsultasi, bukan ke spreadsheet check-in lama.
3. Ganti isi `Code.gs` dengan isi folder `apps-script/Code.gs`, lalu simpan.
4. Pilih fungsi `siapkanKonsultasiSantri` lalu klik **Run** dan izinkan akses yang diminta. Jika baris 2 berisi data santri sekaligus header F:J, fungsi akan menyisipkan baris header baru agar data pertama tidak tertimpa. Fungsi juga melewati baris judul non-data, memperbaiki kode QR rusak, membuat ulang rumus QR/link, dan menampilkan `Kode QR` di kolom J. Kode valid, status, dan waktu check-in dipertahankan.
5. Muat ulang spreadsheet. Menu **Konsultasi Santri** akan muncul. Pilih **Cetak semua QR ke Google Docs** untuk membuat dokumen siap cetak; izinkan akses Docs/Drive dan koneksi internet saat diminta. Dokumen berisi 12 kartu per halaman (3 kolom × 4 baris), lengkap dengan QR, nama santri, kelas, dan kode unik. Jika memungkinkan dokumen disimpan di folder yang sama dengan spreadsheet; jika tidak, dokumen tetap tersedia di Drive Saya. Klik **Buka Google Docs**, lalu pilih **File → Print**.
6. Gunakan **Atur PIN petugas** untuk mengganti PIN bawaan `1234` sebelum kegiatan.
7. Setelah mengganti kode Apps Script, pilih **Deploy → Manage deployments**, tekan ikon pensil pada deployment Web App yang sudah ada, pilih **New version**, lalu **Deploy**. Dengan cara ini URL `/exec` biasanya tetap sama; gunakan URL yang sama yang sudah dipasang di halaman GitHub. Pastikan **Execute as: Me** dan **Who has access: Anyone**.

## B. Hubungkan halaman GitHub ke Apps Script

1. URL Web App yang kamu kirim sudah dipasang pada konstanta `API_URL` di `konsultasi.html`; tidak perlu menggantinya lagi.
2. Setelah deployment Apps Script diperbarui, buka halaman GitHub Pages: `/konsultasi.html?mode=hp` untuk HP pemindai atau `/konsultasi.html?mode=layar` untuk proyektor.

Video latar memakai aset `latar-kepulangan.mp4` yang ada di root repositori. Logo putih Masjid As-Shidqu sudah ditanam langsung di `konsultasi.html`, sehingga tidak membutuhkan file logo eksternal.

## Status hasil scan

- QR valid pertama: kolom F menjadi `SUDAH DISCAN/DIPAKAI`, kolom G mencatat waktu pertama, layar hijau menampilkan Bpk, Ibu, nama santri, alamat, kelas, serta `SILAHKAN MASUK`.
- Scan ulang: tampilan kuning `SUDAH DISCAN/DIPAKAI`, identitas tetap tampil, waktu pertama tidak diubah.
- Kode QR tidak terdaftar: tampilan merah `QR TIDAK TERDAFTAR` akan muncul di HP dan proyektor. Layar proyektor memakai ID terakhir saat login sebagai baseline agar scan baru—termasuk kode tidak terdaftar—tetap ditampilkan.

Pemindaian QR menggunakan kode unik `KS-...`, bukan nama yang tercetak. Ini menghindari bentrok bila ada nama santri yang sama. Kolom J `Kode QR` ditampilkan di sisi paling kanan untuk memudahkan pemeriksaan manual.

## Catatan

Jam dan perkiraan waktu salat tampil pada mode proyektor, dihitung di browser tanpa request tambahan ke Apps Script. Perkiraan jadwal menggunakan koordinat Sampora, Cilimus, Kuningan dan Asar Syafi'i; cocokkan dengan jadwal resmi pesantren. QR di sheet menggunakan layanan QR eksternal `api.qrserver.com`, sehingga membuat atau menampilkan gambar QR membutuhkan koneksi internet.