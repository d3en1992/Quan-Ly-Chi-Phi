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

// Số không phải tiền (ngày công, số lượng, v.v.)
function _num(v) { return parseFloat(String(v || '').replace(/[^0-9.\-]/g, '')) || 0; }

// Locale number: xử lý 1.000.000 / 1,000,000 / 1.5 / 1,5
function _pNum(s) {
  s = String(s || '').replace(/[^0-9.,\-]/g, '');
  if (!s) return 0;
  const dots   = (s.match(/\./g) || []).length;
  const commas = (s.match(/,/g)  || []).length;
  if (dots   > 1) s = s.replace(/\./g, '');   // 1.000.000 → 1000000
  if (commas > 1) s = s.replace(/,/g, '');    // 1,000,000 → 1000000
  s = s.replace(',', '.');                     // 1,5 → 1.5
  return parseFloat(s) || 0;
}

// Số tiền — hiểu "1tr", "1.5tr", "500k" + dấu phân cách locale
function _money(v) {
  if (!v && v !== 0) return 0;
  const s = String(v).trim().toLowerCase().replace(/\s/g, '');
  if (!s) return 0;
  // 1tr / 1.5tr / 1,5tr
  const mTr = s.match(/^([0-9][0-9,.]*)tr/);
  if (mTr) return Math.round(_pNum(mTr[1]) * 1e6);
  // 500k
  const mK = s.match(/^([0-9][0-9,.]*)k$/);
  if (mK) return Math.round(_pNum(mK[1]) * 1e3);
  return _pNum(s);
}

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
    nd:        ['nd','noi dung','description','dien giai','mo ta','ten hang hoa','hang hoa vat tu','ten vat tu'],
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
    tp:        ['nguoi','tp','thau phu','nha cc','ten','nha cung cap','supplier','ten thau phu','ten cong nhan'],
    tien:      ['tien','so tien','amount','so tien ung'],
    nd:        ['nd','noi dung','description','ghi chu'],
    loai:      ['loai','type','loai ung','doi tuong','doituong'],
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
    giatriphu:     ['phantho','phan tho','hd phu','gia tri hd phu','hdphu','hop dong phu','gia tri phu','gia tri hop dong phu'],
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
  return (ci !== undefined && ci >= 0) ? (row[ci] !== undefined ? row[ci] : '') : '';
}

// File export không còn cột ID → luôn tạo UUID mới khi import
function _getId(row, colMap, fallbackIdx) {
  const v = _str(_get(row, colMap, 'id', fallbackIdx));
  return v || uuid();
}

// ══════════════════════════════════════════════════════════════
// [3] SHEET TYPE DETECTION
// ══════════════════════════════════════════════════════════════

function _detectSheetType(name) {
  const n = _normStr(name);
  // Numbered sheet names (new format: "1_HoaDonNhanh", etc.)
  // After _normStr, underscore → space: "1 hoadonnhanh"
  if (n.includes('hoa don nhanh') || n.includes('hoadonnhanh'))             return 'invQ';
  if (n.includes('hoa don chi tiet') || n.includes('hoadonchitiet'))         return 'invD';
  if (n.includes('hoa don') || n.includes('chi phi') || n.match(/^1[ _]/) || n.match(/^1\b/)) return 'inv';
  if (n.includes('tien ung') || n.includes('tienung') || n.match(/^4[ _]/) || n.match(/^4\b/)) return 'ung';
  if (n.includes('cham cong') || n.includes('chamcong') || n.match(/^3[ _]/) || n.match(/^3\b/)) return 'cc';
  if (n.includes('thiet bi') || n.includes('thietbi') || n.match(/^5[ _]/) || n.match(/^5\b/)) return 'tb';
  if (n.includes('danh muc') || n.includes('danhmuc') || n.match(/^6[ _]/) || n.match(/^6\b/)) return 'cats';
  if (n.includes('hop dong chinh') || n.includes('hopdongchinh') || n.includes('hop dong') || n.includes('hopdong') || n.match(/^7[ _]/) || n.match(/^7\b/)) return 'hd';
  if (n.includes('thu tien') || n.includes('thutien') || n.match(/^8[ _]/) || n.match(/^8\b/)) return 'thu';
  if (n.includes('thau phu') || n.includes('thauphu') || n.match(/^9[ _]/) || n.match(/^9\b/)) return 'tp';
  return null;
}

// ══════════════════════════════════════════════════════════════
// [4] PARSE FUNCTIONS
// ══════════════════════════════════════════════════════════════

