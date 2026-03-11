// hoadon.js — Hoa Don Chi Phi (Invoice CRUD)
// Load order: 3

// ══════════════════════════════
//  ENTRY TABLE
// ══════════════════════════════
function initTable(n=10) {
  document.getElementById('entry-tbody').innerHTML='';
  for(let i=0;i<n;i++) addRow();
  calcSummary();
}

function addRows(n) { for(let i=0;i<n;i++) addRow(); }

function addRow(d={}) {
  const tbody = document.getElementById('entry-tbody');
  // PHẦN 6: copy loai/CT từ dòng trên nếu không có dữ liệu truyền vào
  if(!d.loai && !d.congtrinh) {
    const lastRow = tbody.querySelector('tr:last-child');
    if(lastRow) {
      const prevLoai = lastRow.querySelector('[data-f="loai"]')?.value || '';
      const prevCt   = lastRow.querySelector('[data-f="ct"]')?.value   || '';
      if(prevLoai || prevCt) d = { ...d, loai: prevLoai, congtrinh: prevCt };
    }
  }
  const num = tbody.children.length + 1;
  const ctDef = d.congtrinh || '';

  const tr = document.createElement('tr');

  const loaiOpts = `<option value="">-- Chọn --</option>` + cats.loaiChiPhi.map(v=>`<option value="${x(v)}" ${v===(d.loai||'')?'selected':''}>${x(v)}</option>`).join('');
  const ctOpts = `<option value="">-- Chọn --</option>` + cats.congTrinh.filter(v => _ctInActiveYear(v) || v === ctDef).map(v=>`<option value="${x(v)}" ${v===ctDef?'selected':''}>${x(v)}</option>`).join('');
  const dlNguoi = 'dlN' + num + Date.now();
  const dlNcc   = 'dlC' + num + Date.now();

  const slVal = d.sl||'';
  const thTien = slVal && d.tien ? numFmt((d.sl||1)*(d.tien||0)) : (d.tien?numFmt(d.tien):'');

  tr.innerHTML = `
    <td class="row-num">${num}</td>
    <td><select class="cell-input" data-f="loai">${loaiOpts}</select></td>
    <td><select class="cell-input" data-f="ct">${ctOpts}</select></td>
    <td><input class="cell-input right tien-input" data-f="tien" data-raw="${d.tien||''}" placeholder="0" value="${d.tien?numFmt(d.tien):''}" inputmode="decimal"></td>
    <td style="padding:0"><input type="number" class="cell-input" data-f="sl" min="0" step="0.01"
      value="${x(slVal)}" placeholder="1"
      style="text-align:center;width:100%;border:none;background:transparent;padding:7px 6px;font-family:'IBM Plex Mono',monospace;font-size:13px;outline:none;-moz-appearance:textfield"
      inputmode="decimal"></td>
    <td style="padding:0;text-align:right">
      <span data-f="thtien" style="display:block;padding:7px 8px;font-family:'IBM Plex Mono',monospace;font-weight:700;font-size:13px;color:var(--green)">${thTien}</span>
    </td>
    <td><input class="cell-input" data-f="nd" value="${x(d.nd||'')}" placeholder="Nội dung..."></td>
    <td>
      <input class="cell-input" data-f="nguoi" list="${dlNguoi}" value="${x(d.nguoi||'')}" placeholder="Nhập hoặc chọn...">
      <datalist id="${dlNguoi}">${cats.nguoiTH.map(v=>`<option value="${x(v)}">`).join('')}</datalist>
    </td>
    <td>
      <input class="cell-input" data-f="ncc" list="${dlNcc}" value="${x(d.ncc||'')}" placeholder="Nhập hoặc chọn...">
      <datalist id="${dlNcc}">${cats.nhaCungCap.map(v=>`<option value="${x(v)}">`).join('')}</datalist>
    </td>
    <td><button class="del-btn" onclick="delRow(this)">✕</button></td>
  `;

  function updateThTien() {
    const tienRaw = parseInt(tr.querySelector('[data-f="tien"]').dataset.raw||'0')||0;
    const slRaw   = parseFloat(tr.querySelector('[data-f="sl"]').value)||1;
    const th = tienRaw * slRaw;
    const thEl = tr.querySelector('[data-f="thtien"]');
    if(thEl) thEl.textContent = th ? numFmt(th) : '';
    tr.querySelector('[data-f="thtien"]').dataset.raw = th;
  }

  // Thousand-separator logic for tien input
  const tienInput = tr.querySelector('[data-f="tien"]');
  tienInput.addEventListener('input', function() {
    const raw = this.value.replace(/[.,]/g,'');
    this.dataset.raw = raw;
    if(raw) this.value = numFmt(parseInt(raw,10)||0);
    updateThTien(); calcSummary();
  });
  tienInput.addEventListener('focus', function() { this.value = this.dataset.raw || ''; });
  tienInput.addEventListener('blur', function() {
    const raw = parseInt(this.dataset.raw||'0',10)||0;
    this.value = raw ? numFmt(raw) : '';
  });
  tr.querySelector('[data-f="sl"]').addEventListener('input', function() {
    updateThTien(); calcSummary();
  });

  tr.querySelectorAll('input,select').forEach(el => {
    if(el.dataset.f!=='tien' && el.dataset.f!=='sl') {
      el.addEventListener('input', calcSummary);
      el.addEventListener('change', calcSummary);
    }
  });

  // PHẦN 5: Enter key → nhảy xuống dòng dưới (chỉ áp dụng cho input, không phải select)
  const entryInputs = [...tr.querySelectorAll('input')];
  entryInputs.forEach(inp => {
    inp.addEventListener('keydown', function(e) {
      if(e.key !== 'Enter') return;
      e.preventDefault();
      const allRows = [...document.querySelectorAll('#entry-tbody tr')];
      const curIdx  = allRows.indexOf(tr);
      const colIdx  = entryInputs.indexOf(this);
      let targetRow;
      if(curIdx < allRows.length - 1) {
        targetRow = allRows[curIdx + 1];
      } else {
        addRows(1);
        targetRow = [...document.querySelectorAll('#entry-tbody tr')][curIdx + 1];
      }
      if(targetRow) {
        const targets = [...targetRow.querySelectorAll('input')];
        (targets[colIdx] || targets[0])?.focus();
      }
    });
  });

  tbody.appendChild(tr);
  // Trigger initial thTien
  const tRaw = parseInt(tienInput.dataset.raw||'0')||0;
  const sRaw = parseFloat(tr.querySelector('[data-f="sl"]').value)||1;
  const th0 = tRaw*sRaw;
  const thEl0 = tr.querySelector('[data-f="thtien"]');
  if(thEl0){ thEl0.textContent = th0?numFmt(th0):''; thEl0.dataset.raw=th0; }
}

