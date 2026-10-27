/**
 * CHECKIN KONSULTASI SANTRI
 * Diikat (bound) pada Google Sheet konsultasi.
 * A: Nama Santri, B: Ayah, C: Ibu, D: Alamat, E: Kelas.
 * F: Status, G: Waktu Check-in, H: QR, I: Link QR, J: Kode Internal (disembunyikan).
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

/** Jalankan sekali dari spreadsheet untuk menambahkan kolom F:I, kode internal, dan QR. */
function siapkanKonsultasiSantri() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Buka Apps Script dari spreadsheet konsultasi melalui Extensions > Apps Script.');
  const sh = ss.getSheetByName(KS.SHEET_NAME);
  if (!sh) throw new Error('Tab sheet bernama "' + KS.SHEET_NAME + '" tidak ditemukan. Sesuaikan KS.SHEET_NAME bila nama tab berbeda.');

  PropertiesService.getScriptProperties().setProperty(KS.SPREADSHEET_KEY, ss.getId());
  if (sh.getMaxColumns() < KS.COL_KODE) sh.insertColumnsAfter(sh.getMaxColumns(), KS.COL_KODE - sh.getMaxColumns());

  sh.getRange(KS.HEADER_ROW, KS.COL_STATUS, 1, 4)
    .setValues([['Status', 'Waktu Check-in', 'QR', 'Link QR']])
    .setBackground('#075E45').setFontColor('#FFFFFF').setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
  // Baris 3 dipakai untuk subjudul Ayah/Ibu pada B:C; bersihkan contoh teks saja di kolom baru.
  sh.getRange(KS.SUBHEADER_ROW, KS.COL_STATUS, 1, 5).clearContent();
  sh.getRange(KS.HEADER_ROW, KS.COL_KODE).setValue('Kode Internal').setBackground('#075E45').setFontColor('#FFFFFF').setFontWeight('bold');

  const last = sh.getLastRow();
  if (last < KS.DATA_START_ROW) {
    sh.hideColumns(KS.COL_KODE);
    ss.toast('Kolom konsultasi disiapkan. Isi data santri mulai baris ' + KS.DATA_START_ROW + '.', 'Konsultasi Santri', 7);
    return;
  }

  const n = last - KS.DATA_START_ROW + 1;
  const rows = sh.getRange(KS.DATA_START_ROW, 1, n, KS.COL_KODE).getValues();
  const codes = new Set(rows.map(r => String(r[KS.COL_KODE - 1] || '').trim()).filter(Boolean));
  const statusValues = [];
  const waktuValues = [];
  const codeValues = [];
  const qrFormulas = [];
  const linkFormulas = [];
  let kodeBaru = 0;

  rows.forEach((r, i) => {
    const santri = String(r[KS.COL_SANTRI - 1] || '').trim();
    let code = String(r[KS.COL_KODE - 1] || '').trim();
    let status = r[KS.COL_STATUS - 1];
    let waktu = r[KS.COL_WAKTU - 1];
    if (santri) {
      if (!code) {
        do { code = 'KS-' + Utilities.getUuid().replace(/-/g, '').substring(0, 12).toUpperCase(); }
        while (codes.has(code));
        codes.add(code);
        kodeBaru++;
      }
      if (!String(status || '').trim()) status = 'BELUM';
      const rowNumber = KS.DATA_START_ROW + i;
      qrFormulas.push(['=IMAGE("' + KS.QR_BASE + '"&ENCODEURL($J' + rowNumber + '))']);
      linkFormulas.push(['="' + KS.QR_BASE + '"&ENCODEURL($J' + rowNumber + ')']);
    } else {
      code = '';
      status = '';
      waktu = '';
      qrFormulas.push(['']);
      linkFormulas.push(['']);
    }
    statusValues.push([status]);
    waktuValues.push([waktu]);
    codeValues.push([code]);
  });

  sh.getRange(KS.DATA_START_ROW, KS.COL_STATUS, n, 1).setValues(statusValues);
  sh.getRange(KS.DATA_START_ROW, KS.COL_WAKTU, n, 1).setValues(waktuValues).setNumberFormat('dd/MM/yyyy HH:mm:ss');
  sh.getRange(KS.DATA_START_ROW, KS.COL_QR, n, 1).setFormulas(qrFormulas);
  sh.getRange(KS.DATA_START_ROW, KS.COL_LINK, n, 1).setFormulas(linkFormulas);
  sh.getRange(KS.DATA_START_ROW, KS.COL_KODE, n, 1).setValues(codeValues);

  sh.setColumnWidth(KS.COL_STATUS, 185);
  sh.setColumnWidth(KS.COL_WAKTU, 165);
  sh.setColumnWidth(KS.COL_QR, 110);
  sh.setColumnWidth(KS.COL_LINK, 360);
  sh.setColumnWidth(KS.COL_KODE, 180);
  sh.setRowHeight(KS.HEADER_ROW, 32);
  sh.setRowHeights(KS.DATA_START_ROW, n, 98);
  sh.getRange(KS.DATA_START_ROW, KS.COL_STATUS, n, 1).setHorizontalAlignment('center');
  sh.getRange(KS.DATA_START_ROW, KS.COL_QR, n, 1).setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.getRange(KS.DATA_START_ROW, KS.COL_WAKTU, n, 1).setHorizontalAlignment('center');
  sh.hideColumns(KS.COL_KODE);
  SpreadsheetApp.flush();
  ss.toast(kodeBaru + ' kode QR dibuat; status dan QR siap. Kolom kode internal disembunyikan.', 'Konsultasi Santri', 8);
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
  return Object.assign({ status: 'IDLE' }, ksRingkasan_());
}

