// doanhthu.js — Doanh Thu / Hop Dong / Dashboard
// Load order: 6

// ─── Biến toàn cục (main.js sẽ gán lại sau dbInit) ─────────────
let hopDongData      = load('hopdong_v1', {});
let thuRecords       = load('thu_v1', []);
let thauPhuContracts = load('thauphu_v1', []);

// Dashboard CT filter (dùng trong page-dashboard)
let selectedCT = '';

// Pagination state cho tab Doanh Thu
let _hdcPage  = 0;
let _hdtpPage = 0;
let _thuPage  = 0;
const DT_PG   = 7;

// ══════════════════════════════════════════════════════════════
// [MODULE: DASHBOARD] — KPI · Bar chart · Pie · Top5 · By CT
// Tìm nhanh: Ctrl+F → "MODULE: DASHBOARD"
// ══════════════════════════════════════════════════════════════

function renderDashboard() {
  const yr = activeYear;
  _dbPopulateCTFilter();

  // Tầng 1: tổng quan năm (không filter CT)
  const dataYear = buildInvoices().filter(i => inActiveYear(i.ngay));

  // Tầng 2: chi tiết theo CT (có filter)
  const dataDetail = buildInvoices().filter(i =>
    inActiveYear(i.ngay) &&
    (!selectedCT || i.congtrinh === selectedCT)
  );

  if (!dataYear.length) {
    ['db-kpi-row','db-bar-chart','db-pie-chart','db-top5','db-ung-ct','db-tb-ct'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<div class="db-empty">Chưa có dữ liệu cho năm ' + yr + '</div>';
    });
    return;
  }

  // Tổng quan năm — không bị filter CT
  _dbKPI(dataYear, yr);
  _dbBarChart(dataYear);
  _dbPieChart(dataYear);

  // Chi tiết theo CT — bị filter khi chọn CT
  _dbTop5(dataDetail);
  _dbUngByCT();
  _dbTBByCT();

  renderCtPage();   // Chi tiết từng CT (gộp từ tab cũ)
  renderLaiLo();    // Bảng lãi/lỗ
}

// ── Populate CT filter dropdown ────────────────────────────────
function _dbPopulateCTFilter() {
  const sel = document.getElementById('db-filter-ct');
  if (!sel) return;
  const cts = [...new Set([
    ...cats.congTrinh,
    ...buildInvoices().filter(i => inActiveYear(i.ngay)).map(i => i.congtrinh)
  ].filter(Boolean))].sort((a,b) => a.localeCompare(b,'vi'));
  sel.innerHTML = '<option value="">-- Tất cả công trình --</option>' +
    cts.map(v => `<option value="${x(v)}">${x(v)}</option>`).join('');
  sel.value = selectedCT;
}

// ── KPI Cards ─────────────────────────────────────────────────
function _dbKPI(data, yr) {
  const total   = data.reduce((s, i) => s + (i.thanhtien || i.tien || 0), 0);
  const months  = new Set(data.map(i => i.ngay?.slice(0,7))).size;
  const avgMonth= months ? Math.round(total / months) : 0;
  const maxInv  = data.reduce((mx, i) => (i.thanhtien||i.tien||0) > (mx.thanhtien||mx.tien||0) ? i : mx, data[0]);
  const ctSet   = new Set(data.map(i => i.congtrinh).filter(Boolean));

  const cards = [
    { label:'Tổng Chi Phí ' + yr,  val: fmtM(total),      sub: data.length + ' hóa đơn',         cls:'accent-gold'  },
    { label:'TB / Tháng',           val: fmtM(avgMonth),   sub: months + ' tháng có phát sinh',    cls:'accent-blue'  },
    { label:'HĐ Lớn Nhất',          val: fmtM(maxInv.thanhtien||maxInv.tien||0),
                                    sub: (maxInv.nd||maxInv.loai||'').slice(0,30),                  cls:'accent-red'   },
    { label:'Công Trình',           val: ctSet.size,       sub: 'đang theo dõi năm ' + yr,         cls:'accent-green' },
  ];

  document.getElementById('db-kpi-row').innerHTML = cards.map(k =>
    `<div class="db-kpi-card ${k.cls}">
       <div class="db-kpi-label">${k.label}</div>
       <div class="db-kpi-val">${k.val}</div>
       <div class="db-kpi-sub">${k.sub}</div>
     </div>`
  ).join('');
}

// ── Bar Chart theo tháng (SVG) — luôn hiện đủ T1→T12 ─────────
function _dbBarChart(data) {
  const byMonth = {};
  data.forEach(i => {
    const m = i.ngay?.slice(0,7);
    if (!m) return;
    byMonth[m] = (byMonth[m] || 0) + (i.thanhtien || i.tien || 0);
  });

  const yr = activeYear || new Date().getFullYear();
  const months12 = Array.from({length: 12}, (_, k) =>
    `${yr}-${String(k + 1).padStart(2, '0')}`
  );

  let vals;
  if (activeYear === 0) {
    const byNum = {};
    Object.entries(byMonth).forEach(([m, v]) => {
      const num = m.slice(5);
      byNum[num] = (byNum[num] || 0) + v;
    });
    vals = months12.map((_, i) => byNum[String(i + 1).padStart(2, '0')] || 0);
  } else {
    vals = months12.map(m => byMonth[m] || 0);
  }

  const maxVal = Math.max(...vals, 1);
  const H      = 160;
  const colW   = 40;
  const gap    = 5;
  const svgW   = 12 * (colW + gap);

  const bars = months12.map((m, i) => {
    const v   = vals[i];
    const h   = Math.round((v / maxVal) * H);
    const cx  = i * (colW + gap);
    const y   = H - h;
    const amt = v >= 1e9 ? (v/1e9).toFixed(1)+'tỷ'
              : v >= 1e6 ? Math.round(v/1e6)+'tr' : (v ? fmtS(v) : '');
    return `
      <g>
        <rect x="${cx}" y="${y}" width="${colW}" height="${Math.max(h, 2)}"
              rx="3" fill="${v ? 'var(--gold)' : 'var(--line)'}" opacity="${v ? '.85' : '.35'}">
          <title>T${i+1}: ${fmtM(v)}</title>
        </rect>
        <text x="${cx + colW/2}" y="${y - 4}" text-anchor="middle"
              font-size="9" fill="var(--ink2)">${h > 14 ? amt : ''}</text>
        <text x="${cx + colW/2}" y="${H + 14}" text-anchor="middle"
              font-size="9" fill="var(--ink3)">T${i+1}</text>
      </g>`;
  }).join('');

  document.getElementById('db-bar-chart').innerHTML =
    `<svg viewBox="0 -10 ${svgW} ${H + 28}" width="100%" class="db-pie-svg"
          style="min-width:${Math.min(svgW,300)}px;max-width:100%">
       ${bars}
       <line x1="0" y1="${H}" x2="${svgW}" y2="${H}" stroke="var(--line)" stroke-width="1"/>
     </svg>`;
}