function delRow(btn) { btn.closest('tr').remove(); renumber(); calcSummary(); }

function renumber() {
  document.querySelectorAll('#entry-tbody tr').forEach((tr,i) => {
    tr.querySelector('.row-num').textContent = i+1;
  });
}

function calcSummary() {
  let cnt=0, total=0;
  document.querySelectorAll('#entry-tbody tr').forEach(tr => {
    const loai = tr.querySelector('[data-f="loai"]')?.value||'';
    const ct   = tr.querySelector('[data-f="ct"]')?.value||'';
    const tienRaw = parseInt(tr.querySelector('[data-f="tien"]')?.dataset.raw||'0',10)||0;
    const sl   = parseFloat(tr.querySelector('[data-f="sl"]')?.value)||1;
    const thTien = tienRaw * sl;
    if(loai||ct||tienRaw>0) { cnt++; total += thTien; }
  });
  document.getElementById('row-count').textContent = cnt;
  document.getElementById('entry-total').textContent = fmtM(total);
}

function clearTable() {
  if(!confirm('Xóa toàn bộ bảng nhập hiện tại?')) return;
  initTable(5);
}

function saveAllRows(skipDupCheck) {
  const date = document.getElementById('entry-date').value;
  if(!date) { toast('Vui lòng chọn ngày!','error'); return; }

  // Thu thập tất cả dòng hợp lệ
  const rows = [];
  let errRow = 0;
  document.querySelectorAll('#entry-tbody tr').forEach(tr => {
    const loai = (tr.querySelector('[data-f="loai"]')?.value||'').trim();
    const ct   = (tr.querySelector('[data-f="ct"]')?.value||'').trim();
    const tien = parseInt(tr.querySelector('[data-f="tien"]')?.dataset.raw||'0',10)||0;
    if(!loai&&!ct&&!tien) return;
    if(!ct||!loai) { errRow++; tr.style.background='#fdecea'; return; }
    tr.style.background='';
    rows.push({
      tr,
      editId: tr.dataset.editId || null,
      payload: {
        ngay: date,
        congtrinh: ct, loai,
        nguoi: (tr.querySelector('[data-f="nguoi"]')?.value||'').trim(),
        ncc:   (tr.querySelector('[data-f="ncc"]')?.value||'').trim(),
        nd:    (tr.querySelector('[data-f="nd"]')?.value||'').trim(),
        tien,
        sl:    parseFloat(tr.querySelector('[data-f="sl"]')?.value)||1,
        get thanhtien() { return Math.round(this.tien * this.sl); }
      }
    });
  });

  if(errRow>0) { toast(`${errRow} dòng thiếu Công Trình hoặc Loại CP!`,'error'); return; }
  if(!rows.length) { toast('Không có dòng hợp lệ!','error'); return; }

  // Kiểm tra trùng — chỉ cho dòng MỚI (không phải edit)
  if(!skipDupCheck) {
    const newRows = rows.filter(r => !r.editId);
    const dupRows = [];
    newRows.forEach(r => {
      // Chỉ so sánh với HĐ nhập tay (không ccKey) trong cùng ngày+CT
      const candidates = invoices.filter(i =>
        !i.ccKey &&
        i.ngay === r.payload.ngay &&
        i.congtrinh === r.payload.congtrinh &&
        (i.thanhtien||i.tien||0) === Math.round(r.payload.tien * r.payload.sl)
      );
      if(!candidates.length) return;

      // Fuzzy match nội dung ≥ 70%
      const nd = r.payload.nd.toLowerCase().trim();
      candidates.forEach(inv => {
        const sim = _strSimilarity(nd, (inv.nd||'').toLowerCase().trim());
        if(sim >= 0.7 || (nd === '' && (inv.nd||'') === '')) {
          dupRows.push({
            newRow: r,
            existing: inv,
            similarity: sim,
            isExact: sim >= 0.99
          });
        }
      });
    });

    if(dupRows.length > 0) {
      _showDupModal(dupRows, rows);
      return; // Dừng lại — chờ user quyết định
    }
  }

  // ── Thực sự lưu ────────────────────────────────────────────
  _doSaveRows(rows);
}

// ══════════════════════════════
// DUPLICATE CHECK
// ══════════════════════════════

// ── Fuzzy string similarity (Dice coefficient) ───────────────
// Trả về 0.0 → 1.0. Không cần thư viện ngoài.

// ── Hiển thị modal cảnh báo trùng ────────────────────────────
function _showDupModal(dupRows, allRows) {
  const overlay = document.getElementById('dup-modal-overlay');
  const body    = document.getElementById('dup-modal-body');
  const sub     = document.getElementById('dup-modal-subtitle');

  // Lưu allRows để forceSave dùng lại
  overlay._allRows = allRows;

  sub.textContent = `Tìm thấy ${dupRows.length} hóa đơn có thể bị trùng`;

  const numFmtLocal = n => n ? n.toLocaleString('vi-VN') + 'đ' : '0đ';
  body.innerHTML = dupRows.map(d => {
    const pct     = Math.round(d.similarity * 100);
    const badge   = d.isExact
      ? '<span class="dup-badge dup-badge-exact">Trùng hoàn toàn</span>'
      : `<span class="dup-badge dup-badge-fuzzy">Giống ${pct}%</span>`;
    const existTime = d.existing._ts
      ? new Date(d.existing._ts).toLocaleString('vi-VN')
      : d.existing.ngay || '';
    return `<div class="dup-item">
      <div style="font-size:11px;font-weight:700;color:#f57f17;margin-bottom:6px">
        HĐ MỚI ${badge}
      </div>
      <div class="dup-item-row">
        <span class="dup-item-label">Ngày</span>
        <span class="dup-item-val">${d.newRow.payload.ngay}</span>
      </div>
      <div class="dup-item-row">
        <span class="dup-item-label">Công trình</span>
        <span class="dup-item-val">${d.newRow.payload.congtrinh}</span>
      </div>
      <div class="dup-item-row">
        <span class="dup-item-label">Số tiền</span>
        <span class="dup-item-val" style="color:var(--red);font-family:'IBM Plex Mono',monospace">
          ${numFmtLocal(Math.round(d.newRow.payload.tien * d.newRow.payload.sl))}
        </span>
      </div>
      <div class="dup-item-row">
        <span class="dup-item-label">Nội dung</span>
        <span class="dup-item-val">${d.newRow.payload.nd||'(trống)'}</span>
      </div>
      <div style="margin-top:8px;padding-top:8px;border-top:1px dashed #ffe082;font-size:11px;color:#888">
        ↑ Trùng với HĐ đã lưu lúc ${existTime}:
        <span style="color:#555;font-weight:600">${d.existing.nd||'(trống)'}</span>
      </div>
    </div>`;
  }).join('');

  overlay.classList.add('open');
}

