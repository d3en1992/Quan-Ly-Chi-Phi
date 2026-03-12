// nhapxuat.js — Import / Export Excel + JSON
// Load order: sau danhmuc.js
// Schema chuẩn: 9 sheets — HoaDonNhanh · HoaDonChiTiet · TienUng · ChamCong
//               ThietBi · DanhMuc · HopDong · ThuTien · ThauPhu

'use strict';

// ══════════════════════════════════════════════════════════════
// [1] HELPERS dùng chung
// ══════════════════════════════════════════════════════════════

function _normStr(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 /]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Parse ngày → 'YYYY-MM-DD' hoặc ''
function _parseDate(v) {
  if (!v && v !== 0) return '';
  if (typeof v === 'number' && v > 25569 && v < 60000) {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
}

function _num(v) { return parseFloat(String(v || '').replace(/[^0-9.\-]/g, '')) || 0; }
function _str(v) { return v ? String(v).trim() : ''; }
function _sheetRows(ws) { return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }); }

// ══════════════════════════════════════════════════════════════
// [2] SMART COLUMN DETECTION
// ══════════════════════════════════════════════════════════════

const _ALIASES = {
  // HoaDonNhanh / HoaDonChiTiet (dùng chung 1 parser)
  inv: {
    id:        ['id','uuid','record id'],
    ngay:      ['ngay','date','ngay ky','ky'],
    congtrinh: ['cong trinh','ct','project'],
    loai:      ['loai','loai chi phi','category','type','hang muc'],
    nd:        ['nd','noi dung','description','dien giai','mo ta'],
    tien:      ['tien','don gia','dongia','unit price','gia'],
    sl:        ['sl','soluong','so luong','quantity','qty'],
    thanhtien: ['thanh tien','tien','total','tong tien','tong'],
    nguoi:     ['nguoi','nguoi th','nguoi thuc hien','performer','nhan vien'],
    ncc:       ['ncc','nha cc','nha cung cap','supplier','vendor'],
    sohd:      ['so hd','invoice no','invoice number','sohd','so hoa don'],
  },
  // TienUng — cột "nguoi" = tp (thầu phụ / công nhân)
  ung: {
    id:        ['id','uuid','record id'],
    ngay:      ['ngay','date'],
    congtrinh: ['cong trinh','ct','project'],
    tp:        ['nguoi','tp','thau phu','nha cc','ten','nha cung cap','supplier'],
    tien:      ['tien','so tien','amount','so tien ung'],
    nd:        ['nd','noi dung','description','ghi chu'],
    loai:      ['loai','type','loai ung'],
  },
  // ChamCong
  cc: {
    fromDate:  ['ngay','tuan','ngaydautuan','ngay dau tuan','from date','fromdate','ngay bat dau'],
    ct:        ['ct','cong trinh','congtrinh','project'],
    name:      ['ten','ten cn','name','ho ten','cong nhan'],
    luong:     ['luong','luong ngay','daily rate','luong ca'],
    phucap:    ['phu cap','phucap','allowance','pc'],
    hdmuale:   ['hd mua le','hdmuale','hd','retail','tien hang mua le'],
    cn:        ['cn','chu nhat','sun','0'],
    t2:        ['t2','thu 2','mon','thu hai'],
    t3:        ['t3','thu 3','tue','thu ba'],
    t4:        ['t4','thu 4','wed','thu tu'],
    t5:        ['t5','thu 5','thu','thu nam'],
    t6:        ['t6','thu 6','fri','thu sau'],
    t7:        ['t7','thu 7','sat','thu bay'],
    nd:        ['nd','ghichu','ghi chu','note','mo ta'],
  },
  // ThietBi
  tb: {
    id:        ['id','uuid','record id'],
    ct:        ['ct','cong trinh','project'],
    ten:       ['ten','ten thiet bi','name','thiet bi'],
    soluong:   ['sl','soluong','so luong','qty','quantity'],
    tinhtrang: ['tinh trang','tinhtrang','status','trang thai'],
    nguoi:     ['nguoi','nguoi phu trach','manager'],
    ngay:      ['ngay','date','ngay nhap'],
    ghichu:    ['ghichu','ghi chu','note','nd','mo ta'],
  },
  // HopDong
  hd: {
    congtrinh:     ['cong trinh','ct','congtrinh','project'],
    giatri:        ['giatrihopdong','gia tri hd chinh','gia tri hop dong','hop dong chinh','gia tri'],
    giatriphu:     ['phantho','phan tho','hd phu','gia tri hd phu','hdphu'],
    phanhoanthien: ['phanhoanthien','phan hoan thien','hoan thien'],
    phatsinh:      ['phatsinh','phat sinh','phat sinh them'],
    ghichu:        ['ghichu','ghi chu','note','nd','mo ta'],
  },
  // ThuTien
  thu: {
    id:        ['id','uuid','record id'],
    congtrinh: ['cong trinh','ct','congtrinh','project'],
    ngay:      ['ngay','date','ngay thu'],
    sotien:    ['sotien','so tien','tien','amount'],
    nguoith:   ['nguoith','nguoi th','nguoi','nguoi thuc hien'],
    ghichu:    ['ghichu','ghi chu','note','nd','noi dung'],
  },
  // ThauPhu (hợp đồng thầu phụ)
  tp: {
    id:        ['id','uuid','record id'],
    congtrinh: ['cong trinh','ct','congtrinh','project'],
    tenthau:   ['tenthau','ten thau','thau phu','nha thau','thauphu'],
    ngay:      ['ngay','date','ngay ky'],
    giatri:    ['giatri','gia tri','gia tri hd'],
    phatsinh:  ['phatsinh','phat sinh'],
    ghichu:    ['ghichu','ghi chu','note','nd','noi dung'],
  },
};

// Tìm header row → { headerIdx, colMap }
function _detectHeader(rows, aliases) {
  const REQUIRED_MATCH = 2;
  for (let ri = 0; ri < Math.min(6, rows.length); ri++) {
    const row    = rows[ri];
    const normed = row.map(c => _normStr(String(c || '')));
    const map    = {};
    let matched  = 0;
    for (const [field, aliasList] of Object.entries(aliases)) {
      const ci = normed.findIndex(h => aliasList.some(a => h === a || h.includes(a)));
      if (ci >= 0) { map[field] = ci; matched++; }
    }
    if (matched >= REQUIRED_MATCH) return { headerIdx: ri, colMap: map };
  }
  return { headerIdx: -1, colMap: {} };
}

