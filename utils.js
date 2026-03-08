// utils.js — Format / Parse / Helpers / Numpad / Keyboard Nav
// Load order: 2

function _strSimilarity(a, b) {
  if(a === b) return 1;
  if(!a || !b) return 0;
  if(a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const getBigrams = s => {
    const set = new Map();
    for(let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i+2);
      set.set(bg, (set.get(bg)||0) + 1);
    }
    return set;
  };
  const aMap = getBigrams(a);
  const bMap = getBigrams(b);
  let intersection = 0;
  aMap.forEach((cnt, bg) => {
    if(bMap.has(bg)) intersection += Math.min(cnt, bMap.get(bg));
  });
  return (2 * intersection) / (a.length - 1 + b.length - 1);
}

function dlCSV(rows,name) {
  const csv=rows.map(r=>r.map(c=>`"${String(c||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));
  a.download=name; a.click();
}

// ══════════════════════════════
//  HELPERS
// ══════════════════════════════
function updateTop() {
  const total = buildInvoices().filter(i=>inActiveYear(i.ngay)).reduce((s,i)=>s+(i.thanhtien||i.tien||0),0);
  document.getElementById('top-total').textContent=fmtS(total);
}

// ══════════════════════════════════════════════════════════════
// [buildInvoices] — Tổng hợp invoice từ data gốc (không lưu vào inv_v3)
// Trả về: manual invoices (source='manual') + CC invoices (source='cc')
// Tất cả module hiển thị chi phí phải dùng hàm này thay vì đọc invoices trực tiếp
// ══════════════════════════════════════════════════════════════
function buildInvoices() {
  // 1. Manual invoices — chỉ những HĐ nhập tay, không có ccKey
  const manual = invoices.map(inv => ({ ...inv, source: 'manual' }));

  // 2. CC-derived invoices — tính động từ ccData, không lưu vào inv_v3
  const ccInvs = [];
  const _vi = ds => {
    const [,m,d] = ds.split('-').map(Number);
    return (d<10?'0':'')+d+'/'+(m<10?'0':'')+m;
  };
  const _ccData = (typeof ccData !== 'undefined') ? ccData : [];
  _ccData.forEach(week => {
    const { fromDate, ct, workers } = week;
    if (!fromDate || !ct || !workers || !workers.length) return;
    let toDate = week.toDate;
    if (!toDate) {
      const [y,m,d] = fromDate.split('-').map(Number);
      const sat = new Date(y,m-1,d+6);
      toDate = sat.getFullYear()+'-'+String(sat.getMonth()+1).padStart(2,'0')+'-'+String(sat.getDate()).padStart(2,'0');
    }
    const pfx = 'cc|'+fromDate+'|'+ct+'|';
    // HĐ Mua Lẻ — 1 dòng mỗi công nhân có hdmuale > 0
    workers.forEach(wk => {
      if (!wk.hdmuale || wk.hdmuale <= 0) return;
      const key = pfx+wk.name+'|hdml';
      ccInvs.push({ id:key, ccKey:key, source:'cc',
        ngay:toDate, congtrinh:ct, loai:'Hóa Đơn Lẻ',
        nguoi:wk.name, ncc:'',
        nd: wk.nd || ('HĐ mua lẻ – '+wk.name+' ('+_vi(fromDate)+'–'+_vi(toDate)+')'),
        tien:wk.hdmuale, thanhtien:wk.hdmuale, _ts:0
      });
    });
    // HĐ Nhân Công — 1 dòng mỗi tuần+CT
    const totalLuong = workers.reduce((s,wk)=>{
      const tc=(wk.d||[]).reduce((a,v)=>a+(v||0),0);
      return s+tc*(wk.luong||0)+(wk.phucap||0);
    },0);
    if (totalLuong > 0) {
      const ncKey = pfx+'nhanCong';
      const fw = (workers.find(w=>w.name)||{name:''}).name;
      ccInvs.push({ id:ncKey, ccKey:ncKey, source:'cc',
        ngay:toDate, congtrinh:ct, loai:'Nhân Công',
        nguoi:fw, ncc:'',
        nd:'Lương tuần '+_vi(fromDate)+'–'+_vi(toDate),
        tien:totalLuong, thanhtien:totalLuong, _ts:0
      });
    }
  });

  return [...manual, ...ccInvs];
}
function numFmt(n){ if(!n&&n!==0)return''; return parseInt(n,10).toLocaleString('vi-VN'); }
function fmtM(n){ if(!n)return'0 đ'; return parseInt(n).toLocaleString('vi-VN')+' đ'; }
function fmtS(n){ if(!n)return'0'; if(n>=1e9)return(n/1e9).toFixed(3).replace(/\.?0+$/,'')+' tỷ'; if(n>=1e6)return(n/1e6).toFixed(1).replace(/\.0$/,'')+' tr'; if(n>=1e3)return(n/1e3).toFixed(0)+'k'; return n.toLocaleString('vi-VN'); }
// ── parseMoney: chuẩn hóa mọi dạng nhập tiền → số nguyên ─────
// Xử lý: "1.000.000", "1,000,000", "1000000", "1tr", "1.5tr", "2tỷ"
// Test: parseMoney("1.000.000")→1000000  parseMoney("1tr")→1000000
//       parseMoney("1,5tr")→1500000      parseMoney("2tỷ")→2000000000
function parseMoney(raw) {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === 'number') return Math.round(raw);
  const s = String(raw).trim().toLowerCase().replace(/\s+/g,'');
  if (!s) return 0;

  // Đơn vị tỷ/tr/k
  const unitMap = [
    [/^([\d,.]+)tỷ$/,   1e9],
    [/^([\d,.]+)ty$/,   1e9],
    [/^([\d,.]+)b$/,    1e9],
    [/^([\d,.]+)tr$/,   1e6],
    [/^([\d,.]+)m$/,    1e6],
    [/^([\d,.]+)k$/,    1e3],
  ];
  for (const [rx, mult] of unitMap) {
    const m = s.match(rx);
    if (m) {
      const num = parseFloat(m[1].replace(/[,.]/g, s.includes(',') && s.includes('.') ?
        (s.indexOf(',') < s.indexOf('.') ? (v => v===','?'':'.') : (v => v==='.'?'':'.')) :
        // Nếu chỉ có dấu '.' → dấu phân cách nghìn VN → xóa
        // Nếu chỉ có dấu ',' → dấu thập phân → giữ là '.'
        (m[1].includes(',') ? (v => v===','?'.':'') : (v => v==='.'?'':''))
      ));
      return Math.round(num * mult);
    }
  }

  // Dạng số thuần: xóa tất cả dấu phân cách nghìn
  // Logic: nếu có cả '.' và ',' → cái nào ở sau cùng là thập phân
  let clean = s;
  const lastDot   = clean.lastIndexOf('.');
  const lastComma = clean.lastIndexOf(',');

  if (lastDot > -1 && lastComma > -1) {
    // Có cả 2: cái ở sau cùng là thập phân
    if (lastDot > lastComma) {
      clean = clean.replace(/,/g, '');           // ',' = nghìn
    } else {
      clean = clean.replace(/\./g, '').replace(',', '.'); // '.' = nghìn, ',' = thập phân
    }
  } else if (lastDot > -1) {
    // Chỉ có '.': nếu phần sau '.' là đúng 3 chữ số → nghìn VN, không thì thập phân
    const afterDot = clean.slice(lastDot + 1);
    if (afterDot.length === 3 && /^\d{3}$/.test(afterDot)) {
      clean = clean.replace(/\./g, ''); // nghìn
    }
    // else giữ nguyên là thập phân
  } else if (lastComma > -1) {
    const afterComma = clean.slice(lastComma + 1);
    if (afterComma.length === 3 && /^\d{3}$/.test(afterComma)) {
      clean = clean.replace(/,/g, ''); // nghìn
    } else {
      clean = clean.replace(',', '.'); // thập phân
    }
  }

  const n = parseFloat(clean);
  return isNaN(n) ? 0 : Math.round(n);
}

// ── Test cases (chạy trong Console để verify) ─────────────────
// Gọi: _testParseMoney() trong Console
function _testParseMoney() {
  const cases = [
    ['1000000',     1000000],
    ['1.000.000',   1000000],
    ['1,000,000',   1000000],
    ['1.000',       1000],
    ['1,000',       1000],
    ['1500000',     1500000],
    ['1.5tr',       1500000],
    ['1,5tr',       1500000],
    ['2tr',         2000000],
    ['500k',        500000],
    ['1.5tỷ',       1500000000],
    ['2tỷ',         2000000000],
    ['630000',      630000],
    ['0',           0],
    ['',            0],
    [null,          0],
    [1000000,       1000000],  // number passthrough
  ];
  let pass = 0, fail = 0;
  cases.forEach(([input, expected]) => {
    const got = parseMoney(input);
    const ok  = got === expected;
    if (!ok) console.error(`❌ parseMoney(${JSON.stringify(input)}) = ${got}, expected ${expected}`);
    else pass++;
    if (!ok) fail++;
  });
  console.log(`parseMoney tests: ${pass}/${cases.length} passed${fail?', '+fail+' FAILED':' ✅'}`);
}

function x(s){ if(!s)return''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function toast(msg,type='') { const t=document.getElementById('toast'); t.textContent=msg; t.className='toast '+(type?type:''); t.classList.add('show'); clearTimeout(t._to); t._to=setTimeout(()=>t.classList.remove('show'),2800); }

function inActiveYear(dateStr) {
  if(!dateStr) return false;
  if(activeYear === 0) return true; // "Tất cả năm"
  return parseInt(dateStr.split('-')[0]) === activeYear;
}

// Kiểm tra công trình có thuộc năm đang chọn không
// Ưu tiên: 1) CT mới tạo có year field khớp → true; 2) CT cũ: check qua dữ liệu phát sinh
function _ctInActiveYear(name) {
  if (activeYear === 0) return true;
  if (!name) return false;
  // 1. CT mới: có year field rõ ràng
  const yr = cats.congTrinhYears && cats.congTrinhYears[name];
  if (yr && yr === activeYear) return true;
  // 2. CT cũ / CT đã có dữ liệu trong năm
  return _entityInYear(name, 'ct');
}

// Tầng 2 — lọc mềm cho entity (CT, CN, TB)
// Trả về true nếu entity có BẤT KỲ phát sinh nào trong năm đang chọn
// Dùng cho: dropdown, danh mục, tổng hợp
function _entityInYear(name, type) {
  if (activeYear === 0) return true; // "Tất cả năm" → hiện hết
  if (!name) return false;
  if (type === 'ct') {
    // CT xuất hiện nếu có HĐ, CC, hoặc tiền ứng trong năm
    return invoices.some(i  => inActiveYear(i.ngay)      && i.congtrinh === name)
        || ccData.some(w    => inActiveYear(w.fromDate)   && w.ct        === name)
        || ungRecords.some(r => inActiveYear(r.ngay)      && r.congtrinh === name);
  }
  if (type === 'cn') {
    // Công nhân xuất hiện nếu có tuần chấm công trong năm
    return ccData.some(w => inActiveYear(w.fromDate)
        && (w.workers || []).some(wk => wk.name === name));
  }
  if (type === 'tb') {
    // Thiết bị: hiện nếu CT của nó hoạt động trong năm HOẶC đang hoạt động
    return tbData.some(r => r.ten === name && (
      r.tinhtrang === 'Đang hoạt động'
      || _entityInYear(r.ct, 'ct')
    ));
  }
  return true;
}

// ══════════════════════════════════════════════════════════════════
//  NUMPAD OVERLAY — bàn phím số mobile
// ══════════════════════════════════════════════════════════════════
const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

let _npTarget = null;
let _npRaw = '0';
let _npOp  = null;
let _npLeft = null;

function openNumpad(inputEl, label) {
  _npTarget = inputEl;
  // cc-day-input: lấy value (0, 0.5, 1)
  // np-num-input: lấy value số thô
  // cc-wage-input / tien-input: lấy data-raw
  let startVal;
  if(inputEl.classList.contains('cc-day-input')) {
    startVal = String(parseFloat(inputEl.value)||0);
  } else if(inputEl.classList.contains('np-num-input')) {
    startVal = String(parseFloat(inputEl.value)||0);
  } else {
    startVal = String(inputEl.dataset.raw || inputEl.value || '0');
  }
  _npRaw = (startVal && startVal!=='0') ? startVal : '0';
  if(!_npRaw) _npRaw='0';
  _npOp = null; _npLeft = null;
  document.getElementById('numpad-label').textContent = label || 'Nhập số tiền';
  _npRefresh();
  document.getElementById('numpad-overlay').classList.add('open');
  inputEl.blur();
  inputEl.setAttribute('readonly', '');
}

function closeNumpad() {
  document.getElementById('numpad-overlay').classList.remove('open');
  if(_npTarget) _npTarget.removeAttribute('readonly');
  _npTarget = null;
}

function _npCalcResult() {
  const isDay = _npTarget && _npTarget.classList.contains('cc-day-input');
  if(isDay) return parseFloat(_npRaw)||0;
  const right = parseInt(_npRaw)||0;
  if(_npLeft !== null && _npOp) {
    if(_npOp==='+') return _npLeft + right;
    if(_npOp==='−') return Math.max(0, _npLeft - right);
    if(_npOp==='×') return _npLeft * right;
    if(_npOp==='÷') return right ? Math.round(_npLeft / right) : _npLeft;
  }
  return parseInt(_npRaw)||0;
}

function _npRefresh() {
  const txt = document.getElementById('numpad-text');
  if(!txt) return;
  const isDay = _npTarget && _npTarget.classList.contains('cc-day-input');
  if(isDay) {
    // Hiện giá trị thập phân thực sự (không format tiền)
    txt.textContent = _npRaw || '0';
    const saveBtn = document.getElementById('numpad-save-btn');
    if(saveBtn) saveBtn.textContent = 'Lưu  ' + (_npRaw||'0') + ' công';
    // Ẩn/hiện layout numpad day vs tiền
    const keysEl = document.getElementById('numpad-keys');
    const dayKeysEl = document.getElementById('numpad-day-keys');
    const shortcutsEl2 = document.getElementById('numpad-shortcuts');
    if(keysEl) keysEl.style.display = 'none';
    if(dayKeysEl) dayKeysEl.style.display = 'grid';
    if(shortcutsEl2) shortcutsEl2.style.display = 'none';
  } else {
    const keysEl = document.getElementById('numpad-keys');
    const dayKeysEl = document.getElementById('numpad-day-keys');
    const shortcutsEl2 = document.getElementById('numpad-shortcuts');
    if(keysEl) keysEl.style.display = 'grid';
    if(dayKeysEl) dayKeysEl.style.display = 'none';
    if(shortcutsEl2) shortcutsEl2.style.display = 'flex';
    const raw = parseInt(_npRaw)||0;
    if(_npLeft !== null && _npOp) {
      const leftFmt = numFmt(_npLeft);
      const rightStr = (_npRaw && _npRaw!=='0') ? numFmt(parseInt(_npRaw)||0) : '?';
      txt.textContent = leftFmt + ' ' + _npOp + ' ' + rightStr;
    } else {
      txt.textContent = raw ? numFmt(raw) : '0';
    }
    const val = _npCalcResult();
    const saveBtn = document.getElementById('numpad-save-btn');
    if(saveBtn) saveBtn.textContent = val ? 'Lưu  ' + numFmt(val) : 'Lưu';
  }
}

function numpadKey(k) {
  const isDay = _npTarget && _npTarget.classList.contains('cc-day-input');
  if(k==='C') {
    _npRaw='0'; _npOp=null; _npLeft=null;
  } else if(k==='⌫') {
    _npRaw = _npRaw.length > 1 ? _npRaw.slice(0,-1) : '0';
  } else if(k==='.') {
    if(!_npRaw.includes('.')) _npRaw += '.';
  } else if(k==='000') {
    _npRaw = _npRaw==='0' ? '0' : _npRaw + '000';
  } else if(['÷','×','−','+'].includes(k)) {
    if(!isDay) { // phép tính chỉ cho ô tiền
      if(_npLeft!==null && _npOp && _npRaw!=='0') {
        _npLeft = _npCalcResult(); _npRaw = '0';
      } else {
        _npLeft = parseInt(_npRaw)||0; _npRaw = '0';
      }
      _npOp = k;
    }
  } else {
    // Thêm chữ số
    if(isDay) {
      // Day: cho phép decimal tự do, tối đa 5 ký tự (e.g. "99.99")
      if(_npRaw==='0' && k!=='.') _npRaw = k;
      else _npRaw = _npRaw + k;
      if(_npRaw.length > 5) _npRaw = _npRaw.slice(0,5);
    } else {
      _npRaw = _npRaw==='0' ? k : _npRaw + k;
      if(_npRaw.length > 12) _npRaw = _npRaw.slice(0,12);
    }
  }
  _npRefresh();
}

function _npSetDayVal(val) {
  // Shortcut cho ô ngày công — đặt giá trị rồi tự đóng
  _npRaw = String(val);
  _npOp = null; _npLeft = null;
  numpadDone();
}
function numpadShortcut(amount) {
  const cur = _npCalcResult();
  _npRaw = String(cur + amount);
  _npOp = null; _npLeft = null;
  _npRefresh();
}

function numpadDone() {
  const val = _npCalcResult();
  if(_npTarget) {
    const el = _npTarget;
    el.dataset.raw = val;
    const isCC = el.classList.contains('cc-wage-input');
    const isNum = el.classList.contains('np-num-input');

    if(el.classList.contains('cc-day-input')) {
      // CC ngày công: đọc _npRaw trực tiếp để giữ decimal (0.5, 0.3, 11, 12...)
      const rawStr = _npRaw || '0';
      const dayVal = parseFloat(rawStr) || 0;
      el.value = dayVal || '';
      el.classList.toggle('has-val', dayVal >= 1);
      el.classList.toggle('half-val', dayVal > 0 && dayVal < 1);
      el.dataset.raw = dayVal;
      const tr2 = el.closest('tr');
      if(tr2) try { onCCDayKey(el); calcCCRow(tr2); updateCCSumRow && updateCCSumRow(); } catch(e){}
    } else if(isCC) {
      // CC wage: set data-raw trực tiếp rồi gọi hàm tính lại
      el.dataset.raw = val;
      el.value = val ? numFmt(val) : '';
      // Gọi calcCCRow để cập nhật tổng lương
      const tr2 = el.closest('tr');
      if(tr2) try { calcCCRow(tr2); updateCCSumRow && updateCCSumRow(); } catch(e){}
    } else if(isNum) {
      // np-num-input (TB soluong, modal): giá trị thô
      el.value = val || '';
    } else {
      // tien-input: format
      el.value = val ? numFmt(val) : '';
      // Trigger updateThTien
      const tr = el.closest('tr');
      if(tr) {
        const slEl = tr.querySelector('[data-f="sl"]');
        const thEl = tr.querySelector('[data-f="thtien"]');
        if(slEl && thEl) {
          const sl = parseFloat(slEl.value)||1;
          const th = val * sl;
          thEl.textContent = th ? numFmt(th) : '';
          thEl.dataset.raw = th;
        }
      }
    }
    try { calcSummary(); } catch(e){}
    try { calcUngSummary(); } catch(e){}
  }
  closeNumpad();
}

// ── Helper: nhận biết ô số cần numpad ──────────────────────────
function isNumpadTarget(el) {
  return el.classList.contains('tien-input') ||
         el.classList.contains('cc-wage-input') ||
         el.classList.contains('cc-day-input') ||
         el.classList.contains('np-num-input');
}

// ── Build label từ context ────────────────────────────────────
function buildNumpadLabel(el) {
  const tr = el.closest('tr');
  // CC wage fields
  const ccAttr = el.dataset.cc;
  if(ccAttr) {
    if(ccAttr.startsWith('d')) {
      const name = tr?.querySelector('[data-cc="name"]')?.value||'';
      const days = ['CN','T2','T3','T4','T5','T6','T7'];
      const idx = parseInt(ccAttr.slice(1));
      return (days[idx]||ccAttr) + (name?' — '+name:'');
    }
    const labels = {luong:'Lương/Ngày', phucap:'Phụ Cấp', hdml:'HĐ Mua Lẻ'};
    const name = tr?.querySelector('[data-cc="name"]')?.value||'';
    return (labels[ccAttr]||'Nhập số') + (name?' — '+name:'');
  }
  // TB
  const tbAttr = el.dataset.tb;
  if(tbAttr==='soluong') {
    const ten = tr?.querySelector('[data-tb="ten"]')?.value||'';
    return 'Số Lượng' + (ten?' — '+ten:'');
  }
  // Modal inputs
  if(el.id==='tb-ei-sl') return 'Số Lượng';
  // tien / tiền ứng
  if(tr) {
    const loai = tr.querySelector('[data-f="loai"]')?.value || tr.querySelector('[data-f="tp"]')?.value || '';
    const ct   = tr.querySelector('[data-f="ct"]')?.value || '';
    return [loai, ct].filter(Boolean).join(' · ') || 'Nhập số tiền';
  }
  return 'Nhập số';
}

// Native mobile numeric keyboard: force decimal inputmode on numeric fields.
const NATIVE_NUMERIC_SELECTOR = [
  'input.tien-input',
  'input.cc-day-input',
  'input.cc-wage-input',
  'input.np-num-input',
  'input[type="number"]',
  '#hd-giatri',
  '#hd-phatsinh',
  '#thu-tien'
].join(',');

function applyNativeNumericInputMode(root) {
  const host = (root && root.querySelectorAll) ? root : document;
  host.querySelectorAll(NATIVE_NUMERIC_SELECTOR).forEach(el => {
    el.setAttribute('inputmode', 'decimal');
  });
}

applyNativeNumericInputMode(document);
document.addEventListener('focusin', function(e) {
  const el = e.target;
  if(el && el.matches && el.matches(NATIVE_NUMERIC_SELECTOR)) {
    el.setAttribute('inputmode', 'decimal');
  }
});

if(window.MutationObserver) {
  const _nativeKbObserver = new MutationObserver(mutations => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if(!(node instanceof HTMLElement)) return;
        if(node.matches && node.matches(NATIVE_NUMERIC_SELECTOR)) {
          node.setAttribute('inputmode', 'decimal');
        }
        applyNativeNumericInputMode(node);
      });
    });
  });
  _nativeKbObserver.observe(document.documentElement, { childList: true, subtree: true });
}

// Keep Escape close behavior in case overlay is opened by legacy calls.
document.addEventListener('keydown', function(e) {
  if(e.key==='Escape') closeNumpad();
});


// [MODULE: KEYBOARD NAV] — Entry table & Ung table
// Enter = xuống ô dưới, Ctrl+Enter = lưu, Shift+Enter = thêm dòng
// Tìm nhanh: Ctrl+F → "MODULE: KEYBOARD NAV"
// ══════════════════════════════════════════════════════════════

(function _initKeyboardNav() {
  function isNumericInput(el) {
    return !!(
      el &&
      el.tagName === 'INPUT' &&
      !el.readOnly &&
      !el.disabled &&
      el.matches(NATIVE_NUMERIC_SELECTOR)
    );
  }
  function firstNumericInRow(tr) {
    if(!tr) return null;
    const inputs = Array.from(tr.querySelectorAll('input'));
    return inputs.find(isNumericInput) || null;
  }
  function nextNumericInSameRow(inputEl) {
    const tr = inputEl.closest('tr');
    const td = inputEl.closest('td,th');
    if(!tr || !td) return null;
    const cells = Array.from(tr.children).filter(c => c.matches && c.matches('td,th'));
    const idx = cells.findIndex(c => c === td || c.contains(inputEl));
    if(idx < 0) return null;
    for(let i = idx + 1; i < cells.length; i++) {
      const cand = Array.from(cells[i].querySelectorAll('input')).find(isNumericInput);
      if(cand) return cand;
    }
    return null;
  }
  function firstNumericInNextRows(inputEl) {
    let tr = inputEl.closest('tr');
    while(tr && tr.nextElementSibling) {
      tr = tr.nextElementSibling;
      const cand = firstNumericInRow(tr);
      if(cand) return cand;
    }
    return null;
  }
  function focusCell(el) {
    if(!el) return;
    el.focus();
    if(el.select) el.select();
  }
  document.addEventListener('keydown', function(e) {
    if(e.key !== 'Enter') return;
    const active = document.activeElement;
    if(!isNumericInput(active)) return;
    if (e.ctrlKey || e.metaKey) {
      if (active.closest('#entry-tbody')) {
        e.preventDefault();
        saveAllRows();
      } else if (active.closest('#ung-tbody')) {
        e.preventDefault();
        saveAllUngRows();
      }
      return;
    }
    if (e.shiftKey) {
      if (active.closest('#entry-tbody')) {
        e.preventDefault();
        addRows(1);
        setTimeout(() => {
          const last = document.querySelector('#entry-tbody tr:last-child');
          focusCell(firstNumericInRow(last));
        }, 50);
      } else if (active.closest('#ung-tbody')) {
        e.preventDefault();
        addUngRows(1);
        setTimeout(() => {
          const last = document.querySelector('#ung-tbody tr:last-child');
          focusCell(firstNumericInRow(last));
        }, 50);
      }
      return;
    }
    const tr = active.closest('tr');
    const td = active.closest('td,th');
    if(!tr || !td) return;
    e.preventDefault();
    const right = nextNumericInSameRow(active);
    if(right) { focusCell(right); return; }
    const down = firstNumericInNextRows(active);
    if(down) focusCell(down);
  });
})();
