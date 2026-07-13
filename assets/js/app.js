/* ============================================
   AI TOOLCOR — CORE APP.JS (v2.0)
   business.aitoolcor.com
   Dynamic, Optimized & Production-Ready
   ============================================ */

'use strict';

// ============================================
// AUTH CHECK (Early - Before DOM)
// ============================================
(function checkAuth() {
  const isLoginPage = window.location.pathname.includes('login');
  const isAuth = localStorage.getItem('bd_auth') === 'true';

  if (!isAuth && !isLoginPage) {
    window.location.replace('login.html');
  } else if (isAuth && isLoginPage) {
    window.location.replace('index.html');
  }
})();

// ============================================
// APP CONFIG
// ============================================
const APP = {
  name: 'AI Toolcor',
  version: '2.0.0',
  storageKey: 'bd_transactions',
  backupKey: 'bd_last_backup',
  userKey: 'bd_user',
  authKey: 'bd_auth',
  currency: '₹',
  locale: 'en-IN',
  timezone: 'Asia/Kolkata',
  maxToasts: 3,
  autoBackupDays: 7,
  ready: false
};

// ============================================
// STORAGE MANAGER (Cached + Safe)
// ============================================
const Store = {
  _cache: null,
  _listeners: new Set(),

  get() {
    if (this._cache === null) {
      try {
        const raw = localStorage.getItem(APP.storageKey);
        this._cache = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(this._cache)) this._cache = [];
      } catch (err) {
        console.error('Storage read error:', err);
        this._cache = [];
      }
    }
    return this._cache;
  },

  save(data) {
    if (!Array.isArray(data)) return false;
    try {
      this._cache = data;
      localStorage.setItem(APP.storageKey, JSON.stringify(data));
      this._notify();
      return true;
    } catch (err) {
      console.error('Storage save error:', err);
      if (err.name === 'QuotaExceededError') {
        toast('Storage full! Export data to free space.', 'error');
      }
      return false;
    }
  },

  add(transaction) {
    const data = this.get();
    data.push(transaction);
    return this.save(data);
  },

  update(id, updates) {
    const data = this.get();
    const idx = data.findIndex(t => t.id === id);
    if (idx === -1) return false;
    data[idx] = { ...data[idx], ...updates, updatedAt: new Date().toISOString() };
    return this.save(data);
  },

  remove(id) {
    const data = this.get().filter(t => t.id !== id);
    return this.save(data);
  },

  removeMany(ids) {
    const idSet = new Set(ids);
    const data = this.get().filter(t => !idSet.has(t.id));
    return this.save(data);
  },

  find(id) {
    return this.get().find(t => t.id === id) || null;
  },

  clear() {
    this._cache = [];
    localStorage.removeItem(APP.storageKey);
    this._notify();
  },

  invalidate() {
    this._cache = null;
  },

  // Reactive: subscribe to data changes
  subscribe(callback) {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  },

  _notify() {
    this._listeners.forEach(cb => {
      try { cb(this._cache); } catch (e) { console.error(e); }
    });
  },

  // Storage stats
  getStats() {
    try {
      const raw = localStorage.getItem(APP.storageKey) || '';
      const bytes = new Blob([raw]).size;
      return {
        count: this.get().length,
        bytes,
        kb: (bytes / 1024).toFixed(2),
        mb: (bytes / 1024 / 1024).toFixed(3)
      };
    } catch {
      return { count: 0, bytes: 0, kb: 0, mb: 0 };
    }
  }
};

// Legacy compatibility
function getTxns() { return Store.get(); }
function saveTxns(d) { return Store.save(d); }

// ============================================
// CURRENCY FORMATTER
// ============================================
const CurrencyFormatter = new Intl.NumberFormat(APP.locale, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const CurrencyFormatterNoDecimal = new Intl.NumberFormat(APP.locale, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});

