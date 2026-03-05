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

// ── Populate selects ──────────────────────────────────────────────
function tbPopulateSels() {
  const allCts = [
    TB_KHO_TONG,
    ...[...new Set([...cats.congTrinh, ...tbData.map(r=>r.ct)]
      .filter(v => v && v !== TB_KHO_TONG))].sort()
  ];
  // Lọc theo năm: ưu tiên year field, fallback check dữ liệu phát sinh
  const filtered = allCts.filter(ct => _ctInActiveYear(ct));

  const sel = document.getElementById('tb-ct-sel');
  const cur = sel.value;
  // Select nhập mới: lọc theo năm, giữ giá trị hiện tại nếu có
  const ctForInput = allCts.filter(ct => ct === TB_KHO_TONG || _ctInActiveYear(ct) || ct === cur);
  sel.innerHTML = '<option value="">-- Chọn công trình --</option>' +
    ctForInput.map(v=>`<option value="${x(v)}" ${v===cur?'selected':''}>${x(v)}</option>`).join('');

  // Filter danh sách: chỉ CT có liên quan năm đang chọn
  const fSel = document.getElementById('tb-filter-ct');
  const fCur = fSel.value;
  fSel.innerHTML = '<option value="">Tất cả công trình</option>' +
    filtered.map(v=>`<option value="${x(v)}" ${v===fCur?'selected':''}>${x(v)}</option>`).join('');
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

  const tenDl = `<datalist id="tb-ten-dl">${TB_TEN_MAY.map(n=>`<option value="${x(n)}">`).join('')}</datalist>`;

  tr.innerHTML = `
    <td class="row-num">${idx}</td>
    <td style="padding:0">
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

  // Đảm bảo datalist tồn tại
  if (!document.getElementById('tb-ten-dl')) {
    document.body.insertAdjacentHTML('beforeend', tenDl);
  }
  // Datalist nguoi
  if (!document.getElementById('tb-nguoi-dl')) {
    const dl = document.createElement('datalist');
    dl.id = 'tb-nguoi-dl';
    dl.innerHTML = cats.nguoiTH.map(n=>`<option value="${x(n)}">`).join('');
    document.body.appendChild(dl);
  }
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
    const ten    = tr.querySelector('[data-tb="ten"]')?.value?.trim() || '';
    const sl     = parseFloat(tr.querySelector('[data-tb="soluong"]')?.value) || 0;
    const tt     = tr.querySelector('[data-tb="tinhtrang"]')?.value || 'Đang hoạt động';
    const nguoi  = tr.querySelector('[data-tb="nguoi"]')?.value?.trim() || '';
    const ghichu = tr.querySelector('[data-tb="ghichu"]')?.value?.trim() || '';
    if (ten) rows.push({ id: Date.now()+'_'+Math.random().toString(36).slice(2), ct, ten, soluong:sl, tinhtrang:tt, nguoi, ghichu, ngay });
  });

  if (!rows.length) {
    toast('Không có dữ liệu để lưu!', 'error');
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Lưu thiết bị'; }
    return;
  }

  tbData = [...tbData, ...rows];
  save('tb_v1', tbData);
  tbPopulateSels();
  tbRenderList();
  tbRenderThongKeVon();
  tbBuildRows();
  toast(`✅ Đã lưu ${rows.length} thiết bị vào ${ct}`, 'success');
  setTimeout(() => {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Lưu thiết bị'; }
  }, 1500);
}

// ── Render bảng danh sách ─────────────────────────────────────────
const TB_PG = 50;
let tbPage = 1;

function tbRenderList() {
  const fCt = document.getElementById('tb-filter-ct')?.value || '';
  const fTt = document.getElementById('tb-filter-tt')?.value || '';
  const fQ  = (document.getElementById('tb-search')?.value || '').toLowerCase().trim();
  let filtered = tbData.filter(r => {
    if (fCt && r.ct !== fCt) return false;
    if (fTt && r.tinhtrang !== fTt) return false;
    if (fQ && !(r.ten||'').toLowerCase().includes(fQ) && !(r.nguoi||'').toLowerCase().includes(fQ) && !(r.ghichu||'').toLowerCase().includes(fQ)) return false;
    // Lọc mềm theo năm: TB của CT có phát sinh năm đang chọn, HOẶC đang hoạt động
    if (activeYear !== 0) {
      const ctActive = _entityInYear(r.ct, 'ct');
      const isRunning = r.tinhtrang === 'Đang hoạt động';
      if (!ctActive && !isRunning) return false;
    }
    return true;
  });

  // Sort: CT → tên
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
      <td style="font-size:12px;font-weight:600;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${x(r.ct)}">${x(r.ct)}</td>
      <td style="font-weight:600;font-size:13px">${x(r.ten)}</td>
      <td style="text-align:center;font-family:'IBM Plex Mono',monospace;font-weight:700;font-size:14px;color:var(--gold)">${r.soluong||0}</td>
      <td>
        <select onchange="tbUpdateField('${r.id}','tinhtrang',this.value)"
          style="padding:3px 8px;border-radius:5px;border:1px solid var(--line2);font-size:11px;font-weight:600;cursor:pointer;${ttStyle}">
          ${ttOpts}
        </select>
      </td>
      <td style="color:var(--ink2);font-size:12px">${x(r.nguoi||'—')}</td>
      <td style="color:var(--ink2);font-size:12px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${x(r.ghichu)}">${x(r.ghichu||'—')}</td>
      <td style="font-size:10px;color:var(--ink3);white-space:nowrap">${r.ngay||''}</td>
      <td style="white-space:nowrap;display:flex;gap:4px;padding:6px 4px">
        <button class="btn btn-outline btn-sm" onclick="tbEditRow('${r.id}')" title="Sửa">✏️</button>
        ${r.ct !== TB_KHO_TONG
          ? `<button class="btn btn-sm" onclick="tbThuHoi('${r.id}')" title="Thu hồi về KHO TỔNG"
               style="background:#2563eb;color:#fff;border:none;font-size:11px;padding:3px 8px;border-radius:5px;cursor:pointer;font-family:inherit">↩ Thu Hồi</button>`
          : ''}
        <button class="btn btn-danger btn-sm" onclick="tbDeleteRow('${r.id}')">✕</button>
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
  save('tb_v1', tbData);
  // Re-style select
  const tr = document.querySelector(`tr[data-tbid="${id}"]`);
  if (tr) {
    const sel = tr.querySelector('select');
    if (sel) {
      sel.style.cssText = `padding:3px 8px;border-radius:5px;border:1px solid var(--line2);font-size:11px;font-weight:600;cursor:pointer;${TB_STATUS_STYLE[val]||''}`;
    }
  }
  toast('✅ Đã cập nhật tình trạng', 'success');
}

// ── Xóa thiết bị ─────────────────────────────────────────────────
function tbDeleteRow(id) {
  if (!confirm('Xóa thiết bị này?')) return;
  tbData = tbData.filter(r=>r.id!==id);
  save('tb_v1', tbData);
  tbRenderList();
  tbRenderThongKeVon();
  toast('Đã xóa thiết bị');
}

// ── Sửa thiết bị (modal) ─────────────────────────────────────────
function tbEditRow(id) {
  const r = tbData.find(r=>r.id===id);
  if (!r) return;
  let ov = document.getElementById('tb-edit-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'tb-edit-overlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px';
    ov.onclick = function(e){ if(e.target===this) this.remove(); };
    document.body.appendChild(ov);
  }
  const ctOpts = cats.congTrinh.filter(v=>_ctInActiveYear(v)||v===r.ct).map(v=>`<option value="${x(v)}" ${v===r.ct?'selected':''}>${x(v)}</option>`).join('');
  const ttOpts = TB_TINH_TRANG.map(v=>`<option value="${v}" ${r.tinhtrang===v?'selected':''}>${v}</option>`).join('');
  ov.innerHTML = `
  <div style="background:#fff;border-radius:14px;padding:24px;width:min(480px,96vw);box-shadow:0 8px 32px rgba(0,0,0,.2);font-family:'IBM Plex Sans',sans-serif" onclick="event.stopPropagation()">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h3 style="font-size:16px;font-weight:700">✏️ Sửa Thiết Bị</h3>
      <button onclick="document.getElementById('tb-edit-overlay').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#888">✕</button>
    </div>
    <div style="display:grid;gap:10px">
      <div><label style="font-size:12px;font-weight:600;color:#555;display:block;margin-bottom:3px">Công Trình</label>
        <select id="tb-ei-ct" style="width:100%;padding:8px 10px;border:1.5px solid #ddd;border-radius:7px;font-family:inherit;font-size:13px;outline:none">
          <option value="">-- Chọn --</option>${ctOpts}</select></div>
      <div><label style="font-size:12px;font-weight:600;color:#555;display:block;margin-bottom:3px">Tên Thiết Bị</label>
        <input id="tb-ei-ten" type="text" value="${x(r.ten)}" list="tb-ten-dl"
          style="width:100%;padding:8px 10px;border:1.5px solid #ddd;border-radius:7px;font-family:inherit;font-size:13px;outline:none"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><label style="font-size:12px;font-weight:600;color:#555;display:block;margin-bottom:3px">Số Lượng</label>
          <input id="tb-ei-sl" type="number" class="np-num-input" min="0" value="${r.soluong||0}" inputmode="decimal"
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
  const idx = tbData.findIndex(r=>r.id===id);
  if (idx<0) return;
  tbData[idx] = { ...tbData[idx],
    ct:        document.getElementById('tb-ei-ct').value,
    ten:       document.getElementById('tb-ei-ten').value.trim(),
    soluong:   parseFloat(document.getElementById('tb-ei-sl').value)||0,
    tinhtrang: document.getElementById('tb-ei-tt').value,
    nguoi:     document.getElementById('tb-ei-nguoi').value.trim(),
    ghichu:    document.getElementById('tb-ei-ghichu').value.trim()
  };
  save('tb_v1', tbData);
  document.getElementById('tb-edit-overlay').remove();
  tbPopulateSels();
  tbRenderList();
  tbRenderThongKeVon();
  toast('✅ Đã cập nhật thiết bị!', 'success');
}

