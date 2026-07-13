/* ============================================
   TRANSACTION-PAGE.JS — Advanced Features
   ============================================ */

const TxnPage = {
  data: [],
  page: 1,
  perPage: 12,
  filter: 'all',
  selected: new Set(),
  view: 'table',

  init(){
    const iD = document.getElementById('iDate');
    const eD = document.getElementById('eDate');
    if(iD) iD.value = today();
    if(eD) eD.value = today();
    this.buildCategoryFilter();
    this.apply();
  },

  buildCategoryFilter(){
    const sel = document.getElementById('catFilter');
    if(!sel) return;
    sel.innerHTML = '<option value="">📂 All Categories</option>';
    const cats = [...new Set(getTxns().map(t => t.category))].sort();
    cats.forEach(c => {
      const o = document.createElement('option');
      o.value = c;
      o.textContent = c;
      sel.appendChild(o);
    });
  },

  setFilter(f, btn){
    this.filter = f;
    document.querySelectorAll('.ft').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    const cr = document.getElementById('customRange');
    if(cr){
      if(f === 'custom') cr.classList.add('show');
      else cr.classList.remove('show');
    }
    this.apply();
  },

  clear(){
    this.filter = 'all';
    document.querySelectorAll('.ft').forEach(b => b.classList.remove('active'));
    document.querySelector('.ft[data-f="all"]').classList.add('active');
    ['typeFilter','catFilter','modeFilter','sortFilter','txnSearch','mainSearch','fStart','fEnd']
      .forEach(id => { const el = document.getElementById(id); if(el) el.value = id === 'sortFilter' ? 'date-desc' : ''; });
    document.getElementById('typeFilter').value = 'all';
    document.getElementById('customRange').classList.remove('show');
    this.apply();
  },

  apply(){
    let data = getTxns();
    const fStart = document.getElementById('fStart')?.value;
    const fEnd = document.getElementById('fEnd')?.value;
    data = filterByPeriod(data, this.filter, fStart, fEnd);

    const type = document.getElementById('typeFilter')?.value || 'all';
    if(type !== 'all') data = data.filter(t => t.type === type);

    const cat = document.getElementById('catFilter')?.value || '';
    if(cat) data = data.filter(t => t.category === cat);

    const mode = document.getElementById('modeFilter')?.value || '';
    if(mode) data = data.filter(t => (t.mode || 'Cash') === mode);

    const q1 = (document.getElementById('txnSearch')?.value || '').trim().toLowerCase();
    const q2 = (document.getElementById('mainSearch')?.value || '').trim().toLowerCase();
    const q = q1 || q2;
    if(q){
      data = data.filter(t =>
        t.category.toLowerCase().includes(q) ||
        String(t.amount).includes(q) ||
        (t.notes || '').toLowerCase().includes(q) ||
        (t.from || '').toLowerCase().includes(q) ||
        (t.vendor || '').toLowerCase().includes(q) ||
        fmtDate(t.date).toLowerCase().includes(q)
      );
    }

    const sort = document.getElementById('sortFilter')?.value || 'date-desc';
    const [key, order] = sort.split('-');
    data.sort((a, b) => {
      let va = key === 'date' ? new Date(a.date) : parseFloat(a.amount);
      let vb = key === 'date' ? new Date(b.date) : parseFloat(b.amount);
      return order === 'desc' ? vb - va : va - vb;
    });

    this.data = data;
    this.page = 1;
    this.selected.clear();
    this.updateStats();
    this.render();
  },

  updateStats(){
    const t = calcTotals(this.data);
    const iC = this.data.filter(x => x.type === 'income').length;
    const eC = this.data.filter(x => x.type === 'expense').length;
    const margin = t.income > 0 ? Math.round((t.profit / t.income) * 100) : 0;

    this.setEl('tsIncome', inr(t.income));
    this.setEl('tsExpense', inr(t.expense));
    this.setEl('tsProfit', inr(t.profit));
    this.setEl('tsCount', this.data.length);
    this.setEl('tsIncomeCount', iC + ' records');
    this.setEl('tsExpenseCount', eC + ' records');
    this.setEl('tsMargin', margin + '% margin');
    this.setEl('recTag', this.data.length + ' records');
    this.setEl('tableInfo', 'Showing ' + this.data.length + ' record' + (this.data.length !== 1 ? 's' : ''));
  },

  render(){
    if(this.view === 'card') this.renderCards();
    else this.renderTable();
    this.renderPagination();
    this.updateBulk();
  },

  renderTable(){
    document.getElementById('tableView').style.display = '';
    document.getElementById('cardView').style.display = 'none';
    const tbody = document.getElementById('txnBody');
    if(!tbody) return;
    const start = (this.page - 1) * this.perPage;
    const pageData = this.data.slice(start, start + this.perPage);

    if(!pageData.length){
      tbody.innerHTML = `<tr><td colspan="9"><div class="empty"><div class="empty-icon">📭</div><h4>No transactions found</h4><p>Try changing filters or add new transactions</p></div></td></tr>`;
      return;
    }

    const rows = pageData.map(t => {
      const sel = this.selected.has(t.id);
      const truncNote = t.notes ? (t.notes.length > 20 ? t.notes.slice(0, 20) + '...' : t.notes) : '-';
      return `<tr style="${sel ? 'background:var(--brand-soft);' : ''}">
        <td><input type="checkbox" style="accent-color:var(--brand);" ${sel ? 'checked' : ''} onchange="TxnPage.select('${t.id}', this)"/></td>
        <td style="font-size:0.8rem;white-space:nowrap;">${fmtDate(t.date)}</td>
        <td><span class="badge ${t.type === 'income' ? 'badge-in' : 'badge-out'}">${t.type === 'income' ? '💰' : '💸'} ${t.type === 'income' ? 'Income' : 'Expense'}</span></td>
        <td style="font-size:0.82rem;font-weight:500;">${t.category}</td>
        <td class="${t.type === 'income' ? 'amt-in' : 'amt-out'}" style="font-family:var(--font-display);">${t.type === 'income' ? '+' : '-'} ${inr(t.amount)}</td>
        <td style="font-size:0.78rem;color:var(--text-muted);">${t.mode || 'Cash'}</td>
        <td style="font-size:0.78rem;color:var(--text-muted);">${t.from || t.vendor || '-'}</td>
        <td style="font-size:0.78rem;color:var(--text-muted);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${t.notes || ''}">${truncNote}</td>
        <td><div style="display:flex;gap:4px;">
          <button class="act act-v" onclick="TxnPage.view('${t.id}')" title="View">👁️</button>
          <button class="act act-e" onclick="TxnPage.edit('${t.id}')" title="Edit">✏️</button>
          <button class="act act-d" onclick="TxnPage.del('${t.id}')" title="Delete">🗑️</button>
        </div></td>
      </tr>`;
    });
    tbody.innerHTML = rows.join('');
  },

  renderCards(){
    document.getElementById('tableView').style.display = 'none';
    const box = document.getElementById('cardView');
    box.style.display = 'grid';
    const start = (this.page - 1) * this.perPage;
    const pageData = this.data.slice(start, start + this.perPage);

    if(!pageData.length){
      box.innerHTML = `<div style="grid-column:1/-1;"><div class="empty"><div class="empty-icon">📭</div><h4>No transactions</h4></div></div>`;
      return;
    }

    box.innerHTML = pageData.map(t => {
      const isI = t.type === 'income';
      return `<div class="tx-card" onclick="TxnPage.view('${t.id}')">
        <div class="tx-card-top">
          <div>
            <div class="tx-card-cat">${t.category}</div>
            <div class="tx-card-date">${fmtDate(t.date)}</div>
          </div>
          <span class="badge ${isI ? 'badge-in' : 'badge-out'}">${isI ? '💰' : '💸'}</span>
        </div>
        <div class="tx-card-amt ${isI ? 'amt-in' : 'amt-out'}">${isI ? '+' : '-'} ${inr(t.amount)}</div>
        <div class="tx-card-foot">
          <span class="tx-card-mode">${t.mode || 'Cash'}</span>
          <span>${t.from || t.vendor || '—'}</span>
        </div>
      </div>`;
    }).join('');
  },

  renderPagination(){
    const container = document.getElementById('pagination');
    if(!container) return;
    const total = Math.ceil(this.data.length / this.perPage);
    if(total <= 1){ container.innerHTML = ''; return; }
    let html = '';
    html += `<button class="pg" ${this.page === 1 ? 'disabled' : ''} onclick="TxnPage.goPage(${this.page - 1})">← Prev</button>`;
    for(let i = 1; i <= total; i++){
      if(i === 1 || i === total || (i >= this.page - 1 && i <= this.page + 1)){
        html += `<button class="pg ${i === this.page ? 'active' : ''}" onclick="TxnPage.goPage(${i})">${i}</button>`;
      } else if(i === this.page - 2 || i === this.page + 2){
        html += `<span style="padding:0 4px;color:var(--text-muted);">...</span>`;
      }
    }
    html += `<button class="pg" ${this.page === total ? 'disabled' : ''} onclick="TxnPage.goPage(${this.page + 1})">Next →</button>`;
    container.innerHTML = html;
  },

  goPage(p){
    this.page = p;
    this.render();
    window.scrollTo({ top: 300, behavior: 'smooth' });
  },

  select(id, cb){
    if(cb.checked) this.selected.add(id);
    else this.selected.delete(id);
    this.updateBulk();
    this.render();
  },

  selectAll(){
    const cb = document.getElementById('selAll');
    if(cb.checked) this.data.forEach(t => this.selected.add(t.id));
    else this.selected.clear();
    this.render();
  },

  updateBulk(){
    const bar = document.getElementById('bulkBar');
    const txt = document.getElementById('bulkTxt');
    if(bar){
      if(this.selected.size > 0) bar.classList.add('show');
      else bar.classList.remove('show');
    }
    if(txt) txt.textContent = this.selected.size + ' selected';
  },

  async bulkDel(){
    if(!this.selected.size) return;
    const num = this.selected.size;
    const ok = await confirmDel(`Delete <strong>${num}</strong> selected transaction(s)? This cannot be undone.`);
    if(!ok) return;
    let txns = getTxns();
    txns = txns.filter(t => !this.selected.has(t.id));
    saveTxns(txns);
    this.selected.clear();
    this.buildCategoryFilter();
    this.apply();
    toast('Deleted ' + num + ' transactions');
  },

  view(id){
    const t = getTxns().find(x => x.id === id);
    if(!t) return;
    const isI = t.type === 'income';
    const hd = document.getElementById('detailHd');
    hd.style.background = isI ? 'var(--income-soft)' : 'var(--expense-soft)';
    hd.querySelector('h3').textContent = isI ? '💰 Income Details' : '💸 Expense Details';

    document.getElementById('detailGrid').innerHTML = `
      <div class="detail-item"><div class="detail-lbl">Date</div><div class="detail-val">${fmtDate(t.date)}</div></div>
      <div class="detail-item"><div class="detail-lbl">Type</div><div class="detail-val ${isI ? 'text-income' : 'text-expense'}">${isI ? '💰 Income' : '💸 Expense'}</div></div>
      <div class="detail-item"><div class="detail-lbl">Category</div><div class="detail-val">${t.category}</div></div>
      <div class="detail-item"><div class="detail-lbl">Amount</div><div class="detail-val ${isI ? 'text-income' : 'text-expense'}">${inr(t.amount)}</div></div>
      <div class="detail-item"><div class="detail-lbl">Mode</div><div class="detail-val">${t.mode || 'Cash'}</div></div>
      <div class="detail-item"><div class="detail-lbl">${isI ? 'Customer' : 'Vendor'}</div><div class="detail-val">${t.from || t.vendor || '—'}</div></div>
      ${t.notes ? `<div class="detail-item full"><div class="detail-lbl">Notes</div><div class="detail-val" style="font-family:var(--font);font-weight:500;">${t.notes}</div></div>` : ''}
      <div class="detail-item full"><div class="detail-lbl">Created</div><div class="detail-val" style="font-family:var(--font);font-weight:500;font-size:0.8rem;">${new Date(t.savedAt || Date.now()).toLocaleString('en-IN')}</div></div>
    `;

    document.getElementById('detailEditBtn').onclick = () => {
      closeModal('detailModal');
      this.edit(id);
    };
    openModal('detailModal');
  },

  edit(id){
    const t = getTxns().find(x => x.id === id);
    if(!t) return;
    const isI = t.type === 'income';
    document.getElementById(isI ? 'iDate' : 'eDate').value = t.date;
    document.getElementById(isI ? 'iCat' : 'eCat').value = t.category;
    document.getElementById(isI ? 'iAmt' : 'eAmt').value = t.amount;
    document.getElementById(isI ? 'iMode' : 'eMode').value = t.mode || 'Cash';
    document.getElementById(isI ? 'iNote' : 'eNote').value = t.notes || '';
    document.getElementById(isI ? 'iEditId' : 'eEditId').value = t.id;
    if(isI) document.getElementById('iFrom').value = t.from || '';
    else document.getElementById('eVendor').value = t.vendor || '';
    openModal(isI ? 'incomeModal' : 'expenseModal');
  },

  async del(id){
    const ok = await confirmDel('Delete this transaction? This cannot be undone.');
    if(!ok) return;
    let txns = getTxns();
    txns = txns.filter(t => t.id !== id);
    saveTxns(txns);
    this.apply();
    toast('Transaction deleted');
  },

  save(type){
    const isI = type === 'income';
    const date = document.getElementById(isI ? 'iDate' : 'eDate').value;
    const cat = document.getElementById(isI ? 'iCat' : 'eCat').value;
    const amt = document.getElementById(isI ? 'iAmt' : 'eAmt').value;
    const mode = document.getElementById(isI ? 'iMode' : 'eMode').value;
    const notes = document.getElementById(isI ? 'iNote' : 'eNote').value;
    const editId = document.getElementById(isI ? 'iEditId' : 'eEditId').value;
    const from = isI ? document.getElementById('iFrom').value : '';
    const vendor = !isI ? document.getElementById('eVendor').value : '';

    if(!date){ toast('Please select date', 'error'); return; }
    if(!cat){ toast('Please select category', 'error'); return; }
    if(!amt || parseFloat(amt) <= 0){ toast('Enter valid amount', 'error'); return; }

    const txns = getTxns();
    const entry = {
      id: editId || uid(),
      type, date, category: cat,
      amount: parseFloat(amt),
      mode, from, vendor, notes,
      savedAt: new Date().toISOString()
    };

    if(editId){
      const idx = txns.findIndex(t => t.id === editId);
      if(idx !== -1) txns[idx] = entry;
      toast('Updated!');
    } else {
      txns.push(entry);
      toast((isI ? 'Income' : 'Expense') + ' added!');
    }

    saveTxns(txns);
    closeModal(isI ? 'incomeModal' : 'expenseModal');
    this.resetForm(type);
    this.buildCategoryFilter();
    this.apply();
  },

  resetForm(type){
    const isI = type === 'income';
    document.getElementById(isI ? 'iDate' : 'eDate').value = today();
    document.getElementById(isI ? 'iCat' : 'eCat').value = '';
    document.getElementById(isI ? 'iAmt' : 'eAmt').value = '';
    document.getElementById(isI ? 'iMode' : 'eMode').value = 'Cash';
    document.getElementById(isI ? 'iNote' : 'eNote').value = '';
    document.getElementById(isI ? 'iEditId' : 'eEditId').value = '';
    if(isI){
      document.getElementById('iFrom').value = '';
      document.getElementById('iPreview').style.display = 'none';
    } else {
      document.getElementById('eVendor').value = '';
      document.getElementById('ePreview').style.display = 'none';
    }
  },

  setEl(id, val){
    const el = document.getElementById(id);
    if(el) el.textContent = val;
  }
};

// Global handlers
function applyFilters(){ TxnPage.apply(); }
function setFilter(f, btn){ TxnPage.setFilter(f, btn); }
function clearFilters(){ TxnPage.clear(); }
function toggleSelectAll(){ TxnPage.selectAll(); }
function bulkDelete(){ TxnPage.bulkDel(); }
function editTxn(id){ TxnPage.edit(id); }
function deleteTxn(id){ TxnPage.del(id); }
function saveTxn(type){ TxnPage.save(type); }

function setView(v){
  TxnPage.view = v;
  document.getElementById('vtTable').classList.toggle('active', v === 'table');
  document.getElementById('vtCard').classList.toggle('active', v === 'card');
  TxnPage.render();
}

document.addEventListener('DOMContentLoaded', () => TxnPage.init());