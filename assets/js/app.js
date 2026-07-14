/* ============================================
   CRUST & CHILLY — APP.JS v5.0
   Firebase Real-time Sync
   ============================================ */

'use strict';

// AUTH CHECK
(function() {
  if (!localStorage.getItem('bd_auth')) {
    window.location.href = 'login.html';
  }
})();

const APP = {
  storageKey: 'bd_transactions',
  backupKey: 'bd_last_backup',
  authKey: 'bd_auth',
  userKey: 'bd_user',
  uidKey: 'bd_uid'
};

// ============================================
// FIREBASE STORAGE (Real-time Sync)
// ============================================

let currentTxns = [];
let firebaseReady = false;
let firebaseListener = null;

// Get user's transactions collection
function getUserTxnsRef() {
  const uid = localStorage.getItem(APP.uidKey);
  if (!uid) return null;
  return db.collection('users').doc(uid).collection('transactions');
}

// Setup real-time listener
function setupFirebaseSync() {
  const ref = getUserTxnsRef();
  if (!ref) {
    console.log('No user, using localStorage');
    return;
  }

  console.log('🔥 Setting up Firebase real-time sync...');

  // Show sync indicator
  showSyncIndicator('syncing');

  // Cleanup old listener
  if (firebaseListener) firebaseListener();

  // Setup new listener
  firebaseListener = ref.orderBy('savedAt', 'desc').onSnapshot(
    (snapshot) => {
      const txns = [];
      snapshot.forEach(doc => {
        txns.push({ ...doc.data(), id: doc.id });
      });

      currentTxns = txns;
      // Also save to localStorage as backup
      localStorage.setItem(APP.storageKey, JSON.stringify(txns));

      firebaseReady = true;
      showSyncIndicator('synced');

      // Trigger reload
      if (typeof Dash !== 'undefined' && Dash.loadAll) {
        Dash.loadAll();
      }
      if (typeof TxnPage !== 'undefined' && TxnPage.apply) {
        TxnPage.apply();
      }

      console.log('✅ Synced ' + txns.length + ' transactions from Firebase');
    },
    (error) => {
      console.error('Firebase sync error:', error);
      showSyncIndicator('error');
      toast('Sync failed. Using offline data.', 'warning');
    }
  );
}

// Initialize Firebase sync on load
if (typeof auth !== 'undefined') {
  auth.onAuthStateChanged((user) => {
    if (user) {
      localStorage.setItem(APP.uidKey, user.uid);
      setupFirebaseSync();
    } else {
      // User signed out
      localStorage.removeItem(APP.authKey);
      localStorage.removeItem(APP.userKey);
      localStorage.removeItem(APP.uidKey);
      if (!window.location.pathname.includes('login')) {
        window.location.href = 'login.html';
      }
    }
  });
}

// GET TRANSACTIONS (from Firebase cache or localStorage)
function getTxns() {
  if (firebaseReady && currentTxns.length >= 0) {
    return currentTxns;
  }
  try {
    return JSON.parse(localStorage.getItem(APP.storageKey) || '[]');
  } catch (e) { return []; }
}

// SAVE TRANSACTION (to Firebase)
async function saveTxnToFirebase(txn) {
  const ref = getUserTxnsRef();
  if (!ref) {
    // Fallback to localStorage
    const txns = getTxns();
    txns.push(txn);
    localStorage.setItem(APP.storageKey, JSON.stringify(txns));
    return true;
  }

  try {
    showSyncIndicator('syncing');
    if (txn.id && txn.id.startsWith('id_')) {
      // New transaction - use Firestore ID
      const docRef = await ref.add({
        type: txn.type,
        date: txn.date,
        category: txn.category,
        amount: txn.amount,
        mode: txn.mode,
        from: txn.from || '',
        vendor: txn.vendor || '',
        notes: txn.notes || '',
        savedAt: txn.savedAt || new Date().toISOString()
      });
      console.log('✅ Added to Firebase:', docRef.id);
    } else {
      // Update existing
      await ref.doc(txn.id).set({
        type: txn.type,
        date: txn.date,
        category: txn.category,
        amount: txn.amount,
        mode: txn.mode,
        from: txn.from || '',
        vendor: txn.vendor || '',
        notes: txn.notes || '',
        savedAt: txn.savedAt || new Date().toISOString()
      });
      console.log('✅ Updated in Firebase:', txn.id);
    }
    return true;
  } catch (err) {
    console.error('Firebase save error:', err);
    toast('Failed to sync. Saved locally.', 'warning');
    return false;
  }
}

// UPDATE TRANSACTION IN FIREBASE
async function updateTxnInFirebase(id, data) {
  const ref = getUserTxnsRef();
  if (!ref) return false;

  try {
    showSyncIndicator('syncing');
    await ref.doc(id).update({
      ...data,
      savedAt: data.savedAt || new Date().toISOString()
    });
    console.log('✅ Updated in Firebase:', id);
    return true;
  } catch (err) {
    console.error('Firebase update error:', err);
    return false;
  }
}