// ── Xuất CSV ─────────────────────────────────────────────────────
function tbExportCSV() {
  const fCt = document.getElementById('tb-filter-ct')?.value||'';
  const fTt = document.getElementById('tb-filter-tt')?.value||'';
  let data = tbData.filter(r=>{
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
  const r = tbData.find(r => r.id === id);
  if (!r) return;
  if (r.ct === TB_KHO_TONG) { toast('Thiết bị này đã ở KHO TỔNG!', 'error'); return; }
  if (!confirm(`Thu hồi "${r.ten}" (SL: ${r.soluong||0}) về KHO TỔNG?`)) return;

  // Tìm record KHO TỔNG cùng tên → cộng dồn, hoặc tạo mới
  const khoIdx = tbData.findIndex(x => x.ct === TB_KHO_TONG && x.ten === r.ten);
  if (khoIdx >= 0) {
    tbData[khoIdx].soluong = (tbData[khoIdx].soluong || 0) + (r.soluong || 0);
    tbData[khoIdx].ngay = today();
  } else {
    tbData.push({
      id: Date.now() + '_' + Math.random().toString(36).slice(2),
      ct: TB_KHO_TONG,
      ten: r.ten,
      soluong: r.soluong || 0,
      tinhtrang: r.tinhtrang || 'Đang hoạt động',
      nguoi: r.nguoi || '',
      ghichu: `Thu hồi từ ${r.ct}`,
      ngay: today()
    });
  }
  // Xóa record cũ (Tổng Sở Hữu giữ nguyên — chỉ dịch chuyển SL)
  tbData = tbData.filter(x => x.id !== id);
  save('tb_v1', tbData);
  tbPopulateSels();
  tbRenderList();
  tbRenderThongKeVon();
  toast(`✅ Đã thu hồi "${r.ten}" về KHO TỔNG`, 'success');
}

// ── Bảng Thống Kê Theo Tên Thiết Bị ─────────────────────────────
function tbRenderThongKeVon() {
  const tbody = document.getElementById('tb-vonke-tbody');
  if (!tbody) return;

  // Nhóm theo tên thiết bị
  const map = {};
  tbData.forEach(r => {
    if (!r.ten) return;
    if (!map[r.ten]) map[r.ten] = { ten: r.ten, total: 0, kho: 0, cts: {} };
    const sl = r.soluong || 0;
    map[r.ten].total += sl;
    if (r.ct === TB_KHO_TONG) {
      map[r.ten].kho += sl;
    } else if (r.ct) {
      map[r.ten].cts[r.ct] = (map[r.ten].cts[r.ct] || 0) + sl;
    }
  });

  const items = Object.values(map).sort((a, b) => a.ten.localeCompare(b.ten, 'vi'));

  if (!items.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="4">Chưa có dữ liệu thiết bị</td></tr>';
    return;
  }

  tbody.innerHTML = items.map(item => {
    const tags = Object.entries(item.cts)
      .map(([ct, sl]) =>
        `<span style="background:#e8f0fe;color:#1967d2;padding:1px 7px;border-radius:10px;font-size:10px;margin:1px;display:inline-block">${x(ct)}: ${sl}</span>`)
      .join('');
    return `<tr>
      <td style="font-weight:600;font-size:13px">${x(item.ten)}</td>
      <td style="text-align:center;font-family:'IBM Plex Mono',monospace;font-weight:700;font-size:15px;color:var(--ink)">${item.total}</td>
      <td style="text-align:center;font-family:'IBM Plex Mono',monospace;font-weight:700;font-size:14px;color:#1a7a45">${item.kho || 0}</td>
      <td style="line-height:2">${tags || '<span style="color:var(--ink3);font-size:12px">—</span>'}</td>
    </tr>`;
  }).join('');
}

// ── Init TB khi load trang ────────────────────────────────────────
// (tbData đã load ở trên, tbBuildRows gọi khi goPage)

