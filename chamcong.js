// chamcong.js — Cham Cong / Phieu Luong
// Load order: 4


// ══════════════════════════════════════════════════════════════════
//  SỔ CHẤM CÔNG v3
//  worker: { name, luong, d:[CN,T2,T3,T4,T5,T6,T7], phucap, hdmuale, nd }
// ══════════════════════════════════════════════════════════════════
let ccData   = load('cc_v2', []);
let ccOffset = 0;

// Tự động rebuild HĐ nhân công nếu có CC data mà thiếu HĐ (gọi sau khi mọi data đã load)
function autoRebuildCCIfNeeded() {
  if (!ccData.length) return;

  // Bước 1: Xóa HĐ auto bị lỗi ngay='' (do import cũ thiếu toDate)
  const badInvs = invoices.filter(i => i.ccKey && !i.ngay);
  if (badInvs.length > 0) {
    invoices = invoices.filter(i => !(i.ccKey && !i.ngay));
    save('inv_v3', invoices);
    console.log('[autoRebuild] Cleared', badInvs.length, 'bad invs (ngay empty)');
  }

  // Bước 2: Tìm các tuần CC chưa có HĐ tương ứng trong invoices
  let totalFixed = 0;
  ccData.forEach(week => {
    const { fromDate, ct, workers } = week;
    if(!fromDate || !ct || !workers || !workers.length) return;
    const weekPrefix = 'cc|' + fromDate + '|' + ct + '|';
    const ncKey = weekPrefix + 'nhanCong';

    // Nếu tuần này đã có HĐ nhân công → bỏ qua
    if(invoices.some(i => i.ccKey === ncKey)) return;

    // Tính toDate
    let toDate = week.toDate;
    if(!toDate) {
      try {
        const [y,m,d] = fromDate.split('-').map(Number);
        const sat = new Date(y, m-1, d+6);
        toDate = sat.getFullYear() + '-' +
          String(sat.getMonth()+1).padStart(2,'0') + '-' +
          String(sat.getDate()).padStart(2,'0');
      } catch(e) { toDate = fromDate; }
    }

    // Tạo HĐ mua lẻ còn thiếu
    workers.forEach(wk => {
      if(!wk.hdmuale || wk.hdmuale <= 0) return;
      const key = weekPrefix + wk.name + '|hdml';
      if(invoices.some(i => i.ccKey === key)) return;
      invoices.unshift({
        id: Date.now() + Math.random(), ccKey: key,
        ngay: toDate, congtrinh: ct, loai: 'Hóa Đơn Lẻ',
        nguoi: wk.name, ncc: '',
        nd: wk.nd || ('HĐ mua lẻ – ' + wk.name + ' (' + viShort(fromDate) + '–' + viShort(toDate) + ')'),
        tien: wk.hdmuale, thanhtien: wk.hdmuale, _ts: Date.now()
      });
    });

    // Tạo HĐ nhân công
    const totalLuong = workers.reduce((s, wk) => {
      const tc = (wk.d || []).reduce((a, v) => a + (v || 0), 0);
      return s + tc * (wk.luong || 0) + (wk.phucap || 0);
    }, 0);
    if(totalLuong > 0) {
      const firstWorker = (workers.find(w => w.name) || {name:''}).name;
      invoices.unshift({
        id: Date.now() + Math.random(), ccKey: ncKey,
        ngay: toDate, congtrinh: ct, loai: 'Nhân Công',
        nguoi: firstWorker, ncc: '',
        nd: 'Lương tuần ' + viShort(fromDate) + '–' + viShort(toDate),
        tien: totalLuong, thanhtien: totalLuong, _ts: Date.now()
      });
      totalFixed++;
    }
  });

  if(totalFixed > 0 || badInvs.length > 0) {
    save('inv_v3', invoices);
    console.log('[autoRebuild] Fixed ' + totalFixed + ' missing weeks, cleared ' + badInvs.length + ' bad');
  }
}
let ccHistPage = 1, ccTltPage = 1;
const CC_PG_HIST = 30;
const CC_PG_TLT = 20;
const CC_DAY_LABELS   = ['CN','T2','T3','T4','T5','T6','T7'];
const CC_DATE_OFFSETS = [0,1,2,3,4,5,6]; // offset from Sunday (week starts Sunday)

// ─── date helpers ───────────────────────────────────────────────
// Tuần: CN (Sun) → T7 (Sat). iso date string là YYYY-MM-DD.
// Tránh timezone bug: dùng local date parts, không dùng toISOString cho date-only

function isoFromParts(y,m,d){ return y+'-'+(m<10?'0':'')+m+'-'+(d<10?'0':'')+d; }

// Trả về iso string của CN (Sunday) cho tuần cách tuần hiện tại offset tuần
function ccSundayISO(offset=0){
  const now = new Date();
  const y=now.getFullYear(), mo=now.getMonth(), d=now.getDate();
  const jsDay=now.getDay(); // 0=Sun,1=Mon,...,6=Sat
  // Tìm Sunday của tuần hiện tại
  const sunD = new Date(y, mo, d - jsDay + offset*7);
  return isoFromParts(sunD.getFullYear(), sunD.getMonth()+1, sunD.getDate());
}

// Trả về iso string của T7 (Saturday) = CN + 6
function ccSaturdayISO(sundayISO){
  const [y,m,d]=sundayISO.split('-').map(Number);
  const sat=new Date(y,m-1,d+6);
  return isoFromParts(sat.getFullYear(),sat.getMonth()+1,sat.getDate());
}

// Snap bất kỳ ngày → CN của tuần chứa ngày đó
function snapToSunday(dateISO){
  const [y,m,d]=dateISO.split('-').map(Number);
  const dt=new Date(y,m-1,d);
  const jsDay=dt.getDay(); // 0=Sun
  const sun=new Date(y,m-1,d-jsDay);
  return isoFromParts(sun.getFullYear(),sun.getMonth()+1,sun.getDate());
}

function viShort(ds){
  const [y,m,d]=ds.split('-').map(Number);
  return (d<10?'0':'')+d+'/'+(m<10?'0':'')+m;
}
function weekLabel(sundayISO){
  const satISO=ccSaturdayISO(sundayISO);
  const y=sundayISO.split('-')[0];
  return viShort(sundayISO)+'–'+viShort(satISO)+'/'+y;
}

// iso() vẫn giữ để dùng chỗ khác nếu cần
function iso(d){ return d.toISOString().split('T')[0]; }

// ─── all worker names for autocomplete ──────────────────────────
function ccAllNames(){
  const s=new Set();
  ccData.forEach(w=>w.workers.forEach(wk=>{ if(wk.name) s.add(wk.name); }));
  cats.nguoiTH.forEach(n=>s.add(n));
  return [...s].sort();
}

// build/update the shared datalist for name autocomplete
function rebuildCCNameList(){
  let dl=document.getElementById('cc-name-dl');
  if(!dl){ dl=document.createElement('datalist'); dl.id='cc-name-dl'; document.body.appendChild(dl); }
  dl.innerHTML=ccAllNames().map(n=>`<option value="${x(n)}">`).join('');
}

// ─── init ────────────────────────────────────────────────────────
function initCC(){
  ccOffset=0;
  ccGoToWeek(0);
  populateCCCtSel();
  rebuildCCNameList();
}

function ccGoToWeek(off){
  ccOffset=off;
  const sunISO=ccSundayISO(off);
  const satISO=ccSaturdayISO(sunISO);
  document.getElementById('cc-from').value=sunISO;
  document.getElementById('cc-to').value=satISO;
  document.getElementById('cc-week-label').textContent='Tuần: '+weekLabel(sunISO);
  loadCCWeekForm();
}
function ccPrevWeek(){ ccGoToWeek(ccOffset-1); }
function ccNextWeek(){ ccGoToWeek(ccOffset+1); }

function onCCFromChange(){
  const raw=document.getElementById('cc-from').value; if(!raw) return;
  // Snap bất kỳ ngày được chọn về CN của tuần đó
  const sunISO=snapToSunday(raw);
  const satISO=ccSaturdayISO(sunISO);
  document.getElementById('cc-from').value=sunISO;
  document.getElementById('cc-to').value=satISO;
  document.getElementById('cc-week-label').textContent='Tuần: '+weekLabel(sunISO);
  // Tính lại offset so với tuần hiện tại
  const thisSun=ccSundayISO(0);
  const [ty,tm,td]=thisSun.split('-').map(Number);
  const [fy,fm,fd]=sunISO.split('-').map(Number);
  const diffMs=new Date(fy,fm-1,fd)-new Date(ty,tm-1,td);
  ccOffset=Math.round(diffMs/(7*86400000));
  loadCCWeekForm();
}