// ── 4a. HoaDonNhanh — mỗi dòng = 1 hóa đơn độc lập (không gộp)
// Cột: NGÀY · CÔNG TRÌNH · LOẠI CHI PHÍ · NỘI DUNG · SỐ TIỀN · NGƯỜI THỰC HIỆN · NHÀ CUNG CẤP
function _parseInvNhanhSheet(rows) {
  const { headerIdx, colMap } = _detectHeader(rows, _ALIASES.inv);
  const dataStart = headerIdx >= 0 ? headerIdx + 1 : _findDateRow(rows);
  const errors = [], records = [];

  for (let i = dataStart; i < rows.length; i++) {
    const r = rows[i];
    if (r.every(c => !c && c !== 0)) continue;

    const ngay  = _parseDate(_get(r, colMap, 'ngay',      0));
    const ct    = _str      (_get(r, colMap, 'congtrinh', 1));
    const loai  = _str      (_get(r, colMap, 'loai',      2));
    const nd    = _str      (_get(r, colMap, 'nd',        3));
    // SỐ TIỀN → ưu tiên cột thanhtien, fallback cột tien
    const tien  = _money    (_get(r, colMap, 'thanhtien', 4)) || _money(_get(r, colMap, 'tien', 4));
    const nguoi = _str      (_get(r, colMap, 'nguoi',     5));
    const ncc   = _str      (_get(r, colMap, 'ncc',       6));
    const sohd  = _str      (_get(r, colMap, 'sohd',     -1));

    if (!ngay) { errors.push(`Hàng ${i+1}: Ngày không hợp lệ ("${r[0] || r[1]}")`); continue; }
    if (!ct)   { errors.push(`Hàng ${i+1}: Thiếu Công Trình`); continue; }
    if (!loai) { errors.push(`Hàng ${i+1}: Thiếu Loại Chi Phí`); continue; }
    if (!tien) { errors.push(`Hàng ${i+1}: Số tiền = 0`); continue; }

    const now = Date.now();
    records.push({
      id: uuid(), createdAt: now, updatedAt: now, deletedAt: null, deviceId: DEVICE_ID,
      ngay, congtrinh: ct, loai, nd, tien, sl: 1, thanhtien: tien, nguoi, ncc, sohd,
    });
  }
  return { records, errors };
}

