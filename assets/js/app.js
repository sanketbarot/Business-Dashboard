/* ============================================
   CRUST & CHILLY — CORE APP.JS
   Shared functions for all pages
   ============================================ */

'use strict';

// ===== AUTH CHECK =====
(function() {
  if (!localStorage.getItem('bd_auth')) {
    window.location.href = 'login.html';
  }
})();

// ===== CONFIG =====
const APP = {
  storageKey: 'bd_transactions',
  backupKey: 'bd_last_backup',
  authKey: 'bd_auth',
  userKey: 'bd_user'
};

// ===== STORAGE =====
function getTxns() {
  try {
    return JSON.parse(localStorage.getItem(APP.storageKey) || '[]');
  } catch (e) {
    console.error('Storage error:', e);
    return [];
  }
}

function saveTxns(data) {
  try {
    localStorage.setItem(APP.storageKey, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error('Save error:', e);
    alert('Storage full! Please export and clear old data.');
    return false;
  }
}

// ===== CURRENCY =====
function inr(amount) {
  const n = parseFloat(amount) || 0;
  return '₹ ' + n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function inrShort(amount) {
  const n = parseFloat(amount) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 10000000) return sign + '₹' + (abs / 10000000).toFixed(1) + 'Cr';
  if (abs >= 100000) return sign + '₹' + (abs / 100000).toFixed(1) + 'L';
  if (abs >= 1000) return sign + '₹' + (abs / 1000).toFixed(1) + 'K';
  return sign + '₹' + abs.toFixed(0);
}

// ===== DATE HELPERS =====
function today() {
  return new Date().toISOString().split('T')[0];
}

function fmtDate(d) {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return d;
  }
}

function fmtDateFull(d) {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleDateString('en-IN', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  } catch {
    return d;
  }
}

function isToday(d) {
  return d === today();
}

function isYesterday(d) {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return d === y.toISOString().split('T')[0];
}

function isThisWeek(d) {
  if (!d) return false;
  const date = new Date(d);
  const now = new Date();
  const day = now.getDay() || 7;
  const start = new Date(now);
  start.setDate(now.getDate() - day + 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return date >= start && date <= end;
}

function isLastWeek(d) {
  if (!d) return false;
  const date = new Date(d);
  const now = new Date();
  const day = now.getDay() || 7;
  const start = new Date(now);
  start.setDate(now.getDate() - day - 6);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return date >= start && date <= end;
}

function isThisMonth(d) {
  if (!d) return false;
  const date = new Date(d);
  const now = new Date();
  return date.getMonth() === now.getMonth() &&
         date.getFullYear() === now.getFullYear();
}

function isLastMonth(d) {
  if (!d) return false;
  const date = new Date(d);
  const now = new Date();
  const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return date.getMonth() === lm.getMonth() &&
         date.getFullYear() === lm.getFullYear();
}

function isThisYear(d) {
  if (!d) return false;
  return new Date(d).getFullYear() === new Date().getFullYear();
}

function inRange(d, start, end) {
  if (!d || !start || !end) return false;
  const date = new Date(d);
  const s = new Date(start);
  const e = new Date(end);
  e.setHours(23, 59, 59, 999);
  return date >= s && date <= e;
}

// ===== CALCULATIONS =====
function calcTotals(txns) {
  if (!Array.isArray(txns) || !txns.length) {
    return { income: 0, expense: 0, profit: 0 };
  }

  let income = 0, expense = 0;
  for (let i = 0; i < txns.length; i++) {
    const t = txns[i];
    const amt = parseFloat(t.amount) || 0;
    if (t.type === 'income') income += amt;
    else if (t.type === 'expense') expense += amt;
  }

  return {
    income: Math.round(income * 100) / 100,
    expense: Math.round(expense * 100) / 100,
    profit: Math.round((income - expense) * 100) / 100
  };
}

function filterByPeriod(txns, period, start, end) {
  if (!Array.isArray(txns)) return [];
  if (period === 'all' || !period) return txns;

  return txns.filter(t => {
    if (!t.date) return false;
    switch (period) {
      case 'today': return isToday(t.date);
      case 'yesterday': return isYesterday(t.date);
      case 'week': return isThisWeek(t.date);
      case 'lastweek': return isLastWeek(t.date);
      case 'month': return isThisMonth(t.date);
      case 'lastmonth': return isLastMonth(t.date);
      case 'year': return isThisYear(t.date);
      case 'custom': return start && end ? inRange(t.date, start, end) : true;
      default: return true;
    }
  });
}

// ===== HELPERS =====
function uid() {
  return 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
}

function debounce(fn, wait) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
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

// ===== MODAL =====
function openModal(id) {
  const m = document.getElementById(id);
  if (m) {
    m.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) {
    m.classList.remove('open');
    document.body.style.overflow = '';
  }
}

// Close modal on background click
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal-bg')) {
    e.target.classList.remove('open');
    document.body.style.overflow = '';
  }
});

// Escape key closes modals
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-bg.open').forEach(m => {
      m.classList.remove('open');
    });
    document.body.style.overflow = '';
  }
});

// ===== TOAST =====
function toast(msg, type) {
  type = type || 'success';
  const container = document.getElementById('toastBox');
  if (!container) {
    alert(msg);
    return;
  }

  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

  const colors = {
    success: '#10b981',
    error: '#f43f5e',
    warning: '#f59e0b',
    info: '#06b6d4'
  };

  const t = document.createElement('div');
  t.className = 'toast';
  t.style.borderLeftColor = colors[type] || colors.success;
  t.innerHTML = '<span>' + (icons[type] || '✅') + '</span><span>' + escapeHtml(msg) + '</span>';
  container.appendChild(t);

  setTimeout(function() {
    t.style.opacity = '0';
    t.style.transform = 'translateX(20px)';
    setTimeout(function() {
      if (t.parentNode) t.remove();
    }, 300);
  }, 3000);
}