function loadCCWeekForm(){
  const f=document.getElementById('cc-from').value;
  const ct=document.getElementById('cc-ct-sel').value;
  // Try to find saved data for this week+ct
  const rec=ccData.find(w=>w.fromDate===f&&w.ct===ct);
  if(rec){
    buildCCTable(rec.workers);
  } else if(ct){
    // Auto-copy workers from most recent week of same CT (names+luong only, clear days/extra)
    const prev=ccData.filter(w=>w.ct===ct&&w.fromDate<f).sort((a,b)=>b.fromDate.localeCompare(a.fromDate))[0];
    if(prev){
      const stub=prev.workers.map(wk=>({name:wk.name,luong:wk.luong,d:[0,0,0,0,0,0,0],phucap:0,hdmuale:0,nd:''}));
      buildCCTable(stub);
    } else {
      buildCCTable([]);
    }
  } else {
    buildCCTable([]);
  }
}

// ─── build table ─────────────────────────────────────────────────
function buildCCTable(workers){
  const fromStr=document.getElementById('cc-from').value;
  const thead=document.getElementById('cc-thead-row');
  const dates=CC_DATE_OFFSETS.map(off=>{
    if(!fromStr) return '';
    const d=new Date(fromStr+'T00:00:00'); d.setDate(d.getDate()+off);
    return d.getDate()+'/'+(d.getMonth()+1);
  });
  const BG='background:#eeece7;color:var(--ink)';
  thead.innerHTML=`
    <th class="col-num">#</th>
    <th class="cc-sticky-name col-name">Tên Công Nhân</th>
    <th class="col-tp" style="text-align:center">T/P</th>
    ${CC_DAY_LABELS.map((l,i)=>`<th class="cc-day-header col-day">${l}<br><span style="font-size:9px;font-weight:400;color:var(--ink2)">${dates[i]}</span></th>`).join('')}
    <th class="col-tc" style="text-align:center;${BG}">TC</th>
    <th class="col-luong" style="text-align:right;${BG}">Lương/Ngày</th>
    <th class="col-total-luong" style="text-align:right;${BG}">Tổng Lương</th>
    <th class="col-phucap" style="text-align:right;${BG}">Phụ Cấp</th>
    <th class="col-hdml" style="text-align:right;${BG}">HĐ Mua Lẻ</th>
    <th class="col-nd" style="${BG}">Nội Dung</th>
    <th class="col-total cc-sticky-total" style="text-align:right;background:#c8870a;color:#fff;font-weight:700">Tổng Cộng</th>
    <th class="col-del" style="${BG}"></th>
  `;
  const tbody=document.getElementById('cc-tbody');
  tbody.innerHTML='';
  const minRows=Math.max((workers||[]).length,8);
  for(let i=0;i<minRows;i++) addCCRow((workers||[])[i]||null);
  updateCCSumRow();
}

function addCCWorker(){
  const tbody=document.getElementById('cc-tbody');
  const sumRow=tbody.querySelector('.cc-sum-row');
  const nr=buildCCRow(null, tbody.querySelectorAll('tr:not(.cc-sum-row)').length+1);
  tbody.insertBefore(nr,sumRow||null);
  renumberCC(); updateCCSumRow();
  nr.querySelector('.cc-name-input')?.focus();
}

function addCCRow(w){
  const tbody=document.getElementById('cc-tbody');
  const num=tbody.querySelectorAll('tr:not(.cc-sum-row)').length+1;
  tbody.appendChild(buildCCRow(w,num));
}

function buildCCRow(w,num){
  const tr=document.createElement('tr');
  const ds=w?w.d:[0,0,0,0,0,0,0];
  const luong=w?(w.luong||0):0;
  const phucap=w?(w.phucap||0):0;
  const hdml=w?(w.hdmuale||0):0;
  const role=w?.role||(w?.name?cnRoles[w.name]||'':'');
  const isKnown=w?.name?cats.congNhan.some(n=>n.toLowerCase()===(w.name||'').toLowerCase()):false;

  tr.innerHTML=`
    <td class="row-num col-num">${num}</td>
    <td class="cc-sticky-name col-name" style="padding:0">
      <input class="cc-name-input" data-cc="name" list="cc-name-dl"
        value="${x(w?w.name||'':''||'')}" placeholder="Tên..."
        oninput="onCCNameInput(this)">
    </td>
    <td class="col-tp" style="padding:0">
      <select data-cc="tp" ${isKnown?'disabled':''} style="width:100%;border:none;background:transparent;padding:5px 4px;font-size:12px;font-weight:700;outline:none;color:var(--ink);${isKnown?'opacity:0.65;cursor:not-allowed':'cursor:pointer'}">
        <option value="">—</option>
        <option value="C" ${role==='C'?'selected':''}>C</option>
        <option value="T" ${role==='T'?'selected':''}>T</option>
        <option value="P" ${role==='P'?'selected':''}>P</option>
      </select>
    </td>
    ${ds.map((v,i)=>`<td class="col-day" style="padding:0"><input class="cc-day-input ${v===1?'has-val':v>0&&v<1?'half-val':''}"
      data-cc="d${i}" value="${v||''}" placeholder="·" autocomplete="off" inputmode="decimal"
      oninput="onCCDayKey(this)"></td>`).join('')}
    <td class="cc-tc-cell col-tc" data-cc="tc">0</td>
    <td class="col-luong" style="padding:0"><input class="cc-wage-input" data-cc="luong" data-raw="${luong||''}" inputmode="decimal"
      value="${luong?numFmt(luong):''}" placeholder="0" oninput="onCCWageKey(this)"></td>
    <td class="cc-total-cell col-total-luong" data-cc="total">—</td>
    <td class="col-phucap" style="padding:0"><input class="cc-wage-input" data-cc="phucap" data-raw="${phucap||''}" inputmode="decimal"
      value="${phucap?numFmt(phucap):''}" placeholder="0" oninput="onCCMoneyKey(this)"></td>
    <td class="col-hdml" style="padding:0"><input class="cc-wage-input" data-cc="hdml" data-raw="${hdml||''}" inputmode="decimal"
      value="${hdml?numFmt(hdml):''}" placeholder="0" oninput="onCCMoneyKey(this)"></td>
    <td class="col-nd" style="padding:0"><input class="cc-name-input" data-cc="nd"
      value="${x(w?w.nd||'':''||'')}" placeholder="Nội dung..."
      style="font-size:11px" oninput="updateCCSumRow()"></td>
    <td class="cc-total-cell col-total cc-sticky-total" data-cc="tongcong" style="color:var(--gold);font-size:13px">—</td>
    <td class="col-del"><button class="del-btn" onclick="delCCRow(this)">✕</button></td>
  `;
  tr.querySelectorAll('[data-cc^="d"]').forEach(el=>el.addEventListener('input',()=>{ onCCDayKey(el); updateCCSumRow(); }));
  tr.querySelector('[data-cc="luong"]').addEventListener('input',function(){ onCCWageKey(this); updateCCSumRow(); });
  tr.querySelector('[data-cc="phucap"]').addEventListener('input',function(){ onCCMoneyKey(this); updateCCSumRow(); });
  tr.querySelector('[data-cc="hdml"]').addEventListener('input',function(){ onCCMoneyKey(this); updateCCSumRow(); });
  tr.querySelector('[data-cc="name"]').addEventListener('input',updateCCSumRow);
  tr.querySelector('[data-cc="nd"]').addEventListener('input',updateCCSumRow);
  calcCCRow(tr);
  return tr;
}

function onCCNameInput(inp){
  const name=inp.value.trim();
  if(!name){ inp.style.boxShadow=''; inp.title=''; return; }
  // Chống trùng tên không phân biệt hoa thường
  const nameLower=name.toLowerCase();
  let count=0;
  document.querySelectorAll('#cc-tbody [data-cc="name"]').forEach(el=>{ if(el.value.trim().toLowerCase()===nameLower) count++; });
  if(count>1){
    inp.style.boxShadow='inset 0 0 0 2px var(--red)';
    inp.title='⚠️ Tên trùng! Vui lòng đổi tên để phân biệt.';
    toast('⚠️ Tên "'+name+'" bị trùng – hãy đổi tên để tránh nhầm lẫn!','error');
  } else {
    inp.style.boxShadow='';
    inp.title='';
  }
  // Auto-fill T/P nếu thợ đã có trong danh mục
  const tr=inp.closest('tr');
  if(!tr) return;
  const tpSel=tr.querySelector('[data-cc="tp"]');
  if(!tpSel) return;
  const known=cats.congNhan.find(n=>n.toLowerCase()===nameLower);
  if(known){
    tpSel.value=cnRoles[known]||'';
    tpSel.disabled=true;
    tpSel.style.opacity='0.65';
    tpSel.style.cursor='not-allowed';
  } else {
    tpSel.disabled=false;
    tpSel.style.opacity='1';
    tpSel.style.cursor='pointer';
  }
}