function _get(row, colMap, field, fallbackIdx) {
  const ci = colMap[field] !== undefined ? colMap[field] : fallbackIdx;
  return ci !== undefined ? row[ci] : '';
}

// Lấy id: giữ nguyên nếu có, tạo mới nếu thiếu
function _getId(row, colMap, fallbackIdx) {
  const v = _str(_get(row, colMap, 'id', fallbackIdx));
  return v || uuid();
}

// ══════════════════════════════════════════════════════════════
// [3] SHEET TYPE DETECTION
// ══════════════════════════════════════════════════════════════

function _detectSheetType(name) {
  const n = _normStr(name);
  if (n.includes('hoa don nhanh') || n.includes('hoadonnhanh'))       return 'invQ';
  if (n.includes('hoa don chi tiet') || n.includes('hoadonchitiet'))   return 'invD';
  if (n.includes('hoa don') || n.includes('chi phi') || n.match(/^1_/) || n.match(/^1\b/)) return 'inv';
  if (n.includes('tien ung')  || n.match(/^2_/) || n.match(/^2\b/))   return 'ung';
  if (n.includes('cham cong') || n.match(/^3_/) || n.match(/^3\b/))   return 'cc';
  if (n.includes('thiet bi')  || n.match(/^4_/) || n.match(/^4\b/))   return 'tb';
  if (n.includes('danh muc')  || n.match(/^5_/) || n.match(/^5\b/))   return 'cats';
  if (n.includes('hop dong')  || n.includes('hopdong') || n.match(/^6\b/)) return 'hd';
  if (n.includes('thu tien')  || n.includes('thutien') || n.match(/^7\b/))  return 'thu';
  if (n.includes('thau phu')  || n.includes('thauphu') || n.match(/^[89]\b/)) return 'tp';
  return null;
}

// ══════════════════════════════════════════════════════════════
// [4] PARSE FUNCTIONS
// ══════════════════════════════════════════════════════════════

function _parseInvSheet(rows) {
  const { headerIdx, colMap } = _detectHeader(rows, _ALIASES.inv);
  const dataStart = headerIdx >= 0 ? headerIdx + 1 : _findDateRow(rows);
  const errors = [], records = [];

  for (let i = dataStart; i < rows.length; i++) {
    const r = rows[i];
    if (r.every(c => !c && c !== 0)) continue;

    const ngay      = _parseDate(_get(r, colMap, 'ngay',      1));
    const ct        = _str      (_get(r, colMap, 'congtrinh', 2));
    const loai      = _str      (_get(r, colMap, 'loai',      3));
    const nd        = _str      (_get(r, colMap, 'nd',        4));
    const tien      = _num      (_get(r, colMap, 'tien',      5));
    const sl        = _num      (_get(r, colMap, 'sl',        6)) || 1;
    const thanhtien = _num      (_get(r, colMap, 'thanhtien', 7)) || tien * sl;
    const nguoi     = _str      (_get(r, colMap, 'nguoi',     8));
    const ncc       = _str      (_get(r, colMap, 'ncc',       9));
    const sohd      = _str      (_get(r, colMap, 'sohd',      10));
    const id        = _getId    (r, colMap, 11);

    if (!ngay) { errors.push(`Hàng ${i+1}: Ngày không hợp lệ ("${r[0] || r[1]}")`); continue; }
    if (!ct)   { errors.push(`Hàng ${i+1}: Thiếu Công Trình`); continue; }
    if (!loai) { errors.push(`Hàng ${i+1}: Thiếu Loại Chi Phí`); continue; }
    if (!tien && !thanhtien) { errors.push(`Hàng ${i+1}: Số tiền = 0`); continue; }

    const now = Date.now();
    records.push({
      id, createdAt: now, updatedAt: now, deletedAt: null, deviceId: DEVICE_ID,
      ngay, congtrinh: ct, loai, nd, tien, sl, thanhtien, nguoi, ncc, sohd,
    });
  }
  return { records, errors };
}

function _parseUngSheet(rows) {
  const { headerIdx, colMap } = _detectHeader(rows, _ALIASES.ung);
  const dataStart = headerIdx >= 0 ? headerIdx + 1 : _findDateRow(rows);
  const errors = [], records = [];

  for (let i = dataStart; i < rows.length; i++) {
    const r = rows[i];
    if (r.every(c => !c && c !== 0)) continue;

    const ngay  = _parseDate(_get(r, colMap, 'ngay',      1));
    const ct    = _str      (_get(r, colMap, 'congtrinh', 2));
    const tp    = _str      (_get(r, colMap, 'tp',        3));
    const tien  = _num      (_get(r, colMap, 'tien',      4));
    const nd    = _str      (_get(r, colMap, 'nd',        5));
    const loai  = _str      (_get(r, colMap, 'loai',      6)) || 'thauphu';
    const id    = _getId    (r, colMap, 7);

    if (!ngay) { errors.push(`Hàng ${i+1}: Ngày không hợp lệ`); continue; }
    if (!ct)   { errors.push(`Hàng ${i+1}: Thiếu Công Trình`); continue; }
    if (!tp)   { errors.push(`Hàng ${i+1}: Thiếu Tên Người / Thầu Phụ`); continue; }
    if (!tien) { errors.push(`Hàng ${i+1}: Số tiền = 0`); continue; }

    const now = Date.now();
    records.push({
      id, createdAt: now, updatedAt: now, deletedAt: null, deviceId: DEVICE_ID,
      ngay, congtrinh: ct, tp, tien, nd,
      loai: ['thauphu','congnhan'].includes(loai) ? loai : 'thauphu',
    });
  }
  return { records, errors };
}

