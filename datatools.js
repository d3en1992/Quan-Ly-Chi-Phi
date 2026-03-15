// datatools.js — Quản lý dữ liệu: JSON backup/restore + Xóa năm + Reset toàn bộ
// Load order: sau nhapxuat.js

'use strict';

// ══════════════════════════════════════════════════════════════
// [1] MISC
// ══════════════════════════════════════════════════════════════

function openDeleteModal() {
  toast('Tính năng Xóa Dữ Liệu đã bị tắt.', 'error');
}

// ══════════════════════════════════════════════════════════════
// [2] DATA MANAGEMENT — Xóa theo năm / Reset toàn bộ
// ══════════════════════════════════════════════════════════════

// Confirm modal yêu cầu gõ "DELETE"
function _showDeleteConfirm(title, bodyHtml, onConfirm) {
  const existing = document.getElementById('_del-confirm-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = '_del-confirm-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9998;'
    + 'display:flex;align-items:center;justify-content:center;padding:16px';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:10px;padding:24px;max-width:420px;width:100%;
                box-shadow:0 8px 32px rgba(0,0,0,.28);font-family:inherit">
      <div style="font-size:15px;font-weight:700;color:#c0392b;margin-bottom:10px">${title}</div>
      <div style="font-size:13px;color:#333;line-height:1.65;margin-bottom:16px">${bodyHtml}</div>
      <div style="margin-bottom:16px">
        <label style="font-size:12px;color:#555;display:block;margin-bottom:6px">
          Gõ <strong>DELETE</strong> để xác nhận:
        </label>
        <input id="_del-inp" type="text" autocomplete="off" placeholder="DELETE"
          style="width:100%;box-sizing:border-box;padding:8px 12px;border:2px solid #e74c3c;
                 border-radius:6px;font-size:14px;font-family:monospace;letter-spacing:2px;outline:none">
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button id="_del-cancel" style="padding:8px 18px;border:1px solid #ccc;border-radius:6px;
          background:#f5f5f5;cursor:pointer;font-size:13px">Huỷ</button>
        <button id="_del-ok" style="padding:8px 18px;border:none;border-radius:6px;
          background:#e74c3c;color:#fff;cursor:pointer;font-size:13px;font-weight:700;opacity:.45" disabled>
          Xoá
        </button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const inp    = overlay.querySelector('#_del-inp');
  const okBtn  = overlay.querySelector('#_del-ok');
  const canBtn = overlay.querySelector('#_del-cancel');

  inp.addEventListener('input', () => {
    const ok = inp.value.trim() === 'DELETE';
    okBtn.disabled = !ok;
    okBtn.style.opacity = ok ? '1' : '.45';
  });
  canBtn.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  okBtn.addEventListener('click', () => {
    if (inp.value.trim() !== 'DELETE') return;
    overlay.remove();
    onConfirm();
  });
  setTimeout(() => inp.focus(), 60);
}

// Helper: cập nhật cats global + localStorage + IDB
function _saveCatKey(catsKey, lsKey, arr) {
  if (typeof cats !== 'undefined' && cats) cats[catsKey] = arr;
  localStorage.setItem(lsKey, JSON.stringify(arr));
  if (typeof _dbSave === 'function') _dbSave(lsKey, arr).catch(() => {});
}

// ── Xóa dữ liệu theo năm ─────────────────────────────────────

function toolDeleteYear() {
  const yr = (typeof activeYear !== 'undefined') ? String(activeYear) : '0';
  if (!yr || yr === '0') {
    toast('Chọn một năm cụ thể (không phải "Tất cả") rồi mới xóa.', 'error');
    return;
  }

  _showDeleteConfirm(
    `🗑 Xóa dữ liệu năm ${yr}`,
    `Thao tác sẽ <b>xóa vĩnh viễn</b> tất cả hóa đơn, tiền ứng, chấm công, thu tiền,
     hợp đồng của năm <b>${yr}</b>.<br><br>
     • App tự động backup trước khi xóa.<br>
     • Danh mục công trình không còn được dùng sẽ bị xóa theo.<br>
     • Thiết bị của công trình bị xóa sẽ chuyển về <b>KHO TỔNG</b>.`,
    () => _doDeleteYear(yr)
  );
}

async function _doDeleteYear(yr) {
  if (typeof showSyncBanner === 'function') showSyncBanner('⏳ Đang xóa dữ liệu năm ' + yr + '...');
  try {
    // 1. Auto-backup
    if (typeof _snapshotNow === 'function') _snapshotNow('pre-delete-' + yr);

    const now     = Date.now();
    const devId   = (typeof DEVICE_ID !== 'undefined') ? DEVICE_ID : '';
    const softDel = r => ({ ...r, deletedAt: now, updatedAt: now, deviceId: devId });
    const matchYr = (r, field) => !r.deletedAt && r[field] && String(r[field]).startsWith(yr);

    // 2. Soft-delete records matching the year
    if (typeof invoices          !== 'undefined')
      invoices          = invoices.map(r => matchYr(r, 'ngay')     ? softDel(r) : r);
    if (typeof ungRecords        !== 'undefined')
      ungRecords        = ungRecords.map(r => matchYr(r, 'ngay')   ? softDel(r) : r);
    if (typeof ccData            !== 'undefined')
      ccData            = ccData.map(r => matchYr(r, 'fromDate')   ? softDel(r) : r);
    if (typeof thuRecords        !== 'undefined')
      thuRecords        = thuRecords.map(r => matchYr(r, 'ngay')   ? softDel(r) : r);
    if (typeof thauPhuContracts  !== 'undefined')
      thauPhuContracts  = thauPhuContracts.map(r => matchYr(r, 'ngay') ? softDel(r) : r);

    // hopDongData là object keyed by CT name
    if (typeof hopDongData !== 'undefined' && hopDongData && typeof hopDongData === 'object') {
      Object.keys(hopDongData).forEach(ct => {
        const hd = hopDongData[ct];
        if (hd && !hd.deletedAt && hd.ngay && String(hd.ngay).startsWith(yr))
          hopDongData[ct] = softDel(hd);
      });
    }

    // 3. Tính các CT còn được dùng sau khi xóa (toàn bộ năm)
    const _activeCTs = arr => (arr || []).filter(r => !r.deletedAt).map(r => r.congtrinh).filter(Boolean);
    const usedCT = new Set([
      ..._activeCTs(typeof invoices         !== 'undefined' ? invoices         : []),
      ..._activeCTs(typeof ungRecords       !== 'undefined' ? ungRecords       : []),
      ..._activeCTs(typeof ccData           !== 'undefined' ? ccData           : []),
      ..._activeCTs(typeof thuRecords       !== 'undefined' ? thuRecords       : []),
      ..._activeCTs(typeof thauPhuContracts !== 'undefined' ? thauPhuContracts : []),
      ...Object.keys(typeof hopDongData !== 'undefined' && hopDongData ? hopDongData : {})
          .filter(ct => !((hopDongData[ct] || {}).deletedAt)),
    ]);

    // 4. Chuyển thiết bị của CT bị xóa → KHO TỔNG
    let movedEq = 0;
    if (typeof tbData !== 'undefined') {
      tbData = tbData.map(r => {
        if (!r.deletedAt && r.ct && !usedCT.has(r.ct)) {
          movedEq++;
          return { ...r, ct: 'KHO TỔNG', updatedAt: now, deviceId: devId };
        }
        return r;
      });
    }
    if (movedEq) console.log(`[DeleteYear] ${movedEq} thiết bị → KHO TỔNG`);

    // 5. Dọn danh mục không còn được tham chiếu
    const _prune = (arr, usedSet) => (arr || []).filter(v => usedSet.has(v));
    const _catArr = key => (typeof cats !== 'undefined' && cats ? (cats[key] || []) : []);

    _saveCatKey('congTrinh',  'cat_ct',    _prune(_catArr('congTrinh'),  usedCT));

    const usedNCC   = new Set((typeof invoices !== 'undefined' ? invoices : [])
                        .filter(r => !r.deletedAt).map(r => r.ncc).filter(Boolean));
    const usedNguoi = new Set((typeof invoices !== 'undefined' ? invoices : [])
                        .filter(r => !r.deletedAt).map(r => r.nguoi).filter(Boolean));
    const usedTP    = new Set([
      ...(typeof ungRecords !== 'undefined' ? ungRecords : [])
          .filter(r => !r.deletedAt && r.loai === 'thauphu').map(r => r.tp),
      ...(typeof thauPhuContracts !== 'undefined' ? thauPhuContracts : [])
          .filter(r => !r.deletedAt).map(r => r.thauphu),
    ].filter(Boolean));
    const usedCN    = new Set((typeof ungRecords !== 'undefined' ? ungRecords : [])
                        .filter(r => !r.deletedAt && r.loai === 'congnhan').map(r => r.tp)
                        .filter(Boolean));

    _saveCatKey('nhaCungCap', 'cat_ncc',   _prune(_catArr('nhaCungCap'), usedNCC));
    _saveCatKey('nguoiTH',    'cat_nguoi', _prune(_catArr('nguoiTH'),    usedNguoi));
    _saveCatKey('thauPhu',    'cat_tp',    _prune(_catArr('thauPhu'),    usedTP));
    _saveCatKey('congNhan',   'cat_cn',    _prune(_catArr('congNhan'),   usedCN));

    // 6. Ghi xuống localStorage + IDB + enqueue sync
    if (typeof save === 'function') {
      if (typeof invoices          !== 'undefined') save('inv_v3',     invoices);
      if (typeof ungRecords        !== 'undefined') save('ung_v1',     ungRecords);
      if (typeof ccData            !== 'undefined') save('cc_v2',      ccData);
      if (typeof thuRecords        !== 'undefined') save('thu_v1',     thuRecords);
      if (typeof thauPhuContracts  !== 'undefined') save('thauphu_v1', thauPhuContracts);
      if (typeof tbData            !== 'undefined') save('tb_v1',      tbData);
    }
    if (typeof hopDongData !== 'undefined')
      localStorage.setItem('hopdong_v1', JSON.stringify(hopDongData));

    // 7. Push lên Firebase (ghi đè cloud, tránh re-pull data đã xóa)
    if (typeof pushChanges === 'function') setTimeout(() => pushChanges(), 600);

    if (typeof hideSyncBanner === 'function') hideSyncBanner();
    const eqMsg = movedEq ? ` · ${movedEq} thiết bị → KHO TỔNG` : '';
    toast(`✅ Đã xóa dữ liệu năm ${yr}${eqMsg}`, 'success');

    // 8. Refresh UI
    if (typeof _refreshAllTabs === 'function') _refreshAllTabs();
    else if (typeof renderDanhMuc === 'function') renderDanhMuc();

  } catch (e) {
    if (typeof hideSyncBanner === 'function') hideSyncBanner();
    console.error('[DeleteYear] Lỗi:', e);
    toast('❌ Lỗi khi xóa dữ liệu: ' + (e.message || String(e)), 'error');
  }
}

// ── Reset toàn bộ dữ liệu ────────────────────────────────────

function toolResetAll() {
  _showDeleteConfirm(
    '⚠️ Reset toàn bộ dữ liệu',
    `Thao tác sẽ <b>xóa TOÀN BỘ</b> dữ liệu:<br>
     hóa đơn, chấm công, tiền ứng, thu tiền, hợp đồng, danh mục, thiết bị...<br><br>
     • App tự động backup trước khi reset.<br>
     • <b>Không thể hoàn tác</b> sau khi xác nhận.<br>
     • Cloud sẽ được đồng bộ trạng thái trống.`,
    _doResetAll
  );
}

async function _doResetAll() {
  if (typeof showSyncBanner === 'function') showSyncBanner('⏳ Đang reset toàn bộ dữ liệu...');
  try {
    // 1. Auto-backup
    if (typeof _snapshotNow === 'function') _snapshotNow('pre-reset-all');

    // 2. Xóa data globals
    if (typeof invoices          !== 'undefined') invoices          = [];
    if (typeof ungRecords        !== 'undefined') ungRecords        = [];
    if (typeof ccData            !== 'undefined') ccData            = [];
    if (typeof tbData            !== 'undefined') tbData            = [];
    if (typeof thuRecords        !== 'undefined') thuRecords        = [];
    if (typeof thauPhuContracts  !== 'undefined') thauPhuContracts  = [];
    if (typeof hopDongData       !== 'undefined') hopDongData       = {};
    if (typeof trash             !== 'undefined') trash             = [];

    // 3. Xóa cats
    if (typeof cats !== 'undefined' && cats) {
      cats.congTrinh  = [];
      cats.nhaCungCap = [];
      cats.nguoiTH    = [];
      cats.loaiCp     = [];
      cats.thauPhu    = [];
      cats.congNhan   = [];
      if ('tbTen' in cats) cats.tbTen = [];
    }

    // 4. Xóa localStorage data keys
    ['inv_v3','ung_v1','cc_v2','tb_v1','thu_v1','thauphu_v1','trash_v1',
     'cat_ct','cat_loai','cat_ncc','cat_nguoi','cat_tp','cat_cn','cat_tbteb']
      .forEach(k => localStorage.setItem(k, JSON.stringify([])));
    localStorage.setItem('hopdong_v1', JSON.stringify({}));

    // 5. Xóa IDB tables
    if (typeof db !== 'undefined' && db) {
      try {
        await Promise.all([
          db.invoices   ? db.invoices.clear()   : Promise.resolve(),
          db.attendance ? db.attendance.clear() : Promise.resolve(),
          db.equipment  ? db.equipment.clear()  : Promise.resolve(),
          db.ung        ? db.ung.clear()        : Promise.resolve(),
          db.revenue    ? db.revenue.clear()    : Promise.resolve(),
          db.categories ? db.categories.clear() : Promise.resolve(),
        ]);
      } catch (e) { console.warn('[ResetAll] IDB clear lỗi:', e); }
    }

    // 6. Push trạng thái trống lên Firebase
    if (typeof pushChanges === 'function') setTimeout(() => pushChanges(), 600);

    if (typeof hideSyncBanner === 'function') hideSyncBanner();
    toast('✅ Đã reset toàn bộ dữ liệu', 'success');

    // 7. Refresh UI
    if (typeof _refreshAllTabs === 'function') _refreshAllTabs();
    else if (typeof renderDanhMuc === 'function') renderDanhMuc();

  } catch (e) {
    if (typeof hideSyncBanner === 'function') hideSyncBanner();
    console.error('[ResetAll] Lỗi:', e);
    toast('❌ Lỗi khi reset: ' + (e.message || String(e)), 'error');
  }
}

// ══════════════════════════════════════════════════════════════
// [3] PUBLIC WRAPPERS — JSON & backup (gọi từ HTML onclick)
// ══════════════════════════════════════════════════════════════

function toolExportJSON() { exportJSON(); }
function toolImportJSON() { document.getElementById('import-json-input').click(); }
