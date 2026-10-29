/**
 * CHECKIN KONSULTASI SANTRI
 * Diikat (bound) pada Google Sheet konsultasi.
 * A: Nama Santri, B: Ayah, C: Ibu, D: Alamat, E: Kelas.
 * F: Status, G: Waktu Check-in, H: QR, I: Link QR, J: Kode QR (terlihat di kolom terakhir).
 */
const KS = Object.freeze({
  SHEET_NAME: 'Sheet1',
  HEADER_ROW: 2,
  SUBHEADER_ROW: 3,
  DATA_START_ROW: 4,
  COL_SANTRI: 1,
  COL_AYAH: 2,
  COL_IBU: 3,
  COL_ALAMAT: 4,
  COL_KELAS: 5,
  COL_STATUS: 6,
  COL_WAKTU: 7,
  COL_QR: 8,
  COL_LINK: 9,
  COL_KODE: 10,
  PIN_KEY: 'PIN_KONSULTASI_SANTRI',
  SPREADSHEET_KEY: 'ID_SHEET_KONSULTASI_SANTRI',
  CACHE_LAST_KEY: 'KONSULTASI_TERAKHIR',
  QR_BASE: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=',
  HALAQOH_SHEET_NAME: 'Permohonan Halaqoh',
  HALAQOH_DATA_START_ROW: 2,
  HALAQOH_COL_SANTRI: 3,
  HALAQOH_COL_KELAS: 4,
  HALAQOH_COL_SIAPA: 5,
  HALAQOH_COL_WAKTU_FORM: 6,
  HALAQOH_COL_LOKASI: 7,
  HALAQOH_COL_PERTANYAAN: 8,
  HALAQOH_COL_STATUS: 9,
  HALAQOH_COL_WAKTU_SCAN: 10,
  HALAQOH_COL_QR: 11,
  HALAQOH_COL_LINK: 12,
  HALAQOH_COL_KODE: 13
});

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Konsultasi Santri')
    .addItem('1. Siapkan kolom, kode, dan QR Kunjungan', 'siapkanKonsultasiSantri')
    .addItem('2. Siapkan data Halaqoh & QR', 'siapkanDataHalaqoh')
    .addItem('Cetak semua QR Kunjungan ke Google Docs', 'buatDokumenCetakQRSantri')
    .addItem('Cetak semua QR Halaqoh ke Google Docs', 'buatDokumenCetakQRHalaqoh')
    .addItem('Atur PIN petugas', 'aturPinKonsultasiSantri')
    .addSeparator()
    .addItem('Reset status scan (sebelum acara)', 'resetKonsultasiSantri')
    .addToUi();
}

/** Menyiapkan kolom F:J dan QR. Aman dijalankan ulang: kode valid, status, dan waktu dipertahankan. */
function siapkanKonsultasiSantri() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Buka Apps Script dari spreadsheet konsultasi melalui Extensions > Apps Script.');
  const sh = ss.getSheetByName(KS.SHEET_NAME);
  if (!sh) throw new Error('Tab sheet bernama "' + KS.SHEET_NAME + '" tidak ditemukan. Sesuaikan KS.SHEET_NAME bila nama tab berbeda.');
  PropertiesService.getScriptProperties().setProperty(KS.SPREADSHEET_KEY, ss.getId());
  if (sh.getMaxColumns() < KS.COL_KODE) sh.insertColumnsAfter(sh.getMaxColumns(), KS.COL_KODE - sh.getMaxColumns());

  // Jika baris 2 berisi santri, jangan menimpa kolom F:J pada baris yang sama dengan header.
  // Sisipkan baris header baru agar data pertama tetap utuh.
  ksPerbaikiHeaderBertabrakan_(sh);

  sh.getRange(KS.HEADER_ROW, KS.COL_STATUS, 1, 5)
    .setValues([['Status', 'Waktu Check-in', 'QR', 'Link QR', 'Kode QR']])
    .setBackground('#075E45').setFontColor('#FFFFFF').setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
  const last = sh.getLastRow();
  const first = ksCariBarisDataPertama_(sh);
  sh.showColumns(KS.COL_KODE);
  sh.setColumnWidth(KS.COL_STATUS, 185);
  sh.setColumnWidth(KS.COL_WAKTU, 165);
  sh.setColumnWidth(KS.COL_QR, 110);
  sh.setColumnWidth(KS.COL_LINK, 360);
  sh.setColumnWidth(KS.COL_KODE, 205);
  sh.setRowHeight(KS.HEADER_ROW, 32);
  sh.setRowHeight(KS.SUBHEADER_ROW, 22);

  // Bersihkan hanya kolom F:J pada baris subjudul di atas santri pertama.
  // Jangan pernah membersihkan kolom status pada baris santri pertama.
  const barisSetelahHeader = KS.HEADER_ROW + 1;
  if (first > barisSetelahHeader) {
    sh.getRange(barisSetelahHeader, KS.COL_STATUS, first - barisSetelahHeader, 5).clearContent();
    for (let rr = barisSetelahHeader; rr < first; rr++) sh.setRowHeight(rr, 30);
  }
  if (first > last) {
    ss.toast('Kolom konsultasi disiapkan. Pastikan nama santri, ayah/ibu, dan kelas telah terisi.', 'Konsultasi Santri', 7);
    return;
  }

  const n = last - first + 1;
  const rows = sh.getRange(first, 1, n, KS.COL_KODE).getValues();
  const oldQrFormulas = sh.getRange(first, KS.COL_QR, n, 1).getFormulas();
  const oldLinkFormulas = sh.getRange(first, KS.COL_LINK, n, 1).getFormulas();
  const reserved = new Set();
  rows.forEach(r => {
    const code = String(r[KS.COL_KODE - 1] || '').trim().toUpperCase();
    if (ksAdalahBarisSantri_(r) && /^KS-[A-Z0-9]{12}$/.test(code)) reserved.add(code);
  });
  const used = new Set();
  const statusValues = [], waktuValues = [], codeValues = [], qrFormulas = [], linkFormulas = [];
  let dibuat = 0, diperbaiki = 0;

  rows.forEach((r, i) => {
    const isStudent = ksAdalahBarisSantri_(r);
    const rowNumber = first + i;
    if (isStudent) {
      let code = String(r[KS.COL_KODE - 1] || '').trim().toUpperCase();
      if (!/^KS-[A-Z0-9]{12}$/.test(code) || used.has(code)) {
        const invalid = !!code;
        do { code = 'KS-' + Utilities.getUuid().replace(/-/g, '').substring(0, 12).toUpperCase(); }
        while (reserved.has(code) || used.has(code));
        reserved.add(code);
        if (invalid) diperbaiki++; else dibuat++;
      }
      used.add(code);
      statusValues.push([String(r[KS.COL_STATUS - 1] || '').trim() || 'BELUM']);
      waktuValues.push([r[KS.COL_WAKTU - 1] || '']);
      codeValues.push([code]);
      qrFormulas.push(['=IMAGE("' + KS.QR_BASE + '"&ENCODEURL($J' + rowNumber + '))']);
      linkFormulas.push(['="' + KS.QR_BASE + '"&ENCODEURL($J' + rowNumber + ')']);
    } else {
      statusValues.push([r[KS.COL_STATUS - 1] || '']);
      waktuValues.push([r[KS.COL_WAKTU - 1] || '']);
      codeValues.push([r[KS.COL_KODE - 1] || '']);
      qrFormulas.push([oldQrFormulas[i][0] || '']);
      linkFormulas.push([oldLinkFormulas[i][0] || '']);
    }
  });

  sh.getRange(first, KS.COL_STATUS, n, 1).setValues(statusValues);
  sh.getRange(first, KS.COL_WAKTU, n, 1).setValues(waktuValues).setNumberFormat('dd/MM/yyyy HH:mm:ss');
  sh.getRange(first, KS.COL_QR, n, 1).setFormulas(qrFormulas);
  sh.getRange(first, KS.COL_LINK, n, 1).setFormulas(linkFormulas);
  sh.getRange(first, KS.COL_KODE, n, 1).setValues(codeValues);

  // Ratakan format data F:J. Format lama pada baris pertama sempat membuat nilai BELUM/kode/link tidak terlihat.
  const dataOutput = sh.getRange(first, KS.COL_STATUS, n, 5);
  dataOutput.setFontColor('#111827')
    .setBackground('#FFFFFF')
    .setVerticalAlignment('middle')
    .setWrap(true);
  sh.setRowHeights(first, n, 96);
  sh.getRange(first, KS.COL_STATUS, n, 1)
    .setHorizontalAlignment('center')
    .setFontWeight('bold');
  sh.getRange(first, KS.COL_WAKTU, n, 1)
    .setHorizontalAlignment('center')
    .setNumberFormat('dd/MM/yyyy HH:mm:ss');
  sh.getRange(first, KS.COL_QR, n, 1)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sh.getRange(first, KS.COL_LINK, n, 1)
    .setHorizontalAlignment('left')
    .setFontColor('#1155CC');
  sh.getRange(first, KS.COL_KODE, n, 1)
    .setFontFamily('Roboto Mono')
    .setFontSize(9)
    .setHorizontalAlignment('center')
    .setFontWeight('bold');
  SpreadsheetApp.flush();
  ss.toast('QR diperbarui. ' + dibuat + ' kode dibuat, ' + diperbaiki + ' kode rusak diperbaiki. Kolom Kode QR terlihat di kolom terakhir.', 'Konsultasi Santri', 9);
}


