// sync.js — Sync Engine v2
// Load order: sau doanhthu.js, trước main.js
// Nguyên tắc: IndexedDB = source of truth | pull→merge→push | all years | soft delete

'use strict';

// ══════════════════════════════════════════════════════════════
// [1] DEVICE IDENTITY — sinh 1 lần, lưu mãi
// ══════════════════════════════════════════════════════════════
const DEVICE_ID = (() => {
  let id = localStorage.getItem('deviceId');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('deviceId', id);
    console.log('[Sync] 🆕 Device mới đăng ký:', id);
  }
  return id;
})();

// ══════════════════════════════════════════════════════════════
// [2] RECORD STAMPING
// ══════════════════════════════════════════════════════════════

// Tạo record mới với đầy đủ metadata
function stampNew(fields) {
  const now = Date.now();
  return {
    id:        uuid(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deviceId:  DEVICE_ID,
    ...fields,
  };
}

// Cập nhật record hiện có (giữ id + createdAt)
function stampEdit(record) {
  return { ...record, updatedAt: Date.now(), deviceId: DEVICE_ID };
}

// ══════════════════════════════════════════════════════════════
// [3] SOFT DELETE — không xóa khỏi array, chỉ đánh dấu
// ══════════════════════════════════════════════════════════════
function softDeleteRecord(arr, id) {
  const now = Date.now();
  return arr.map(r =>
    String(r.id) === String(id)
      ? { ...r, deletedAt: now, updatedAt: now, deviceId: DEVICE_ID }
      : r
  );
}

// ══════════════════════════════════════════════════════════════
// [4] CONFLICT RESOLUTION — updatedAt mới hơn thắng
// ══════════════════════════════════════════════════════════════
function resolveConflict(local, cloud) {
  // Fallback sang _ts nếu record cũ chưa có updatedAt
  const lt = local.updatedAt  || local.createdAt  || local._ts || 0;
  const ct = cloud.updatedAt  || cloud.createdAt  || 0;
  if (lt !== ct) {
    console.log('[Sync] ⚔ Conflict id:', String(local.id).slice(0, 8),
      '| local.updatedAt:', lt, '| cloud.updatedAt:', ct,
      '| winner:', lt >= ct ? 'LOCAL' : 'CLOUD');
  }
  return lt >= ct ? local : cloud;
}

// ══════════════════════════════════════════════════════════════
// [5] MERGE ALGORITHM — idempotent, safe
// ══════════════════════════════════════════════════════════════
// Khác mergeUnique (dùng object spread đơn giản):
//  - Dùng resolveConflict() có logging
//  - Local-only records được giữ (chưa push lên cloud)
//  - Cloud-only records được thêm vào local
function mergeDatasets(local, cloud) {
  const map = new Map();
  (local || []).forEach(r => map.set(String(r.id), r));
  (cloud || []).forEach(cloudR => {
    const key    = String(cloudR.id);
    const localR = map.get(key);
    map.set(key, localR ? resolveConflict(localR, cloudR) : cloudR);
  });
  return [...map.values()];
}

// ══════════════════════════════════════════════════════════════
// [6] MULTI-YEAR HELPER — lấy tất cả năm có trong local data
// ══════════════════════════════════════════════════════════════
function _getAllLocalYears() {
  const yrs = new Set();
  const addYr = (arr, field) =>
    (arr || []).forEach(r => { const d = r[field]; if (d && d.length >= 4) yrs.add(d.slice(0, 4)); });
  addYr(load('inv_v3', []), 'ngay');
  addYr(load('ung_v1', []), 'ngay');
  addYr(load('cc_v2',  []), 'fromDate');
  addYr(load('tb_v1',  []), 'ngay');
  addYr(load('thu_v1', []), 'ngay');
  // Luôn bao gồm năm hiện tại
  yrs.add(String(activeYear || new Date().getFullYear()));
  return [...yrs].filter(Boolean).sort();
}

// ══════════════════════════════════════════════════════════════
// [7] MERGE KEY — merge cloud data vào localStorage + IDB
// ══════════════════════════════════════════════════════════════
function _mergeKey(key, cloudExpanded) {
  if (!cloudExpanded || !cloudExpanded.length) return 0;
  const local  = load(key, []);
  const merged = mergeDatasets(local, cloudExpanded);
  localStorage.setItem(key, JSON.stringify(merged));
  _dbSave(key, merged).catch(e => console.warn('[Sync] IDB write lỗi:', key, e));
  return merged.length - local.length;
}

// ══════════════════════════════════════════════════════════════
// [8] SYNC QUEUE (lightweight tracking)
// ══════════════════════════════════════════════════════════════
const _PENDING_KEY = 'syncPending';

function enqueueChange(recordId, type) {
  const q   = _loadLS(_PENDING_KEY) || [];
  const idx = q.findIndex(c => String(c.id) === String(recordId));
  const entry = { id: String(recordId), type, ts: Date.now() };
  if (idx >= 0) q[idx] = entry; else q.push(entry);
  if (q.length > 500) q.splice(0, q.length - 500); // giới hạn 500 entries
  _saveLS(_PENDING_KEY, q);
}

function _clearQueue() { _saveLS(_PENDING_KEY, []); }

function getPendingCount() { return (_loadLS(_PENDING_KEY) || []).length; }

// ══════════════════════════════════════════════════════════════
// [9] PUSH — pull-then-merge-then-push, tất cả năm
// ══════════════════════════════════════════════════════════════
let _syncPushing = false;

async function pushChanges() {
  if (!fbReady()) {
    console.log('[Sync] Push bỏ qua — Firebase chưa cấu hình');
    return;
  }
  if (_syncPushing) {
    console.log('[Sync] Push bỏ qua — đang sync');
    return;
  }
  _syncPushing = true;
  _ensureSyncDot(); _setSyncDot('syncing');

  const years = _getAllLocalYears();
  console.log('[Sync] ▲ Push bắt đầu — năm:', years.join(', '), '| device:', DEVICE_ID.slice(0, 8));

  try {
    let ok = 0, fail = 0;

    for (const yr of years) {
      const yrInt = parseInt(yr);

      // ── Step 1: Fetch cloud để merge trước khi ghi ─────────
      // Tránh Device B ghi đè data của Device A
      try {
        const cloudDoc  = await fsGet(fbDocYear(yrInt));
        const cloudData = fsUnwrap(cloudDoc);
        if (cloudData) {
          if (cloudData.i) _mergeKey('inv_v3', expandInv(cloudData.i));
          if (cloudData.u) _mergeKey('ung_v1', expandUng(cloudData.u));
          if (cloudData.c) _mergeKey('cc_v2',  expandCC(cloudData.c));
          if (cloudData.t) _mergeKey('tb_v1',  expandTb(cloudData.t));
          if (cloudData.thu) _mergeKey('thu_v1', cloudData.thu);
          console.log(`[Sync] ↓ Merged cloud year ${yr}`);
        }
      } catch (e) {
        console.warn(`[Sync] Không fetch được cloud year ${yr}:`, e.message || e);
        // Tiếp tục push — không để fetch lỗi block toàn bộ sync
      }

      // ── Step 2: Push merged local lên cloud ────────────────
      try {
        const payload = fbYearPayload(yrInt);
        const kb      = Math.round(JSON.stringify(payload).length / 1024 * 10) / 10;
        const res     = await fsSet(fbDocYear(yrInt), payload);
        if (res && res.fields) {
          console.log(`[Sync] ▲ Year ${yr} OK (~${kb}kb)`);
          ok++;
        } else {
          const err = res?.error?.message || JSON.stringify(res?.error) || '?';
          console.warn(`[Sync] ✗ Year ${yr} lỗi:`, err);
          fail++;
        }
      } catch (e) {
        console.warn(`[Sync] ✗ Year ${yr} exception:`, e.message || e);
        fail++;
      }
    }

    // ── Cats ───────────────────────────────────────────────────
    fsSet(fbDocCats(), fbCatsPayload()).catch(e =>
      console.warn('[Sync] Cats push lỗi:', e)
    );

    if (fail === 0) {
      localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
      _clearQueue();
      _setSyncDot('');
      updateJbBtn();
      const msg = years.length > 1
        ? `✅ Đã lưu cloud (${years.length} năm: ${years.join(', ')})`
        : `✅ Đã lưu cloud (năm ${years[0]})`;
      showSyncBanner(msg, 2000);
      console.log(`[Sync] ▲ Push xong — ${ok} năm | device: ${DEVICE_ID.slice(0, 8)}`);
    } else {
      _setSyncDot('error');
      showSyncBanner(`⚠️ Lỗi push ${fail}/${years.length} năm`, 4000);
    }
  } catch (e) {
    console.warn('[Sync] ▲ Push lỗi toàn bộ:', e);
    _setSyncDot('offline');
    showSyncBanner('⚠️ Mất kết nối internet', 3000);
  } finally {
    _syncPushing = false;
  }
}

// ══════════════════════════════════════════════════════════════
// [10] PULL — merge cloud vào local, tất cả năm
// ══════════════════════════════════════════════════════════════
async function pullChanges(yr, callback) {
  if (!fbReady()) {
    console.log('[Sync] Pull bỏ qua — Firebase chưa cấu hình');
    if (callback) callback(null);
    return;
  }

  // yr=null → pull tất cả năm local; yr=number → pull năm cụ thể
  const years = yr ? [String(yr)] : _getAllLocalYears();
  console.log('[Sync] ▼ Pull bắt đầu — năm:', years.join(', '), '| device:', DEVICE_ID.slice(0, 8));
  showSyncBanner('⏳ Đang tải dữ liệu...');

  try {
    // ── Cats ─────────────────────────────────────────────────
    try {
      const catsDoc  = await fsGet(fbDocCats());
      const catsData = fsUnwrap(catsDoc);
      if (catsData?.cats) {
        const ct = catsData.cats;
        if (ct.ct)    { localStorage.setItem('cat_ct',    JSON.stringify(ct.ct));    _dbSave('cat_ct',    ct.ct).catch(()=>{}); }
        if (ct.loai)  { localStorage.setItem('cat_loai',  JSON.stringify(ct.loai));  _dbSave('cat_loai',  ct.loai).catch(()=>{}); }
        if (ct.ncc)   { localStorage.setItem('cat_ncc',   JSON.stringify(ct.ncc));   _dbSave('cat_ncc',   ct.ncc).catch(()=>{}); }
        if (ct.nguoi) { localStorage.setItem('cat_nguoi', JSON.stringify(ct.nguoi)); _dbSave('cat_nguoi', ct.nguoi).catch(()=>{}); }
      }
      if (catsData?.hopDong) {
        localStorage.setItem('hopdong_v1', JSON.stringify(catsData.hopDong));
        hopDongData = catsData.hopDong;
      }
    } catch (e) {
      console.warn('[Sync] Cats pull lỗi:', e.message || e);
    }

    // ── Year data ─────────────────────────────────────────────
    let totalNew = 0, totalConflicts = 0;

    for (const yrStr of years) {
      try {
        const doc  = await fsGet(fbDocYear(parseInt(yrStr)));
        const data = fsUnwrap(doc);
        if (!data) {
          console.log(`[Sync] ▼ Year ${yrStr} chưa có trên cloud`);
          continue;
        }

        const mergeAndCount = (key, cloudExpanded) => {
          const local    = load(key, []);
          const merged   = mergeDatasets(local, cloudExpanded);
          const newRecs  = merged.filter(m => !local.find(l => String(l.id) === String(m.id))).length;
          const conflicts = cloudExpanded.filter(cr => {
            const lr = local.find(l => String(l.id) === String(cr.id));
            return lr && (lr.updatedAt || lr._ts || 0) !== (cr.updatedAt || 0);
          }).length;
          totalNew       += newRecs;
          totalConflicts += conflicts;
          localStorage.setItem(key, JSON.stringify(merged));
          _dbSave(key, merged).catch(()=>{});
          if (newRecs || conflicts)
            console.log(`[Sync] ▼ ${key} year ${yrStr}: +${newRecs} mới, ${conflicts} conflict`);
        };

        if (data.i)   mergeAndCount('inv_v3', expandInv(data.i));
        if (data.u)   mergeAndCount('ung_v1', expandUng(data.u));
        if (data.c)   mergeAndCount('cc_v2',  expandCC(data.c));
        if (data.t)   mergeAndCount('tb_v1',  expandTb(data.t));
        if (data.thu) {
          mergeAndCount('thu_v1', data.thu);
          thuRecords = load('thu_v1', []);
        }
      } catch (e) {
        console.warn(`[Sync] Pull year ${yrStr} lỗi:`, e.message || e);
      }
    }

    hideSyncBanner();
    console.log(`[Sync] ▼ Pull xong — ${totalNew} record mới, ${totalConflicts} conflicts | device: ${DEVICE_ID.slice(0, 8)}`);
    if (callback) callback({ newRecords: totalNew, conflicts: totalConflicts });

    // Sau pull → push local-only records lên cloud
    setTimeout(() => pushChanges(), 1500);

  } catch (e) {
    console.warn('[Sync] ▼ Pull lỗi toàn bộ:', e);
    hideSyncBanner();
    if (callback) callback(null);
  }
}

// ══════════════════════════════════════════════════════════════
// [11] PROCESS QUEUE — debounced, gọi từ save()
// ══════════════════════════════════════════════════════════════
let _pushTimer = null;

function processQueue() {
  clearTimeout(_pushTimer);
  _pushTimer = setTimeout(() => {
    const pending = getPendingCount();
    if (pending > 0) console.log(`[Sync] ⏳ processQueue — ${pending} thay đổi đang chờ`);
    pushChanges();
  }, 2500);
}
