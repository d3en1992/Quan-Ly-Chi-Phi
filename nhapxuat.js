// io.js — Import / Export / Firebase / Delete Modal
// Load order: 5 (after danhmuc.js)

// ══════════════════════════════
// IMPORT / EXPORT
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
          id: uuid(), createdAt: Date.now(), updatedAt: Date.now(), deletedAt: null, deviceId: DEVICE_ID,
          ngay, congtrinh:ct, loai, nd:str(r[3]),
          tien, sl: num(r[5])||undefined,
          thanhtien: tien * (num(r[5])||1),
          nguoi:str(r[6]), ncc:str(r[7]), sohd:str(r[8]),
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
        result.ung.push({ id:uuid(), createdAt:Date.now(), updatedAt:Date.now(), deletedAt:null, deviceId:DEVICE_ID, ngay, congtrinh:ct, tp, tien, nd:str(r[4]) });
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
          weekMap[key] = { id:uuid(), createdAt:Date.now(), updatedAt:Date.now(), deletedAt:null, deviceId:DEVICE_ID, fromDate, toDate, ct, workers:[] };
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
        result.tb.push({ id:uuid(), createdAt:Date.now(), updatedAt:Date.now(), deletedAt:null, deviceId:DEVICE_ID,
          ct, ten, soluong: num(r[2])||1, tinhtrang: str(r[3])||'Đang hoạt động',
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

  // Merge vào localStorage + IDB (dùng mergeUnique để dedup theo id+updatedAt)
  const _importMerge = (key, incoming, assign) => {
    if (!incoming.length) return;
    const merged = mergeUnique(load(key, []), incoming);
    localStorage.setItem(key, JSON.stringify(merged));
    _dbSave(key, merged).catch(()=>{});
    if (assign) assign(load(key, []));
  };
  _importMerge('inv_v3', result.inv, v => { invoices    = v; });
  _importMerge('ung_v1', result.ung, v => { ungRecords  = v; });
  _importMerge('cc_v2',  result.cc,  v => { ccData      = v; });
  _importMerge('tb_v1',  result.tb,  v => { tbData      = v; });

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

  // Delegate sync lên cloud cho sync.js — pull-merge-push toàn bộ năm
  // Không gọi Firebase trực tiếp ở đây để tránh race condition với pull
  if (typeof processQueue === 'function') processQueue();
}


// ══════════════════════════════════════════════════════════════
// IMPORT / EXPORT (Excel modal)
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
// [Tính năng Xóa Dữ Liệu đã bị xóa — không dùng nữa]
// ══════════════════════════════════════════════════════════════

// placeholder — tính năng đã bị xóa
function openDeleteModal() {
  toast('Tính năng Xóa Dữ Liệu đã bị tắt.', 'error');
}

// ══════════════════════════════════════════════════════════════
// WRAPPERS (gọi từ HTML onclick)
// ══════════════════════════════════════════════════════════════
function toolExportJSON()  { exportJSON(); }
function toolImportJSON()  { document.getElementById('import-json-input').click(); }
function toolImportExcel() { document.getElementById('import-file-input').click(); }
// ══════════════════════════════════════════════════════════════
