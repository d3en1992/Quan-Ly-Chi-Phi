// hoadon.js — Hoa Don / Tien Ung / Danh Muc / Import Excel
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
      if(idx >= 0) { invoices[idx] = {...invoices[idx], ...p, _ts: Date.now()}; updated++; }
    } else {
      invoices.unshift({id: Date.now() + Math.random(), _ts: Date.now(), ...p});
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
//  ALL PAGE
// ══════════════════════════════
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
      ? `<button class="btn btn-danger btn-sm" onclick="delInvoice('${inv.id}')" title="Xóa hóa đơn">✕</button>`
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
function editManualInvoice(id) {
  const inv=invoices.find(i=>String(i.id)===String(id));
  if(!inv) return;
  // Chuyển sang tab Nhập HĐ
  const navBtn=document.querySelector('.nav-btn[data-page="nhap"]');
  goPage(navBtn,'nhap');
  window.scrollTo({top:0,behavior:'smooth'});
  setTimeout(()=>{
    // Set ngày và clear bảng, tạo 1 hàng với dữ liệu HĐ cũ
    document.getElementById('entry-date').value=inv.ngay||today();
    document.getElementById('entry-tbody').innerHTML='';
    addRow({loai:inv.loai,congtrinh:inv.congtrinh,sl:inv.sl||undefined,nguoi:inv.nguoi||'',ncc:inv.ncc||'',nd:inv.nd||'',tien:inv.tien||0});
    // Đánh dấu edit mode — saveAllRows sẽ UPDATE thay vì thêm mới
    const row=document.querySelector('#entry-tbody tr');
    if(row) row.dataset.editId=String(inv.id);
    calcSummary();
    toast('✏️ Chỉnh sửa rồi nhấn 💾 Cập Nhật','success');
  },100);
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
  invoices[idx]={...invoices[idx],ngay:document.getElementById('ei-ngay').value,loai:document.getElementById('ei-loai').value,congtrinh:document.getElementById('ei-ct').value,nguoi:document.getElementById('ei-nguoi').value.trim(),nd:document.getElementById('ei-nd').value.trim(),tien,thanhtien:tien,_ts:Date.now()};
  save('inv_v3',invoices);
  document.getElementById('edit-inv-overlay').remove();
  buildFilters(); filterAndRender(); updateTop();
  toast('✅ Đã cập nhật hóa đơn!','success');
}

// ══════════════════════════════
//  CT PAGE
// ══════════════════════════════
function renderCtPage() {
  const grid=document.getElementById('ct-grid');
  const map={};
  buildInvoices().forEach(inv=>{
    if(!inActiveYear(inv.ngay)) return;
    if(!map[inv.congtrinh]) map[inv.congtrinh]={total:0,count:0,byLoai:{}};
    map[inv.congtrinh].total+=(inv.thanhtien||inv.tien||0); map[inv.congtrinh].count++;
    map[inv.congtrinh].byLoai[inv.loai]=(map[inv.congtrinh].byLoai[inv.loai]||0)+(inv.thanhtien||inv.tien||0);
  });
  const sortBy=(document.getElementById('ct-sort')?.value)||'value';
  const entries=Object.entries(map).sort((a,b)=>
    sortBy==='name' ? a[0].localeCompare(b[0],'vi') : b[1].total-a[1].total
  );
  if(!entries.length){grid.innerHTML=`<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--ink3);font-size:14px">Chưa có dữ liệu</div>`;return;}
  grid.innerHTML=entries.map(([ct,d])=>{
    const rows=Object.entries(d.byLoai).sort((a,b)=>b[1]-a[1]);
    return `<div class="ct-card" onclick="showCtModal(${JSON.stringify(ct)})">
      <div class="ct-card-head">
        <div><div class="ct-card-name">${x(ct)}</div><div class="ct-card-count">${d.count} hóa đơn</div></div>
        <div class="ct-card-total">${fmtS(d.total)}</div>
      </div>
      <div class="ct-card-body">
        ${rows.slice(0,6).map(([l,v])=>`<div class="ct-loai-row"><span class="ct-loai-name">${x(l)}</span><span class="ct-loai-val">${fmtS(v)}</span></div>`).join('')}
        ${rows.length>6?`<div style="font-size:11px;color:var(--ink3);text-align:right;padding-top:6px">+${rows.length-6} loại khác...</div>`:''}
      </div>
    </div>`;
  }).join('');
}

function showCtModal(ctName) {
  const invs=buildInvoices().filter(i=>i.congtrinh===ctName && inActiveYear(i.ngay));
  document.getElementById('modal-title').textContent='🏗️ '+ctName;
  const byLoai={};
  invs.forEach(inv=>{ if(!byLoai[inv.loai])byLoai[inv.loai]=[]; byLoai[inv.loai].push(inv); });
  const total=invs.reduce((s,i)=>s+(i.thanhtien||i.tien||0),0);
  let html=`<div style="display:flex;gap:12px;margin-bottom:18px">
    <div style="flex:1;background:var(--bg);border-radius:8px;padding:12px"><div style="font-size:10px;color:var(--ink3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Tổng HĐ</div><div style="font-size:22px;font-weight:700">${invs.length}</div></div>
    <div style="flex:2;background:var(--green-bg);border-radius:8px;padding:12px"><div style="font-size:10px;color:var(--ink3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Tổng Chi Phí</div><div style="font-size:20px;font-weight:700;font-family:'IBM Plex Mono',monospace;color:var(--green)">${fmtM(total)}</div></div>
  </div>`;
  Object.entries(byLoai).forEach(([loai,invList])=>{
    const lt=invList.reduce((s,i)=>s+(i.thanhtien||i.tien||0),0);
    html+=`<div style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 12px;background:var(--gold-bg);border-radius:6px;margin-bottom:6px">
        <span class="tag tag-gold">${x(loai)}</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-weight:700;color:var(--gold)">${fmtM(lt)}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr>${['Ngày','Người TH','Nội Dung','Thành Tiền'].map((h,i)=>`<th style="padding:5px 8px;background:#f3f1ec;font-size:10px;font-weight:700;color:var(--ink3);text-transform:uppercase;text-align:${i===3?'right':'left'}">${h}</th>`).join('')}</tr></thead>
        <tbody>${invList.map(i=>`<tr style="border-bottom:1px solid var(--line)">
          <td style="padding:6px 8px;font-family:'IBM Plex Mono',monospace;color:var(--ink2)">${i.ngay}</td>
          <td style="padding:6px 8px;color:var(--ink2)">${x(i.nguoi||'—')}</td>
          <td style="padding:6px 8px;color:var(--ink2)">${x(i.nd||'—')}</td>
          <td style="padding:6px 8px;text-align:right;font-family:'IBM Plex Mono',monospace;font-weight:600;color:var(--green)">${numFmt(i.thanhtien||i.tien||0)}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;
  });
  document.getElementById('modal-body').innerHTML=html;
  document.getElementById('ct-modal').classList.add('open');
}
function closeModal(){ document.getElementById('ct-modal').classList.remove('open'); }
document.getElementById('ct-modal').addEventListener('click',e=>{ if(e.target===e.currentTarget)closeModal(); });

// ══════════════════════════════
//  SETTINGS
// ══════════════════════════════
function renderSettings() {
  const grid=document.getElementById('dm-grid');
  grid.innerHTML='';
  CATS.forEach(cfg=>{
    const fullList = cats[cfg.id];
    // Lọc công trình theo năm, giữ idx gốc để edit/xóa đúng
    const withIdx = fullList.map((item, idx) => ({item, idx}));
    const filtered = (cfg.id === 'congTrinh' && activeYear !== 0)
      ? withIdx.filter(({item}) => _ctInActiveYear(item))
      : withIdx;
    const countLabel = (cfg.id === 'congTrinh' && activeYear !== 0)
      ? `${filtered.length} / ${fullList.length}`
      : `${fullList.length}`;
    const card=document.createElement('div');
    card.className='settings-card';
    card.innerHTML=`
      <div class="settings-card-head">
        <div class="settings-card-title">${cfg.title} <span style="font-size:11px;font-weight:400;color:var(--ink3)">(${countLabel})</span></div>
      </div>
      <div class="settings-list" id="sl-${cfg.id}">
        ${filtered.map(({item,idx})=>
          cfg.id==='congNhan'  ? renderCNItem(item,idx) :
          cfg.id==='congTrinh' ? renderCTItem(item,idx) :
          renderItem(cfg.id,item,idx)
        ).join('')}
      </div>
      <div class="settings-add">
        <input type="text" id="sa-${cfg.id}" placeholder="Thêm mới..." onkeydown="if(event.key==='Enter')addItem('${cfg.id}')">
        <button class="btn btn-gold btn-sm" onclick="addItem('${cfg.id}')">+ Thêm</button>
      </div>`;
    grid.appendChild(card);
  });
  // Render panel sao lưu
  renderBackupList();
}

// ── Render item Công Trình với badge năm ──────────────────────────
function renderCTItem(item, idx) {
  const inUse = isItemInUse('congTrinh', item);
  const yr = cats.congTrinhYears && cats.congTrinhYears[item];
  const yrBadge = yr
    ? `<span style="font-size:10px;color:#1565c0;padding:1px 5px;background:rgba(21,101,192,0.1);border-radius:3px;margin-right:2px;flex-shrink:0">${yr}</span>`
    : '';
  return `<div class="settings-item" id="si-congTrinh-${idx}" style="${inUse?'background:rgba(26,122,69,0.04)':''}">
    <span class="s-name" id="sn-congTrinh-${idx}" ondblclick="startEdit('congTrinh',${idx})">${x(item)}</span>
    ${yrBadge}
    ${inUse?`<span title="Đang được sử dụng" style="font-size:10px;color:#1a7a45;padding:2px 5px;background:rgba(26,122,69,0.1);border-radius:3px;margin-right:2px;flex-shrink:0">✓ đang dùng</span>`:''}
    <input class="s-edit-input" id="se-congTrinh-${idx}" value="${x(item)}"
      onblur="finishEdit('congTrinh',${idx})"
      onkeydown="if(event.key==='Enter')finishEdit('congTrinh',${idx});if(event.key==='Escape')cancelEdit('congTrinh',${idx})">
    <button class="btn btn-outline btn-sm btn-icon" onclick="startEdit('congTrinh',${idx})" title="Sửa tên">✏️</button>
    <button class="btn ${inUse?'btn-outline':'btn-danger'} btn-sm btn-icon" onclick="delItem('congTrinh',${idx})"
      title="${inUse?'Đang được sử dụng — không thể xóa':'Xóa'}" ${inUse?'style="opacity:0.4;cursor:not-allowed"':''}>✕</button>
  </div>`;
}

function renderItem(catId,item,idx) {
  const inUse = isItemInUse(catId, item);
  return `<div class="settings-item" id="si-${catId}-${idx}" style="${inUse?'background:rgba(26,122,69,0.04)':''}">
    <span class="s-name" id="sn-${catId}-${idx}" ondblclick="startEdit('${catId}',${idx})">${x(item)}</span>
    ${inUse?`<span title="Đang được sử dụng" style="font-size:10px;color:#1a7a45;padding:2px 5px;background:rgba(26,122,69,0.1);border-radius:3px;margin-right:2px">✓ đang dùng</span>`:''}
    <input class="s-edit-input" id="se-${catId}-${idx}" value="${x(item)}"
      onblur="finishEdit('${catId}',${idx})"
      onkeydown="if(event.key==='Enter')finishEdit('${catId}',${idx});if(event.key==='Escape')cancelEdit('${catId}',${idx})">
    <button class="btn btn-outline btn-sm btn-icon" onclick="startEdit('${catId}',${idx})" title="Sửa tên">✏️</button>
    <button class="btn ${inUse?'btn-outline':'btn-danger'} btn-sm btn-icon" onclick="delItem('${catId}',${idx})"
      title="${inUse?'Đang được sử dụng — không thể xóa':'Xóa'}" ${inUse?'style="opacity:0.4;cursor:not-allowed"':''}>✕</button>
  </div>`;
}

// ── Render item Công Nhân với cột T/P ────────────────────────────
function renderCNItem(name, idx) {
  const role = cnRoles[name] || '';
  const inUse = ccData.some(w => w.workers && w.workers.some(wk => wk.name === name));
  return `<div class="settings-item" id="si-congNhan-${idx}" style="${inUse?'background:rgba(26,122,69,0.04)':''}">
    <span class="s-name" id="sn-congNhan-${idx}" ondblclick="startEdit('congNhan',${idx})">${x(name)}</span>
    ${inUse?`<span title="Đang được sử dụng" style="font-size:10px;color:#1a7a45;padding:2px 5px;background:rgba(26,122,69,0.1);border-radius:3px;margin-right:2px">✓ đang dùng</span>`:''}
    <input class="s-edit-input" id="se-congNhan-${idx}" value="${x(name)}"
      onblur="finishEdit('congNhan',${idx})"
      onkeydown="if(event.key==='Enter')finishEdit('congNhan',${idx});if(event.key==='Escape')cancelEdit('congNhan',${idx})">
    <select onchange="updateCNRole(${idx},this.value)"
      style="margin:0 4px;padding:2px 6px;border:1px solid var(--line2);border-radius:4px;font-size:12px;font-weight:700;cursor:pointer;min-width:44px"
      title="Vai trò (C=Cái, T=Thợ, P=Phụ)">
      <option value="" ${!role?'selected':''}>—</option>
      <option value="C" ${role==='C'?'selected':''}>C</option>
      <option value="T" ${role==='T'?'selected':''}>T</option>
      <option value="P" ${role==='P'?'selected':''}>P</option>
    </select>
    <button class="btn btn-outline btn-sm btn-icon" onclick="startEdit('congNhan',${idx})" title="Sửa tên">✏️</button>
    <button class="btn ${inUse?'btn-outline':'btn-danger'} btn-sm btn-icon" onclick="delItem('congNhan',${idx})"
      title="${inUse?'Đang được sử dụng — không thể xóa':'Xóa'}" ${inUse?'style="opacity:0.4;cursor:not-allowed"':''}>✕</button>
  </div>`;
}

// ── Cập nhật vai trò CN từ Danh mục ──────────────────────────────
function updateCNRole(idx, role) {
  const name = cats.congNhan[idx];
  if (!name) return;
  cnRoles[name] = role;
  save('cat_cn_roles', cnRoles);
  syncCNRoles(name, role);
  toast(`✅ Đã cập nhật vai trò "${name}" → ${role||'—'}`, 'success');
}

// ── Đồng bộ vai trò vào ccData (năm hiện tại + năm trước) ────────
function syncCNRoles(name, role) {
  const curYear = activeYear || new Date().getFullYear();
  const prevYear = curYear - 1;
  let changed = false;
  ccData.forEach(week => {
    const yr = parseInt((week.fromDate || '').slice(0, 4));
    if (yr !== curYear && yr !== prevYear) return;
    (week.workers || []).forEach(wk => {
      if (wk.name === name) { wk.role = role; changed = true; }
    });
  });
  if (changed) save('cc_v2', ccData);
}

function startEdit(catId,idx) {
  document.getElementById(`sn-${catId}-${idx}`).classList.add('off');
  const e=document.getElementById(`se-${catId}-${idx}`); e.classList.add('on'); e.focus(); e.select();
}
function cancelEdit(catId,idx) {
  document.getElementById(`se-${catId}-${idx}`).classList.remove('on');
  document.getElementById(`sn-${catId}-${idx}`).classList.remove('off');
}
function finishEdit(catId,idx) {
  const inp=document.getElementById(`se-${catId}-${idx}`);
  const newVal=inp.value.trim();
  if(!newVal){cancelEdit(catId,idx);return;}
  const old=cats[catId][idx];
  cats[catId][idx]=newVal;
  // update invoices
  const cfg=CATS.find(c=>c.id===catId);
  if(cfg&&cfg.refField) {
    invoices.forEach(inv=>{ if(inv[cfg.refField]===old) inv[cfg.refField]=newVal; });
    // also update ung records tp field when nguoiTH or nhaCungCap renamed
    if(catId==='nguoiTH'||catId==='nhaCungCap') ungRecords.forEach(r=>{ if((r.loai||'thauphu')==='thauphu'&&r.tp===old) r.tp=newVal; });
    if(catId==='congNhan') ungRecords.forEach(r=>{ if(r.loai==='congnhan'&&r.tp===old) r.tp=newVal; });
    if(catId==='congTrinh') ungRecords.forEach(r=>{ if(r.congtrinh===old) r.congtrinh=newVal; });
  }
  // I.1: Cập nhật ccData + tbData khi đổi tên CT (giới hạn 2 năm)
  if (catId === 'congTrinh') {
    const curYear = activeYear || new Date().getFullYear();
    const prevYear = curYear - 1;
    let ccCh = false, tbCh = false;
    ccData.forEach(w => {
      const yr = parseInt((w.fromDate || '').slice(0, 4));
      if ((yr === curYear || yr === prevYear) && w.ct === old) { w.ct = newVal; ccCh = true; }
    });
    tbData.forEach(r => {
      const yr = parseInt((r.ngay || '').slice(0, 4));
      if ((yr === curYear || yr === prevYear) && r.ct === old) { r.ct = newVal; tbCh = true; }
    });
    if (ccCh) save('cc_v2', ccData);
    if (tbCh) { save('tb_v1', tbData); tbPopulateSels && tbPopulateSels(); tbRenderList && tbRenderList(); }
    // Cập nhật key trong congTrinhYears nếu có
    if (cats.congTrinhYears && cats.congTrinhYears[old] !== undefined) {
      cats.congTrinhYears[newVal] = cats.congTrinhYears[old];
      delete cats.congTrinhYears[old];
    }
  }
  saveCats(catId); save('inv_v3',invoices); save('ung_v1',ungRecords);
  renderSettings(); updateTop();
  // Cập nhật lại tab Tổng CP nếu đang đổi tên công trình
  if (catId === 'congTrinh') { renderCtPage(); buildFilters(); filterAndRender(); }
  toast('✅ Đã cập nhật "'+newVal+'"','success');
}
function addItem(catId) {
  const inp=document.getElementById(`sa-${catId}`);
  const val=inp.value.trim();
  if(!val) return;
  if(cats[catId].includes(val)){toast('Mục này đã tồn tại!','error');return;}
  cats[catId].push(val);
  // Gán năm cho công trình mới (để lọc theo năm)
  if (catId === 'congTrinh') {
    cats.congTrinhYears[val] = activeYear || new Date().getFullYear();
  }
  saveCats(catId); inp.value='';
  renderSettings(); rebuildEntrySelects(); rebuildUngSelects();
  if (catId === 'congTrinh') {
    try { populateCCCtSel(); } catch(e) {}
    try { tbPopulateSels(); } catch(e) {}
  }
  toast(`✅ Đã thêm "${val}"`,'success');
}
function isItemInUse(catId, item) {
  const cfg = CATS.find(c=>c.id===catId);
  if(!cfg || !cfg.refField) {
    // congNhan — kiểm tra trong ccData
    if(catId==='congNhan') return ccData.some(w=>w.workers&&w.workers.some(wk=>wk.name===item));
    return false;
  }
  // Kiểm tra trong invoices (kể cả CC-derived)
  if(buildInvoices().some(i=>(i[cfg.refField]||'')=== item)) return true;
  // Kiểm tra trong ungRecords (tp field)
  if(catId==='thauPhu'||catId==='nhaCungCap') {
    if(ungRecords.some(r=>(r.loai||'thauphu')==='thauphu'&&(r.tp||'')=== item)) return true;
  }
  if(catId==='congNhan') {
    if(ungRecords.some(r=>r.loai==='congnhan'&&(r.tp||'')=== item)) return true;
  }
  // Kiểm tra congTrinh trong cc + ung + thietbi
  if(catId==='congTrinh') {
    if(ungRecords.some(r=>(r.congtrinh||'')=== item)) return true;
    if(ccData.some(w=>(w.ct||'')=== item)) return true;
    if(tbData.some(r=>(r.ct||'')=== item)) return true;
  }
  return false;
}

function delItem(catId,idx) {
  const item=cats[catId][idx];
  if(isItemInUse(catId, item)) {
    toast(`⚠️ Công trình đã có dữ liệu, không thể xóa.`, 'error');
    return;
  }
  if(!confirm(`Xóa "${item}" khỏi danh mục?`)) return;
  cats[catId].splice(idx,1);
  // Xóa year entry nếu có
  if (catId === 'congTrinh' && cats.congTrinhYears) {
    delete cats.congTrinhYears[item];
  }
  saveCats(catId);
  renderSettings(); rebuildEntrySelects(); rebuildUngSelects();
  if (catId === 'congTrinh') {
    try { populateCCCtSel(); } catch(e) {}
    try { tbPopulateSels(); } catch(e) {}
  }
  toast(`Đã xóa "${item}"`);
}

function rebuildEntrySelects() {
  document.querySelectorAll('#entry-tbody [data-f="ct"]').forEach(sel=>{
    if(sel.tagName==='SELECT'){
      const cur=sel.value;
      sel.innerHTML=`<option value="">-- Chọn --</option>`+cats.congTrinh.filter(v=>_ctInActiveYear(v)||v===cur).map(v=>`<option value="${x(v)}" ${v===cur?'selected':''}>${x(v)}</option>`).join('');
    }
  });
  document.querySelectorAll('#entry-tbody [data-f="loai"]').forEach(sel=>{
    if(sel.tagName==='SELECT'){
      const cur=sel.value;
      sel.innerHTML=`<option value="">-- Chọn --</option>`+cats.loaiChiPhi.map(v=>`<option value="${x(v)}" ${v===cur?'selected':''}>${x(v)}</option>`).join('');
    }
  });
  // rebuild datalists for nguoi and ncc
  document.querySelectorAll('#entry-tbody [data-f="nguoi"]').forEach(inp=>{
    const dl=document.getElementById(inp.getAttribute('list'));
    if(dl) dl.innerHTML=cats.nguoiTH.map(v=>`<option value="${x(v)}">`).join('');
  });
  document.querySelectorAll('#entry-tbody [data-f="ncc"]').forEach(inp=>{
    const dl=document.getElementById(inp.getAttribute('list'));
    if(dl) dl.innerHTML=cats.nhaCungCap.map(v=>`<option value="${x(v)}">`).join('');
  });
}

// ══════════════════════════════
//  TIỀN ỨNG - ENTRY TABLE
// ══════════════════════════════
let ungRecords = load('ung_v1', []);
let filteredUng = [];
let ungPage = 1;

function initUngTable(n=4) {
  document.getElementById('ung-tbody').innerHTML='';
  for(let i=0;i<n;i++) addUngRow();
  calcUngSummary();
}

function initUngTableIfEmpty() {
  if(document.getElementById('ung-tbody').children.length===0) initUngTable(4);
}

function addUngRows(n) { for(let i=0;i<n;i++) addUngRow(); }

function onUngLoaiChange(sel) {
  const tr = sel.closest('tr');
  const tpInp = tr.querySelector('[data-f="tp"]');
  const dl = document.getElementById(tpInp.getAttribute('list'));
  if (!dl) return;
  const loai = sel.value;
  const options = loai === 'congnhan' ? cats.congNhan : [...cats.thauPhu, ...cats.nhaCungCap];
  dl.innerHTML = options.map(v => `<option value="${x(v)}">`).join('');
  tpInp.value = '';
  tpInp.placeholder = loai === 'congnhan' ? 'Tên công nhân...' : 'Nhập hoặc chọn...';
}

function addUngRow(d={}) {
  const tbody = document.getElementById('ung-tbody');
  const num = tbody.children.length + 1;
  const dlTp  = 'dlTP'  + num + Date.now();
  const ctOpts = `<option value="">-- Chọn --</option>` + cats.congTrinh.filter(v => _ctInActiveYear(v) || v===(d.congtrinh||'')).map(v=>`<option value="${x(v)}" ${v===(d.congtrinh||'')?'selected':''}>${x(v)}</option>`).join('');
  const dLoai = d.loai || 'thauphu';
  const tpOptions = dLoai === 'congnhan' ? cats.congNhan : [...cats.thauPhu, ...cats.nhaCungCap];
  const tpPlaceholder = dLoai === 'congnhan' ? 'Tên công nhân...' : 'Nhập hoặc chọn...';

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td class="row-num">${num}</td>
    <td style="padding:0">
      <select class="cell-input" data-f="loai" style="width:100%;border:none;background:transparent;padding:7px 6px;font-size:12px;font-weight:600;outline:none;color:var(--ink);cursor:pointer" onchange="onUngLoaiChange(this)">
        <option value="thauphu" ${dLoai==='thauphu'?'selected':''}>Thầu phụ</option>
        <option value="congnhan" ${dLoai==='congnhan'?'selected':''}>Công nhân</option>
      </select>
    </td>
    <td>
      <input class="cell-input" data-f="tp" list="${dlTp}" value="${x(d.tp||'')}" placeholder="${tpPlaceholder}">
      <datalist id="${dlTp}">${tpOptions.map(v=>`<option value="${x(v)}">`).join('')}</datalist>
    </td>
    <td><select class="cell-input" data-f="ct">${ctOpts}</select></td>
    <td><input class="cell-input right tien-input" data-f="tien" data-raw="${d.tien||''}" placeholder="0" value="${d.tien?numFmt(d.tien):''}" inputmode="decimal"></td>
    <td><input class="cell-input" data-f="nd" value="${x(d.nd||'')}" placeholder="Nội dung..."></td>
    <td><button class="del-btn" onclick="delUngRow(this)">✕</button></td>
  `;

  const tienInput = tr.querySelector('[data-f="tien"]');
  tienInput.addEventListener('input', function() {
    const raw = this.value.replace(/[.,]/g,'');
    this.dataset.raw = raw;
    if(raw) this.value = numFmt(parseInt(raw,10)||0);
    calcUngSummary();
  });
  tienInput.addEventListener('focus', function() { this.value = this.dataset.raw || ''; });
  tienInput.addEventListener('blur',  function() {
    const raw = parseInt(this.dataset.raw||'0',10)||0;
    this.value = raw ? numFmt(raw) : '';
  });

  tr.querySelectorAll('input,select').forEach(el => {
    if(el.dataset.f!=='tien') { el.addEventListener('input', calcUngSummary); el.addEventListener('change', calcUngSummary); }
  });
  tbody.appendChild(tr);
}

function delUngRow(btn) { btn.closest('tr').remove(); renumberUng(); calcUngSummary(); }

function renumberUng() {
  document.querySelectorAll('#ung-tbody tr').forEach((tr,i) => { tr.querySelector('.row-num').textContent = i+1; });
}

function calcUngSummary() {
  let cnt=0, total=0;
  document.querySelectorAll('#ung-tbody tr').forEach(tr => {
    const tp  = tr.querySelector('[data-f="tp"]')?.value||'';
    const tien = parseInt(tr.querySelector('[data-f="tien"]')?.dataset.raw||'0',10)||0;
    if(tp||tien>0) { cnt++; total+=tien; }
  });
  document.getElementById('ung-row-count').textContent=cnt;
  document.getElementById('ung-entry-total').textContent=fmtM(total);
}

function clearUngTable() {
  if(!confirm('Xóa toàn bộ bảng nhập tiền ứng?')) return;
  initUngTable(4);
}

function saveAllUngRows() {
  const date = document.getElementById('ung-date').value;
  if(!date) { toast('Vui lòng chọn ngày!','error'); return; }
  let saved=0, errRow=0;
  document.querySelectorAll('#ung-tbody tr').forEach(tr => {
    const tp = (tr.querySelector('[data-f="tp"]')?.value||'').trim();
    const tien = parseInt(tr.querySelector('[data-f="tien"]')?.dataset.raw||'0',10)||0;
    if(!tp&&!tien) return;
    if(!tp) { errRow++; tr.style.background='#fdecea'; return; }
    tr.style.background='';
    ungRecords.unshift({
      id: Date.now()+Math.random(), ngay:date,
      loai: (tr.querySelector('[data-f="loai"]')?.value||'thauphu'),
      tp,
      congtrinh:(tr.querySelector('[data-f="ct"]')?.value||'').trim(),
      tien,
      nd:(tr.querySelector('[data-f="nd"]')?.value||'').trim()
    });
    saved++;
  });
  if(errRow>0) { toast(`${errRow} dòng thiếu Thầu Phụ/NCC (đánh dấu đỏ)!`,'error'); return; }
  if(saved===0) { toast('Không có dòng hợp lệ!','error'); return; }
  save('ung_v1', ungRecords);
  toast(`✅ Đã lưu ${saved} tiền ứng!`,'success');
  initUngTable(4);
  document.getElementById('ung-date').value = today();
}

// ══════════════════════════════
//  TIỀN ỨNG - ALL PAGE
// ══════════════════════════════
function buildUngFilters() {
  const tps    = [...new Set(ungRecords.map(i=>i.tp))].filter(Boolean).sort();
  const cts    = [...new Set(ungRecords.map(i=>i.congtrinh))].filter(Boolean).sort();
  const months = [...new Set(ungRecords.map(i=>i.ngay.slice(0,7)))].filter(Boolean).sort().reverse();

  const tpSel=document.getElementById('uf-tp'); const tv=tpSel.value;
  tpSel.innerHTML='<option value="">Tất cả TP/NCC</option>'+tps.map(v=>`<option ${v===tv?'selected':''} value="${x(v)}">${x(v)}</option>`).join('');
  const ctSel=document.getElementById('uf-ct'); const cv=ctSel.value;
  ctSel.innerHTML='<option value="">Tất cả công trình</option>'+cts.map(v=>`<option ${v===cv?'selected':''} value="${x(v)}">${x(v)}</option>`).join('');
  const mSel=document.getElementById('uf-month'); const mv=mSel.value;
  mSel.innerHTML='<option value="">Tất cả tháng</option>'+months.map(m=>`<option ${m===mv?'selected':''} value="${m}">${m}</option>`).join('');
}

function filterAndRenderUng() {
  ungPage=1;
  const q=document.getElementById('ung-search').value.toLowerCase();
  const fTp=document.getElementById('uf-tp').value;
  const fCt=document.getElementById('uf-ct').value;
  const fMonth=document.getElementById('uf-month').value;
  filteredUng = ungRecords.filter(r => {
    if(r.cancelled) return false;
    if(!inActiveYear(r.ngay)) return false;
    if(fTp && r.tp!==fTp) return false;
    if(fCt && r.congtrinh!==fCt) return false;
    if(fMonth && !r.ngay.startsWith(fMonth)) return false;
    if(q) { const t=[r.ngay,r.tp,r.congtrinh,r.nd].join(' ').toLowerCase(); if(!t.includes(q)) return false; }
    return true;
  });
  renderUngTable();
}

function _ungSectionHTML(recs, title, accentColor) {
  if (!recs.length) return '';
  const mono = "font-family:'IBM Plex Mono',monospace";
  const sumSec = recs.reduce((s,r)=>s+(r.tien||0),0);
  return `<div style="margin-bottom:18px">
    <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 12px;background:var(--bg);border-radius:6px;margin-bottom:8px;border-left:3px solid ${accentColor}">
      <span style="font-weight:700;font-size:12px;color:var(--ink2)">${title}</span>
      <span style="${mono};font-size:12px;font-weight:700;color:${accentColor}">${fmtS(sumSec)}</span>
    </div>
    <div style="overflow-x:auto">
      <table class="records-table">
        <thead><tr>
          <th style="width:32px;text-align:center">
            <input type="checkbox" class="ung-section-chk-all" title="Chọn tất cả"
              onchange="this.closest('table').querySelectorAll('.ung-row-chk').forEach(c=>c.checked=this.checked)">
          </th>
          <th>Ngày</th><th>Người Nhận</th><th>Công Trình</th><th>Nội Dung</th>
          <th style="text-align:right">Số Tiền Ứng</th><th></th>
        </tr></thead>
        <tbody>${recs.map(r=>`<tr>
          <td style="text-align:center;padding:4px">
            <input type="checkbox" class="ung-row-chk" data-id="${r.id}" style="width:15px;height:15px;cursor:pointer">
          </td>
          <td style="${mono};font-size:11px;color:var(--ink2)">${r.ngay}</td>
          <td style="font-weight:600;font-size:12px">${x(r.tp)}</td>
          <td style="color:var(--ink2)">${x(r.congtrinh||'—')}</td>
          <td style="color:var(--ink2);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${x(r.nd)}">${x(r.nd||'—')}</td>
          <td class="amount-td" style="color:var(--blue)">${numFmt(r.tien||0)}</td>
          <td><button class="btn btn-danger btn-sm" onclick="delUngRecord('${r.id}')">✕</button></td>
        </tr>`).join('')}</tbody>
      </table>
    </div>
  </div>`;
}

function renderUngTable() {
  const container = document.getElementById('ung-all-sections');
  const start = (ungPage-1)*PG;
  const paged = filteredUng.slice(start, start+PG);
  const sumTien = filteredUng.reduce((s,r)=>s+(r.tien||0),0);

  if (!paged.length) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--ink3);font-size:14px">Không có dữ liệu tiền ứng nào</div>`;
    document.getElementById('ung-pagination').innerHTML = ''; return;
  }

  const tpRecs = paged.filter(r => (r.loai||'thauphu') === 'thauphu');
  const cnRecs = paged.filter(r => r.loai === 'congnhan');

  container.innerHTML =
    _ungSectionHTML(tpRecs, 'Thầu Phụ / Nhà Cung Cấp', 'var(--gold)') +
    _ungSectionHTML(cnRecs, 'Công Nhân', 'var(--blue)');

  const mono = "font-family:'IBM Plex Mono',monospace";
  const tp2 = Math.ceil(filteredUng.length/PG);
  let pag = `<span>${filteredUng.length} bản ghi · Tổng tiền ứng: <strong style="color:var(--blue);${mono}">${fmtS(sumTien)}</strong></span>`;
  if (tp2>1) {
    pag += '<div class="page-btns">';
    for (let p=1; p<=Math.min(tp2,10); p++) pag += `<button class="page-btn ${p===ungPage?'active':''}" onclick="goUngTo(${p})">${p}</button>`;
    pag += '</div>';
  }
  document.getElementById('ung-pagination').innerHTML = pag;
}