// ── Pie Chart tỷ trọng (SVG) ─────────────────────────────────
function _dbPieChart(data) {
  const COLORS = ['#f0b429','#1db954','#4a90d9','#e74c3c','#9b59b6','#e67e22','#aaa'];
  const KEY_TYPES = ['Nhân Công','Vật Liệu XD','Thầu Phụ','Sắt Thép','Đổ Bê Tông'];

  const byType = {};
  data.forEach(i => {
    const k = KEY_TYPES.includes(i.loai) ? i.loai : 'Khác';
    byType[k] = (byType[k] || 0) + (i.thanhtien || i.tien || 0);
  });

  const total   = Object.values(byType).reduce((s,v) => s+v, 0);
  const entries = Object.entries(byType)
    .sort((a,b) => b[1]-a[1])
    .map(([name, val], i) => ({ name, val, pct: val/total, color: COLORS[i % COLORS.length] }));

  const R = 70, CX = 80, CY = 80;
  let startAngle = -Math.PI / 2;
  const slices = entries.map(e => {
    const angle = e.pct * Math.PI * 2;
    const x1 = CX + R * Math.cos(startAngle);
    const y1 = CY + R * Math.sin(startAngle);
    startAngle += angle;
    const x2 = CX + R * Math.cos(startAngle);
    const y2 = CY + R * Math.sin(startAngle);
    const large = angle > Math.PI ? 1 : 0;
    return `<path d="M${CX},${CY} L${x1.toFixed(1)},${y1.toFixed(1)}
              A${R},${R} 0 ${large},1 ${x2.toFixed(1)},${y2.toFixed(1)} Z"
              fill="${e.color}" stroke="#fff" stroke-width="2">
              <title>${e.name}: ${Math.round(e.pct*100)}%</title>
            </path>`;
  }).join('');

  const legend = entries.map(e =>
    `<div class="db-legend-row">
       <div class="db-legend-dot" style="background:${e.color}"></div>
       <span style="flex:1;color:var(--ink2)">${e.name}</span>
       <span class="db-legend-pct" style="color:${e.color}">${Math.round(e.pct*100)}%</span>
     </div>`
  ).join('');

  document.getElementById('db-pie-chart').innerHTML =
    `<svg viewBox="0 0 160 160" width="140" height="140" class="db-pie-svg">${slices}</svg>
     <div class="db-legend">${legend}</div>`;
}

// ── Top 5 hóa đơn lớn nhất ────────────────────────────────────
function _dbTop5(data) {
  const top5 = [...data]
    .sort((a,b) => (b.thanhtien||b.tien||0) - (a.thanhtien||a.tien||0))
    .slice(0, 5);
  const max  = top5[0] ? (top5[0].thanhtien||top5[0].tien||0) : 1;

  document.getElementById('db-top5').innerHTML = top5.map((inv, i) => {
    const amt = inv.thanhtien || inv.tien || 0;
    const pct = Math.round(amt / max * 100);
    return `<div class="db-rank-row">
      <div class="db-rank-num ${i===0?'top1':''}">${i===0?'🥇':i+1}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${inv.nd || inv.loai || '—'}
        </div>
        <div style="font-size:10px;color:var(--ink3)">${inv.ngay} · ${inv.congtrinh||'—'}</div>
        <div class="db-rank-bar-bg" style="margin-top:4px">
          <div class="db-rank-bar-fill" style="width:${pct}%"></div>
        </div>
      </div>
      <div class="db-rank-amt">${fmtM(amt)}</div>
    </div>`;
  }).join('');
}

// ── Chi phí theo Công Trình ────────────────────────────────────
function _dbByCT(data) {
  const byCT = {};
  data.forEach(i => {
    const k = i.congtrinh || '(Không rõ)';
    byCT[k] = (byCT[k] || 0) + (i.thanhtien || i.tien || 0);
  });
  const sorted = Object.entries(byCT).sort((a,b) => b[1]-a[1]);
  const max    = sorted[0]?.[1] || 1;

  document.getElementById('db-by-ct').innerHTML = sorted.map(([ct, amt], i) => {
    const pct = Math.round(amt / max * 100);
    return `<div class="db-rank-row">
      <div class="db-rank-num ${i===0?'top1':''}">${i+1}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis"
             title="${ct}">${ct}</div>
        <div class="db-rank-bar-bg" style="margin-top:4px">
          <div class="db-rank-bar-fill" style="width:${pct}%;background:${i===0?'var(--green)':'var(--gold)'}"></div>
        </div>
      </div>
      <div class="db-rank-amt">${fmtM(amt)}</div>
    </div>`;
  }).join('');
}