// ── 4b. HoaDonChiTiet — group theo (ngay + congtrinh + loai)
// Nhiều dòng cùng ngày/CT/loại → 1 hóa đơn, thanhtien = tổng, nd = nối chuỗi
// Cột: NGÀY · CÔNG TRÌNH · LOẠI CHI PHÍ · TÊN HÀNG HÓA/VẬT TƯ · ĐƠN GIÁ · SỐ LƯỢNG · THÀNH TIỀN · NGƯỜI TH · NHÀ CC · SỐ HĐ
function _parseInvChiTietSheet(rows) {
  const { headerIdx, colMap } = _detectHeader(rows, _ALIASES.inv);
  const dataStart = headerIdx >= 0 ? headerIdx + 1 : _findDateRow(rows);
  const errors = [];
  // Dùng Map để group — O(n)
  const groupMap = new Map();

  for (let i = dataStart; i < rows.length; i++) {
    const r = rows[i];
    if (r.every(c => !c && c !== 0)) continue;

    const ngay   = _parseDate(_get(r, colMap, 'ngay',      0));
    const ct     = _str      (_get(r, colMap, 'congtrinh', 1));
    const loai   = _str      (_get(r, colMap, 'loai',      2));
    const nd     = _str      (_get(r, colMap, 'nd',        3));
    const dongia = _money    (_get(r, colMap, 'tien',      4));
    const sl     = _num      (_get(r, colMap, 'sl',        5)) || 1;
    // Ưu tiên THÀNH TIỀN, fallback đơn giá × số lượng
    const rowAmt = _money(_get(r, colMap, 'thanhtien', 6)) || (dongia * sl) || dongia;
    const nguoi  = _str      (_get(r, colMap, 'nguoi',     7));
    const ncc    = _str      (_get(r, colMap, 'ncc',       8));
    const sohd   = _str      (_get(r, colMap, 'sohd',      9));

    if (!ngay)   { errors.push(`Hàng ${i+1}: Ngày không hợp lệ ("${r[0] || r[1]}")`); continue; }
    if (!ct)     { errors.push(`Hàng ${i+1}: Thiếu Công Trình`); continue; }
    if (!loai)   { errors.push(`Hàng ${i+1}: Thiếu Loại Chi Phí`); continue; }
    if (!rowAmt) { errors.push(`Hàng ${i+1}: Số tiền = 0`); continue; }

    const key = `${ngay}|${ct}|${loai}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, { ngay, congtrinh: ct, loai, thanhtien: 0, _nds: [], nguoi: '', ncc: '', sohd: '' });
    }
    const g = groupMap.get(key);
    g.thanhtien += rowAmt;
    if (nd && !g._nds.includes(nd)) g._nds.push(nd);
    if (!g.nguoi && nguoi) g.nguoi = nguoi;
    if (!g.ncc   && ncc)   g.ncc   = ncc;
    if (!g.sohd  && sohd)  g.sohd  = sohd;
  }

  const now = Date.now();
  const records = [...groupMap.values()].map(g => ({
    id: uuid(), createdAt: now, updatedAt: now, deletedAt: null, deviceId: DEVICE_ID,
    ngay: g.ngay, congtrinh: g.congtrinh, loai: g.loai,
    nd: g._nds.join(' / '),
    tien: g.thanhtien, sl: 1, thanhtien: g.thanhtien,
    nguoi: g.nguoi, ncc: g.ncc, sohd: g.sohd,
  }));
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
    const tien  = _money    (_get(r, colMap, 'tien',      4));
    const nd    = _str      (_get(r, colMap, 'nd',        5));
    const loai  = _str      (_get(r, colMap, 'loai',      6)) || 'thauphu';
    const id    = _getId    (r, colMap, 7);

    if (!ngay) { errors.push(`Hàng ${i+1}: Ngày không hợp lệ`); continue; }
    if (!ct)   { errors.push(`Hàng ${i+1}: Thiếu Công Trình`); continue; }
    if (!tp)   { errors.push(`Hàng ${i+1}: Thiếu Tên Người / Thầu Phụ`); continue; }
    if (!tien) { errors.push(`Hàng ${i+1}: Số tiền = 0`); continue; }

    // Normalize loai: accept English keys OR Vietnamese display text
    let loaiNorm = 'thauphu';
    if (loai === 'congnhan' || loai === 'thauphu') {
      loaiNorm = loai;
    } else {
      const ln = _normStr(loai);
      if (ln.includes('cong nhan') || ln.includes('congnhan')) loaiNorm = 'congnhan';
    }

    const now = Date.now();
    records.push({
      id, createdAt: now, updatedAt: now, deletedAt: null, deviceId: DEVICE_ID,
      ngay, congtrinh: ct, tp, tien, nd,
      loai: loaiNorm,
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
    const luong    = _money    (_get(r, colMap, 'luong',    3));
    const phucap   = _money    (_get(r, colMap, 'phucap',   4));
    const hdmuale  = _money    (_get(r, colMap, 'hdmuale',  5));
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
    const giaTri       = _money(_get(r, colMap, 'giatri',        1));
    const giaTriphu    = _money(_get(r, colMap, 'giatriphu',     2));
    const phanHoanThien= _money(_get(r, colMap, 'phanhoanthien', 3));
    const phatSinh     = _money(_get(r, colMap, 'phatsinh',      4));
    const ghichu       = _str  (_get(r, colMap, 'ghichu',        5));

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
    const tien  = _money    (_get(r, colMap, 'sotien',    2));
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
    const giaTri   = _money    (_get(r, colMap, 'giatri',    3));
    const phatSinh = _money    (_get(r, colMap, 'phatsinh',  4));
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

// DanhMuc — hỗ trợ 2 định dạng:
// Cũ (7 cột): congtrinh · loaichiphi · nhacc · nguoithuchien · thauphu · congnhan · thietbi
// Mới (2 cột): LOẠI DANH MỤC | TÊN
function _parseCatsSheet(rows) {
  const cats = { ct: [], loai: [], ncc: [], nguoi: [], tp: [], cn: [], tbTen: [] };

  // Tìm header row (bỏ qua rows title/instructions)
  let dataStart = 1;
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const normed = (rows[i] || []).map(c => _normStr(String(c || '')));
    if (normed.some(h => h.includes('loai danh muc') || h.includes('loaidanhmuc') || h === 'ten' || h.includes('loai chi phi') || h.includes('cong trinh'))) {
      dataStart = i + 1;
      break;
    }
  }

  // Detect format: 2-cột mới nếu cột đầu có tên nhóm danh mục
  const _groupMap = {
    'cong trinh':              'ct',
    'congtrinh':               'ct',
    'loai chi phi':            'loai',
    'loaichiphi':              'loai',
    'nha cung cap':            'ncc',
    'nhacungcap':              'ncc',
    'nguoi thuc hien':         'nguoi',
    'nguoithuchien':           'nguoi',
    'thau phu':                'tp',
    'thauphu':                 'tp',
    'cong nhan':               'cn',
    'congnhan':                'cn',
    'may thiet bi thi cong':   'tbTen',
    'thiet bi thi cong':       'tbTen',
    'thietbi':                 'tbTen',
    'may thiet bi':            'tbTen',
  };

  // Kiểm tra cột đầu của row đầu tiên có phải tên nhóm không
  const firstDataRow = rows[dataStart] || [];
  const firstCellN = _normStr(String(firstDataRow[0] || ''));
  const isTwoCol = Object.keys(_groupMap).some(k => firstCellN === k || firstCellN.includes(k));

  if (isTwoCol) {
    // Format 2 cột: cột 0 = LOẠI DANH MỤC, cột 1 = TÊN
    for (let i = dataStart; i < rows.length; i++) {
      const r = rows[i];
      const groupRaw = _normStr(String(r[0] || ''));
      const item     = _str(r[1]);
      if (!item) continue;
      for (const [key, field] of Object.entries(_groupMap)) {
        if (groupRaw === key || groupRaw.includes(key)) {
          cats[field].push(item);
          break;
        }
      }
    }
  } else {
    // Format cũ 7 cột
    for (let i = dataStart; i < rows.length; i++) {
      const r = rows[i];
      if (_str(r[0])) cats.ct.push(_str(r[0]));
      if (_str(r[1])) cats.loai.push(_str(r[1]));
      if (_str(r[2])) cats.ncc.push(_str(r[2]));
      if (_str(r[3])) cats.nguoi.push(_str(r[3]));
      if (_str(r[4])) cats.tp.push(_str(r[4]));
      if (_str(r[5])) cats.cn.push(_str(r[5]));
      if (_str(r[6])) cats.tbTen.push(_str(r[6]));
    }
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

  // ── Nhận dạng sheet theo tên (ưu tiên tên, fallback theo vị trí)
  const detected = {};
  wb.SheetNames.forEach(name => {
    const t = _detectSheetType(name);
    if (!t) return;
    // invQ (HoaDonNhanh) và invD (HoaDonChiTiet) giữ riêng biệt
    if (!detected[t]) detected[t] = name;
  });

  // Fallback theo vị trí sheet nếu tên không nhận dạng được
  // Thứ tự chuẩn: 1_HoaDonNhanh · 2_HoaDonChiTiet · 3_ChamCong · 4_TienUng · 5_ThietBi · 6_DanhMuc · 7_HopDongChinh · 8_ThuTien · 9_HopDongThauPhu
  const fallback = ['invQ', 'invD', 'cc', 'ung', 'tb', 'cats', 'hd', 'thu', 'tp'];
  wb.SheetNames.forEach((name, idx) => {
    const t = fallback[idx];
    if (t && !detected[t]) detected[t] = name;
  });

  // ── Sheet 1: HoaDonNhanh — mỗi dòng = 1 hóa đơn
  if (detected.invQ) {
    const rows = _sheetRows(wb.Sheets[detected.invQ]);
    const { records, errors } = _parseInvNhanhSheet(rows);
    result.inv.push(...records);
    if (records.length) logOk.push(`✅ HĐ Nhanh: ${records.length} bản ghi`);
    errors.forEach(e => logErr.push(`[HĐ Nhanh] ${e}`));
  }

  // ── Sheet 2: HoaDonChiTiet — group theo (ngay + congtrinh + loai)
  if (detected.invD) {
    const rows = _sheetRows(wb.Sheets[detected.invD]);
    const { records, errors } = _parseInvChiTietSheet(rows);
    result.inv.push(...records);
    if (records.length) logOk.push(`✅ HĐ Chi Tiết: ${records.length} nhóm hóa đơn`);
    errors.forEach(e => logErr.push(`[HĐ Chi Tiết] ${e}`));
  }

  // Fallback: nếu có sheet 'inv' (format cũ) chưa được parse
  if (detected.inv && !detected.invQ && !detected.invD) {
    const rows = _sheetRows(wb.Sheets[detected.inv]);
    const { records, errors } = _parseInvNhanhSheet(rows);
    result.inv.push(...records);
    if (records.length) logOk.push(`✅ Hóa Đơn: ${records.length} bản ghi`);
    errors.forEach(e => logErr.push(`[Hóa Đơn] ${e}`));
  }

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

  const skipLog = [];

  // ── Dedup: lọc bỏ bản ghi đã tồn tại trong hệ thống
  // Key fingerprint cho từng loại dữ liệu
  if (result.inv && result.inv.length) {
    const existSet = new Set(
      invoices.filter(i => !i.deletedAt)
        .map(i => `${i.ngay}|${i.congtrinh}|${i.thanhtien || i.tien}|${(i.nd || '').substring(0, 50)}`)
    );
    const before = result.inv.length;
    result.inv = result.inv.filter(r => {
      const key = `${r.ngay}|${r.congtrinh}|${r.thanhtien || r.tien}|${(r.nd || '').substring(0, 50)}`;
      return !existSet.has(key);
    });
    const skipped = before - result.inv.length;
    if (skipped > 0) skipLog.push(`Bỏ qua ${skipped} hóa đơn trùng`);
  }

  if (result.ung && result.ung.length) {
    const existSet = new Set(
      ungRecords.filter(u => !u.deletedAt && !u.cancelled)
        .map(u => `${u.ngay}|${u.congtrinh}|${u.tp}|${u.tien}`)
    );
    const before = result.ung.length;
    result.ung = result.ung.filter(r => !existSet.has(`${r.ngay}|${r.congtrinh}|${r.tp}|${r.tien}`));
    const skipped = before - result.ung.length;
    if (skipped > 0) skipLog.push(`Bỏ qua ${skipped} tiền ứng trùng`);
  }

  if (result.thu && result.thu.length) {
    const existSet = new Set(
      thuRecords.filter(r => !r.deletedAt)
        .map(r => `${r.ngay}|${r.congtrinh}|${r.tien}`)
    );
    const before = result.thu.length;
    result.thu = result.thu.filter(r => !existSet.has(`${r.ngay}|${r.congtrinh}|${r.tien}`));
    const skipped = before - result.thu.length;
    if (skipped > 0) skipLog.push(`Bỏ qua ${skipped} thu tiền trùng`);
  }

  if (result.tp && result.tp.length) {
    const existSet = new Set(
      thauPhuContracts.filter(r => !r.deletedAt)
        .map(r => `${r.congtrinh}|${r.thauphu}|${r.giaTri}`)
    );
    const before = result.tp.length;
    result.tp = result.tp.filter(r => !existSet.has(`${r.congtrinh}|${r.thauphu}|${r.giaTri}`));
    const skipped = before - result.tp.length;
    if (skipped > 0) skipLog.push(`Bỏ qua ${skipped} HĐ thầu phụ trùng`);
  }

  // ── Merge array: dùng mergeUnique (dedup theo id + updatedAt từ core.js)
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

  const skipMsg = skipLog.length ? ' (' + skipLog.join(', ') + ')' : '';
  toast(`✅ Import thành công!${skipMsg}`, 'success');
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
        1_HoaDonNhanh · 2_HoaDonChiTiet · 3_ChamCong · 4_TienUng · 5_ThietBi<br>
        6_DanhMuc · 7_HopDongChinh · 8_ThuTien · 9_HopDongThauPhu
      </span><br>
      <span style="color:#888;font-size:11px">Header tiếng Việt có dấu · Ngày DD-MM-YYYY · Có thể import lại.</span>
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

  // ── Helpers ──────────────────────────────────────────────────
  // Format ngày YYYY-MM-DD → DD-MM-YYYY
  const fmtDate = d => {
    if (!d) return '';
    const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : String(d);
  };

  // Màu sắc
  const CLR_HEADER_BG  = '1A1A1A'; // Nền header: đen
  const CLR_HEADER_FG  = 'FFFFFF'; // Chữ header: trắng
  const CLR_TITLE_BG   = '1A3C34'; // Nền title: xanh đậm
  const CLR_TITLE_FG   = 'FFFFFF';
  const CLR_NOTE_BG    = 'F0F4FF'; // Nền ghi chú: xanh nhạt
  const CLR_NOTE_FG    = '444466';

  const S_TITLE = {
    font: { bold: true, sz: 12, color: { rgb: CLR_TITLE_FG } },
    fill: { fgColor: { rgb: CLR_TITLE_BG } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: false },
  };
  const S_NOTE = {
    font: { italic: true, sz: 9, color: { rgb: CLR_NOTE_FG } },
    fill: { fgColor: { rgb: CLR_NOTE_BG } },
    alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
  };
  const S_HEADER = {
    font: { bold: true, sz: 10, color: { rgb: CLR_HEADER_FG } },
    fill: { fgColor: { rgb: CLR_HEADER_BG } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  };
  const S_DATA = {
    alignment: { vertical: 'top', wrapText: false },
  };
  const S_NUMBER = {
    numFmt: '#,##0',
    alignment: { horizontal: 'right', vertical: 'top' },
  };

  /**
   * Tạo worksheet với:
   *   Row 0 — Dòng tiêu đề (merge toàn hàng)
   *   Row 1 — Dòng ghi chú hướng dẫn (merge toàn hàng)
   *   Row 2 — Header cột (nền đen, chữ trắng, đậm)
   *   Row 3+ — Dữ liệu
   *
   * @param {Array<{label:string, w:number, num?:boolean}>} cols  - định nghĩa cột
   * @param {Array<Array>}                                  data  - mảng dữ liệu
   * @param {string}                                        title - tiêu đề sheet
   * @param {string}                                        note  - ghi chú hướng dẫn
   */
  const _mkSheet = (cols, data, title, note) => {
    const nCols = cols.length;
    const headers = cols.map(c => c.label);

    // AOA: title · note · header · ...data
    const aoa = [
      [title, ...Array(nCols - 1).fill('')],
      [note,  ...Array(nCols - 1).fill('')],
      headers,
      ...data,
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Merge title + note dòng toàn hàng
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: nCols - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: nCols - 1 } },
    ];

    // Độ rộng cột
    ws['!cols'] = cols.map(c => ({ wch: c.w || 15 }));

    // Freeze: đóng băng sau 3 dòng đầu (title + note + header)
    ws['!freeze'] = { xSplit: 0, ySplit: 3 };

    // Chiều cao dòng
    ws['!rows'] = [
      { hpt: 26 }, // title
      { hpt: 18 }, // note
      { hpt: 22 }, // header
    ];

    // Style từng ô
    for (let r = 0; r < aoa.length; r++) {
      for (let c = 0; c < nCols; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!ws[addr]) ws[addr] = { t: 's', v: '' };
        if (r === 0) {
          ws[addr].s = S_TITLE;
        } else if (r === 1) {
          ws[addr].s = S_NOTE;
        } else if (r === 2) {
          ws[addr].s = S_HEADER;
        } else {
          // Cột số → căn phải + format tiền
          if (cols[c] && cols[c].num) {
            ws[addr].s = S_NUMBER;
          } else {
            ws[addr].s = S_DATA;
          }
        }
      }
    }

    return ws;
  };

  const wb = XLSX.utils.book_new();

  // ════════════════════════════════════════════════════════════
  // Sheet 1: 1_HoaDonNhanh — nhập nhanh (sl=1)
  // Cột: NGÀY · CÔNG TRÌNH · LOẠI CHI PHÍ · NỘI DUNG · SỐ TIỀN · NGƯỜI THỰC HIỆN · NHÀ CUNG CẤP
  // ════════════════════════════════════════════════════════════
  const hdnCols = [
    { label: 'NGÀY',             w: 13 },
    { label: 'CÔNG TRÌNH',       w: 32 },
    { label: 'LOẠI CHI PHÍ',     w: 20 },
    { label: 'NỘI DUNG',         w: 38 },
    { label: 'SỐ TIỀN',          w: 15, num: true },
    { label: 'NGƯỜI THỰC HIỆN',  w: 22 },
    { label: 'NHÀ CUNG CẤP',     w: 22 },
  ];
  const hdnData = expInv
    .filter(i => (i.sl || 1) <= 1)
    .map(i => [
      fmtDate(i.ngay), i.congtrinh || '', i.loai || '', i.nd || '',
      i.thanhtien || i.tien || 0,
      i.nguoi || '', i.ncc || '',
    ]);
  XLSX.utils.book_append_sheet(wb,
    _mkSheet(hdnCols, hdnData,
      'HÓA ĐƠN NHẬP NHANH',
      'Hướng dẫn: Mỗi dòng = 1 hóa đơn. SỐ TIỀN = tổng tiền. Ngày định dạng DD-MM-YYYY.'
    ),
    '1_HoaDonNhanh'
  );

  // ════════════════════════════════════════════════════════════
  // Sheet 2: 2_HoaDonChiTiet — đầy đủ đơn giá × số lượng
  // Cột: NGÀY · CÔNG TRÌNH · LOẠI CHI PHÍ · TÊN HÀNG HÓA / VẬT TƯ · ĐƠN GIÁ · SỐ LƯỢNG · THÀNH TIỀN · NGƯỜI THỰC HIỆN · NHÀ CUNG CẤP · SỐ HÓA ĐƠN
  // ════════════════════════════════════════════════════════════
  const hdctCols = [
    { label: 'NGÀY',                    w: 13 },
    { label: 'CÔNG TRÌNH',              w: 32 },
    { label: 'LOẠI CHI PHÍ',            w: 20 },
    { label: 'TÊN HÀNG HÓA / VẬT TƯ',  w: 38 },
    { label: 'ĐƠN GIÁ',                 w: 15, num: true },
    { label: 'SỐ LƯỢNG',                w: 10 },
    { label: 'THÀNH TIỀN',              w: 15, num: true },
    { label: 'NGƯỜI THỰC HIỆN',         w: 22 },
    { label: 'NHÀ CUNG CẤP',            w: 22 },
    { label: 'SỐ HÓA ĐƠN',             w: 16 },
  ];
  const hdctData = expInv.map(i => [
    fmtDate(i.ngay), i.congtrinh || '', i.loai || '', i.nd || '',
    i.tien || 0, i.sl || 1,
    i.thanhtien || (i.tien * (i.sl || 1)) || 0,
    i.nguoi || '', i.ncc || '', i.sohd || '',
  ]);
  XLSX.utils.book_append_sheet(wb,
    _mkSheet(hdctCols, hdctData,
      'HÓA ĐƠN CHI TIẾT',
      'Hướng dẫn: THÀNH TIỀN = ĐƠN GIÁ × SỐ LƯỢNG. Ngày định dạng DD-MM-YYYY.'
    ),
    '2_HoaDonChiTiet'
  );

  // ════════════════════════════════════════════════════════════
  // Sheet 3: 3_ChamCong — mỗi dòng = 1 công nhân trong 1 tuần
  // Cột: NGÀY ĐẦU TUẦN · CÔNG TRÌNH · TÊN CÔNG NHÂN · LƯƠNG/NGÀY · PHỤ CẤP · HĐ MUA LẺ · CN · T2..T7 · GHI CHÚ
  // ════════════════════════════════════════════════════════════
  const ccCols = [
    { label: 'NGÀY ĐẦU TUẦN',  w: 15 },
    { label: 'CÔNG TRÌNH',     w: 32 },
    { label: 'TÊN CÔNG NHÂN', w: 24 },
    { label: 'LƯƠNG/NGÀY',    w: 14, num: true },
    { label: 'PHỤ CẤP',       w: 11, num: true },
    { label: 'HĐ MUA LẺ',     w: 12, num: true },
    { label: 'CN',  w: 6 },
    { label: 'T2',  w: 6 },
    { label: 'T3',  w: 6 },
    { label: 'T4',  w: 6 },
    { label: 'T5',  w: 6 },
    { label: 'T6',  w: 6 },
    { label: 'T7',  w: 6 },
    { label: 'GHI CHÚ', w: 26 },
  ];
  const ccData2 = [];
  expCC.forEach(w => {
    (w.workers || []).forEach(wk => {
      const d = wk.d || [0, 0, 0, 0, 0, 0, 0];
      ccData2.push([
        fmtDate(w.fromDate), w.ct || '', wk.name || '',
        wk.luong || 0, wk.phucap || 0, wk.hdmuale || 0,
        d[0]||0, d[1]||0, d[2]||0, d[3]||0, d[4]||0, d[5]||0, d[6]||0,
        wk.nd || '',
      ]);
    });
  });
  XLSX.utils.book_append_sheet(wb,
    _mkSheet(ccCols, ccData2,
      'CHẤM CÔNG TUẦN',
      'Hướng dẫn: 0 = vắng, 1 = đủ ngày, 0.5 = nửa ngày. Ngày đầu tuần định dạng DD-MM-YYYY.'
    ),
    '3_ChamCong'
  );

  // ════════════════════════════════════════════════════════════
  // Sheet 4: 4_TienUng — tiền ứng cho thầu phụ / công nhân
  // Cột: NGÀY · CÔNG TRÌNH · ĐỐI TƯỢNG · TÊN THẦU PHỤ / CÔNG NHÂN · SỐ TIỀN · NỘI DUNG
  // ════════════════════════════════════════════════════════════
  const ungCols = [
    { label: 'NGÀY',                          w: 13 },
    { label: 'CÔNG TRÌNH',                    w: 32 },
    { label: 'ĐỐI TƯỢNG',                     w: 14 },
    { label: 'TÊN THẦU PHỤ / CÔNG NHÂN',      w: 30 },
    { label: 'SỐ TIỀN',                        w: 15, num: true },
    { label: 'NỘI DUNG',                       w: 32 },
  ];
  const ungData = expUng.map(u => {
    const doiTuong = u.loai === 'congnhan' ? 'Công nhân' : 'Thầu phụ';
    return [fmtDate(u.ngay), u.congtrinh || '', doiTuong, u.tp || '', u.tien || 0, u.nd || ''];
  });
  XLSX.utils.book_append_sheet(wb,
    _mkSheet(ungCols, ungData,
      'TIỀN ỨNG',
      'Hướng dẫn: ĐỐI TƯỢNG = "Thầu phụ" hoặc "Công nhân". Ngày định dạng DD-MM-YYYY.'
    ),
    '4_TienUng'
  );

  // ════════════════════════════════════════════════════════════
  // Sheet 5: 5_ThietBi — thiết bị thi công
  // Cột: CÔNG TRÌNH · TÊN THIẾT BỊ · SỐ LƯỢNG · TÌNH TRẠNG · NGƯỜI PHỤ TRÁCH · NGÀY · GHI CHÚ
  // ════════════════════════════════════════════════════════════
  const tbCols = [
    { label: 'CÔNG TRÌNH',      w: 32 },
    { label: 'TÊN THIẾT BỊ',   w: 26 },
    { label: 'SỐ LƯỢNG',       w: 10 },
    { label: 'TÌNH TRẠNG',     w: 22 },
    { label: 'NGƯỜI PHỤ TRÁCH', w: 22 },
    { label: 'NGÀY',           w: 13 },
    { label: 'GHI CHÚ',        w: 26 },
  ];
  const tbData2 = expTb.map(t => [
    t.ct || '', t.ten || '', t.soluong || 1,
    t.tinhtrang || '', t.nguoi || '',
    fmtDate(t.ngay), t.ghichu || '',
  ]);
  XLSX.utils.book_append_sheet(wb,
    _mkSheet(tbCols, tbData2,
      'THIẾT BỊ',
      'Hướng dẫn: Mỗi dòng = 1 thiết bị. TÌNH TRẠNG: "Đang hoạt động", "Cần sửa chữa", v.v. Ngày DD-MM-YYYY.'
    ),
    '5_ThietBi'
  );

  // ════════════════════════════════════════════════════════════
  // Sheet 6: 6_DanhMuc — toàn bộ danh mục (format 2 cột)
  // Cột: LOẠI DANH MỤC · TÊN
  // ════════════════════════════════════════════════════════════
  const dmCols = [
    { label: 'LOẠI DANH MỤC', w: 30 },
    { label: 'TÊN',           w: 44 },
  ];
  const dmGroups = [
    ['Công Trình',              cats.congTrinh   || []],
    ['Loại Chi Phí',            cats.loaiChiPhi  || []],
    ['Nhà Cung Cấp',            cats.nhaCungCap  || []],
    ['Người Thực Hiện',         cats.nguoiTH     || []],
    ['Thầu Phụ / TP',           cats.thauPhu     || []],
    ['Công Nhân',               cats.congNhan    || []],
    ['Máy / Thiết Bị Thi Công', cats.tbTen       || []],
  ];
  const dmData = [];
  dmGroups.forEach(([groupName, items]) => {
    items.forEach(item => dmData.push([groupName, item]));
  });
  XLSX.utils.book_append_sheet(wb,
    _mkSheet(dmCols, dmData,
      'DANH MỤC',
      'Hướng dẫn: Mỗi dòng = 1 mục. Thêm dòng mới để bổ sung khi import. LOẠI DANH MỤC phải đúng chính xác tên nhóm.'
    ),
    '6_DanhMuc'
  );

  // ════════════════════════════════════════════════════════════
  // Sheet 7: 7_HopDongChinh — hợp đồng chính theo công trình
  // Cột: CÔNG TRÌNH · GIÁ TRỊ HỢP ĐỒNG CHÍNH · GIÁ TRỊ HỢP ĐỒNG PHỤ · PHÁT SINH
  // ════════════════════════════════════════════════════════════
  const hdcCols = [
    { label: 'CÔNG TRÌNH',                 w: 36 },
    { label: 'GIÁ TRỊ HỢP ĐỒNG CHÍNH',    w: 24, num: true },
    { label: 'GIÁ TRỊ HỢP ĐỒNG PHỤ',      w: 22, num: true },
    { label: 'PHÁT SINH',                  w: 15, num: true },
  ];
  const hdcData = expHd.map(([ct, hd]) => [
    ct,
    hd.giaTri    || 0,
    hd.giaTriphu || 0,
    hd.phatSinh  || 0,
  ]);
  XLSX.utils.book_append_sheet(wb,
    _mkSheet(hdcCols, hdcData,
      'HỢP ĐỒNG CHÍNH',
      'Hướng dẫn: Mỗi dòng = 1 hợp đồng theo công trình. Giá trị nhập bằng số (VNĐ), không có dấu chấm/phẩy.'
    ),
    '7_HopDongChinh'
  );

  // ════════════════════════════════════════════════════════════
  // Sheet 8: 8_ThuTien — lịch sử thu tiền
  // Cột: NGÀY · CÔNG TRÌNH · SỐ TIỀN · NGƯỜI THỰC HIỆN · NỘI DUNG
  // ════════════════════════════════════════════════════════════
  const thuCols = [
    { label: 'NGÀY',            w: 13 },
    { label: 'CÔNG TRÌNH',      w: 32 },
    { label: 'SỐ TIỀN',         w: 15, num: true },
    { label: 'NGƯỜI THỰC HIỆN', w: 22 },
    { label: 'NỘI DUNG',        w: 32 },
  ];
  const thuData = expThu.map(r => [
    fmtDate(r.ngay), r.congtrinh || '',
    r.tien || 0, r.nguoi || '', r.nd || '',
  ]);
  XLSX.utils.book_append_sheet(wb,
    _mkSheet(thuCols, thuData,
      'THU TIỀN',
      'Hướng dẫn: Mỗi dòng = 1 lần thu tiền. Ngày định dạng DD-MM-YYYY.'
    ),
    '8_ThuTien'
  );

  // ════════════════════════════════════════════════════════════
  // Sheet 9: 9_HopDongThauPhu — hợp đồng thầu phụ
  // Cột: CÔNG TRÌNH · TÊN THẦU PHỤ · GIÁ TRỊ HỢP ĐỒNG · PHÁT SINH · NỘI DUNG
  // ════════════════════════════════════════════════════════════
  const hdtpCols = [
    { label: 'CÔNG TRÌNH',        w: 32 },
    { label: 'TÊN THẦU PHỤ',     w: 26 },
    { label: 'GIÁ TRỊ HỢP ĐỒNG', w: 22, num: true },
    { label: 'PHÁT SINH',          w: 15, num: true },
    { label: 'NỘI DUNG',           w: 32 },
  ];
  const hdtpData = expTp.map(r => [
    r.congtrinh || '', r.thauphu || '',
    r.giaTri || 0, r.phatSinh || 0, r.nd || '',
  ]);
  XLSX.utils.book_append_sheet(wb,
    _mkSheet(hdtpCols, hdtpData,
      'HỢP ĐỒNG THẦU PHỤ',
      'Hướng dẫn: Mỗi dòng = 1 hợp đồng thầu phụ. Giá trị nhập bằng số (VNĐ).'
    ),
    '9_HopDongThauPhu'
  );

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
// [11] PUBLIC WRAPPERS — Excel (gọi từ HTML onclick)
// ══════════════════════════════════════════════════════════════

function toolImportExcel() { document.getElementById('import-file-input').click(); }
function toolExportExcel() { openExportModal(); }