/**
 * Menyiapkan kolom status, waktu scan, QR, tautan dan kode unik pada tab Permohonan Halaqoh.
 * Data form A:H tidak diubah. Kode HQ- dipakai khusus untuk membedakan Halaqoh dari Kunjungan (KS-).
 */
function siapkanDataHalaqoh() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Buka Apps Script dari spreadsheet utama melalui Extensions > Apps Script.');
  const sh = ss.getSheetByName(KS.HALAQOH_SHEET_NAME);
  if (!sh) throw new Error('Tab "' + KS.HALAQOH_SHEET_NAME + '" belum ada. Impor tab tersebut ke spreadsheet utama terlebih dahulu.');
  PropertiesService.getScriptProperties().setProperty(KS.SPREADSHEET_KEY, ss.getId());
  if (sh.getMaxColumns() < KS.HALAQOH_COL_KODE) {
    sh.insertColumnsAfter(sh.getMaxColumns(), KS.HALAQOH_COL_KODE - sh.getMaxColumns());
  }

  sh.getRange(1, KS.HALAQOH_COL_STATUS, 1, 5)
    .setValues([['Status Check-in', 'Waktu Check-in', 'QR', 'Link QR', 'Kode QR']])
    .setBackground('#075E45').setFontColor('#FFFFFF').setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);

  const last = sh.getLastRow();
  if (last < KS.HALAQOH_DATA_START_ROW) {
    ss.toast('Tab Halaqoh siap. Belum ada pengajuan untuk dibuatkan QR.', 'Konsultasi Santri', 7);
    return;
  }

  const n = last - KS.HALAQOH_DATA_START_ROW + 1;
  const rows = sh.getRange(KS.HALAQOH_DATA_START_ROW, 1, n, KS.HALAQOH_COL_KODE).getValues();
  const reserved = new Set();
  rows.forEach(function(r) {
    const code = String(r[KS.HALAQOH_COL_KODE - 1] || '').trim().toUpperCase();
    if (String(r[KS.HALAQOH_COL_SANTRI - 1] || '').trim() && /^HQ-[A-Z0-9]{12}$/.test(code)) reserved.add(code);
  });

  const used = new Set();
  const status = [], waktu = [], codes = [], qr = [], links = [];
  let made = 0;
  rows.forEach(function(r, i) {
    const student = String(r[KS.HALAQOH_COL_SANTRI - 1] || '').trim();
    const rowNo = KS.HALAQOH_DATA_START_ROW + i;
    if (!student) {
      status.push([r[KS.HALAQOH_COL_STATUS - 1] || '']);
      waktu.push([r[KS.HALAQOH_COL_WAKTU_SCAN - 1] || '']);
      codes.push([r[KS.HALAQOH_COL_KODE - 1] || '']);
      qr.push(['']);
      links.push(['']);
      return;
    }
    let code = String(r[KS.HALAQOH_COL_KODE - 1] || '').trim().toUpperCase();
    if (!/^HQ-[A-Z0-9]{12}$/.test(code) || used.has(code)) {
      do { code = 'HQ-' + Utilities.getUuid().replace(/-/g, '').substring(0, 12).toUpperCase(); }
      while (reserved.has(code) || used.has(code));
      reserved.add(code);
      made++;
    }
    used.add(code);
    status.push([String(r[KS.HALAQOH_COL_STATUS - 1] || '').trim() || 'BELUM']);
    waktu.push([r[KS.HALAQOH_COL_WAKTU_SCAN - 1] || '']);
    codes.push([code]);
    qr.push(['=IMAGE("' + KS.QR_BASE + '"&ENCODEURL($M' + rowNo + '))']);
    links.push(['="' + KS.QR_BASE + '"&ENCODEURL($M' + rowNo + ')']);
  });

  sh.getRange(KS.HALAQOH_DATA_START_ROW, KS.HALAQOH_COL_STATUS, n, 1).setValues(status);
  sh.getRange(KS.HALAQOH_DATA_START_ROW, KS.HALAQOH_COL_WAKTU_SCAN, n, 1).setValues(waktu).setNumberFormat('dd/MM/yyyy HH:mm:ss');
  sh.getRange(KS.HALAQOH_DATA_START_ROW, KS.HALAQOH_COL_QR, n, 1).setFormulas(qr);
  sh.getRange(KS.HALAQOH_DATA_START_ROW, KS.HALAQOH_COL_LINK, n, 1).setFormulas(links);
  sh.getRange(KS.HALAQOH_DATA_START_ROW, KS.HALAQOH_COL_KODE, n, 1).setValues(codes);

  const output = sh.getRange(KS.HALAQOH_DATA_START_ROW, KS.HALAQOH_COL_STATUS, n, 5);
  output.setFontColor('#111827').setBackground('#FFFFFF').setVerticalAlignment('middle').setWrap(true);
  sh.setColumnWidth(KS.HALAQOH_COL_STATUS, 175);
  sh.setColumnWidth(KS.HALAQOH_COL_WAKTU_SCAN, 165);
  sh.setColumnWidth(KS.HALAQOH_COL_QR, 110);
  sh.setColumnWidth(KS.HALAQOH_COL_LINK, 360);
  sh.setColumnWidth(KS.HALAQOH_COL_KODE, 180);
  sh.setRowHeight(1, 36);
  sh.setRowHeights(KS.HALAQOH_DATA_START_ROW, n, 78);
  sh.getRange(KS.HALAQOH_DATA_START_ROW, KS.HALAQOH_COL_STATUS, n, 1).setHorizontalAlignment('center');
  sh.getRange(KS.HALAQOH_DATA_START_ROW, KS.HALAQOH_COL_QR, n, 1).setHorizontalAlignment('center');
  sh.getRange(KS.HALAQOH_DATA_START_ROW, KS.HALAQOH_COL_KODE, n, 1).setFontFamily('Roboto Mono').setFontSize(9).setHorizontalAlignment('center');
  SpreadsheetApp.flush();
  ss.toast('Data Halaqoh siap. ' + made + ' kode QR baru dibuat; kode lama yang valid dipertahankan.', 'Konsultasi Santri', 8);
}