function closeDupModal() {
  document.getElementById('dup-modal-overlay').classList.remove('open');
}

function forceSaveAll() {
  closeDupModal();
  const overlay = document.getElementById('dup-modal-overlay');
  const allRows = overlay._allRows;
  if(allRows) _doSaveRows(allRows);
}

// ── Hàm lưu thực sự (dùng chung cho cả normal và force) ──────
function _doSaveRows(rows) {
  let saved = 0, updated = 0;
  rows.forEach(({tr, editId, payload}) => {
    const p = {
      ngay: payload.ngay, congtrinh: payload.congtrinh, loai: payload.loai,
      nguoi: payload.nguoi, ncc: payload.ncc, nd: payload.nd,
      tien: payload.tien,
      sl: payload.sl !== 1 ? payload.sl : undefined,
      thanhtien: Math.round(payload.tien * payload.sl)
    };
    if(editId) {
      const idx = invoices.findIndex(i => String(i.id) === String(editId));
      if(idx >= 0) { invoices[idx] = {...invoices[idx], ...p, updatedAt: Date.now(), deviceId: DEVICE_ID}; updated++; }
    } else {
      invoices.unshift({id: uuid(), createdAt: Date.now(), updatedAt: Date.now(), deletedAt: null, deviceId: DEVICE_ID, ...p});
      saved++;
    }
    tr.style.background = '#f0fff4';
  });

  save('inv_v3', invoices);
  buildYearSelect(); updateTop();

  if(updated > 0 && saved === 0) toast(`✅ Đã cập nhật ${updated} hóa đơn!`, 'success');
  else if(saved > 0 && updated === 0) toast(`✅ Đã lưu ${saved} hóa đơn!`, 'success');
  else toast(`✅ Đã lưu ${saved} mới, cập nhật ${updated} hóa đơn!`, 'success');

  // Tự động refresh sub-tab "HĐ/CP nhập trong ngày"
  renderTodayInvoices();
  // Tự động refresh sub-tab "Tất cả CP/HĐ" (luôn sync sau mỗi lần lưu)
  buildFilters(); filterAndRender();
}

// ══════════════════════════════
// INVOICE DETAIL
// ══════════════════════════════

function goInnerSub(btn, id) {
  document.querySelectorAll('#sub-nhap-hd .inner-sub-page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#sub-nhap-hd .inner-sub-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  btn.classList.add('active');
  if(id === 'inr-hd-chitiet') {
    _initDetailFormSelects();
    const tbody = document.getElementById('detail-tbody');
    if(tbody && tbody.children.length === 0) {
      document.getElementById('detail-ngay').value = document.getElementById('entry-date')?.value || today();
      for(let i=0; i<5; i++) addDetailRow();
    }
  }
  renderTodayInvoices(); // cập nhật bảng theo ngày của subtab vừa chuyển
}

function _initDetailFormSelects() {
  const loaiSel = document.getElementById('detail-loai');
  if(!loaiSel) return;
  loaiSel.innerHTML = '<option value="">-- Chọn Loại --</option>' +
    cats.loaiChiPhi.map(v => `<option value="${x(v)}">${x(v)}</option>`).join('');
  const ctSel = document.getElementById('detail-ct');
  ctSel.innerHTML = '<option value="">-- Chọn Công Trình --</option>' +
    cats.congTrinh.filter(v => _ctInActiveYear(v)).map(v => `<option value="${x(v)}">${x(v)}</option>`).join('');

  // PHẦN 3: Format #detail-footer-ck (số tiền → hàng nghìn, % → giữ nguyên)
  const footerCk = document.getElementById('detail-footer-ck');
  if(footerCk && !footerCk.dataset.fmtInit) {
    footerCk.dataset.fmtInit = '1';
    footerCk.addEventListener('focus', function() {
      const v = this.value.trim();
      if(v && !v.endsWith('%')) { const n = parseMoney(v); if(n) this.value = String(n); }
    });
    footerCk.addEventListener('blur', function() {
      const v = this.value.trim();
      if(v && !v.endsWith('%')) { const n = parseMoney(v); this.value = n ? numFmt(n) : v; }
    });
  }
}

function renderDetailRowHTML(d, num) {
  // Format CK for display: nếu là số (không có %) thì hiển thị hàng nghìn
  const ckRaw = d.ck || '';
  const ckFmt = (ckRaw && !ckRaw.endsWith('%'))
    ? (() => { const n = parseMoney(ckRaw); return n ? numFmt(n) : ckRaw; })()
    : ckRaw;
  return `
    <td class="row-num">${num}</td>
    <td><input class="cell-input" data-f="ten" value="${x(d.ten||'')}" placeholder="Tên hàng hóa, vật tư..."></td>
    <td style="padding:0"><input class="cell-input center" data-f="dv" value="${x(d.dv||'')}" placeholder="cái"
      style="width:100%;text-align:center;padding:7px 4px"></td>
    <td style="padding:0"><input data-f="sl" type="number" step="0.01" min="0"
      value="${d.sl||''}" placeholder="1"
      style="width:100%;text-align:center;border:none;background:transparent;padding:7px 4px;font-family:'IBM Plex Mono',monospace;font-size:13px;outline:none;-moz-appearance:textfield"
      inputmode="decimal"></td>
    <td><input class="cell-input right" data-f="dongia" data-raw="${d.dongia||''}"
      value="${d.dongia?numFmt(d.dongia):''}" placeholder="0" inputmode="decimal"></td>
    <td><input class="cell-input" data-f="ck" value="${x(ckFmt)}" placeholder="vd: 5% hoặc 50000"></td>
    <td class="tt-cell" data-f="thtien"></td>
    <td><button class="del-btn" onclick="delDetailRow(this)">✕</button></td>
  `;
}

function addDetailRow(d={}) {
  const tbody = document.getElementById('detail-tbody');
  const num = tbody.children.length + 1;
  const tr = document.createElement('tr');
  tr.innerHTML = renderDetailRowHTML(d, num);

  const dongiaInp = tr.querySelector('[data-f="dongia"]');
  dongiaInp.addEventListener('focus', function() { this.value = this.dataset.raw || ''; });
  dongiaInp.addEventListener('blur', function() {
    const raw = parseInt(this.dataset.raw||'0',10)||0;
    this.value = raw ? numFmt(raw) : '';
  });
  dongiaInp.addEventListener('input', function() {
    const raw = this.value.replace(/[.,\s]/g,'');
    this.dataset.raw = raw;
    if(raw) this.value = numFmt(parseInt(raw,10)||0);
    calcDetailRow(tr); calcDetailTotals();
  });
  tr.querySelector('[data-f="sl"]').addEventListener('input', function() {
    calcDetailRow(tr); calcDetailTotals();
  });
  const ckInp = tr.querySelector('[data-f="ck"]');
  ckInp.addEventListener('focus', function() {
    const v = this.value.trim();
    if (v && !v.endsWith('%')) {
      const n = parseMoney(v);
      if (n) this.value = String(n);
    }
  });
  ckInp.addEventListener('blur', function() {
    const v = this.value.trim();
    if (v && !v.endsWith('%')) {
      const n = parseMoney(v);
      this.value = n ? numFmt(n) : v;
    }
  });
  ckInp.addEventListener('input', function() {
    calcDetailRow(tr); calcDetailTotals();
  });
  tr.querySelector('[data-f="ten"]').addEventListener('input', generateDetailNd);

  // Enter key: nhảy đến cùng cột trong dòng tiếp theo; tạo dòng mới nếu ở dòng cuối
  tr.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('keydown', function(e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const allRows = getDetailRows();
      const curIdx = allRows.indexOf(tr);
      const inputs = [...tr.querySelectorAll('input')];
      const colIdx = inputs.indexOf(this);
      let targetRow;
      if (curIdx < allRows.length - 1) {
        targetRow = allRows[curIdx + 1];
      } else {
        addDetailRow();
        targetRow = getDetailRows()[curIdx + 1];
      }
      if (targetRow) {
        const targetInputs = [...targetRow.querySelectorAll('input')];
        const target = targetInputs[colIdx] || targetInputs[0];
        if (target) target.focus();
      }
    });
  });

  tbody.appendChild(tr);
  if(d.dongia || d.sl || d.ck) calcDetailRow(tr);
}

