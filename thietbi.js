// thietbi.js — Theo Doi Thiet Bi
// Load order: 5

//  THEO DÕI THIẾT BỊ (tb_v1)
// ══════════════════════════════════════════════════════════════════
const TB_TINH_TRANG = ['Đang hoạt động', 'Hoạt động lâu', 'Cần sửa chữa'];
const TB_TEN_MAY = [
  'Máy cắt cầm tay', 'Máy cắt bàn', 'Máy uốn sắt lớn', 'Bàn uốn sắt',
  'Thước nhôm', 'Chân Dàn 1.7m', 'Chân Dàn 1.5m',
  'Chéo lớn', 'Chéo nhỏ', 'Kít tăng giàn giáo', 'Cây chống tăng'
];
const TB_KHO_TONG = 'KHO TỔNG';
const TB_STATUS_STYLE = {
  'Đang hoạt động': 'background:#e6f4ec;color:#1a7a45;',
  'Hoạt động lâu':  'background:#fef3dc;color:#c8870a;',
  'Cần sửa chữa':   'background:#fdecea;color:#c0392b;'
};

let tbData = load('tb_v1', []);

// ── Chuẩn hóa tên thiết bị: viết hoa chữ cái đầu mỗi từ ─────────
function normalizeTbName(name) {
  return (name || '').trim().toLowerCase()
    .split(/\s+/).filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ── Dynamic name list: CHỈ lấy từ cats.tbTen ──────────────────────
function tbGetNames() {
  const catList = (cats && cats.tbTen && cats.tbTen.length) ? cats.tbTen : TB_TEN_MAY;
  return [...catList].sort((a,b) => a.localeCompare(b,'vi'));
}

function tbRefreshNameDl() {
  const dl = document.getElementById('tb-ten-dl');
  if (!dl) return;
  dl.innerHTML = tbGetNames().map(n=>`<option value="${x(n)}">`).join('');
}

// Chuẩn hóa các entry hiện có trong cats.tbTen (không thêm từ tbData)
function tbSyncNamesToCats() {
  if (!cats || !cats.tbTen) return;
  const before = JSON.stringify(cats.tbTen);
  // Chỉ chuẩn hóa tên đã có — không sync từ tbData để tránh tên người lọt vào
  cats.tbTen = cats.tbTen
    .map(n => normalizeTbName(n))
    .filter(Boolean);
  // Dedupe theo lowercase
  const seen = new Set();
  cats.tbTen = cats.tbTen.filter(n => {
    const k = n.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
  if (JSON.stringify(cats.tbTen) !== before) {
    try { saveCats('tbTen'); } catch(e) {}
  }
}

// ── Populate selects ──────────────────────────────────────────────
function tbPopulateSels() {
  // Dropdown CT: CHỈ từ cats.congTrinh (không lấy từ tbData)
  const validCts = [...new Set((cats.congTrinh || []).filter(v => v && v !== TB_KHO_TONG))].sort();
  const allCts = [TB_KHO_TONG, ...validCts];
  const filtered = allCts.filter(ct => ct === TB_KHO_TONG || _ctInActiveYear(ct));

  const sel = document.getElementById('tb-ct-sel');
  const cur = sel.value;
  sel.innerHTML = '<option value="">-- Chọn công trình --</option>' +
    filtered.map(v=>`<option value="${x(v)}" ${v===cur?'selected':''}>${x(v)}</option>`).join('');

  const fSel = document.getElementById('tb-filter-ct');
  const fCur = fSel.value;
  fSel.innerHTML = '<option value="">Tất cả công trình</option>' +
    filtered.map(v=>`<option value="${x(v)}" ${v===fCur?'selected':''}>${x(v)}</option>`).join('');

  // Bộ lọc tên KHO: chỉ lấy tên thiết bị có trong cats.tbTen
  const validNames = new Set((cats.tbTen || []).map(n => n.toLowerCase()));
  const khoFSel = document.getElementById('kho-filter-ten');
  if (khoFSel) {
    const khoNames = [...new Set(
      tbData.filter(r => !r.deletedAt && r.ct === TB_KHO_TONG && r.ten && validNames.has(r.ten.toLowerCase()))
            .map(r => r.ten)
    )].sort((a,b) => a.localeCompare(b,'vi'));
    const khoFCur = khoFSel.value;
    khoFSel.innerHTML = '<option value="">Tất cả thiết bị</option>' +
      khoNames.map(v=>`<option value="${x(v)}" ${v===khoFCur?'selected':''}>${x(v)}</option>`).join('');
  }

  // Bộ lọc tên Thống Kê: chỉ lấy từ cats.tbTen
  const tkFSel = document.getElementById('tk-filter-ten');
  if (tkFSel) {
    const tkNames = tbGetNames();
    const tkFCur = tkFSel.value;
    tkFSel.innerHTML = '<option value="">Tất cả thiết bị</option>' +
      tkNames.map(v=>`<option value="${x(v)}" ${v===tkFCur?'selected':''}>${x(v)}</option>`).join('');
  }
}

// ── Build nhập bảng ───────────────────────────────────────────────
function tbBuildRows(n=5) {
  const tbody = document.getElementById('tb-tbody');
  tbody.innerHTML = '';
  for (let i=0; i<n; i++) tbAddRow(null, i+1);
}

function tbAddRows(n) {
  const tbody = document.getElementById('tb-tbody');
  const cur = tbody.querySelectorAll('tr').length;
  for (let i=0; i<n; i++) tbAddRow(null, cur+i+1);
}

function tbAddRow(data, num) {
  const tbody = document.getElementById('tb-tbody');
  const idx = num || (tbody.querySelectorAll('tr').length + 1);
  const tr = document.createElement('tr');

  const ttOpts = TB_TINH_TRANG.map(v =>
    `<option value="${v}" ${data&&data.tinhtrang===v?'selected':v==='Đang hoạt động'&&!data?'selected':''}>${v}</option>`
  ).join('');

  tr.innerHTML = `
    <td class="row-num">${idx}</td>
    <td class="tb-name-col" style="padding:0">
      <input class="cc-name-input" list="tb-ten-dl" data-tb="ten"
        value="${x(data?.ten||'')}" placeholder="Nhập tên hoặc chọn..."
        style="width:100%;border:none;background:transparent;padding:7px 10px;font-size:13px;font-family:'IBM Plex Sans',sans-serif;outline:none;color:var(--ink)">
    </td>
    <td style="padding:0">
      <input type="number" data-tb="soluong" class="np-num-input" min="0" step="1" inputmode="decimal"
        value="${data?.soluong||''}" placeholder="0"
        style="width:100%;border:none;background:transparent;padding:7px 8px;text-align:center;font-size:13px;font-family:'IBM Plex Mono',monospace;outline:none;color:var(--ink)">
    </td>
    <td style="padding:0">
      <select data-tb="tinhtrang"
        style="width:100%;border:none;background:transparent;padding:7px 8px;font-size:12px;font-family:'IBM Plex Sans',sans-serif;outline:none;color:var(--ink);cursor:pointer">
        ${ttOpts}
      </select>
    </td>
    <td style="padding:0">
      <input class="cc-name-input" data-tb="nguoi" list="tb-nguoi-dl"
        value="${x(data?.nguoi||'')}" placeholder="—"
        style="width:100%;border:none;background:transparent;padding:7px 8px;font-size:12px;font-family:'IBM Plex Sans',sans-serif;outline:none;color:var(--ink)">
    </td>
    <td style="padding:0">
      <input class="cc-name-input" data-tb="ghichu"
        value="${x(data?.ghichu||'')}" placeholder="—"
        style="width:100%;border:none;background:transparent;padding:7px 8px;font-size:12px;font-family:'IBM Plex Sans',sans-serif;outline:none;color:var(--ink)">
    </td>
    <td style="padding:3px 4px;text-align:center">
      <button class="btn btn-danger btn-sm" onclick="this.closest('tr').remove();tbRenum()" title="Xóa dòng">✕</button>
    </td>`;
  tbody.appendChild(tr);

  // Đảm bảo datalist tên tồn tại và cập nhật
  if (!document.getElementById('tb-ten-dl')) {
    const dl = document.createElement('datalist');
    dl.id = 'tb-ten-dl';
    dl.innerHTML = tbGetNames().map(n=>`<option value="${x(n)}">`).join('');
    document.body.appendChild(dl);
  }
  // Datalist nguoi: kết hợp nguoiTH + congNhan + thauPhu
  let _tbNguoiDl = document.getElementById('tb-nguoi-dl');
  if (!_tbNguoiDl) {
    _tbNguoiDl = document.createElement('datalist');
    _tbNguoiDl.id = 'tb-nguoi-dl';
    document.body.appendChild(_tbNguoiDl);
  }
  _tbNguoiDl.innerHTML = [...new Set([...cats.nguoiTH,...cats.congNhan,...cats.thauPhu])].sort().map(n=>`<option value="${x(n)}">`).join('');
}

function tbRenum() {
  document.querySelectorAll('#tb-tbody tr').forEach((tr,i) => {
    const numCell = tr.querySelector('.row-num');
    if (numCell) numCell.textContent = i+1;
  });
}

function tbClearRows() {
  if (!confirm('Xóa bảng nhập?')) return;
  tbBuildRows();
}

// ── Lưu thiết bị ─────────────────────────────────────────────────
function tbSave() {
  const saveBtn = document.getElementById('tb-save-btn');
  if (saveBtn && saveBtn.disabled) return;
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '⏳ Đang lưu...'; }

  const ct = document.getElementById('tb-ct-sel').value.trim();
  if (!ct) {
    toast('Vui lòng chọn công trình!', 'error');
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Lưu thiết bị'; }
    return;
  }

  const rows = [];
  const ngay = today();
  document.querySelectorAll('#tb-tbody tr').forEach(tr => {
    const raw    = tr.querySelector('[data-tb="ten"]')?.value?.trim() || '';
    const ten    = normalizeTbName(raw);  // chuẩn hóa viết hoa chữ cái đầu
    const sl     = parseFloat(tr.querySelector('[data-tb="soluong"]')?.value) || 0;
    const tt     = tr.querySelector('[data-tb="tinhtrang"]')?.value || 'Đang hoạt động';
    const nguoi  = tr.querySelector('[data-tb="nguoi"]')?.value?.trim() || '';
    const ghichu = tr.querySelector('[data-tb="ghichu"]')?.value?.trim() || '';
    if (ten) rows.push({ ten, soluong: sl, tinhtrang: tt, nguoi, ghichu });
  });

  if (!rows.length) {
    toast('Không có dữ liệu để lưu!', 'error');
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Lưu thiết bị'; }
    return;
  }

  // Chuẩn hóa: cộng dồn nếu đã tồn tại record cùng (ct + ten + tinhtrang)
  rows.forEach(row => {
    const exist = tbData.find(rec => rec.ct === ct && rec.ten === row.ten && rec.tinhtrang === row.tinhtrang);
    if (exist) {
      exist.soluong = (exist.soluong || 0) + row.soluong;
      exist.ngay = ngay;
      if (row.nguoi) exist.nguoi = row.nguoi;
      if (row.ghichu) exist.ghichu = row.ghichu;
    } else {
      tbData.push({ id: uuid(), createdAt: Date.now(), updatedAt: Date.now(), deletedAt: null, deviceId: DEVICE_ID, ct, ...row, ngay });
    }
  });

  save('tb_v1', tbData);
  // Sync tên thiết bị mới vào cats.tbTen (dedup theo lowercase)
  if (cats && cats.tbTen) {
    let catChanged = false;
    rows.forEach(row => {
      if (!row.ten) return;
      const norm = normalizeTbName(row.ten);
      const exists = cats.tbTen.some(n => n.toLowerCase() === norm.toLowerCase());
      if (!exists) { cats.tbTen.push(norm); catChanged = true; }
    });
    if (catChanged) { try { saveCats('tbTen'); } catch(e) {} }
  }
  // Tự động thêm tên Người TH mới vào cats.nguoiTH
  let tbNguoiChanged = false;
  rows.forEach(row => {
    const nguoi = (row.nguoi||'').trim().toUpperCase();
    if (nguoi && !cats.nguoiTH.includes(nguoi) && !cats.congNhan.includes(nguoi) && !cats.thauPhu.includes(nguoi)) {
      cats.nguoiTH.push(nguoi); tbNguoiChanged = true;
    }
  });
  if (tbNguoiChanged) { cats.nguoiTH.sort(); try { saveCats('nguoiTH'); } catch(e) {} }
  tbRefreshNameDl();
  tbPopulateSels();
  tbRenderList();
  tbRenderThongKeVon();
  renderKhoTong();
  tbBuildRows();
  toast(`✅ Đã lưu ${rows.length} thiết bị vào ${ct}`, 'success');
  setTimeout(() => {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Lưu thiết bị'; }
  }, 1500);
}

// ── Render bảng danh sách (Công Trình — không gồm KHO TỔNG) ──────
const TB_PG = 7;
let tbPage = 1;

function tbRenderList() {
  const fCt = document.getElementById('tb-filter-ct')?.value || '';
  const fTt = document.getElementById('tb-filter-tt')?.value || '';
  const fQ  = (document.getElementById('tb-search')?.value || '').toLowerCase().trim();
  let filtered = tbData.filter(r => {
    // Bảng này chỉ hiển thị thiết bị tại công trình, không gồm KHO TỔNG
    if (r.deletedAt) return false;
    if (r.ct === TB_KHO_TONG) return false;
    if (fCt && r.ct !== fCt) return false;
    if (fTt && r.tinhtrang !== fTt) return false;
    if (fQ && !(r.ten||'').toLowerCase().includes(fQ) && !(r.nguoi||'').toLowerCase().includes(fQ) && !(r.ghichu||'').toLowerCase().includes(fQ)) return false;
    if (activeYear !== 0) {
      const ctActive = _entityInYear(r.ct, 'ct');
      const isRunning = r.tinhtrang === 'Đang hoạt động';
      if (!ctActive && !isRunning) return false;
    }
    return true;
  });

  filtered.sort((a,b) => (a.ct||'').localeCompare(b.ct,'vi') || (a.ten||'').localeCompare(b.ten,'vi'));

  const tbody = document.getElementById('tb-list-tbody');
  const start = (tbPage-1)*TB_PG;
  const paged = filtered.slice(start, start+TB_PG);

  if (!paged.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="8">Chưa có thiết bị nào${fCt?' tại '+fCt:''}</td></tr>`;
    document.getElementById('tb-pagination').innerHTML = '';
    return;
  }

  tbody.innerHTML = paged.map(r => {
    const ttStyle = TB_STATUS_STYLE[r.tinhtrang] || '';
    const ttOpts = TB_TINH_TRANG.map(v =>
      `<option value="${v}" ${r.tinhtrang===v?'selected':''}>${v}</option>`
    ).join('');
    return `<tr data-tbid="${r.id}">
      <td class="tb-ct-col" title="${x(r.ct)}">${x(r.ct)}</td>
      <td class="tb-name-col"><span class="tb-name-cell" style="font-weight:600;font-size:13px">${x(r.ten)}</span></td>
      <td style="text-align:center;font-family:'IBM Plex Mono',monospace;font-weight:700;font-size:14px;color:var(--gold)">${r.soluong||0}</td>
      <td>
        <select onchange="tbUpdateField('${r.id}','tinhtrang',this.value)"
          class="tb-status" style="cursor:pointer;border:1px solid var(--line2);${ttStyle}">
          ${ttOpts}
        </select>
      </td>
      <td style="color:var(--ink2);font-size:12px">${x(r.nguoi||'—')}</td>
      <td style="color:var(--ink2);font-size:12px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${x(r.ghichu)}">${x(r.ghichu||'—')}</td>
      <td style="font-size:10px;color:var(--ink3);white-space:nowrap">${r.ngay||''}</td>
      <td style="white-space:nowrap;display:flex;gap:4px;padding:6px 4px">
        <button class="btn btn-outline btn-sm" onclick="tbEditRow('${r.id}')" title="Sửa">✏️</button>
        <button class="btn btn-sm" onclick="tbThuHoi('${r.id}')" title="Thu hồi về KHO TỔNG"
          style="background:#2563eb;color:#fff;border:none;font-size:11px;padding:3px 8px;border-radius:5px;cursor:pointer;font-family:inherit">↩ Thu Hồi</button>
      </td>
    </tr>`;
  }).join('');

  const tp = Math.ceil(filtered.length/TB_PG);
  let pag = `<span>${filtered.length} thiết bị</span>`;
  if (tp>1) {
    pag += '<div class="page-btns">';
    for(let p=1;p<=Math.min(tp,10);p++) pag+=`<button class="page-btn ${p===tbPage?'active':''}" onclick="tbGoTo(${p})">${p}</button>`;
    pag += '</div>';
  }
  document.getElementById('tb-pagination').innerHTML = pag;
}

function tbGoTo(p) { tbPage=p; tbRenderList(); }

// ── Cập nhật tình trạng inline ────────────────────────────────────
function tbUpdateField(id, field, val) {
  const idx = tbData.findIndex(r=>r.id===id);
  if (idx<0) return;
  tbData[idx][field] = val;
  tbData[idx].updatedAt = Date.now();
  tbData[idx].deviceId  = DEVICE_ID;
  save('tb_v1', tbData);
  tbRenderList();
  tbRenderThongKeVon();
  renderKhoTong();
  toast('✅ Đã cập nhật tình trạng', 'success');
}

// ── Xóa thiết bị (chỉ áp dụng cho KHO TỔNG) ─────────────────────
function tbDeleteRow(id) {
  const r = tbData.find(rec=>rec.id===id);
  if (!r) return;
  if (r.ct !== TB_KHO_TONG) { toast('Không thể xóa thiết bị ở công trình!', 'error'); return; }
  if (!confirm('Xóa thiết bị này khỏi Kho Tổng?')) return;
  tbData = softDeleteRecord(tbData, id);
  save('tb_v1', tbData);
  tbRenderList();
  tbRenderThongKeVon();
  renderKhoTong();
  toast('Đã xóa thiết bị khỏi Kho Tổng');
}

// ── Sửa thiết bị (modal) ─────────────────────────────────────────
function tbEditRow(id) {
  const r = tbData.find(rec=>rec.id===id);
  if (!r) return;
  let ov = document.getElementById('tb-edit-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'tb-edit-overlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px';
    ov.onclick = function(e){ if(e.target===this) this.remove(); };
    document.body.appendChild(ov);
  }

  // CT dropdown: CHỈ từ cats.congTrinh + KHO TỔNG
  const allCts = [
    TB_KHO_TONG,
    ...[...new Set((cats.congTrinh || []).filter(v => v && v !== TB_KHO_TONG))].sort()
  ];
  const ctOpts = allCts.map(v=>`<option value="${x(v)}" ${v===r.ct?'selected':''}>${x(v)}</option>`).join('');
  const ttOpts = TB_TINH_TRANG.map(v=>`<option value="${v}" ${r.tinhtrang===v?'selected':''}>${v}</option>`).join('');
  const isKho = r.ct === TB_KHO_TONG;
  const hintText = isKho
    ? 'Phần còn lại vẫn ở KHO TỔNG.'
    : 'Phần còn lại → KHO TỔNG.';

  ov.innerHTML = `
  <div style="background:#fff;border-radius:14px;padding:24px;width:min(480px,96vw);box-shadow:0 8px 32px rgba(0,0,0,.2);font-family:'IBM Plex Sans',sans-serif" onclick="event.stopPropagation()">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h3 style="font-size:16px;font-weight:700">✏️ Sửa Thiết Bị</h3>
      <button onclick="document.getElementById('tb-edit-overlay').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#888">✕</button>
    </div>
    <div style="display:grid;gap:10px">
      <div><label style="font-size:12px;font-weight:600;color:#555;display:block;margin-bottom:3px">Tên Thiết Bị</label>
        <input id="tb-ei-ten" type="text" value="${x(r.ten)}" readonly
          style="width:100%;padding:8px 10px;border:1.5px solid #ddd;border-radius:7px;font-family:inherit;font-size:13px;outline:none;background:#f5f5f5;color:#888;cursor:not-allowed"></div>
      <div><label style="font-size:12px;font-weight:600;color:#555;display:block;margin-bottom:3px">Công Trình</label>
        <select id="tb-ei-ct" style="width:100%;padding:8px 10px;border:1.5px solid #ddd;border-radius:7px;font-family:inherit;font-size:13px;outline:none">
          <option value="">-- Chọn --</option>${ctOpts}</select></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><label style="font-size:12px;font-weight:600;color:#555;display:block;margin-bottom:3px">Số Lượng <span style="font-weight:400;color:var(--ink3)">(tối đa ${r.soluong||0})</span></label>
          <input id="tb-ei-sl" type="number" class="np-num-input" min="1" max="${r.soluong||0}" value="${r.soluong||0}" inputmode="decimal"
            style="width:100%;padding:8px 10px;border:1.5px solid #ddd;border-radius:7px;font-family:inherit;font-size:13px;outline:none"></div>
        <div><label style="font-size:12px;font-weight:600;color:#555;display:block;margin-bottom:3px">Tình Trạng</label>
          <select id="tb-ei-tt" style="width:100%;padding:8px 10px;border:1.5px solid #ddd;border-radius:7px;font-family:inherit;font-size:13px;outline:none">${ttOpts}</select></div>
      </div>
      <div><label style="font-size:12px;font-weight:600;color:#555;display:block;margin-bottom:3px">Người TH</label>
        <input id="tb-ei-nguoi" type="text" value="${x(r.nguoi||'')}" list="tb-nguoi-dl"
          style="width:100%;padding:8px 10px;border:1.5px solid #ddd;border-radius:7px;font-family:inherit;font-size:13px;outline:none"></div>
      <div><label style="font-size:12px;font-weight:600;color:#555;display:block;margin-bottom:3px">Ghi Chú</label>
        <input id="tb-ei-ghichu" type="text" value="${x(r.ghichu||'')}"
          style="width:100%;padding:8px 10px;border:1.5px solid #ddd;border-radius:7px;font-family:inherit;font-size:13px;outline:none"></div>
      <div style="background:#f0f7ff;border-radius:8px;padding:10px;font-size:12px;color:#1565c0">
        ℹ️ SL nhập = số lượng chuyển đi. ${hintText}
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-top:16px">
      <button onclick="document.getElementById('tb-edit-overlay').remove()"
        style="flex:1;padding:10px;border-radius:8px;border:1.5px solid #ddd;background:#fff;font-family:inherit;font-size:13px;cursor:pointer">Hủy</button>
      <button onclick="tbSaveEdit('${r.id}')"
        style="flex:2;padding:10px;border-radius:8px;border:none;background:#1a1814;color:#fff;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer">💾 Cập Nhật</button>
    </div>
  </div>`;
  ov.style.display = 'flex';
}

function tbSaveEdit(id) {
  const idx = tbData.findIndex(rec=>rec.id===id);
  if (idx<0) return;
  const r = tbData[idx];

  const newCT     = document.getElementById('tb-ei-ct').value.trim();
  const newSL     = parseFloat(document.getElementById('tb-ei-sl').value) || 0;
  const newTT     = document.getElementById('tb-ei-tt').value;
  const newNguoi  = document.getElementById('tb-ei-nguoi').value.trim();
  const newGhichu = document.getElementById('tb-ei-ghichu').value.trim();
  const oldSL     = r.soluong || 0;
  const ngay      = today();

  if (!newCT) { toast('Vui lòng chọn công trình!', 'error'); return; }
  if (newSL <= 0 || newSL > oldSL) {
    toast(`Số lượng không hợp lý (phải từ 1 đến ${oldSL})!`, 'error');
    return;
  }

  const remaining = oldSL - newSL;

  // Soft-delete record gốc (không xóa cứng để sync hoạt động đúng)
  tbData = softDeleteRecord(tbData, id);

  // Thêm/cộng dồn số lượng chuyển đi vào newCT
  const destExist = tbData.find(rec => !rec.deletedAt && rec.ct === newCT && rec.ten === r.ten && rec.tinhtrang === newTT);
  if (destExist) {
    destExist.soluong  = (destExist.soluong || 0) + newSL;
    destExist.updatedAt = Date.now();
    destExist.deviceId  = DEVICE_ID;
    if (newNguoi) destExist.nguoi = newNguoi;
    if (newGhichu) destExist.ghichu = newGhichu;
    destExist.ngay = ngay;
  } else {
    tbData.push({
      id: uuid(), createdAt: Date.now(), updatedAt: Date.now(), deletedAt: null, deviceId: DEVICE_ID,
      ct: newCT, ten: r.ten, soluong: newSL, tinhtrang: newTT,
      nguoi: newNguoi, ghichu: newGhichu, ngay
    });
  }

  // Phần còn lại → KHO TỔNG
  if (remaining > 0) {
    const khoExist = tbData.find(rec => !rec.deletedAt && rec.ct === TB_KHO_TONG && rec.ten === r.ten);
    if (khoExist) {
      khoExist.soluong   = (khoExist.soluong || 0) + remaining;
      khoExist.updatedAt = Date.now();
      khoExist.deviceId  = DEVICE_ID;
      khoExist.ngay = ngay;
    } else {
      tbData.push({
        id: uuid(), createdAt: Date.now(), updatedAt: Date.now(), deletedAt: null, deviceId: DEVICE_ID,
        ct: TB_KHO_TONG, ten: r.ten, soluong: remaining,
        tinhtrang: 'Đang hoạt động', nguoi: '', ghichu: '', ngay
      });
    }
  }

  save('tb_v1', tbData);
  document.getElementById('tb-edit-overlay').remove();
  tbPopulateSels();
  tbRenderList();
  tbRenderThongKeVon();
  renderKhoTong();
  toast('✅ Đã cập nhật thiết bị!', 'success');
}

// ── Xuất CSV ─────────────────────────────────────────────────────
function tbExportCSV() {
  const fCt = document.getElementById('tb-filter-ct')?.value||'';
  const fTt = document.getElementById('tb-filter-tt')?.value||'';
  let data = tbData.filter(r=>{
    if(r.deletedAt) return false;
    if(fCt && r.ct!==fCt) return false;
    if(fTt && r.tinhtrang!==fTt) return false;
    return true;
  });
  const rows = [['Công Trình','Tên Thiết Bị','Số Lượng','Tình Trạng','Người TH','Ghi Chú','Cập Nhật']];
  data.forEach(r=>rows.push([r.ct,r.ten,r.soluong||0,r.tinhtrang||'',r.nguoi||'',r.ghichu||'',r.ngay||'']));
  dlCSV(rows, 'thiet_bi_'+today()+'.csv');
}

// ── Thu hồi thiết bị về KHO TỔNG ─────────────────────────────────
function tbThuHoi(id) {
  const r = tbData.find(rec => rec.id === id);
  if (!r) return;
  if (r.ct === TB_KHO_TONG) { toast('Thiết bị này đã ở KHO TỔNG!', 'error'); return; }
  if (!confirm(`Thu hồi "${r.ten}" (SL: ${r.soluong||0}) về KHO TỔNG?`)) return;

  const khoIdx = tbData.findIndex(rec => !rec.deletedAt && rec.ct === TB_KHO_TONG && rec.ten === r.ten);
  if (khoIdx >= 0) {
    tbData[khoIdx].soluong   = (tbData[khoIdx].soluong || 0) + (r.soluong || 0);
    tbData[khoIdx].updatedAt = Date.now();
    tbData[khoIdx].deviceId  = DEVICE_ID;
    tbData[khoIdx].ngay = today();
  } else {
    tbData.push({
      id: uuid(), createdAt: Date.now(), updatedAt: Date.now(), deletedAt: null, deviceId: DEVICE_ID,
      ct: TB_KHO_TONG,
      ten: r.ten,
      soluong: r.soluong || 0,
      tinhtrang: r.tinhtrang || 'Đang hoạt động',
      nguoi: r.nguoi || '',
      ghichu: `Thu hồi từ ${r.ct}`,
      ngay: today()
    });
  }
  tbData = softDeleteRecord(tbData, id);
  save('tb_v1', tbData);
  tbPopulateSels();
  tbRenderList();
  tbRenderThongKeVon();
  renderKhoTong();
  toast(`✅ Đã thu hồi "${r.ten}" về KHO TỔNG`, 'success');
}

// ── Bảng Kho Tổng Thiết Bị ───────────────────────────────────────
const KHO_PG = 7;
let khoPage = 1;

function renderKhoTong() {
  const tbody = document.getElementById('kho-list-tbody');
  if (!tbody) return;

  const fTen = document.getElementById('kho-filter-ten')?.value || '';
  let filtered = tbData.filter(r => {
    if (r.deletedAt) return false;
    if (r.ct !== TB_KHO_TONG) return false;
    if (fTen && r.ten !== fTen) return false;
    return true;
  });

  filtered.sort((a,b) => (a.ten||'').localeCompare(b.ten,'vi'));

  const start = (khoPage-1)*KHO_PG;
  const paged = filtered.slice(start, start+KHO_PG);

  if (!paged.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="7">Kho tổng trống</td></tr>';
    document.getElementById('kho-pagination').innerHTML = '';
    return;
  }

  tbody.innerHTML = paged.map(r => {
    const ttStyle = TB_STATUS_STYLE[r.tinhtrang] || '';
    return `<tr data-tbid="${r.id}">
      <td class="tb-name-col"><span class="tb-name-cell" style="font-weight:600;font-size:13px">${x(r.ten)}</span></td>
      <td style="text-align:center;font-family:'IBM Plex Mono',monospace;font-weight:700;font-size:14px;color:var(--gold)">${r.soluong||0}</td>
      <td><span class="tb-status" style="${ttStyle}">${x(r.tinhtrang||'')}</span></td>
      <td style="color:var(--ink2);font-size:12px">${x(r.nguoi||'—')}</td>
      <td style="color:var(--ink2);font-size:12px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${x(r.ghichu)}">${x(r.ghichu||'—')}</td>
      <td style="font-size:10px;color:var(--ink3);white-space:nowrap">${r.ngay||''}</td>
      <td style="white-space:nowrap;display:flex;gap:4px;padding:6px 4px">
        <button class="btn btn-outline btn-sm" onclick="tbEditRow('${r.id}')" title="Sửa">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="tbDeleteRow('${r.id}')">✕</button>
      </td>
    </tr>`;
  }).join('');

  const tp = Math.ceil(filtered.length/KHO_PG);
  let pag = `<span>${filtered.length} thiết bị</span>`;
  if (tp>1) {
    pag += '<div class="page-btns">';
    for(let p=1;p<=Math.min(tp,10);p++) pag+=`<button class="page-btn ${p===khoPage?'active':''}" onclick="khoGoTo(${p})">${p}</button>`;
    pag += '</div>';
  }
  document.getElementById('kho-pagination').innerHTML = pag;
}

function khoGoTo(p) { khoPage=p; renderKhoTong(); }

// ── Bảng Thống Kê Theo Tên Thiết Bị ─────────────────────────────
const TK_PG = 7;
let tkPage = 1;

function tbRenderThongKeVon() {
  const tbody = document.getElementById('tb-vonke-tbody');
  if (!tbody) return;

  const fTen = document.getElementById('tk-filter-ten')?.value || '';
  // Chỉ thống kê record có tên thuộc cats.tbTen (lọc tên người)
  const validTbNames = new Set((cats && cats.tbTen ? cats.tbTen : []).map(n => n.toLowerCase()));
  const map = {};
  tbData.forEach(r => {
    if (r.deletedAt) return;
    if (!r.ten) return;
    if (!validTbNames.has(r.ten.toLowerCase())) return;  // bỏ qua nếu không phải tên thiết bị
    const key = r.ten;
    if (!map[key]) map[key] = { ten: key, total: 0, kho: 0, cts: {} };
    const sl = r.soluong || 0;
    map[key].total += sl;
    if (r.ct === TB_KHO_TONG) {
      map[key].kho += sl;
    } else if (r.ct) {
      map[key].cts[r.ct] = (map[key].cts[r.ct] || 0) + sl;
    }
  });

  let items = Object.values(map).sort((a, b) => a.ten.localeCompare(b.ten, 'vi'));
  if (fTen) items = items.filter(item => item.ten === fTen);

  const tp = Math.ceil(items.length/TK_PG);
  const start = (tkPage-1)*TK_PG;
  const paged = items.slice(start, start+TK_PG);

  if (!paged.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="4">Chưa có dữ liệu thiết bị</td></tr>';
    const pgEl = document.getElementById('tk-pagination');
    if (pgEl) pgEl.innerHTML = '';
    return;
  }

  tbody.innerHTML = paged.map(item => {
    const ctEntries = Object.entries(item.cts);
    const maxShow = 2;
    const shown = ctEntries.slice(0, maxShow);
    const more = ctEntries.length - maxShow;
    const tags = shown
      .map(([ct, sl]) =>
        `<span style="display:flex;background:#e8f0fe;color:#1967d2;padding:2px 7px;border-radius:10px;font-size:10px;align-items:center;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">` +
        `${x(ct)}: ${sl}` +
        `</span>`)
      .join('');
    const moreTag = more > 0
      ? `<span style="background:#eeece7;color:var(--ink2);padding:2px 6px;border-radius:10px;font-size:10px;white-space:nowrap;font-weight:700">+${more}</span>`
      : '';
    return `<tr>
      <td class="tb-name-col"><span class="tb-name-cell" style="font-weight:600;font-size:13px">${x(item.ten)}</span></td>
      <td style="text-align:center;font-family:'IBM Plex Mono',monospace;font-weight:700;font-size:15px;color:var(--ink)">${item.total}</td>
      <td style="text-align:center;font-family:'IBM Plex Mono',monospace;font-weight:700;font-size:14px;color:#1a7a45">${item.kho || 0}</td>
      <td><div style="display:flex;flex-direction:column;gap:3px;align-items:flex-start">${tags ? tags + moreTag : '<span style="color:var(--ink3);font-size:12px">—</span>'}</div></td>
    </tr>`;
  }).join('');

  const pgEl = document.getElementById('tk-pagination');
  if (pgEl) {
    let pag = `<span>${items.length} loại</span>`;
    if (tp>1) {
      pag += '<div class="page-btns">';
      for(let p=1;p<=Math.min(tp,10);p++) pag+=`<button class="page-btn ${p===tkPage?'active':''}" onclick="tkGoTo(${p})">${p}</button>`;
      pag += '</div>';
    }
    pgEl.innerHTML = pag;
  }
}

function tkGoTo(p) { tkPage=p; tbRenderThongKeVon(); }

// ── Init TB khi load trang ────────────────────────────────────────
// (tbData đã load ở trên, tbBuildRows gọi khi goPage)