/** Web App API: GET untuk diagnostik; transaksi memakai POST. */
function doGet() {
  return ksJson_({ sistem: 'Checkin Konsultasi Santri', status: 'ONLINE', pesan: 'Web App aktif. Gunakan halaman GitHub untuk scan.' });
}

function doPost(e) {
  try {
    const d = JSON.parse(e && e.postData && e.postData.contents ? e.postData.contents : '{}');
    let result;
    if (d.aksi === 'cek') result = cekKonsultasiSantri_(d.kode, d.pin);
    else if (d.aksi === 'terakhir') result = ambilKonsultasiTerakhir_(d.pin);
    else if (d.aksi === 'ping') result = cekPinDanRingkasan_(d.pin);
    else result = { status: 'ERROR', pesan: 'Aksi tidak dikenal.' };
    return ksJson_(result);
  } catch (err) {
    return ksJson_({ status: 'ERROR', pesan: String(err && err.message ? err.message : err) });
  }
}

function cekPinDanRingkasan_(pin) {
  if (!ksPinValid_(pin)) return { status: 'PIN_SALAH' };
  const raw = CacheService.getScriptCache().get(KS.CACHE_LAST_KEY);
  let terakhirId = '';
  if (raw) { try { terakhirId = String(JSON.parse(raw).id || ''); } catch (e) {} }
  return Object.assign({ status: 'IDLE', terakhirId: terakhirId }, ksRingkasan_());
}

function cekKonsultasiSantri_(kode, pin) {
  if (!ksPinValid_(pin)) return { status: 'PIN_SALAH' };
  kode = String(kode || '').trim().toUpperCase();
  if (!kode) return Object.assign({ status: 'IDLE' }, ksRingkasan_());
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    if (kode.indexOf('HQ-') === 0) return ksCekHalaqoh_(kode);
    const sh = ksSheet_();
    const last = sh.getLastRow(), first = ksCariBarisDataPertama_(sh);
    if (first > last) return ksSimpanEvent_(Object.assign({ status:'PALSU', kode:kode, pesan:'QR tidak terdaftar.' }, ksRingkasan_()));
    const n = last - first + 1;
    const rows = sh.getRange(first, 1, n, KS.COL_KODE).getValues();
    const idx = rows.findIndex(r => ksAdalahBarisSantri_(r) && String(r[KS.COL_KODE - 1] || '').trim().toUpperCase() === kode);
    if (idx < 0) {
      return ksSimpanEvent_(Object.assign({ status:'PALSU', kode:kode, pesan:'QR tidak terdaftar.' }, ksRingkasanDariRows_(rows)));
    }
    const r = rows[idx], rowNo = first + idx;
    const statusLama = String(r[KS.COL_STATUS - 1] || '').trim().toUpperCase();
    const sudah = statusLama.indexOf('SUDAH DISCAN') >= 0 || statusLama.indexOf('DIPAKAI') >= 0 || statusLama === 'SUDAH';
    const info = {
      kode: kode,
      santri: String(r[KS.COL_SANTRI - 1] || '').trim(),
      ayah: String(r[KS.COL_AYAH - 1] || '').trim(),
      ibu: String(r[KS.COL_IBU - 1] || '').trim(),
      alamat: String(r[KS.COL_ALAMAT - 1] || '').trim(),
      kelas: String(r[KS.COL_KELAS - 1] || '').trim()
    };
    let waktu = r[KS.COL_WAKTU - 1];
    if (!sudah) {
      const now = new Date();
      sh.getRange(rowNo, KS.COL_STATUS).setValue('SUDAH DISCAN/DIPAKAI');
      if (!(waktu instanceof Date) && !String(waktu || '').trim()) {
        sh.getRange(rowNo, KS.COL_WAKTU).setValue(now).setNumberFormat('dd/MM/yyyy HH:mm:ss');
        waktu = now;
      }
    }
    const waktuTeks = waktu instanceof Date
      ? Utilities.formatDate(waktu, Session.getScriptTimeZone() || 'Asia/Jakarta', 'dd/MM/yyyy HH:mm:ss')
      : String(waktu || '-');
    return ksSimpanEvent_(Object.assign({ status:sudah ? 'SUDAH' : 'VALID', waktu:waktuTeks }, info, ksRingkasan_()));
  } finally {
    lock.releaseLock();
  }
}