function inr(a) {
  const n = parseFloat(a);
  if (isNaN(n)) return APP.currency + ' 0.00';
  return APP.currency + ' ' + CurrencyFormatter.format(n);
}

function inrShort(a) {
  const n = parseFloat(a);
  if (isNaN(n)) return APP.currency + '0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';

  if (abs >= 10000000) return sign + APP.currency + (abs / 10000000).toFixed(2).replace(/\.?0+$/, '') + 'Cr';
  if (abs >= 100000) return sign + APP.currency + (abs / 100000).toFixed(2).replace(/\.?0+$/, '') + 'L';
  if (abs >= 1000) return sign + APP.currency + (abs / 1000).toFixed(1).replace(/\.?0+$/, '') + 'K';
  return sign + APP.currency + CurrencyFormatterNoDecimal.format(abs);
}

function inrPlain(a) {
  const n = parseFloat(a) || 0;
  return CurrencyFormatter.format(n);
}

// ============================================
// DATE UTILITIES
// ============================================
const DateUtil = {
  _cache: new Map(),

  today() {
    return new Date().toISOString().split('T')[0];
  },

  now() {
    return new Date();
  },

  parse(d) {
    if (!d) return null;
    if (d instanceof Date) return d;
    const cached = this._cache.get(d);
    if (cached) return new Date(cached);
    const date = new Date(d);
    if (isNaN(date)) return null;
    return date;
  },

  format(d, opts = {}) {
    const date = this.parse(d);
    if (!date) return '-';
    return date.toLocaleDateString(APP.locale, {
      day: '2-digit', month: 'short', year: 'numeric',
      ...opts
    });
  },

  formatFull(d) {
    const date = this.parse(d);
    if (!date) return '-';
    return date.toLocaleDateString(APP.locale, {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
    });
  },

  formatTime(d) {
    const date = this.parse(d);
    if (!date) return '-';
    return date.toLocaleTimeString(APP.locale, {
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  },

  formatRelative(d) {
    const date = this.parse(d);
    if (!date) return '-';
    const now = new Date();
    const diff = now - date;
    const secs = Math.floor(diff / 1000);
    const mins = Math.floor(secs / 60);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    if (secs < 60) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return this.format(date);
  },

  isToday(d) {
    return d === this.today();
  },

  isYesterday(d) {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    return d === y.toISOString().split('T')[0];
  },

  isThisWeek(d) {
    const date = this.parse(d);
    if (!date) return false;
    const now = new Date();
    const s = new Date(now);
    const day = now.getDay() || 7; // Sunday = 0 → 7
    s.setDate(now.getDate() - day + 1);
    s.setHours(0, 0, 0, 0);
    const e = new Date(s);
    e.setDate(s.getDate() + 6);
    e.setHours(23, 59, 59, 999);
    return date >= s && date <= e;
  },

  isLastWeek(d) {
    const date = this.parse(d);
    if (!date) return false;
    const now = new Date();
    const day = now.getDay() || 7;
    const s = new Date(now);
    s.setDate(now.getDate() - day - 6);
    s.setHours(0, 0, 0, 0);
    const e = new Date(s);
    e.setDate(s.getDate() + 6);
    e.setHours(23, 59, 59, 999);
    return date >= s && date <= e;
  },

  isThisMonth(d) {
    const date = this.parse(d);
    if (!date) return false;
    const n = new Date();
    return date.getMonth() === n.getMonth() && date.getFullYear() === n.getFullYear();
  },

  isLastMonth(d) {
    const date = this.parse(d);
    if (!date) return false;
    const n = new Date();
    const lm = new Date(n.getFullYear(), n.getMonth() - 1, 1);
    return date.getMonth() === lm.getMonth() && date.getFullYear() === lm.getFullYear();
  },

  isThisYear(d) {
    const date = this.parse(d);
    if (!date) return false;
    return date.getFullYear() === new Date().getFullYear();
  },

  isLastYear(d) {
    const date = this.parse(d);
    if (!date) return false;
    return date.getFullYear() === new Date().getFullYear() - 1;
  },

  inRange(d, start, end) {
    const date = this.parse(d);
    const st = this.parse(start);
    const en = this.parse(end);
    if (!date || !st || !en) return false;
    en.setHours(23, 59, 59, 999);
    return date >= st && date <= en;
  },

  daysBetween(d1, d2) {
    const a = this.parse(d1);
    const b = this.parse(d2);
    if (!a || !b) return 0;
    return Math.abs(Math.floor((b - a) / (1000 * 60 * 60 * 24)));
  }
};

// Legacy compatibility
function today() { return DateUtil.today(); }
function fmtDate(d) { return DateUtil.format(d); }
function fmtDateFull(d) { return DateUtil.formatFull(d); }
function isToday(d) { return DateUtil.isToday(d); }
function isYesterday(d) { return DateUtil.isYesterday(d); }
function isThisWeek(d) { return DateUtil.isThisWeek(d); }
function isLastWeek(d) { return DateUtil.isLastWeek(d); }
function isThisMonth(d) { return DateUtil.isThisMonth(d); }
function isLastMonth(d) { return DateUtil.isLastMonth(d); }
function isThisYear(d) { return DateUtil.isThisYear(d); }
function inRange(d, s, e) { return DateUtil.inRange(d, s, e); }

// ============================================
// CALCULATIONS
// ============================================
function calcTotals(txns) {
  if (!Array.isArray(txns) || !txns.length) {
    return { income: 0, expense: 0, profit: 0, count: 0 };
  }

  let income = 0, expense = 0;
  const len = txns.length;

  for (let i = 0; i < len; i++) {
    const x = txns[i];
    if (!x) continue;
    const amt = parseFloat(x.amount);
    if (isNaN(amt)) continue;
    if (x.type === 'income') income += amt;
    else if (x.type === 'expense') expense += amt;
  }

  return {
    income: Math.round(income * 100) / 100,
    expense: Math.round(expense * 100) / 100,
    profit: Math.round((income - expense) * 100) / 100,
    count: len
  };
}

function filterByPeriod(txns, period, start, end) {
  if (!Array.isArray(txns) || !txns.length) return [];
  if (period === 'all' || !period) return txns;

  const filters = {
    today: x => DateUtil.isToday(x.date),
    yesterday: x => DateUtil.isYesterday(x.date),
    week: x => DateUtil.isThisWeek(x.date),
    lastweek: x => DateUtil.isLastWeek(x.date),
    month: x => DateUtil.isThisMonth(x.date),
    lastmonth: x => DateUtil.isLastMonth(x.date),
    year: x => DateUtil.isThisYear(x.date),
    lastyear: x => DateUtil.isLastYear(x.date),
    custom: x => start && end ? DateUtil.inRange(x.date, start, end) : true
  };

  const fn = filters[period];
  return fn ? txns.filter(fn) : txns;
}

// ============================================
// HELPERS
// ============================================
function uid() {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
}

function debounce(fn, wait = 300) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

function throttle(fn, limit = 300) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function truncate(str, len = 20) {
  if (!str) return '-';
  const s = String(str);
  return s.length > len ? s.slice(0, len) + '...' : s;
}

function $(selector, parent = document) {
  return parent.querySelector(selector);
}

function $$(selector, parent = document) {
  return Array.from(parent.querySelectorAll(selector));
}

function el(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const e = el(id);
  if (e) e.textContent = value;
}

function setHTML(id, value) {
  const e = el(id);
  if (e) e.innerHTML = value;
}

// ============================================
// MODAL MANAGER
// ============================================
const Modal = {
  _openStack: [],

  open(id) {
    const m = el(id);
    if (!m) return;
    m.classList.add('open');
    this._openStack.push(id);
    document.body.style.overflow = 'hidden';

    // Focus first input
    setTimeout(() => {
      const firstInput = m.querySelector('input:not([type="hidden"]), select, textarea');
      if (firstInput) firstInput.focus();
    }, 200);
  },

  close(id) {
    const m = el(id);
    if (!m) return;
    m.classList.remove('open');
    this._openStack = this._openStack.filter(x => x !== id);
    if (!this._openStack.length) {
      document.body.style.overflow = '';
    }
  },

  closeAll() {
    $$('.modal-bg.open').forEach(m => m.classList.remove('open'));
    this._openStack = [];
    document.body.style.overflow = '';
  }
};

function openModal(id) { Modal.open(id); }
function closeModal(id) { Modal.close(id); }

// Modal event listeners
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-bg')) {
    const id = e.target.id;
    if (id) Modal.close(id);
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && Modal._openStack.length) {
    Modal.close(Modal._openStack[Modal._openStack.length - 1]);
  }
});