function _parseCCSheet(rows) {
  const { headerIdx, colMap } = _detectHeader(rows, _ALIASES.cc);
  const dataStart = headerIdx >= 0 ? headerIdx + 1 : _findDateRow(rows);
  const errors = [], weekMap = {};

  for (let i = dataStart; i < rows.length; i++) {
    const r = rows[i];
    if (r.every(c => !c && c !== 0)) continue;

    const fromDate = _parseDate(_get(r, colMap, 'fromDate', 0));
    const ct       = _str      (_get(r, colMap, 'ct',       1));
    const name     = _str      (_get(r, colMap, 'name',     2));
    const luong    = _num      (_get(r, colMap, 'luong',    3));
    const phucap   = _num      (_get(r, colMap, 'phucap',   4));
    const hdmuale  = _num      (_get(r, colMap, 'hdmuale',  5));
    const d = [
      _num(_get(r, colMap, 'cn', 6)),
      _num(_get(r, colMap, 't2', 7)),
      _num(_get(r, colMap, 't3', 8)),
      _num(_get(r, colMap, 't4', 9)),
      _num(_get(r, colMap, 't5', 10)),
      _num(_get(r, colMap, 't6', 11)),
      _num(_get(r, colMap, 't7', 12)),
    ];
    const nd = _str(_get(r, colMap, 'nd', 13));

    if (!fromDate) { errors.push(`Hàng ${i+1}: Ngày đầu tuần không hợp lệ`); continue; }
    if (!ct)       { errors.push(`Hàng ${i+1}: Thiếu Công Trình`); continue; }
    if (!name)     { errors.push(`Hàng ${i+1}: Thiếu Tên Công Nhân`); continue; }

    const key = fromDate + '|' + ct;
    if (!weekMap[key]) {
      let toDate = fromDate;
      try {
        const [y, mo, dd] = fromDate.split('-').map(Number);
        const sat = new Date(y, mo - 1, dd + 6);
        toDate = sat.getFullYear() + '-' +
          String(sat.getMonth() + 1).padStart(2, '0') + '-' +
          String(sat.getDate()).padStart(2, '0');
      } catch (_) {}
      const now = Date.now();
      weekMap[key] = {
        id: uuid(), createdAt: now, updatedAt: now, deletedAt: null, deviceId: DEVICE_ID,
        fromDate, toDate, ct, workers: [],
      };
    }
    weekMap[key].workers.push({ name, luong, phucap, hdmuale, d, nd });
  }
  return { records: Object.values(weekMap), errors };
}

function _parseTbSheet(rows) {
  const { headerIdx, colMap } = _detectHeader(rows, _ALIASES.tb);
  const dataStart = headerIdx >= 0 ? headerIdx + 1 : _findNonHeaderRow(rows);
  const errors = [], records = [];

  for (let i = dataStart; i < rows.length; i++) {
    const r = rows[i];
    if (r.every(c => !c && c !== 0)) continue;

    const ct        = _str      (_get(r, colMap, 'ct',        0));
    const ten       = _str      (_get(r, colMap, 'ten',       1));
    const soluong   = _num      (_get(r, colMap, 'soluong',   2)) || 1;
    const tinhtrang = _str      (_get(r, colMap, 'tinhtrang', 3)) || 'Đang hoạt động';
    const nguoi     = _str      (_get(r, colMap, 'nguoi',     4));
    const ngay      = _parseDate(_get(r, colMap, 'ngay',      5)) || '';
    const ghichu    = _str      (_get(r, colMap, 'ghichu',    6));
    const id        = _getId    (r, colMap, 7);

    if (!ct)  { errors.push(`Hàng ${i+1}: Thiếu Công Trình`); continue; }
    if (!ten) { errors.push(`Hàng ${i+1}: Thiếu Tên Thiết Bị`); continue; }

    const now = Date.now();
    records.push({
      id, createdAt: now, updatedAt: now, deletedAt: null, deviceId: DEVICE_ID,
      ct, ten, soluong, tinhtrang, nguoi, ngay, ghichu,
    });
  }
  return { records, errors };
}

// HopDong — parse thành array tạm, sau đó merge vào hopDongData object
function _parseHdSheet(rows) {
  const { headerIdx, colMap } = _detectHeader(rows, _ALIASES.hd);
  const dataStart = headerIdx >= 0 ? headerIdx + 1 : _findNonHeaderRow(rows);
  const errors = [], records = [];

  for (let i = dataStart; i < rows.length; i++) {
    const r = rows[i];
    if (r.every(c => !c && c !== 0)) continue;

    const ct           = _str(_get(r, colMap, 'congtrinh',     0));
    const giaTri       = _num(_get(r, colMap, 'giatri',        1));
    const giaTriphu    = _num(_get(r, colMap, 'giatriphu',     2));
    const phanHoanThien= _num(_get(r, colMap, 'phanhoanthien', 3));
    const phatSinh     = _num(_get(r, colMap, 'phatsinh',      4));
    const ghichu       = _str(_get(r, colMap, 'ghichu',        5));

    if (!ct) { errors.push(`Hàng ${i+1}: Thiếu Công Trình`); continue; }
    records.push({ ct, giaTri, giaTriphu, phanHoanThien, phatSinh, ghichu });
  }
  return { records, errors };
}

// ThuTien
function _parseThuSheet(rows) {
  const { headerIdx, colMap } = _detectHeader(rows, _ALIASES.thu);
  const dataStart = headerIdx >= 0 ? headerIdx + 1 : _findDateRow(rows);
  const errors = [], records = [];

  for (let i = dataStart; i < rows.length; i++) {
    const r = rows[i];
    if (r.every(c => !c && c !== 0)) continue;

    const ct    = _str      (_get(r, colMap, 'congtrinh', 0));
    const ngay  = _parseDate(_get(r, colMap, 'ngay',      1));
    const tien  = _num      (_get(r, colMap, 'sotien',    2));
    const nguoi = _str      (_get(r, colMap, 'nguoith',   3));
    const nd    = _str      (_get(r, colMap, 'ghichu',    4));
    const id    = _getId    (r, colMap, 5);

    if (!ct)   { errors.push(`Hàng ${i+1}: Thiếu Công Trình`); continue; }
    if (!ngay) { errors.push(`Hàng ${i+1}: Ngày không hợp lệ`); continue; }
    if (!tien) { errors.push(`Hàng ${i+1}: Số tiền = 0`); continue; }

    const now = Date.now();
    records.push({
      id, createdAt: now, updatedAt: now, deletedAt: null, deviceId: DEVICE_ID,
      ngay, congtrinh: ct, tien, nguoi, nd,
    });
  }
  return { records, errors };
}