function onCCDayKey(inp){
  const n=parseFloat(inp.value.replace(',','.'))||0;
  inp.classList.toggle('has-val',n===1);
  inp.classList.toggle('half-val',n>0&&n<1);
  calcCCRow(inp.closest('tr'));
}
function onCCWageKey(inp){
  const raw=inp.value.replace(/\./g,'').replace(/,/g,'');
  inp.dataset.raw=raw;
  if(raw) inp.value=numFmt(parseInt(raw)||0);
  calcCCRow(inp.closest('tr'));
}
function onCCMoneyKey(inp){
  const raw=inp.value.replace(/\./g,'').replace(/,/g,'');
  inp.dataset.raw=raw;
  if(raw) inp.value=numFmt(parseInt(raw)||0);
  calcCCRow(inp.closest('tr'));
}

function calcCCRow(tr){
  let tc=0;
  for(let i=0;i<7;i++) tc+=parseFloat(tr.querySelector(`[data-cc="d${i}"]`)?.value||0)||0;
  tr.querySelector('[data-cc="tc"]').textContent=tc||0;
  const luong=parseInt(tr.querySelector('[data-cc="luong"]')?.dataset?.raw||0)||0;
  const total=tc*luong;
  const phucap=parseInt(tr.querySelector('[data-cc="phucap"]')?.dataset?.raw||0)||0;
  const hdml  =parseInt(tr.querySelector('[data-cc="hdml"]')?.dataset?.raw||0)||0;
  const tongcong=total+phucap+hdml;
  const totCell=tr.querySelector('[data-cc="total"]');
  totCell.textContent=total>0?numFmt(total):'—';
  totCell.style.color=total>0?'var(--green)':'var(--ink3)';
  const tcCell=tr.querySelector('[data-cc="tongcong"]');
  tcCell.textContent=tongcong>0?numFmt(tongcong):'—';
  tcCell.style.color=tongcong>0?'var(--gold)':'var(--ink3)';
}

function delCCRow(btn){ btn.closest('tr').remove(); renumberCC(); updateCCSumRow(); }
function renumberCC(){
  document.querySelectorAll('#cc-tbody tr:not(.cc-sum-row)').forEach((tr,i)=>tr.querySelector('.row-num').textContent=i+1);
}

function updateCCSumRow(){
  const rows=document.querySelectorAll('#cc-tbody tr:not(.cc-sum-row)');
  const dayT=new Array(7).fill(0);
  let tc=0,totalLuong=0,totalPC=0,totalHD=0,totalTC=0;
  rows.forEach(tr=>{
    for(let i=0;i<7;i++) dayT[i]+=parseFloat(tr.querySelector(`[data-cc="d${i}"]`)?.value||0)||0;
    const t=parseFloat(tr.querySelector('[data-cc="tc"]')?.textContent||0)||0;
    tc+=t;
    const l=parseInt(tr.querySelector('[data-cc="luong"]')?.dataset?.raw||0)||0;
    const pc=parseInt(tr.querySelector('[data-cc="phucap"]')?.dataset?.raw||0)||0;
    const hd=parseInt(tr.querySelector('[data-cc="hdml"]')?.dataset?.raw||0)||0;
    totalLuong+=t*l; totalPC+=pc; totalHD+=hd;
    totalTC+=t*l+pc+hd;
  });
  let sumRow=document.querySelector('#cc-tbody .cc-sum-row');
  if(!sumRow){ sumRow=document.createElement('tr'); sumRow.className='cc-sum-row'; document.getElementById('cc-tbody').appendChild(sumRow); }
  const mono="font-family:'IBM Plex Mono',monospace;font-weight:700";
  sumRow.innerHTML=`
    <td class="row-num col-num" style="font-size:10px;font-weight:700;color:var(--ink2)">∑</td>
    <td class="cc-sticky-name col-name" style="padding:7px 10px;font-size:10px;font-weight:700;color:var(--ink2);text-transform:uppercase;letter-spacing:.5px">TỔNG</td>
    <td class="col-tp"></td>
    ${dayT.map(v=>`<td class="col-day" style="text-align:center;${mono};font-size:12px;color:var(--ink2);padding:6px 4px">${v||''}</td>`).join('')}
    <td class="col-tc" style="text-align:center;${mono};font-size:14px;color:var(--gold);padding:6px 8px">${tc}</td>
    <td class="col-luong"></td>
    <td class="col-total-luong" style="text-align:right;${mono};font-size:13px;color:var(--green);padding:6px 8px;white-space:nowrap">${totalLuong>0?numFmt(totalLuong):'—'}</td>
    <td class="col-phucap" style="text-align:right;${mono};font-size:12px;color:var(--blue);padding:6px 8px;white-space:nowrap">${totalPC>0?numFmt(totalPC):'—'}</td>
    <td class="col-hdml" style="text-align:right;${mono};font-size:12px;color:var(--ink2);padding:6px 8px;white-space:nowrap">${totalHD>0?numFmt(totalHD):'—'}</td>
    <td class="col-nd"></td>
    <td class="col-total cc-sticky-total" style="text-align:right;${mono};font-size:14px;color:var(--gold);padding:6px 8px;white-space:nowrap;background:#fff8e8">${totalTC>0?numFmt(totalTC):'—'}</td>
    <td class="col-del"></td>
  `;
  document.getElementById('cc-sum-tc').textContent=tc;
  document.getElementById('cc-sum-luong').textContent=fmtM(totalLuong);
  document.getElementById('cc-sum-tongcong').textContent=fmtM(totalTC);
}

// ─── save ─────────────────────────────────────────────────────────
// Helper: upsert an invoice by ccKey (create or update in-place)
function ccUpsertInvoice(ccKey, invData){
  const idx=invoices.findIndex(i=>i.ccKey===ccKey);
  if(idx>=0){ Object.assign(invoices[idx], invData); }
  else { invoices.unshift({id:Date.now()+Math.random(), ccKey, ...invData}); }
}
// Helper: remove invoices matching a ccKey prefix
function ccRemoveInvoicesByKeyPrefix(prefix){
  invoices=invoices.filter(i=>!i.ccKey||!i.ccKey.startsWith(prefix));
}