// ============================================
// TOAST NOTIFICATIONS
// ============================================
const Toast = {
  _queue: [],
  _active: 0,

  show(msg, type = 'success', duration = 3000) {
    const container = el('toastBox');
    if (!container) return;

    // Remove oldest if too many
    if (this._active >= APP.maxToasts) {
      const oldest = container.firstElementChild;
      if (oldest) oldest.remove();
      this._active--;
    }

    const icons = {
      success: '✅', error: '❌',
      warning: '⚠️', info: 'ℹ️'
    };

    const colors = {
      success: 'var(--income)',
      error: 'var(--expense)',
      warning: 'var(--profit)',
      info: 'var(--brand)'
    };

    const t = document.createElement('div');
    t.className = 'toast';
    t.style.borderLeftColor = colors[type] || colors.success;
    t.innerHTML = `
      <span>${icons[type] || '✅'}</span>
      <span>${escapeHtml(msg)}</span>
    `;

    container.appendChild(t);
    this._active++;

    // Auto-dismiss
    setTimeout(() => this._dismiss(t), duration);
  },

  _dismiss(t) {
    if (!t || !t.parentNode) return;
    t.style.opacity = '0';
    t.style.transform = 'translateX(20px)';
    setTimeout(() => {
      if (t.parentNode) {
        t.remove();
        this._active--;
      }
    }, 300);
  }
};