function goUngTo(p) { ungPage=p; renderUngTable(); }

function delUngRecord(id) {
  const idx = ungRecords.findIndex(r=>String(r.id)===String(id));
  if(idx<0) return;
  if(!confirm('Hủy bản ghi tiền ứng này?\n(Lịch sử sẽ được giữ lại với trạng thái "Đã hủy")')) return;
  ungRecords[idx] = { ...ungRecords[idx], cancelled: true };
  save('ung_v1',ungRecords); buildUngFilters(); filterAndRenderUng();
  toast('Đã hủy bản ghi (lịch sử vẫn được lưu)');
}

function rebuildUngSelects() {
  document.querySelectorAll('#ung-tbody [data-f="ct"]').forEach(sel=>{
    if(sel.tagName==='SELECT'){
      const cur=sel.value;
      sel.innerHTML=`<option value="">-- Chọn --</option>`+cats.congTrinh.filter(v=>_ctInActiveYear(v)||v===cur).map(v=>`<option value="${x(v)}" ${v===cur?'selected':''}>${x(v)}</option>`).join('');
    }
  });
  document.querySelectorAll('#ung-tbody [data-f="tp"]').forEach(inp=>{
    const dl=document.getElementById(inp.getAttribute('list'));
    if(!dl) return;
    const loai = inp.closest('tr')?.querySelector('[data-f="loai"]')?.value || 'thauphu';
    const opts = loai === 'congnhan' ? cats.congNhan : [...cats.thauPhu,...cats.nhaCungCap];
    dl.innerHTML = opts.map(v=>`<option value="${x(v)}">`).join('');
  });
}