// ThauPhu — hợp đồng thầu phụ
function _parseTpSheet(rows) {
  const { headerIdx, colMap } = _detectHeader(rows, _ALIASES.tp);
  const dataStart = headerIdx >= 0 ? headerIdx + 1 : _findNonHeaderRow(rows);
  const errors = [], records = [];

  for (let i = dataStart; i < rows.length; i++) {
    const r = rows[i];
    if (r.every(c => !c && c !== 0)) continue;

    const ct       = _str      (_get(r, colMap, 'congtrinh', 0));
    const thauphu  = _str      (_get(r, colMap, 'tenthau',   1)).toUpperCase();
    const ngay     = _parseDate(_get(r, colMap, 'ngay',      2)) || today();
    const giaTri   = _num      (_get(r, colMap, 'giatri',    3));
    const phatSinh = _num      (_get(r, colMap, 'phatsinh',  4));
    const nd       = _str      (_get(r, colMap, 'ghichu',    5));
    const id       = _getId    (r, colMap, 6);

    if (!ct)      { errors.push(`Hàng ${i+1}: Thiếu Công Trình`); continue; }
    if (!thauphu) { errors.push(`Hàng ${i+1}: Thiếu Tên Thầu Phụ`); continue; }

    const now = Date.now();
    records.push({
      id, createdAt: now, updatedAt: now, deletedAt: null, deviceId: DEVICE_ID,
      ngay, congtrinh: ct, thauphu, giaTri, phatSinh, nd,
    });
  }
  return { records, errors };
}

// DanhMuc — 7 cột: congtrinh · loaichiphi · nhacc · nguoithuchien · thauphu · congnhan · thietbi
function _parseCatsSheet(rows) {
  const cats = { ct: [], loai: [], ncc: [], nguoi: [], tp: [], cn: [] };
  // Bỏ qua row 0 (header) — bắt đầu từ row 1
  const dataStart = rows.findIndex((r, i) => i > 0 && r.some(c => _str(c)));
  const start = dataStart > 0 ? dataStart : 1;
  for (let i = start; i < rows.length; i++) {
    const r = rows[i];
    if (_str(r[0])) cats.ct.push(_str(r[0]));
    if (_str(r[1])) cats.loai.push(_str(r[1]));
    if (_str(r[2])) cats.ncc.push(_str(r[2]));
    if (_str(r[3])) cats.nguoi.push(_str(r[3]));
    if (_str(r[4])) cats.tp.push(_str(r[4]));
    if (_str(r[5])) cats.cn.push(_str(r[5]));
    // cột 6 (thietbi) — đọc nhưng chưa có danh mục riêng
  }
  return cats;
}

function _findDateRow(rows) {
  for (let i = 0; i < rows.length; i++) {
    if (_parseDate(rows[i][0]) || _parseDate(rows[i][1])) return i;
  }
  return 0;
}

function _findNonHeaderRow(rows) {
  for (let i = 0; i < rows.length; i++) {
    const cell = _normStr(String(rows[i][0] || ''));
    if (cell && !['cong trinh','ct','congtrinh','project','stt','#','id'].includes(cell)) return i;
  }
  return 0;
}

// ══════════════════════════════════════════════════════════════
// [5] PROCESS WORKBOOK
// ══════════════════════════════════════════════════════════════

function _processImportWorkbook(wb, filename) {
  const result = { inv: [], ung: [], cc: [], tb: [], cats: {}, hd: [], thu: [], tp: [] };
  const logOk  = [];
  const logErr = [];

  // Nhận dạng sheet theo tên — invQ/invD/inv đều gộp vào result.inv
  const detected = {};
  wb.SheetNames.forEach(name => {
    const t = _detectSheetType(name);
    if (!t) return;
    const key = (t === 'invQ' || t === 'invD') ? 'inv' : t;
    if (key === 'inv') {
      // Cho phép cả 2 sheet hóa đơn
      if (!detected.inv)  detected.inv  = name;
      else if (!detected.inv2) detected.inv2 = name;
    } else if (!detected[key]) {
      detected[key] = name;
    }
  });

  // Fallback: nếu không nhận được tên → gán theo thứ tự
  const fallback = ['inv','ung','cc','tb','cats','hd','thu','tp'];
  wb.SheetNames.forEach((name, idx) => {
    const t = fallback[idx];
    if (t && !detected[t]) detected[t] = name;
  });

  // ── HoaDon (nhanh + chi tiết đều parse như nhau)
  ['inv','inv2'].forEach(key => {
    if (!detected[key]) return;
    const rows = _sheetRows(wb.Sheets[detected[key]]);
    const { records, errors } = _parseInvSheet(rows);
    result.inv.push(...records);
    errors.forEach(e => logErr.push(`[Hóa Đơn] ${e}`));
  });
  if (result.inv.length) logOk.push(`✅ Hóa Đơn: ${result.inv.length} bản ghi`);

  // ── TienUng
  if (detected.ung) {
    const rows = _sheetRows(wb.Sheets[detected.ung]);
    const { records, errors } = _parseUngSheet(rows);
    result.ung = records;
    if (records.length) logOk.push(`✅ Tiền Ứng: ${records.length} bản ghi`);
    errors.forEach(e => logErr.push(`[Tiền Ứng] ${e}`));
  }

  // ── ChamCong
  if (detected.cc) {
    const rows = _sheetRows(wb.Sheets[detected.cc]);
    const { records, errors } = _parseCCSheet(rows);
    result.cc = records;
    if (records.length) {
      const n = records.reduce((s, w) => s + w.workers.length, 0);
      logOk.push(`✅ Chấm Công: ${records.length} tuần, ${n} CN`);
    }
    errors.forEach(e => logErr.push(`[Chấm Công] ${e}`));
  }

  // ── ThietBi
  if (detected.tb) {
    const rows = _sheetRows(wb.Sheets[detected.tb]);
    const { records, errors } = _parseTbSheet(rows);
    result.tb = records;
    if (records.length) logOk.push(`✅ Thiết Bị: ${records.length} bản ghi`);
    errors.forEach(e => logErr.push(`[Thiết Bị] ${e}`));
  }

  // ── DanhMuc
  if (detected.cats) {
    const rows = _sheetRows(wb.Sheets[detected.cats]);
    result.cats = _parseCatsSheet(rows);
    const { ct, loai, ncc, tp } = result.cats;
    if (ct.length || loai.length || ncc.length || tp.length)
      logOk.push(`✅ Danh Mục: ${ct.length} CT, ${loai.length} Loại, ${ncc.length} NCC, ${tp.length} TP`);
  }

  // ── HopDong
  if (detected.hd) {
    const rows = _sheetRows(wb.Sheets[detected.hd]);
    const { records, errors } = _parseHdSheet(rows);
    result.hd = records;
    if (records.length) logOk.push(`✅ Hợp Đồng: ${records.length} CT`);
    errors.forEach(e => logErr.push(`[Hợp Đồng] ${e}`));
  }

  // ── ThuTien
  if (detected.thu) {
    const rows = _sheetRows(wb.Sheets[detected.thu]);
    const { records, errors } = _parseThuSheet(rows);
    result.thu = records;
    if (records.length) logOk.push(`✅ Thu Tiền: ${records.length} bản ghi`);
    errors.forEach(e => logErr.push(`[Thu Tiền] ${e}`));
  }

  // ── ThauPhu (HĐ)
  if (detected.tp) {
    const rows = _sheetRows(wb.Sheets[detected.tp]);
    const { records, errors } = _parseTpSheet(rows);
    result.tp = records;
    if (records.length) logOk.push(`✅ HĐ Thầu Phụ: ${records.length} bản ghi`);
    errors.forEach(e => logErr.push(`[HĐ Thầu Phụ] ${e}`));
  }

  const total = result.inv.length + result.ung.length + result.cc.length + result.tb.length
              + result.hd.length  + result.thu.length + result.tp.length;
  const hasCats = Object.values(result.cats).some(a => a && a.length);

  if (total === 0 && !hasCats) {
    if (logErr.length)
      toast('❌ Không có dữ liệu hợp lệ.\n' + logErr.slice(0, 3).join('\n'), 'error');
    else
      toast('⚠️ Không tìm thấy dữ liệu trong file!', 'error');
    return;
  }

  _showImportPreview(result, logOk, logErr, filename);
}