// ── Tự động tạo hóa đơn + cập nhật danh mục từ toàn bộ ccData ───────
// Gọi sau khi import/sync để không cần lưu từng tuần thủ công
function rebuildInvoicesFromCC() {
  // Xóa toàn bộ hóa đơn tự động từ CC cũ (có ccKey)
  invoices = invoices.filter(i => !i.ccKey);

  let totalWeeks = 0, totalHdml = 0;

  // ── Tự động thêm công trình mới vào danh mục ──────────────────────
  const newCTs = [...new Set(ccData.map(w => w.ct).filter(Boolean))];
  let addedCTs = 0;
  newCTs.forEach(ct => {
    if (!cats.congTrinh.includes(ct)) {
      cats.congTrinh.push(ct);
      addedCTs++;
    }
  });
  if (addedCTs > 0) {
    cats.congTrinh.sort();
    localStorage.setItem('cat_ct', JSON.stringify(cats.congTrinh));
  }

  // ── Tự động thêm tên công nhân vào danh mục Người TH ─────────────
  const allWorkerNames = [...new Set(
    ccData.flatMap(w => (w.workers || []).map(wk => wk.name).filter(Boolean))
  )];
  let addedNames = 0;
  allWorkerNames.forEach(name => {
    if (!cats.nguoiTH.includes(name)) {
      cats.nguoiTH.push(name);
      addedNames++;
    }
  });
  if (addedNames > 0) {
    cats.nguoiTH.sort();
    localStorage.setItem('cat_nguoi', JSON.stringify(cats.nguoiTH));
  }

  // ── Tự động thêm tên TP/NCC từ tiền ứng vào danh mục Thầu Phụ ────
  const allTPs = [...new Set(ungRecords.map(r => r.tp).filter(Boolean))];
  let addedTPs = 0;
  allTPs.forEach(tp => {
    if (!cats.thauPhu.includes(tp)) {
      cats.thauPhu.push(tp);
      addedTPs++;
    }
  });
  if (addedTPs > 0) {
    cats.thauPhu.sort();
    localStorage.setItem('cat_tp', JSON.stringify(cats.thauPhu));
  }

  // ── Tự động thêm tên công nhân vào danh mục Công Nhân ───────────
  allWorkerNames.forEach(name => {
    if (!cats.congNhan.includes(name)) {
      cats.congNhan.push(name);
    }
  });
  if (cats.congNhan.length > 0) {
    cats.congNhan.sort();
    localStorage.setItem('cat_cn', JSON.stringify(cats.congNhan));
  }

  // ── Tạo hóa đơn từ chấm công ──────────────────────────────────────
  ccData.forEach(week => {
    const { fromDate, ct, workers } = week;
    if (!fromDate || !ct || !workers || !workers.length) return;
    const weekPrefix = 'cc|' + fromDate + '|' + ct + '|';

    // Tính toDate từ fromDate nếu trống (fromDate=CN, toDate=T7 = +6 ngày)
    let toDate = week.toDate;
    if (!toDate) {
      try {
        const [y,m,d] = fromDate.split('-').map(Number);
        const sat = new Date(y, m-1, d+6);
        toDate = sat.getFullYear() + '-' +
          String(sat.getMonth()+1).padStart(2,'0') + '-' +
          String(sat.getDate()).padStart(2,'0');
      } catch(e) { toDate = fromDate; }
    }

    // HĐ Mua Lẻ — 1 HĐ mỗi worker có hdmuale > 0
    workers.forEach(wk => {
      if (!wk.hdmuale || wk.hdmuale <= 0) return;
      const key = weekPrefix + wk.name + '|hdml';
      ccUpsertInvoice(key, {
        ngay: toDate, congtrinh: ct, loai: 'Hóa Đơn Lẻ',
        nguoi: wk.name, ncc: '',
        nd: wk.nd || ('HĐ mua lẻ – ' + wk.name + ' (' + viShort(fromDate) + '–' + viShort(toDate) + ')'),
        tien: wk.hdmuale, thanhtien: wk.hdmuale
      });
      totalHdml++;
    });

    // HĐ Nhân Công — 1 HĐ mỗi tuần+ct
    const totalLuong = workers.reduce((s, wk) => {
      const tc = (wk.d || []).reduce((a, v) => a + (v || 0), 0);
      return s + tc * (wk.luong || 0) + (wk.phucap || 0);
    }, 0);

    if (totalLuong > 0) {
      const ncKey = weekPrefix + 'nhanCong';
      const firstWorker = (workers.find(w => w.name) || { name: '' }).name;
      ccUpsertInvoice(ncKey, {
        ngay: toDate, congtrinh: ct, loai: 'Nhân Công',
        nguoi: firstWorker, ncc: '',
        nd: 'Lương tuần ' + viShort(fromDate) + '–' + viShort(toDate),
        tien: totalLuong, thanhtien: totalLuong
      });
      totalWeeks++;
    }
  });

  save('inv_v3', invoices);
  updateTop();
  return { weeks: totalWeeks, hdml: totalHdml, cts: addedCTs, names: addedNames };
}

function saveCCWeek(){
  const fromDate=document.getElementById('cc-from').value;
  const toDate  =document.getElementById('cc-to').value;
  const ct      =document.getElementById('cc-ct-sel').value;
  if(!fromDate){ toast('Chọn ngày bắt đầu tuần!','error'); return; }
  if(!ct){ toast('Chọn công trình!','error'); return; }

  // check duplicate names (không phân biệt hoa thường)
  const names=[];
  let dupFound=false;
  document.querySelectorAll('#cc-tbody tr:not(.cc-sum-row) [data-cc="name"]').forEach(el=>{
    const n=el.value.trim();
    const nL=n.toLowerCase();
    if(n&&names.includes(nL)){ dupFound=true; el.style.boxShadow='inset 0 0 0 2px var(--red)'; }
    else if(n) names.push(nL);
  });
  if(dupFound){ toast('⚠️ Còn tên trùng nhau! Sửa trước khi lưu.','error'); return; }

  const workers=[];
  document.querySelectorAll('#cc-tbody tr:not(.cc-sum-row)').forEach(tr=>{
    const name=tr.querySelector('[data-cc="name"]')?.value?.trim()||'';
    const luong=parseInt(tr.querySelector('[data-cc="luong"]')?.dataset?.raw||0)||0;
    const phucap=parseInt(tr.querySelector('[data-cc="phucap"]')?.dataset?.raw||0)||0;
    const hdmuale=parseInt(tr.querySelector('[data-cc="hdml"]')?.dataset?.raw||0)||0;
    const nd=(tr.querySelector('[data-cc="nd"]')?.value?.trim()||'');
    const role=tr.querySelector('[data-cc="tp"]')?.value||'';
    const d=[];
    for(let i=0;i<7;i++) d.push(parseFloat(tr.querySelector(`[data-cc="d${i}"]`)?.value||0)||0);
    if(name||d.some(v=>v>0)) workers.push({name,luong,d,phucap,hdmuale,nd,role});
  });
  if(!workers.length){ toast('Chưa có công nhân nào!','error'); return; }

  // Save CC data
  ccData=ccData.filter(w=>!(w.fromDate===fromDate&&w.ct===ct));
  ccData.unshift({id:Date.now(), fromDate, toDate, ct, workers});
  save('cc_v2',ccData);

  // ── Tự động thêm tên mới + vai trò vào danh mục Công Nhân ───────
  let cnUpdated=false;
  workers.forEach(wk=>{
    if(!wk.name) return;
    const known=cats.congNhan.find(n=>n.toLowerCase()===wk.name.toLowerCase());
    if(!known){ cats.congNhan.push(wk.name); cnUpdated=true; }
    if(wk.role && !cnRoles[wk.name]){ cnRoles[wk.name]=wk.role; cnUpdated=true; }
  });
  if(cnUpdated){ cats.congNhan.sort(); save('cat_cn',cats.congNhan); save('cat_cn_roles',cnRoles); }

  // ── UPSERT HĐ Mua Lẻ to invoices (one per worker with hdmuale > 0) ──
  // First, remove old hdml invoices for workers no longer having hdmuale
  const weekPrefix='cc|'+fromDate+'|'+ct+'|';
  // Remove hdml keys for workers not in current list or with 0 amount
  const activeHdmlKeys=new Set(workers.filter(w=>w.hdmuale>0).map(w=>weekPrefix+w.name+'|hdml'));
  invoices=invoices.filter(i=>{
    if(!i.ccKey||!i.ccKey.startsWith(weekPrefix)) return true;
    if(!i.ccKey.endsWith('|hdml')) return true;
    return activeHdmlKeys.has(i.ccKey);
  });
  let hdCount=0;
  workers.forEach(wk=>{
    if(!wk.hdmuale||wk.hdmuale<=0) return;
    const key=weekPrefix+wk.name+'|hdml';
    ccUpsertInvoice(key,{
      ngay:toDate, congtrinh:ct, loai:'Hóa Đơn Lẻ',
      nguoi:wk.name, ncc:'',
      nd:wk.nd||('HĐ mua lẻ – '+wk.name+' ('+viShort(fromDate)+'–'+viShort(toDate)+')'),
      tien:wk.hdmuale, thanhtien:wk.hdmuale
    });
    hdCount++;
  });

  // ── UPSERT Nhân Công invoice for the whole week ──
  // One invoice per week+ct, Người TH = tên công nhân đầu tiên
  const ncKey=weekPrefix+'nhanCong';
  const totalLuong=workers.reduce((s,wk)=>{ const tc=wk.d.reduce((a,v)=>a+v,0); return s+tc*wk.luong+(wk.phucap||0); },0);
  const firstWorker=(workers.find(w=>w.name)||{name:''}).name;
  const ndNhanCong='Lương tuần '+viShort(fromDate)+'–'+viShort(toDate);
  if(totalLuong>0){
    ccUpsertInvoice(ncKey,{
      ngay:toDate, congtrinh:ct, loai:'Nhân Công',
      nguoi:firstWorker, ncc:'',
      nd:ndNhanCong,
      tien:totalLuong, thanhtien:totalLuong
    });
  } else {
    // if total = 0, remove the NC invoice
    invoices=invoices.filter(i=>i.ccKey!==ncKey);
  }

  save('inv_v3',invoices); updateTop();

  rebuildCCNameList();
  populateCCCtSel();
  // Chỉ cập nhật dropdown filter, KHÔNG render toàn bộ bảng lịch sử
  document.getElementById('cc-hist-week').value = fromDate;
  document.getElementById('cc-tlt-week').value  = fromDate;
  buildCCHistFilters();
  const msg=`✅ Đã lưu ${viShort(fromDate)}–${viShort(toDate)} [${ct}]`
    +(hdCount?` · ${hdCount} HĐ lẻ`:'')
    +(totalLuong>0?' · Nhân công cập nhật':'');
  toast(msg,'success');
}