function exportUngEntryCSV() {
  const rows=[['Thầu Phụ / Nhà CC','Công Trình','Số Tiền Ứng','Nội Dung']];
  document.querySelectorAll('#ung-tbody tr').forEach(tr=>{
    const tp=tr.querySelector('[data-f="tp"]')?.value||'';
    if(!tp) return;
    rows.push([tp,tr.querySelector('[data-f="ct"]')?.value||'',parseInt(tr.querySelector('[data-f="tien"]')?.dataset.raw||'0',10)||0,tr.querySelector('[data-f="nd"]')?.value||'']);
  });
  dlCSV(rows,'nhap_tien_ung_'+today()+'.csv');
}

function exportUngAllCSV() {
  const src=filteredUng.length>0?filteredUng:ungRecords;
  const rows=[['Ngày','Thầu Phụ / Nhà CC','Công Trình','Nội Dung','Số Tiền Ứng']];
  src.forEach(r=>rows.push([r.ngay,r.tp,r.congtrinh||'',r.nd||'',r.tien]));
  dlCSV(rows,'tien_ung_'+today()+'.csv');
}

// ══════════════════════════════
//  EXPORT
// ══════════════════════════════
function exportEntryCSV() {
  const rows=[['Loại Chi Phí','Công Trình','Người TH','Nhà Cung Cấp','Nội Dung','Số Tiền']];
  document.querySelectorAll('#entry-tbody tr').forEach(tr=>{
    const loai=tr.querySelector('[data-f="loai"]')?.value||'';
    const ct=tr.querySelector('[data-f="ct"]')?.value||'';
    if(!loai&&!ct) return;
    const tien=parseInt(tr.querySelector('[data-f="tien"]')?.dataset.raw||'0',10)||0;
    rows.push([loai,ct,tr.querySelector('[data-f="nguoi"]')?.value||'',tr.querySelector('[data-f="ncc"]')?.value||'',tr.querySelector('[data-f="nd"]')?.value||'',tien]);
  });
  dlCSV(rows,'nhap_'+today()+'.csv');
}
function exportAllCSV() {
  const src=filteredInvs.length>0?filteredInvs:buildInvoices();
  const rows=[['Ngày','Công Trình','Loại Chi Phí','Người TH','Nhà Cung Cấp','Nội Dung','Số Tiền']];
  src.forEach(i=>rows.push([i.ngay,i.congtrinh,i.loai,i.nguoi,i.ncc||'',i.nd,i.tien||i.thanhtien||0]));
  dlCSV(rows,'hoa_don_'+today()+'.csv');
}