function delDetailRow(btn) {
  btn.closest('tr').remove();
  document.querySelectorAll('#detail-tbody tr').forEach((tr,i) => {
    tr.querySelector('.row-num').textContent = i+1;
  });
  calcDetailTotals();
  generateDetailNd();
}

function calcDetailRow(tr) {
  const {sl, dongia, ck} = getRowData(tr);
  const tt = calcRowMoney(sl, dongia, ck);
  tr.dataset.tt = tt;
  const ttEl = tr.querySelector('[data-f="thtien"]');
  if(ttEl) {
    ttEl.textContent = tt ? numFmt(tt) : '';
    ttEl.className = 'tt-cell' + (!tt ? ' empty' : '');
  }
}

function calcDetailTotals() {
  let tc = 0;
  getDetailRows().forEach(tr => {
    tc += parseInt(tr.dataset.tt||'0', 10) || 0;
  });
  const tcEl = document.getElementById('detail-tc');
  if(tcEl) tcEl.textContent = numFmt(tc);

  // Dùng calcRowMoney(sl=1, dongia=tc, ck) để tái dùng logic CK
  const ckStr = (document.getElementById('detail-footer-ck')?.value||'').trim();
  const tong = calcRowMoney(1, tc, ckStr);

  const tongEl = document.getElementById('detail-tong');
  if(tongEl) { tongEl.textContent = numFmt(tong); tongEl.dataset.raw = tong; }
  const saveEl = document.getElementById('detail-tong-save');
  if(saveEl) saveEl.textContent = fmtM(tong);
}

function generateDetailNd() {
  const names = [];
  document.querySelectorAll('#detail-tbody tr [data-f="ten"]').forEach(inp => {
    const v = inp.value.trim();
    if(v) names.push(v);
  });
  const ndEl = document.getElementById('detail-nd');
  if(ndEl) ndEl.value = names.join(', ');
}

function saveDetailInvoice() {
  const ngay = document.getElementById('detail-ngay').value;
  if(!ngay) { toast('Vui lòng chọn ngày!','error'); return; }
  const loai = document.getElementById('detail-loai').value;
  if(!loai) { toast('Vui lòng chọn loại chi phí!','error'); return; }
  const ct = document.getElementById('detail-ct').value;
  if(!ct) { toast('Vui lòng chọn công trình!','error'); return; }

  const items = [];
  document.querySelectorAll('#detail-tbody tr').forEach(tr => {
    const {ten, dv, sl, dongia, ck} = getRowData(tr);
    const thanhtien = parseInt(tr.dataset.tt||'0', 10) || 0;
    if(!ten && !dongia) return;
    items.push({ten, dv, sl, dongia, ck, thanhtien});
  });
  if(!items.length) { toast('Chưa có dòng hàng hóa nào!','error'); return; }

  const tong = parseInt(document.getElementById('detail-tong').dataset.raw||'0') || 0;
  const nd = document.getElementById('detail-nd').value.trim();
  const container = document.getElementById('inr-hd-chitiet');
  const editId = container.dataset.editId;

  const inv = { ngay, congtrinh: ct, loai, nguoi: '', ncc: '', nd, tien: tong, thanhtien: tong, items, updatedAt: Date.now(), deviceId: DEVICE_ID };

  if(editId) {
    const idx = invoices.findIndex(i => String(i.id) === String(editId));
    if(idx >= 0) {
      invoices[idx] = {...invoices[idx], ...inv};
      toast('✅ Đã cập nhật hóa đơn chi tiết!','success');
    } else {
      inv.id = uuid(); inv.createdAt = Date.now(); inv.deletedAt = null;
      invoices.unshift(inv);
      toast('✅ Đã lưu hóa đơn chi tiết!','success');
    }
    container.dataset.editId = '';
  } else {
    inv.id = uuid(); inv.createdAt = Date.now(); inv.deletedAt = null;
    invoices.unshift(inv);
    toast('✅ Đã lưu hóa đơn chi tiết!','success');
  }

  save('inv_v3', invoices);
  buildYearSelect(); updateTop();
  renderTodayInvoices();
  buildFilters(); filterAndRender();
  clearDetailForm();
}

