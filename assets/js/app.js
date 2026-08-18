/* ============================================
   CRUST & CHILLY — APP.JS v1.0.0
   Firebase Real-time Sync
   ============================================ */

'use strict';

// AUTH CHECK
(function () {
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
let currentTxns = (() => {
  try { return JSON.parse(localStorage.getItem(APP.storageKey) || '[]'); } catch (e) { return []; }
})();
let currentBills = (() => {
  try { return JSON.parse(localStorage.getItem('bd_bills') || '[]'); } catch (e) { return []; }
})();
let currentBudgets = (() => {
  try { return JSON.parse(localStorage.getItem('bd_budgets') || '[]'); } catch (e) { return []; }
})();
let currentRecurring = (() => {
  try { return JSON.parse(localStorage.getItem('bd_recurring') || '[]'); } catch (e) { return []; }
})();
let currentVendors = (() => {
  try { return JSON.parse(localStorage.getItem('bd_vendors') || '[]'); } catch (e) { return []; }
})();
let firebaseReady = false;
let firebaseListener = null;
let firebaseBillsListener = null;
let firebaseBudgetsListener = null;
let firebaseVendorsListener = null;

function getActiveUid() {
  if (typeof auth !== 'undefined' && auth.currentUser && auth.currentUser.uid) {
    return auth.currentUser.uid;
  }
  const localUid = localStorage.getItem(APP.uidKey);
  if (localUid && localUid !== 'demo_user_id') {
    return localUid;
  }
  return null;
}

// Get user's transactions collection
function getUserTxnsRef() {
  if (localStorage.getItem('bd_mode') === 'demo' && !(typeof auth !== 'undefined' && auth.currentUser)) return null;
  const uid = getActiveUid();
  if (!uid) return null;
  return db.collection('users').doc(uid).collection('transactions');
}

// Get user's bills collection
function getUserBillsRef() {
  if (localStorage.getItem('bd_mode') === 'demo' && !(typeof auth !== 'undefined' && auth.currentUser)) return null;
  const uid = getActiveUid();
  if (!uid) return null;
  return db.collection('users').doc(uid).collection('bills');
}

// Get user's category budgets collection
function getUserBudgetsRef() {
  if (localStorage.getItem('bd_mode') === 'demo' && !(typeof auth !== 'undefined' && auth.currentUser)) return null;
  const uid = getActiveUid();
  if (!uid) return null;
  return db.collection('users').doc(uid).collection('budgets');
}

// Get user's vendors collection (Khata)
function getUserVendorsRef() {
  if (localStorage.getItem('bd_mode') === 'demo' && !(typeof auth !== 'undefined' && auth.currentUser)) return null;
  const uid = getActiveUid();
  if (!uid) return null;
  return db.collection('users').doc(uid).collection('vendors');
}

// Setup real-time listener for transactions
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
      if (typeof AnalyticsPage !== 'undefined' && AnalyticsPage.loadAll) {
        AnalyticsPage.loadAll();
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

// Setup real-time listener for bills
function setupFirebaseBillsSync() {
  const ref = getUserBillsRef();
  if (!ref) {
    console.log('No user, using localStorage for bills');
    return;
  }

  console.log('🔥 Setting up Firebase bills real-time sync...');

  if (firebaseBillsListener) firebaseBillsListener();

  firebaseBillsListener = ref.orderBy('dueDate', 'asc').onSnapshot(
    (snapshot) => {
      const bills = [];
      snapshot.forEach(doc => {
        bills.push({ ...doc.data(), id: doc.id });
      });

      currentBills = bills;
      localStorage.setItem('bd_bills', JSON.stringify(bills));

      // Trigger reload in Dash
      if (typeof Dash !== 'undefined' && Dash.loadBills) {
        Dash.loadBills();
      }

      console.log('✅ Synced ' + bills.length + ' bills from Firebase');
    },
    (error) => {
      console.error('Firebase bills sync error:', error);
    }
  );
}

// Setup real-time listener for category budgets
let budgetsInitialSyncDone = false;
function setupFirebaseBudgetsSync() {
  const ref = getUserBudgetsRef();
  if (!ref) {
    console.log('No user, using localStorage for budgets');
    return;
  }

  console.log('🔥 Setting up Firebase category budgets real-time sync...');

  if (firebaseBudgetsListener) firebaseBudgetsListener();

  firebaseBudgetsListener = ref.onSnapshot(
    (snapshot) => {
      const budgets = [];
      snapshot.forEach(doc => {
        budgets.push({ ...doc.data(), id: doc.id });
      });

      if (snapshot.empty && !budgetsInitialSyncDone) {
        budgetsInitialSyncDone = true;
        const local = JSON.parse(localStorage.getItem('bd_budgets') || '[]');
        if (local.length > 0) {
          local.forEach(b => {
            const cleanCat = (b.category || '').trim();
            const bId = b.id || ('bgt_' + encodeURIComponent(cleanCat).replace(/%/g, '_'));
            const bObj = { ...b, id: bId, category: cleanCat };
            ref.doc(bId).set(bObj).catch(console.error);
          });
          currentBudgets = local;
        } else {
          currentBudgets = [];
          localStorage.setItem('bd_budgets', JSON.stringify([]));
        }
      } else {
        budgetsInitialSyncDone = true;
        currentBudgets = budgets;
        localStorage.setItem('bd_budgets', JSON.stringify(budgets));
      }

      // Trigger reload in Dash and modal
      if (typeof Dash !== 'undefined' && Dash.loadCategoryBudgets) {
        Dash.loadCategoryBudgets(getTxns());
      }
      if (typeof populateBudgetModalList === 'function') {
        populateBudgetModalList();
      }

      console.log('✅ Synced ' + currentBudgets.length + ' category budgets from Firebase');
    },
    (error) => {
      console.error('Firebase budgets sync error:', error);
    }
  );
}

// Setup real-time listener for vendors (Khata)
let vendorsInitialSyncDone = false;
function setupFirebaseVendorsSync() {
  const ref = getUserVendorsRef();
  if (!ref) {
    console.log('No user, using localStorage for vendors');
    return;
  }

  console.log('🔥 Setting up Firebase vendors real-time sync...');

  if (firebaseVendorsListener) firebaseVendorsListener();

  firebaseVendorsListener = ref.onSnapshot(
    (snapshot) => {
      const vendors = [];
      snapshot.forEach(doc => {
        vendors.push({ ...doc.data(), id: doc.id });
      });

      // Sort by latest update
      vendors.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));

      if (snapshot.empty && !vendorsInitialSyncDone) {
        vendorsInitialSyncDone = true;
        const local = JSON.parse(localStorage.getItem('bd_vendors') || '[]');
        if (local.length > 0) {
          local.forEach(v => {
            const vId = v.id || ('vnd_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6));
            const vObj = { ...v, id: vId };
            ref.doc(vId).set(vObj).catch(console.error);
          });
          currentVendors = local;
        } else {
          currentVendors = [];
          localStorage.setItem('bd_vendors', JSON.stringify([]));
        }
      } else {
        vendorsInitialSyncDone = true;
        currentVendors = vendors;
        localStorage.setItem('bd_vendors', JSON.stringify(vendors));
      }

      // Trigger reload in Dash
      if (typeof Dash !== 'undefined' && Dash.loadVendors) {
        Dash.loadVendors();
      }

      console.log('✅ Synced ' + currentVendors.length + ' vendors from Firebase');
    },
    (error) => {
      console.error('Firebase vendors sync error:', error);
    }
  );
}

// Initialize Firebase sync on load
if (typeof auth !== 'undefined') {
  auth.onAuthStateChanged((user) => {
    if (user) {
      localStorage.removeItem('bd_mode'); // Clear demo mode when actual user is authenticated
      localStorage.setItem(APP.uidKey, user.uid);
      setupFirebaseSync();
      setupFirebaseBillsSync();
      setupFirebaseBudgetsSync();
      setupFirebaseVendorsSync();
    } else {
      // If we are in local demo mode, do not clear and redirect
      if (localStorage.getItem('bd_mode') === 'demo') {
        showSyncIndicator('demo');
        return;
      }
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
  if (currentTxns && currentTxns.length > 0) {
    return currentTxns;
  }
  try {
    const local = JSON.parse(localStorage.getItem(APP.storageKey) || '[]');
    if (Array.isArray(local) && local.length > 0) {
      currentTxns = local;
      return local;
    }
  } catch (e) { }
  return currentTxns || [];
}

// GET BILLS (from Firebase cache or localStorage)
function getBills() {
  if (currentBills && currentBills.length > 0) {
    return currentBills;
  }
  try {
    const local = JSON.parse(localStorage.getItem('bd_bills') || '[]');
    if (Array.isArray(local) && local.length > 0) {
      currentBills = local;
      return local;
    }
  } catch (e) { }
  return currentBills || [];
}

// GET CATEGORY BUDGETS (from Firebase cache or localStorage)
function getBudgets() {
  if (Array.isArray(currentBudgets) && currentBudgets.length > 0) {
    return currentBudgets;
  }
  try {
    const local = JSON.parse(localStorage.getItem('bd_budgets') || '[]');
    if (Array.isArray(local) && local.length > 0) {
      currentBudgets = local;
      return local;
    }
  } catch (e) { }
  return currentBudgets || [];
}

// GET RECURRING RULES (from Firebase cache or localStorage)
function getRecurringRules() {
  if (Array.isArray(currentRecurring) && currentRecurring.length > 0) {
    return currentRecurring;
  }
  try {
    const local = JSON.parse(localStorage.getItem('bd_recurring') || '[]');
    if (Array.isArray(local) && local.length > 0) {
      currentRecurring = local;
      return local;
    }
  } catch (e) { }
  return currentRecurring || [];
}

// GET VENDORS (from Firebase cache or localStorage)
function getVendors() {
  if (Array.isArray(currentVendors) && currentVendors.length > 0) {
    return currentVendors;
  }
  try {
    const local = JSON.parse(localStorage.getItem('bd_vendors') || '[]');
    if (Array.isArray(local) && local.length > 0) {
      currentVendors = local;
      return local;
    }
  } catch (e) { }
  return currentVendors || [];
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
    showSyncIndicator('synced');
    return true;
  } catch (err) {
    console.error('Firebase save error:', err);
    toast('Failed to sync. Saved locally.', 'warning');
    return false;
  }
}

// SAVE BILL (to Firebase)
async function saveBillToFirebase(bill) {
  const ref = getUserBillsRef();
  if (!ref) {
    // Fallback to localStorage
    const bills = getBills();
    const index = bills.findIndex(b => b.id === bill.id);
    if (index > -1) {
      bills[index] = bill;
    } else {
      bills.push(bill);
    }
    localStorage.setItem('bd_bills', JSON.stringify(bills));
    if (typeof Dash !== 'undefined' && Dash.loadBills) {
      Dash.loadBills();
    }
    return true;
  }

  try {
    showSyncIndicator('syncing');
    if (bill.id && bill.id.startsWith('bill_')) {
      // New bill - add to firestore
      const docRef = await ref.add({
        category: bill.category,
        amount: bill.amount,
        dueDate: bill.dueDate,
        vendor: bill.vendor || '',
        notes: bill.notes || '',
        status: bill.status || 'pending',
        paidDate: bill.paidDate || '',
        savedAt: bill.savedAt || new Date().toISOString()
      });
      console.log('✅ Added bill to Firebase:', docRef.id);
    } else {
      // Update existing
      await ref.doc(bill.id).set({
        category: bill.category,
        amount: bill.amount,
        dueDate: bill.dueDate,
        vendor: bill.vendor || '',
        notes: bill.notes || '',
        status: bill.status || 'pending',
        paidDate: bill.paidDate || '',
        savedAt: bill.savedAt || new Date().toISOString()
      });
      console.log('✅ Updated bill in Firebase:', bill.id);
    }
    showSyncIndicator('synced');
    return true;
  } catch (err) {
    console.error('Firebase bill save error:', err);
    toast('Failed to sync bill. Saved locally.', 'warning');
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
    showSyncIndicator('synced');
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
    showSyncIndicator('synced');
    return true;
  } catch (err) {
    console.error('Firebase delete error:', err);
    return false;
  }
}

// DELETE BILL FROM FIREBASE
async function deleteBillFromFirebase(id) {
  const ref = getUserBillsRef();
  if (!ref) {
    // Fallback to localStorage
    let bills = getBills();
    bills = bills.filter(b => b.id !== id);
    localStorage.setItem('bd_bills', JSON.stringify(bills));
    if (typeof Dash !== 'undefined' && Dash.loadBills) {
      Dash.loadBills();
    }
    return true;
  }

  try {
    showSyncIndicator('syncing');
    await ref.doc(id).delete();
    console.log('✅ Deleted bill from Firebase:', id);
    showSyncIndicator('synced');
    return true;
  } catch (err) {
    console.error('Firebase bill delete error:', err);
    return false;
  }
}

// SAVE CATEGORY BUDGET (to Firebase or localStorage)
async function saveBudgetToFirebase(category, amount) {
  const cleanCat = category.trim();
  const amt = parseFloat(amount) || 0;
  const id = 'bgt_' + encodeURIComponent(cleanCat).replace(/%/g, '_');
  const legacyId = 'bgt_' + encodeURIComponent(cleanCat.toLowerCase().replace(/[^a-z0-9]/g, '_'));

  const budgetObj = {
    id: id,
    category: cleanCat,
    amount: amt,
    savedAt: new Date().toISOString()
  };

  // Optimistically update in-memory cache and localStorage first
  let budgets = getBudgets().slice();
  const idx = budgets.findIndex(b => b.category === cleanCat || b.id === id || b.id === legacyId);
  if (idx > -1) {
    budgets[idx] = budgetObj;
  } else {
    budgets.push(budgetObj);
  }
  currentBudgets = budgets;
  localStorage.setItem('bd_budgets', JSON.stringify(budgets));

  // Immediate UI updates
  if (typeof Dash !== 'undefined' && Dash.loadCategoryBudgets) {
    Dash.loadCategoryBudgets(getTxns());
  }
  if (typeof populateBudgetModalList === 'function') {
    populateBudgetModalList();
  }

  const ref = getUserBudgetsRef();
  if (!ref) {
    return true;
  }

  try {
    showSyncIndicator('syncing');
    await ref.doc(id).set(budgetObj);
    console.log('✅ Saved category budget to Firebase:', id);
    showSyncIndicator('synced');
    return true;
  } catch (err) {
    console.error('Firebase budget save error:', err);
    toast('Saved budget locally.', 'warning');
    return false;
  }
}

// DELETE CATEGORY BUDGET (from Firebase or localStorage)
async function deleteBudgetFromFirebase(category) {
  const cleanCat = category.trim();
  const id = 'bgt_' + encodeURIComponent(cleanCat).replace(/%/g, '_');
  const legacyId = 'bgt_' + encodeURIComponent(cleanCat.toLowerCase().replace(/[^a-z0-9]/g, '_'));

  let budgets = getBudgets().slice();
  budgets = budgets.filter(b => b.category !== cleanCat && b.id !== id && b.id !== legacyId);
  currentBudgets = budgets;
  localStorage.setItem('bd_budgets', JSON.stringify(budgets));

  if (typeof Dash !== 'undefined' && Dash.loadCategoryBudgets) {
    Dash.loadCategoryBudgets(getTxns());
  }
  if (typeof populateBudgetModalList === 'function') {
    populateBudgetModalList();
  }

  const ref = getUserBudgetsRef();
  if (!ref) {
    return true;
  }

  try {
    showSyncIndicator('syncing');
    await ref.doc(id).delete().catch(() => {});
    if (legacyId !== id) {
      await ref.doc(legacyId).delete().catch(() => {});
    }
    console.log('✅ Deleted budget from Firebase:', id);
    showSyncIndicator('synced');
    return true;
  } catch (err) {
    console.error('Firebase budget delete error:', err);
    return false;
  }
}

// ============================================
// VENDOR / SUPPLIER KHATA SYSTEM
// ============================================

// SAVE OR UPDATE VENDOR
async function saveVendorToFirebase(vendorData) {
  const id = vendorData.id || ('vnd_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6));
  const totalAmount = parseFloat(vendorData.totalAmount) || 0;
  const paidAmount = parseFloat(vendorData.paidAmount) || 0;
  const pendingAmount = Math.max(0, totalAmount - paidAmount);
  const status = pendingAmount <= 0 ? 'settled' : (paidAmount > 0 ? 'partial' : 'pending');

  const cleanHistory = (vendorData.history && Array.isArray(vendorData.history))
    ? vendorData.history.map(h => ({
        id: h.id || ('h_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)),
        type: h.type || 'purchase',
        amount: parseFloat(h.amount) || 0,
        date: h.date || new Date().toISOString().substring(0, 10),
        mode: h.mode || '',
        notes: h.notes || '',
        savedAt: h.savedAt || new Date().toISOString()
      }))
    : (totalAmount > 0 ? [{
        id: 'h_' + Date.now(),
        type: 'purchase',
        amount: totalAmount,
        date: vendorData.date || new Date().toISOString().substring(0, 10),
        mode: '',
        notes: vendorData.notes ? ('Opening Bill: ' + vendorData.notes) : 'Initial Purchase Bill',
        savedAt: new Date().toISOString()
      }] : []);

  const vendorObj = {
    id: id,
    name: (vendorData.name || '').trim(),
    category: (vendorData.category || '🛒 Grocery').trim(),
    phone: (vendorData.phone || '').trim(),
    totalAmount: totalAmount,
    paidAmount: paidAmount,
    pendingAmount: pendingAmount,
    status: status,
    dueDate: vendorData.dueDate || '',
    notes: (vendorData.notes || '').trim(),
    history: cleanHistory,
    createdAt: vendorData.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Optimistically update memory and localStorage
  let vendors = getVendors().slice();
  const idx = vendors.findIndex(v => v.id === id);
  if (idx > -1) {
    vendors[idx] = vendorObj;
  } else {
    vendors.unshift(vendorObj);
  }
  currentVendors = vendors;
  localStorage.setItem('bd_vendors', JSON.stringify(vendors));

  if (typeof Dash !== 'undefined' && Dash.loadVendors) {
    Dash.loadVendors();
  }

  const ref = getUserVendorsRef();
  if (!ref) return vendorObj;

  try {
    showSyncIndicator('syncing');
    await ref.doc(id).set(vendorObj);
    console.log('✅ Saved vendor to Firebase:', id);
    showSyncIndicator('synced');
    return vendorObj;
  } catch (err) {
    console.error('Firebase vendor save error:', err);
    toast('Saved supplier locally.', 'warning');
    return vendorObj;
  }
}

// ADD NEW BILL / PURCHASE TO EXISTING VENDOR (નવો માલ ઉમેરો)
async function addVendorBillToFirebase(vendorId, billAmount, date, notes) {
  const amt = parseFloat(billAmount) || 0;
  if (amt <= 0) return false;

  let vendors = getVendors().slice();
  const idx = vendors.findIndex(v => v.id === vendorId);
  if (idx === -1) return false;

  const vendor = { ...vendors[idx] };
  const history = Array.isArray(vendor.history) ? [...vendor.history] : [];

  history.push({
    id: 'h_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    type: 'purchase',
    amount: amt,
    date: date || new Date().toISOString().substring(0, 10),
    mode: '',
    notes: notes || 'New Goods / Supply Received',
    savedAt: new Date().toISOString()
  });

  vendor.totalAmount = (parseFloat(vendor.totalAmount) || 0) + amt;
  vendor.pendingAmount = Math.max(0, vendor.totalAmount - (parseFloat(vendor.paidAmount) || 0));
  vendor.status = vendor.pendingAmount <= 0 ? 'settled' : ((vendor.paidAmount > 0) ? 'partial' : 'pending');
  vendor.updatedAt = new Date().toISOString();
  if (notes) vendor.notes = notes;
  vendor.history = history;

  vendors[idx] = vendor;
  currentVendors = vendors;
  localStorage.setItem('bd_vendors', JSON.stringify(vendors));

  if (typeof Dash !== 'undefined' && Dash.loadVendors) {
    Dash.loadVendors();
  }

  const ref = getUserVendorsRef();
  if (!ref) return true;

  try {
    showSyncIndicator('syncing');
    await ref.doc(vendorId).set(vendor);
    console.log('✅ Added purchase bill to vendor:', vendorId);
    showSyncIndicator('synced');
    return true;
  } catch (err) {
    console.error('Firebase vendor bill add error:', err);
    return false;
  }
}

// RECORD PAYMENT TO VENDOR (રકમ ચૂકવો & ઓપ્શનલ ખર્ચ એન્ટ્રી)
async function recordVendorPaymentToFirebase(vendorId, payAmount, date, mode, notes, autoAddExpense = true) {
  const amt = parseFloat(payAmount) || 0;
  if (amt <= 0) return false;

  let vendors = getVendors().slice();
  const idx = vendors.findIndex(v => v.id === vendorId);
  if (idx === -1) return false;

  const vendor = { ...vendors[idx] };
  const history = Array.isArray(vendor.history) ? [...vendor.history] : [];

  history.push({
    id: 'h_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    type: 'payment',
    amount: amt,
    date: date || new Date().toISOString().substring(0, 10),
    mode: mode || 'Cash',
    notes: notes || 'Payment to Supplier',
    savedAt: new Date().toISOString()
  });

  vendor.paidAmount = (parseFloat(vendor.paidAmount) || 0) + amt;
  vendor.pendingAmount = Math.max(0, (parseFloat(vendor.totalAmount) || 0) - vendor.paidAmount);
  vendor.status = vendor.pendingAmount <= 0 ? 'settled' : 'partial';
  vendor.updatedAt = new Date().toISOString();
  vendor.history = history;

  vendors[idx] = vendor;
  currentVendors = vendors;
  localStorage.setItem('bd_vendors', JSON.stringify(vendors));

  // Automatically record this payment in the Expense Ledger if enabled
  if (autoAddExpense) {
    const expenseTxn = {
      id: 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      type: 'expense',
      date: date || new Date().toISOString().substring(0, 10),
      category: vendor.category || '💸 Other Expense',
      amount: amt,
      mode: mode || 'Cash',
      from: '',
      vendor: vendor.name || '',
      notes: notes ? (`Paid to ${vendor.name}: ${notes}`) : (`Paid to Supplier: ${vendor.name}`),
      savedAt: new Date().toISOString()
    };
    saveTxnToFirebase(expenseTxn).catch(console.error);
  }

  if (typeof Dash !== 'undefined') {
    if (Dash.loadVendors) Dash.loadVendors();
    if (Dash.loadAll) Dash.loadAll();
  }

  const ref = getUserVendorsRef();
  if (!ref) return true;

  try {
    showSyncIndicator('syncing');
    await ref.doc(vendorId).set(vendor);
    console.log('✅ Recorded payment to vendor:', vendorId);
    showSyncIndicator('synced');
    return true;
  } catch (err) {
    console.error('Firebase vendor payment record error:', err);
    return false;
  }
}

// DELETE VENDOR
async function deleteVendorFromFirebase(vendorId) {
  let vendors = getVendors().slice();
  vendors = vendors.filter(v => v.id !== vendorId);
  currentVendors = vendors;
  localStorage.setItem('bd_vendors', JSON.stringify(vendors));

  if (typeof Dash !== 'undefined' && Dash.loadVendors) {
    Dash.loadVendors();
  }

  const ref = getUserVendorsRef();
  if (!ref) return true;

  try {
    showSyncIndicator('syncing');
    await ref.doc(vendorId).delete();
    console.log('✅ Deleted vendor from Firebase:', vendorId);
    showSyncIndicator('synced');
    return true;
  } catch (err) {
    console.error('Firebase vendor delete error:', err);
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
    showSyncIndicator('synced');
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
let syncIndicatorTimer = null;
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

  if (syncIndicatorTimer) {
    clearTimeout(syncIndicatorTimer);
    syncIndicatorTimer = null;
  }

  const configs = {
    syncing: { bg: '#fef3c7', color: '#92400e', text: '⟳ Syncing...', border: '#fcd34d' },
    synced: { bg: '#d1fae5', color: '#059669', text: '☁️ Synced', border: '#6ee7b7' },
    error: { bg: '#fee2e2', color: '#dc2626', text: '⚠️ Offline', border: '#fca5a5' },
    offline: { bg: '#f1f5f9', color: '#64748b', text: '📴 Offline', border: '#cbd5e1' },
    demo: { bg: '#e0e7ff', color: '#4338ca', text: '💻 Demo Mode', border: '#c7d2fe' }
  };

  const config = configs[status] || configs.synced;
  indicator.style.background = config.bg;
  indicator.style.color = config.color;
  indicator.style.border = '1px solid ' + config.border;
  indicator.textContent = config.text;
  indicator.style.opacity = '1';

  // Auto-resolve "syncing" to "synced" after 1.5s so badge never gets stuck
  if (status === 'syncing') {
    syncIndicatorTimer = setTimeout(() => {
      showSyncIndicator('synced');
    }, 1500);
  } else if (status === 'synced') {
    syncIndicatorTimer = setTimeout(() => {
      if (indicator && indicator.textContent === '☁️ Synced') {
        indicator.style.opacity = '0.6';
      }
    }, 2500);
  }
}

// Network status
window.addEventListener('online', () => {
  if (localStorage.getItem('bd_mode') === 'demo') {
    showSyncIndicator('demo');
    return;
  }
  showSyncIndicator('syncing');
  setTimeout(() => showSyncIndicator('synced'), 1000);
  toast('Back online! Syncing...', 'success');
});

window.addEventListener('offline', () => {
  if (localStorage.getItem('bd_mode') === 'demo') {
    showSyncIndicator('demo');
    return;
  }
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

// IST Date Helpers
function getISTDateParts(date = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(date);
    const partVal = (type) => parts.find(p => p.type === type).value;
    return {
      year: parseInt(partVal('year')),
      month: parseInt(partVal('month')),
      day: parseInt(partVal('day')),
      hour: parseInt(partVal('hour')),
      minute: parseInt(partVal('minute')),
      second: parseInt(partVal('second'))
    };
  } catch (e) {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: date.getSeconds()
    };
  }
}

function getISTDateObject(date = new Date()) {
  const { year, month, day, hour, minute, second } = getISTDateParts(date);
  return new Date(year, month - 1, day, hour, minute, second);
}

function today() {
  const { year, month, day } = getISTDateParts();
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function yesterday() {
  const now = getISTDateObject();
  now.setDate(now.getDate() - 1);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function fmtDate(d) {
  if (!d) return '-';
  try {
    if (typeof d === 'string' && d.includes('-') && d.length === 10) {
      return new Date(d + 'T00:00:00Z').toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        timeZone: 'UTC'
      });
    }
    return new Date(d).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      timeZone: 'Asia/Kolkata'
    });
  } catch { return d; }
}

function fmtDateFull(d) {
  if (!d) return '-';
  try {
    if (typeof d === 'string' && d.includes('-') && d.length === 10) {
      return new Date(d + 'T00:00:00Z').toLocaleDateString('en-IN', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
        timeZone: 'UTC'
      });
    }
    return new Date(d).toLocaleDateString('en-IN', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
      timeZone: 'Asia/Kolkata'
    });
  } catch { return d; }
}

function isToday(d) { return d === today(); }

function isYesterday(d) { return d === yesterday(); }

function isThisWeek(d) {
  if (!d) return false;
  const now = getISTDateObject();
  const dayOfWeek = now.getDay() || 7;

  const start = new Date(now);
  start.setDate(now.getDate() - dayOfWeek + 1);
  const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;

  return d >= startStr && d <= endStr;
}

function isLastWeek(d) {
  if (!d) return false;
  const now = getISTDateObject();
  const dayOfWeek = now.getDay() || 7;

  const start = new Date(now);
  start.setDate(now.getDate() - dayOfWeek - 6);
  const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;

  return d >= startStr && d <= endStr;
}

function isThisMonth(d) {
  if (!d) return false;
  const { year, month } = getISTDateParts();
  const target = `${year}-${String(month).padStart(2, '0')}`;
  return d.substring(0, 7) === target;
}

function isLastMonth(d) {
  if (!d) return false;
  const now = getISTDateObject();
  now.setMonth(now.getMonth() - 1);
  const target = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return d.substring(0, 7) === target;
}

function isThisYear(d) {
  if (!d) return false;
  const { year } = getISTDateParts();
  return d.substring(0, 4) === String(year);
}

function inRange(d, start, end) {
  if (!d || !start || !end) return false;
  return d >= start && d <= end;
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
  return function (...args) {
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

function animateNumber(el, endValue) {
  // Count-up animation removed — values are set instantly for real-time updates.
  if (!el) return;
  el.textContent = endValue;
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
    m.classList.add('closing');
    setTimeout(() => {
      m.classList.remove('open');
      m.classList.remove('closing');
      document.body.style.overflow = '';

      // ✅ AUTO-RESET forms on close (prevents old data)
      if (id === 'incomeModal') {
        if (typeof resetForm === 'function') {
          resetForm('income');
        } else if (typeof TxnPage !== 'undefined' && typeof TxnPage.resetForm === 'function') {
          TxnPage.resetForm('income');
        }
      } else if (id === 'expenseModal') {
        if (typeof resetForm === 'function') {
          resetForm('expense');
        } else if (typeof TxnPage !== 'undefined' && typeof TxnPage.resetForm === 'function') {
          TxnPage.resetForm('expense');
        }
      }
    }, 250);
  }
}

document.addEventListener('click', function (e) {
  if (e.target.classList.contains('modal-bg')) {
    const id = e.target.id;
    closeModal(id);
  }
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-bg.open').forEach(m => {
      closeModal(m.id);
    });
  }
});

function toast(msg, type) {
  type = type || 'success';
  const container = document.getElementById('toastBox');
  if (!container) { alert(msg); return; }
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const colors = { success: '#059669', error: '#dc2626', warning: '#d97706', info: '#6366f1' };
  const t = document.createElement('div');
  t.className = 'toast';
  t.style.borderLeftColor = colors[type] || colors.success;
  t.innerHTML = '<span>' + (icons[type] || '✅') + '</span><span>' + escapeHtml(msg) + '</span>';
  container.appendChild(t);
  setTimeout(function () {
    t.style.opacity = '0';
    t.style.transform = 'translateX(20px)';
    setTimeout(function () { if (t.parentNode) t.remove(); }, 300);
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
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    timeZone: 'Asia/Kolkata'
  });
  const timeStr = now.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
    timeZone: 'Asia/Kolkata'
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

window.addEventListener('resize', debounce(function () {
  if (window.innerWidth > 1023) closeSidebar();
}, 200));

function logout() {
  let modal = document.getElementById('logoutConfirmModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'modal-bg';
    modal.id = 'logoutConfirmModal';
    modal.innerHTML = `
      <div class="modal" style="max-width: 400px; text-align: center;">
        <div class="modal-hd" style="justify-content: center; background: linear-gradient(135deg, rgba(244, 63, 94, 0.08) 0%, rgba(244, 63, 94, 0.03) 100%); border-bottom: 1px solid rgba(244, 63, 94, 0.15);">
          <h3 style="color: var(--expense); display: flex; align-items: center; gap: 8px;"><i data-lucide="log-out" style="width: 18px; height: 18px;"></i><span>Sign Out</span></h3>
        </div>
        <div class="modal-bd" style="padding: 30px 24px;">
          <p style="font-size: 0.95rem; font-weight: 600; color: var(--text-head);">Are you sure you want to sign out?</p>
          <p style="font-size: 0.78rem; color: var(--text-light); margin-top: 4px;">You will need to sign in again to access reports.</p>
        </div>
        <div class="modal-ft" style="justify-content: center; gap: 14px;">
          <button class="btn btn-outline" onclick="closeModal('logoutConfirmModal')">Cancel</button>
          <button class="btn btn-expense" onclick="confirmSignOut()" style="display: inline-flex; align-items: center; gap: 8px;"><i data-lucide="log-out" style="width: 16px; height: 16px;"></i>Sign Out</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }
  openModal('logoutConfirmModal');
}

function confirmSignOut() {
  closeModal('logoutConfirmModal');
  if (firebaseListener) firebaseListener();
  auth.signOut().then(() => {
    localStorage.clear();
    window.location.href = 'login.html';
  });
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
  const budgets = getBudgets();
  const vendors = getVendors();
  const bills = getBills();
  if (!txns.length && !budgets.length && !vendors.length && !bills.length) {
    toast('No data to backup!', 'warning');
    return;
  }
  try {
    const data = {
      version: '5.1',
      business: 'Crust & Chilly',
      exported: new Date().toISOString(),
      count: txns.length,
      transactions: txns,
      budgets: budgets,
      vendors: vendors,
      bills: bills
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
    toast('Complete backup downloaded!', 'success');
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

// Global Helpers to map emojis/categories to Lucide line icons
window.getLucideIconName = function(emojiOrText) {
  if (!emojiOrText) return null;
  const lower = emojiOrText.toLowerCase();
  if (emojiOrText.includes('💰') || lower.includes('cash income') || lower.includes('income')) return 'banknote';
  if (emojiOrText.includes('💵') || lower.includes('cash spent') || lower === 'cash') return 'coins';
  if (emojiOrText.includes('📱') || lower.includes('online payment') || lower === 'online') return 'smartphone';
  if (emojiOrText.includes('📲') || lower.includes('upi')) return 'phone-call';
  if (emojiOrText.includes('🏦') || lower.includes('bank')) return 'landmark';
  if (emojiOrText.includes('💳') || lower.includes('card')) return 'credit-card';
  if (emojiOrText.includes('📄') || lower.includes('cheque')) return 'file-text';
  if (emojiOrText.includes('🛒') || lower.includes('sales') || lower.includes('grocery')) return 'shopping-cart';
  if (emojiOrText.includes('🧾') || lower.includes('electricity')) return 'zap';
  if (emojiOrText.includes('📡') || lower.includes('internet')) return 'wifi';
  if (emojiOrText.includes('🏠') || lower.includes('rent')) return 'home';
  if (emojiOrText.includes('🥦') || lower.includes('vegetable')) return 'salad';
  if (emojiOrText.includes('🍞') || lower.includes('bread') || lower.includes('bakery')) return 'cookie';
  if (emojiOrText.includes('🍔') || lower.includes('food') || lower.includes('dining')) return 'pizza';
  if (emojiOrText.includes('🚗') || lower.includes('transport') || lower.includes('fuel') || emojiOrText.includes('⛽')) return 'car';
  if (emojiOrText.includes('👥') || lower.includes('salary') || lower.includes('wages')) return 'users';
  if (emojiOrText.includes('🔨') || lower.includes('maintenance') || lower.includes('repair') || lower.includes('cleaning')) return 'wrench';
  if (emojiOrText.includes('📢') || lower.includes('marketing') || lower.includes('ads')) return 'megaphone';
  if (emojiOrText.includes('📦') || lower.includes('supplies') || lower.includes('other')) return 'package';
  if (emojiOrText.includes('📋') || lower.includes('tax') || lower.includes('records')) return 'clipboard-list';
  if (emojiOrText.includes('↩️') || lower.includes('refund')) return 'rotate-ccw';
  if (emojiOrText.includes('📈') || lower.includes('investment') || lower.includes('revenue') || lower.includes('profit')) return 'trending-up';
  if (emojiOrText.includes('📉') || lower.includes('expense')) return 'trending-down';
  if (emojiOrText.includes('🎁') || lower.includes('gift') || lower.includes('bonus')) return 'gift';
  if (emojiOrText.includes('🛵') || lower.includes('swiggy') || lower.includes('zomato')) return 'send';
  return null;
};

// Formatter to strip emojis and wrap in dynamic Lucide HTML
window.getFormattedOptionHtml = function(text, size = 14) {
  if (!text) return '<span>Select</span>';
  const iconName = window.getLucideIconName(text);
  const cleanText = text.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDC00-\uDFFF]/g, '').trim();
  if (iconName) {
    return `<span style="display:inline-flex; align-items:center; gap:8px;"><i data-lucide="${iconName}" style="width: ${size}px; height: ${size}px; color: var(--brand);"></i><span>${cleanText}</span></span>`;
  }
  return `<span>${text}</span>`;
};

function initializeCustomDropdowns() {
  const selects = document.querySelectorAll('select');
  selects.forEach(select => {
    if (select.getAttribute('data-custom-select') === 'true') return;

    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select';

    if (select.classList.contains('chart-sel')) {
      wrapper.classList.add('chart-sel-wrapper');
    } else if (select.classList.contains('an-filter-select')) {
      wrapper.classList.add('an-filters-wrapper');
    }

    select.style.cssText = 'opacity:0; position:absolute; pointer-events:none; z-index:-1; width:0; height:0; overflow:hidden; margin:0; padding:0; border:none;';

    const trigger = document.createElement('div');
    trigger.className = 'custom-select-trigger';

    const optionsList = document.createElement('div');
    optionsList.className = 'custom-select-options';

    wrapper.appendChild(trigger);
    wrapper.appendChild(optionsList);

    select.parentNode.insertBefore(wrapper, select.nextSibling);
    select.setAttribute('data-custom-select', 'true');

    function rebuildOptions() {
      optionsList.innerHTML = '';
      const options = select.querySelectorAll('option');
      let selectedText = '';

      options.forEach(opt => {
        const customOpt = document.createElement('div');
        customOpt.className = 'custom-option';
        customOpt.innerHTML = getFormattedOptionHtml(opt.textContent);
        customOpt.setAttribute('data-value', opt.value);

        if (opt.selected) {
          customOpt.classList.add('selected');
          selectedText = opt.textContent;
        }

        customOpt.addEventListener('click', (e) => {
          e.stopPropagation();
          optionsList.querySelectorAll('.custom-option').forEach(co => co.classList.remove('selected'));
          customOpt.classList.add('selected');

          select.value = opt.value;
          trigger.innerHTML = getFormattedOptionHtml(opt.textContent);
          wrapper.classList.remove('open');

          const event = new Event('change', { bubbles: true });
          select.dispatchEvent(event);
          if (typeof lucide !== 'undefined') lucide.createIcons();
        });

        optionsList.appendChild(customOpt);
      });

      trigger.innerHTML = getFormattedOptionHtml(selectedText || (options[0] ? options[0].textContent : 'Select'));
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    rebuildOptions();

    const observer = new MutationObserver(() => {
      rebuildOptions();
    });
    observer.observe(select, { childList: true });

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = wrapper.classList.contains('open');

      document.querySelectorAll('.custom-select.open').forEach(cs => {
        if (cs !== wrapper) cs.classList.remove('open');
      });

      wrapper.classList.toggle('open', !isOpen);
    });
  });
}

// Bind load callbacks
window.addEventListener('DOMContentLoaded', () => {
  initializeCustomDropdowns();
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
});

// Setup observer on document body to capture dynamically added selects
const docObserver = new MutationObserver(() => {
  initializeCustomDropdowns();
});
docObserver.observe(document.body, { childList: true, subtree: true });

// Close all custom dropdowns when clicking outside
document.addEventListener('click', () => {
  document.querySelectorAll('.custom-select.open').forEach(cs => {
    cs.classList.remove('open');
  });
});

// ==========================================================================
// PREMIUM DYNAMIC THEME & ACCENT CONTROLLER
// ==========================================================================

const themeColors = {
  getBrand: () => getComputedStyle(document.documentElement).getPropertyValue('--brand').trim() || '#6366F1',
  getBrandDark: () => getComputedStyle(document.documentElement).getPropertyValue('--brand-dark').trim() || '#4F46E5',
  getBrandLight: () => getComputedStyle(document.documentElement).getPropertyValue('--brand-light').trim() || '#EEF2F6',
  getBorder: () => getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || '#E2E8F0',
  getTextHead: () => getComputedStyle(document.documentElement).getPropertyValue('--text-head').trim() || '#0F172A',
  getTextMuted: () => getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#64748B',
  getIncome: () => getComputedStyle(document.documentElement).getPropertyValue('--income').trim() || '#10B981',
  getExpense: () => getComputedStyle(document.documentElement).getPropertyValue('--expense').trim() || '#F43F5E',
  getProfit: () => getComputedStyle(document.documentElement).getPropertyValue('--profit').trim() || '#F59E0B',
  getPurple: () => getComputedStyle(document.documentElement).getPropertyValue('--purple').trim() || '#8b5cf6',
  getGridColor: () => document.documentElement.getAttribute('data-theme') === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.04)'
};

const APP_THEME = {
  theme: 'light',
  accent: 'indigo',

  init: function() {
    this.theme = localStorage.getItem('bd_theme') || 'light';
    this.accent = localStorage.getItem('bd_accent') || 'indigo';

    document.documentElement.setAttribute('data-theme', this.theme);
    document.documentElement.setAttribute('data-accent', this.accent);

    window.addEventListener('DOMContentLoaded', () => {
      this.updateUI();
      // Setup click handler to close theme dropdown when clicking outside
      document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('themeDropdown');
        const wrapper = document.querySelector('.theme-picker-wrapper');
        if (dropdown && wrapper && !wrapper.contains(e.target)) {
          dropdown.style.display = 'none';
        }
      });
    });
  },

  toggleMenu: function(e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById('themeDropdown');
    if (dropdown) {
      const isHidden = dropdown.style.display === 'none' || !dropdown.style.display;
      dropdown.style.display = isHidden ? 'flex' : 'none';
      if (isHidden) {
        this.updateUI();
      }
    }
  },

  setTheme: function(theme) {
    this.theme = theme;
    localStorage.setItem('bd_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    this.updateUI();
    this.reloadCharts();
  },

  setAccent: function(accent) {
    this.accent = accent;
    localStorage.setItem('bd_accent', accent);
    document.documentElement.setAttribute('data-accent', accent);
    this.updateUI();
    this.reloadCharts();
  },

  updateUI: function() {
    // Mode Buttons Highlight
    const btnLight = document.getElementById('theme-btn-light');
    const btnDark = document.getElementById('theme-btn-dark');
    
    if (btnLight && btnDark) {
      if (this.theme === 'light') {
        btnLight.style.borderColor = 'var(--brand)';
        btnLight.style.background = 'var(--brand-soft)';
        btnLight.style.color = 'var(--brand)';
        
        btnDark.style.borderColor = 'var(--border)';
        btnDark.style.background = 'var(--bg-page)';
        btnDark.style.color = 'var(--text-head)';
      } else {
        btnDark.style.borderColor = 'var(--brand)';
        btnDark.style.background = 'var(--brand-soft)';
        btnDark.style.color = 'var(--brand)';
        
        btnLight.style.borderColor = 'var(--border)';
        btnLight.style.background = 'var(--bg-page)';
        btnLight.style.color = 'var(--text-head)';
      }
    }

    // Accent Dots Highlight
    const accents = ['blue', 'emerald', 'indigo', 'rose', 'amber'];
    accents.forEach(acc => {
      const btn = document.getElementById('accent-dot-' + acc);
      if (btn) {
        if (this.accent === acc) {
          btn.style.borderColor = 'var(--text-head)';
          btn.style.transform = 'scale(1.15)';
          btn.style.boxShadow = '0 0 0 3px var(--bg-card), 0 0 0 5px var(--brand)';
        } else {
          btn.style.borderColor = 'transparent';
          btn.style.transform = 'scale(1)';
          btn.style.boxShadow = 'none';
        }
      }
    });

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  },

  reloadCharts: function() {
    // Reload Dashboard Charts if they exist
    if (typeof Dash !== 'undefined') {
      if (Dash.charts) {
        Object.keys(Dash.charts).forEach(key => {
          if (Dash.charts[key]) {
            if (typeof Dash.charts[key].destroy === 'function') {
              Dash.charts[key].destroy();
            }
            Dash.charts[key] = null;
          }
        });
      }
      Dash.loadAll();
    }

    // Reload Analytics Page Charts if they exist
    if (typeof AnalyticsPage !== 'undefined') {
      if (AnalyticsPage.charts) {
        Object.keys(AnalyticsPage.charts).forEach(key => {
          if (AnalyticsPage.charts[key]) {
            if (typeof AnalyticsPage.charts[key].destroy === 'function') {
              AnalyticsPage.charts[key].destroy();
            }
            AnalyticsPage.charts[key] = null;
          }
        });
      }
      AnalyticsPage.loadAll();
    }
  }
};

// Start the theme controller immediately
APP_THEME.init();