function toast(msg, type = 'success') {
  Toast.show(msg, type);
}

// ============================================
// CONFIRM DIALOG
// ============================================
function confirmDel(msg, opts = {}) {
  const {
    title = '⚠️ Confirm Delete',
    okText = 'Delete',
    cancelText = 'Cancel',
    danger = true
  } = opts;

  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-bg open';
    overlay.setAttribute('role', 'dialog');
    overlay.innerHTML = `
      <div class="modal" style="max-width:400px;">
        <div class="modal-hd">
          <h3>${escapeHtml(title)}</h3>
        </div>
        <div class="modal-bd">
          <p style="font-size:0.9rem;color:var(--text-body);line-height:1.6;">${msg}</p>
        </div>
        <div class="modal-ft">
          <button class="btn btn-outline" data-action="cancel">${escapeHtml(cancelText)}</button>
          <button class="btn ${danger ? 'btn-expense' : 'btn-primary'}" data-action="confirm">${escapeHtml(okText)}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    const cleanup = (result) => {
      document.body.style.overflow = '';
      overlay.remove();
      resolve(result);
    };

    overlay.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      if (action === 'confirm') cleanup(true);
      else if (action === 'cancel' || e.target === overlay) cleanup(false);
    });

    // Escape key
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', escHandler);
        cleanup(false);
      }
    };
    document.addEventListener('keydown', escHandler);

    // Focus confirm button
    setTimeout(() => {
      overlay.querySelector('[data-action="confirm"]')?.focus();
    }, 200);
  });
}

// ============================================
// AMOUNT PREVIEW
// ============================================
function previewAmt(type) {
  const isIncome = type === 'income';
  const amtEl = el(isIncome ? 'iAmt' : 'eAmt');
  const previewEl = el(isIncome ? 'iPreview' : 'ePreview');
  const valEl = el(isIncome ? 'iPreviewVal' : 'ePreviewVal');

  if (!amtEl || !previewEl || !valEl) return;

  const amt = parseFloat(amtEl.value);
  if (!isNaN(amt) && amt > 0) {
    previewEl.style.display = 'flex';
    valEl.textContent = inr(amt);
  } else {
    previewEl.style.display = 'none';
  }
}

// ============================================
// HEADER DATE/TIME (Live Clock)
// ============================================
const Clock = {
  _interval: null,

  start() {
    this.update();
    if (this._interval) clearInterval(this._interval);
    this._interval = setInterval(() => this.update(), 1000);
  },

  stop() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  },

  update() {
    const now = new Date();
    const dateStr = now.toLocaleDateString(APP.locale, {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
    });
    const timeStr = now.toLocaleTimeString(APP.locale, {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    });

    setText('headerDate', dateStr);
    setText('liveTime', 'LIVE ' + timeStr);
  }
};

function updateHeaderDateTime() {
  Clock.update();
}

// Auto-start clock
Clock.start();

// Pause clock when tab hidden (performance)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) Clock.stop();
  else Clock.start();
});

// ============================================
// SIDEBAR MANAGER
// ============================================
const Sidebar = {
  isOpen: false,

  toggle() {
    this.isOpen ? this.close() : this.open();
  },

  open() {
    const s = el('sidebar');
    const o = el('overlay');
    if (!s) return;
    s.classList.add('open');
    if (o) o.style.display = 'block';
    this.isOpen = true;
    document.body.style.overflow = 'hidden';
  },

  close() {
    const s = el('sidebar');
    const o = el('overlay');
    if (!s) return;
    s.classList.remove('open');
    if (o) o.style.display = 'none';
    this.isOpen = false;
    document.body.style.overflow = '';
  }
};

function toggleSidebar() { Sidebar.toggle(); }
function closeSidebar() { Sidebar.close(); }

// Auto-close sidebar on desktop resize
window.addEventListener('resize', debounce(() => {
  if (window.innerWidth > 900 && Sidebar.isOpen) {
    Sidebar.close();
  }
}, 200));

// Close sidebar when clicking a link on mobile
document.addEventListener('click', (e) => {
  const link = e.target.closest('.sb-link');
  if (link && window.innerWidth <= 900 && Sidebar.isOpen) {
    setTimeout(() => Sidebar.close(), 150);
  }
});

// ============================================
// LOGOUT
// ============================================
async function logout() {
  const confirmed = await confirmDel(
    'Are you sure you want to sign out of your account?',
    { title: '🚪 Sign Out', okText: 'Sign Out', danger: false }
  );
  if (!confirmed) return;

  localStorage.removeItem(APP.authKey);
  localStorage.removeItem(APP.userKey);
  toast('Signing out...', 'info');
  setTimeout(() => {
    window.location.replace('login.html');
  }, 500);
}

// ============================================
// EXPORT EXCEL
// ============================================
function exportExcel() {
  const t = getTxns();
  if (!t.length) {
    toast('No data to export!', 'warning');
    return;
  }

  if (typeof XLSX === 'undefined') {
    toast('Excel library not loaded!', 'error');
    return;
  }

  try {
    const rows = t.map((x, i) => ({
      '#': i + 1,
      'Date': fmtDate(x.date),
      'Type': x.type === 'income' ? 'Income' : 'Expense',
      'Category': x.category || '-',
      'Amount (₹)': parseFloat(x.amount) || 0,
      'Mode': x.mode || 'Cash',
      'Customer/Vendor': x.from || x.vendor || '-',
      'Notes': x.notes || '-',
      'Created': x.savedAt ? fmtDate(x.savedAt.split('T')[0]) : '-'
    }));

    // Calculate totals
    const tot = calcTotals(t);
    rows.push({});
    rows.push({
      '#': '',
      'Date': '',
      'Type': 'TOTAL',
      'Category': '',
      'Amount (₹)': `Income: ${inr(tot.income)}`,
      'Mode': `Expense: ${inr(tot.expense)}`,
      'Customer/Vendor': `Profit: ${inr(tot.profit)}`,
      'Notes': '',
      'Created': ''
    });

    const ws = XLSX.utils.json_to_sheet(rows);

    // Auto-size columns
    ws['!cols'] = [
      { wch: 5 }, { wch: 14 }, { wch: 10 },
      { wch: 22 }, { wch: 14 }, { wch: 14 },
      { wch: 20 }, { wch: 25 }, { wch: 14 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

    const fileName = `AI-Toolcor-${today()}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast(`Excel exported: ${fileName}`);
  } catch (err) {
    console.error('Excel export error:', err);
    toast('Failed to export Excel!', 'error');
  }
}

