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
  QR_BASE: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data='
});

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Konsultasi Santri')
    .addItem('1. Siapkan kolom, kode, dan QR', 'siapkanKonsultasiSantri')
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

function ksRingkasan_() {
  const sh = ksSheet_(), last = sh.getLastRow(), first = ksCariBarisDataPertama_(sh);
  if (first > last) return { total:0, dipakai:0 };
  const rows = sh.getRange(first, 1, last - first + 1, KS.COL_STATUS).getValues();
  return ksRingkasanDariRows_(rows);
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

function aturPinKonsultasiSantri() {
  const ui = SpreadsheetApp.getUi();
  const prompt = ui.prompt('Atur PIN petugas konsultasi', 'Masukkan PIN baru minimal 4 karakter:', ui.ButtonSet.OK_CANCEL);
  if (prompt.getSelectedButton() !== ui.Button.OK) return;
  const pin = prompt.getResponseText().trim();
  if (pin.length < 4) { ui.alert('PIN terlalu pendek. PIN tidak diubah.'); return; }
  PropertiesService.getScriptProperties().setProperty(KS.PIN_KEY, pin);
  ui.alert('PIN konsultasi tersimpan. Gunakan PIN ini di HP dan proyektor.');
}

function resetKonsultasiSantri() {
  const ui = SpreadsheetApp.getUi();
  const jawab = ui.alert('Reset check-in konsultasi?', 'Semua status santri akan kembali menjadi BELUM dan waktu scan dikosongkan. Lakukan hanya sebelum kegiatan.', ui.ButtonSet.YES_NO);
  if (jawab !== ui.Button.YES) return;
  const sh = ksSheet_(), last = sh.getLastRow(), first = ksCariBarisDataPertama_(sh);
  if (first > last) return;
  const n = last - first + 1, rows = sh.getRange(first, 1, n, KS.COL_KODE).getValues();
  const status = rows.map(r => [ksAdalahBarisSantri_(r) ? 'BELUM' : (r[KS.COL_STATUS - 1] || '')]);
  const waktu = rows.map(r => [ksAdalahBarisSantri_(r) ? '' : (r[KS.COL_WAKTU - 1] || '')]);
  sh.getRange(first, KS.COL_STATUS, n, 1).setValues(status);
  sh.getRange(first, KS.COL_WAKTU, n, 1).setValues(waktu);
  CacheService.getScriptCache().remove(KS.CACHE_LAST_KEY);
  SpreadsheetApp.getActiveSpreadsheet().toast('Status konsultasi direset.', 'Konsultasi Santri', 5);
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
