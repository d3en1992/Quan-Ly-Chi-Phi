// main.js — Global State / init() / goPage() / Year Filter
// Load order: 7 — LOAD CUOI CUNG

// Nam dang xem (0 = tat ca nam)
let activeYear = new Date().getFullYear();

// ══════════════════════════════
//  INIT
// ══════════════════════════════
function init() {
  document.getElementById('entry-date').value = today();
  document.getElementById('ung-date').value = today();

  // Hiển thị dữ liệu local ngay lập tức
  initTable(5);
  initUngTable(4);
  initCC();
  updateTop();
  updateJbBtn();

  // ── Nâng cấp schema nếu cần (chạy trước khi dùng data) ──
  migrateData();

  // ── Bắt đầu auto backup ngầm mỗi 30 phút ──────────────────
  autoBackup();

  // Tự động tạo HĐ nhân công nếu có CC data nhưng chưa có HĐ (vd: sau khi import Excel)
  autoRebuildCCIfNeeded();

  buildYearSelect();
  renderTrash();
  renderTodayInvoices();

  // Tự động đo chiều cao topbar và cập nhật padding cho body
  // Giải quyết vấn đề topbar sticky che khuất content trên mobile khi nút rớt dòng
  (function syncTopbarHeight() {
    const topbar = document.querySelector('.topbar');
    const body   = document.body;
    function update() {
      const h = topbar ? topbar.getBoundingClientRect().height : 0;
      // Thêm CSS variable để dùng ở bất cứ đâu nếu cần
      document.documentElement.style.setProperty('--topbar-h', h + 'px');
    }
    update();
    // Theo dõi khi topbar thay đổi chiều cao (wrap nút, resize cửa sổ)
    if (window.ResizeObserver) {
      new ResizeObserver(update).observe(topbar);
    }
    window.addEventListener('resize', update);
  })();

  // X: Topbar compact khi cuộn
  (function initTopbarCompact() {
    window.addEventListener('scroll', () => {
      document.querySelector('.topbar')?.classList.toggle('compact', window.scrollY > 80);
    }, { passive: true });
  })();

  // Tải dữ liệu mới nhất từ cloud (nếu đã có Bin ID)
  gsLoadAll(function(data) {
    if (!data) return;
    invoices    = load('inv_v3', []);
    ungRecords  = load('ung_v1', []);
    ccData      = load('cc_v2', []);
    tbData      = load('tb_v1', []);
    cats.congTrinh      = load('cat_ct',       DEFAULTS.congTrinh);
    cats.congTrinhYears = load('cat_ct_years', {});
    cats.loaiChiPhi     = load('cat_loai',     DEFAULTS.loaiChiPhi);
    cats.nhaCungCap     = load('cat_ncc',      DEFAULTS.nhaCungCap);
    cats.nguoiTH        = load('cat_nguoi',    DEFAULTS.nguoiTH);
    buildYearSelect(); updateTop();
    rebuildEntrySelects(); rebuildCCNameList(); populateCCCtSel();
    initTable(5); initUngTable(4); initCC();
    const built2 = rebuildInvoicesFromCC();
    updateTop();
    toast(`✅ Đồng bộ xong! ${built2.weeks} HĐ nhân công, ${built2.cts} CT mới`, 'success');
  });
}

function today() { return new Date().toISOString().split('T')[0]; }