// ══════════════════════════════════════════════════════════════
// [6] IMPORT PREVIEW MODAL
// ══════════════════════════════════════════════════════════════

function _showImportPreview(result, logOk, logErr, filename) {
  let ov = document.getElementById('import-modal-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'import-modal-overlay';
    ov.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;align-items:center;justify-content:center';
    ov.onclick = function(e) { if (e.target === this) ov.style.display = 'none'; };
    document.body.appendChild(ov);
  }

  const years = new Set();
  result.inv.forEach(i => { if (i.ngay) years.add(i.ngay.slice(0, 4)); });
  result.ung.forEach(u => { if (u.ngay) years.add(u.ngay.slice(0, 4)); });
  result.cc .forEach(w => { if (w.fromDate) years.add(w.fromDate.slice(0, 4)); });
  result.thu.forEach(r => { if (r.ngay) years.add(r.ngay.slice(0, 4)); });

  const errSection = logErr.length
    ? `<div style="background:#fff3cd;border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:11px;color:#856404;max-height:100px;overflow-y:auto">
        <strong>⚠️ ${logErr.length} cảnh báo bị bỏ qua:</strong><br>
        ${logErr.slice(0, 10).map(e => `<div>${e}</div>`).join('')}
        ${logErr.length > 10 ? `<div>…và ${logErr.length - 10} cảnh báo khác</div>` : ''}
      </div>`
    : '';

  ov.innerHTML = `<div onclick="event.stopPropagation()" style="max-width:500px;width:95vw;background:#fff;border-radius:16px;padding:24px;font-family:'IBM Plex Sans',sans-serif;box-shadow:0 12px 48px rgba(0,0,0,.18);max-height:90vh;overflow-y:auto">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h3 style="font-size:16px;font-weight:800;margin:0">📥 Xem Trước Import</h3>
      <button onclick="document.getElementById('import-modal-overlay').style.display='none'" style="background:none;border:none;font-size:22px;cursor:pointer;color:#888">✕</button>
    </div>
    <div style="background:#f0f4ff;border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:12px;color:#333">
      <strong>📄 File:</strong> ${filename}<br>
      <strong>📅 Năm dữ liệu:</strong> ${[...years].sort().join(', ') || '—'}
    </div>
    <div style="margin-bottom:12px">
      ${logOk.map(l => `<div style="padding:5px 10px;margin-bottom:4px;background:#f0fff4;border-left:3px solid #1a7a45;border-radius:4px;font-size:12px">${l}</div>`).join('')}
    </div>
    ${errSection}
    <div style="background:#fff8e1;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:12px;color:#795548">
      ⚠️ Dữ liệu mới sẽ được <strong>gộp</strong> vào dữ liệu hiện có (không xoá dữ liệu cũ).
      ${typeof fbReady === 'function' && fbReady()
        ? '<br>Sau khi nhập sẽ tự động đồng bộ lên Firebase.'
        : '<br>Chưa kết nối Firebase — chỉ lưu local.'}
    </div>
    <div style="display:flex;gap:8px">
      <button onclick="document.getElementById('import-modal-overlay').style.display='none'" style="flex:1;padding:11px;border-radius:8px;border:1.5px solid #ccc;background:#fff;font-family:inherit;font-size:13px;cursor:pointer">Huỷ</button>
      <button onclick="_confirmImport()" style="flex:2;padding:11px;border-radius:8px;border:none;background:#1a1814;color:#fff;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer">✅ Xác Nhận Import</button>
    </div>
  </div>`;
  ov.style.display = 'flex';
  ov._importResult = result;
}

// ══════════════════════════════════════════════════════════════
// [7] CONFIRM IMPORT — merge toàn bộ + refresh UI + sync
// ══════════════════════════════════════════════════════════════