function ambilKonsultasiTerakhir_(pin) {
  if (!ksPinValid_(pin)) return { status: 'PIN_SALAH' };
  const raw = CacheService.getScriptCache().get(KS.CACHE_LAST_KEY);
  return raw ? JSON.parse(raw) : { status: 'KOSONG' };
}

function ksSimpanEvent_(result) {
  result.id = String(Date.now()) + '-' + Utilities.getUuid().substring(0, 8);
  result.dibuat = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Jakarta', 'dd/MM/yyyy HH:mm:ss');
  CacheService.getScriptCache().put(KS.CACHE_LAST_KEY, JSON.stringify(result), 21600);
  return result;
}

function ksPerbaikiHeaderBertabrakan_(sh) {
  const calonSantri = sh.getRange(KS.HEADER_ROW, 1, 1, 5).getDisplayValues()[0];
  if (!ksAdalahBarisSantri_(calonSantri)) return;

  const nilaiFGHIJ = sh.getRange(KS.HEADER_ROW, KS.COL_STATUS, 1, 5).getDisplayValues()[0];
  sh.insertRowBefore(KS.HEADER_ROW);
  sh.getRange(KS.HEADER_ROW, 1, 1, KS.COL_KODE).breakApart();
  // Header ditaruh di baris 2 yang baru; data pertama bergeser aman ke baris 3.
  sh.getRange(KS.HEADER_ROW, KS.COL_STATUS, 1, 5)
    .setValues([['Status', 'Waktu Check-in', 'QR', 'Link QR', 'Kode QR']]);

  // Hilangkan hanya teks header yang sempat menimpa area F:J pada santri pertama.
  const label = ['STATUS', 'WAKTU CHECK-IN', 'QR', 'LINK QR', 'KODE QR', 'KODE INTERNAL'];
  nilaiFGHIJ.forEach((v, i) => {
    if (label.indexOf(String(v || '').trim().toUpperCase()) >= 0) {
      sh.getRange(KS.HEADER_ROW + 1, KS.COL_STATUS + i).clearContent();
    }
  });
}

function ksCariBarisDataPertama_(sh) {
  const last = sh.getLastRow();
  const start = KS.HEADER_ROW; // Lewati judul di baris 1, tetapi izinkan data mulai baris 2 atau 3.
  if (last < start) return last + 1;
  const vals = sh.getRange(start, 1, last - start + 1, 5).getDisplayValues();
  for (let i = 0; i < vals.length; i++) if (ksAdalahBarisSantri_(vals[i])) return start + i;
  return last + 1;
}

function ksAdalahBarisSantri_(r) {
  const santri = String(r[KS.COL_SANTRI - 1] || '').trim();
  const ayah = String(r[KS.COL_AYAH - 1] || '').trim();
  const ibu = String(r[KS.COL_IBU - 1] || '').trim();
  const alamat = String(r[KS.COL_ALAMAT - 1] || '').trim();
  const kelas = String(r[KS.COL_KELAS - 1] || '').trim();
  if (!santri || !(ayah || ibu) || !(alamat || kelas)) return false;
  return !/^(NAMA SANTRI|DATA KONSULTASI|ORANG TUA|KODE QR|KODE INTERNAL)$/i.test(santri);
}