// ══════════════════════════════════════════════════════════════════
//  THÙNG RÁC (Hóa Đơn Đã Xóa)
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
  inv._ts = Date.now(); // đánh dấu vừa khôi phục
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
  const date = document.getElementById('entry-date')?.value || today();
  const dateEl = document.getElementById('today-inv-date');
  if(dateEl) dateEl.textContent = '— ' + date;

  const tbody = document.getElementById('today-inv-tbody');
  const footer = document.getElementById('today-inv-footer');
  if(!tbody) return;

  // Lọc HĐ theo ngày đã chọn (không phân biệt năm)
  const todayInvs = invoices.filter(i => i.ngay === date && !i.ccKey);
  if(!todayInvs.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="8">Chưa có hóa đơn nào vào ngày ${date}</td></tr>`;
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
      <td style="white-space:nowrap;display:flex;gap:3px;padding:5px 4px">
        <button class="btn btn-outline btn-sm" onclick="editTodayInv('${inv.id}')" title="Sửa">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="delInvoice('${inv.id}');renderTodayInvoices()">✕</button>
      </td>
    </tr>`;
  }).join('');

  const total = todayInvs.reduce((s,i)=>s+(i.thanhtien||i.tien||0),0);
  if(footer) footer.innerHTML = `<span>${todayInvs.length} hóa đơn</span><span>Tổng: <strong style="color:var(--gold);${mono}">${fmtS(total)}</strong></span>`;
}

