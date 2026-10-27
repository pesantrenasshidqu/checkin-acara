# Checkin Konsultasi Santri — Petunjuk pemasangan

Sistem ini terpisah dari check-in acara dan kepulangan. Halaman GitHub menggunakan `konsultasi.html`; backend memakai Apps Script yang diikat ke spreadsheet konsultasi.

## Struktur spreadsheet

Tab yang dipakai: `Sheet1`. Data dimulai baris 4:

- A: Nama Santri
- B: Ayah
- C: Ibu
- D: Alamat
- E: Kelas
- F: Status (dibuat otomatis)
- G: Waktu Check-in (dibuat otomatis)
- H: QR (dibuat otomatis)
- I: Link QR (dibuat otomatis)
- J: kode internal unik (dibuat otomatis dan disembunyikan)

Jangan isi manual kolom F:J setelah menjalankan persiapan, kecuali memang sedang memperbaiki data. Jika tab bukan bernama `Sheet1`, ubah `SHEET_NAME` pada `Code.gs` sesuai nama tab.

## A. Pasang backend Apps Script

1. Buka spreadsheet konsultasi yang benar.
2. Pilih **Extensions → Apps Script** agar project terikat ke spreadsheet konsultasi, bukan ke spreadsheet check-in lama.
3. Ganti isi `Code.gs` dengan isi folder `apps-script/Code.gs`, lalu simpan.
4. Pilih fungsi `siapkanKonsultasiSantri` lalu klik **Run** dan izinkan akses yang diminta. Fungsi ini menambahkan kolom F:I, menghasilkan kode unik tersembunyi di J, dan membuat rumus QR/link.
5. Muat ulang spreadsheet. Menu **Konsultasi Santri** akan muncul. Gunakan **Atur PIN petugas** untuk mengganti PIN bawaan `1234` sebelum kegiatan.
6. Klik **Deploy → New deployment → Web app**. Atur **Execute as: Me** dan **Who has access: Anyone**, lalu Deploy. Salin URL Web App yang berakhiran `/exec`.

## B. Hubungkan halaman GitHub ke Apps Script

1. Buka `konsultasi.html` di GitHub.
2. Pada konstanta `API_URL`, ganti `TEMPEL_URL_WEB_APP_APPS_SCRIPT_DI_SINI` dengan URL Web App `/exec` dari langkah A.
3. Commit perubahan ke branch dan merge ke `main` setelah memeriksa perubahannya.
4. Buka halaman GitHub Pages yang sama dengan sistem lama, lalu tambahkan `/konsultasi.html?mode=hp` untuk HP pemindai atau `/konsultasi.html?mode=layar` untuk proyektor.

Video `latar-kepulangan.mp4` dan logo `logo-masjid-as-shidqu-white.png` memakai nama file yang sama dengan aset yang ada di root repositori.

## Status hasil scan

- QR valid pertama: kolom F menjadi `SUDAH DISCAN/DIPAKAI`, kolom G mencatat waktu pertama, layar hijau menampilkan Bpk, Ibu, nama santri, alamat, kelas, serta `SILAHKAN MASUK`.
- Scan ulang: tampilan kuning `SUDAH DISCAN/DIPAKAI`, identitas tetap tampil, waktu pertama tidak diubah.
- Kode QR tidak terdaftar: tampilan merah `QR TIDAK TERDAFTAR`.

Pemindaian QR menggunakan kode unik internal, bukan nama yang tercetak. Ini menghindari bentrok bila ada nama santri yang sama. Kolom J disembunyikan sehingga urutan kolom terlihat sesuai permintaan.

## Catatan

Jam dan perkiraan waktu salat tampil pada mode proyektor, dihitung di browser tanpa request tambahan ke Apps Script. Perkiraan jadwal menggunakan koordinat Sampora, Cilimus, Kuningan dan Asar Syafi'i; cocokkan dengan jadwal resmi pesantren. QR di sheet menggunakan layanan QR eksternal `api.qrserver.com`, sehingga membuat atau menampilkan gambar QR membutuhkan koneksi internet.