// ── Tổng Tiền Ứng theo Công Trình ─────────────────────────────
function _dbUngByCT() {
  const wrap = document.getElementById('db-ung-ct');
  if (!wrap) return;

  const filtered = ungRecords.filter(r =>
    !r.cancelled &&
    !r.deletedAt &&
    inActiveYear(r.ngay) &&
    (!selectedCT || r.congtrinh === selectedCT)
  );

  if (!filtered.length) {
    wrap.innerHTML = '<div class="db-empty">Chưa có tiền ứng</div>';
    return;
  }

  if (!selectedCT) {
    const byCT = {};
    filtered.forEach(r => {
      const k = r.congtrinh || '(Không rõ)';
      byCT[k] = (byCT[k] || 0) + (r.tien || 0);
    });
    const sorted = Object.entries(byCT).sort((a,b) => b[1]-a[1]);
    const max = sorted[0][1] || 1;
    wrap.innerHTML = sorted.map(([ct, amt], i) => {
      const pct = Math.round(amt / max * 100);
      return `<div class="db-rank-row">
        <div class="db-rank-num ${i===0?'top1':''}">${i+1}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis"
               title="${x(ct)}">${x(ct)}</div>
          <div class="db-rank-bar-bg" style="margin-top:4px">
            <div class="db-rank-bar-fill" style="width:${pct}%;background:#4a90d9"></div>
          </div>
        </div>
        <div class="db-rank-amt">${fmtM(amt)}</div>
      </div>`;
    }).join('');
  } else {
    const rows = [...filtered]
      .sort((a,b) => b.ngay.localeCompare(a.ngay))
      .map(r => `<tr style="border-bottom:1px solid var(--line)">
        <td style="padding:7px 8px;white-space:nowrap;color:var(--ink3);font-size:12px">${r.ngay}</td>
        <td style="padding:7px 8px;font-weight:600">${x(r.tp)||'—'}</td>
        <td style="padding:7px 8px;color:var(--ink2);font-size:12px">${x(r.nd)||'—'}</td>
        <td style="padding:7px 8px;text-align:right;font-family:'IBM Plex Mono',monospace;font-weight:700;color:#4a90d9;white-space:nowrap">${fmtM(r.tien||0)}</td>
      </tr>`).join('');
    const total = sumBy(filtered, 'tien');
    wrap.innerHTML = `<div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="font-size:11px;color:var(--ink3);border-bottom:2px solid var(--line)">
            <th style="text-align:left;padding:6px 8px;font-weight:600">Ngày</th>
            <th style="text-align:left;padding:6px 8px;font-weight:600">Thầu Phụ / NCC</th>
            <th style="text-align:left;padding:6px 8px;font-weight:600">Nội Dung</th>
            <th style="text-align:right;padding:6px 8px;font-weight:600">Số Tiền</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr style="font-weight:700;border-top:2px solid var(--line)">
            <td colspan="3" style="padding:7px 8px;color:var(--ink3)">Tổng cộng (${filtered.length} lần)</td>
            <td style="padding:7px 8px;text-align:right;font-family:'IBM Plex Mono',monospace;color:#4a90d9">${fmtM(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>`;
  }
}