function clearCCWeek(){
  if(!confirm('Xóa bảng nhập tuần này?')) return;
  buildCCTable([]);
}
let ccClipboard=null;
function copyCCWeek(){
  const workers=[];
  document.querySelectorAll('#cc-tbody tr:not(.cc-sum-row)').forEach(tr=>{
    const name=tr.querySelector('[data-cc="name"]')?.value?.trim()||'';
    const luong=parseInt(tr.querySelector('[data-cc="luong"]')?.dataset?.raw||0)||0;
    const phucap=parseInt(tr.querySelector('[data-cc="phucap"]')?.dataset?.raw||0)||0;
    const hdmuale=parseInt(tr.querySelector('[data-cc="hdml"]')?.dataset?.raw||0)||0;
    const nd=tr.querySelector('[data-cc="nd"]')?.value?.trim()||'';
    const d=[];
    for(let i=0;i<7;i++) d.push(parseFloat(tr.querySelector(`[data-cc="d${i}"]`)?.value||0)||0);
    if(name||luong>0||d.some(v=>v>0)) workers.push({name,luong,d,phucap,hdmuale,nd});
  });
  if(!workers.length){toast('Bảng trống, chưa có gì để copy!','error');return;}
  ccClipboard=workers;
  document.getElementById('cc-paste-btn').style.display='';
  const tc=workers.reduce((s,w)=>s+w.d.reduce((a,v)=>a+v,0),0);
  toast('📋 Đã copy '+workers.length+' công nhân ('+tc+' công) — nhấn Dán để áp dụng!','success');
}
function pasteCCWeek(){
  if(!ccClipboard||!ccClipboard.length){toast('Chưa copy tuần nào!','error');return;}
  // Dán toàn bộ: tên, lương, ngày công, phụ cấp, HĐ lẻ, nội dung
  buildCCTable(ccClipboard.map(w=>({...w})));
  toast('📌 Đã dán '+ccClipboard.length+' công nhân đầy đủ ngày công!','success');
}

// ─── CT selector ──────────────────────────────────────────────────
function populateCCCtSel(){
  // Lấy tất cả CT từ danh mục + ccData
  const allCts = [...new Set([...cats.congTrinh, ...ccData.map(w=>w.ct)].filter(Boolean))].sort();
  // Lọc theo năm: ưu tiên year field, fallback check dữ liệu phát sinh
  const filtered = allCts.filter(ct => _ctInActiveYear(ct));
  const sel = document.getElementById('cc-ct-sel');
  const cur = sel.value;
  sel.innerHTML = '<option value="">-- Chọn công trình --</option>' +
    filtered.map(v => `<option value="${x(v)}" ${v===cur?'selected':''}>${x(v)}</option>`).join('');
}

function onCCCtSelChange(){
  loadCCWeekForm();
}

// ─── history (per week) ───────────────────────────────────────────
function buildCCHistFilters(){
  const yearCC=ccData.filter(w=>inActiveYear(w.fromDate));
  const allCts=[...new Set(yearCC.map(w=>w.ct).filter(Boolean))].sort();
  // weeks list — chỉ năm đang chọn
  const allWeeks=[...new Set(yearCC.map(w=>w.fromDate))].sort().reverse();

  const ctSel=document.getElementById('cc-hist-ct'); const cv=ctSel.value;
  ctSel.innerHTML='<option value="">Tất cả CT</option>'+allCts.map(c=>`<option ${c===cv?'selected':''} value="${x(c)}">${x(c)}</option>`).join('');

  const wkSel=document.getElementById('cc-hist-week'); const wv=wkSel.value;
  wkSel.innerHTML='<option value="">Tất cả tuần</option>'+allWeeks.map(w=>`<option ${w===wv?'selected':''} value="${w}">${weekLabel(w)}</option>`).join('');

  // also update TLT week filter
  const tltSel=document.getElementById('cc-tlt-week'); const tv=tltSel.value;
  tltSel.innerHTML='<option value="">Tất cả tuần</option>'+allWeeks.map(w=>`<option ${w===tv?'selected':''} value="${w}">${weekLabel(w)}</option>`).join('');

  // Cập nhật dropdown CT cho TLT
  const tltCtSel=document.getElementById('cc-tlt-ct');
  if(tltCtSel){ const tcv=tltCtSel.value;
    tltCtSel.innerHTML='<option value="">Tất cả CT</option>'+allCts.map(ct=>`<option ${ct===tcv?'selected':''} value="${x(ct)}">${x(ct)}</option>`).join('');
  }
}

function renderCCHistory(){
  buildCCHistFilters();
  const fCt=document.getElementById('cc-hist-ct').value;
  const fWk=document.getElementById('cc-hist-week').value;
  const fQ=(document.getElementById('cc-hist-search')?.value||'').toLowerCase().trim();

  const map={};
  ccData.forEach(w=>{
    if(!inActiveYear(w.fromDate)) return;  // lọc năm
    if(fCt&&w.ct!==fCt) return;
    if(fWk&&w.fromDate!==fWk) return;
    const gKey=w.fromDate+'|'+w.ct;
    if(!map[gKey]){
      map[gKey]={
        fromDate:w.fromDate,
        toDate:w.toDate,
        ct:w.ct,
        d:[0,0,0,0,0,0,0],
        tc:0, tl:0, pc:0, hd:0, tongcong:0,
        luongList:[],
        names:[],
        ndList:[]
      };
    }
    w.workers.forEach(wk=>{
      const tc=wk.d.reduce((s,v)=>s+v,0);
      const luong=Number(wk.luong)||0;
      const tl=tc*luong;
      const pc=wk.phucap||0;
      const hd=wk.hdmuale||0;
      wk.d.forEach((v,i)=>{ map[gKey].d[i]+=Number(v)||0; });
      map[gKey].tc+=tc;
      map[gKey].tl+=tl;
      map[gKey].pc+=pc;
      map[gKey].hd+=hd;
      if(luong>0) map[gKey].luongList.push(luong);
      if(wk.name) map[gKey].names.push(wk.name);
      if(wk.nd) map[gKey].ndList.push(wk.nd);
    });
    map[gKey].tongcong=map[gKey].tl+map[gKey].pc+map[gKey].hd;
  });
  let rows=Object.values(map).map(r=>{
    const avgLuong=r.luongList.length
      ? Math.round(r.luongList.reduce((s,v)=>s+v,0)/r.luongList.length)
      : 0;
    const nd=[...new Set(r.ndList.map(v=>(v||'').trim()).filter(Boolean))].join(' | ');
    const workers=[...new Set(r.names.map(v=>(v||'').trim()).filter(Boolean))];
    return {...r, avgLuong, nd, workers};
  });
  if(fQ){
    rows=rows.filter(r=>
      (r.ct||'').toLowerCase().includes(fQ) ||
      r.workers.some(n=>n.toLowerCase().includes(fQ))
    );
  }
  rows.sort((a,b)=>b.fromDate.localeCompare(a.fromDate)||a.ct.localeCompare(b.ct,'vi'));

  const tbody=document.getElementById('cc-hist-tbody');
  const totalTL=rows.reduce((s,r)=>s+r.tl,0);
  const totalTC2=rows.reduce((s,r)=>s+r.tongcong,0);

  if(!rows.length){
    tbody.innerHTML=`<tr class="empty-row"><td colspan="17">Chưa có dữ liệu chấm công</td></tr>`;
    document.getElementById('cc-hist-pagination').innerHTML=''; return;
  }

  const start=(ccHistPage-1)*CC_PG_HIST;
  const paged=rows.slice(start,start+CC_PG_HIST);

  tbody.innerHTML=paged.map(r=>`<tr>
    <td style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--ink2);white-space:nowrap">${viShort(r.fromDate)}<br><span style="color:var(--ink3)">${viShort(r.toDate)}</span></td>
    <td style="font-weight:600;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${x(r.ct||'—')}</td>
    ${r.d.map(v=>`<td style="text-align:center;font-family:'IBM Plex Mono',monospace;font-weight:600;font-size:12px;${v===1?'color:var(--green)':v>0?'color:var(--blue)':'color:var(--line2)'}">${v||'·'}</td>`).join('')}
    <td style="text-align:center;font-family:'IBM Plex Mono',monospace;font-weight:700;color:var(--gold)">${r.tc}</td>
    <td style="text-align:right;font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--ink2)">${r.avgLuong?numFmt(r.avgLuong):'—'}</td>
    <td class="amount-td">${r.tl?numFmt(r.tl):'—'}</td>
    <td style="text-align:right;font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--blue)">${r.pc?numFmt(r.pc):'—'}</td>
    <td style="text-align:right;font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--ink2)">${r.hd?numFmt(r.hd):'—'}</td>
    <td style="color:var(--ink2);font-size:11px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${x(r.nd||'—')}</td>
    <td style="text-align:right;font-family:'IBM Plex Mono',monospace;font-weight:700;font-size:13px;color:var(--gold)">${r.tongcong?numFmt(r.tongcong):'—'}</td>
    <td>
      <button class="btn btn-outline btn-sm btn-icon" onclick="loadCCWeekFromHistory('${r.fromDate}','${x(r.ct)}')" title="Tải tuần này">↩</button>
      <button class="btn btn-danger btn-sm btn-icon" onclick="delCCWeekHistory('${r.fromDate}','${x(r.ct)}')" title="Xóa tuần">✕</button>
    </td>
  </tr>`).join('');

  const tp=Math.ceil(rows.length/CC_PG_HIST);
  let pag=`<span>${rows.length} dòng · Tổng lương: <strong style="color:var(--green);font-family:'IBM Plex Mono',monospace">${fmtS(totalTL)}</strong> · Tổng cộng: <strong style="color:var(--gold);font-family:'IBM Plex Mono',monospace">${fmtS(totalTC2)}</strong></span>`;
  if(tp>1){
    pag+='<div class="page-btns">';
    for(let p=1;p<=Math.min(tp,10);p++) pag+=`<button class="page-btn ${p===ccHistPage?'active':''}" onclick="ccHistGoTo(${p})">${p}</button>`;
    if(tp>10) pag+=`<span style="padding:4px 6px;color:var(--ink3)">...${tp}</span>`;
    pag+='</div>';
  }
  document.getElementById('cc-hist-pagination').innerHTML=pag;
  renderCCTLT();
}

