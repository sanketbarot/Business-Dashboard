/* ============================================
   TRANSACTION-PAGE.JS v5.0
   Firebase Real-time Sync
   ============================================ */

'use strict';

const TxnPage = {

  state: {
    data: [],
    filtered: [],
    page: 1,
    perPage: 12,
    filter: 'all',
    selected: new Set(),
    view: 'table',
    sortBy: 'date-desc',
    lastQuery: ''
  },

  icons: {
    payment: {
      'Cash': '💵',
      'Online': '📱',
      'UPI': '📲',
      'Bank Transfer': '🏦',
      'Card': '💳',
      'Cheque': '📄'
    }
  },

  init: function() {
    try {
      const iDate = document.getElementById('iDate');
      const eDate = document.getElementById('eDate');
      if (iDate) iDate.value = today();
      if (eDate) eDate.value = today();

      this.buildCategoryFilter();
      this.apply();
      this.setupResize();
      this.setupKeyboard();
      this.animateStats();
    } catch (err) {
      console.error('Init error:', err);
    }
  },

  animateStats: function() {
    setTimeout(() => {
      ['tsIncome', 'tsExpense', 'tsProfit', 'tsCount'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.textContent && typeof animateNumber === 'function') {
          animateNumber(el, el.textContent);
        }
      });
    }, 500);
  },

  buildCategoryFilter: function() {
    const sel = document.getElementById('catFilter');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">📂 All Categories</option>';
    const all = getTxns();
    const catSet = new Set();
    for (let i = 0; i < all.length; i++) {
      if (all[i].category) catSet.add(all[i].category);
    }
    const cats = Array.from(catSet).sort();
    cats.forEach(function(c) {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      sel.appendChild(opt);
    });
    if (current && cats.indexOf(current) > -1) sel.value = current;
  },

  setFilter: function(f, btn) {
    this.state.filter = f;
    const tabs = document.querySelectorAll('.ft');
    for (let i = 0; i < tabs.length; i++) tabs[i].classList.remove('active');
    if (btn) btn.classList.add('active');
    const cr = document.getElementById('customRange');
    if (cr) {
      if (f === 'custom') cr.classList.add('show');
      else cr.classList.remove('show');
    }
    this.apply();
  },

  clear: function() {
    this.state.filter = 'all';
    this.state.page = 1;
    this.state.selected.clear();
    const tabs = document.querySelectorAll('.ft');
    for (let i = 0; i < tabs.length; i++) tabs[i].classList.remove('active');
    const allTab = document.querySelector('.ft[data-f="all"]');
    if (allTab) allTab.classList.add('active');
    const resetIds = {
      'typeFilter': 'all',
      'catFilter': '',
      'modeFilter': '',
      'sortFilter': 'date-desc',
      'txnSearch': '',
      'mainSearch': '',
      'fStart': '',
      'fEnd': ''
    };
    for (const id in resetIds) {
      const el = document.getElementById(id);
      if (el) el.value = resetIds[id];
    }
    const cr = document.getElementById('customRange');
    if (cr) cr.classList.remove('show');
    this.apply();
    toast('Filters cleared', 'info');
  },

  apply: function() {
    try {
      let data = getTxns();

      const fStart = document.getElementById('fStart') ? document.getElementById('fStart').value : '';
      const fEnd = document.getElementById('fEnd') ? document.getElementById('fEnd').value : '';
      data = filterByPeriod(data, this.state.filter, fStart, fEnd);

      const type = document.getElementById('typeFilter') ? document.getElementById('typeFilter').value : 'all';
      if (type !== 'all') {
        data = data.filter(function(t) { return t.type === type; });
      }

      const cat = document.getElementById('catFilter') ? document.getElementById('catFilter').value : '';
      if (cat) {
        data = data.filter(function(t) { return t.category === cat; });
      }

      const mode = document.getElementById('modeFilter') ? document.getElementById('modeFilter').value : '';
      if (mode) {
        data = data.filter(function(t) { return (t.mode || 'Cash') === mode; });
      }

      const q1 = (document.getElementById('txnSearch') ? document.getElementById('txnSearch').value : '').trim().toLowerCase();
      const q2 = (document.getElementById('mainSearch') ? document.getElementById('mainSearch').value : '').trim().toLowerCase();
      const query = q1 || q2;

      if (query) {
        this.state.lastQuery = query;
        data = data.filter(function(t) {
          return (t.category || '').toLowerCase().indexOf(query) > -1 ||
                 String(t.amount || '').indexOf(query) > -1 ||
                 (t.notes || '').toLowerCase().indexOf(query) > -1 ||
                 (t.from || '').toLowerCase().indexOf(query) > -1 ||
                 (t.vendor || '').toLowerCase().indexOf(query) > -1 ||
                 (t.mode || '').toLowerCase().indexOf(query) > -1 ||
                 fmtDate(t.date).toLowerCase().indexOf(query) > -1;
        });
      } else {
        this.state.lastQuery = '';
      }

      const sort = document.getElementById('sortFilter') ? document.getElementById('sortFilter').value : 'date-desc';
      this.state.sortBy = sort;
      data = this.sortData(data, sort);

      this.state.data = data;
      this.state.filtered = data;
      this.state.page = 1;
      this.state.selected.clear();
      this.updateStats(data);
      this.render();
    } catch (err) {
      console.error('Apply error:', err);
    }
  },

  sortData: function(data, sort) {
    const parts = sort.split('-');
    const key = parts[0];
    const order = parts[1];
    const dir = order === 'desc' ? -1 : 1;
    return data.slice().sort(function(a, b) {
      let va, vb;
      if (key === 'date') {
        va = new Date(a.date).getTime() || 0;
        vb = new Date(b.date).getTime() || 0;
      } else if (key === 'amount') {
        va = parseFloat(a.amount) || 0;
        vb = parseFloat(b.amount) || 0;
      } else {
        va = String(a[key] || '').toLowerCase();
        vb = String(b[key] || '').toLowerCase();
      }
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  },

  updateStats: function(data) {
    let income = 0, expense = 0, iC = 0, eC = 0;
    for (let i = 0; i < data.length; i++) {
      const t = data[i];
      const amt = parseFloat(t.amount) || 0;
      if (t.type === 'income') { income += amt; iC++; }
      else if (t.type === 'expense') { expense += amt; eC++; }
    }
    const profit = income - expense;
    const margin = income > 0 ? Math.round((profit / income) * 100) : 0;
    this.setText('tsIncome', inr(income));
    this.setText('tsExpense', inr(expense));
    this.setText('tsProfit', inr(profit));
    this.setText('tsCount', data.length);
    this.setText('tsIncomeCount', iC + ' records');
    this.setText('tsExpenseCount', eC + ' records');
    this.setText('tsMargin', margin + '% margin');
    this.setText('recTag', data.length + ' records');
    const pEl = document.getElementById('tsProfit');
    if (pEl) pEl.className = 'tx-stat-val ' + (profit >= 0 ? 'text-profit' : 'text-expense');
    const start = (this.state.page - 1) * this.state.perPage + 1;
    const end = Math.min(start + this.state.perPage - 1, data.length);
    if (data.length === 0) {
      this.setText('tableInfo', 'No records to show');
    } else {
      this.setText('tableInfo', 'Showing ' + start + '–' + end + ' of ' + data.length + ' records');
    }
  },

  setText: function(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  },

  render: function() {
    const isMobile = window.innerWidth <= 599;
    const isCard = this.state.view === 'card';
    if (isCard && !isMobile) {
      this.renderCards();
    } else if (isMobile) {
      this.renderMobileRows();
    } else {
      this.renderTable();
    }
    this.renderPagination();
    this.updateBulk();
  },

  renderTable: function() {
    const tableView = document.getElementById('tableView');
    const cardView = document.getElementById('cardView');
    if (tableView) tableView.style.display = '';
    if (cardView) cardView.style.display = 'none';
    const tbody = document.getElementById('txnBody');
    if (!tbody) return;
    const start = (this.state.page - 1) * this.state.perPage;
    const pageData = this.state.filtered.slice(start, start + this.state.perPage);
    if (!pageData.length) {
      tbody.innerHTML = this.getEmptyRow(9);
      return;
    }
    const self = this;
    tbody.innerHTML = pageData.map(function(t) {
      const isI = t.type === 'income';
      const sel = self.state.selected.has(t.id);
      const bg = sel ? 'background:var(--brand-soft);' : '';
      const notes = t.notes || '';
      const truncNote = notes.length > 20 ? notes.slice(0, 20) + '...' : (notes || '-');
      const customer = t.from || t.vendor || '-';
      return '<tr style="' + bg + '">' +
        '<td><input type="checkbox" ' + (sel ? 'checked' : '') +
        ' style="accent-color:var(--brand);cursor:pointer;width:18px;height:18px;"' +
        ' onchange="TxnPage.select(\'' + t.id + '\', this)"/></td>' +
        '<td style="font-size:0.82rem;white-space:nowrap;font-weight:500;">' + fmtDate(t.date) + '</td>' +
        '<td><span class="badge ' + (isI ? 'badge-in' : 'badge-out') + '">' +
        (isI ? '💰' : '💸') + ' ' + (isI ? 'Income' : 'Expense') + '</span></td>' +
        '<td style="font-size:0.85rem;font-weight:600;">' + escapeHtml(t.category || '-') + '</td>' +
        '<td class="' + (isI ? 'amt-in' : 'amt-out') + '" style="font-size:0.95rem;">' +
        (isI ? '+' : '-') + ' ' + inr(t.amount) + '</td>' +
        '<td style="font-size:0.8rem;color:var(--text-muted);font-weight:500;">' +
        (self.icons.payment[t.mode] || '💰') + ' ' + escapeHtml(t.mode || 'Cash') + '</td>' +
        '<td style="font-size:0.8rem;color:var(--text-muted);">' + escapeHtml(customer) + '</td>' +
        '<td style="font-size:0.78rem;color:var(--text-muted);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + escapeHtml(notes) + '">' +
        escapeHtml(truncNote) + '</td>' +
        '<td><div style="display:flex;gap:5px;">' +
        '<button class="act act-v" onclick="TxnPage.view(\'' + t.id + '\')" title="View">👁️</button>' +
        '<button class="act act-e" onclick="TxnPage.edit(\'' + t.id + '\')" title="Edit">✏️</button>' +
        '<button class="act act-d" onclick="TxnPage.del(\'' + t.id + '\')" title="Delete">🗑️</button>' +
        '</div></td>' +
        '</tr>';
    }).join('');
  },

  renderMobileRows: function() {
    const tableView = document.getElementById('tableView');
    const cardView = document.getElementById('cardView');
    if (tableView) tableView.style.display = '';
    if (cardView) cardView.style.display = 'none';
    const tbody = document.getElementById('txnBody');
    if (!tbody) return;
    const start = (this.state.page - 1) * this.state.perPage;
    const pageData = this.state.filtered.slice(start, start + this.state.perPage);
    if (!pageData.length) {
      tbody.innerHTML = this.getEmptyRow(9);
      return;
    }
    const self = this;
    tbody.innerHTML = pageData.map(function(t) {
      const isI = t.type === 'income';
      const sel = self.state.selected.has(t.id);
      const bg = sel ? 'background:var(--brand-soft);' : '';
      return '<tr><td colspan="9" style="padding:0;">' +
        '<div class="mobile-txn-row" style="' + bg + '">' +
        '<div class="mobile-txn-check">' +
        '<input type="checkbox" ' + (sel ? 'checked' : '') +
        ' onchange="TxnPage.select(\'' + t.id + '\', this)"/></div>' +
        '<div class="mobile-txn-body" onclick="TxnPage.view(\'' + t.id + '\')">' +
        '<div class="mobile-txn-line1">' +
        '<div class="mobile-txn-cat">' + escapeHtml(t.category || '-') + '</div>' +
        '<div class="mobile-txn-amt ' + (isI ? 'amt-in' : 'amt-out') + '">' +
        (isI ? '+' : '-') + ' ' + inrShort(t.amount) + '</div>' +
        '</div>' +
        '<div class="mobile-txn-line2">' +
        '<div class="mobile-txn-meta">' +
        '<span>' + fmtDate(t.date) + '</span>' +
        '<span class="mobile-txn-badge ' + (isI ? 'badge-in' : 'badge-out') + '">' +
        (isI ? '💰' : '💸') + '</span>' +
        '<span>' + (self.icons.payment[t.mode] || '💰') + ' ' + escapeHtml(t.mode || 'Cash') + '</span>' +
        '</div></div></div>' +
        '<div class="mobile-txn-actions">' +
        '<button class="act act-e" onclick="TxnPage.edit(\'' + t.id + '\')" title="Edit">✏️</button>' +
        '<button class="act act-d" onclick="TxnPage.del(\'' + t.id + '\')" title="Delete">🗑️</button>' +
        '</div></div></td></tr>';
    }).join('');
  },

  renderCards: function() {
    const tableView = document.getElementById('tableView');
    const cardView = document.getElementById('cardView');
    if (tableView) tableView.style.display = 'none';
    if (!cardView) return;
    cardView.style.display = 'grid';
    const start = (this.state.page - 1) * this.state.perPage;
    const pageData = this.state.filtered.slice(start, start + this.state.perPage);
    if (!pageData.length) {
      cardView.innerHTML = '<div style="grid-column:1/-1;">' + this.getEmptyContent() + '</div>';
      return;
    }
    const self = this;
    cardView.innerHTML = pageData.map(function(t) {
      const isI = t.type === 'income';
      const sel = self.state.selected.has(t.id);
      const style = sel ? 'background:var(--brand-soft);border-color:var(--brand);' : '';
      return '<div class="tx-card" style="' + style + '">' +
        '<div class="tx-card-top">' +
        '<div style="flex:1;min-width:0;cursor:pointer;" onclick="TxnPage.view(\'' + t.id + '\')">' +
        '<div class="tx-card-cat">' + escapeHtml(t.category || '-') + '</div>' +
        '<div class="tx-card-date">' + fmtDate(t.date) + '</div>' +
        '</div>' +
        '<span class="badge ' + (isI ? 'badge-in' : 'badge-out') + '">' +
        (isI ? '💰' : '💸') + '</span>' +
        '</div>' +
        '<div class="tx-card-amt ' + (isI ? 'amt-in' : 'amt-out') + '" onclick="TxnPage.view(\'' + t.id + '\')" style="cursor:pointer;">' +
        (isI ? '+' : '-') + ' ' + inr(t.amount) + '</div>' +
        '<div class="tx-card-foot">' +
        '<span class="tx-card-mode">' +
        (self.icons.payment[t.mode] || '💰') + ' ' + escapeHtml(t.mode || 'Cash') + '</span>' +
        '<span style="display:flex;gap:4px;align-items:center;">' +
        '<button class="act act-e" onclick="event.stopPropagation();TxnPage.edit(\'' + t.id + '\')">✏️</button>' +
        '<button class="act act-d" onclick="event.stopPropagation();TxnPage.del(\'' + t.id + '\')">🗑️</button>' +
        '</span></div></div>';
    }).join('');
  },

  getEmptyRow: function(colspan) {
    return '<tr><td colspan="' + colspan + '">' + this.getEmptyContent() + '</td></tr>';
  },

  getEmptyContent: function() {
    const hasFilters = this.hasFilters();
    return '<div class="empty">' +
      '<div class="empty-icon">' + (hasFilters ? '🔍' : '💳') + '</div>' +
      '<h4>' + (hasFilters ? 'No results found' : 'No transactions yet') + '</h4>' +
      '<p>' + (hasFilters ? 'Try changing filters' : 'Add your first income or expense') + '</p>' +
      (hasFilters ? '<button class="btn btn-outline btn-sm" style="margin-top:12px;" onclick="TxnPage.clear()">✕ Clear Filters</button>' : '') +
      '</div>';
  },

  hasFilters: function() {
    return (
      this.state.filter !== 'all' ||
      (document.getElementById('typeFilter') && document.getElementById('typeFilter').value !== 'all') ||
      (document.getElementById('catFilter') && document.getElementById('catFilter').value) ||
      (document.getElementById('modeFilter') && document.getElementById('modeFilter').value) ||
      (document.getElementById('txnSearch') && document.getElementById('txnSearch').value.trim()) ||
      (document.getElementById('mainSearch') && document.getElementById('mainSearch').value.trim())
    );
  },

  renderPagination: function() {
    const container = document.getElementById('pagination');
    if (!container) return;
    const total = Math.ceil(this.state.filtered.length / this.state.perPage);
    if (total <= 1) { container.innerHTML = ''; return; }
    const current = this.state.page;
    let html = '';
    html += '<button class="pg" ' + (current === 1 ? 'disabled' : '') +
      ' onclick="TxnPage.goPage(' + (current - 1) + ')">← Prev</button>';
    for (let i = 1; i <= total; i++) {
      if (i === 1 || i === total || (i >= current - 1 && i <= current + 1)) {
        html += '<button class="pg ' + (i === current ? 'active' : '') +
          '" onclick="TxnPage.goPage(' + i + ')">' + i + '</button>';
      } else if (i === current - 2 || i === current + 2) {
        html += '<span style="padding:0 6px;color:var(--text-muted);font-weight:700;">...</span>';
      }
    }
    html += '<button class="pg" ' + (current === total ? 'disabled' : '') +
      ' onclick="TxnPage.goPage(' + (current + 1) + ')">Next →</button>';
    container.innerHTML = html;
  },

  goPage: function(p) {
    const total = Math.ceil(this.state.filtered.length / this.state.perPage);
    if (p < 1 || p > total) return;
    this.state.page = p;
    this.render();
    this.updateStats(this.state.filtered);
    const content = document.querySelector('.content');
    if (content) {
      content.scrollTo({ top: 300, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 300, behavior: 'smooth' });
    }
  },

  select: function(id, cb) {
    if (cb.checked) this.state.selected.add(id);
    else this.state.selected.delete(id);
    this.updateBulk();
    const selAll = document.getElementById('selAll');
    if (selAll) {
      selAll.checked = this.state.selected.size === this.state.filtered.length && this.state.filtered.length > 0;
    }
  },

  selectAll: function() {
    const cb = document.getElementById('selAll');
    if (!cb) return;
    const self = this;
    if (cb.checked) this.state.filtered.forEach(function(t) { self.state.selected.add(t.id); });
    else this.state.selected.clear();
    this.render();
  },

  updateBulk: function() {
    const bar = document.getElementById('bulkBar');
    const txt = document.getElementById('bulkTxt');
    const count = this.state.selected.size;
    if (bar) {
      if (count > 0) bar.classList.add('show');
      else bar.classList.remove('show');
    }
    if (txt) txt.textContent = count + ' selected';
  },

  // ============================================
  // FIREBASE: BULK DELETE
  // ============================================
  bulkDel: async function() {
    if (!this.state.selected.size) return;
    const num = this.state.selected.size;
    if (!confirm('Delete ' + num + ' selected transaction(s)? This cannot be undone.')) return;

    const ids = Array.from(this.state.selected);

    // Delete from Firebase
    if (typeof deleteMultipleFromFirebase === 'function') {
      await deleteMultipleFromFirebase(ids);
    } else {
      // Fallback to localStorage
      let data = getTxns();
      const self = this;
      data = data.filter(function(t) { return !self.state.selected.has(t.id); });
      saveTxns(data);
    }

    this.state.selected.clear();
    this.buildCategoryFilter();
    // Firebase listener will auto-refresh
    if (!firebaseReady) this.apply();
    toast('Deleted ' + num + ' transactions ☁️', 'success');
  },

  // ============================================
  // VIEW DETAIL
  // ============================================
  view: function(id) {
    const t = getTxns().find(function(x) { return x.id === id; });
    if (!t) return;
    const isI = t.type === 'income';
    const hd = document.getElementById('detailHd');
    const grid = document.getElementById('detailGrid');
    const editBtn = document.getElementById('detailEditBtn');
    if (!grid) return;
    if (hd) {
      hd.style.background = isI
        ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)'
        : 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)';
      const h3 = hd.querySelector('h3');
      if (h3) h3.textContent = isI ? '💰 Income Details' : '💸 Expense Details';
    }
    const customer = t.from || t.vendor;
    const customerLbl = isI ? 'Customer' : 'Vendor';
    const dayName = new Date(t.date + 'T00:00:00Z').toLocaleDateString('en-IN', { weekday: 'long', timeZone: 'UTC' });
    grid.innerHTML =
      '<div class="detail-item"><div class="detail-lbl">Date</div><div class="detail-val">' + fmtDate(t.date) + '</div></div>' +
      '<div class="detail-item"><div class="detail-lbl">Day</div><div class="detail-val">' + dayName + '</div></div>' +
      '<div class="detail-item"><div class="detail-lbl">Type</div><div class="detail-val ' + (isI ? 'text-income' : 'text-expense') + '">' + (isI ? '💰 Income' : '💸 Expense') + '</div></div>' +
      '<div class="detail-item"><div class="detail-lbl">Category</div><div class="detail-val">' + escapeHtml(t.category || '-') + '</div></div>' +
      '<div class="detail-item full"><div class="detail-lbl">Amount</div><div class="detail-val ' + (isI ? 'text-income' : 'text-expense') + '" style="font-size:1.5rem;">' + inr(t.amount) + '</div></div>' +
      '<div class="detail-item"><div class="detail-lbl">Mode</div><div class="detail-val">' + (this.icons.payment[t.mode] || '💰') + ' ' + escapeHtml(t.mode || 'Cash') + '</div></div>' +
      '<div class="detail-item"><div class="detail-lbl">' + customerLbl + '</div><div class="detail-val">' + escapeHtml(customer || '—') + '</div></div>' +
      (t.notes ? '<div class="detail-item full"><div class="detail-lbl">Notes</div><div class="detail-val" style="font-weight:500;">' + escapeHtml(t.notes) + '</div></div>' : '') +
      (t.savedAt ? '<div class="detail-item full"><div class="detail-lbl">Created</div><div class="detail-val" style="font-size:0.85rem;">' + new Date(t.savedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + '</div></div>' : '') +
      '<div class="detail-item full"><div class="detail-lbl">Sync Status</div><div class="detail-val" style="font-size:0.82rem;color:var(--income);">☁️ Synced to Cloud</div></div>';

    if (editBtn) {
      const self = this;
      editBtn.onclick = function() {
        closeModal('detailModal');
        setTimeout(function() { self.edit(id); }, 200);
      };
    }
    openModal('detailModal');
  },

  // ============================================
  // FIREBASE: EDIT
  // ============================================
  edit: function(id) {
    const t = getTxns().find(function(x) { return x.id === id; });
    if (!t) return;
    const isI = t.type === 'income';
    const setVal = function(elId, val) {
      const el = document.getElementById(elId);
      if (el) el.value = val || '';
    };
    setVal(isI ? 'iDate' : 'eDate', t.date);
    setVal(isI ? 'iCat' : 'eCat', t.category);
    setVal(isI ? 'iAmt' : 'eAmt', t.amount);
    setVal(isI ? 'iMode' : 'eMode', t.mode || 'Cash');
    setVal(isI ? 'iNote' : 'eNote', t.notes);
    setVal(isI ? 'iEditId' : 'eEditId', t.id);
    if (isI) setVal('iFrom', t.from);
    else setVal('eVendor', t.vendor);
    const titleId = isI ? 'incomeTitle' : 'expenseTitle';
    const title = document.getElementById(titleId);
    if (title) title.textContent = isI ? '✏️ Edit Income' : '✏️ Edit Expense';
    if (typeof previewAmt === 'function') previewAmt(t.type);
    openModal(isI ? 'incomeModal' : 'expenseModal');
  },

  // ============================================
  // FIREBASE: DELETE SINGLE
  // ============================================
  del: async function(id) {
    const t = getTxns().find(function(x) { return x.id === id; });
    if (!t) return;
    const isI = t.type === 'income';
    const label = isI ? 'income' : 'expense';
    if (!confirm('Delete this ' + label + ' of ' + inr(t.amount) + '?\nCategory: ' + t.category + '\nDate: ' + fmtDate(t.date) + '\n\nThis cannot be undone.')) return;

    // Delete from Firebase
    if (typeof deleteTxnFromFirebase === 'function') {
      await deleteTxnFromFirebase(id);
    } else {
      // Fallback to localStorage
      let data = getTxns();
      data = data.filter(function(x) { return x.id !== id; });
      saveTxns(data);
    }

    this.state.selected.delete(id);
    this.buildCategoryFilter();
    // Firebase listener will auto-refresh
    if (!firebaseReady) this.apply();
    toast('Deleted ' + label + ' of ' + inr(t.amount) + ' ☁️', 'success');
  },

  // ============================================
  // FIREBASE: SAVE (Create / Update)
  // ============================================
  save: async function(type) {
    const isI = type === 'income';
    const date = document.getElementById(isI ? 'iDate' : 'eDate').value.trim();
    const cat = document.getElementById(isI ? 'iCat' : 'eCat').value.trim();
    const amt = document.getElementById(isI ? 'iAmt' : 'eAmt').value.trim();
    const mode = document.getElementById(isI ? 'iMode' : 'eMode').value || 'Cash';
    const notes = document.getElementById(isI ? 'iNote' : 'eNote').value.trim();
    const editId = document.getElementById(isI ? 'iEditId' : 'eEditId').value.trim();
    const from = isI ? document.getElementById('iFrom').value.trim() : '';
    const vendor = !isI ? document.getElementById('eVendor').value.trim() : '';

    if (!date) { toast('Please select a date', 'error'); return; }
    if (!cat) { toast('Please select a category', 'error'); return; }
    const amount = parseFloat(amt);
    if (!amount || amount <= 0 || isNaN(amount)) {
      toast('Please enter a valid amount', 'error');
      return;
    }

    const entry = {
      id: editId || uid(),
      type: type,
      date: date,
      category: cat,
      amount: amount,
      mode: mode,
      from: from,
      vendor: vendor,
      notes: notes,
      savedAt: new Date().toISOString()
    };

    // Save to Firebase
    if (typeof saveTxnToFirebase === 'function' && typeof updateTxnInFirebase === 'function') {
      if (editId) {
        await updateTxnInFirebase(editId, entry);
      } else {
        await saveTxnToFirebase(entry);
      }
    } else {
      // Fallback to localStorage
      let data = getTxns();
      if (editId) {
        const idx = data.findIndex(function(t) { return t.id === editId; });
        if (idx !== -1) {
          entry.savedAt = data[idx].savedAt || new Date().toISOString();
          data[idx] = entry;
        }
      } else {
        data.push(entry);
      }
      saveTxns(data);
    }

    closeModal(isI ? 'incomeModal' : 'expenseModal');
    this.resetForm(type);
    this.buildCategoryFilter();

    // Firebase listener will auto-refresh
    if (!firebaseReady) this.apply();

    setTimeout(() => this.animateStats(), 400);

    const action = editId ? 'Updated' : 'Added';
    toast(action + ' ' + type + ' of ' + inr(amount) + ' ☁️', 'success');
  },

  resetForm: function(type) {
    const isI = type === 'income';
    const setVal = function(elId, val) {
      const el = document.getElementById(elId);
      if (el) el.value = val;
    };
    setVal(isI ? 'iDate' : 'eDate', today());
    setVal(isI ? 'iCat' : 'eCat', '');
    setVal(isI ? 'iAmt' : 'eAmt', '');
    setVal(isI ? 'iMode' : 'eMode', 'Cash');
    setVal(isI ? 'iNote' : 'eNote', '');
    setVal(isI ? 'iEditId' : 'eEditId', '');
    if (isI) {
      setVal('iFrom', '');
      const p = document.getElementById('iPreview');
      if (p) p.style.display = 'none';
    } else {
      setVal('eVendor', '');
      const p = document.getElementById('ePreview');
      if (p) p.style.display = 'none';
    }
    const titleId = isI ? 'incomeTitle' : 'expenseTitle';
    const title = document.getElementById(titleId);
    if (title) title.textContent = isI ? '💰 Add Income' : '💸 Add Expense';
  },

  setupResize: function() {
    const self = this;
    let timer;
    window.addEventListener('resize', function() {
      clearTimeout(timer);
      timer = setTimeout(function() { self.render(); }, 200);
    });
  },

  setupKeyboard: function() {
    const self = this;
    document.addEventListener('keydown', function(e) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].indexOf(e.target.tagName) > -1) return;
      if (e.key === 'Delete' && self.state.selected.size > 0) {
        e.preventDefault();
        self.bulkDel();
      }
    });
  }
};

// ============================================
// GLOBAL FUNCTIONS
// ============================================
function applyFilters() { TxnPage.apply(); }
function setFilter(f, btn) { TxnPage.setFilter(f, btn); }
function clearFilters() { TxnPage.clear(); }
function toggleSelectAll() { TxnPage.selectAll(); }
function bulkDelete() { TxnPage.bulkDel(); }
function saveTxn(type) { TxnPage.save(type); }

function setView(v) {
  TxnPage.state.view = v;
  const tb = document.getElementById('vtTable');
  const cb = document.getElementById('vtCard');
  if (tb) tb.classList.toggle('active', v === 'table');
  if (cb) cb.classList.toggle('active', v === 'card');
  TxnPage.render();
}

function openIncomeModal() {
  TxnPage.resetForm('income');
  const d = document.getElementById('iDate');
  if (d) d.value = today();
  openModal('incomeModal');
}

function openExpenseModal() {
  TxnPage.resetForm('expense');
  const d = document.getElementById('eDate');
  if (d) d.value = today();
  openModal('expenseModal');
}

// ============================================
// INIT
// ============================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    TxnPage.init();
  });
} else {
  TxnPage.init();
}