// ── Thiết Bị theo Công Trình ───────────────────────────────────
function _dbTBByCT() {
  const wrap = document.getElementById('db-tb-ct');
  if (!wrap) return;

  const allTB = tbData.filter(t => t.ct !== TB_KHO_TONG);

  if (!allTB.length) {
    wrap.innerHTML = '<div class="db-empty">Chưa có thiết bị</div>';
    return;
  }

  if (!selectedCT) {
    const byCT = {};
    allTB.forEach(t => {
      const ct = t.ct || '(Không rõ)';
      if (!byCT[ct]) byCT[ct] = { total: 0, dangHD: 0, hdLau: 0, canSC: 0 };
      const sl = t.soluong || 0;
      byCT[ct].total  += sl;
      if (t.tinhtrang === 'Đang hoạt động') byCT[ct].dangHD += sl;
      else if (t.tinhtrang === 'Hoạt động lâu') byCT[ct].hdLau += sl;
      else if (t.tinhtrang === 'Cần sửa chữa') byCT[ct].canSC += sl;
    });

    const sorted = Object.entries(byCT).sort((a,b) => a[0].localeCompare(b[0],'vi'));
    wrap.innerHTML = sorted.map(([ct, s]) =>
      `<div style="padding:10px 0;border-bottom:1px solid var(--line)">
        <div style="font-weight:700;color:var(--ink);margin-bottom:6px">${x(ct)}</div>
        <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:12px">
          <span style="color:var(--ink3)">Tổng: <b style="color:var(--ink)">${s.total}</b></span>
          <span style="color:var(--green)">Đang hoạt động: <b>${s.dangHD}</b></span>
          <span style="color:var(--gold)">Hoạt động lâu: <b>${s.hdLau}</b></span>
          <span style="color:var(--red)">Cần sửa chữa: <b>${s.canSC}</b></span>
        </div>
      </div>`
    ).join('');
  } else {
    const filtered = allTB
      .filter(t => t.ct === selectedCT)
      .sort((a,b) => (a.ten||'').localeCompare(b.ten,'vi'));

    if (!filtered.length) {
      wrap.innerHTML = '<div class="db-empty">Chưa có thiết bị cho ' + x(selectedCT) + '</div>';
      return;
    }

    const rows = filtered.map(t => {
      const ttColor = t.tinhtrang === 'Đang hoạt động' ? 'var(--green)'
                    : t.tinhtrang === 'Hoạt động lâu'  ? 'var(--gold)'
                    : t.tinhtrang === 'Cần sửa chữa'   ? 'var(--red)'
                    : 'var(--ink3)';
      return `<tr style="border-bottom:1px solid var(--line)">
        <td style="padding:7px 8px;font-weight:600">${x(t.ten)}</td>
        <td style="padding:7px 8px;text-align:center;font-family:'IBM Plex Mono',monospace;font-weight:700;color:var(--gold)">${t.soluong||0}</td>
        <td style="padding:7px 8px;color:${ttColor}">${x(t.tinhtrang)||'—'}</td>
        <td style="padding:7px 8px;color:var(--ink3);font-size:12px">${x(t.ct)||'—'}</td>
      </tr>`;
    }).join('');

    wrap.innerHTML = `<div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="font-size:11px;color:var(--ink3);border-bottom:2px solid var(--line)">
            <th style="text-align:left;padding:6px 8px;font-weight:600">Tên Thiết Bị</th>
            <th style="text-align:center;padding:6px 8px;font-weight:600">SL</th>
            <th style="text-align:left;padding:6px 8px;font-weight:600">Tình Trạng</th>
            <th style="text-align:left;padding:6px 8px;font-weight:600">Công Trình</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }
}

// ══════════════════════════════════════════════════════════════
// [MODULE: DOANH THU — Khai Báo · Thống Kê]
// Ctrl+F → "MODULE: DOANH THU"
// ══════════════════════════════════════════════════════════════

// ── Helper: format input tiền tệ khi gõ ──────────────────────
function fmtInputMoney(el) {
  const raw = el.value.replace(/[^0-9]/g, '');
  el.dataset.raw = raw;
  el.value = raw ? parseInt(raw).toLocaleString('vi-VN') : '';
}

function _readMoneyInput(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  const raw = el.dataset.raw || el.value.replace(/[^0-9]/g, '');
  return parseInt(raw) || 0;
}

// ── Helper: kiểm tra record có thuộc năm đang chọn không ──────
function _dtInYear(ngay) {
  if (activeYear === 0) return true;
  if (!ngay) return true; // record cũ không có ngày → hiển thị trong mọi năm
  return inActiveYear(ngay);
}

// ── Helper: render HTML phân trang ────────────────────────────
function _dtPaginationHtml(total, curPage, onClickFn) {
  const pages = Math.ceil(total / DT_PG);
  if (pages <= 1) return '';
  const btns = [];
  if (curPage > 0)
    btns.push(`<button class="sub-nav-btn" onclick="${onClickFn}(${curPage - 1})">‹</button>`);
  for (let i = 0; i < pages; i++) {
    btns.push(`<button class="sub-nav-btn ${i === curPage ? 'active' : ''}" onclick="${onClickFn}(${i})">${i + 1}</button>`);
  }
  if (curPage < pages - 1)
    btns.push(`<button class="sub-nav-btn" onclick="${onClickFn}(${curPage + 1})">›</button>`);
  return btns.join('');
}

// ── Sub-tab navigation trong page-doanhthu ────────────────────
function dtGoSub(btn, id) {
  document.querySelectorAll('#page-doanhthu .sub-page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#page-doanhthu .sub-nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  btn.classList.add('active');
  if (id === 'dt-sub-thongke') {
    _hdcPage = 0; _hdtpPage = 0; _thuPage = 0;
    renderHdcTable(0);
    renderHdtpTable(0);
    renderThuTable(0);
  }
}

// ── Populate datalists trong tab Doanh Thu ────────────────────
function dtPopulateSels() {
  const allCts = [...new Set([
    ...cats.congTrinh,
    ...buildInvoices().map(i => i.congtrinh),
    ...thuRecords.filter(r => !r.deletedAt).map(r => r.congtrinh)
  ].filter(Boolean))].sort((a,b) => a.localeCompare(b,'vi'));

  const ctOpts = allCts.map(v => `<option value="${x(v)}">`).join('');
  ['hdc-ct-list','thu-ct-list','hdtp-ct-list'].forEach(id => {
    const dl = document.getElementById(id);
    if (dl) dl.innerHTML = ctOpts;
  });

  // Thầu phụ datalist
  const allTp = [...new Set([...cats.thauPhu].filter(Boolean))].sort((a,b) => a.localeCompare(b,'vi'));
  const tpDl = document.getElementById('hdtp-tp-list');
  if (tpDl) tpDl.innerHTML = allTp.map(v => `<option value="${x(v)}">`).join('');

  // Người TH datalist (từ cats.nguoiTH)
  const allNguoi = [...new Set([...cats.nguoiTH].filter(Boolean))].sort((a,b) => a.localeCompare(b,'vi'));
  const nguoiDl = document.getElementById('thu-nguoi-list');
  if (nguoiDl) nguoiDl.innerHTML = allNguoi.map(v => `<option value="${x(v)}">`).join('');

  // Refresh bảng THỐNG KÊ khi năm thay đổi
  renderHdcTable(_hdcPage);
  renderHdtpTable(_hdtpPage);
}

// ── Thêm CT mới vào danh mục nếu chưa có ─────────────────────
function _dtAddCT(name) {
  if (!name) return;
  if (!cats.congTrinh.includes(name)) {
    cats.congTrinh.push(name);
    cats.congTrinhYears = cats.congTrinhYears || {};
    cats.congTrinhYears[name] = activeYear || new Date().getFullYear();
    saveCats('congTrinh');
  }
}

// ── Thêm thầu phụ mới vào danh mục nếu chưa có ───────────────
function _dtAddTP(name) {
  if (!name) return;
  if (!cats.thauPhu.includes(name)) {
    cats.thauPhu.push(name);
    saveCats('thauPhu');
  }
}

// ══ PHẦN 1: HỢP ĐỒNG CHÍNH ════════════════════════════════════

// ── Cập nhật hiển thị Tổng HĐ Chính khi nhập ─────────────────
function hdcUpdateTotal() {
  const tong = _readMoneyInput('hdc-giatri') + _readMoneyInput('hdc-giatriphu') + _readMoneyInput('hdc-phatsinh');
  const el = document.getElementById('hdc-tong-label');
  if (el) el.textContent = tong ? 'Tổng: ' + fmtM(tong) : '';
}

// ── Lưu / Cập nhật Hợp Đồng Chính ────────────────────────────
function saveHopDongChinh() {
  const ctInput = document.getElementById('hdc-ct-input');
  const ct = ctInput?.value.trim();
  if (!ct) { toast('Vui lòng nhập Tên Công Trình!', 'error'); return; }

  const giaTri    = _readMoneyInput('hdc-giatri');
  const giaTriphu = _readMoneyInput('hdc-giatriphu');
  const phatSinh  = _readMoneyInput('hdc-phatsinh');
  const editId    = document.getElementById('hdc-edit-id')?.value || '';

  _dtAddCT(ct);
  const now = Date.now();

  if (editId) {
    const existing = hopDongData[editId] || {};
    if (editId !== ct) {
      // Đổi tên CT: tạo mới + xóa mềm cũ
      hopDongData[ct] = {
        giaTri, giaTriphu, phatSinh,
        ngay:      existing.ngay      || today(),
        createdAt: existing.createdAt || now,
        updatedAt: now,
        deletedAt: null
      };
      hopDongData[editId] = { ...existing, deletedAt: now, updatedAt: now };
    } else {
      hopDongData[editId] = { ...existing, giaTri, giaTriphu, phatSinh, updatedAt: now };
    }
    toast('✅ Đã cập nhật hợp đồng: ' + ct, 'success');
  } else {
    hopDongData[ct] = {
      giaTri, giaTriphu, phatSinh,
      ngay: today(), createdAt: now, updatedAt: now, deletedAt: null
    };
    toast('✅ Đã lưu hợp đồng: ' + ct, 'success');
  }

  save('hopdong_v1', hopDongData);
  _hdcResetForm();
  renderHdcTable(0);
  renderDashboard();
}

function _hdcResetForm() {
  ['hdc-ct-input','hdc-giatri','hdc-giatriphu','hdc-phatsinh'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = '';
    if (el.dataset) el.dataset.raw = '';
  });
  const editEl = document.getElementById('hdc-edit-id');
  if (editEl) editEl.value = '';
  const btn = document.getElementById('hdc-save-btn');
  if (btn) btn.textContent = '💾 Lưu';
  const tong = document.getElementById('hdc-tong-label');
  if (tong) tong.textContent = '';
}

// ── Sửa Hợp Đồng Chính ───────────────────────────────────────
function editHopDongChinh(ct) {
  const hd = hopDongData[ct];
  if (!hd) return;

  // Chuyển sang sub KHAI BÁO
  const kbBtn = document.getElementById('dt-sub-khaibao-btn');
  if (kbBtn) dtGoSub(kbBtn, 'dt-sub-khaibao');

  const ctInput = document.getElementById('hdc-ct-input');
  if (ctInput) ctInput.value = ct;

  function _setMoney(elemId, val) {
    const el = document.getElementById(elemId);
    if (!el) return;
    el.dataset.raw = val || 0;
    el.value = val ? parseInt(val).toLocaleString('vi-VN') : '';
  }
  _setMoney('hdc-giatri',    hd.giaTri    || 0);
  _setMoney('hdc-giatriphu', hd.giaTriphu || 0);
  _setMoney('hdc-phatsinh',  hd.phatSinh  || 0);

  const editEl = document.getElementById('hdc-edit-id');
  if (editEl) editEl.value = ct;
  const btn = document.getElementById('hdc-save-btn');
  if (btn) btn.textContent = '✏️ Cập nhật';

  hdcUpdateTotal();
  document.getElementById('hdc-ct-input')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ── Xóa mềm Hợp Đồng Chính ───────────────────────────────────
function delHopDongChinh(ct) {
  if (!confirm('Xóa hợp đồng của ' + ct + '?')) return;
  const now = Date.now();
  hopDongData[ct] = { ...(hopDongData[ct] || {}), deletedAt: now, updatedAt: now };
  save('hopdong_v1', hopDongData);
  renderHdcTable(_hdcPage);
  renderDashboard();
  toast('Đã xóa hợp đồng: ' + ct, 'success');
}

// ── Render bảng Hợp Đồng Chính ────────────────────────────────
function renderHdcTable(page) {
  page = page || 0;
  _hdcPage = page;
  const tbody  = document.getElementById('hdc-tbody');
  const empty  = document.getElementById('hdc-empty');
  const pgWrap = document.getElementById('hdc-pagination');
  if (!tbody) return;

  const entries = Object.entries(hopDongData)
    .filter(([, v]) => !v.deletedAt && _dtInYear(v.ngay))
    .sort((a, b) => a[0].localeCompare(b[0], 'vi'));

  if (!entries.length) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = '';
    if (pgWrap) pgWrap.innerHTML = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  const total = entries.length;
  const slice = entries.slice(page * DT_PG, (page + 1) * DT_PG);

  tbody.innerHTML = slice.map(([ct, hd]) => {
    const tong = (hd.giaTri || 0) + (hd.giaTriphu || 0) + (hd.phatSinh || 0);
    return `<tr>
      <td style="font-weight:600;min-width:130px">${x(ct)}</td>
      <td style="text-align:right;font-family:'IBM Plex Mono',monospace;white-space:nowrap">${hd.giaTri ? fmtS(hd.giaTri) : '<span style="color:var(--ink3)">—</span>'}</td>
      <td style="text-align:right;font-family:'IBM Plex Mono',monospace;white-space:nowrap">${hd.giaTriphu ? fmtS(hd.giaTriphu) : '<span style="color:var(--ink3)">—</span>'}</td>
      <td style="text-align:right;font-family:'IBM Plex Mono',monospace;white-space:nowrap">${hd.phatSinh ? fmtS(hd.phatSinh) : '<span style="color:var(--ink3)">—</span>'}</td>
      <td style="text-align:right;font-family:'IBM Plex Mono',monospace;font-weight:700;color:var(--gold);white-space:nowrap">${tong ? fmtS(tong) : '—'}</td>
      <td style="text-align:center;padding:4px 6px">
        <button class="btn btn-outline btn-sm" style="color:var(--blue)" title="Sửa"
          onclick="editHopDongChinh(this.dataset.ct)" data-ct="${x(ct)}">✏️</button>
      </td>
      <td style="text-align:center;padding:4px 6px">
        <button class="btn btn-outline btn-sm" style="color:var(--red)" title="Xóa"
          onclick="delHopDongChinh(this.dataset.ct)" data-ct="${x(ct)}">✕</button>
      </td>
    </tr>`;
  }).join('');

  if (pgWrap) pgWrap.innerHTML = _dtPaginationHtml(total, page, 'renderHdcTable');
}

// ══ PHẦN 2: GHI NHẬN THU TIỀN ═════════════════════════════════

// ── Lưu / Cập nhật bản ghi thu tiền ─────────────────────────
function saveThuRecord() {
  const ct    = document.getElementById('thu-ct-input')?.value.trim();
  const ngay  = document.getElementById('thu-ngay')?.value;
  const tien  = _readMoneyInput('thu-tien');
  const nguoi = (document.getElementById('thu-nguoi')?.value || '').trim().toUpperCase();
  const nd    = document.getElementById('thu-nd')?.value.trim() || '';
  const editId = document.getElementById('thu-edit-id')?.value || '';

  if (!ct)   { toast('Vui lòng nhập Công Trình!', 'error'); return; }
  if (!ngay) { toast('Vui lòng chọn Ngày!', 'error'); return; }
  if (!tien) { toast('Vui lòng nhập Số Tiền!', 'error'); return; }

  _dtAddCT(ct);
  const now = Date.now();

  if (editId) {
    // Cập nhật record hiện có
    const idx = thuRecords.findIndex(r => String(r.id) === String(editId));
    if (idx >= 0) {
      thuRecords[idx] = { ...thuRecords[idx], ngay, congtrinh: ct, tien, nguoi, nd, updatedAt: now, deviceId: DEVICE_ID };
    }
    save('thu_v1', thuRecords);
    _thuResetForm();
    renderThuTable(_thuPage);
    renderDashboard();
    toast('✅ Đã cập nhật thu tiền: ' + fmtM(tien) + ' — ' + ct, 'success');
  } else {
    // Tạo mới
    thuRecords.unshift({
      id: uuid(), createdAt: now, updatedAt: now, deletedAt: null, deviceId: DEVICE_ID,
      ngay, congtrinh: ct, tien, nguoi, nd
    });
    save('thu_v1', thuRecords);

    // Reset form nhẹ: chỉ xóa tiền, người, nội dung — giữ ct và ngày
    const tienEl = document.getElementById('thu-tien');
    if (tienEl) { tienEl.value = ''; tienEl.dataset.raw = ''; }
    const nguoiEl = document.getElementById('thu-nguoi');
    if (nguoiEl) nguoiEl.value = '';
    const ndEl = document.getElementById('thu-nd');
    if (ndEl) ndEl.value = '';

    renderThuTable(0);
    renderDashboard();
    toast('✅ Đã ghi nhận thu ' + fmtM(tien) + ' từ ' + ct, 'success');
  }
}

// ── Sửa bản ghi thu tiền (tải vào form KHAI BÁO) ─────────────
function editThuRecord(id) {
  const r = thuRecords.find(r => String(r.id) === String(id));
  if (!r) return;

  // Chuyển sang sub KHAI BÁO
  const kbBtn = document.getElementById('dt-sub-khaibao-btn');
  if (kbBtn) dtGoSub(kbBtn, 'dt-sub-khaibao');

  // Điền dữ liệu vào form
  const ctEl = document.getElementById('thu-ct-input');
  if (ctEl) ctEl.value = r.congtrinh || '';
  const ngayEl = document.getElementById('thu-ngay');
  if (ngayEl) ngayEl.value = r.ngay || '';
  const nguoiEl = document.getElementById('thu-nguoi');
  if (nguoiEl) nguoiEl.value = r.nguoi || '';
  const ndEl = document.getElementById('thu-nd');
  if (ndEl) ndEl.value = r.nd || '';

  // Điền tiền
  const tienEl = document.getElementById('thu-tien');
  if (tienEl) {
    tienEl.dataset.raw = r.tien || 0;
    tienEl.value = r.tien ? parseInt(r.tien).toLocaleString('vi-VN') : '';
  }

  // Đặt edit id + đổi nút
  const editEl = document.getElementById('thu-edit-id');
  if (editEl) editEl.value = id;
  const saveBtn = document.getElementById('thu-save-btn');
  if (saveBtn) saveBtn.textContent = '✏️ Cập nhật';
  const cancelBtn = document.getElementById('thu-cancel-btn');
  if (cancelBtn) cancelBtn.style.display = '';

  document.getElementById('thu-ct-input')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ── Hủy chỉnh sửa thu tiền ───────────────────────────────────
function _thuCancelEdit() {
  _thuResetForm();
  toast('Đã hủy chỉnh sửa', '');
}

// ── Reset toàn bộ form thu tiền ───────────────────────────────
function _thuResetForm() {
  ['thu-ct-input','thu-tien','thu-nguoi','thu-nd'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = '';
    if (el.dataset) el.dataset.raw = '';
  });
  const editEl = document.getElementById('thu-edit-id');
  if (editEl) editEl.value = '';
  const saveBtn = document.getElementById('thu-save-btn');
  if (saveBtn) saveBtn.textContent = '+ Ghi nhận Thu';
  const cancelBtn = document.getElementById('thu-cancel-btn');
  if (cancelBtn) cancelBtn.style.display = 'none';
}

// ── Xóa mềm bản ghi thu tiền ─────────────────────────────────
function delThuRecord(id) {
  if (!confirm('Xóa bản ghi thu tiền này?')) return;
  const idx = thuRecords.findIndex(r => String(r.id) === String(id));
  if (idx < 0) return;
  const now = Date.now();
  thuRecords[idx] = { ...thuRecords[idx], deletedAt: now, updatedAt: now, deviceId: DEVICE_ID };
  save('thu_v1', thuRecords);
  renderThuTable(_thuPage);
  renderDashboard();
  toast('Đã xóa bản ghi thu tiền', 'success');
}

// ── Render bảng lịch sử thu ───────────────────────────────────
function renderThuTable(page) {
  if (page === undefined) page = _thuPage;
  _thuPage = page;
  const tbody  = document.getElementById('thu-tbody');
  const empty  = document.getElementById('thu-empty');
  const badge  = document.getElementById('thu-count-badge');
  const pgWrap = document.getElementById('thu-pagination');
  if (!tbody) return;

  const filtered = thuRecords
    .filter(r => !r.deletedAt && inActiveYear(r.ngay))
    .sort((a, b) => b.ngay.localeCompare(a.ngay));

  if (badge) badge.textContent = filtered.length ? `(${filtered.length} đợt)` : '';

  if (!filtered.length) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = '';
    if (pgWrap) pgWrap.innerHTML = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  const total = filtered.length;
  const slice = filtered.slice(page * DT_PG, (page + 1) * DT_PG);

  tbody.innerHTML = slice.map(r => `
    <tr>
      <td style="white-space:nowrap;color:var(--ink3);font-size:12px">${r.ngay}</td>
      <td style="font-weight:600">${x(r.congtrinh)}</td>
      <td style="text-align:right;font-family:'IBM Plex Mono',monospace;font-weight:600;color:var(--green);white-space:nowrap">${fmtM(r.tien)}</td>
      <td style="color:var(--ink2)">${x(r.nguoi || '—')}</td>
      <td style="color:var(--ink3);font-size:12px">${x(r.nd || '—')}</td>
      <td style="text-align:center;padding:4px 6px">
        <button class="btn btn-outline btn-sm" style="color:var(--blue)" title="Sửa"
          onclick="editThuRecord('${r.id}')">✏️</button>
      </td>
      <td style="text-align:center;padding:4px 6px">
        <button class="btn btn-outline btn-sm" style="color:var(--red);padding:2px 8px" title="Xóa"
          onclick="delThuRecord('${r.id}')">✕</button>
      </td>
    </tr>`).join('');

  if (pgWrap) pgWrap.innerHTML = _dtPaginationHtml(total, page, 'renderThuTable');
}

// ══ PHẦN 3: HỢP ĐỒNG THẦU PHỤ ════════════════════════════════

// ── Cập nhật hiển thị Tổng HĐ Thầu Phụ khi nhập ─────────────
function hdtpUpdateTotal() {
  const tong = _readMoneyInput('hdtp-giatri') + _readMoneyInput('hdtp-phatsinh');
  const el = document.getElementById('hdtp-tong-label');
  if (el) el.textContent = tong ? 'Tổng: ' + fmtM(tong) : '';
}

// ── Lưu / Cập nhật Hợp Đồng Thầu Phụ ────────────────────────
function saveHopDongThauPhu() {
  const ct = document.getElementById('hdtp-ct-input')?.value.trim();
  const tp = (document.getElementById('hdtp-thauphu')?.value || '').trim().toUpperCase();
  if (!ct) { toast('Vui lòng nhập Tên Công Trình!', 'error'); return; }
  if (!tp) { toast('Vui lòng nhập Tên Thầu Phụ!', 'error'); return; }

  const giaTri   = _readMoneyInput('hdtp-giatri');
  const phatSinh = _readMoneyInput('hdtp-phatsinh');
  const nd       = document.getElementById('hdtp-nd')?.value.trim() || '';
  const editId   = document.getElementById('hdtp-edit-id')?.value || '';

  _dtAddCT(ct);
  _dtAddTP(tp);
  const now = Date.now();

  if (editId) {
    const idx = thauPhuContracts.findIndex(r => r.id === editId);
    if (idx >= 0) {
      thauPhuContracts[idx] = { ...thauPhuContracts[idx], congtrinh: ct, thauphu: tp, giaTri, phatSinh, nd, updatedAt: now };
    }
    toast('✅ Đã cập nhật HĐ thầu phụ', 'success');
  } else {
    thauPhuContracts.unshift({
      id: uuid(), createdAt: now, updatedAt: now, deletedAt: null, deviceId: DEVICE_ID,
      ngay: today(), congtrinh: ct, thauphu: tp, giaTri, phatSinh, nd
    });
    toast('✅ Đã lưu HĐ thầu phụ: ' + tp + ' — ' + ct, 'success');
  }

  save('thauphu_v1', thauPhuContracts);
  _hdtpResetForm();
  renderHdtpTable(0);
}

function _hdtpResetForm() {
  ['hdtp-ct-input','hdtp-thauphu','hdtp-giatri','hdtp-phatsinh','hdtp-nd'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = '';
    if (el.dataset) el.dataset.raw = '';
  });
  const editEl = document.getElementById('hdtp-edit-id');
  if (editEl) editEl.value = '';
  const btn = document.getElementById('hdtp-save-btn');
  if (btn) btn.textContent = '💾 Lưu';
  const tong = document.getElementById('hdtp-tong-label');
  if (tong) tong.textContent = '';
}

// ── Sửa Hợp Đồng Thầu Phụ ────────────────────────────────────
function editHopDongThauPhu(id) {
  const r = thauPhuContracts.find(r => r.id === id);
  if (!r) return;

  // Chuyển sang sub KHAI BÁO
  const kbBtn = document.getElementById('dt-sub-khaibao-btn');
  if (kbBtn) dtGoSub(kbBtn, 'dt-sub-khaibao');

  const ctInput = document.getElementById('hdtp-ct-input');
  if (ctInput) ctInput.value = r.congtrinh || '';
  const tpInput = document.getElementById('hdtp-thauphu');
  if (tpInput) tpInput.value = r.thauphu || '';
  const ndInput = document.getElementById('hdtp-nd');
  if (ndInput) ndInput.value = r.nd || '';

  function _setMoney(elemId, val) {
    const el = document.getElementById(elemId);
    if (!el) return;
    el.dataset.raw = val || 0;
    el.value = val ? parseInt(val).toLocaleString('vi-VN') : '';
  }
  _setMoney('hdtp-giatri',   r.giaTri   || 0);
  _setMoney('hdtp-phatsinh', r.phatSinh || 0);

  const editEl = document.getElementById('hdtp-edit-id');
  if (editEl) editEl.value = id;
  const btn = document.getElementById('hdtp-save-btn');
  if (btn) btn.textContent = '✏️ Cập nhật';

  hdtpUpdateTotal();
  document.getElementById('hdtp-ct-input')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ── Xóa mềm Hợp Đồng Thầu Phụ ────────────────────────────────
function delHopDongThauPhu(id) {
  if (!confirm('Xóa hợp đồng thầu phụ này?')) return;
  const idx = thauPhuContracts.findIndex(r => r.id === id);
  if (idx < 0) return;
  const now = Date.now();
  thauPhuContracts[idx] = { ...thauPhuContracts[idx], deletedAt: now, updatedAt: now };
  save('thauphu_v1', thauPhuContracts);
  renderHdtpTable(_hdtpPage);
  toast('Đã xóa hợp đồng thầu phụ', 'success');
}

// ── Render bảng Hợp Đồng Thầu Phụ ────────────────────────────
function renderHdtpTable(page) {
  page = page || 0;
  _hdtpPage = page;
  const tbody  = document.getElementById('hdtp-tbody');
  const empty  = document.getElementById('hdtp-empty');
  const pgWrap = document.getElementById('hdtp-pagination');
  if (!tbody) return;

  const filtered = thauPhuContracts
    .filter(r => !r.deletedAt && _dtInYear(r.ngay))
    .sort((a, b) => b.createdAt - a.createdAt);

  if (!filtered.length) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = '';
    if (pgWrap) pgWrap.innerHTML = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  const total = filtered.length;
  const slice = filtered.slice(page * DT_PG, (page + 1) * DT_PG);

  tbody.innerHTML = slice.map(r => {
    const tong = (r.giaTri || 0) + (r.phatSinh || 0);
    return `<tr>
      <td style="font-weight:600;min-width:120px">${x(r.congtrinh)}</td>
      <td style="min-width:110px">${x(r.thauphu)}</td>
      <td style="color:var(--ink3);font-size:12px;min-width:90px">${x(r.nd || '—')}</td>
      <td style="text-align:right;font-family:'IBM Plex Mono',monospace;white-space:nowrap">${r.giaTri ? fmtS(r.giaTri) : '<span style="color:var(--ink3)">—</span>'}</td>
      <td style="text-align:right;font-family:'IBM Plex Mono',monospace;white-space:nowrap">${r.phatSinh ? fmtS(r.phatSinh) : '<span style="color:var(--ink3)">—</span>'}</td>
      <td style="text-align:right;font-family:'IBM Plex Mono',monospace;font-weight:700;color:var(--gold);white-space:nowrap">${tong ? fmtS(tong) : '—'}</td>
      <td style="text-align:center;padding:4px 6px">
        <button class="btn btn-outline btn-sm" style="color:var(--blue)" title="Sửa"
          onclick="editHopDongThauPhu('${r.id}')">✏️</button>
      </td>
      <td style="text-align:center;padding:4px 6px">
        <button class="btn btn-outline btn-sm" style="color:var(--red)" title="Xóa"
          onclick="delHopDongThauPhu('${r.id}')">✕</button>
      </td>
    </tr>`;
  }).join('');

  if (pgWrap) pgWrap.innerHTML = _dtPaginationHtml(total, page, 'renderHdtpTable');
}

// ══ BẢNG LÃI/LỖ (Dashboard) ═══════════════════════════════════

// ── Render bảng Lãi/Lỗ trong Dashboard ───────────────────────
function renderLaiLo() {
  const wrap = document.getElementById('db-lailo-wrap');
  if (!wrap) return;

  // Tổng chi theo CT trong năm đang chọn
  const tongChi = {};
  buildInvoices().filter(i => inActiveYear(i.ngay)).forEach(i => {
    const ct = i.congtrinh || '(Không rõ)';
    tongChi[ct] = (tongChi[ct] || 0) + (i.thanhtien || i.tien || 0);
  });

  // Tổng đã thu theo CT trong năm đang chọn
  const daThu = {};
  thuRecords.filter(r => !r.deletedAt && inActiveYear(r.ngay)).forEach(r => {
    daThu[r.congtrinh] = (daThu[r.congtrinh] || 0) + (r.tien || 0);
  });

  // Hợp đồng theo CT (từ hopDongData — bỏ qua soft-deleted)
  const hdByCT = {};
  Object.entries(hopDongData).filter(([, v]) => !v.deletedAt).forEach(([ct, hd]) => {
    hdByCT[ct] = {
      giaTri:    hd.giaTri    || 0,
      giaTriphu: hd.giaTriphu || 0,
      phatSinh:  hd.phatSinh  || 0,
    };
  });

  // Gộp tất cả CT
  const allCts = [...new Set([
    ...Object.keys(tongChi),
    ...Object.keys(hdByCT)
  ])].filter(Boolean).sort((a, b) => a.localeCompare(b, 'vi'));

  if (!allCts.length) {
    wrap.innerHTML = '<div class="db-empty">Chưa có dữ liệu</div>';
    return;
  }

  let tongHD = 0, tongHDPhu = 0, tongPS = 0, tongDT = 0, tongChi_ = 0, tongThu = 0;

  const rows = allCts.map(ct => {
    const hd       = hdByCT[ct] || {};
    const giaTri   = hd.giaTri    || 0;
    const giaTriphu= hd.giaTriphu || 0;
    const phatSinh = hd.phatSinh  || 0;
    const tongDTct = giaTri + giaTriphu + phatSinh;
    const chi      = tongChi[ct] || 0;
    const thu      = daThu[ct]   || 0;
    const conPhaiThu = tongDTct - thu;
    const laiLo    = tongDTct - chi;
    const llClass  = laiLo > 0 ? 'll-pos' : laiLo < 0 ? 'll-neg' : 'll-zero';
    const llPrefix = laiLo > 0 ? '+' : '';

    tongHD    += giaTri;
    tongHDPhu += giaTriphu;
    tongPS    += phatSinh;
    tongDT    += tongDTct;
    tongChi_  += chi;
    tongThu   += thu;

    return `<tr>
      <td>${x(ct)}</td>
      <td>${giaTri    ? fmtS(giaTri)    : '<span style="color:var(--ink3)">—</span>'}</td>
      <td>${giaTriphu ? fmtS(giaTriphu) : '<span style="color:var(--ink3)">—</span>'}</td>
      <td>${phatSinh  ? fmtS(phatSinh)  : '<span style="color:var(--ink3)">—</span>'}</td>
      <td style="font-weight:600">${tongDTct ? fmtS(tongDTct) : '—'}</td>
      <td style="color:var(--red)">${fmtS(chi)}</td>
      <td style="color:var(--green)">${thu ? fmtS(thu) : '—'}</td>
      <td>${tongDTct ? fmtS(conPhaiThu) : '—'}</td>
      <td class="${llClass}">${tongDTct ? llPrefix + fmtS(laiLo) : '—'}</td>
    </tr>`;
  }).join('');

  const tongLaiLo  = tongDT - tongChi_;
  const tongLLClass = tongLaiLo > 0 ? 'll-pos' : tongLaiLo < 0 ? 'll-neg' : 'll-zero';

  wrap.innerHTML = `
    <div style="overflow-x:auto">
      <table class="ll-table">
        <thead>
          <tr>
            <th style="text-align:left;min-width:140px">Công Trình</th>
            <th>HĐ Chính</th>
            <th>HĐ Phụ</th>
            <th>Phát Sinh</th>
            <th>Tổng DT</th>
            <th>Tổng Chi</th>
            <th>Đã Thu</th>
            <th>Còn Phải Thu</th>
            <th>Lãi / Lỗ</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td style="text-align:left">TỔNG CỘNG</td>
            <td>${fmtS(tongHD)}</td>
            <td>${fmtS(tongHDPhu)}</td>
            <td>${fmtS(tongPS)}</td>
            <td style="font-weight:700">${fmtS(tongDT)}</td>
            <td style="color:var(--red);font-weight:700">${fmtS(tongChi_)}</td>
            <td style="color:var(--green);font-weight:700">${fmtS(tongThu)}</td>
            <td>${fmtS(tongDT - tongThu)}</td>
            <td class="${tongLLClass}">${tongDT ? (tongLaiLo >= 0 ? '+' : '') + fmtS(tongLaiLo) : '—'}</td>
          </tr>
        </tfoot>
      </table>
    </div>`;
}

// ── Init tab Doanh Thu khi mở ─────────────────────────────────
function initDoanhThu() {
  // Reload dữ liệu thầu phụ mới nhất
  thauPhuContracts = load('thauphu_v1', []);

  dtPopulateSels();

  // Set ngày mặc định = hôm nay nếu chưa có
  const ngayEl = document.getElementById('thu-ngay');
  if (ngayEl && !ngayEl.value) ngayEl.value = today();

  // Đảm bảo KHAI BÁO là sub-tab active mặc định
  const kbBtn = document.getElementById('dt-sub-khaibao-btn');
  const kbPage = document.getElementById('dt-sub-khaibao');
  const tkBtn  = document.getElementById('dt-sub-thongke-btn');
  const tkPage = document.getElementById('dt-sub-thongke');
  if (kbBtn && kbPage && tkBtn && tkPage) {
    kbPage.classList.add('active');    tkPage.classList.remove('active');
    kbBtn.classList.add('active');     tkBtn.classList.remove('active');
  }

  // Reset edit state
  _hdcResetForm();
  _hdtpResetForm();
}

// ── Backward compat: hàm cũ được giữ lại để tránh crash ──────
function saveHopDong()        { saveHopDongChinh(); }
function hdLoadCT()           { /* deprecated */ }
function renderHopDongList()  { renderHdcTable(_hdcPage); }
function delHopDong(ct)       { delHopDongChinh(ct); }