function clearDetailForm() {
  document.getElementById('detail-tbody').innerHTML = '';
  for(let i=0; i<5; i++) addDetailRow();
  const ckEl = document.getElementById('detail-footer-ck');
  if(ckEl) ckEl.value = '';
  const ndEl = document.getElementById('detail-nd');
  if(ndEl) ndEl.value = '';
  const container = document.getElementById('inr-hd-chitiet');
  if(container) container.dataset.editId = '';
  calcDetailTotals();
}

function openDetailEdit(inv) {
  const subNavBtn = document.querySelector('.sub-nav-btn[onclick*="sub-nhap-hd"]');
  if(subNavBtn) goSubPage(subNavBtn, 'sub-nhap-hd');
  window.scrollTo({top:0, behavior:'smooth'});
  setTimeout(() => {
    const innerBtn = document.querySelector('.inner-sub-btn[onclick*="inr-hd-chitiet"]');
    if(innerBtn) goInnerSub(innerBtn, 'inr-hd-chitiet');
    document.getElementById('detail-ngay').value = inv.ngay || today();
    setTimeout(() => {
      document.getElementById('detail-loai').value = inv.loai || '';
      document.getElementById('detail-ct').value = inv.congtrinh || '';
      document.getElementById('detail-tbody').innerHTML = '';
      const itemList = inv.items || [];
      itemList.forEach(item => addDetailRow(item));
      const needed = Math.max(0, 5 - itemList.length);
      for(let i=0; i<needed; i++) addDetailRow();
      document.getElementById('detail-nd').value = inv.nd || '';
      calcDetailTotals();
      document.getElementById('inr-hd-chitiet').dataset.editId = String(inv.id);
      toast('✏️ Chỉnh sửa hóa đơn chi tiết rồi nhấn 💾 Lưu','success');
    }, 50);
  }, 100);
}

// ══════════════════════════════
// INVOICE LIST
// ══════════════════════════════

// Toggle giữa "Tất cả HĐ" và "🗑 Đã xóa" trong sub-tat-ca
function switchTatCaView(val) {
  const activeWrap = document.getElementById('active-inv-wrap');
  const trashWrap  = document.getElementById('inline-trash-wrap');
  const isTrash = val === 'trash';
  if(activeWrap) activeWrap.style.display = isTrash ? 'none' : '';
  if(trashWrap)  trashWrap.style.display  = isTrash ? ''     : 'none';
  // Ẩn/hiện search + filters theo chế độ
  const filterIds = ['tc-search-box','f-ct','f-loai','f-month'];
  filterIds.forEach(id => {
    const el = document.getElementById(id);
    if(el) el.style.display = isTrash ? 'none' : '';
  });
  const exportBtn = document.getElementById('btn-export-csv');
  if(exportBtn) exportBtn.style.display = isTrash ? 'none' : '';
  if(isTrash) renderTrash();
  else { buildFilters(); filterAndRender(); }
}

function buildFilters() {
  const allInvs = buildInvoices();
  const yearInvs = allInvs.filter(i=>inActiveYear(i.ngay));
  // Dropdown CT: lọc mềm — CT có bất kỳ phát sinh (HĐ/CC/Ứng) trong năm
  const allCts = [...new Set(allInvs.map(i=>i.congtrinh).filter(Boolean))].sort();
  const cts = allCts.filter(ct => _entityInYear(ct, 'ct'));
  const loais = [...new Set(yearInvs.map(i=>i.loai))].filter(Boolean).sort();
  const months = [...new Set(yearInvs.map(i=>i.ngay?.slice(0,7)))].filter(Boolean).sort().reverse();
  const ctSel=document.getElementById('f-ct'); const cv=ctSel.value;
  ctSel.innerHTML='<option value="">Tất cả công trình</option>'+cts.map(c=>`<option ${c===cv?'selected':''} value="${x(c)}">${x(c)}</option>`).join('');
  const lSel=document.getElementById('f-loai'); const lv=lSel.value;
  lSel.innerHTML='<option value="">Tất cả loại</option>'+loais.map(l=>`<option ${l===lv?'selected':''} value="${x(l)}">${x(l)}</option>`).join('');
  const mSel=document.getElementById('f-month'); const mv=mSel.value;
  mSel.innerHTML='<option value="">Tất cả tháng</option>'+months.map(m=>`<option ${m===mv?'selected':''} value="${m}">${m}</option>`).join('');
}

function filterAndRender() {
  curPage=1;
  const q=document.getElementById('search').value.toLowerCase();
  const fCt=document.getElementById('f-ct').value;
  const fLoai=document.getElementById('f-loai').value;
  const fMonth=document.getElementById('f-month').value;
  filteredInvs = buildInvoices().filter(inv => {
    if(!inActiveYear(inv.ngay)) return false;
    if(fCt && inv.congtrinh!==fCt) return false;
    if(fLoai && inv.loai!==fLoai) return false;
    if(fMonth && !inv.ngay.startsWith(fMonth)) return false;
    if(q) { const t=[inv.ngay,inv.congtrinh,inv.loai,inv.nguoi,inv.sohd,inv.nd].join(' ').toLowerCase(); if(!t.includes(q)) return false; }
    return true;
  });
  // Sort: HĐ mới sửa/thêm trước (dùng _ts timestamp), rồi theo ngày giảm dần
  filteredInvs.sort((a,b)=>{
    const ta = a._ts||0, tb2 = b._ts||0;
    if(ta!==tb2) return tb2-ta;
    if(b.ngay!==a.ngay) return (b.ngay||'').localeCompare(a.ngay||'');
    return 0;
  });
  renderTable();
}