function ccHistGoTo(p){ ccHistPage=p; renderCCHistory(); }

// ─── Tổng Lương Tuần (grouped by name per week) ───────────────────
function renderCCTLT(){
  buildCCHistFilters();
  const fWk=document.getElementById('cc-tlt-week').value;
  const fCt2=document.getElementById('cc-tlt-ct')?.value||'';

  // Group by name only khi "tất cả tuần", hoặc (tuần+name) khi lọc tuần cụ thể
  const map={};
  ccData.forEach(w=>{
    if(!inActiveYear(w.fromDate)) return;
    if(fCt2&&w.ct!==fCt2) return;
    if(fWk&&w.fromDate!==fWk) return;
    w.workers.forEach(wk=>{
      const key = fWk ? w.fromDate+'|'+wk.name : wk.name;
      if(!map[key]) map[key]={fromDate:w.fromDate,toDate:w.toDate,name:wk.name,
        d:[0,0,0,0,0,0,0],tc:0,tl:0,pc:0,hdml:0,cts:[],luongList:[]};
      wk.d.forEach((v,i)=>{ map[key].d[i]+=v; });
      const tc=wk.d.reduce((s,v)=>s+v,0);
      map[key].tc+=tc;
      map[key].tl+=tc*(wk.luong||0);
      map[key].pc+=(wk.phucap||0);
      map[key].hdml+=(wk.hdmuale||0);
      if(!map[key].cts.includes(w.ct)) map[key].cts.push(w.ct);
      map[key].luongList.push(wk.luong||0);
      if(!fWk){ if(w.fromDate<map[key].fromDate) map[key].fromDate=w.fromDate;
                if(w.toDate>map[key].toDate) map[key].toDate=w.toDate; }
    });
  });

  const rows=Object.values(map).sort((a,b)=>
    fWk ? b.fromDate.localeCompare(a.fromDate)||a.name.localeCompare(b.name,'vi')
        : a.name.localeCompare(b.name,'vi'));

  const tbody=document.getElementById('cc-tlt-tbody');
  const tableWrap=document.getElementById('cc-tlt-table-wrap');
  const cardsEl=document.getElementById('cc-tlt-cards');
  const isMobile=window.innerWidth<768;

  if(!rows.length){
    if(isMobile){ tableWrap.style.display='none'; cardsEl.style.display='block'; cardsEl.innerHTML='<p style="text-align:center;color:var(--ink3);padding:20px">Chưa có dữ liệu</p>'; }
    else{ tableWrap.style.display=''; cardsEl.style.display='none'; tbody.innerHTML=`<tr class="empty-row"><td colspan="14">Chưa có dữ liệu</td></tr>`; }
    document.getElementById('cc-tlt-pagination').innerHTML=''; return;
  }

  const grandTCLuong=rows.reduce((s,r)=>s+r.tl+r.pc+r.hdml,0);
  const start=(ccTltPage-1)*CC_PG_TLT;
  const paged=rows.slice(start,start+CC_PG_TLT);
  const mono="font-family:'IBM Plex Mono',monospace";
  const DAY_LABELS=['CN','T2','T3','T4','T5','T6','T7'];

  if(isMobile){
    // ── Mobile: card view ──
    tableWrap.style.display='none';
    cardsEl.style.display='block';
    cardsEl.innerHTML=paged.map(r=>{
      const tcLuong=r.tl+r.pc+r.hdml;
      const daysHtml=r.d.map((v,i)=>v>0?`<span class="tlt-day-badge${v>=1?' tlt-day-full':' tlt-day-half'}">${DAY_LABELS[i]}: ${v}</span>`:'').filter(Boolean).join('');
      const ctsHtml=r.cts.length?`<div class="tlt-card-cts">${r.cts.map(c=>x(c)).join(' · ')}</div>`:'';
      const periodHtml=fWk?`${viShort(r.fromDate)} – ${viShort(r.toDate)}`:'Tổng nhiều tuần';
      return `<div class="tlt-card"
        data-name="${x(r.name)}" data-from="${r.fromDate}" data-to="${r.toDate}"
        data-tc="${r.tc}" data-tl="${r.tl}" data-pc="${r.pc}" data-hdml="${r.hdml}"
        data-cts="${r.cts.join('|')}">
        <div class="tlt-card-header">
          <label class="tlt-card-label">
            <input type="checkbox" class="cc-tlt-chk">
            <span class="tlt-card-name">${x(r.name||'—')}</span>
          </label>
          <span class="tlt-card-amount">${tcLuong?numFmt(tcLuong)+' đ':'—'}</span>
        </div>
        <div class="tlt-card-meta">${periodHtml} &nbsp;·&nbsp; <strong>${r.tc}</strong> công</div>
        ${daysHtml?`<div class="tlt-card-days">${daysHtml}</div>`:''}
        ${ctsHtml}
      </div>`;
    }).join('');
  } else {
    // ── Desktop: table view ──
    tableWrap.style.display='';
    cardsEl.style.display='none';
    tbody.innerHTML=paged.map(r=>{
      const tcLuong=r.tl+r.pc+r.hdml;
      const luongTB=r.tc>0?Math.round(r.tl/r.tc):0;
      return `<tr
        data-name="${x(r.name)}" data-from="${r.fromDate}" data-to="${r.toDate}"
        data-tc="${r.tc}" data-tl="${r.tl}" data-pc="${r.pc}" data-hdml="${r.hdml}"
        data-cts="${r.cts.join('|')}">
        <td style="text-align:center;padding:4px"><input type="checkbox" class="cc-tlt-chk" style="width:15px;height:15px;cursor:pointer"></td>
        <td style="${mono};font-size:10px;color:var(--ink2);white-space:nowrap">${fWk?viShort(r.fromDate):'Tổng'}<br><span style="color:var(--ink3)">${fWk?viShort(r.toDate):r.tc+' công'}</span></td>
        <td style="font-weight:700;font-size:13px">${x(r.name||'—')}</td>
        ${r.d.map(v=>`<td style="text-align:center;${mono};font-weight:600;font-size:12px;${v===1?'color:var(--green)':v>0?'color:var(--blue)':'color:var(--line2)'}">${v||'·'}</td>`).join('')}
        <td style="text-align:center;${mono};font-weight:700;color:var(--gold)">${r.tc}</td>
        <td style="text-align:right;${mono};font-weight:700;font-size:13px;color:var(--green)">${tcLuong?numFmt(tcLuong):'—'}</td>
        <td style="text-align:right;${mono};font-size:12px;color:var(--ink2)">${luongTB?numFmt(luongTB):'—'}</td>
        <td style="font-size:11px;color:var(--ink2);max-width:200px">${r.cts.map(c=>x(c)).join('<br>')}</td>
      </tr>`;
    }).join('');
  }

  const tp=Math.ceil(rows.length/CC_PG_TLT);
  let pag=`<span>${rows.length} công nhân · Tổng TC Lương: <strong style="color:var(--green);${mono}">${fmtS(grandTCLuong)}</strong></span>`;
  if(tp>1){
    pag+='<div class="page-btns">';
    for(let p=1;p<=Math.min(tp,10);p++) pag+=`<button class="page-btn ${p===ccTltPage?'active':''}" onclick="ccTltGoTo(${p})">${p}</button>`;
    pag+='</div>';
  }
  document.getElementById('cc-tlt-pagination').innerHTML=pag;
}

