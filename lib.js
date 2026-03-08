// lib.js — Storage / Firebase / Backup / Migration
// Load order: 1 (load TRUOC TAT CA file khac)


// ══════════════════════════════
//  DATA
// ══════════════════════════════
const DEFAULTS = {
  congTrinh: ["CÔNG TY - NHÀ","SC CT CÔ NHUNG - 191 THÀNH CÔNG, Q TÂN PHÚ","CT BỬU AN - 85/5 LÊ LAI, P12, Q TÂN BÌNH","CT A DŨNG - SUỐI CÁT, ĐỒNG NAI","CT BÁC CHỮ - 23/51A NGUYỄN HỮU TIẾN, Q TÂN PHÚ","CT BÁC ĐỆ - MỸ HẠNH NAM, ĐỨC HÒA, LONG AN","SC QUẬN 9","SC MINH CHÍNH - Q GÒ VẤP","SC CT LONG HẢI - VŨNG TÀU"],
  loaiChiPhi: ["Nhân Công","Thầu Phụ","Vật Liệu XD","Sắt Thép","Vật Tư Điện Nước","Đổ Bê Tông","Copha - VTP - Máy","Hóa Đơn Lẻ","Quyết Toán - Phát Sinh","Thiết Kế / Xin Phép","Chi Phí Khác"],
  nhaCungCap: ["Công ty VLXD Minh Phát","Cửa Hàng Sắt Thép Hùng","Điện Nước Phú Thịnh","Hóa Đơn Điện Lực"],
  nguoiTH: ["A Long","A Toán","A Dũng","Duy Sáng","HD Lẻ","Tình"]
};

const CATS = [
  { id:'congTrinh',  title:'🏗️ Công Trình',       sk:'cat_ct',    refField:'congtrinh' },
  { id:'loaiChiPhi', title:'📂 Loại Chi Phí',      sk:'cat_loai',  refField:'loai' },
  { id:'nhaCungCap', title:'🏪 Nhà Cung Cấp',      sk:'cat_ncc',   refField:'ncc' },
  { id:'nguoiTH',    title:'👷 Người Thực Hiện',   sk:'cat_nguoi', refField:'nguoi' },
  { id:'thauPhu',    title:'🤝 Thầu Phụ / TP',     sk:'cat_tp',    refField:'tp' },
  { id:'congNhan',   title:'🪖 Công Nhân',          sk:'cat_cn',    refField:null }
];

// ══════════════════════════════════════════════════════════
//  JSONBIN.IO SYNC — lưu trữ đám mây, đồng bộ đa thiết bị
// ══════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════
// FIREBASE FIRESTORE CLOUD SYNC
// REST API — không cần backend, không cần cài gì thêm
// ══════════════════════════════════════════════════════════

// ── Cấu hình Firebase (điền vào sau khi tạo project) ──────
const FB_CONFIG = {
  apiKey:    '',           // Web API Key từ Project Settings
  projectId: '',           // Project ID từ Project Settings
};
const FS_BASE = () =>
  `https://firestore.googleapis.com/v1/projects/${FB_CONFIG.projectId}/databases/(default)/documents/cpct_data`;

// ── Keys localStorage ──────────────────────────────────────
const FB_CFG_KEY   = 'fb_config';    // lưu apiKey + projectId
const FB_CACHE_KEY = 'fb_bins_cache';// cache map năm → docId

// ── Load config từ localStorage ───────────────────────────
(function() {
  const saved = _loadLS(FB_CFG_KEY);
  if (saved) { FB_CONFIG.apiKey = saved.apiKey||''; FB_CONFIG.projectId = saved.projectId||''; }
})();