function renderTable() {
  const tbody=document.getElementById('all-tbody');
  const start=(curPage-1)*PG;
  const paged=filteredInvs.slice(start,start+PG);
  const sumTT=filteredInvs.reduce((s,i)=>s+(i.thanhtien||i.tien||0),0);
  if(!paged.length) {
    tbody.innerHTML=`<tr class="empty-row"><td colspan="10">Không có hóa đơn nào</td></tr>`;
    document.getElementById('pagination').innerHTML=''; return;
  }
  tbody.innerHTML = paged.map(inv=>{
    const isManual = inv.source === 'manual' || (!inv.source && !inv.ccKey);
    const isCC     = inv.source === 'cc' || (!inv.source && inv.ccKey);
    const actionBtn = isManual
      ? `<span style="white-space:nowrap;display:inline-flex;gap:3px">
          <button class="btn btn-outline btn-sm" onclick="editManualInvoice('${inv.id}')" title="Sửa hóa đơn">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="delInvoice('${inv.id}')" title="Xóa hóa đơn">✕</button>
        </span>`
      : isCC
        ? `<button class="btn btn-outline btn-sm" style="font-size:10px;padding:3px 7px" onclick="editCCInvoice('${inv.ccKey||inv.id}')" title="Chỉnh sửa tại tab Chấm Công">↩ CC</button>`
        : `<span style="color:var(--ink3);font-size:11px;padding:0 6px">—</span>`;
    return `<tr>
    <td style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--ink2)">${inv.ngay}</td>
    <td style="font-weight:600;font-size:12px;max-width:220px">${x(inv.congtrinh)}</td>
    <td><span class="tag tag-gold">${x(inv.loai)}</span></td>
    <td class="hide-mobile" style="color:var(--ink2)">${x(inv.nguoi||'—')}</td>
    <td class="hide-mobile" style="color:var(--ink2)">${x(inv.ncc||'—')}</td>
    <td style="color:var(--ink2);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${x(inv.nd)}">${x(inv.nd||'—')}</td>
    <td class="amount-td" title="Đơn giá: ${numFmt(inv.tien||0)}${inv.sl&&inv.sl!==1?' × '+inv.sl:''}">${numFmt(inv.thanhtien||inv.tien||0)}</td>
    <td style="white-space:nowrap">${actionBtn}</td>
  </tr>`;}).join('');

  const tp=Math.ceil(filteredInvs.length/PG);
  let pag=`<span>${filteredInvs.length} hóa đơn · Tổng: <strong style="color:var(--gold);font-family:'IBM Plex Mono',monospace">${fmtS(sumTT)}</strong></span>`;
  if(tp>1) {
    pag+='<div class="page-btns">';
    for(let p=1;p<=Math.min(tp,10);p++) pag+=`<button class="page-btn ${p===curPage?'active':''}" onclick="goTo(${p})">${p}</button>`;
    if(tp>10) pag+=`<span style="padding:4px 6px;color:var(--ink3)">...${tp}</span>`;
    pag+='</div>';
  }
  document.getElementById('pagination').innerHTML=pag;
}

function goTo(p) { curPage=p; renderTable(); }

function delInvoice(id) {
  const inv=invoices.find(i=>String(i.id)===String(id));
  if(!inv) { toast('Không tìm thấy hóa đơn!','error'); return; }
  // Chỉ cho xóa manual invoice — CC invoices phải xóa từ tab Chấm Công
  if(inv.ccKey || inv.source==='cc') {
    toast('⚠️ Không thể xóa hóa đơn từ chấm công! Hãy chỉnh sửa tại tab Chấm Công.','error');
    return;
  }
  if(!confirm('Xóa hóa đơn này? (Có thể khôi phục từ Thùng Rác)')) return;
  trashAdd({...inv});
  invoices=invoices.filter(i=>String(i.id)!==String(id));
  save('inv_v3',invoices); updateTop(); buildFilters(); filterAndRender(); renderTrash();
  toast('Đã xóa (có thể khôi phục trong Thùng Rác)');
}
function editCCInvoice(ccKeyOrId) {
  // ccKey format: 'cc|fromDate|ct|...'
  const key = String(ccKeyOrId);
  const parts = key.split('|');
  if (parts.length < 3 || parts[0] !== 'cc') return;
  const fromDate=parts[1], ct=parts[2];

  // 1. Chuyển tab — dùng goPage chuẩn
  const navBtn=document.querySelector('.nav-btn[data-page="chamcong"]');
  goPage(navBtn,'chamcong');
  window.scrollTo({top:0,behavior:'smooth'});

  // 2. Set tuần đúng (snap về CN của tuần đó)
  const sunISO=snapToSunday(fromDate);
  const satISO=ccSaturdayISO(sunISO);
  document.getElementById('cc-from').value=sunISO;
  document.getElementById('cc-to').value=satISO;
  document.getElementById('cc-week-label').textContent='Tuần: '+weekLabel(sunISO);
  // Tính lại offset
  const thisSun=ccSundayISO(0);
  const [ty,tm,td]=thisSun.split('-').map(Number);
  const [fy,fm,fd]=sunISO.split('-').map(Number);
  ccOffset=Math.round((new Date(fy,fm-1,fd)-new Date(ty,tm-1,td))/(7*86400000));

  // 3. Set công trình và load bảng (sau khi goPage đã populate select)
  setTimeout(()=>{
    const ctSel=document.getElementById('cc-ct-sel');
    if(ctSel){
      if(![...ctSel.options].find(o=>o.value===ct)){
        const o=document.createElement('option');o.value=ct;o.textContent=ct;ctSel.appendChild(o);
      }
      ctSel.value=ct;
    }
    loadCCWeekForm();
    toast('✏️ Đang xem tuần '+viShort(sunISO)+' — '+ct,'success');
  },50);
}
// Điều hướng đến form Nhập nhanh và nạp dữ liệu HĐ để chỉnh sửa
function openEntryEdit(inv) {
  // 1. Chuyển sang page Nhập
  const navBtn = document.querySelector('.nav-btn[data-page="nhap"]');
  if (navBtn) goPage(navBtn, 'nhap');
  // 2. Chuyển về sub-tab sub-nhap-hd
  const subBtn = document.querySelector('.sub-nav-btn[onclick*="sub-nhap-hd"]');
  if (subBtn && !subBtn.classList.contains('active')) {
    goSubPage(subBtn, 'sub-nhap-hd');
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => {
    // 3. Chuyển về inner tab Nhập nhanh
    const innerBtn = document.querySelector('.inner-sub-btn[onclick*="inr-nhap-nhanh"]');
    if (innerBtn) goInnerSub(innerBtn, 'inr-nhap-nhanh');
    // 4. Nạp dữ liệu vào form
    document.getElementById('entry-date').value = inv.ngay || today();
    document.getElementById('entry-tbody').innerHTML = '';
    addRow({ loai: inv.loai, congtrinh: inv.congtrinh, sl: inv.sl || undefined,
             nguoi: inv.nguoi || '', ncc: inv.ncc || '', nd: inv.nd || '', tien: inv.tien || 0 });
    const row = document.querySelector('#entry-tbody tr');
    if (row) row.dataset.editId = String(inv.id);
    calcSummary();
    toast('✏️ Chỉnh sửa rồi nhấn 💾 Cập Nhật', 'success');
  }, 100);
}