function exportCCTLTCSV(){
  const fWk=document.getElementById('cc-tlt-week').value;
  const fCt2=document.getElementById('cc-tlt-ct')?.value||'';
  const map={};
  ccData.forEach(w=>{
    if(!inActiveYear(w.fromDate)) return;
    if(fCt2&&w.ct!==fCt2) return;
    if(fWk&&w.fromDate!==fWk) return;
    w.workers.forEach(wk=>{
      const key=w.fromDate+'|'+wk.name;
      if(!map[key]) map[key]={fromDate:w.fromDate,toDate:w.toDate,name:wk.name,
        d:[0,0,0,0,0,0,0],tc:0,tl:0,pc:0,cts:[]};
      wk.d.forEach((v,i)=>{ map[key].d[i]+=v; });
      const tc=wk.d.reduce((s,v)=>s+v,0);
      map[key].tc+=tc; map[key].tl+=tc*(wk.luong||0);
      map[key].pc+=(wk.phucap||0); map[key].cts.push(w.ct);
    });
  });
  const rows=[['Tuần','Tên CN','CN','T2','T3','T4','T5','T6','T7','TC','TC Lương','Lương TB/Ngày','Công Trình']];
  Object.values(map).sort((a,b)=>b.fromDate.localeCompare(a.fromDate)||a.name.localeCompare(b.name)).forEach(r=>{
    const tcL=r.tl+r.pc;
    const ltb=r.tc>0?Math.round(tcL/r.tc):0;
    rows.push([viShort(r.fromDate)+'–'+viShort(r.toDate),r.name,...r.d,r.tc,tcL,ltb,r.cts.join(', ')]);
  });
  dlCSV(rows,'tong_luong_tuan_'+today()+'.csv');
}

function ccTltGoTo(p){ ccTltPage=p; renderCCTLT(); }

function loadCCWeekFromHistory(fromDate,ct){
  const thisSun=ccSundayISO(0);
  const [ty,tm,td]=thisSun.split('-').map(Number);
  const [fy,fm,fd]=fromDate.split('-').map(Number);
  const diffMs=new Date(fy,fm-1,fd)-new Date(ty,tm-1,td);
  ccOffset=Math.round(diffMs/(7*86400000));
  const satISO=ccSaturdayISO(fromDate);
  document.getElementById('cc-from').value=fromDate;
  document.getElementById('cc-to').value=satISO;
  document.getElementById('cc-week-label').textContent='Tuần: '+weekLabel(fromDate);
  document.getElementById('cc-ct-sel').value=ct;
  const rec=ccData.find(w=>w.fromDate===fromDate&&w.ct===ct);
  buildCCTable(rec?rec.workers:[]);
  window.scrollTo({top:0,behavior:'smooth'});
  toast('Đã tải tuần '+viShort(fromDate)+' – '+ct);
}

function delCCWorker(wid,name){
  if(!confirm(`Xóa "${name}" khỏi tuần này?`)) return;
  const w=ccData.find(r=>r.id===wid);
  if(w){ w.workers=w.workers.filter(wk=>wk.name!==name); if(!w.workers.length) ccData=ccData.filter(r=>r.id!==wid); }
  save('cc_v2',ccData); renderCCHistory(); toast('Đã xóa');
}

function delCCWeekHistory(fromDate,ct){
  if(!confirm(`Xóa toàn bộ chấm công tuần ${viShort(fromDate)} của công trình "${ct}"?`)) return;
  const before=ccData.length;
  ccData=ccData.filter(r=>!(r.fromDate===fromDate&&r.ct===ct));
  if(ccData.length===before){ toast('Không tìm thấy dữ liệu để xóa','error'); return; }
  save('cc_v2',ccData);
  renderCCHistory();
  toast('Đã xóa tuần chấm công');
}

// ─── export ────────────────────────────────────────────────────────
function exportCCWeekCSV(){
  const f=document.getElementById('cc-from').value;
  const ct=document.getElementById('cc-ct-sel').value||'?';
  const rows=[['CT','Từ','Đến','Tên','CN','T2','T3','T4','T5','T6','T7','TC','Lương/N','Tổng Lương','Phụ Cấp','HĐ Mua Lẻ','Nội Dung','Tổng Cộng']];
  document.querySelectorAll('#cc-tbody tr:not(.cc-sum-row)').forEach(tr=>{
    const name=tr.querySelector('[data-cc="name"]')?.value?.trim()||'';
    if(!name) return;
    const d=[]; for(let i=0;i<7;i++) d.push(parseFloat(tr.querySelector(`[data-cc="d${i}"]`)?.value||0)||0);
    const tc=d.reduce((s,v)=>s+v,0);
    const l=parseInt(tr.querySelector('[data-cc="luong"]')?.dataset?.raw||0)||0;
    const pc=parseInt(tr.querySelector('[data-cc="phucap"]')?.dataset?.raw||0)||0;
    const hd=parseInt(tr.querySelector('[data-cc="hdml"]')?.dataset?.raw||0)||0;
    const nd=tr.querySelector('[data-cc="nd"]')?.value?.trim()||'';
    rows.push([ct,f,document.getElementById('cc-to').value,name,...d,tc,l,tc*l,pc,hd,nd,tc*l+pc+hd]);
  });
  dlCSV(rows,'chamcong_'+f+'.csv');
}

function exportCCHistCSV(){
  // Xuất đúng dữ liệu đang lọc trong bảng Lịch Sử Chấm Công Tuần
  const fCt=document.getElementById('cc-hist-ct').value;
  const fWk=document.getElementById('cc-hist-week').value;
  const fQ=(document.getElementById('cc-hist-search')?.value||'').toLowerCase().trim();
  const rows=[['CT','Từ','Đến','CN','T2','T3','T4','T5','T6','T7','TC','Lương/Ngày TB','Tổng Lương','Phụ Cấp','HĐ Mua Lẻ','Nội Dung','Tổng Cộng']];
  const map={};
  ccData.forEach(w=>{
    if(fCt&&w.ct!==fCt) return;
    if(fWk&&w.fromDate!==fWk) return;
    const key=w.fromDate+'|'+w.ct;
    if(!map[key]) map[key]={
      fromDate:w.fromDate,toDate:w.toDate,ct:w.ct,
      d:[0,0,0,0,0,0,0],tc:0,tl:0,pc:0,hd:0,luongList:[],names:[],ndList:[]
    };
    w.workers.forEach(wk=>{
      const tc=wk.d.reduce((s,v)=>s+v,0);
      const luong=Number(wk.luong)||0;
      wk.d.forEach((v,i)=>{ map[key].d[i]+=Number(v)||0; });
      map[key].tc+=tc;
      map[key].tl+=tc*luong;
      map[key].pc+=(wk.phucap||0);
      map[key].hd+=(wk.hdmuale||0);
      if(luong>0) map[key].luongList.push(luong);
      if(wk.name) map[key].names.push(wk.name);
      if(wk.nd) map[key].ndList.push(wk.nd);
    });
  });
  Object.values(map)
    .map(r=>{
      const avgLuong=r.luongList.length?Math.round(r.luongList.reduce((s,v)=>s+v,0)/r.luongList.length):0;
      const workers=[...new Set(r.names.map(v=>(v||'').trim()).filter(Boolean))];
      const nd=[...new Set(r.ndList.map(v=>(v||'').trim()).filter(Boolean))].join(' | ');
      return {...r,avgLuong,workers,nd,tong:r.tl+r.pc+r.hd};
    })
    .filter(r=>!fQ||(r.ct||'').toLowerCase().includes(fQ)||r.workers.some(n=>n.toLowerCase().includes(fQ)))
    .sort((a,b)=>b.fromDate.localeCompare(a.fromDate)||a.ct.localeCompare(b.ct,'vi'))
    .forEach(r=>{
      rows.push([r.ct,viShort(r.fromDate)+'–'+viShort(r.toDate),r.toDate,...r.d,r.tc,r.avgLuong,r.tl,r.pc,r.hd,r.nd,r.tong]);
    });
  const label=fWk?viShort(fWk):'all';
  dlCSV(rows,'lich_su_cham_cong_'+label+'_'+today()+'.csv');
}