function cekKonsultasiSantri_(kode, pin) {
  if (!ksPinValid_(pin)) return { status: 'PIN_SALAH' };
  kode = String(kode || '').trim().toUpperCase();
  if (!kode) return Object.assign({ status: 'IDLE' }, ksRingkasan_());

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sh = ksSheet_();
    const last = sh.getLastRow();
    if (last < KS.DATA_START_ROW) return ksSimpanEvent_({ status: 'PALSU', pesan: 'QR tidak terdaftar.' });
    const n = last - KS.DATA_START_ROW + 1;
    const rows = sh.getRange(KS.DATA_START_ROW, 1, n, KS.COL_KODE).getValues();
    const idx = rows.findIndex(r => String(r[KS.COL_KODE - 1] || '').trim().toUpperCase() === kode);

    if (idx < 0) {
      const salah = Object.assign({ status: 'PALSU', pesan: 'QR tidak terdaftar.' }, ksRingkasanDariRows_(rows));
      return ksSimpanEvent_(salah);
    }

    const r = rows[idx];
    const nomorBaris = KS.DATA_START_ROW + idx;
    const statusLama = String(r[KS.COL_STATUS - 1] || '').trim().toUpperCase();
    const sudah = statusLama.indexOf('SUDAH DISCAN') >= 0 || statusLama.indexOf('DIPAKAI') >= 0 || statusLama === 'SUDAH';
    const info = {
      santri: String(r[KS.COL_SANTRI - 1] || '').trim(),
      ayah: String(r[KS.COL_AYAH - 1] || '').trim(),
      ibu: String(r[KS.COL_IBU - 1] || '').trim(),
      alamat: String(r[KS.COL_ALAMAT - 1] || '').trim(),
      kelas: String(r[KS.COL_KELAS - 1] || '').trim()
    };

    let waktu = r[KS.COL_WAKTU - 1];
    if (!sudah) {
      const now = new Date();
      sh.getRange(nomorBaris, KS.COL_STATUS).setValue('SUDAH DISCAN/DIPAKAI');
      if (!(waktu instanceof Date) && !String(waktu || '').trim()) {
        sh.getRange(nomorBaris, KS.COL_WAKTU).setValue(now).setNumberFormat('dd/MM/yyyy HH:mm:ss');
        waktu = now;
      }
    }
    const waktuTeks = waktu instanceof Date
      ? Utilities.formatDate(waktu, Session.getScriptTimeZone() || 'Asia/Jakarta', 'dd/MM/yyyy HH:mm:ss')
      : String(waktu || '-');
    const hasil = Object.assign({ status: sudah ? 'SUDAH' : 'VALID', waktu: waktuTeks }, info, ksRingkasan_());
    return ksSimpanEvent_(hasil);
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

function ksRingkasan_() {
  const sh = ksSheet_();
  const last = sh.getLastRow();
  if (last < KS.DATA_START_ROW) return { total: 0, dipakai: 0 };
  const rows = sh.getRange(KS.DATA_START_ROW, 1, last - KS.DATA_START_ROW + 1, KS.COL_STATUS).getValues();
  return ksRingkasanDariRows_(rows);
}

function ksRingkasanDariRows_(rows) {
  let total = 0, dipakai = 0;
  rows.forEach(r => {
    if (!String(r[KS.COL_SANTRI - 1] || '').trim()) return;
    total++;
    const st = String(r[KS.COL_STATUS - 1] || '').toUpperCase();
    if (st.indexOf('SUDAH DISCAN') >= 0 || st.indexOf('DIPAKAI') >= 0 || st === 'SUDAH') dipakai++;
  });
  return { total: total, dipakai: dipakai };
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
  const sh = ksSheet_();
  const last = sh.getLastRow();
  if (last < KS.DATA_START_ROW) return;
  const n = last - KS.DATA_START_ROW + 1;
  const names = sh.getRange(KS.DATA_START_ROW, KS.COL_SANTRI, n, 1).getValues();
  sh.getRange(KS.DATA_START_ROW, KS.COL_STATUS, n, 1).setValues(names.map(r => [String(r[0] || '').trim() ? 'BELUM' : '']));
  sh.getRange(KS.DATA_START_ROW, KS.COL_WAKTU, n, 1).clearContent();
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