// ══════════════════════════════
//  NAVIGATION
// ══════════════════════════════
function goPage(btn, id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-'+id).classList.add('active');
  btn.classList.add('active');
  if (id==='nhap') {
    // Lấy sub-tab đang active, gọi render tương ứng
    const activeSub = document.querySelector('#page-nhap .sub-page.active');
    if (activeSub) {
      if (activeSub.id === 'sub-hom-nay') renderTodayInvoices();
      else if (activeSub.id === 'sub-tat-ca') { buildFilters(); filterAndRender(); }
      else if (activeSub.id === 'sub-da-xoa') renderTrash();
      else renderTodayInvoices(); // sub-nhap-hd: không cần render thêm, nhưng update today nếu cần
    }
  }
  if (id==='danhmuc') renderSettings();
  if (id==='dashboard') renderDashboard();
  if (id==='doanhthu') initDoanhThu();
  if (id==='nhapung') { initUngTableIfEmpty(); buildUngFilters(); filterAndRenderUng(); }
  if (id==='chamcong') { populateCCCtSel(); rebuildCCNameList(); renderCCHistory(); renderCCTLT(); }
  if (id==='thietbi') { tbPopulateSels(); tbBuildRows(5); tbRenderList(); tbRenderThongKeVon(); }
}

// Sub-tab navigation bên trong page-nhap
function goSubPage(btn, id) {
  document.querySelectorAll('#page-nhap .sub-page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#page-nhap .sub-nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  btn.classList.add('active');
  if (id === 'sub-hom-nay') { renderTodayInvoices(); }
  if (id === 'sub-tat-ca')  { buildFilters(); filterAndRender(); }
  if (id === 'sub-da-xoa')  { renderTrash(); }
}

function onYearChange() {
  const sel = document.getElementById('global-year');
  if(sel) activeYear = parseInt(sel.value) || 0;

  // Nếu chọn "Tất cả" → hiển thị luôn, không cần tải từ cloud
  if(activeYear === 0) { _refreshAllTabs(); return; }

  const ys = String(activeYear);
  const hasLocal = invoices.some(i=>i.ngay&&i.ngay.startsWith(ys))
    || ccData.some(w=>w.fromDate&&w.fromDate.startsWith(ys))
    || ungRecords.some(u=>u.ngay&&u.ngay.startsWith(ys));

  if(!hasLocal && fbReady()) {
    showSyncBanner('⏳ Đang tải dữ liệu năm ' + activeYear + '...');
    gsLoadAll(function(data) {
      invoices   = load('inv_v3', []);
      ungRecords = load('ung_v1', []);
      ccData     = load('cc_v2', []);
      tbData     = load('tb_v1', []);
      rebuildInvoicesFromCC();
      invoices   = load('inv_v3', []);
      buildYearSelect();
      _refreshAllTabs();
      hideSyncBanner();
      toast('✅ Đã tải năm ' + activeYear + ' từ Firebase!', 'success');
    });
    return;
  }
  _refreshAllTabs();
}

function _refreshAllTabs() {
  // Refresh DATA cho tất cả tab (không chỉ tab đang active)
  // → đảm bảo khi đổi năm, mọi tab đều nhất quán khi mở

  // Tầng 1: Rebuild filter dropdowns theo năm mới
  buildFilters();
  buildUngFilters();
  buildCCHistFilters();
  populateCCCtSel();        // dropdown CT trong Chấm Công
  tbPopulateSels();         // dropdown CT trong Thiết Bị
  rebuildEntrySelects();    // dropdown CT trong bảng nhập HĐ đang mở
  rebuildUngSelects();      // dropdown CT trong bảng nhập tiền ứng đang mở
  renderSettings();         // Tab Danh Mục — lọc CT theo năm mới

  // Tầng 2: Render lại nội dung TẤT CẢ các tab
  filterAndRender();        // Tất cả CP
  renderTrash();
  filterAndRenderUng();     // Tiền Ứng
  renderCtPage();           // Tổng CP CT
  renderCCHistory();        // Lịch sử CC
  renderCCTLT();            // Tổng lương tuần
  renderTodayInvoices();    // HĐ trong ngày (tab Nhập)
  tbRenderList();           // Thiết Bị
  renderDashboard();        // Dashboard

  dtPopulateSels();          // dropdowns tab Doanh Thu
  renderThuTable();          // lịch sử thu tiền
  renderLaiLo();             // bảng lãi/lỗ trong Dashboard
  // Topbar tổng
  updateTop();
}

init(); // Khoi dong app