// DELETE FROM FIREBASE
async function deleteTxnFromFirebase(id) {
  const ref = getUserTxnsRef();
  if (!ref) return false;

  try {
    showSyncIndicator('syncing');
    await ref.doc(id).delete();
    console.log('✅ Deleted from Firebase:', id);
    return true;
  } catch (err) {
    console.error('Firebase delete error:', err);
    return false;
  }
}

// DELETE MULTIPLE
async function deleteMultipleFromFirebase(ids) {
  const ref = getUserTxnsRef();
  if (!ref) return false;

  try {
    showSyncIndicator('syncing');
    const batch = db.batch();
    ids.forEach(id => {
      batch.delete(ref.doc(id));
    });
    await batch.commit();
    console.log('✅ Deleted ' + ids.length + ' from Firebase');
    return true;
  } catch (err) {
    console.error('Firebase batch delete error:', err);
    return false;
  }
}

// SAVE TXNS (legacy support)
function saveTxns(data) {
  try {
    localStorage.setItem(APP.storageKey, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

// ============================================
// SYNC INDICATOR
// ============================================
function showSyncIndicator(status) {
  let indicator = document.getElementById('syncIndicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'syncIndicator';
    indicator.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 8px 16px;
      border-radius: 100px;
      font-size: 0.75rem;
      font-weight: 700;
      z-index: 1000;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transition: all 0.3s;
      font-family: 'Plus Jakarta Sans', sans-serif;
    `;
    document.body.appendChild(indicator);
  }

  const configs = {
    syncing: { bg: '#fef3c7', color: '#92400e', text: '⟳ Syncing...', border: '#fcd34d' },
    synced: { bg: '#d1fae5', color: '#059669', text: '☁️ Synced', border: '#6ee7b7' },
    error: { bg: '#fee2e2', color: '#dc2626', text: '⚠️ Offline', border: '#fca5a5' },
    offline: { bg: '#f1f5f9', color: '#64748b', text: '📴 Offline', border: '#cbd5e1' }
  };

  const config = configs[status] || configs.synced;
  indicator.style.background = config.bg;
  indicator.style.color = config.color;
  indicator.style.border = '1px solid ' + config.border;
  indicator.textContent = config.text;

  // Auto-hide "synced" after 2s
  if (status === 'synced') {
    setTimeout(() => {
      if (indicator && indicator.textContent === '☁️ Synced') {
        indicator.style.opacity = '0.6';
      }
    }, 2000);
  } else {
    indicator.style.opacity = '1';
  }
}

// Network status
window.addEventListener('online', () => {
  showSyncIndicator('syncing');
  setTimeout(() => showSyncIndicator('synced'), 1000);
  toast('Back online! Syncing...', 'success');
});

window.addEventListener('offline', () => {
  showSyncIndicator('offline');
  toast('You are offline. Changes will sync when online.', 'warning');
});

// ============================================
// EXISTING FUNCTIONS (unchanged)
// ============================================

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

function today() { return new Date().toISOString().split('T')[0]; }

function fmtDate(d) {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  } catch { return d; }
}

function fmtDateFull(d) {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleDateString('en-IN', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
    });
  } catch { return d; }
}

function isToday(d) { return d === today(); }

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
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

function isLastMonth(d) {
  if (!d) return false;
  const date = new Date(d);
  const now = new Date();
  const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return date.getMonth() === lm.getMonth() && date.getFullYear() === lm.getFullYear();
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

function animateNumber(el, endValue, duration = 1500) {
  if (!el) return;
  const isRupee = endValue.toString().includes('₹');
  const isPercent = endValue.toString().includes('%');
  const numericTarget = parseFloat(endValue.toString().replace(/[₹,\s%]/g, '')) || 0;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 4);
    const currentValue = numericTarget * eased;
    if (isRupee) {
      el.textContent = '₹ ' + currentValue.toLocaleString('en-IN', {
        minimumFractionDigits: 2, maximumFractionDigits: 2
      });
    } else if (isPercent) {
      el.textContent = Math.floor(currentValue) + '%';
    } else {
      el.textContent = Math.floor(currentValue).toString();
    }
    if (progress < 1) requestAnimationFrame(update);
    else el.textContent = endValue;
  }
  requestAnimationFrame(update);
}

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

document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal-bg')) {
    e.target.classList.remove('open');
    document.body.style.overflow = '';
  }
});

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-bg.open').forEach(m => {
      m.classList.remove('open');
    });
    document.body.style.overflow = '';
  }
});

function toast(msg, type) {
  type = type || 'success';
  const container = document.getElementById('toastBox');
  if (!container) { alert(msg); return; }
  const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
  const colors = { success:'#10b981', error:'#ef4444', warning:'#f59e0b', info:'#6366f1' };
  const t = document.createElement('div');
  t.className = 'toast';
  t.style.borderLeftColor = colors[type] || colors.success;
  t.innerHTML = '<span>' + (icons[type] || '✅') + '</span><span>' + escapeHtml(msg) + '</span>';
  container.appendChild(t);
  setTimeout(function() {
    t.style.opacity = '0';
    t.style.transform = 'translateX(20px)';
    setTimeout(function() { if (t.parentNode) t.remove(); }, 300);
  }, 3000);
}

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

function updateHeaderDateTime() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });
  const timeStr = now.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
  });
  const dateEl = document.getElementById('headerDate');
  if (dateEl) dateEl.textContent = dateStr;
  const timeEl = document.getElementById('liveTime');
  if (timeEl) timeEl.textContent = 'LIVE ' + timeStr;
}
updateHeaderDateTime();
setInterval(updateHeaderDateTime, 1000);

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

window.addEventListener('resize', debounce(function() {
  if (window.innerWidth > 1023) closeSidebar();
}, 200));

function logout() {
  if (confirm('Are you sure you want to sign out?')) {
    if (firebaseListener) firebaseListener();
    auth.signOut().then(() => {
      localStorage.clear();
      window.location.href = 'login.html';
    });
  }
}

function exportExcel() {
  const txns = getTxns();
  if (!txns.length) { toast('No data to export!', 'warning'); return; }
  if (typeof XLSX === 'undefined') { toast('Excel library not loaded!', 'error'); return; }
  try {
    const rows = txns.map((x, i) => ({
      '#': i + 1,
      'Date': fmtDate(x.date),
      'Type': x.type === 'income' ? 'Income' : 'Expense',
      'Category': x.category || '-',
      'Amount (₹)': parseFloat(x.amount) || 0,
      'Mode': x.mode || 'Cash',
      'Customer/Vendor': x.from || x.vendor || '-',
      'Notes': x.notes || '-'
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    XLSX.writeFile(wb, 'Crust-Chilly-' + today() + '.xlsx');
    toast('Excel exported!', 'success');
  } catch (err) {
    toast('Failed to export Excel!', 'error');
  }
}

function exportPDF() {
  const txns = getTxns();
  if (!txns.length) { toast('No data to export!', 'warning'); return; }
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFillColor(99, 102, 241);
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text('Crust & Chilly', 14, 15);
    doc.setFontSize(10);
    doc.text('Transaction Report', 14, 23);
    const tot = calcTotals(txns);
    doc.setTextColor(30, 27, 75);
    doc.setFontSize(11);
    doc.text('Summary', 14, 42);
    doc.setFontSize(9);
    doc.text('Income: ' + inr(tot.income), 14, 50);
    doc.text('Expense: ' + inr(tot.expense), 75, 50);
    doc.text('Profit: ' + inr(tot.profit), 140, 50);
    doc.autoTable({
      startY: 56,
      head: [['#', 'Date', 'Type', 'Category', 'Amount', 'Mode']],
      body: txns.map((x, i) => [
        i + 1, fmtDate(x.date),
        x.type === 'income' ? 'Income' : 'Expense',
        x.category || '-', inr(x.amount), x.mode || 'Cash'
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [99, 102, 241], textColor: 255 }
    });
    doc.save('Crust-Chilly-' + today() + '.pdf');
    toast('PDF exported!', 'success');
  } catch (err) {
    toast('Failed to export PDF!', 'error');
  }
}

function downloadBackup() {
  const txns = getTxns();
  if (!txns.length) { toast('No data to backup!', 'warning'); return; }
  try {
    const data = {
      version: '5.0',
      business: 'Crust & Chilly',
      exported: new Date().toISOString(),
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
    setTimeout(() => URL.revokeObjectURL(url), 100);
    toast('Backup downloaded!', 'success');
  } catch (err) {
    toast('Backup failed!', 'error');
  }
}

console.log('%cCrust & Chilly v5.0 (Firebase) Loaded', 'color:#6366f1;font-weight:bold;');

// ============================================
// PWA INSTALLATION PROMPT HANDLING
// ============================================

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent Chrome 67 and earlier from automatically showing the prompt
  e.preventDefault();
  // Stash the event so it can be triggered later
  deferredPrompt = e;
  // Show the install button in navigation
  const installBtn = document.getElementById('pwaInstallBtn');
  if (installBtn) {
    installBtn.style.display = 'flex';
  }
});

function triggerPwaInstall() {
  if (!deferredPrompt) return;
  // Show the prompt
  deferredPrompt.prompt();
  // Wait for the user to respond to the prompt
  deferredPrompt.userChoice.then((choiceResult) => {
    if (choiceResult.outcome === 'accepted') {
      console.log('✅ User accepted PWA installation');
    } else {
      console.log('❌ User dismissed PWA installation');
    }
    deferredPrompt = null;
    const installBtn = document.getElementById('pwaInstallBtn');
    if (installBtn) {
      installBtn.style.display = 'none';
    }
  });
}

window.addEventListener('appinstalled', (evt) => {
  console.log('🎉 PWA successfully installed!');
  const installBtn = document.getElementById('pwaInstallBtn');
  if (installBtn) {
    installBtn.style.display = 'none';
  }
});