/** Scan khusus Halaqoh. Dipanggil dari dalam lock agar kunjungan dan Halaqoh tidak memproses QR bersamaan. */
function ksCekHalaqoh_(kode) {
  const sh = ksHalaqohSheet_();
  if (!sh) return ksSimpanEvent_({ status:'ERROR', kode:kode, pesan:'Tab "' + KS.HALAQOH_SHEET_NAME + '" belum tersedia. Tambahkan tab dan jalankan siapkanDataHalaqoh().' });
  const last = sh.getLastRow();
  if (last < KS.HALAQOH_DATA_START_ROW) return ksSimpanEvent_(Object.assign({status:'PALSU', kode:kode, pesan:'QR Halaqoh tidak terdaftar.'}, ksRingkasan_()));
  const n = last - KS.HALAQOH_DATA_START_ROW + 1;
  const rows = sh.getRange(KS.HALAQOH_DATA_START_ROW, 1, n, KS.HALAQOH_COL_KODE).getValues();
  const idx = rows.findIndex(function(r) {
    return String(r[KS.HALAQOH_COL_SANTRI - 1] || '').trim() &&
      String(r[KS.HALAQOH_COL_KODE - 1] || '').trim().toUpperCase() === kode;
  });
  if (idx < 0) return ksSimpanEvent_(Object.assign({status:'PALSU', kode:kode, pesan:'QR Halaqoh tidak terdaftar.'}, ksRingkasan_()));

  const r = rows[idx], rowNo = KS.HALAQOH_DATA_START_ROW + idx;
  const oldStatus = String(r[KS.HALAQOH_COL_STATUS - 1] || '').trim().toUpperCase();
  const sudah = oldStatus.indexOf('SUDAH DISCAN') >= 0 || oldStatus.indexOf('DIPAKAI') >= 0 || oldStatus === 'SUDAH';
  const info = {
    jenis: 'HALAQOH',
    kode: kode,
    santri: String(r[KS.HALAQOH_COL_SANTRI - 1] || '').trim(),
    kelas: String(r[KS.HALAQOH_COL_KELAS - 1] || '').trim(),
    siapaKonsultasi: String(r[KS.HALAQOH_COL_SIAPA - 1] || '').trim(),
    lokasiKonsultasi: String(r[KS.HALAQOH_COL_LOKASI - 1] || '').trim(),
    pertanyaan: String(r[KS.HALAQOH_COL_PERTANYAAN - 1] || '').trim(),
    waktuKonsultasi: '08:00 - 09:00 WIB'
  };
  let waktu = r[KS.HALAQOH_COL_WAKTU_SCAN - 1];
  if (!sudah) {
    const now = new Date();
    sh.getRange(rowNo, KS.HALAQOH_COL_STATUS).setValue('SUDAH DISCAN/DIPAKAI');
    if (!(waktu instanceof Date) && !String(waktu || '').trim()) {
      sh.getRange(rowNo, KS.HALAQOH_COL_WAKTU_SCAN).setValue(now).setNumberFormat('dd/MM/yyyy HH:mm:ss');
      waktu = now;
    }
  }
  const waktuTeks = waktu instanceof Date
    ? Utilities.formatDate(waktu, Session.getScriptTimeZone() || 'Asia/Jakarta', 'dd/MM/yyyy HH:mm:ss')
    : String(waktu || '-');
  return ksSimpanEvent_(Object.assign({status:sudah ? 'SUDAH' : 'VALID', waktu:waktuTeks}, info, ksRingkasan_()));
}

function ksHalaqohSheet_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty(KS.SPREADSHEET_KEY);
  const ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  return ss ? ss.getSheetByName(KS.HALAQOH_SHEET_NAME) : null;
}

function ksRingkasanHalaqoh_() {
  const sh = ksHalaqohSheet_();
  if (!sh) return {total:0, dipakai:0};
  const last = sh.getLastRow();
  if (last < KS.HALAQOH_DATA_START_ROW) return {total:0, dipakai:0};
  const rows = sh.getRange(KS.HALAQOH_DATA_START_ROW, 1, last - KS.HALAQOH_DATA_START_ROW + 1, KS.HALAQOH_COL_STATUS).getValues();
  let total = 0, dipakai = 0;
  rows.forEach(function(r) {
    if (!String(r[KS.HALAQOH_COL_SANTRI - 1] || '').trim()) return;
    total++;
    const st = String(r[KS.HALAQOH_COL_STATUS - 1] || '').toUpperCase();
    if (st.indexOf('SUDAH DISCAN') >= 0 || st.indexOf('DIPAKAI') >= 0 || st === 'SUDAH') dipakai++;
  });
  return {total:total, dipakai:dipakai};
}

function ksRingkasan_() {
  const sh = ksSheet_(), last = sh.getLastRow(), first = ksCariBarisDataPertama_(sh);
  let kunjungan = {total:0, dipakai:0};
  if (first <= last) {
    const rows = sh.getRange(first, 1, last - first + 1, KS.COL_STATUS).getValues();
    kunjungan = ksRingkasanDariRows_(rows);
  }
  const h = ksRingkasanHalaqoh_();
  return {
    total: kunjungan.total + h.total,
    dipakai: kunjungan.dipakai + h.dipakai,
    totalKunjungan: kunjungan.total,
    dipakaiKunjungan: kunjungan.dipakai,
    totalHalaqoh: h.total,
    dipakaiHalaqoh: h.dipakai
  };
}

function ksRingkasanDariRows_(rows) {
  let total = 0, dipakai = 0;
  rows.forEach(r => {
    if (!ksAdalahBarisSantri_(r)) return;
    total++;
    const st = String(r[KS.COL_STATUS - 1] || '').toUpperCase();
    if (st.indexOf('SUDAH DISCAN') >= 0 || st.indexOf('DIPAKAI') >= 0 || st === 'SUDAH') dipakai++;
  });
  return { total:total, dipakai:dipakai };
}


/**
 * Membuat Google Docs siap cetak untuk semua QR Halaqoh.
 * Membaca tab Permohonan Halaqoh, kolom C (nama), D (kelas), G (lokasi),
 * dan M (kode HQ). Tidak mengubah status atau waktu scan.
 */