// ============================================
// EXPORT PDF
// ============================================
function exportPDF() {
  const t = getTxns();
  if (!t.length) {
    toast('No data to export!', 'warning');
    return;
  }

  if (typeof window.jspdf === 'undefined') {
    toast('PDF library not loaded!', 'error');
    return;
  }

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFillColor(6, 182, 212);
    doc.rect(0, 0, pageWidth, 30, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('AI Toolcor Business', 14, 15);

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text('Transaction Report', 14, 23);
    doc.text(`Generated: ${new Date().toLocaleString(APP.locale)}`, pageWidth - 14, 23, { align: 'right' });

    // Summary
    const tot = calcTotals(t);
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('Summary', 14, 42);

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(16, 185, 129);
    doc.text(`Income: ${inr(tot.income)}`, 14, 50);
    doc.setTextColor(244, 63, 94);
    doc.text(`Expense: ${inr(tot.expense)}`, 75, 50);
    doc.setTextColor(245, 158, 11);
    doc.text(`Profit: ${inr(tot.profit)}`, 140, 50);

    // Table
    doc.autoTable({
      startY: 56,
      head: [['#', 'Date', 'Type', 'Category', 'Amount', 'Mode']],
      body: t.map((x, i) => [
        i + 1,
        fmtDate(x.date),
        x.type === 'income' ? 'Income' : 'Expense',
        x.category || '-',
        inr(x.amount),
        x.mode || 'Cash'
      ]),
      styles: {
        fontSize: 8,
        cellPadding: 4,
        textColor: [51, 65, 85]
      },
      headStyles: {
        fillColor: [6, 182, 212],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9
      },
      alternateRowStyles: { fillColor: [247, 249, 252] },
      columnStyles: {
        0: { cellWidth: 12 },
        1: { cellWidth: 28 },
        2: { cellWidth: 22 },
        4: { halign: 'right' }
      },
      didParseCell: function(data) {
        if (data.section === 'body' && data.column.index === 4) {
          const type = data.row.raw[2];
          data.cell.styles.textColor = type === 'Income' ? [16, 185, 129] : [244, 63, 94];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Page ${i} of ${pageCount} | business.aitoolcor.com`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: 'center' }
      );
    }

    const fileName = `AI-Toolcor-${today()}.pdf`;
    doc.save(fileName);
    toast(`PDF exported: ${fileName}`);
  } catch (err) {
    console.error('PDF export error:', err);
    toast('Failed to export PDF!', 'error');
  }
}

// ============================================
// BACKUP / RESTORE
// ============================================
function downloadBackup() {
  try {
    const txns = getTxns();
    if (!txns.length) {
      toast('No data to backup!', 'warning');
      return;
    }

    const data = {
      version: APP.version,
      business: APP.name,
      exported: new Date().toISOString(),
      user: localStorage.getItem(APP.userKey) || 'unknown',
      count: txns.length,
      transactions: txns
    };

    const blob = new Blob(
      [JSON.stringify(data, null, 2)],
      { type: 'application/json' }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AI-Toolcor-backup-${today()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(url), 100);

    localStorage.setItem(APP.backupKey, today());
    toast(`Backup downloaded! (${txns.length} records)`);
  } catch (err) {
    console.error('Backup error:', err);
    toast('Backup failed!', 'error');
  }
}

async function restoreBackup(file) {
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!data.transactions || !Array.isArray(data.transactions)) {
      toast('Invalid backup file!', 'error');
      return;
    }

    const confirmed = await confirmDel(
      `This will replace all your current data with <strong>${data.transactions.length}</strong> transactions from backup. Continue?`,
      { title: '📥 Restore Backup', okText: 'Restore', danger: false }
    );

    if (!confirmed) return;

    Store.save(data.transactions);
    toast(`Restored ${data.transactions.length} transactions!`);

    // Refresh page after 1s
    setTimeout(() => window.location.reload(), 1000);
  } catch (err) {
    console.error('Restore error:', err);
    toast('Failed to restore backup!', 'error');
  }
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================
document.addEventListener('keydown', (e) => {
  // Ignore if typing in input
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

  const ctrl = e.ctrlKey || e.metaKey;

  // Ctrl/Cmd + K: Focus search
  if (ctrl && e.key === 'k') {
    e.preventDefault();
    const search = el('headerSearch') || el('mainSearch') || el('txnSearch');
    if (search) search.focus();
  }

  // Ctrl/Cmd + N: New income
  if (ctrl && e.key === 'i') {
    e.preventDefault();
    if (typeof openIncomeModal === 'function') openIncomeModal();
    else openModal('incomeModal');
  }

  // Ctrl/Cmd + E: New expense
  if (ctrl && e.key === 'e') {
    e.preventDefault();
    if (typeof openExpenseModal === 'function') openExpenseModal();
    else openModal('expenseModal');
  }
});

// ============================================
// NETWORK STATUS
// ============================================
window.addEventListener('online', () => toast('Back online! 🌐', 'success'));
window.addEventListener('offline', () => toast('You are offline. Data is safe locally.', 'warning'));

// ============================================
// AUTO-BACKUP REMINDER
// ============================================
function checkBackupReminder() {
  const lastBackup = localStorage.getItem(APP.backupKey);
  if (!lastBackup) return;

  const days = DateUtil.daysBetween(lastBackup, today());
  if (days >= APP.autoBackupDays) {
    setTimeout(() => {
      toast(`It's been ${days} days since last backup. Consider backing up!`, 'warning');
    }, 3000);
  }
}

// ============================================
// PAGE PROTECTION (Unsaved changes warning)
// ============================================
let hasUnsavedChanges = false;

function setUnsavedChanges(value) {
  hasUnsavedChanges = value;
}

window.addEventListener('beforeunload', (e) => {
  if (hasUnsavedChanges) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// ============================================
// INITIALIZATION
// ============================================
function initApp() {
  if (APP.ready) return;

  // Check backup reminder
  checkBackupReminder();

  // Mark ready
  APP.ready = true;

  console.log(`%c🚀 ${APP.name} v${APP.version} ready!`,
    'color:#06b6d4;font-weight:bold;font-size:14px;');
  console.log(`%c📊 ${Store.get().length} transactions loaded`,
    'color:#94a3b8;');
}

// Init on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// ============================================
// GLOBAL ERROR HANDLER
// ============================================
window.addEventListener('error', (e) => {
  console.error('Global error:', e.error);
  // Don't show toast for every error (would be annoying)
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled promise rejection:', e.reason);
});

// ============================================
// EXPORT FOR OTHER FILES
// ============================================
window.APP = APP;
window.Store = Store;
window.DateUtil = DateUtil;
window.Modal = Modal;
window.Toast = Toast;
window.Sidebar = Sidebar;
window.Clock = Clock;