function _confirmImport() {
  const ov     = document.getElementById('import-modal-overlay');
  const result = ov._importResult;
  if (!result) return;
  ov.style.display = 'none';

  // Merge array: dedup theo id + updatedAt (mergeUnique từ core.js)
  const _importMerge = (key, incoming, assign) => {
    if (!incoming || !incoming.length) return;
    const merged = mergeUnique(load(key, []), incoming);
    localStorage.setItem(key, JSON.stringify(merged));
    _dbSave(key, merged).catch(() => {});
    if (assign) assign(load(key, []));
  };

  _importMerge('inv_v3',     result.inv, v => { invoices         = v; });
  _importMerge('ung_v1',     result.ung, v => { ungRecords       = v; });
  _importMerge('cc_v2',      result.cc,  v => { ccData           = v; });
  _importMerge('tb_v1',      result.tb,  v => { tbData           = v; });
  _importMerge('thu_v1',     result.thu, v => { thuRecords       = v; });
  _importMerge('thauphu_v1', result.tp,  v => { thauPhuContracts = v; });

  // HopDong — object keyed by CT name (upsert, không ghi đè khi đã có giá trị)
  if (result.hd && result.hd.length) {
    const now      = Date.now();
    const existing = load('hopdong_v1', {});
    result.hd.forEach(row => {
      const cur = existing[row.ct];
      if (!cur || cur.deletedAt) {
        existing[row.ct] = {
          giaTri:          row.giaTri        || 0,
          giaTriphu:       row.giaTriphu     || 0,
          phanHoanThien:   row.phanHoanThien || 0,
          phatSinh:        row.phatSinh      || 0,
          ghichu:          row.ghichu        || '',
          ngay:            today(),
          createdAt:       now,
          updatedAt:       now,
          deletedAt:       null,
        };
      } else {
        // Cập nhật: chỉ ghi đè khi giá trị import khác 0
        existing[row.ct] = {
          ...cur,
          giaTri:         row.giaTri        || cur.giaTri         || 0,
          giaTriphu:      row.giaTriphu     || cur.giaTriphu      || 0,
          phanHoanThien:  row.phanHoanThien || cur.phanHoanThien  || 0,
          phatSinh:       row.phatSinh      || cur.phatSinh       || 0,
          ghichu:         row.ghichu        || cur.ghichu         || '',
          updatedAt:      now,
        };
      }
    });
    save('hopdong_v1', existing);
    hopDongData = load('hopdong_v1', {});
  }

  // Merge danh mục (Set dedup)
  const c = result.cats || {};
  const _mergeCat = (key, incoming, assign) => {
    if (!incoming || !incoming.length) return;
    const merged = [...new Set([...load(key, []), ...incoming])];
    localStorage.setItem(key, JSON.stringify(merged));
    _dbSave(key, merged).catch(() => {});
    if (assign) assign(merged);
  };
  _mergeCat('cat_ct',    c.ct,    v => { cats.congTrinh  = v; });
  _mergeCat('cat_loai',  c.loai,  v => { cats.loaiChiPhi = v; });
  _mergeCat('cat_ncc',   c.ncc,   v => { cats.nhaCungCap = v; });
  _mergeCat('cat_nguoi', c.nguoi, v => { cats.nguoiTH    = v; });
  _mergeCat('cat_tp',    c.tp,    v => { cats.thauPhu    = v; });
  _mergeCat('cat_cn',    c.cn,    v => { cats.congNhan   = v; });

  if (result.cc.length && typeof rebuildCCCategories === 'function') {
    rebuildCCCategories();
  }

  // Nếu năm của dữ liệu import khác activeYear → chuyển sang "Tất cả" để tránh bị ẩn
  const _importYears = new Set();
  result.inv.forEach(r => { if (r.ngay)     _importYears.add(parseInt(r.ngay.slice(0, 4))); });
  result.ung.forEach(r => { if (r.ngay)     _importYears.add(parseInt(r.ngay.slice(0, 4))); });
  result.cc .forEach(r => { if (r.fromDate) _importYears.add(parseInt(r.fromDate.slice(0, 4))); });
  result.thu.forEach(r => { if (r.ngay)     _importYears.add(parseInt(r.ngay.slice(0, 4))); });
  if (_importYears.size > 0 && activeYear !== 0 && ![..._importYears].includes(activeYear)) {
    // Import có dữ liệu năm khác activeYear → chuyển về "Tất cả"
    activeYear = 0;
    const yearSel = document.getElementById('global-year');
    if (yearSel) yearSel.value = '0';
  }

  // Refresh toàn bộ UI
  if (typeof buildYearSelect      === 'function') buildYearSelect();
  if (typeof rebuildEntrySelects  === 'function') rebuildEntrySelects();
  if (typeof rebuildUngSelects    === 'function') rebuildUngSelects();
  if (typeof buildFilters         === 'function') buildFilters();
  if (typeof filterAndRender      === 'function') filterAndRender();
  if (typeof renderTrash          === 'function') renderTrash();
  if (typeof renderCCHistory      === 'function') renderCCHistory();
  if (typeof renderCCTLT          === 'function') renderCCTLT();
  if (typeof buildUngFilters      === 'function') buildUngFilters();
  if (typeof filterAndRenderUng   === 'function') filterAndRenderUng();
  if (typeof renderCtPage         === 'function') renderCtPage();
  if (typeof renderSettings       === 'function') renderSettings();
  if (typeof updateTop            === 'function') updateTop();
  if (typeof dtPopulateSels       === 'function') dtPopulateSels();
  if (typeof renderLaiLo          === 'function') renderLaiLo();
  if (typeof renderCongNoThauPhu  === 'function') renderCongNoThauPhu();

  toast('✅ Import thành công!', 'success');
  // Push lên Firebase sớm (500ms) thay vì chờ processQueue 2.5s
  // Tránh trường hợp cloud pull xảy ra trước khi data import được đẩy lên
  if (typeof pushChanges === 'function') {
    setTimeout(() => pushChanges(), 500);
  } else if (typeof processQueue === 'function') {
    processQueue();
  }
}

// ══════════════════════════════════════════════════════════════
// [8] FILE INPUT HANDLERS
// ══════════════════════════════════════════════════════════════

function openImportModal() {
  document.getElementById('import-file-input').click();
}