function buatDokumenCetakQRHalaqoh() {
  const ui = SpreadsheetApp.getUi();
  const sh = ksHalaqohSheet_();
  if (!sh) {
    ui.alert('Tab Halaqoh belum tersedia', 'Buat/salin tab "Permohonan Halaqoh" ke spreadsheet ini, lalu jalankan menu Konsultasi Santri → Siapkan data Halaqoh & QR.', ui.ButtonSet.OK);
    return;
  }

  const first = KS.HALAQOH_DATA_START_ROW;
  const last = sh.getLastRow();
  if (last < first) {
    ui.alert('Belum ada data Halaqoh', 'Tab Permohonan Halaqoh belum berisi pengajuan.', ui.ButtonSet.OK);
    return;
  }

  const rows = sh.getRange(first, 1, last - first + 1, KS.HALAQOH_COL_KODE).getDisplayValues();
  const santri = [];
  const seen = new Set();
  rows.forEach(function(r, i) {
    const nama = String(r[KS.HALAQOH_COL_SANTRI - 1] || '').trim();
    if (!nama) return;
    const code = String(r[KS.HALAQOH_COL_KODE - 1] || '').trim().toUpperCase();
    if (!/^HQ-[A-Z0-9]{12}$/.test(code)) {
      throw new Error('Kode QR Halaqoh belum valid untuk "' + nama + '" pada baris ' + (first + i) +
        '. Jalankan Konsultasi Santri → Siapkan data Halaqoh & QR terlebih dahulu.');
    }
    if (seen.has(code)) throw new Error('Kode QR Halaqoh ganda ditemukan: ' + code + '. Perbaiki duplikasi sebelum mencetak.');
    seen.add(code);
    santri.push({
      nama: nama,
      kelas: String(r[KS.HALAQOH_COL_KELAS - 1] || '').trim(),
      siapa: String(r[KS.HALAQOH_COL_SIAPA - 1] || '').trim(),
      lokasi: String(r[KS.HALAQOH_COL_LOKASI - 1] || '').trim(),
      kode: code
    });
  });

  if (!santri.length) {
    ui.alert('Belum ada data Halaqoh', 'Tidak ditemukan pengajuan dengan nama santri yang valid.', ui.ButtonSet.OK);
    return;
  }

  const blobs = [];
  const BATCH = 18;
  for (let start = 0; start < santri.length; start += BATCH) {
    const batch = santri.slice(start, start + BATCH);
    const requests = batch.map(function(s) {
      return { url: KS.QR_BASE + encodeURIComponent(s.kode), muteHttpExceptions: true };
    });
    let responses;
    try {
      responses = UrlFetchApp.fetchAll(requests);
    } catch (err) {
      throw new Error('Gagal mengambil gambar QR Halaqoh. Periksa koneksi internet, lalu coba lagi. Detail: ' + err.message);
    }
    responses.forEach(function(response, j) {
      if (response.getResponseCode() !== 200 || !/^image\//i.test(String(response.getHeaders()['Content-Type'] || ''))) {
        throw new Error('Gambar QR gagal dibuat untuk kode ' + batch[j].kode + '. Coba lagi setelah koneksi stabil.');
      }
      blobs.push(response.getBlob().setName('QR-' + batch[j].kode + '.png'));
    });
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tanggal = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd-MM-yyyy HH.mm');
  const doc = DocumentApp.create('QR Halaqoh - ' + tanggal);
  const body = doc.getBody();
  body.setMarginTop(24).setMarginBottom(24).setMarginLeft(24).setMarginRight(24);

  const PER_HALAMAN = 12;
  for (let pageStart = 0; pageStart < santri.length; pageStart += PER_HALAMAN) {
    if (pageStart > 0) body.appendPageBreak();

    const pJudul = body.appendParagraph('CHECK-IN HALAQOH SANTRI');
    pJudul.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    pJudul.setSpacingBefore(0).setSpacingAfter(2);
    pJudul.editAsText().setFontFamily('Arial').setFontSize(15).setBold(true).setForegroundColor('#075E45');

    const pInfo = body.appendParagraph('Kartu QR Halaqoh • ' + santri.length + ' pengajuan • ' + tanggal);
    pInfo.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    pInfo.setSpacingBefore(0).setSpacingAfter(8);
    pInfo.editAsText().setFontFamily('Arial').setFontSize(8).setForegroundColor('#475569');

    const slots = [];
    for (let rr = 0; rr < 4; rr++) slots.push(['', '', '']);
    const table = body.appendTable(slots);
    table.setBorderWidth(0.75);
    table.setBorderColor('#CBD5E1');

    for (let offset = 0; offset < PER_HALAMAN; offset++) {
      const pos = pageStart + offset;
      if (pos >= santri.length) break;
      const rowIndex = Math.floor(offset / 3);
      const colIndex = offset % 3;
      const cell = table.getCell(rowIndex, colIndex);
      cell.clear();
      cell.setBackgroundColor('#FFFFFF')
        .setVerticalAlignment(DocumentApp.VerticalAlignment.MIDDLE)
        .setPaddingTop(5).setPaddingBottom(5)
        .setPaddingLeft(4).setPaddingRight(4);

      const pJenis = cell.appendParagraph('HALAQOH');
      pJenis.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      pJenis.setSpacingBefore(0).setSpacingAfter(2);
      pJenis.editAsText().setFontFamily('Arial').setFontSize(7).setBold(true).setForegroundColor('#075E45');

      const pQr = cell.appendParagraph('');
      pQr.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      pQr.setSpacingBefore(0).setSpacingAfter(2);
      const image = pQr.appendInlineImage(blobs[pos]);
      image.setWidth(72).setHeight(72);

      const pNama = cell.appendParagraph(santri[pos].nama);
      pNama.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      pNama.setSpacingBefore(0).setSpacingAfter(1);
      pNama.editAsText().setFontFamily('Arial').setFontSize(8).setBold(true).setForegroundColor('#0F172A');

      const pKelas = cell.appendParagraph(santri[pos].kelas || 'Kelas —');
      pKelas.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      pKelas.setSpacingBefore(0).setSpacingAfter(1);
      pKelas.editAsText().setFontFamily('Arial').setFontSize(7).setForegroundColor('#475569');

      const pWaktu = cell.appendParagraph('08:00–09:00 WIB');
      pWaktu.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      pWaktu.setSpacingBefore(0).setSpacingAfter(1);
      pWaktu.editAsText().setFontFamily('Arial').setFontSize(7).setForegroundColor('#475569');

      const pKode = cell.appendParagraph(santri[pos].kode);
      pKode.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      pKode.setSpacingBefore(0).setSpacingAfter(0);
      pKode.editAsText().setFontFamily('Courier New').setFontSize(7).setBold(true).setForegroundColor('#075E45');
    }
  }

  doc.saveAndClose();

  try {
    const sourceFile = DriveApp.getFileById(ss.getId());
    const parents = sourceFile.getParents();
    if (parents.hasNext()) DriveApp.getFileById(doc.getId()).moveTo(parents.next());
  } catch (e) {
    // Jika file tidak bisa dipindah folder, dokumen tetap tersimpan di Drive Saya.
  }

  const url = doc.getUrl();
  const dialog = HtmlService.createHtmlOutput(
    '<div style="font:14px Arial,sans-serif;padding:20px;color:#0f172a">' +
      '<div style="font-size:20px;font-weight:700;color:#075e45;margin-bottom:8px">QR Halaqoh siap dicetak</div>' +
      '<p>Berhasil membuat kartu QR untuk <b>' + santri.length + ' pengajuan Halaqoh</b>.</p>' +
      '<p>Layout: 3 kolom × 4 baris per halaman. Buka dokumen, lalu pilih <b>File → Print</b>.</p>' +
      '<p><a style="display:inline-block;background:#087b52;color:white;padding:11px 16px;border-radius:8px;text-decoration:none;font-weight:700" target="_blank" rel="noopener" href="' + url + '">Buka Google Docs</a></p>' +
      '<p style="font-size:12px;color:#64748b">QR bersumber dari kode unik di kolom M. Status dan waktu scan tidak diubah. Pertanyaan konsultasi tidak dicetak pada kartu.</p>' +
    '</div>'
  ).setWidth(430).setHeight(230);
  ui.showModalDialog(dialog, 'QR Halaqoh siap dicetak');
}


function aturPinKonsultasiSantri() {
  const ui = SpreadsheetApp.getUi();
  const prompt = ui.prompt('Atur PIN petugas konsultasi', 'Masukkan PIN baru minimal 4 karakter:', ui.ButtonSet.OK_CANCEL);
  if (prompt.getSelectedButton() !== ui.Button.OK) return;
  const pin = prompt.getResponseText().trim();
  if (pin.length < 4) { ui.alert('PIN terlalu pendek. PIN tidak diubah.'); return; }
  PropertiesService.getScriptProperties().setProperty(KS.PIN_KEY, pin);
  ui.alert('PIN konsultasi tersimpan. Gunakan PIN ini di HP dan proyektor.');
}

/**
 * Membuat Google Docs berisi semua QR aktif dalam kartu siap cetak.
 * QR dibuat dari kode unik di kolom J; fungsi ini tidak mengubah status/waktu check-in.
 */
function buatDokumenCetakQRSantri() {
  const ui = SpreadsheetApp.getUi();
  const sh = ksSheet_();
  const first = ksCariBarisDataPertama_(sh);
  const last = sh.getLastRow();
  if (first > last) {
    ui.alert('Belum ada data santri', 'Tidak ditemukan baris data santri yang valid di Sheet1.', ui.ButtonSet.OK);
    return;
  }

  const rows = sh.getRange(first, 1, last - first + 1, KS.COL_KODE).getDisplayValues();
  const santri = [];
  const seen = new Set();
  rows.forEach(function(r, i) {
    if (!ksAdalahBarisSantri_(r)) return;
    const code = String(r[KS.COL_KODE - 1] || '').trim().toUpperCase();
    if (!/^KS-[A-Z0-9]{12}$/.test(code)) {
      throw new Error('Kode QR belum valid untuk "' + String(r[KS.COL_SANTRI - 1] || '').trim() +
        '" pada baris ' + (first + i) + '. Jalankan Konsultasi Santri → Siapkan kolom, kode, dan QR terlebih dahulu.');
    }
    if (seen.has(code)) throw new Error('Kode QR ganda ditemukan: ' + code + '. Perbaiki duplikasi sebelum mencetak.');
    seen.add(code);
    santri.push({
      nama: String(r[KS.COL_SANTRI - 1] || '').trim(),
      kelas: String(r[KS.COL_KELAS - 1] || '').trim(),
      kode: code
    });
  });

  if (!santri.length) {
    ui.alert('Belum ada data santri', 'Tidak ada baris santri yang dapat dicetak.', ui.ButtonSet.OK);
    return;
  }

  // Ambil gambar QR dalam batch agar pembuatan dokumen puluhan/ratusan QR lebih cepat.
  const blobs = [];
  const BATCH = 18;
  for (let start = 0; start < santri.length; start += BATCH) {
    const batch = santri.slice(start, start + BATCH);
    const requests = batch.map(function(s) {
      return { url: KS.QR_BASE + encodeURIComponent(s.kode), muteHttpExceptions: true };
    });
    let responses;
    try {
      responses = UrlFetchApp.fetchAll(requests);
    } catch (err) {
      throw new Error('Gagal mengambil gambar QR dari layanan QR. Periksa koneksi internet, lalu coba lagi. Detail: ' + err.message);
    }
    responses.forEach(function(response, j) {
      if (response.getResponseCode() !== 200 || !/^image\//i.test(String(response.getHeaders()['Content-Type'] || ''))) {
        throw new Error('Gambar QR gagal dibuat untuk kode ' + batch[j].kode + '. Periksa koneksi internet atau layanan QR, lalu coba lagi.');
      }
      blobs.push(response.getBlob().setName('QR-' + batch[j].kode + '.png'));
    });
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tanggal = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd-MM-yyyy HH.mm');
  const doc = DocumentApp.create('QR Konsultasi Santri - ' + tanggal);
  const body = doc.getBody();
  body.setMarginTop(24).setMarginBottom(24).setMarginLeft(24).setMarginRight(24);

  const PER_HALAMAN = 12; // 3 kolom x 4 baris
  for (let pageStart = 0; pageStart < santri.length; pageStart += PER_HALAMAN) {
    if (pageStart > 0) body.appendPageBreak();

    const pJudul = body.appendParagraph('CHECKIN KONSULTASI SANTRI');
    pJudul.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    pJudul.setSpacingBefore(0).setSpacingAfter(2);
    pJudul.editAsText().setFontFamily('Arial').setFontSize(15).setBold(true).setForegroundColor('#075E45');

    const pInfo = body.appendParagraph('Kartu QR santri • ' + santri.length + ' santri • ' + tanggal);
    pInfo.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    pInfo.setSpacingBefore(0).setSpacingAfter(8);
    pInfo.editAsText().setFontFamily('Arial').setFontSize(8).setForegroundColor('#475569');

    const slots = [];
    for (let rr = 0; rr < 4; rr++) slots.push(['', '', '']);
    const table = body.appendTable(slots);
    table.setBorderWidth(0.75);
    table.setBorderColor('#CBD5E1');

    for (let offset = 0; offset < PER_HALAMAN; offset++) {
      const pos = pageStart + offset;
      if (pos >= santri.length) break;
      const rowIndex = Math.floor(offset / 3);
      const colIndex = offset % 3;
      const cell = table.getCell(rowIndex, colIndex);
      cell.clear();
      cell.setBackgroundColor('#FFFFFF')
        .setVerticalAlignment(DocumentApp.VerticalAlignment.MIDDLE)
        .setPaddingTop(5).setPaddingBottom(5)
        .setPaddingLeft(4).setPaddingRight(4);

      const pQr = cell.appendParagraph('');
      pQr.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      pQr.setSpacingBefore(0).setSpacingAfter(2);
      const image = pQr.appendInlineImage(blobs[pos]);
      image.setWidth(72).setHeight(72);

      const pNama = cell.appendParagraph(santri[pos].nama);
      pNama.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      pNama.setSpacingBefore(0).setSpacingAfter(1);
      pNama.editAsText().setFontFamily('Arial').setFontSize(8).setBold(true).setForegroundColor('#0F172A');

      const pKelas = cell.appendParagraph(santri[pos].kelas || 'Kelas —');
      pKelas.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      pKelas.setSpacingBefore(0).setSpacingAfter(1);
      pKelas.editAsText().setFontFamily('Arial').setFontSize(7).setForegroundColor('#475569');

      const pKode = cell.appendParagraph(santri[pos].kode);
      pKode.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      pKode.setSpacingBefore(0).setSpacingAfter(0);
      pKode.editAsText().setFontFamily('Courier New').setFontSize(7).setBold(true).setForegroundColor('#075E45');
    }
  }

  doc.saveAndClose();

  // Letakkan dokumen di folder yang sama dengan spreadsheet, bila tersedia.
  try {
    const sourceFile = DriveApp.getFileById(ss.getId());
    const parents = sourceFile.getParents();
    if (parents.hasNext()) DriveApp.getFileById(doc.getId()).moveTo(parents.next());
  } catch (e) {
    // Jika Drive tidak mengizinkan pemindahan folder, dokumen tetap tersimpan di Drive Saya.
  }

  const url = doc.getUrl();
  const html = HtmlService.createHtmlOutput(
    '<div style="font:14px Arial,sans-serif;padding:20px;color:#0f172a">' +
      '<div style="font-size:20px;font-weight:700;color:#075e45;margin-bottom:8px">Dokumen QR siap dicetak</div>' +
      '<p>Berhasil membuat kartu QR untuk <b>' + santri.length + ' santri</b>.</p>' +
      '<p>Layout: 3 kolom × 4 baris per halaman. Buka dokumen, lalu pilih <b>File → Print</b>.</p>' +
      '<p><a style="display:inline-block;background:#087b52;color:white;padding:11px 16px;border-radius:8px;text-decoration:none;font-weight:700" target="_blank" rel="noopener" href="' + url + '">Buka Google Docs</a></p>' +
      '<p style="font-size:12px;color:#64748b">QR bersumber dari kode unik di kolom J. Status dan waktu scan tidak diubah.</p>' +
    '</div>'
  ).setWidth(420).setHeight(220);
  ui.showModalDialog(html, 'Kartu QR siap dicetak');
}

function resetKonsultasiSantri() {
  const ui = SpreadsheetApp.getUi();
  const jawab = ui.alert('Reset status check-in?', 'Status dan waktu scan Kunjungan serta Halaqoh akan direset. Kode QR tidak diubah. Lakukan hanya sebelum kegiatan.', ui.ButtonSet.YES_NO);
  if (jawab !== ui.Button.YES) return;

  const sh = ksSheet_(), last = sh.getLastRow(), first = ksCariBarisDataPertama_(sh);
  if (first <= last) {
    const n = last - first + 1, rows = sh.getRange(first, 1, n, KS.COL_KODE).getValues();
    const status = rows.map(r => [ksAdalahBarisSantri_(r) ? 'BELUM' : (r[KS.COL_STATUS - 1] || '')]);
    const waktu = rows.map(r => [ksAdalahBarisSantri_(r) ? '' : (r[KS.COL_WAKTU - 1] || '')]);
    sh.getRange(first, KS.COL_STATUS, n, 1).setValues(status);
    sh.getRange(first, KS.COL_WAKTU, n, 1).setValues(waktu);
  }

  const h = ksHalaqohSheet_();
  if (h) {
    const lastH = h.getLastRow();
    if (lastH >= KS.HALAQOH_DATA_START_ROW) {
      const nH = lastH - KS.HALAQOH_DATA_START_ROW + 1;
      const rowsH = h.getRange(KS.HALAQOH_DATA_START_ROW, 1, nH, KS.HALAQOH_COL_STATUS).getValues();
      const statusH = rowsH.map(r => [String(r[KS.HALAQOH_COL_SANTRI - 1] || '').trim() ? 'BELUM' : (r[KS.HALAQOH_COL_STATUS - 1] || '')]);
      const waktuH = rowsH.map(r => [String(r[KS.HALAQOH_COL_SANTRI - 1] || '').trim() ? '' : (r[KS.HALAQOH_COL_WAKTU_SCAN - 1] || '')]);
      h.getRange(KS.HALAQOH_DATA_START_ROW, KS.HALAQOH_COL_STATUS, nH, 1).setValues(statusH);
      h.getRange(KS.HALAQOH_DATA_START_ROW, KS.HALAQOH_COL_WAKTU_SCAN, nH, 1).setValues(waktuH);
    }
  }
  CacheService.getScriptCache().remove(KS.CACHE_LAST_KEY);
  SpreadsheetApp.getActiveSpreadsheet().toast('Status Kunjungan dan Halaqoh direset.', 'Konsultasi Santri', 5);
}

function ksPinValid_(pin) {
  const saved = PropertiesService.getScriptProperties().getProperty(KS.PIN_KEY) || '1234';
  return String(pin || '').trim() === saved;
}

function ksSheet_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty(KS.SPREADSHEET_KEY);
  if (id) {
    const ss = SpreadsheetApp.openById(id);
    const sh = ss.getSheetByName(KS.SHEET_NAME);
    if (!sh) throw new Error('Tab sheet "' + KS.SHEET_NAME + '" tidak ditemukan.');
    return sh;
  }
  const ssAktif = SpreadsheetApp.getActiveSpreadsheet();
  if (ssAktif) {
    const shAktif = ssAktif.getSheetByName(KS.SHEET_NAME);
    if (shAktif) return shAktif;
  }
  throw new Error('Spreadsheet belum dihubungkan. Jalankan menu Konsultasi Santri > Siapkan kolom, kode, dan QR terlebih dahulu.');
}

function ksJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