// [MODULE: PHIẾU LƯƠNG] — xuatPhieuLuong · html2canvas
// Ctrl+F → "MODULE: PHIẾU LƯƠNG"
// ══════════════════════════════════════════════════════════════

function removeVietnameseTones(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // xóa dấu
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9\s_]/g, '')    // xóa ký tự đặc biệt
    .trim()
    .replace(/\s+/g, '_');
}

function xuatPhieuLuong() {
  // 1. Thu thập công nhân được tick từ bảng Tổng Lương Tuần
  //    Hỗ trợ cả table row (desktop) và card div (mobile)
  const rows = [];
  document.querySelectorAll('.cc-tlt-chk:checked').forEach(chk => {
    const container = chk.closest('[data-name]');
    if (!container) return;
    const name     = container.dataset.name || '(Chưa đặt tên)';
    const fromDate = container.dataset.from  || '';
    const toDate   = container.dataset.to    || '';
    const tc       = parseFloat(container.dataset.tc)   || 0;
    const tl       = parseInt(container.dataset.tl)     || 0; // tc * luong
    const pc       = parseInt(container.dataset.pc)     || 0; // phụ cấp
    const hdml     = parseInt(container.dataset.hdml)   || 0; // HĐ mua lẻ
    const cts      = (container.dataset.cts || '').split('|').filter(Boolean);
    const tongCong = tl + pc + hdml;
    const luongTB  = tc > 0 ? Math.round(tl / tc) : 0;
    rows.push({ name, fromDate, toDate, tc, tl, pc, hdml, cts, tongCong, luongTB });
  });

  if (!rows.length) {
    toast('⚠️ Tick chọn ít nhất 1 công nhân trong bảng Tổng Lương Tuần!', 'error');
    return;
  }

  // 2. Tổng hợp thông tin chung
  const allFrom = rows.map(r => r.fromDate).filter(Boolean).sort();
  const allTo   = rows.map(r => r.toDate).filter(Boolean).sort();
  const fromDt  = allFrom[0] || '';
  const toDt    = allTo[allTo.length - 1] || '';
  const period  = fromDt && toDt ? _fmtDate(fromDt) + ' — ' + _fmtDate(toDt) : '(Chưa rõ)';

  const allCts     = [...new Set(rows.flatMap(r => r.cts))];
  const ctLabel    = allCts.join(', ') || '(Nhiều công trình)';
  const today_     = new Date().toLocaleDateString('vi-VN');
  const tongThanhToan = rows.reduce((s, r) => s + r.tongCong, 0);

  // 3. Đổ dữ liệu vào template
  document.getElementById('pl-ct-name').textContent = ctLabel;
  document.getElementById('pl-ct-label').textContent = ctLabel;
  document.getElementById('pl-period').textContent   = period;
  document.getElementById('pl-date').textContent     = today_;

  document.getElementById('pl-tbody').innerHTML = rows.map(r => `
    <tr>
      <td>${x(r.name)}</td>
      <td>${r.tc}</td>
      <td>${r.luongTB ? numFmt(r.luongTB) + ' đ' : '—'}</td>
      <td>${r.pc ? numFmt(r.pc) + ' đ' : '—'}</td>
      <td style="color:#c0392b">${r.hdml ? numFmt(r.hdml) + ' đ' : '—'}</td>
      <td style="font-weight:700;color:#c8870a">${numFmt(r.tongCong)} đ</td>
    </tr>`).join('');

  document.getElementById('pl-total-cell').textContent  = numFmt(tongThanhToan) + ' đ';
  document.getElementById('pl-grand-total').textContent =
    'TỔNG TIỀN THANH TOÁN: ' + numFmt(tongThanhToan) + ' đồng';

  // 4. Hiện template tạm để chụp
  const tpl = document.getElementById('phieu-luong-template');
  tpl.style.display = 'block';

  // 5. Chụp bằng html2canvas
  const _now = new Date();
  const _dd = String(_now.getDate()).padStart(2, '0');
  const _mm = String(_now.getMonth() + 1).padStart(2, '0');
  const _yy = String(_now.getFullYear()).slice(-2);
  const _datePart = _dd + _mm + _yy;
  const _wParts = rows.map(r =>
    removeVietnameseTones(r.name) + '_' + r.tc + 'c'
  ).join('_');
  const _ctList = allCts.slice(0, 3).map(ct => removeVietnameseTones(ct).slice(0, 3));
  const _ctPart = _ctList.join('_') + (allCts.length > 3 ? '_etc' : '');
  const fileName = 'Phieuluong_' + _datePart + '_' + _wParts + (_ctPart ? '_' + _ctPart : '');
  toast('⏳ Đang tạo phiếu lương...', 'info');

  document.fonts.ready.then(() => {
    html2canvas(tpl, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      windowWidth: 760
    }).then(canvas => {
      tpl.style.display = 'none';
      const link = document.createElement('a');
      link.download = fileName + '.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast('✅ Đã xuất phiếu lương ' + rows.length + ' người!', 'success');
    }).catch(err => {
      tpl.style.display = 'none';
      console.error('html2canvas error:', err);
      toast('❌ Lỗi khi tạo ảnh: ' + err.message, 'error');
    });
  });
}

// Helper: format ngày YYYY-MM-DD → DD/MM/YYYY
function exportUngToImage() {
  // 1. Lấy các dòng được tick (dựa vào data-id khớp filteredUng)
  const checkedIds = new Set(
    [...document.querySelectorAll('.ung-row-chk:checked')].map(el => el.dataset.id)
  );
  if (!checkedIds.size) {
    toast('⚠️ Vui lòng tick chọn ít nhất 1 khoản ứng!', 'error');
    return;
  }
  const rows = filteredUng.filter(r => checkedIds.has(String(r.id)));
  if (!rows.length) {
    toast('⚠️ Không tìm thấy dữ liệu — thử lọc lại rồi tick chọn!', 'error');
    return;
  }

  // 2. Thông tin chung
  const ct       = rows[0]?.congtrinh || '(Chưa rõ CT)';
  const tongTien = rows.reduce((s, r) => s + (r.tien || 0), 0);

  // 3. Đổ dữ liệu vào template
  document.getElementById('pul-ct-name').textContent  = ct;
  document.getElementById('pul-ct-label').textContent = ct;
  document.getElementById('pul-date').textContent     = new Date().toLocaleDateString('vi-VN');

  document.getElementById('pul-tbody').innerHTML = rows.map((r, i) => `
    <tr style="${i % 2 === 1 ? 'background:#f9f7f4' : ''}">
      <td style="padding:8px 10px;white-space:nowrap">${r.ngay}</td>
      <td style="padding:8px 10px;font-weight:600">${x(r.tp || '—')}</td>
      <td style="padding:8px 10px;color:#555">${x(r.nd || '—')}</td>
      <td style="padding:8px 10px;text-align:right;font-weight:700;color:#c8870a;white-space:nowrap">
        ${numFmt(r.tien || 0)} đ
      </td>
    </tr>`).join('');

  document.getElementById('pul-total-cell').textContent   = numFmt(tongTien) + ' đ';
  document.getElementById('pul-grand-total').textContent  =
    'TỔNG TIỀN TẠM ỨNG: ' + numFmt(tongTien) + ' đồng';

  // 4. Tạo tên file:  Phieuung_TenCT_TenTP1_500k_TenTP2_300k.png
  const safeCT = removeVietnameseTones(ct);
  const tpMap  = {};
  rows.forEach(r => {
    const key = r.tp || 'KhongRo';
    tpMap[key] = (tpMap[key] || 0) + (r.tien || 0);
  });
  const workerParts = Object.entries(tpMap)
    .map(([tp, tien]) => removeVietnameseTones(tp) + '_' + Math.round(tien / 1000) + 'k')
    .join('_');
  const fileName = 'Phieuung_' + safeCT + '_' + workerParts;

  // 5. Chụp ảnh
  const tpl = document.getElementById('phieu-ung-template');
  tpl.style.display = 'block';
  toast('⏳ Đang tạo phiếu tạm ứng...', 'info');

  document.fonts.ready.then(() => {
    html2canvas(tpl, {
      scale: 2, backgroundColor: '#ffffff',
      useCORS: true, logging: false, windowWidth: 760
    }).then(canvas => {
      tpl.style.display = 'none';
      const link = document.createElement('a');
      link.download = fileName + '.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast('✅ Đã xuất phiếu tạm ứng ' + rows.length + ' dòng!', 'success');
    }).catch(err => {
      tpl.style.display = 'none';
      toast('❌ Lỗi khi tạo ảnh: ' + err.message, 'error');
    });
  });
}

function _fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return d + '/' + m + '/' + y;
}