function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = '';
  const reader = new FileReader();
  reader.onload = function(ev) {
    try {
      const wb = XLSX.read(ev.target.result, { type: 'array' });
      _processImportWorkbook(wb, file.name);
    } catch (err) {
      toast('❌ Không đọc được file Excel: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

// ══════════════════════════════════════════════════════════════
// [9] EXPORT MODAL + EXPORT EXCEL — 9 sheets
// ══════════════════════════════════════════════════════════════

function openExportModal() {
  let ov = document.getElementById('export-modal-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'export-modal-overlay';
    ov.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;align-items:center;justify-content:center';
    ov.onclick = function(e) { if (e.target === this) ov.style.display = 'none'; };
    document.body.appendChild(ov);
  }

  const yearStats = {};
  const _addStat  = (dateStr, key) => {
    const y = dateStr ? dateStr.slice(0, 4) : '';
    if (!y || y === '?') return;
    if (!yearStats[y]) yearStats[y] = { inv: 0, ung: 0, cc: 0, tb: 0, thu: 0, tp: 0 };
    yearStats[y][key]++;
  };
  invoices.filter(i       => !i.deletedAt && !i.ccKey).forEach(i => _addStat(i.ngay, 'inv'));
  ungRecords.filter(u     => !u.deletedAt && !u.cancelled).forEach(u => _addStat(u.ngay, 'ung'));
  ccData.filter(w         => !w.deletedAt).forEach(w => _addStat(w.fromDate, 'cc'));
  tbData.filter(t         => !t.deletedAt).forEach(t => _addStat(t.ngay || '', 'tb'));
  thuRecords.filter(r     => !r.deletedAt).forEach(r => _addStat(r.ngay, 'thu'));
  thauPhuContracts.filter(r => !r.deletedAt).forEach(r => _addStat(r.ngay || '', 'tp'));

  const sortedYears = Object.keys(yearStats).sort((a, b) => b - a);
  const curYr       = activeYear && activeYear !== 0 ? String(activeYear) : '';

  ov.innerHTML = `<div onclick="event.stopPropagation()" style="max-width:460px;width:95vw;background:#fff;border-radius:16px;padding:24px;font-family:'IBM Plex Sans',sans-serif;box-shadow:0 12px 48px rgba(0,0,0,.2);max-height:90vh;overflow-y:auto">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h3 style="font-size:16px;font-weight:800;margin:0">📤 Xuất Dữ Liệu Ra Excel</h3>
      <button onclick="document.getElementById('export-modal-overlay').style.display='none'" style="background:none;border:none;font-size:22px;cursor:pointer;color:#888">✕</button>
    </div>
    <div style="margin-bottom:14px">
      <label style="font-size:12px;font-weight:700;color:#444;display:block;margin-bottom:6px">Chọn năm xuất:</label>
      <select id="export-year-sel" style="width:100%;padding:9px 12px;border:1.5px solid #ddd;border-radius:8px;font-family:inherit;font-size:13px;font-weight:600;color:#1a1814;outline:none">
        <option value="0">📅 Tất cả năm</option>
        ${sortedYears.map(y =>
          `<option value="${y}" ${y === curYr ? 'selected' : ''}>${y} — ${yearStats[y].inv} HĐ · ${yearStats[y].ung} ứng · ${yearStats[y].cc} tuần CC${yearStats[y].thu ? ' · ' + yearStats[y].thu + ' thu' : ''}${yearStats[y].tp ? ' · ' + yearStats[y].tp + ' HĐTP' : ''}</option>`
        ).join('')}
      </select>
    </div>
    <div style="background:#f0f4ff;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#333;line-height:1.8">
      <strong>File xuất gồm 9 sheets:</strong><br>
      <span style="color:#555">
        HoaDonNhanh · HoaDonChiTiet · TienUng · ChamCong · ThietBi<br>
        DanhMuc · HopDong · ThuTien · ThauPhu
      </span><br>
      <span style="color:#888;font-size:11px">File có thể import lại trực tiếp (round-trip).</span>
    </div>
    <div style="display:flex;gap:8px">
      <button onclick="document.getElementById('export-modal-overlay').style.display='none'" style="flex:1;padding:11px;border-radius:8px;border:1.5px solid #ccc;background:#fff;font-family:inherit;font-size:13px;cursor:pointer">Huỷ</button>
      <button onclick="_doExport()" style="flex:2;padding:11px;border-radius:8px;border:none;background:#1a7a45;color:#fff;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer">📥 Tải File Excel</button>
    </div>
  </div>`;
  ov.style.display = 'flex';
}

function _doExport() {
  const sel = document.getElementById('export-year-sel');
  const yr  = sel ? parseInt(sel.value) || 0 : 0;
  document.getElementById('export-modal-overlay').style.display = 'none';

  const filterY = d => yr === 0 || (d && d.startsWith(String(yr)));

  const expInv = invoices.filter(i         => !i.deletedAt && !i.ccKey && filterY(i.ngay));
  const expUng = ungRecords.filter(u        => !u.deletedAt && !u.cancelled && filterY(u.ngay));
  const expCC  = ccData.filter(w            => !w.deletedAt && filterY(w.fromDate));
  const expTb  = tbData.filter(t            => !t.deletedAt && (yr === 0 || filterY(t.ngay)));
  const expThu = thuRecords.filter(r        => !r.deletedAt && filterY(r.ngay));
  const expTp  = thauPhuContracts.filter(r  => !r.deletedAt && (yr === 0 || filterY(r.ngay)));
  const expHd  = Object.entries(hopDongData).filter(([, v]) => !v.deletedAt);

  const wb = XLSX.utils.book_new();

  // ── Sheet 1: HoaDonNhanh — nhập nhanh (sl=1, không tách đơn giá)
  // Columns: id · ngay · congtrinh · loai · nd · tien · nguoi · ncc · sohd
  const invQ_rows = expInv.filter(i => (i.sl || 1) <= 1);
  const invQ_data = [['id','ngay','congtrinh','loai','nd','tien','nguoi','ncc','sohd']];
  invQ_rows.forEach(i => invQ_data.push([
    i.id || '', i.ngay || '', i.congtrinh || '', i.loai || '', i.nd || '',
    i.thanhtien || i.tien || 0,
    i.nguoi || '', i.ncc || '', i.sohd || '',
  ]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(invQ_data), 'HoaDonNhanh');

  // ── Sheet 2: HoaDonChiTiet — đầy đủ dongia × soluong
  // Columns: id · ngay · congtrinh · loai · nd · dongia · soluong · tien · nguoi · ncc · sohd
  const inv_data = [['id','ngay','congtrinh','loai','nd','dongia','soluong','tien','nguoi','ncc','sohd']];
  expInv.forEach(i => inv_data.push([
    i.id || '', i.ngay || '', i.congtrinh || '', i.loai || '', i.nd || '',
    i.tien || 0, i.sl || 1, i.thanhtien || i.tien || 0,
    i.nguoi || '', i.ncc || '', i.sohd || '',
  ]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(inv_data), 'HoaDonChiTiet');

  // ── Sheet 3: TienUng
  // Columns: id · ngay · congtrinh · nguoi · tien · nd · loai
  const ung_data = [['id','ngay','congtrinh','nguoi','tien','nd','loai']];
  expUng.forEach(u => ung_data.push([
    u.id || '', u.ngay || '', u.congtrinh || '', u.tp || '',
    u.tien || 0, u.nd || '', u.loai || 'thauphu',
  ]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ung_data), 'TienUng');

  // ── Sheet 4: ChamCong
  // Columns: ngayDauTuan · congtrinh · ten · luong · phucap · hdmuale · cn · t2…t7 · ghichu
  const cc_data = [['ngayDauTuan','congtrinh','ten','luong','phucap','hdmuale','cn','t2','t3','t4','t5','t6','t7','ghichu']];
  expCC.forEach(w => {
    (w.workers || []).forEach(wk => {
      const d = wk.d || [0, 0, 0, 0, 0, 0, 0];
      cc_data.push([
        w.fromDate || '', w.ct || '', wk.name || '',
        wk.luong || 0, wk.phucap || 0, wk.hdmuale || 0,
        d[0]||0, d[1]||0, d[2]||0, d[3]||0, d[4]||0, d[5]||0, d[6]||0,
        wk.nd || '',
      ]);
    });
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cc_data), 'ChamCong');

  // ── Sheet 5: ThietBi
  // Columns: id · congtrinh · ten · soluong · tinhtrang · nguoi · ngay · ghichu
  const tb_data = [['id','congtrinh','ten','soluong','tinhtrang','nguoi','ngay','ghichu']];
  expTb.forEach(t => tb_data.push([
    t.id || '', t.ct || '', t.ten || '', t.soluong || 1,
    t.tinhtrang || '', t.nguoi || '', t.ngay || '', t.ghichu || '',
  ]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(tb_data), 'ThietBi');

  // ── Sheet 6: DanhMuc — 7 cột
  // Columns: congtrinh · loaichiphi · nhacc · nguoithuchien · thauphu · congnhan · thietbi
  const dm_data = [['congtrinh','loaichiphi','nhacc','nguoithuchien','thauphu','congnhan','thietbi']];
  const maxDm = Math.max(
    cats.congTrinh.length, cats.loaiChiPhi.length,
    cats.nhaCungCap.length, cats.nguoiTH.length,
    cats.thauPhu.length, cats.congNhan.length, 0,
  );
  for (let i = 0; i < maxDm; i++) {
    dm_data.push([
      cats.congTrinh[i]  || '',
      cats.loaiChiPhi[i] || '',
      cats.nhaCungCap[i] || '',
      cats.nguoiTH[i]    || '',
      cats.thauPhu[i]    || '',
      cats.congNhan[i]   || '',
      '',  // thietbi — chưa có danh mục riêng
    ]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dm_data), 'DanhMuc');

  // ── Sheet 7: HopDong
  // Columns: congtrinh · giatrihopdong · phantho · phanhoanthien · phatsinh · ghichu
  const hd_data = [['congtrinh','giatrihopdong','phantho','phanhoanthien','phatsinh','ghichu']];
  expHd.forEach(([ct, hd]) => hd_data.push([
    ct,
    hd.giaTri          || 0,
    hd.giaTriphu       || 0,
    hd.phanHoanThien   || 0,
    hd.phatSinh        || 0,
    hd.ghichu          || '',
  ]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(hd_data), 'HopDong');

  // ── Sheet 8: ThuTien
  // Columns: id · congtrinh · ngay · sotien · nguoith · ghichu
  const thu_data = [['id','congtrinh','ngay','sotien','nguoith','ghichu']];
  expThu.forEach(r => thu_data.push([
    r.id || '', r.congtrinh || '', r.ngay || '',
    r.tien || 0, r.nguoi || '', r.nd || '',
  ]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(thu_data), 'ThuTien');

  // ── Sheet 9: ThauPhu
  // Columns: id · congtrinh · tenthau · ngay · giatri · phatsinh · ghichu
  const tp_data = [['id','congtrinh','tenthau','ngay','giatri','phatsinh','ghichu']];
  expTp.forEach(r => tp_data.push([
    r.id || '', r.congtrinh || '', r.thauphu || '', r.ngay || '',
    r.giaTri || 0, r.phatSinh || 0, r.nd || '',
  ]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(tp_data), 'ThauPhu');

  const fname = yr === 0 ? 'export_tat_ca_nam.xlsx' : `export_${yr}.xlsx`;
  XLSX.writeFile(wb, fname);

  const cnCount = expCC.reduce((s, w) => s + (w.workers || []).length, 0);
  toast(
    `✅ Đã xuất ${expInv.length} HĐ · ${expUng.length} ứng · ${cnCount} CN · ${expThu.length} thu · ${expTp.length} HĐTP · ${expHd.length} HĐ chính`,
    'success'
  );
}

// ══════════════════════════════════════════════════════════════
// [10] CSV EXPORTS
// ══════════════════════════════════════════════════════════════

function exportEntryCSV() {
  const rows = [['Loại Chi Phí','Công Trình','Người TH','Nhà Cung Cấp','Nội Dung','Số Tiền']];
  document.querySelectorAll('#entry-tbody tr').forEach(tr => {
    const loai = tr.querySelector('[data-f="loai"]')?.value || '';
    const ct   = tr.querySelector('[data-f="ct"]')?.value   || '';
    if (!loai && !ct) return;
    const tien = parseInt(tr.querySelector('[data-f="tien"]')?.dataset.raw || '0', 10) || 0;
    rows.push([loai, ct,
      tr.querySelector('[data-f="nguoi"]')?.value || '',
      tr.querySelector('[data-f="ncc"]')?.value   || '',
      tr.querySelector('[data-f="nd"]')?.value     || '',
      tien,
    ]);
  });
  dlCSV(rows, 'nhap_' + today() + '.csv');
}

function exportAllCSV() {
  const src  = (typeof filteredInvs !== 'undefined' && filteredInvs.length > 0) ? filteredInvs : buildInvoices();
  const rows = [['Ngày','Công Trình','Loại Chi Phí','Người TH','Nhà Cung Cấp','Nội Dung','Số Tiền']];
  src.filter(i => !i.deletedAt).forEach(i =>
    rows.push([i.ngay, i.congtrinh, i.loai, i.nguoi, i.ncc || '', i.nd, i.tien || i.thanhtien || 0])
  );
  dlCSV(rows, 'hoa_don_' + today() + '.csv');
}

// ══════════════════════════════════════════════════════════════
// [11] MISC
// ══════════════════════════════════════════════════════════════

function openDeleteModal() {
  toast('Tính năng Xóa Dữ Liệu đã bị tắt.', 'error');
}

// ══════════════════════════════════════════════════════════════
// [12] PUBLIC WRAPPERS (gọi từ HTML onclick)
// ══════════════════════════════════════════════════════════════

function toolExportJSON()  { exportJSON(); }
function toolImportJSON()  { document.getElementById('import-json-input').click(); }
function toolImportExcel() { document.getElementById('import-file-input').click(); }
function toolExportExcel() { openExportModal(); }
