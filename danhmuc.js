// danhmuc.js — CT Page / Settings / Danh Mục / Tiền Ứng
// Load order: 4 (after hoadon.js)

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
          cfg.id==='tbTen'     ? renderTbTenItem(item,idx) :
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

// ── Render item Thiết Bị (tbTen) ──────────────────────────────────
function renderTbTenItem(item, idx) {
  const inUse = typeof tbData !== 'undefined' && tbData.some(t => t.ten === item);
  return `<div class="settings-item" id="si-tbTen-${idx}" style="${inUse?'background:rgba(26,122,69,0.04)':''}">
    <span class="s-name" id="sn-tbTen-${idx}" ondblclick="startEdit('tbTen',${idx})">${x(item)}</span>
    ${inUse?`<span title="Đang được sử dụng" style="font-size:10px;color:#1a7a45;padding:2px 5px;background:rgba(26,122,69,0.1);border-radius:3px;margin-right:2px;flex-shrink:0">✓ đang dùng</span>`:''}
    <input class="s-edit-input" id="se-tbTen-${idx}" value="${x(item)}"
      onblur="finishEdit('tbTen',${idx})"
      onkeydown="if(event.key==='Enter')finishEdit('tbTen',${idx});if(event.key==='Escape')cancelEdit('tbTen',${idx})">
    <button class="btn btn-outline btn-sm btn-icon" onclick="startEdit('tbTen',${idx})" title="Sửa tên">✏️</button>
    <button class="btn ${inUse?'btn-outline':'btn-danger'} btn-sm btn-icon" onclick="delItem('tbTen',${idx})"
      title="${inUse?'Thiết bị đang được sử dụng — không thể xóa':'Xóa'}" ${inUse?'style="opacity:0.4;cursor:not-allowed"':''}>✕</button>
  </div>`;
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
  // tbTen: propagate rename to tbData
  if (catId === 'tbTen') {
    if (typeof tbData !== 'undefined') {
      tbData.forEach(t => { if (t.ten === old) t.ten = newVal; });
      save('tb_v1', tbData);
      try { tbRefreshNameDl(); tbPopulateSels(); tbRenderList(); renderKhoTong(); tbRenderThongKeVon(); } catch(e) {}
    }
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
  if (catId === 'tbTen') {
    try { tbRefreshNameDl(); tbPopulateSels(); } catch(e) {}
  }
  toast(`✅ Đã thêm "${val}"`,'success');
}
function isItemInUse(catId, item) {
  // tbTen — kiểm tra trong tbData
  if (catId === 'tbTen') return typeof tbData !== 'undefined' && tbData.some(t => t.ten === item);
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
    const msg = catId === 'tbTen'
      ? '⚠️ Thiết bị đang được sử dụng trong công trình — không thể xóa.'
      : '⚠️ Mục này đã có dữ liệu, không thể xóa.';
    toast(msg, 'error');
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
const UNG_TP_PG = 10;
const UNG_CN_PG = 5;
let ungTpPage = 1;
let ungCnPage = 1;

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
    const _now = Date.now();
    ungRecords.unshift({
      id: uuid(), createdAt: _now, updatedAt: _now, deletedAt: null, deviceId: DEVICE_ID,
      ngay: date,
      loai: (tr.querySelector('[data-f="loai"]')?.value||'thauphu'),
      tp,
      congtrinh: (tr.querySelector('[data-f="ct"]')?.value||'').trim(),
      tien,
      nd: (tr.querySelector('[data-f="nd"]')?.value||'').trim()
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
  const active = ungRecords.filter(r => !r.deletedAt && !r.cancelled);
  const tps    = [...new Set(active.map(i=>i.tp))].filter(Boolean).sort();
  const cts    = [...new Set(active.map(i=>i.congtrinh))].filter(Boolean).sort();
  const months = [...new Set(active.map(i=>i.ngay.slice(0,7)))].filter(Boolean).sort().reverse();

  const tpSel=document.getElementById('uf-tp'); const tv=tpSel.value;
  tpSel.innerHTML='<option value="">Tất cả TP/NCC</option>'+tps.map(v=>`<option ${v===tv?'selected':''} value="${x(v)}">${x(v)}</option>`).join('');
  const ctSel=document.getElementById('uf-ct'); const cv=ctSel.value;
  ctSel.innerHTML='<option value="">Tất cả công trình</option>'+cts.map(v=>`<option ${v===cv?'selected':''} value="${x(v)}">${x(v)}</option>`).join('');
  const mSel=document.getElementById('uf-month'); const mv=mSel.value;
  mSel.innerHTML='<option value="">Tất cả tháng</option>'+months.map(m=>`<option ${m===mv?'selected':''} value="${m}">${m}</option>`).join('');
}

function filterAndRenderUng() {
  ungPage=1; ungTpPage=1; ungCnPage=1;
  const q=document.getElementById('ung-search').value.toLowerCase();
  const fTp=document.getElementById('uf-tp').value;
  const fCt=document.getElementById('uf-ct').value;
  const fMonth=document.getElementById('uf-month').value;
  filteredUng = ungRecords.filter(r => {
    if(r.cancelled) return false;
    if(r.deletedAt) return false;
    if(!inActiveYear(r.ngay)) return false;
    if(fTp && r.tp!==fTp) return false;
    if(fCt && r.congtrinh!==fCt) return false;
    if(fMonth && !r.ngay.startsWith(fMonth)) return false;
    if(q) { const t=[r.ngay,r.tp,r.congtrinh,r.nd].join(' ').toLowerCase(); if(!t.includes(q)) return false; }
    return true;
  });
  renderUngTable();
}

function _ungSectionHTML(pagedRecs, allRecs, title, accentColor, curPage, pgSize, gotoFn) {
  if (!allRecs.length) return '';
  const mono = "font-family:'IBM Plex Mono',monospace";
  const sumSec = sumBy(allRecs, 'tien');
  const tp = Math.ceil(allRecs.length / pgSize);
  let pagHtml = '';
  if (tp > 1) {
    const btns = [];
    for (let p = 1; p <= Math.min(tp, 10); p++) {
      btns.push(`<button class="page-btn ${p===curPage?'active':''}" onclick="${gotoFn}(${p})">${p}</button>`);
    }
    pagHtml = `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-top:1px solid var(--line);background:#f3f1ec;font-size:12px;color:var(--ink2)">
      <span>${allRecs.length} dòng · <span style="${mono};font-weight:700;color:${accentColor}">${fmtS(sumSec)}</span></span>
      <div class="page-btns">${btns.join('')}</div>
    </div>`;
  }
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
        <tbody>${pagedRecs.map(r=>`<tr>
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
    ${pagHtml}
  </div>`;
}

function renderUngTable() {
  const container = document.getElementById('ung-all-sections');
  const allTp = filteredUng.filter(r => (r.loai||'thauphu') === 'thauphu');
  const allCn = filteredUng.filter(r => r.loai === 'congnhan');
  const sumTien = sumBy(filteredUng, 'tien');

  if (!allTp.length && !allCn.length) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--ink3);font-size:14px">Không có dữ liệu tiền ứng nào</div>`;
    document.getElementById('ung-pagination').innerHTML = ''; return;
  }

  const tpPaged = allTp.slice((ungTpPage-1)*UNG_TP_PG, ungTpPage*UNG_TP_PG);
  const cnPaged = allCn.slice((ungCnPage-1)*UNG_CN_PG, ungCnPage*UNG_CN_PG);

  container.innerHTML =
    _ungSectionHTML(tpPaged, allTp, 'Thầu Phụ / Nhà Cung Cấp', 'var(--gold)', ungTpPage, UNG_TP_PG, 'goUngTpTo') +
    _ungSectionHTML(cnPaged, allCn, 'Công Nhân', 'var(--blue)', ungCnPage, UNG_CN_PG, 'goUngCnTo');

  const mono = "font-family:'IBM Plex Mono',monospace";
  document.getElementById('ung-pagination').innerHTML =
    `<span>${filteredUng.length} bản ghi · Tổng tiền ứng: <strong style="color:var(--blue);${mono}">${fmtS(sumTien)}</strong></span>`;
}

function goUngTo(p) { ungPage=p; renderUngTable(); }
function goUngTpTo(p) { ungTpPage=p; renderUngTable(); }
function goUngCnTo(p) { ungCnPage=p; renderUngTable(); }

function delUngRecord(id) {
  const idx = ungRecords.findIndex(r=>String(r.id)===String(id));
  if(idx<0) return;
  if(!confirm('Hủy bản ghi tiền ứng này?\n(Lịch sử sẽ được giữ lại với trạng thái "Đã hủy")')) return;
  ungRecords[idx] = { ...ungRecords[idx], cancelled: true, updatedAt: Date.now(), deviceId: DEVICE_ID };
  save('ung_v1',ungRecords); buildUngFilters(); filterAndRenderUng(); _refreshAllTabs();
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

// ══════════════════════════════════════════════════════════════
// WRAPPERS (gọi từ HTML onclick)
// ══════════════════════════════════════════════════════════════
function toolBackupNow() {
  _snapshotNow('manual');
  renderBackupList();
  toast('✅ Đã tạo bản sao lưu thủ công', 'success');
}
function toolRestoreBackup() {
  renderBackupList();
  const wrap = document.getElementById('backup-list-wrap');
  if (wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
// ══════════════════════════════════════════════════════════════