function editTodayInv(id) {
  const inv = invoices.find(i=>String(i.id)===String(id));
  if(!inv) return;
  document.getElementById('entry-date').value = inv.ngay || today();
  document.getElementById('entry-tbody').innerHTML = '';
  addRow({loai:inv.loai, congtrinh:inv.congtrinh, sl:inv.sl||undefined,
           nguoi:inv.nguoi||'', ncc:inv.ncc||'', nd:inv.nd||'', tien:inv.tien||0});
  const row = document.querySelector('#entry-tbody tr');
  if(row) row.dataset.editId = String(inv.id);
  calcSummary();
  window.scrollTo({top:0, behavior:'smooth'});
  toast('✏️ Chỉnh sửa rồi nhấn 💾 Lưu / Cập Nhật', 'success');
}

// IMPORT EXCEL → FIREBASE
// ══════════════════════════════════════════════════════════════

function openImportModal() {
  document.getElementById('import-file-input').click();
}

function handleImportFile(e) {
  const file = e.target.files[0];
  if(!file) return;
  e.target.value = '';
  const reader = new FileReader();
  reader.onload = function(ev) {
    try {
      const wb = XLSX.read(ev.target.result, {type:'array'});
      _processImportWorkbook(wb, file.name);
    } catch(err) {
      toast('❌ Không đọc được file Excel: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

function _processImportWorkbook(wb, filename) {
  const result = { inv:[], ung:[], cc:[], tb:[], cats:{} };
  let log = [];

  // Helper: parse ngày YYYY-MM-DD hoặc Excel serial
  function parseDate(v) {
    if(!v) return '';
    if(typeof v === 'number') {
      // Excel date serial
      const d = new Date(Math.round((v - 25569)*86400*1000));
      return d.toISOString().slice(0,10);
    }
    const s = String(v).trim();
    if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // dd/mm/yyyy
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if(m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    return '';
  }
  function num(v) { return parseFloat(String(v||'').replace(/[^0-9.\-]/g,''))||0; }
  function str(v) { return v ? String(v).trim() : ''; }
  function sheetToRows(ws) {
    return XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
  }

  // ── Sheet 1: HoaDon / ChiPhi ──────────────────────────────
  const s1name = wb.SheetNames.find(n=>n.includes('HoaDon')||n.includes('1_'));
  if(s1name) {
    const rows = sheetToRows(wb.Sheets[s1name]);
    let dataStart = -1;
    for(let i=0;i<rows.length;i++) {
      const r = rows[i];
      if(r[0] && /^\d{4}-\d{2}-\d{2}$/.test(String(r[0]).trim()) ||
         (r[0] && String(r[0]).match(/^\d{4}[\-\/]\d/))) {
        dataStart = i; break;
      }
      // Cũng check dạng ngày serial Excel
      if(typeof r[0]==='number' && r[0]>40000 && r[0]<60000) {
        dataStart = i; break;
      }
    }
    if(dataStart >= 0) {
      for(let i=dataStart; i<rows.length; i++) {
        const r = rows[i];
        const ngay = parseDate(r[0]);
        const ct   = str(r[1]);
        const loai = str(r[2]);
        const tien = num(r[4]);
        if(!ngay || !ct || !loai || !tien) continue;
        result.inv.push({
          id: Date.now() + Math.random(),
          ngay, congtrinh:ct, loai, nd:str(r[3]),
          tien, sl: num(r[5])||undefined,
          thanhtien: tien * (num(r[5])||1),
          nguoi:str(r[6]), ncc:str(r[7]), sohd:str(r[8]),
          _ts: Date.now()
        });
      }
      log.push(`✅ Hóa Đơn: ${result.inv.length} hàng`);
    }
  }

  // ── Sheet 2: TienUng ─────────────────────────────────────
  const s2name = wb.SheetNames.find(n=>n.includes('TienUng')||n.includes('2_'));
  if(s2name) {
    const rows = sheetToRows(wb.Sheets[s2name]);
    let dataStart = -1;
    for(let i=0;i<rows.length;i++) {
      const r = rows[i];
      if(parseDate(r[0])) { dataStart=i; break; }
    }
    if(dataStart >= 0) {
      for(let i=dataStart; i<rows.length; i++) {
        const r = rows[i];
        const ngay = parseDate(r[0]);
        const ct   = str(r[1]);
        const tp   = str(r[2]);
        const tien = num(r[3]);
        if(!ngay || !ct || !tp || !tien) continue;
        result.ung.push({ id:Date.now()+Math.random(), ngay, congtrinh:ct, tp, tien, nd:str(r[4]), _ts:Date.now() });
      }
      log.push(`✅ Tiền Ứng: ${result.ung.length} hàng`);
    }
  }

  // ── Sheet 3: ChamCong ─────────────────────────────────────
  const s3name = wb.SheetNames.find(n=>n.includes('ChamCong')||n.includes('3_'));
  if(s3name) {
    const rows = sheetToRows(wb.Sheets[s3name]);
    let dataStart = -1;
    for(let i=0;i<rows.length;i++) {
      const r = rows[i];
      if(parseDate(r[0])) { dataStart=i; break; }
    }
    // Group theo fromDate + ct
    const weekMap = {};
    if(dataStart >= 0) {
      for(let i=dataStart; i<rows.length; i++) {
        const r = rows[i];
        const fromDate = parseDate(r[0]);
        const ct = str(r[1]);
        const name = str(r[2]);
        const luong = num(r[3]);
        if(!fromDate || !ct || !name) continue;
        const key = fromDate+'|'+ct;
        if(!weekMap[key]) {
          // Tính toDate = fromDate + 6 ngày (Thứ 7)
          let toDate = '';
          try {
            const [y,m,d] = fromDate.split('-').map(Number);
            const sat = new Date(y, m-1, d+6);
            toDate = sat.getFullYear() + '-' +
              String(sat.getMonth()+1).padStart(2,'0') + '-' +
              String(sat.getDate()).padStart(2,'0');
          } catch(e) { toDate = fromDate; }
          weekMap[key] = { id:Date.now()+Math.random(), fromDate, toDate, ct, workers:[] };
        }
        const d = [num(r[6]),num(r[7]),num(r[8]),num(r[9]),num(r[10]),num(r[11]),num(r[12])];
        weekMap[key].workers.push({ name, luong, phucap:num(r[4]), hdmuale:num(r[5]), d, nd:str(r[13]) });
      }
    }
    result.cc = Object.values(weekMap);
    if(result.cc.length) log.push(`✅ Chấm Công: ${result.cc.length} tuần, ${result.cc.reduce((s,w)=>s+w.workers.length,0)} CN`);
  }

  // ── Sheet 4: ThietBi ─────────────────────────────────────
  const s4name = wb.SheetNames.find(n=>n.includes('ThietBi')||n.includes('4_'));
  if(s4name) {
    const rows = sheetToRows(wb.Sheets[s4name]);
    let dataStart = -1;
    for(let i=0;i<rows.length;i++) {
      const r = rows[i];
      if(str(r[0]) && str(r[1]) && !['CÔNG TRÌNH','CONGTRINH'].includes(str(r[0]).toUpperCase())) {
        dataStart=i; break;
      }
    }
    if(dataStart >= 0) {
      for(let i=dataStart; i<rows.length; i++) {
        const r = rows[i];
        const ct = str(r[0]); const ten = str(r[1]);
        if(!ct || !ten) continue;
        result.tb.push({ id:Date.now()+Math.random(), ct, ten,
          soluong: num(r[2])||1, tinhtrang: str(r[3])||'Đang hoạt động',
          nguoi:str(r[4]), ngay:parseDate(r[5])||'', ghichu:str(r[6]) });
      }
      log.push(`✅ Thiết Bị: ${result.tb.length} hàng`);
    }
  }

  // ── Sheet 5: DanhMuc ─────────────────────────────────────
  const s5name = wb.SheetNames.find(n=>n.includes('DanhMuc')||n.includes('5_'));
  if(s5name) {
    const rows = sheetToRows(wb.Sheets[s5name]);
    const newCats = { ct:[], loai:[], ncc:[], nguoi:[] };
    for(let i=2; i<rows.length; i++) {
      const r = rows[i];
      if(str(r[0])) newCats.ct.push(str(r[0]));
      if(str(r[1])) newCats.loai.push(str(r[1]));
      if(str(r[2])) newCats.ncc.push(str(r[2]));
      if(str(r[3])) newCats.nguoi.push(str(r[3]));
    }
    result.cats = newCats;
    log.push(`✅ Danh Mục: ${newCats.ct.length} CT, ${newCats.loai.length} Loại, ${newCats.ncc.length} NCC`);
  }

  const total = result.inv.length + result.ung.length + result.cc.length + result.tb.length;
  if(total === 0 && Object.keys(result.cats).length === 0) {
    toast('⚠️ Không tìm thấy dữ liệu hợp lệ trong file!', 'error'); return;
  }

  _showImportPreview(result, log, filename);
}

function _showImportPreview(result, log, filename) {
  let ov = document.getElementById('import-modal-overlay');
  if(!ov) {
    ov = document.createElement('div');
    ov.id = 'import-modal-overlay';
    ov.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;align-items:center;justify-content:center';
    ov.onclick = function(e) { if(e.target===this) ov.style.display='none'; };
    document.body.appendChild(ov);
  }

  // Đếm theo năm
  const years = new Set();
  result.inv.forEach(i=>{ if(i.ngay) years.add(i.ngay.slice(0,4)); });
  result.ung.forEach(i=>{ if(i.ngay) years.add(i.ngay.slice(0,4)); });
  result.cc.forEach(i=>{ if(i.fromDate) years.add(i.fromDate.slice(0,4)); });

  ov.innerHTML = `<div onclick="event.stopPropagation()" style="max-width:480px;width:95vw;background:#fff;border-radius:16px;padding:24px;font-family:'IBM Plex Sans',sans-serif;box-shadow:0 12px 48px rgba(0,0,0,.18);max-height:90vh;overflow-y:auto">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h3 style="font-size:16px;font-weight:800;margin:0">📥 Xem Trước Import</h3>
      <button onclick="document.getElementById('import-modal-overlay').style.display='none'" style="background:none;border:none;font-size:22px;cursor:pointer;color:#888">✕</button>
    </div>
    <div style="background:#f0f4ff;border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:12px;color:#333">
      <strong>📄 File:</strong> ${filename}<br>
      <strong>📅 Năm dữ liệu:</strong> ${[...years].sort().join(', ')||'—'}
    </div>
    <div style="margin-bottom:14px">
      ${log.map(l=>`<div style="padding:5px 10px;margin-bottom:4px;background:#f0fff4;border-left:3px solid #1a7a45;border-radius:4px;font-size:12px">${l}</div>`).join('')}
    </div>
    <div style="background:#fff3cd;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:12px;color:#856404">
      ⚠️ Dữ liệu mới sẽ được <strong>gộp</strong> vào dữ liệu hiện có (không xoá dữ liệu cũ).
      ${fbReady() ? '<br>Sau khi nhập sẽ tự động lưu lên Firebase.' : '<br>Chưa kết nối Firebase — chỉ lưu local.'}
    </div>
    <div style="display:flex;gap:8px">
      <button onclick="document.getElementById('import-modal-overlay').style.display='none'" style="flex:1;padding:11px;border-radius:8px;border:1.5px solid #ccc;background:#fff;font-family:inherit;font-size:13px;cursor:pointer">Huỷ</button>
      <button onclick="_confirmImport()" style="flex:2;padding:11px;border-radius:8px;border:none;background:#1a1814;color:#fff;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer">✅ Xác Nhận Import</button>
    </div>
  </div>`;
  ov.style.display = 'flex';
  ov._importResult = result;
}

function _confirmImport() {
  const ov = document.getElementById('import-modal-overlay');
  const result = ov._importResult;
  if(!result) return;
  ov.style.display = 'none';

  // Merge vào localStorage
  if(result.inv.length) {
    const existing = load('inv_v3',[]);
    localStorage.setItem('inv_v3', JSON.stringify([...result.inv, ...existing]));
    invoices = load('inv_v3',[]);
  }
  if(result.ung.length) {
    const existing = load('ung_v1',[]);
    localStorage.setItem('ung_v1', JSON.stringify([...result.ung, ...existing]));
    ungRecords = load('ung_v1',[]);
  }
  if(result.cc.length) {
    const existing = load('cc_v2',[]);
    localStorage.setItem('cc_v2', JSON.stringify([...result.cc, ...existing]));
    ccData = load('cc_v2',[]);
  }
  if(result.tb.length) {
    const existing = load('tb_v1',[]);
    localStorage.setItem('tb_v1', JSON.stringify([...result.tb, ...existing]));
    tbData = load('tb_v1',[]);
  }

  // Merge danh mục
  const c = result.cats;
  if(c.ct && c.ct.length)    { const cur=load('cat_ct',DEFAULTS.congTrinh); const merged=[...new Set([...cur,...c.ct])]; localStorage.setItem('cat_ct',JSON.stringify(merged)); cats.congTrinh=merged; }
  if(c.loai && c.loai.length) { const cur=load('cat_loai',DEFAULTS.loaiChiPhi); const merged=[...new Set([...cur,...c.loai])]; localStorage.setItem('cat_loai',JSON.stringify(merged)); cats.loaiChiPhi=merged; }
  if(c.ncc && c.ncc.length)   { const cur=load('cat_ncc',DEFAULTS.nhaCungCap); const merged=[...new Set([...cur,...c.ncc])]; localStorage.setItem('cat_ncc',JSON.stringify(merged)); cats.nhaCungCap=merged; }
  if(c.nguoi && c.nguoi.length){ const cur=load('cat_nguoi',DEFAULTS.nguoiTH); const merged=[...new Set([...cur,...c.nguoi])]; localStorage.setItem('cat_nguoi',JSON.stringify(merged)); cats.nguoiTH=merged; }

  // ── Xử lý Chấm Công import: chỉ cập nhật danh mục, HĐ tính động qua buildInvoices() ──
  if(result.cc.length) {
    rebuildCCCategories();
  }

  buildYearSelect();
  rebuildEntrySelects(); rebuildUngSelects();
  buildFilters(); filterAndRender(); renderTrash();
  renderCCHistory(); renderCCTLT();
  buildUngFilters(); filterAndRenderUng();
  renderCtPage(); renderSettings(); updateTop();

  toast('✅ Import thành công!', 'success');

  // Push lên Firebase tất cả các năm có trong data
  if(fbReady()) {
    showSyncBanner('☁️ Đang lưu lên Firebase...');
    const years = new Set();
    result.inv.forEach(i=>{ if(i.ngay) years.add(parseInt(i.ngay.slice(0,4))); });
    result.ung.forEach(i=>{ if(i.ngay) years.add(parseInt(i.ngay.slice(0,4))); });
    result.cc.forEach(i=>{ if(i.fromDate) years.add(parseInt(i.fromDate.slice(0,4))); });
    if(!years.size) years.add(activeYear||new Date().getFullYear());

    let pending = years.size;
    years.forEach(yr => {
      const payload = fbYearPayload(yr);
      fsSet(fbDocYear(yr), payload).then(()=>{
        pending--;
        if(pending===0) {
          fsSet(fbDocCats(), fbCatsPayload()).then(()=>{
            showSyncBanner('✅ Đã lưu lên Firebase!', 3000);
          });
        }
      }).catch(()=>{ pending--; });
    });
  }
}


// ══════════════════════════════════════════════════════════════
// XUẤT DỮ LIỆU RA EXCEL (Export)
// ══════════════════════════════════════════════════════════════

function openExportModal() {
  let ov = document.getElementById('export-modal-overlay');
  if(!ov) {
    ov = document.createElement('div');
    ov.id = 'export-modal-overlay';
    ov.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;align-items:center;justify-content:center';
    ov.onclick = function(e){ if(e.target===this) ov.style.display='none'; };
    document.body.appendChild(ov);
  }

  // Đếm dữ liệu theo năm
  const yearStats = {};
  const allItems = [
    ...invoices.filter(i=>i.ngay&&!i.ccKey),
    ...invoices.filter(i=>i.ccKey)  // HĐ nhân công auto
  ];
  invoices.forEach(i=>{
    const y = i.ngay?i.ngay.slice(0,4):'?';
    if(!yearStats[y]) yearStats[y]={inv:0,ung:0,cc:0};
    yearStats[y].inv++;
  });
  ungRecords.forEach(u=>{
    const y = u.ngay?u.ngay.slice(0,4):'?';
    if(!yearStats[y]) yearStats[y]={inv:0,ung:0,cc:0};
    yearStats[y].ung++;
  });
  ccData.forEach(w=>{
    const y = w.fromDate?w.fromDate.slice(0,4):'?';
    if(!yearStats[y]) yearStats[y]={inv:0,ung:0,cc:0};
    yearStats[y].cc++;
  });

  const sortedYears = Object.keys(yearStats).filter(y=>y!=='?').sort((a,b)=>b-a);
  const curYr = activeYear===0 ? 'tat_ca' : String(activeYear);

  ov.innerHTML = `<div onclick="event.stopPropagation()" style="max-width:440px;width:95vw;background:#fff;border-radius:16px;padding:24px;font-family:'IBM Plex Sans',sans-serif;box-shadow:0 12px 48px rgba(0,0,0,.2);max-height:90vh;overflow-y:auto">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h3 style="font-size:16px;font-weight:800;margin:0">📤 Xuất Dữ Liệu Ra Excel</h3>
      <button onclick="document.getElementById('export-modal-overlay').style.display='none'" style="background:none;border:none;font-size:22px;cursor:pointer;color:#888">✕</button>
    </div>
    <div style="margin-bottom:14px">
      <label style="font-size:12px;font-weight:700;color:#444;display:block;margin-bottom:6px">Chọn năm xuất:</label>
      <select id="export-year-sel" style="width:100%;padding:9px 12px;border:1.5px solid #ddd;border-radius:8px;font-family:inherit;font-size:13px;font-weight:600;color:#1a1814;outline:none">
        <option value="0">📅 Tất cả năm</option>
        ${sortedYears.map(y=>`<option value="${y}" ${y===curYr?'selected':''}>${y} — ${yearStats[y].inv} HĐ, ${yearStats[y].ung} tiền ứng, ${yearStats[y].cc} tuần CC</option>`).join('')}
      </select>
    </div>
    <div style="background:#f0f4ff;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#333">
      <strong>File sẽ bao gồm:</strong><br>
      Sheet 1_HoaDon, 2_TienUng, 3_ChamCong, 4_ThietBi, 5_DanhMuc
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
  const yr = sel ? parseInt(sel.value)||0 : 0;
  document.getElementById('export-modal-overlay').style.display = 'none';

  // Filter theo năm
  const filterY = (dateStr) => yr===0 || (dateStr&&dateStr.startsWith(String(yr)));
  const expInv = invoices.filter(i=>filterY(i.ngay)&&!i.ccKey);
  const expUng = ungRecords.filter(u=>filterY(u.ngay));
  const expCC  = ccData.filter(w=>filterY(w.fromDate));
  const expTb  = tbData.filter(t=>filterY(t.ngay)||yr===0);

  // Build workbook bằng SheetJS
  const wb = XLSX.utils.book_new();

  // Sheet 1: HoaDon
  const inv_data = [['NGÀY','CÔNG TRÌNH','LOẠI CHI PHÍ','NỘI DUNG','ĐƠN GIÁ','SỐ LƯỢNG','THÀNH TIỀN','NGƯỜI TH','NHÀ CC','SỐ HĐ']];
  expInv.forEach(i=>inv_data.push([i.ngay||'',i.congtrinh||'',i.loai||'',i.nd||'',i.tien||0,i.sl||1,i.thanhtien||i.tien||0,i.nguoi||'',i.ncc||'',i.sohd||'']));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(inv_data), '1_HoaDon');

  // Sheet 2: TienUng
  const ung_data = [['NGÀY','CÔNG TRÌNH','THẦU PHỤ / NHÀ CC','SỐ TIỀN ỨNG','NỘI DUNG']];
  expUng.forEach(u=>ung_data.push([u.ngay||'',u.congtrinh||'',u.tp||'',u.tien||0,u.nd||'']));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ung_data), '2_TienUng');

  // Sheet 3: ChamCong (flatten)
  const cc_data = [['NGÀY ĐẦU TUẦN','CÔNG TRÌNH','TÊN CÔNG NHÂN','LƯƠNG/NGÀY','PHỤ CẤP','HĐ MUA LẺ','CN','T2','T3','T4','T5','T6','T7','GHI CHÚ']];
  expCC.forEach(w=>{
    (w.workers||[]).forEach(wk=>{
      const d = wk.d||[0,0,0,0,0,0,0];
      cc_data.push([w.fromDate||'',w.ct||'',wk.name||'',wk.luong||0,wk.phucap||0,wk.hdmuale||0,d[0]||0,d[1]||0,d[2]||0,d[3]||0,d[4]||0,d[5]||0,d[6]||0,wk.nd||'']);
    });
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cc_data), '3_ChamCong');

  // Sheet 4: ThietBi
  const tb_data = [['CÔNG TRÌNH','TÊN THIẾT BỊ','SỐ LƯỢNG','TÌNH TRẠNG','NGƯỜI PHỤ TRÁCH','NGÀY','GHI CHÚ']];
  expTb.forEach(t=>tb_data.push([t.ct||'',t.ten||'',t.soluong||1,t.tinhtrang||'',t.nguoi||'',t.ngay||'',t.ghichu||'']));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(tb_data), '4_ThietBi');

  // Sheet 5: DanhMuc
  const dm_data = [['CÔNG TRÌNH','NGƯỜI THỰC HIỆN','NHÀ CC / THẦU PHỤ','LOẠI CHI PHÍ']];
  const maxDm = Math.max(cats.congTrinh.length,cats.nguoiTH.length,cats.nhaCungCap.length,cats.loaiChiPhi.length);
  for(let i=0;i<maxDm;i++) dm_data.push([cats.congTrinh[i]||'',cats.nguoiTH[i]||'',cats.nhaCungCap[i]||'',cats.loaiChiPhi[i]||'']);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dm_data), '5_DanhMuc');

  const fname = yr===0 ? 'export_tat_ca_nam.xlsx' : `export_${yr}.xlsx`;
  XLSX.writeFile(wb, fname);
  toast(`✅ Đã xuất ${expInv.length} HĐ, ${expUng.length} tiền ứng, ${expCC.reduce((s,w)=>s+w.workers.length,0)} CN`, 'success');
}

// ══════════════════════════════════════════════════════════════
// XÓA DỮ LIỆU THEO NĂM / THEO LOẠI
// ══════════════════════════════════════════════════════════════

function openDeleteModal() {
  let ov = document.getElementById('delete-modal-overlay');
  if(!ov) {
    ov = document.createElement('div');
    ov.id = 'delete-modal-overlay';
    ov.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;align-items:center;justify-content:center';
    ov.onclick = function(e){ if(e.target===this) ov.style.display='none'; };
    document.body.appendChild(ov);
  }
  _renderDeleteModal();
}

function _renderDeleteModal() {
  const ov = document.getElementById('delete-modal-overlay');
  if(!ov) return;

  // Thống kê theo năm
  const yearStats = {};
  const addStat = (y, type) => {
    if(!y) return;
    if(!yearStats[y]) yearStats[y] = {inv:0, invAuto:0, ung:0, cc:0, tb:0};
    yearStats[y][type]++;
  };
  invoices.forEach(i=>{ const y=i.ngay?i.ngay.slice(0,4):'?'; addStat(y, i.ccKey?'invAuto':'inv'); });
  ungRecords.forEach(u=>addStat(u.ngay?u.ngay.slice(0,4):'?','ung'));
  ccData.forEach(w=>addStat(w.fromDate?w.fromDate.slice(0,4):'?','cc'));
  tbData.forEach(t=>addStat(t.ngay?t.ngay.slice(0,4):'?','tb'));

  const sortedYears = Object.keys(yearStats).filter(y=>y!=='?').sort((a,b)=>b-a);

  ov.innerHTML = `<div onclick="event.stopPropagation()" style="max-width:480px;width:95vw;background:#fff;border-radius:16px;padding:24px;font-family:'IBM Plex Sans',sans-serif;box-shadow:0 12px 48px rgba(0,0,0,.25);max-height:90vh;overflow-y:auto">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <h3 style="font-size:16px;font-weight:800;margin:0;color:#c0392b">🗑️ Xóa Dữ Liệu</h3>
      <button onclick="document.getElementById('delete-modal-overlay').style.display='none'" style="background:none;border:none;font-size:22px;cursor:pointer;color:#888">✕</button>
    </div>
    <p style="font-size:12px;color:#888;margin:0 0 16px">Chọn năm và loại dữ liệu cần xóa. Thao tác này không thể hoàn tác trừ khi bạn có backup.</p>

    <div style="margin-bottom:14px">
      <label style="font-size:12px;font-weight:700;color:#444;display:block;margin-bottom:6px">Chọn năm:</label>
      <select id="del-year-sel" onchange="_renderDeleteCheckboxes()" style="width:100%;padding:9px 12px;border:1.5px solid #ddd;border-radius:8px;font-family:inherit;font-size:13px;font-weight:600;color:#1a1814;outline:none">
        <option value="0">📅 Tất cả năm (xóa toàn bộ)</option>
        ${sortedYears.map(y=>{
          const s=yearStats[y];
          return `<option value="${y}">${y} — ${s.inv} HĐ tay + ${s.invAuto} HĐ auto + ${s.ung} tiền ứng + ${s.cc} tuần CC</option>`;
        }).join('')}
      </select>
    </div>

    <div id="del-checkboxes" style="background:#fef9f9;border:1.5px solid #f5c6cb;border-radius:8px;padding:12px;margin-bottom:14px">
      <!-- rendered by _renderDeleteCheckboxes -->
    </div>

    <div style="background:#fff3cd;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:12px;color:#856404">
      ⚠️ Sau khi xóa local sẽ tự động <strong>xóa luôn trên Firebase</strong> (nếu đã kết nối).
      Hãy Export backup trước nếu cần.
    </div>

    <div style="display:flex;gap:8px">
      <button onclick="document.getElementById('delete-modal-overlay').style.display='none'" style="flex:1;padding:11px;border-radius:8px;border:1.5px solid #ccc;background:#fff;font-family:inherit;font-size:13px;cursor:pointer">Huỷ</button>
      <button onclick="openExportModal();document.getElementById('delete-modal-overlay').style.display='none'" style="flex:1;padding:11px;border-radius:8px;border:none;background:#1a7a45;color:#fff;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer">📤 Export Trước</button>
      <button onclick="_confirmDelete()" style="flex:1;padding:11px;border-radius:8px;border:none;background:#c0392b;color:#fff;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer">🗑️ Xóa</button>
    </div>
  </div>`;

  _renderDeleteCheckboxes();
  ov.style.display = 'flex';
}

function _renderDeleteCheckboxes() {
  const box = document.getElementById('del-checkboxes');
  if(!box) return;
  const yr = parseInt(document.getElementById('del-year-sel')?.value)||0;

  const filterY = (dateStr) => yr===0 || (dateStr&&dateStr.startsWith(String(yr)));
  const cntInv  = invoices.filter(i=>filterY(i.ngay)&&!i.ccKey).length;
  const cntAuto = invoices.filter(i=>filterY(i.ngay)&&i.ccKey).length;
  const cntUng  = ungRecords.filter(u=>filterY(u.ngay)).length;
  const cntCC   = ccData.filter(w=>filterY(w.fromDate)).length;
  const cntTb   = tbData.filter(t=>filterY(t.ngay)||yr===0).length;

  const row = (id, label, cnt, color='#333') => cnt>0
    ? `<label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;border-bottom:1px solid #f0e0e0">
        <input type="checkbox" id="${id}" checked style="width:16px;height:16px;accent-color:#c0392b;cursor:pointer">
        <span style="font-size:12px;color:${color};flex:1">${label}</span>
        <span style="font-size:11px;font-weight:700;color:#c0392b;background:#fde8e8;padding:2px 8px;border-radius:10px">${cnt} mục</span>
       </label>`
    : `<div style="padding:5px 0;font-size:12px;color:#bbb;border-bottom:1px solid #f5f5f5">${label}: <em>không có dữ liệu</em></div>`;

  box.innerHTML = `
    ${row('del-inv',   '📋 Hóa Đơn (nhập tay)', cntInv)}
    ${row('del-auto',  '🤖 Hóa Đơn Nhân Công (tự động từ CC)', cntAuto, '#666')}
    ${row('del-ung',   '💰 Tiền Ứng', cntUng)}
    ${row('del-cc',    '👷 Chấm Công (tuần)', cntCC)}
    ${row('del-tb',    '🔧 Thiết Bị', cntTb)}
  `;
}

function _confirmDelete() {
  const yr = parseInt(document.getElementById('del-year-sel')?.value)||0;
  const delInv  = document.getElementById('del-inv')?.checked;
  const delAuto = document.getElementById('del-auto')?.checked;
  const delUng  = document.getElementById('del-ung')?.checked;
  const delCC   = document.getElementById('del-cc')?.checked;
  const delTb   = document.getElementById('del-tb')?.checked;

  if(!delInv && !delAuto && !delUng && !delCC && !delTb) {
    toast('⚠️ Chưa chọn loại dữ liệu nào!', 'error'); return;
  }

  const yrLabel = yr===0 ? 'TẤT CẢ NĂM' : String(yr);
  if(!confirm('Xác nhận XÓA dữ liệu năm ' + yrLabel + '?\nThao tác này không thể hoàn tác!')) return;

  document.getElementById('delete-modal-overlay').style.display = 'none';

  const filterY = (dateStr) => yr===0 || (dateStr&&dateStr.startsWith(String(yr)));
  let msg = [];

  if(delInv || delAuto) {
    const before = invoices.length;
    invoices = invoices.filter(i => {
      if(!filterY(i.ngay)) return true;
      if(delInv && !i.ccKey) return false;
      if(delAuto && i.ccKey) return false;
      return true;
    });
    save('inv_v3', invoices);
    msg.push(`${before-invoices.length} HĐ`);
  }
  if(delUng) {
    const before = ungRecords.length;
    ungRecords = ungRecords.filter(u=>!filterY(u.ngay));
    save('ung_v1', ungRecords);
    msg.push(`${before-ungRecords.length} tiền ứng`);
  }
  if(delCC) {
    const before = ccData.length;
    ccData = ccData.filter(w=>!filterY(w.fromDate));
    save('cc_v2', ccData);
    msg.push(`${before-ccData.length} tuần CC`);
  }
  if(delTb) {
    const before = tbData.length;
    tbData = tbData.filter(t=>yr===0 ? false : !filterY(t.ngay));
    save('tb_v1', tbData);
    msg.push(`${before-tbData.length} thiết bị`);
  }

  // Xóa trên Firebase
  if(fbReady()) {
    if(yr===0) {
      // Xóa toàn bộ — push data trống lên tất cả năm
      showSyncBanner('☁️ Đang xóa trên Firebase...');
      const years = new Set();
      [...invoices,...ungRecords,...ccData].forEach(i=>{
        const d=i.ngay||i.fromDate||''; if(d) years.add(parseInt(d.slice(0,4)));
      });
      if(!years.size) years.add(new Date().getFullYear());
      let pending=years.size;
      years.forEach(y=>{ fsSet(fbDocYear(y), fbYearPayload(y)).finally(()=>{ pending--; if(!pending) hideSyncBanner(); }); });
    } else {
      showSyncBanner('☁️ Đang cập nhật Firebase...');
      fsSet(fbDocYear(yr), fbYearPayload(yr)).then(()=>hideSyncBanner()).catch(()=>hideSyncBanner());
    }
    fsSet(fbDocCats(), fbCatsPayload()).catch(()=>{});
  }

  buildYearSelect();
  rebuildEntrySelects(); rebuildUngSelects();
  buildFilters(); filterAndRender(); renderTrash();
  renderCCHistory(); renderCCTLT();
  buildUngFilters(); filterAndRenderUng();
  renderCtPage(); updateTop();

  toast(`🗑️ Đã xóa: ${msg.join(', ')}`, 'success');
}


// ══════════════════════════════════════════════════════════════
