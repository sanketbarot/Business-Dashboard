/* ============================================
   TRANSACTION PAGE JS — WORKING VERSION
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

  // ============ INIT ============
  init() {
    console.log('TxnPage init started');

    try {
      // Set default dates
      const iDate = document.getElementById('iDate');
      const eDate = document.getElementById('eDate');
      if (iDate) iDate.value = this.today();
      if (eDate) eDate.value = this.today();

      this.buildCategoryFilter();
      this.apply();
      this.setupResizeHandler();
      this.setupKeyboard();

      console.log('TxnPage ready');
    } catch (err) {
      console.error('Init error:', err);
    }
  },

  // ============ HELPERS ============
  today() {
    return new Date().toISOString().split('T')[0];
  },

  fmtDate(d) {
    if (!d) return '-';
    try {
      return new Date(d).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
      });
    } catch {
      return d;
    }
  },

  inr(amount) {
    const n = parseFloat(amount) || 0;
    return '₹ ' + n.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  },

  inrShort(amount) {
    const n = parseFloat(amount) || 0;
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (abs >= 10000000) return sign + '₹' + (abs / 10000000).toFixed(1) + 'Cr';
    if (abs >= 100000) return sign + '₹' + (abs / 100000).toFixed(1) + 'L';
    if (abs >= 1000) return sign + '₹' + (abs / 1000).toFixed(1) + 'K';
    return sign + '₹' + abs.toFixed(0);
  },

  escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  uid() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
  },

  debounce(fn, wait) {
    let timer;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  },

  // ============ DATE CHECKS ============
  isToday(d) {
    return d === this.today();
  },

  isYesterday(d) {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    return d === y.toISOString().split('T')[0];
  },

  isThisWeek(d) {
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
  },

  isLastWeek(d) {
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
  },

  isThisMonth(d) {
    if (!d) return false;
    const date = new Date(d);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  },

  isLastMonth(d) {
    if (!d) return false;
    const date = new Date(d);
    const now = new Date();
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return date.getMonth() === lm.getMonth() && date.getFullYear() === lm.getFullYear();
  },

  isThisYear(d) {
    if (!d) return false;
    return new Date(d).getFullYear() === new Date().getFullYear();
  },

  inRange(d, start, end) {
    if (!d || !start || !end) return false;
    const date = new Date(d);
    const s = new Date(start);
    const e = new Date(end);
    e.setHours(23, 59, 59, 999);
    return date >= s && date <= e;
  },

  // ============ STORAGE ============
  getTxns() {
    if (typeof getTxns === 'function') return getTxns();
    try {
      return JSON.parse(localStorage.getItem('bd_transactions') || '[]');
    } catch {
      return [];
    }
  },

  saveTxns(data) {
    if (typeof saveTxns === 'function') return saveTxns(data);
    try {
      localStorage.setItem('bd_transactions', JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  },

  // ============ CATEGORY FILTER ============
  buildCategoryFilter() {
    const sel = document.getElementById('catFilter');
    if (!sel) return;

    const current = sel.value;
    sel.innerHTML = '<option value="">📂 All Categories</option>';

    const all = this.getTxns();
    const cats = [...new Set(all.map(t => t.category).filter(Boolean))].sort();

    cats.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      sel.appendChild(opt);
    });

    if (current && cats.includes(current)) {
      sel.value = current;
    }
  },

  // ============ FILTERS ============
  setFilter(f, btn) {
    this.state.filter = f;

    document.querySelectorAll('.ft').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    const cr = document.getElementById('customRange');
    if (cr) {
      if (f === 'custom') cr.classList.add('show');
      else cr.classList.remove('show');
    }

    this.apply();
  },

  clear() {
    this.state.filter = 'all';
    this.state.page = 1;
    this.state.selected.clear();

    document.querySelectorAll('.ft').forEach(b => b.classList.remove('active'));
    const allTab = document.querySelector('.ft[data-f="all"]');
    if (allTab) allTab.classList.add('active');

    const ids = ['typeFilter', 'catFilter', 'modeFilter', 'sortFilter', 'txnSearch', 'mainSearch', 'fStart', 'fEnd'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        if (id === 'typeFilter') el.value = 'all';
        else if (id === 'sortFilter') el.value = 'date-desc';
        else el.value = '';
      }
    });

    const cr = document.getElementById('customRange');
    if (cr) cr.classList.remove('show');

    this.apply();

    if (typeof toast === 'function') toast('Filters cleared', 'info');
  },

  filterByPeriod(data, period, start, end) {
    if (period === 'all' || !period) return data;

    return data.filter(t => {
      if (!t.date) return false;
      switch (period) {
        case 'today': return this.isToday(t.date);
        case 'yesterday': return this.isYesterday(t.date);
        case 'week': return this.isThisWeek(t.date);
        case 'lastweek': return this.isLastWeek(t.date);
        case 'month': return this.isThisMonth(t.date);
        case 'lastmonth': return this.isLastMonth(t.date);
        case 'year': return this.isThisYear(t.date);
        case 'custom': return start && end ? this.inRange(t.date, start, end) : true;
        default: return true;
      }
    });
  },

  apply() {
    try {
      let data = this.getTxns();

      // Period filter
      const fStart = document.getElementById('fStart')?.value;
      const fEnd = document.getElementById('fEnd')?.value;
      data = this.filterByPeriod(data, this.state.filter, fStart, fEnd);

      // Type filter
      const type = document.getElementById('typeFilter')?.value || 'all';
      if (type !== 'all') {
        data = data.filter(t => t.type === type);
      }

      // Category filter
      const cat = document.getElementById('catFilter')?.value || '';
      if (cat) {
        data = data.filter(t => t.category === cat);
      }

      // Mode filter
      const mode = document.getElementById('modeFilter')?.value || '';
      if (mode) {
        data = data.filter(t => (t.mode || 'Cash') === mode);
      }

      // Search
      const q1 = (document.getElementById('txnSearch')?.value || '').trim().toLowerCase();
      const q2 = (document.getElementById('mainSearch')?.value || '').trim().toLowerCase();
      const query = q1 || q2;

      if (query) {
        this.state.lastQuery = query;
        data = data.filter(t => {
          return (
            (t.category || '').toLowerCase().includes(query) ||
            String(t.amount || '').includes(query) ||
            (t.notes || '').toLowerCase().includes(query) ||
            (t.from || '').toLowerCase().includes(query) ||
            (t.vendor || '').toLowerCase().includes(query) ||
            (t.mode || '').toLowerCase().includes(query) ||
            this.fmtDate(t.date).toLowerCase().includes(query)
          );
        });
      } else {
        this.state.lastQuery = '';
      }

      // Sort
      const sort = document.getElementById('sortFilter')?.value || 'date-desc';
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

  sortData(data, sort) {
    const [key, order] = sort.split('-');
    const dir = order === 'desc' ? -1 : 1;

    return [...data].sort((a, b) => {
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

  // ============ STATS ============
  updateStats(data) {
    let income = 0, expense = 0, iC = 0, eC = 0;

    data.forEach(t => {
      const amt = parseFloat(t.amount) || 0;
      if (t.type === 'income') {
        income += amt;
        iC++;
      } else if (t.type === 'expense') {
        expense += amt;
        eC++;
      }
    });

    const profit = income - expense;
    const margin = income > 0 ? Math.round((profit / income) * 100) : 0;

    this.setText('tsIncome', this.inr(income));
    this.setText('tsExpense', this.inr(expense));
    this.setText('tsProfit', this.inr(profit));
    this.setText('tsCount', data.length);
    this.setText('tsIncomeCount', iC + ' records');
    this.setText('tsExpenseCount', eC + ' records');
    this.setText('tsMargin', margin + '% margin');
    this.setText('recTag', data.length + ' records');

    const pEl = document.getElementById('tsProfit');
    if (pEl) {
      pEl.className = 'tx-stat-val ' + (profit >= 0 ? 'text-profit' : 'text-expense');
    }

    const start = (this.state.page - 1) * this.state.perPage + 1;
    const end = Math.min(start + this.state.perPage - 1, data.length);

    if (data.length === 0) {
      this.setText('tableInfo', 'No records to show');
    } else {
      this.setText('tableInfo', `Showing ${start}–${end} of ${data.length} records`);
    }
  },

  setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  },

  // ============ RENDER ============
  render() {
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

  renderTable() {
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

    const q = this.state.lastQuery;

    tbody.innerHTML = pageData.map(t => {
      const isI = t.type === 'income';
      const sel = this.state.selected.has(t.id);
      const bg = sel ? 'background:var(--brand-soft);' : '';
      const notes = t.notes || '';
      const truncNote = notes.length > 20 ? notes.slice(0, 20) + '...' : (notes || '-');
      const customer = t.from || t.vendor || '-';

      return `<tr style="${bg}">
        <td>
          <input type="checkbox" ${sel ? 'checked' : ''}
            style="accent-color:var(--brand);cursor:pointer;width:16px;height:16px;"
            onchange="TxnPage.select('${t.id}', this)"/>
        </td>
        <td style="font-size:0.8rem;white-space:nowrap;">
          ${this.highlight(this.fmtDate(t.date), q)}
        </td>
        <td>
          <span class="badge ${isI ? 'badge-in' : 'badge-out'}">
            ${isI ? '💰' : '💸'} ${isI ? 'Income' : 'Expense'}
          </span>
        </td>
        <td style="font-size:0.82rem;font-weight:500;">
          ${this.highlight(this.escapeHtml(t.category || '-'), q)}
        </td>
        <td class="${isI ? 'amt-in' : 'amt-out'}" style="font-family:'Space Grotesk',sans-serif;">
          ${isI ? '+' : '-'} ${this.inr(t.amount)}
        </td>
        <td style="font-size:0.78rem;color:var(--text-muted);">
          ${this.icons.payment[t.mode] || '💰'} ${this.escapeHtml(t.mode || 'Cash')}
        </td>
        <td style="font-size:0.78rem;color:var(--text-muted);">
          ${this.highlight(this.escapeHtml(customer), q)}
        </td>
        <td style="font-size:0.78rem;color:var(--text-muted);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${this.escapeHtml(notes)}">
          ${this.escapeHtml(truncNote)}
        </td>
        <td>
          <div style="display:flex;gap:4px;">
            <button class="act act-v" onclick="TxnPage.view('${t.id}')" title="View">👁️</button>
            <button class="act act-e" onclick="TxnPage.edit('${t.id}')" title="Edit">✏️</button>
            <button class="act act-d" onclick="TxnPage.del('${t.id}')" title="Delete">🗑️</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  },

  renderMobileRows() {
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

    tbody.innerHTML = pageData.map(t => {
      const isI = t.type === 'income';
      const sel = this.state.selected.has(t.id);
      const bg = sel ? 'background:var(--brand-soft);' : '';

      return `<tr><td colspan="9" style="padding:0;">
        <div class="mobile-txn-row" style="${bg}">
          <div class="mobile-txn-check">
            <input type="checkbox" ${sel ? 'checked' : ''}
              onchange="TxnPage.select('${t.id}', this)"/>
          </div>
          <div class="mobile-txn-body" onclick="TxnPage.view('${t.id}')">
            <div class="mobile-txn-line1">
              <div class="mobile-txn-cat">${this.escapeHtml(t.category || '-')}</div>
              <div class="mobile-txn-amt ${isI ? 'amt-in' : 'amt-out'}">
                ${isI ? '+' : '-'} ${this.inrShort(t.amount)}
              </div>
            </div>
            <div class="mobile-txn-line2">
              <div class="mobile-txn-meta">
                <span>${this.fmtDate(t.date)}</span>
                <span class="mobile-txn-badge ${isI ? 'badge-in' : 'badge-out'}">
                  ${isI ? '💰' : '💸'}
                </span>
                <span>${this.icons.payment[t.mode] || '💰'} ${this.escapeHtml(t.mode || 'Cash')}</span>
              </div>
            </div>
          </div>
          <div class="mobile-txn-actions">
            <button class="act act-e" onclick="TxnPage.edit('${t.id}')" title="Edit">✏️</button>
            <button class="act act-d" onclick="TxnPage.del('${t.id}')" title="Delete">🗑️</button>
          </div>
        </div>
      </td></tr>`;
    }).join('');
  },

  renderCards() {
    const tableView = document.getElementById('tableView');
    const cardView = document.getElementById('cardView');
    if (tableView) tableView.style.display = 'none';
    if (!cardView) return;
    cardView.style.display = 'grid';

    const start = (this.state.page - 1) * this.state.perPage;
    const pageData = this.state.filtered.slice(start, start + this.state.perPage);

    if (!pageData.length) {
      cardView.innerHTML = `<div style="grid-column:1/-1;">${this.getEmptyContent()}</div>`;
      return;
    }

    cardView.innerHTML = pageData.map(t => {
      const isI = t.type === 'income';
      const sel = this.state.selected.has(t.id);
      const style = sel ? 'background:var(--brand-soft);border-color:var(--brand);' : '';

      return `<div class="tx-card" style="${style}">
        <div class="tx-card-top">
          <div style="flex:1;min-width:0;cursor:pointer;" onclick="TxnPage.view('${t.id}')">
            <div class="tx-card-cat">${this.escapeHtml(t.category || '-')}</div>
            <div class="tx-card-date">${this.fmtDate(t.date)}</div>
          </div>
          <span class="badge ${isI ? 'badge-in' : 'badge-out'}">
            ${isI ? '💰' : '💸'}
          </span>
        </div>
        <div class="tx-card-amt ${isI ? 'amt-in' : 'amt-out'}" onclick="TxnPage.view('${t.id}')" style="cursor:pointer;">
          ${isI ? '+' : '-'} ${this.inr(t.amount)}
        </div>
        <div class="tx-card-foot">
          <span class="tx-card-mode">
            ${this.icons.payment[t.mode] || '💰'} ${this.escapeHtml(t.mode || 'Cash')}
          </span>
          <span style="display:flex;gap:4px;align-items:center;">
            <button class="act act-e" onclick="event.stopPropagation();TxnPage.edit('${t.id}')">✏️</button>
            <button class="act act-d" onclick="event.stopPropagation();TxnPage.del('${t.id}')">🗑️</button>
          </span>
        </div>
      </div>`;
    }).join('');
  },

  getEmptyRow(colspan) {
    return `<tr><td colspan="${colspan}">${this.getEmptyContent()}</td></tr>`;
  },

  getEmptyContent() {
    const hasFilters = this.hasFilters();
    return `<div class="empty">
      <div class="empty-icon">${hasFilters ? '🔍' : '💳'}</div>
      <h4>${hasFilters ? 'No results found' : 'No transactions yet'}</h4>
      <p>${hasFilters ? 'Try changing filters' : 'Add your first income or expense'}</p>
      ${hasFilters ? '<button class="btn btn-outline btn-sm" style="margin-top:12px;" onclick="TxnPage.clear()">✕ Clear Filters</button>' : ''}
    </div>`;
  },

  hasFilters() {
    return (
      this.state.filter !== 'all' ||
      (document.getElementById('typeFilter')?.value || 'all') !== 'all' ||
      document.getElementById('catFilter')?.value ||
      document.getElementById('modeFilter')?.value ||
      (document.getElementById('txnSearch')?.value || '').trim() ||
      (document.getElementById('mainSearch')?.value || '').trim()
    );
  },

  highlight(text, query) {
    if (!query || !text) return text;
    const str = String(text);
    const idx = str.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return str;
    const before = this.escapeHtml(str.slice(0, idx));
    const match = this.escapeHtml(str.slice(idx, idx + query.length));
    const after = this.escapeHtml(str.slice(idx + query.length));
    return `${before}<mark>${match}</mark>${after}`;
  },

  // ============ PAGINATION ============
  renderPagination() {
    const container = document.getElementById('pagination');
    if (!container) return;

    const total = Math.ceil(this.state.filtered.length / this.state.perPage);
    if (total <= 1) {
      container.innerHTML = '';
      return;
    }

    const current = this.state.page;
    let html = '';

    html += `<button class="pg" ${current === 1 ? 'disabled' : ''} onclick="TxnPage.goPage(${current - 1})">← Prev</button>`;

    for (let i = 1; i <= total; i++) {
      if (i === 1 || i === total || (i >= current - 1 && i <= current + 1)) {
        html += `<button class="pg ${i === current ? 'active' : ''}" onclick="TxnPage.goPage(${i})">${i}</button>`;
      } else if (i === current - 2 || i === current + 2) {
        html += `<span style="padding:0 4px;color:var(--text-muted);">...</span>`;
      }
    }

    html += `<button class="pg" ${current === total ? 'disabled' : ''} onclick="TxnPage.goPage(${current + 1})">Next →</button>`;

    container.innerHTML = html;
  },

  goPage(p) {
    const total = Math.ceil(this.state.filtered.length / this.state.perPage);
    if (p < 1 || p > total) return;
    this.state.page = p;
    this.render();
    this.updateStats(this.state.filtered);
    window.scrollTo({ top: 300, behavior: 'smooth' });
  },

  // ============ SELECTION ============
  select(id, cb) {
    if (cb.checked) {
      this.state.selected.add(id);
    } else {
      this.state.selected.delete(id);
    }
    this.updateBulk();

    const selAll = document.getElementById('selAll');
    if (selAll) {
      selAll.checked = this.state.selected.size === this.state.filtered.length && this.state.filtered.length > 0;
    }
  },

  selectAll() {
    const cb = document.getElementById('selAll');
    if (!cb) return;

    if (cb.checked) {
      this.state.filtered.forEach(t => this.state.selected.add(t.id));
    } else {
      this.state.selected.clear();
    }
    this.render();
  },

  updateBulk() {
    const bar = document.getElementById('bulkBar');
    const txt = document.getElementById('bulkTxt');
    const count = this.state.selected.size;

    if (bar) {
      if (count > 0) bar.classList.add('show');
      else bar.classList.remove('show');
    }

    if (txt) txt.textContent = count + ' selected';
  },

  // ============ BULK DELETE ============
  async bulkDel() {
    if (!this.state.selected.size) return;

    const num = this.state.selected.size;
    const confirmed = confirm(`Delete ${num} selected transaction(s)? This cannot be undone.`);

    if (!confirmed) return;

    let data = this.getTxns();
    data = data.filter(t => !this.state.selected.has(t.id));
    this.saveTxns(data);

    this.state.selected.clear();
    this.buildCategoryFilter();
    this.apply();

    if (typeof toast === 'function') {
      toast(`Deleted ${num} transaction(s)`, 'success');
    }
  },

  // ============ VIEW ============
  view(id) {
    const t = this.getTxns().find(x => x.id === id);
    if (!t) return;

    const isI = t.type === 'income';
    const hd = document.getElementById('detailHd');
    const grid = document.getElementById('detailGrid');
    const editBtn = document.getElementById('detailEditBtn');

    if (!grid) return;

    if (hd) {
      hd.style.background = isI ? 'var(--income-soft)' : 'var(--expense-soft)';
      const h3 = hd.querySelector('h3');
      if (h3) h3.textContent = isI ? '💰 Income Details' : '💸 Expense Details';
    }

    const customer = t.from || t.vendor;
    const customerLbl = isI ? 'Customer' : 'Vendor';
    const dayName = new Date(t.date).toLocaleDateString('en-IN', { weekday: 'long' });

    grid.innerHTML = `
      <div class="detail-item">
        <div class="detail-lbl">Date</div>
        <div class="detail-val">${this.fmtDate(t.date)}</div>
      </div>
      <div class="detail-item">
        <div class="detail-lbl">Day</div>
        <div class="detail-val" style="font-family:'Inter',sans-serif;">${dayName}</div>
      </div>
      <div class="detail-item">
        <div class="detail-lbl">Type</div>
        <div class="detail-val ${isI ? 'text-income' : 'text-expense'}">${isI ? '💰 Income' : '💸 Expense'}</div>
      </div>
      <div class="detail-item">
        <div class="detail-lbl">Category</div>
        <div class="detail-val">${this.escapeHtml(t.category || '-')}</div>
      </div>
      <div class="detail-item full">
        <div class="detail-lbl">Amount</div>
        <div class="detail-val ${isI ? 'text-income' : 'text-expense'}" style="font-size:1.5rem;">
          ${this.inr(t.amount)}
        </div>
      </div>
      <div class="detail-item">
        <div class="detail-lbl">Payment Mode</div>
        <div class="detail-val">${this.icons.payment[t.mode] || '💰'} ${this.escapeHtml(t.mode || 'Cash')}</div>
      </div>
      <div class="detail-item">
        <div class="detail-lbl">${customerLbl}</div>
        <div class="detail-val">${this.escapeHtml(customer || '—')}</div>
      </div>
      ${t.notes ? `
        <div class="detail-item full">
          <div class="detail-lbl">Notes</div>
          <div class="detail-val" style="font-family:'Inter',sans-serif;font-weight:500;">${this.escapeHtml(t.notes)}</div>
        </div>
      ` : ''}
      ${t.savedAt ? `
        <div class="detail-item full">
          <div class="detail-lbl">Created</div>
          <div class="detail-val" style="font-family:'Inter',sans-serif;font-weight:500;font-size:0.8rem;">
            ${new Date(t.savedAt).toLocaleString('en-IN')}
          </div>
        </div>
      ` : ''}
    `;

    if (editBtn) {
      editBtn.onclick = () => {
        this.closeModal('detailModal');
        setTimeout(() => this.edit(id), 200);
      };
    }

    this.openModal('detailModal');
  },

  // ============ EDIT ============
  edit(id) {
    const t = this.getTxns().find(x => x.id === id);
    if (!t) return;

    const isI = t.type === 'income';

    const setVal = (elId, val) => {
      const el = document.getElementById(elId);
      if (el) el.value = val || '';
    };

    setVal(isI ? 'iDate' : 'eDate', t.date);
    setVal(isI ? 'iCat' : 'eCat', t.category);
    setVal(isI ? 'iAmt' : 'eAmt', t.amount);
    setVal(isI ? 'iMode' : 'eMode', t.mode || 'Cash');
    setVal(isI ? 'iNote' : 'eNote', t.notes);
    setVal(isI ? 'iEditId' : 'eEditId', t.id);

    if (isI) {
      setVal('iFrom', t.from);
    } else {
      setVal('eVendor', t.vendor);
    }

    // Update title
    const titleId = isI ? 'incomeTitle' : 'expenseTitle';
    const title = document.getElementById(titleId);
    if (title) title.textContent = isI ? '✏️ Edit Income' : '✏️ Edit Expense';

    // Show preview
    if (typeof previewAmt === 'function') {
      previewAmt(t.type);
    }

    this.openModal(isI ? 'incomeModal' : 'expenseModal');
  },

  // ============ DELETE ============
  del(id) {
    const t = this.getTxns().find(x => x.id === id);
    if (!t) return;

    const isI = t.type === 'income';
    const label = isI ? 'income' : 'expense';

    const confirmed = confirm(`Delete this ${label} of ${this.inr(t.amount)}?\nCategory: ${t.category}\nDate: ${this.fmtDate(t.date)}\n\nThis cannot be undone.`);

    if (!confirmed) return;

    let data = this.getTxns();
    data = data.filter(x => x.id !== id);
    this.saveTxns(data);

    this.state.selected.delete(id);
    this.buildCategoryFilter();
    this.apply();

    if (typeof toast === 'function') {
      toast(`Deleted ${label} of ${this.inr(t.amount)}`, 'success');
    }
  },

  // ============ SAVE ============
  save(type) {
    const isI = type === 'income';

    const date = document.getElementById(isI ? 'iDate' : 'eDate')?.value?.trim();
    const cat = document.getElementById(isI ? 'iCat' : 'eCat')?.value?.trim();
    const amt = document.getElementById(isI ? 'iAmt' : 'eAmt')?.value?.trim();
    const mode = document.getElementById(isI ? 'iMode' : 'eMode')?.value || 'Cash';
    const notes = (document.getElementById(isI ? 'iNote' : 'eNote')?.value?.trim() || '');
    const editId = document.getElementById(isI ? 'iEditId' : 'eEditId')?.value?.trim();
    const from = isI ? (document.getElementById('iFrom')?.value?.trim() || '') : '';
    const vendor = !isI ? (document.getElementById('eVendor')?.value?.trim() || '') : '';

    if (!date) {
      alert('Please select a date');
      return;
    }

    if (!cat) {
      alert('Please select a category');
      return;
    }

    const amount = parseFloat(amt);
    if (!amount || amount <= 0 || isNaN(amount)) {
      alert('Please enter a valid amount');
      return;
    }

    const entry = {
      id: editId || this.uid(),
      type,
      date,
      category: cat,
      amount,
      mode,
      from,
      vendor,
      notes,
      updatedAt: new Date().toISOString()
    };

    let data = this.getTxns();

    if (editId) {
      const idx = data.findIndex(t => t.id === editId);
      if (idx !== -1) {
        entry.savedAt = data[idx].savedAt || new Date().toISOString();
        data[idx] = entry;
      }
    } else {
      entry.savedAt = new Date().toISOString();
      data.push(entry);
    }

    this.saveTxns(data);
    this.closeModal(isI ? 'incomeModal' : 'expenseModal');
    this.resetForm(type);
    this.buildCategoryFilter();
    this.apply();

    if (typeof toast === 'function') {
      const action = editId ? 'Updated' : 'Added';
      toast(`${action} ${type} of ${this.inr(amount)}`, 'success');
    }
  },

  resetForm(type) {
    const isI = type === 'income';

    const setVal = (elId, val) => {
      const el = document.getElementById(elId);
      if (el) el.value = val;
    };

    setVal(isI ? 'iDate' : 'eDate', this.today());
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

    // Reset title
    const titleId = isI ? 'incomeTitle' : 'expenseTitle';
    const title = document.getElementById(titleId);
    if (title) title.textContent = isI ? '💰 Add Income' : '💸 Add Expense';
  },

  // ============ MODAL ============
  openModal(id) {
    const m = document.getElementById(id);
    if (m) {
      m.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  },

  closeModal(id) {
    const m = document.getElementById(id);
    if (m) {
      m.classList.remove('open');
      document.body.style.overflow = '';
    }
  },

  // ============ HANDLERS ============
  setupResizeHandler() {
    let timer;
    window.addEventListener('resize', () => {
      clearTimeout(timer);
      timer = setTimeout(() => this.render(), 200);
    });
  },

  setupKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      if (e.key === 'Delete' && this.state.selected.size > 0) {
        e.preventDefault();
        this.bulkDel();
      }
    });
  }
};

// ============ GLOBAL FUNCTIONS ============
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
  if (d) d.value = TxnPage.today();
  TxnPage.openModal('incomeModal');
}

function openExpenseModal() {
  TxnPage.resetForm('expense');
  const d = document.getElementById('eDate');
  if (d) d.value = TxnPage.today();
  TxnPage.openModal('expenseModal');
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
    valEl.textContent = TxnPage.inr(amt);
  } else {
    previewEl.style.display = 'none';
  }
}

// Close modal on background click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-bg')) {
    e.target.classList.remove('open');
    document.body.style.overflow = '';
  }
});

// Escape key closes modals
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-bg.open').forEach(m => {
      m.classList.remove('open');
    });
    document.body.style.overflow = '';
  }
});

// ============ INIT ============
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => TxnPage.init());
} else {
  TxnPage.init();
}

// Export globally
window.TxnPage = TxnPage;