function _loadLS(k) {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; }
}
function _saveLS(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

// ══════════════════════════════════════════════════════════════
// [MODULE: INDEXEDDB — Dexie offline-first layer]
// ══════════════════════════════════════════════════════════════

const db = new Dexie('qlct');
db.version(1).stores({
  invoices:   'id, updatedAt',
  attendance: 'id, updatedAt',
  equipment:  'id, updatedAt',
  ung:        'id, updatedAt',
  revenue:    'id, updatedAt',
  categories: 'id'
});

// Mapping: localStorage key → IDB table config
const DB_KEY_MAP = {
  'inv_v3':   { table: 'invoices',   isArr: true  },
  'cc_v2':    { table: 'attendance', isArr: true  },
  'tb_v1':    { table: 'equipment',  isArr: true  },
  'ung_v1':   { table: 'ung',        isArr: true  },
  'thu_v1':   { table: 'revenue',    isArr: true  },
  'cat_ct':   { table: 'categories', isArr: false, catId: 'congTrinh'  },
  'cat_loai': { table: 'categories', isArr: false, catId: 'loaiChiPhi' },
  'cat_ncc':  { table: 'categories', isArr: false, catId: 'nhaCungCap' },
  'cat_nguoi':{ table: 'categories', isArr: false, catId: 'nguoiTH'    },
  'cat_tp':   { table: 'categories', isArr: false, catId: 'thauPhu'    },
  'cat_cn':   { table: 'categories', isArr: false, catId: 'congNhan'   },
};

// Merge two arrays by id, keeping the record with the latest updatedAt
function mergeUnique(oldArr, newArr) {
  const map = new Map();
  (oldArr || []).forEach(r => map.set(r.id, r));
  (newArr || []).forEach(r => {
    const existing = map.get(r.id);
    if (!existing || r.updatedAt > existing.updatedAt) {
      map.set(r.id, r);
    }
  });
  return [...map.values()];
}

// Write one localStorage key to IndexedDB (background, no throw)
async function _dbSave(k, v) {
  const cfg = DB_KEY_MAP[k];
  if (!cfg) return;
  const now = Date.now();
  if (cfg.isArr) {
    const records = (Array.isArray(v) ? v : []).map(r => {
      if (!r.id) r.id = crypto.randomUUID();
      if (!r.updatedAt) r.updatedAt = now;
      return r;
    });
    await db[cfg.table].bulkPut(records);
  } else {
    await db[cfg.table].put({ id: cfg.catId, data: v, updatedAt: now });
  }
}

// Async preflight: sync IDB ↔ localStorage before app starts
// If IDB has data → copy to localStorage (IDB wins)
// If IDB empty → migrate localStorage → IDB
async function dbInit() {
  try {
    const now = Date.now();
    // Array tables
    const tables = [
      { key: 'inv_v3',  table: db.invoices   },
      { key: 'cc_v2',   table: db.attendance  },
      { key: 'tb_v1',   table: db.equipment   },
      { key: 'ung_v1',  table: db.ung         },
      { key: 'thu_v1',  table: db.revenue     },
    ];
    for (const { key, table } of tables) {
      const idbRows = await table.toArray();
      if (idbRows.length > 0) {
        // IDB has data — update localStorage cache so synchronous load() sees it
        localStorage.setItem(key, JSON.stringify(idbRows));
      } else {
        // IDB empty — migrate from localStorage
        const lsRaw = localStorage.getItem(key);
        if (lsRaw) {
          try {
            const lsRows = JSON.parse(lsRaw);
            if (Array.isArray(lsRows) && lsRows.length > 0) {
              const records = lsRows.map(r => {
                if (!r.id) r.id = crypto.randomUUID();
                if (!r.updatedAt) r.updatedAt = now;
                return r;
              });
              await table.bulkPut(records);
              localStorage.setItem(key, JSON.stringify(records));
            }
          } catch(e) { console.warn('[IDB] migrate lỗi', key, e); }
        }
      }
    }
    // Category tables (stored as { id, data, updatedAt })
    const catMap = [
      { key: 'cat_ct',    catId: 'congTrinh'  },
      { key: 'cat_loai',  catId: 'loaiChiPhi' },
      { key: 'cat_ncc',   catId: 'nhaCungCap' },
      { key: 'cat_nguoi', catId: 'nguoiTH'    },
      { key: 'cat_tp',    catId: 'thauPhu'    },
      { key: 'cat_cn',    catId: 'congNhan'   },
    ];
    for (const { key, catId } of catMap) {
      const idbRec = await db.categories.get(catId);
      if (idbRec) {
        localStorage.setItem(key, JSON.stringify(idbRec.data));
      } else {
        const lsRaw = localStorage.getItem(key);
        if (lsRaw) {
          try {
            const lsData = JSON.parse(lsRaw);
            await db.categories.put({ id: catId, data: lsData, updatedAt: now });
          } catch(e) { console.warn('[IDB] migrate cat lỗi', catId, e); }
        }
      }
    }
    console.log('[IDB] dbInit hoàn tất');
  } catch(e) {
    console.warn('[IDB] dbInit lỗi:', e);
  }
}

// ══════════════════════════════════════════════════════════════
// [MODULE: STORAGE v2] — DATA_VERSION · Migration · Backup · JSON IO
// Tìm nhanh: Ctrl+F → "MODULE: STORAGE"
// ══════════════════════════════════════════════════════════════

// ── Phiên bản schema hiện tại ─────────────────────────────────
// Tăng DATA_VERSION khi thay đổi cấu trúc data (thêm field bắt buộc,
// đổi tên key, v.v.). migrateData() sẽ tự nâng cấp data cũ lên mới.
const DATA_VERSION = 3;
const DATA_VERSION_KEY = 'app_data_version';

// ── Migration: nâng cấp data cũ lên version hiện tại ─────────
// Thêm case mới khi nâng DATA_VERSION lên
function migrateData() {
  const stored = parseInt(_loadLS(DATA_VERSION_KEY) || '0');
  if (stored >= DATA_VERSION) return; // Đã cập nhật, bỏ qua

  console.log('[Migration] Từ v' + stored + ' → v' + DATA_VERSION);

  // v0 → v1: inv không có field sl → set mặc định sl=1
  if (stored < 1) {
    const invs = _loadLS('inv_v3') || [];
    let changed = 0;
    invs.forEach(inv => {
      if (inv.sl === undefined || inv.sl === null) { inv.sl = 1; changed++; }
      if (inv.thanhtien === undefined) { inv.thanhtien = (inv.tien || 0) * (inv.sl || 1); changed++; }
    });
    if (changed) _saveLS('inv_v3', invs);
    console.log('[Migration v1] Chuẩn hoá sl/thanhtien:', changed, 'HĐ');
  }

  // v1 → v2: cc_v2 workers không có field phucap/hdmuale → set 0
  if (stored < 2) {
    const ccs = _loadLS('cc_v2') || [];
    let changed = 0;
    ccs.forEach(week => {
      (week.workers || []).forEach(wk => {
        if (wk.phucap === undefined) { wk.phucap = 0; changed++; }
        if (wk.hdmuale === undefined) { wk.hdmuale = 0; changed++; }
      });
    });
    if (changed) _saveLS('cc_v2', ccs);
    console.log('[Migration v2] Chuẩn hoá CC workers:', changed, 'worker');
  }

  // v2 → v3: đảm bảo mọi invoice có _ts (timestamp tạo)
  if (stored < 3) {
    const invs = _loadLS('inv_v3') || [];
    let changed = 0;
    invs.forEach(inv => {
      if (!inv._ts) { inv._ts = inv.id || Date.now(); changed++; }
    });
    if (changed) _saveLS('inv_v3', invs);
    console.log('[Migration v3] Thêm _ts cho', changed, 'HĐ');
  }

  // ── Thêm migration mới ở đây khi tăng DATA_VERSION ───────
  // if (stored < 4) { ... }

  _saveLS(DATA_VERSION_KEY, DATA_VERSION);
  console.log('[Migration] Hoàn tất → v' + DATA_VERSION);
}

// ── Auto Backup mỗi 30 phút ───────────────────────────────────
// Lưu snapshot toàn bộ data vào localStorage key: backup_auto
// Giữ 2 bản gần nhất + 1 bản của 7 ngày trước
const BACKUP_KEY     = 'backup_auto';
const BACKUP_MINS    = 30;     // chu kỳ backup (phút)
let   _backupTimer   = null;

function _snapshotNow(label) {
  try {
    const snap = {
      _ver:  DATA_VERSION,
      _time: new Date().toISOString(),
      _label: label || 'auto',
      inv:  _loadLS('inv_v3')  || [],
      ung:  _loadLS('ung_v1')  || [],
      cc:   _loadLS('cc_v2')   || [],
      tb:   _loadLS('tb_v1')   || [],
      cats: {
        ct:    _loadLS('cat_ct')    || [],
        loai:  _loadLS('cat_loai')  || [],
        ncc:   _loadLS('cat_ncc')   || [],
        nguoi: _loadLS('cat_nguoi') || [],
        tp:    _loadLS('cat_tp')    || [],
        cn:    _loadLS('cat_cn')    || []
      }
    };
    // Giữ 2 bản gần nhất + 1 bản cũ nhất trong khoảng 7 ngày trước
    const list = _loadLS(BACKUP_KEY) || [];
    list.unshift(snap);
    const recent = list.slice(0, 2);
    const rest   = list.slice(2);
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    const weekly = rest.find(b => b._time && (Date.now() - new Date(b._time).getTime()) >= SEVEN_DAYS);
    _saveLS(BACKUP_KEY, weekly ? [...recent, weekly] : recent);
    return snap;
  } catch(e) {
    console.warn('[Backup] Lỗi:', e);
    return null;
  }
}

function autoBackup() {
  if (_backupTimer) clearInterval(_backupTimer);
  // Chạy lần đầu sau 1 phút kể từ khi mở app
  setTimeout(() => {
    _snapshotNow('auto');
    // Sau đó lặp mỗi 30 phút
    _backupTimer = setInterval(() => {
      _snapshotNow('auto');
      console.log('[Backup] Auto snapshot lúc', new Date().toLocaleTimeString('vi-VN'));
    }, BACKUP_MINS * 60 * 1000);
  }, 60 * 1000);
}

function getBackupList() {
  return (_loadLS(BACKUP_KEY) || []).map((b, i) => ({
    index: i,
    label: b._label || 'auto',
    time:  b._time  || '',
    ver:   b._ver   || 0,
    counts: {
      inv: (b.inv||[]).length,
      ung: (b.ung||[]).length,
      cc:  (b.cc||[]).length,
      tb:  (b.tb||[]).length
    }
  }));
}

// ── Export toàn bộ data ra file JSON ─────────────────────────
function exportJSON() {
  const snap = _snapshotNow('manual-export');
  if (!snap) { toast('❌ Không thể tạo snapshot', 'error'); return; }
  const json = JSON.stringify(snap, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const ts   = new Date().toISOString().slice(0,16).replace('T','_').replace(':','-');
  a.href     = url;
  a.download = 'cpct_backup_' + ts + '.json';
  a.click();
  URL.revokeObjectURL(url);
  toast('✅ Đã xuất file JSON (' +
    snap.inv.length + ' HĐ, ' +
    snap.ung.length + ' tiền ứng, ' +
    snap.cc.length  + ' tuần CC)', 'success');
}

// ── Import JSON — khôi phục data từ file backup ──────────────
function importJSON(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const snap = JSON.parse(e.target.result);
      // Kiểm tra cấu trúc tối thiểu
      if (typeof snap !== 'object' || (!snap.inv && !snap.ung && !snap.cc)) {
        toast('❌ File JSON không hợp lệ hoặc không phải backup của app này', 'error');
        return;
      }
      // Hiện confirm dialog
      const inv  = (snap.inv||[]).length;
      const ung  = (snap.ung||[]).length;
      const cc   = (snap.cc||[]).length;
      const tb   = (snap.tb||[]).length;
      const time = snap._time ? new Date(snap._time).toLocaleString('vi-VN') : '(không rõ)';
      const ok = confirm('⚠️ KHÔI PHỤC DỮ LIỆU TỪ FILE JSON\n\n' + 'File backup lúc: ' + time + '\n' + 'Nội dung: ' + inv + ' HĐ · ' + ung + ' tiền ứng · ' + cc + ' tuần CC · ' + tb + ' thiết bị\n\n' + '⚠️ Toàn bộ dữ liệu hiện tại sẽ bị THAY THẾ.\nHệ thống sẽ tự backup trước khi ghi đè.\n\nTiếp tục không?');
      if (!ok) return;

      // Backup data hiện tại trước khi ghi đè
      _snapshotNow('before-json-import');

      // Ghi data từ file vào localStorage
      if (snap.inv)  _saveLS('inv_v3',  snap.inv);
      if (snap.ung)  _saveLS('ung_v1',  snap.ung);
      if (snap.cc)   _saveLS('cc_v2',   snap.cc);
      if (snap.tb)   _saveLS('tb_v1',   snap.tb);
      if (snap.cats) {
        if (snap.cats.ct)    _saveLS('cat_ct',    snap.cats.ct);
        if (snap.cats.loai)  _saveLS('cat_loai',  snap.cats.loai);
        if (snap.cats.ncc)   _saveLS('cat_ncc',   snap.cats.ncc);
        if (snap.cats.nguoi) _saveLS('cat_nguoi', snap.cats.nguoi);
        if (snap.cats.tp)    _saveLS('cat_tp',    snap.cats.tp);
        if (snap.cats.cn)    _saveLS('cat_cn',    snap.cats.cn);
      }

      // Chạy migration nếu file cũ hơn version hiện tại
      _saveLS(DATA_VERSION_KEY, snap._ver || 0);
      migrateData();

      // Reload lại toàn bộ app state
      invoices   = load('inv_v3', []);
      ungRecords = load('ung_v1', []);
      ccData     = load('cc_v2', []);
      tbData     = load('tb_v1', []);
      cats.congTrinh      = load('cat_ct',       DEFAULTS.congTrinh);
      cats.congTrinhYears = load('cat_ct_years', {});
      cats.loaiChiPhi     = load('cat_loai',     DEFAULTS.loaiChiPhi);
      cats.nhaCungCap     = load('cat_ncc',      DEFAULTS.nhaCungCap);
      cats.nguoiTH        = load('cat_nguoi',    DEFAULTS.nguoiTH);
      cats.thauPhu        = load('cat_tp',       []);
      cats.congNhan       = load('cat_cn',       []);

      buildYearSelect(); _refreshAllTabs();
      rebuildEntrySelects(); rebuildUngSelects();
      renderSettings(); updateTop();

      toast('✅ Khôi phục thành công! ' + inv + ' HĐ, ' + ung + ' tiền ứng, ' + cc + ' tuần CC', 'success');
    } catch(err) {
      toast('❌ Lỗi đọc file JSON: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

// ── Khôi phục từ 1 bản auto backup ───────────────────────────
function restoreFromBackup(index) {
  const list = _loadLS(BACKUP_KEY) || [];
  const snap = list[index];
  if (!snap) { toast('❌ Không tìm thấy bản backup này', 'error'); return; }

  const time = snap._time ? new Date(snap._time).toLocaleString('vi-VN') : '(không rõ)';
  const ok = confirm('Khôi phục bản backup: ' + time + '\n' + (snap.inv||[]).length + ' HĐ · ' + (snap.ung||[]).length + ' tiền ứng · ' + (snap.cc||[]).length + ' tuần CC\n\n⚠️ Data hiện tại sẽ bị thay thế. Tiếp tục?');
  if (!ok) return;

  _snapshotNow('before-restore');
  if (snap.inv)  _saveLS('inv_v3',  snap.inv);
  if (snap.ung)  _saveLS('ung_v1',  snap.ung);
  if (snap.cc)   _saveLS('cc_v2',   snap.cc);
  if (snap.tb)   _saveLS('tb_v1',   snap.tb);
  if (snap.cats) {
    if (snap.cats.ct)    _saveLS('cat_ct',    snap.cats.ct);
    if (snap.cats.loai)  _saveLS('cat_loai',  snap.cats.loai);
    if (snap.cats.ncc)   _saveLS('cat_ncc',   snap.cats.ncc);
    if (snap.cats.nguoi) _saveLS('cat_nguoi', snap.cats.nguoi);
    if (snap.cats.tp)    _saveLS('cat_tp',    snap.cats.tp);
    if (snap.cats.cn)    _saveLS('cat_cn',    snap.cats.cn);
  }

  invoices   = load('inv_v3', []);
  ungRecords = load('ung_v1', []);
  ccData     = load('cc_v2', []);
  tbData     = load('tb_v1', []);
  cats.congTrinh      = load('cat_ct',       DEFAULTS.congTrinh);
  cats.congTrinhYears = load('cat_ct_years', {});
  cats.loaiChiPhi     = load('cat_loai',     DEFAULTS.loaiChiPhi);
  cats.nhaCungCap     = load('cat_ncc',      DEFAULTS.nhaCungCap);
  cats.nguoiTH        = load('cat_nguoi',    DEFAULTS.nguoiTH);
  cats.thauPhu        = load('cat_tp',       []);
  cats.congNhan       = load('cat_cn',       []);

  buildYearSelect(); _refreshAllTabs();
  rebuildEntrySelects(); rebuildUngSelects();
  renderSettings(); updateTop();
  toast('✅ Đã khôi phục bản backup lúc ' + time, 'success');
}

// ── Render danh sách backup vào panel UI ──────────────────────
function renderBackupList() {
  const wrap = document.getElementById('backup-list-wrap');
  if (!wrap) return;

  // Cập nhật badge version
  const badge = document.getElementById('data-version-badge');
  if (badge) badge.textContent = 'v' + DATA_VERSION;

  // Cập nhật thời gian backup gần nhất
  const statusLabel = document.getElementById('backup-status-label');
  const list = _loadLS(BACKUP_KEY) || [];

  if (!list.length) {
    wrap.innerHTML = '<div style="color:var(--ink3);font-size:13px;padding:8px 0">Chưa có bản sao lưu nào. App sẽ tự động tạo sau 1 phút.</div>';
    if (statusLabel) statusLabel.textContent = '';
    return;
  }

  // Label thời gian backup gần nhất
  if (statusLabel && list[0]?._time) {
    const t = new Date(list[0]._time).toLocaleString('vi-VN');
    statusLabel.textContent = 'Backup gần nhất: ' + t;
  }

  // Render từng bản backup
  const rows = list.map((b, i) => {
    const time  = b._time ? new Date(b._time).toLocaleString('vi-VN') : '(không rõ)';
    const label = b._label === 'auto' ? '🔄 Tự động' :
                  b._label === 'manual' ? '📸 Thủ công' :
                  b._label === 'manual-export' ? '📤 Trước khi xuất' :
                  b._label === 'before-json-import' ? '🛡 Trước khi nhập JSON' :
                  b._label === 'before-restore' ? '🛡 Trước khi khôi phục' : b._label;
    const counts = (b.inv||[]).length + ' HĐ · ' +
                   (b.ung||[]).length + ' tiền ứng · ' +
                   (b.cc||[]).length  + ' tuần CC · ' +
                   (b.tb||[]).length  + ' TB';
    const isNewest = i === 0;
    return `<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;
              background:${isNewest ? 'var(--paper)' : 'transparent'};
              border-radius:8px;border:1px solid ${isNewest ? 'var(--line2)' : 'transparent'};
              margin-bottom:6px;flex-wrap:wrap">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--ink)">${label}</div>
        <div style="font-size:11px;color:var(--ink3);margin-top:2px">${time} &nbsp;·&nbsp; ${counts}</div>
      </div>
      <button class="btn btn-outline btn-sm" onclick="restoreFromBackup(${i})" title="Khôi phục bản này">
        ↩ Khôi phục
      </button>
    </div>`;
  }).join('');

  wrap.innerHTML = rows;
}

function fbReady() { return FB_CONFIG.apiKey && FB_CONFIG.projectId; }

// ══ NÉN / GIẢI NÉN ═══════════════════════════════════════
// inv: id→i ngay→d congtrinh→c loai→l nguoi→n ncc→s nd→t tien→p thanhtien→q sl→k ccKey→x _ts→m
function compressInv(arr) {
  return arr.map(o=>{const r={};
    if(o.id!==undefined)r.i=o.id; if(o.ngay)r.d=o.ngay; if(o.congtrinh)r.c=o.congtrinh;
    if(o.loai)r.l=o.loai; if(o.nguoi)r.n=o.nguoi; if(o.ncc)r.s=o.ncc; if(o.nd)r.t=o.nd;
    if(o.tien)r.p=o.tien; if(o.thanhtien&&o.thanhtien!==o.tien)r.q=o.thanhtien;
    if(o.sl&&o.sl!==1)r.k=o.sl; if(o.ccKey)r.x=o.ccKey; if(o._ts)r.m=o._ts; return r;});
}
function expandInv(arr) {
  return (arr||[]).map(o=>({id:o.i,ngay:o.d,congtrinh:o.c,loai:o.l,nguoi:o.n||'',ncc:o.s||'',
    nd:o.t||'',tien:o.p||0,thanhtien:o.q||(o.p||0),sl:o.k||undefined,ccKey:o.x||undefined,_ts:o.m||undefined}));
}
function compressCC(arr) {
  return (arr||[]).map(w=>({i:w.id,f:w.fromDate,e:w.toDate,c:w.ct,
    w:w.workers.map(wk=>{const r={n:wk.name,d:wk.d,l:wk.luong};
      if(wk.phucap)r.p=wk.phucap; if(wk.hdmuale)r.h=wk.hdmuale; if(wk.nd)r.t=wk.nd; return r;})}));
}
function expandCC(arr) {
  return (arr||[]).map(w=>({id:w.i,fromDate:w.f,toDate:w.e,ct:w.c,
    workers:(w.w||[]).map(wk=>({name:wk.n,d:wk.d,luong:wk.l||0,phucap:wk.p||0,hdmuale:wk.h||0,nd:wk.t||''}))}));
}
function compressUng(arr) {
  return (arr||[]).map(o=>({i:o.id,d:o.ngay,t:o.tp||o.ncc||'',c:o.congtrinh,p:o.tien||0,n:o.nd||''}));
}
function expandUng(arr) {
  return (arr||[]).map(o=>({id:o.i,ngay:o.d,tp:o.t,congtrinh:o.c,tien:o.p||0,nd:o.n||''}));
}
function compressTb(arr) {
  return (arr||[]).map(o=>({i:o.id,c:o.ct,t:o.ten,s:o.soluong||0,r:o.tinhtrang,n:o.nguoi||'',g:o.ghichu||'',d:o.ngay||''}));
}
function expandTb(arr) {
  return (arr||[]).map(o=>({id:o.i,ct:o.c,ten:o.t,soluong:o.s||0,tinhtrang:o.r||'Đang hoạt động',nguoi:o.n||'',ghichu:o.g||'',ngay:o.d||''}));
}

function load(k, def) {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; }
}
function save(k, v) {
  clearTimeout(save._t);
  localStorage.setItem(k, JSON.stringify(v));
  save._t = setTimeout(fbPushAll, 2500);
  // Async write to IndexedDB (background, non-blocking)
  _dbSave(k, v).catch(e => console.warn('[IDB] save lỗi:', k, e));
}

// ══ FIRESTORE DOCUMENT FORMAT ═════════════════════════════
// Firestore lưu dạng {fields: {key: {stringValue/integerValue/...}}}
// Ta dùng 1 field "data" chứa toàn bộ JSON nén dạng stringValue

function fsWrap(obj) {
  // Wrap object thành Firestore document format
  return { fields: { data: { stringValue: JSON.stringify(obj) } } };
}
function fsUnwrap(doc) {
  // Unwrap Firestore document về plain object
  if (!doc || !doc.fields || !doc.fields.data) return null;
  try { return JSON.parse(doc.fields.data.stringValue); } catch { return null; }
}

// ── Doc ID helpers ─────────────────────────────────────────
function fbDocYear(yr)  { return `y${yr}`; }
function fbDocCats()    { return 'cats'; }

// ── Build payload cho từng loại ───────────────────────────
function fbYearPayload(yr) {
  const y = yr || activeYear || new Date().getFullYear();
  const ys = String(y);
  return { v:3, yr:y,
    i: compressInv(load('inv_v3',[]).filter(x=>x.ngay&&x.ngay.startsWith(ys))),
    u: compressUng(load('ung_v1',[]).filter(x=>x.ngay&&x.ngay.startsWith(ys))),
    c: compressCC(load('cc_v2',[]).filter(x=>x.fromDate&&x.fromDate.startsWith(ys))),
    t: compressTb(load('tb_v1',[]).filter(x=>x.ngay&&x.ngay.startsWith(ys))),
    thu: load('thu_v1',[]).filter(x=>x.ngay&&x.ngay.startsWith(ys)) };
}
function fbCatsPayload() {
  return { v:3,
    cats:{ct:load('cat_ct',DEFAULTS.congTrinh),loai:load('cat_loai',DEFAULTS.loaiChiPhi),
      ncc:load('cat_ncc',DEFAULTS.nhaCungCap),nguoi:load('cat_nguoi',DEFAULTS.nguoiTH)},
    hopDong: load('hopdong_v1', {}) };  // hợp đồng xuyên suốt, không theo năm
}

// ── Firebase REST helpers ──────────────────────────────────
function fsUrl(docId) {
  return `${FS_BASE()}/${docId}?key=${FB_CONFIG.apiKey}`;
}
function fsGet(docId) {
  return fetch(fsUrl(docId)).then(r=>r.json());
}
function fsSet(docId, payload) {
  // PATCH = upsert (tạo hoặc cập nhật)
  return fetch(`${FS_BASE()}/${docId}?key=${FB_CONFIG.apiKey}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fsWrap(payload))
  }).then(r=>r.json());
}

// ── Estimate size ──────────────────────────────────────────
function estimateYearKb(yr) {
  const ys = String(yr || activeYear || new Date().getFullYear());
  const data = {
    i: compressInv(load('inv_v3',[]).filter(x=>x.ngay&&x.ngay.startsWith(ys))),
    u: compressUng(load('ung_v1',[]).filter(x=>x.ngay&&x.ngay.startsWith(ys))),
    c: compressCC(load('cc_v2',[]).filter(x=>x.fromDate&&x.fromDate.startsWith(ys))),
  };
  return Math.round(JSON.stringify(data).length/1024*10)/10;
}

// ══ PUSH LÊN CLOUD ════════════════════════════════════════
let _fbPushing = false;
function fbPushAll() {
  if (!fbReady()) return;
  if (_fbPushing) { save._t = setTimeout(fbPushAll, 3000); return; }
  const yr = activeYear || new Date().getFullYear();
  const payload = fbYearPayload(yr);
  const kb = Math.round(JSON.stringify(payload).length/1024*10)/10;
  _fbPushing = true;
  _ensureSyncDot(); _setSyncDot('syncing');
  showSyncBanner('☁️ Đang lưu (~' + kb + 'kb)...');
  fsSet(fbDocYear(yr), payload).then(res=>{
    _fbPushing = false;
    if (res.fields) {
      _setSyncDot('');
      showSyncBanner('✅ Đã lưu cloud (~' + kb + 'kb)', 2000);
      updateJbBtn();
      // Push cats async
      fsSet(fbDocCats(), fbCatsPayload()).catch(()=>{});
    } else {
      _setSyncDot('error');
      const err = res.error?.message || JSON.stringify(res.error) || '?';
      if (err.includes('PERMISSION_DENIED'))
        showSyncBanner('⚠️ Lỗi quyền truy cập — kiểm tra Security Rules', 5000);
      else
        showSyncBanner('⚠️ Lỗi lưu: ' + err.substring(0,60), 4000);
    }
  }).catch(()=>{ _fbPushing=false; _setSyncDot('offline'); showSyncBanner('⚠️ Mất kết nối internet', 3000); });
}

// ── Alias jbPushAll cho các nơi gọi cũ ───────────────────
function jbPushAll() { fbPushAll(); }

// ══ TẢI TỪ CLOUD ══════════════════════════════════════════
function gsLoadAll(callback) {
  if (!fbReady()) { callback(null); return; }
  const yr = activeYear || new Date().getFullYear();
  const ys = String(yr);
  showSyncBanner('⏳ Đang tải năm ' + yr + '...');

  Promise.all([
    fsGet(fbDocYear(yr)),
    fsGet(fbDocCats())
  ]).then(([yearDoc, catsDoc]) => {
    // Apply year data
    const yearData = fsUnwrap(yearDoc);
    if (yearData) {
      const mergeArr = (key, expanded) => {
        const existing = load(key,[]).filter(x=>{
          const d = x.ngay||x.fromDate||'';
          return !d.startsWith(ys);
        });
        localStorage.setItem(key, JSON.stringify([...expanded,...existing]));
      };
      if(yearData.i) mergeArr('inv_v3', expandInv(yearData.i));
      if(yearData.u) mergeArr('ung_v1', expandUng(yearData.u));
      if(yearData.c) { const ex=load('cc_v2',[]).filter(x=>!x.fromDate||!x.fromDate.startsWith(ys));
        localStorage.setItem('cc_v2', JSON.stringify([...expandCC(yearData.c),...ex])); }
      if(yearData.t) { const ex=load('tb_v1',[]).filter(x=>!x.ngay||!x.ngay.startsWith(ys));
        localStorage.setItem('tb_v1', JSON.stringify([...expandTb(yearData.t),...ex])); }
    }
    // Apply cats
    const catsData = fsUnwrap(catsDoc);
    if (catsData && catsData.cats) {
      const ct = catsData.cats;
      if(ct.ct)    localStorage.setItem('cat_ct',   JSON.stringify(ct.ct));
      if(ct.loai)  localStorage.setItem('cat_loai', JSON.stringify(ct.loai));
      if(ct.ncc)   localStorage.setItem('cat_ncc',  JSON.stringify(ct.ncc));
      if(ct.nguoi) localStorage.setItem('cat_nguoi',JSON.stringify(ct.nguoi));
    }
    // Apply hopDong (xuyên suốt, không theo năm)
    if (catsData && catsData.hopDong) {
      localStorage.setItem('hopdong_v1', JSON.stringify(catsData.hopDong));
      hopDongData = catsData.hopDong;
    }
    // Apply thu (theo năm — merge như ungRecords)
    if (yearData && yearData.thu) {
      const exThu = load('thu_v1',[]).filter(x => !x.ngay || !x.ngay.startsWith(ys));
      localStorage.setItem('thu_v1', JSON.stringify([...yearData.thu, ...exThu]));
      thuRecords = load('thu_v1', []);
    }
    hideSyncBanner();
    callback(yearData || catsData || {});

    // Nếu năm này chưa có trên cloud → push ngay
    if (!yearData) setTimeout(()=>fbPushAll(), 1500);
  }).catch(e => {
    hideSyncBanner();
    console.warn('gsLoadAll error:', e);
    callback(null);
  });
}

// ══ CẬP NHẬT NÚT CLOUD ════════════════════════════════════
function updateJbBtn() {
  const btn = document.getElementById('jb-btn');
  if (!btn) return;
  if (fbReady()) {
    btn.textContent = '✅ Cloud';
    btn.style.background = 'rgba(26,122,69,0.4)';
    btn.style.borderColor = 'rgba(26,200,100,0.5)';
    _ensureSyncDot();
  } else {
    btn.textContent = '☁️ Cloud';
    btn.style.background = 'rgba(255,255,255,0.12)';
    btn.style.borderColor = 'rgba(255,255,255,0.25)';
    const dot = document.getElementById('sync-dot');
    if (dot) dot.className = 'hidden';
  }
}

// VI: Sync status dot
function _ensureSyncDot() {
  const btn = document.getElementById('jb-btn');
  if (!btn || document.getElementById('sync-dot')) return;
  const dot = document.createElement('span');
  dot.id = 'sync-dot';
  btn.style.position = 'relative';
  btn.appendChild(dot);
}
function _setSyncDot(status) {
  const dot = document.getElementById('sync-dot');
  if (!dot) return;
  dot.className = status || '';
}

// ══ MODAL CẤU HÌNH ════════════════════════════════════════
function openBinModal() { renderBinModal(); }
function closeBinModal() {
  const ov = document.getElementById('bin-modal-overlay');
  if(ov) ov.style.display='none';
}

function renderBinModal() {
  const yr = activeYear || new Date().getFullYear();
  const ov = document.getElementById('bin-modal-overlay') || _createModalOverlay();
  const isConnected = fbReady();
  const yearKb = isConnected ? estimateYearKb(yr) : 0;

  const statusColor = yearKb < 200 ? '#1a7a45' : yearKb < 500 ? '#e67e00' : '#c0392b';
  const statusBg    = yearKb < 200 ? '#d4edda'  : yearKb < 500 ? '#fff3cd' : '#f8d7da';
  const statusLabel = yearKb < 200 ? '✅ OK'    : yearKb < 500 ? '⚠️ Khá lớn' : '🔴 Lớn';

  ov.innerHTML = `<div onclick="event.stopPropagation()" style="max-width:460px;width:95vw;background:#fff;border-radius:16px;padding:24px;font-family:'IBM Plex Sans',sans-serif;box-shadow:0 12px 48px rgba(0,0,0,.18)">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h3 style="font-size:17px;font-weight:800;margin:0">🔥 Kết Nối Firebase</h3>
      <button onclick="closeBinModal()" style="background:none;border:none;font-size:22px;cursor:pointer;color:#888;line-height:1">✕</button>
    </div>

    ${isConnected ? `
    <div style="background:#f0fff4;border:1px solid #b2dfdb;border-radius:8px;padding:10px 14px;margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:#1a7a45;margin-bottom:4px">✅ ĐÃ KẾT NỐI</div>
      <div style="font-size:11px;color:#555">Project: <strong>${FB_CONFIG.projectId}</strong></div>
      <div style="font-size:11px;color:#888;margin-top:2px">API Key: ${FB_CONFIG.apiKey.substring(0,8)}••••••••</div>
    </div>
    <div style="background:#f5f4f0;border-radius:8px;padding:8px 12px;margin-bottom:14px;font-size:12px">
      📊 Dữ liệu năm ${yr}: <strong style="color:${statusColor}">${yearKb}kb</strong>
      <span style="margin-left:6px;background:${statusBg};color:${statusColor};border-radius:4px;padding:1px 6px;font-size:10px;font-weight:700">${statusLabel}</span>
      <div style="font-size:10px;color:#aaa;margin-top:2px">Firebase free: 1GB storage · 50K reads/ngày · 20K writes/ngày</div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:14px">
      <button onclick="syncNow()" style="flex:1;padding:10px;border-radius:8px;border:1.5px solid #1565c0;background:transparent;color:#1565c0;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer">🔄 Tải Về</button>
      <button onclick="fbDisconnect()" style="flex:1;padding:10px;border-radius:8px;border:1.5px solid #c0392b;background:transparent;color:#c0392b;font-family:inherit;font-size:13px;cursor:pointer">⛔ Ngắt</button>
    </div>
    ` : `
    <div style="background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:12px;margin-bottom:14px;font-size:13px;color:#856404">
      Nhập <strong>Project ID</strong> và <strong>Web API Key</strong> từ Firebase Console để kết nối.
    </div>
    `}

    <div style="margin-bottom:10px">
      <label style="font-size:11px;font-weight:700;color:#555;display:block;margin-bottom:4px">PROJECT ID</label>
      <input id="fb-proj-input" type="text" value="${FB_CONFIG.projectId}"
        placeholder="your-project-id"
        style="width:100%;box-sizing:border-box;padding:8px 10px;border:1.5px solid #ddd;border-radius:8px;font-family:'IBM Plex Mono',monospace;font-size:12px;outline:none">
    </div>
    <div style="margin-bottom:14px">
      <label style="font-size:11px;font-weight:700;color:#555;display:block;margin-bottom:4px">WEB API KEY</label>
      <input id="fb-key-input" type="text" value="${FB_CONFIG.apiKey}"
        placeholder="AIzaSy..."
        style="width:100%;box-sizing:border-box;padding:8px 10px;border:1.5px solid #ddd;border-radius:8px;font-family:'IBM Plex Mono',monospace;font-size:12px;outline:none">
    </div>
    <button onclick="fbSaveConfig()" style="width:100%;padding:12px;border-radius:8px;border:none;background:#1a1814;color:#fff;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:10px">
      💾 ${isConnected ? 'Cập Nhật Kết Nối' : 'Kết Nối Firebase'}
    </button>
    <div style="font-size:11px;color:#aaa;text-align:center;line-height:1.6">
      Firebase free tier: 1GB · Không giới hạn size/file · Google hỗ trợ lâu dài
    </div>
  </div>`;
  ov.style.display = 'flex';
}

function _createModalOverlay() {
  let ov = document.getElementById('bin-modal-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'bin-modal-overlay';
    ov.onclick = function(e) { if(e.target===this) closeBinModal(); };
    ov.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;align-items:center;justify-content:center';
    document.body.appendChild(ov);
  }
  return ov;
}

function fbSaveConfig() {
  const proj = (document.getElementById('fb-proj-input')?.value||'').trim();
  const key  = (document.getElementById('fb-key-input')?.value||'').trim();
  if (!proj || !key) { toast('Vui lòng nhập đủ Project ID và API Key!', 'error'); return; }
  FB_CONFIG.projectId = proj;
  FB_CONFIG.apiKey    = key;
  _saveLS(FB_CFG_KEY, { projectId: proj, apiKey: key });
  closeBinModal();
  toast('✅ Đã lưu cấu hình Firebase! Đang tải dữ liệu...', 'success');
  updateJbBtn();
  reloadFromCloud();
}

function fbDisconnect() {
  if (!confirm('Ngắt kết nối Firebase? Dữ liệu local vẫn còn.')) return;
  FB_CONFIG.projectId = '';
  FB_CONFIG.apiKey    = '';
  localStorage.removeItem(FB_CFG_KEY);
  closeBinModal();
  updateJbBtn();
  toast('Đã ngắt kết nối Firebase');
}

// Alias các hàm cũ để không break code khác
function jbSaveId()     { fbSaveConfig(); }
function jbDisconnect() { fbDisconnect(); }
function copyBinId()    { navigator.clipboard.writeText(FB_CONFIG.projectId).then(()=>toast('✅ Đã copy Project ID')).catch(()=>{}); }
function linkBinId()    { fbSaveConfig(); }
function resetBin()     { fbDisconnect(); }
function createNewBin() { openBinModal(); }

function reloadFromCloud() {
  showSyncBanner('⏳ Đang tải dữ liệu...');
  gsLoadAll(function(data) {
    if (!data) { hideSyncBanner(); toast('⚠️ Không tải được dữ liệu từ cloud', 'error'); return; }
    invoices   = load('inv_v3', []);
    ungRecords = load('ung_v1', []);
    ccData     = load('cc_v2', []);
    tbData     = load('tb_v1', []);
    cats.congTrinh      = load('cat_ct',       DEFAULTS.congTrinh);
    cats.congTrinhYears = load('cat_ct_years', {});
    cats.loaiChiPhi     = load('cat_loai',     DEFAULTS.loaiChiPhi);
    cats.nhaCungCap     = load('cat_ncc',      DEFAULTS.nhaCungCap);
    cats.nguoiTH        = load('cat_nguoi',    DEFAULTS.nguoiTH);
    buildYearSelect();
    rebuildEntrySelects(); rebuildUngSelects();
    buildFilters(); filterAndRender(); renderTrash();
    renderCCHistory(); renderCCTLT();
    buildUngFilters(); filterAndRenderUng();
    renderCtPage(); updateTop(); renderSettings();
    toast('✅ Đã tải dữ liệu từ Firebase!', 'success');
  });
}

function syncNow() {
  closeBinModal();
  reloadFromCloud();
}

function buildYearSelect() {
  const years = new Set();
  years.add(new Date().getFullYear());
  invoices.forEach(i=>{ if(i.ngay) years.add(parseInt(i.ngay.split('-')[0])); });
  ungRecords.forEach(u=>{ if(u.ngay) years.add(parseInt(u.ngay.split('-')[0])); });
  ccData.forEach(w=>{ if(w.fromDate) years.add(parseInt(w.fromDate.split('-')[0])); });
  _renderYearSelect(years);

  // Nếu Firebase ready → fetch danh sách doc để biết có năm nào
  if(fbReady()) {
    fetch(`${FS_BASE()}?key=${FB_CONFIG.apiKey}&pageSize=20`)
      .then(r=>r.json()).then(data=>{
        if(data.documents) {
          data.documents.forEach(doc=>{
            // doc.name = ".../cpct_data/y2025" or ".../cpct_data/y2026"
            const seg = doc.name.split('/').pop();
            if(seg && seg.startsWith('y')) {
              const yr = parseInt(seg.slice(1));
              if(!isNaN(yr) && yr > 2000 && yr < 2100) years.add(yr);
            }
          });
          _renderYearSelect(years);
        }
      }).catch(()=>{});
  }
}

function _renderYearSelect(years) {
  const sorted = [...years].sort((a,b)=>b-a);
  const sel = document.getElementById('global-year');
  if(!sel) return;
  const allSel = activeYear === 0 ? 'selected' : '';
  sel.innerHTML = `<option value="0" ${allSel}>Tất cả</option>` +
    sorted.map(y=>`<option value="${y}" ${y===activeYear?'selected':''}>${y}</option>`).join('');
}

function saveCats(catId) {
  const cfg = CATS.find(c=>c.id===catId);
  if (cfg) {
    localStorage.setItem(cfg.sk, JSON.stringify(cats[catId]));
    // Khi lưu congTrinh → cũng lưu congTrinhYears (map tên → năm)
    if (catId === 'congTrinh') {
      localStorage.setItem('cat_ct_years', JSON.stringify(cats.congTrinhYears || {}));
    }
    clearTimeout(save._t);
    save._t = setTimeout(()=>{
      if (!fbReady()) return;
      fsSet(fbDocCats(), fbCatsPayload()).catch(()=>{});
    }, 1500);
  }
}


function showSyncBanner(msg, autohideMs=0) {
  let b = document.getElementById('sync-banner');
  if (!b) {
    b = document.createElement('div');
    b.id = 'sync-banner';
    b.style.cssText = 'position:fixed;top:56px;left:50%;transform:translateX(-50%);z-index:9999;background:#1a73e8;color:#fff;border-radius:20px;padding:6px 18px;font-size:12px;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,.2);pointer-events:none;transition:opacity .3s';
    document.body.appendChild(b);
  }
  b.textContent = msg; b.style.opacity='1'; b.style.display='block';
  if (autohideMs) setTimeout(hideSyncBanner, autohideMs);
}
function hideSyncBanner() {
  const b = document.getElementById('sync-banner');
  if (b) { b.style.opacity='0'; setTimeout(()=>b.style.display='none', 300); }
}

let cats = {
  congTrinh:      load('cat_ct',       DEFAULTS.congTrinh),
  congTrinhYears: load('cat_ct_years', {}),  // { "tên CT": năm tạo }
  loaiChiPhi:     load('cat_loai',     DEFAULTS.loaiChiPhi),
  nhaCungCap:     load('cat_ncc',      DEFAULTS.nhaCungCap),
  nguoiTH:        load('cat_nguoi',    DEFAULTS.nguoiTH),
  thauPhu:        load('cat_tp',       []),
  congNhan:       load('cat_cn',       [])
};
let cnRoles = load('cat_cn_roles', {}); // { "Tên CN": "C/T/P" }

let invoices = load('inv_v3', []);
let filteredInvs = [];
let curPage = 1;
const PG = 13;