function editManualInvoice(id) {
  const inv = invoices.find(i => String(i.id) === String(id));
  if (!inv) return;
  if (inv.items && inv.items.length) { openDetailEdit(inv); return; }
  openEntryEdit(inv);
}
function showEditInvoiceModal(inv) {
  let ov=document.getElementById('edit-inv-overlay');
  if(!ov){ov=document.createElement('div');ov.id='edit-inv-overlay';ov.style.cssText='position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px';ov.onclick=function(e){if(e.target===this)this.remove();};document.body.appendChild(ov);}
  const ctOpts=cats.congTrinh.filter(v=>_ctInActiveYear(v)||v===inv.congtrinh).map(v=>`<option value="${x(v)}" ${v===inv.congtrinh?'selected':''}>${x(v)}</option>`).join('');
  const loaiOpts=cats.loaiChiPhi.map(v=>`<option value="${x(v)}" ${v===inv.loai?'selected':''}>${x(v)}</option>`).join('');
  ov.innerHTML=`<div style="background:#fff;border-radius:14px;padding:24px;width:min(480px,96vw);box-shadow:0 8px 32px rgba(0,0,0,.2);font-family:'IBM Plex Sans',sans-serif" onclick="event.stopPropagation()">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h3 style="font-size:16px;font-weight:700">✏️ Sửa Hóa Đơn</h3>
      <button onclick="document.getElementById('edit-inv-overlay').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#888">✕</button>
    </div>
    <div style="display:grid;gap:10px">
      <div><label style="font-size:12px;font-weight:600;color:#555;display:block;margin-bottom:3px">Ngày</label><input id="ei-ngay" type="date" value="${inv.ngay}" style="width:100%;padding:8px 10px;border:1.5px solid #ddd;border-radius:7px;font-family:inherit;font-size:13px;outline:none"></div>
      <div><label style="font-size:12px;font-weight:600;color:#555;display:block;margin-bottom:3px">Loại Chi Phí</label><select id="ei-loai" style="width:100%;padding:8px 10px;border:1.5px solid #ddd;border-radius:7px;font-family:inherit;font-size:13px;outline:none"><option value="">-- Chọn --</option>${loaiOpts}</select></div>
      <div><label style="font-size:12px;font-weight:600;color:#555;display:block;margin-bottom:3px">Công Trình</label><select id="ei-ct" style="width:100%;padding:8px 10px;border:1.5px solid #ddd;border-radius:7px;font-family:inherit;font-size:13px;outline:none"><option value="">-- Chọn --</option>${ctOpts}</select></div>
      <div><label style="font-size:12px;font-weight:600;color:#555;display:block;margin-bottom:3px">Người TH</label><input id="ei-nguoi" type="text" value="${x(inv.nguoi||'')}" list="ei-dl" style="width:100%;padding:8px 10px;border:1.5px solid #ddd;border-radius:7px;font-family:inherit;font-size:13px;outline:none"><datalist id="ei-dl">${cats.nguoiTH.map(v=>`<option value="${x(v)}">`).join('')}</datalist></div>
      <div><label style="font-size:12px;font-weight:600;color:#555;display:block;margin-bottom:3px">Nội Dung</label><input id="ei-nd" type="text" value="${x(inv.nd||'')}" style="width:100%;padding:8px 10px;border:1.5px solid #ddd;border-radius:7px;font-family:inherit;font-size:13px;outline:none"></div>
      <div><label style="font-size:12px;font-weight:600;color:#555;display:block;margin-bottom:3px">Số Tiền (đ)</label><input id="ei-tien" type="number" value="${inv.tien||0}" inputmode="decimal" style="width:100%;padding:8px 10px;border:1.5px solid #ddd;border-radius:7px;font-family:inherit;font-size:13px;outline:none"></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:16px">
      <button onclick="document.getElementById('edit-inv-overlay').remove()" style="flex:1;padding:10px;border-radius:8px;border:1.5px solid #ddd;background:#fff;font-family:inherit;font-size:13px;cursor:pointer">Hủy</button>
      <button onclick="saveEditInvoice('${inv.id}')" style="flex:2;padding:10px;border-radius:8px;border:none;background:#1a1814;color:#fff;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer">💾 Cập Nhật</button>
    </div>
  </div>`;
  ov.style.display='flex';
}
function saveEditInvoice(id) {
  const idx=invoices.findIndex(i=>String(i.id)===String(id));
  if(idx<0) return;
  const tien=parseInt(document.getElementById('ei-tien').value)||0;
  invoices[idx]={...invoices[idx],ngay:document.getElementById('ei-ngay').value,loai:document.getElementById('ei-loai').value,congtrinh:document.getElementById('ei-ct').value,nguoi:document.getElementById('ei-nguoi').value.trim(),nd:document.getElementById('ei-nd').value.trim(),tien,thanhtien:tien,updatedAt:Date.now(),deviceId:DEVICE_ID};
  save('inv_v3',invoices);
  document.getElementById('edit-inv-overlay').remove();
  buildFilters(); filterAndRender(); updateTop();
  toast('✅ Đã cập nhật hóa đơn!','success');
}

// ══════════════════════════════════════════════════════════════════
// TRASH SYSTEM
// ══════════════════════════════════════════════════════════════════
let trash = load('trash_v1', []);

function trashAdd(inv) {
  inv._deletedAt = new Date().toISOString();
  trash.unshift(inv);
  // Giữ tối đa 200 HĐ trong thùng rác
  if(trash.length>200) trash=trash.slice(0,200);
  localStorage.setItem('trash_v1', JSON.stringify(trash));
}