// ===== AMOUNT PREVIEW =====
function previewAmt(type) {
  const isI = type === 'income';
  const amtEl = document.getElementById(isI ? 'iAmt' : 'eAmt');
  const previewEl = document.getElementById(isI ? 'iPreview' : 'ePreview');
  const valEl = document.getElementById(isI ? 'iPreviewVal' : 'ePreviewVal');

  if (!amtEl || !previewEl || !valEl) return;

  const amt = parseFloat(amtEl.value);
  if (!isNaN(amt) && amt > 0) {
    previewEl.style.display = 'flex';
    valEl.textContent = inr(amt);
  } else {
    previewEl.style.display = 'none';
  }
}

// ===== HEADER CLOCK =====
function updateHeaderDateTime() {
  const now = new Date();

  const dateStr = now.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  const timeStr = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  const dateEl = document.getElementById('headerDate');
  if (dateEl) dateEl.textContent = dateStr;

  const timeEl = document.getElementById('liveTime');
  if (timeEl) timeEl.textContent = 'LIVE ' + timeStr;
}

updateHeaderDateTime();
setInterval(updateHeaderDateTime, 1000);

// ===== SIDEBAR =====
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  if (!sidebar) return;

  sidebar.classList.toggle('open');
  if (overlay) {
    overlay.style.display = sidebar.classList.contains('open') ? 'block' : 'none';
  }
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.style.display = 'none';
}

// Auto-close sidebar on desktop resize
window.addEventListener('resize', debounce(function() {
  if (window.innerWidth > 1023) {
    closeSidebar();
  }
}, 200));

// ===== LOGOUT =====
function logout() {
  if (confirm('Are you sure you want to sign out?')) {
    localStorage.removeItem(APP.authKey);
    localStorage.removeItem(APP.userKey);
    window.location.href = 'login.html';
  }
}

// ===== EXPORT EXCEL =====
function exportExcel() {
  const txns = getTxns();
  if (!txns.length) {
    toast('No data to export!', 'warning');
    return;
  }

  if (typeof XLSX === 'undefined') {
    toast('Excel library not loaded!', 'error');
    return;
  }

  try {
    const rows = txns.map(function(x, i) {
      return {
        '#': i + 1,
        'Date': fmtDate(x.date),
        'Type': x.type === 'income' ? 'Income' : 'Expense',
        'Category': x.category || '-',
        'Amount (₹)': parseFloat(x.amount) || 0,
        'Mode': x.mode || 'Cash',
        'Customer/Vendor': x.from || x.vendor || '-',
        'Notes': x.notes || '-'
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 5 }, { wch: 14 }, { wch: 10 },
      { wch: 22 }, { wch: 14 }, { wch: 14 },
      { wch: 20 }, { wch: 25 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

    const fileName = 'Crust-Chilly-' + today() + '.xlsx';
    XLSX.writeFile(wb, fileName);
    toast('Excel exported: ' + fileName, 'success');
  } catch (err) {
    console.error('Excel error:', err);
    toast('Failed to export Excel!', 'error');
  }
}

// ===== EXPORT PDF =====
function exportPDF() {
  const txns = getTxns();
  if (!txns.length) {
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
    doc.text('Crust & Chilly', 14, 15);
    doc.setFontSize(10);
    doc.text('Transaction Report', 14, 23);
    doc.text('Generated: ' + new Date().toLocaleString('en-IN'), pageWidth - 14, 23, { align: 'right' });

    // Summary
    const tot = calcTotals(txns);
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.text('Summary', 14, 42);
    doc.setFontSize(9);
    doc.setTextColor(16, 185, 129);
    doc.text('Income: ' + inr(tot.income), 14, 50);
    doc.setTextColor(244, 63, 94);
    doc.text('Expense: ' + inr(tot.expense), 75, 50);
    doc.setTextColor(245, 158, 11);
    doc.text('Profit: ' + inr(tot.profit), 140, 50);

    // Table
    doc.autoTable({
      startY: 56,
      head: [['#', 'Date', 'Type', 'Category', 'Amount', 'Mode']],
      body: txns.map(function(x, i) {
        return [
          i + 1,
          fmtDate(x.date),
          x.type === 'income' ? 'Income' : 'Expense',
          x.category || '-',
          inr(x.amount),
          x.mode || 'Cash'
        ];
      }),
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [6, 182, 212], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [247, 249, 252] }
    });

    const fileName = 'Crust-Chilly-' + today() + '.pdf';
    doc.save(fileName);
    toast('PDF exported: ' + fileName, 'success');
  } catch (err) {
    console.error('PDF error:', err);
    toast('Failed to export PDF!', 'error');
  }
}

// ===== BACKUP =====
function downloadBackup() {
  const txns = getTxns();
  if (!txns.length) {
    toast('No data to backup!', 'warning');
    return;
  }

  try {
    const data = {
      version: '2.0',
      business: 'Crust & Chilly',
      exported: new Date().toISOString(),
      user: localStorage.getItem(APP.userKey) || 'unknown',
      count: txns.length,
      transactions: txns
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Crust-Chilly-backup-' + today() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(function() {
      URL.revokeObjectURL(url);
    }, 100);

    localStorage.setItem(APP.backupKey, today());
    toast('Backup downloaded! (' + txns.length + ' records)', 'success');
  } catch (err) {
    console.error('Backup error:', err);
    toast('Backup failed!', 'error');
  }
}

// ===== INIT =====
console.log('%cCrust & Chilly Loaded', 'color:#06b6d4;font-weight:bold;');
console.log('Transactions:', getTxns().length);