function trashRestore(id) {
  const idx=trash.findIndex(i=>String(i.id)===String(id));
  if(idx<0) return;
  const inv={...trash[idx]};
  delete inv._deletedAt;
  invoices.unshift(inv);
  trash.splice(idx,1);
  inv.updatedAt = Date.now(); inv.deviceId = DEVICE_ID; // đánh dấu vừa khôi phục
  save('inv_v3',invoices);
  localStorage.setItem('trash_v1',JSON.stringify(trash));
  updateTop(); buildFilters(); filterAndRender(); renderTrash();
  toast('✅ Đã khôi phục hóa đơn!','success');
}

function trashDeletePermanent(id) {
  trash=trash.filter(i=>String(i.id)!==String(id));
  localStorage.setItem('trash_v1',JSON.stringify(trash));
  renderTrash();
  toast('Đã xóa vĩnh viễn','success');
}

function trashClearAll() {
  if(!trash.length) return;
  if(!confirm(`Xóa vĩnh viễn ${trash.length} hóa đơn trong thùng rác?\nKhông thể khôi phục!`)) return;
  trash=[];
  localStorage.setItem('trash_v1',JSON.stringify(trash));
  renderTrash();
  toast('Đã xóa toàn bộ thùng rác','success');
}

function renderTrash() {
  const wrap=document.getElementById('trash-wrap');
  const empty=document.getElementById('trash-empty');
  const tbody=document.getElementById('trash-tbody');
  if(!wrap||!tbody||!empty) return;
  if(!trash.length) {
    wrap.style.display='none'; empty.style.display='';
    return;
  }
  wrap.style.display=''; empty.style.display='none';
  tbody.innerHTML=trash.slice(0,100).map(inv=>`<tr>
    <td style="font-size:11px;color:var(--ink2);white-space:nowrap;font-family:'IBM Plex Mono',monospace">${inv.ngay||''}</td>
    <td style="font-size:12px;font-weight:600;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${x(inv.congtrinh||'—')}</td>
    <td><span class="tag tag-gold">${x(inv.loai||'—')}</span></td>
    <td style="color:var(--ink2);font-size:12px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${x(inv.nd||'—')}</td>
    <td style="text-align:right;font-family:'IBM Plex Mono',monospace;font-weight:600;color:var(--green)">${numFmt(inv.tien||0)}</td>
    <td style="white-space:nowrap;display:flex;gap:4px;padding:5px 4px">
      <button class="btn btn-outline btn-sm" onclick="trashRestore('${inv.id}')" title="Khôi phục">↩ Khôi phục</button>
      <button class="btn btn-danger btn-sm" onclick="trashDeletePermanent('${inv.id}')" title="Xóa vĩnh viễn">✕</button>
    </td>
  </tr>`).join('');
}

// ══════════════════════════════════════════════════════════════════
//  BẢNG HÓA ĐƠN ĐÃ NHẬP TRONG NGÀY
// ══════════════════════════════════════════════════════════════════
function renderTodayInvoices() {
  // Lấy ngày từ subtab đang active
  const activeInner = document.querySelector('#sub-nhap-hd .inner-sub-page.active');
  const date = (activeInner?.id === 'inr-hd-chitiet')
    ? (document.getElementById('detail-ngay')?.value || today())
    : (document.getElementById('entry-date')?.value || today());

  const dateEl = document.getElementById('today-inv-date');
  if(dateEl) dateEl.textContent = '— ' + date;

  const tbody = document.getElementById('today-inv-tbody');
  const footer = document.getElementById('today-inv-footer');
  if(!tbody) return;

  const todayInvs = invoices.filter(i => i.ngay === date && !i.ccKey && !i.deletedAt);
  if(!todayInvs.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7">Chưa có hóa đơn nào vào ngày ${date}</td></tr>`;
    if(footer) footer.innerHTML = '';
    return;
  }

  const mono = "font-family:'IBM Plex Mono',monospace";
  tbody.innerHTML = todayInvs.map(inv => {
    const sl = inv.sl||1;
    const th = inv.thanhtien || (inv.tien*(sl));
    return `<tr>
      <td><span class="tag tag-gold">${x(inv.loai||'—')}</span></td>
      <td style="font-size:12px;font-weight:600;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${x(inv.congtrinh||'—')}</td>
      <td style="text-align:right;${mono};font-size:12px;color:var(--ink2)">${inv.tien?numFmt(inv.tien):'—'}</td>
      <td style="text-align:center;${mono};font-size:12px;color:var(--blue)">${sl!==1?sl:''}</td>
      <td style="text-align:right;${mono};font-weight:700;color:var(--green)">${numFmt(th)}</td>
      <td style="color:var(--ink2);font-size:11px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${x(inv.nd||'—')}</td>
      <td style="color:var(--ink2);font-size:11px">${x(inv.nguoi||'—')}</td>
    </tr>`;
  }).join('');

  const total = todayInvs.reduce((s,i)=>s+(i.thanhtien||i.tien||0),0);
  if(footer) footer.innerHTML = `<span>${todayInvs.length} hóa đơn</span><span>Tổng: <strong style="color:var(--gold);${mono}">${fmtS(total)}</strong></span>`;
}

function editTodayInv(id) {
  const inv = invoices.find(i => String(i.id) === String(id));
  if (!inv) return;
  if (inv.items && inv.items.length) { openDetailEdit(inv); return; }
  openEntryEdit(inv);
}

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════

// Tính thành tiền một dòng: sl × dongia áp chiết khấu ck
// ck = "" → không CK | "5%" → giảm 5% | "50000" → giảm tiền cố định
function calcRowMoney(sl, dongia, ck) {
  const base = sl * dongia;
  if (!ck) return Math.round(base);
  if (ck.endsWith('%')) return Math.round(base * (1 - (parseFloat(ck) || 0) / 100));
  return Math.round(base - parseMoney(ck));
}

// Trả về tất cả <tr> trong bảng hóa đơn chi tiết
function getDetailRows() {
  return [...document.querySelectorAll('#detail-tbody tr')];
}

// Đọc dữ liệu một dòng trong #detail-tbody
function getRowData(tr) {
  return {
    ten:    (tr.querySelector('[data-f="ten"]')?.value    || '').trim(),
    dv:     (tr.querySelector('[data-f="dv"]')?.value     || '').trim(),
    sl:     parseFloat(tr.querySelector('[data-f="sl"]')?.value)  || 1,
    dongia: parseInt(tr.querySelector('[data-f="dongia"]')?.dataset.raw || '0', 10) || 0,
    ck:     (tr.querySelector('[data-f="ck"]')?.value     || '').trim(),
  };
}
// ══════════════════════════════════════════════════════════════
