/* ============================================
   EXPIRY & STOCK TRACKER CONTROLLER v1.0.0
   Crust & Chilly — Expiry Management & 15-Day Notice
   ============================================ */

'use strict';

const ExpiryPage = {
  activeStatus: 'all',
  activeCategory: 'all',
  activeBrand: 'all',
  activeStorage: 'all',
  searchQuery: '',
  sortBy: 'expiry_asc',
  viewMode: 'table', // 'table' or 'grid'

  init() {
    // Seed sample stock items in demo mode if empty
    if (localStorage.getItem('bd_mode') === 'demo') {
      const items = getExpiryItems();
      if (!items || items.length === 0) {
        this.seedDemoStock();
      }
    }

    this.bindEvents();
    this.render();
  },

  bindEvents() {
    // Search input
    const searchInput = document.getElementById('expSearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.render();
      });
    }

    // Category filter
    const catSelect = document.getElementById('expCategoryFilter');
    if (catSelect) {
      catSelect.addEventListener('change', (e) => {
        this.activeCategory = e.target.value;
        this.render();
      });
    }

    // Storage filter
    const storageSelect = document.getElementById('expStorageFilter');
    if (storageSelect) {
      storageSelect.addEventListener('change', (e) => {
        this.activeStorage = e.target.value;
        this.render();
      });
    }

    // Sort select
    const sortSelect = document.getElementById('expSortSelect');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.sortBy = e.target.value;
        this.render();
      });
    }
  },

  setStatusTab(status) {
    this.activeStatus = status;
    document.querySelectorAll('.exp-tab-btn').forEach(btn => {
      if (btn.dataset.status === status) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    this.render();
  },

  setViewMode(mode) {
    this.viewMode = mode;
    const btnTable = document.getElementById('btnViewTable');
    const btnGrid = document.getElementById('btnViewGrid');
    if (btnTable) btnTable.classList.toggle('active', mode === 'table');
    if (btnGrid) btnGrid.classList.toggle('active', mode === 'grid');
    this.render();
  },

  getProcessedItems() {
    let items = getExpiryItems().slice();

    // Attach expiry metadata to each item
    items = items.map(item => {
      const meta = calculateExpiryMeta(item.expiryDate);
      return { ...item, meta };
    });

    // Filter by Search Query
    if (this.searchQuery) {
      items = items.filter(item => {
        const name = (item.name || '').toLowerCase();
        const brand = (item.brand || '').toLowerCase();
        const cat = (item.category || '').toLowerCase();
        const batch = (item.batchNo || '').toLowerCase();
        const notes = (item.notes || '').toLowerCase();
        return name.includes(this.searchQuery) ||
               brand.includes(this.searchQuery) ||
               cat.includes(this.searchQuery) ||
               batch.includes(this.searchQuery) ||
               notes.includes(this.searchQuery);
      });
    }

    // Filter by Status Tab
    if (this.activeStatus === 'warning') {
      items = items.filter(item => item.meta.isExpiringSoon);
    } else if (this.activeStatus === 'expired') {
      items = items.filter(item => item.meta.isExpired);
    } else if (this.activeStatus === 'safe') {
      items = items.filter(item => item.meta.status === 'safe');
    }

    // Filter by Category
    if (this.activeCategory && this.activeCategory !== 'all') {
      items = items.filter(item => item.category === this.activeCategory);
    }

    // Filter by Storage
    if (this.activeStorage && this.activeStorage !== 'all') {
      items = items.filter(item => item.storageLocation === this.activeStorage);
    }

    // Sorting: default is earliest expiry date first
    items.sort((a, b) => {
      if (this.sortBy === 'expiry_asc') {
        const dA = a.expiryDate ? new Date(a.expiryDate).getTime() : 9999999999999;
        const dB = b.expiryDate ? new Date(b.expiryDate).getTime() : 9999999999999;
        return dA - dB;
      } else if (this.sortBy === 'expiry_desc') {
        const dA = a.expiryDate ? new Date(a.expiryDate).getTime() : 0;
        const dB = b.expiryDate ? new Date(b.expiryDate).getTime() : 0;
        return dB - dA;
      } else if (this.sortBy === 'name_asc') {
        return (a.name || '').localeCompare(b.name || '');
      } else if (this.sortBy === 'qty_desc') {
        return (b.quantity || 0) - (a.quantity || 0);
      } else if (this.sortBy === 'newest') {
        const dA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dB - dA;
      }
      return 0;
    });

    return items;
  },

  getCategoryIcon(category) {
    const map = {
      'Sauces & Condiments': '🥫',
      'Dairy & Cheese': '🧀',
      'Beverages & Cold Drinks': '🥤',
      'Bakery & Buns': '🍞',
      'Frozen & Patties': '🧊',
      'Spices & Seasonings': '🧂',
      'Syrups & Crushes': '🍯',
      'Packaging & Disposables': '📦',
      'Other': '🏷️'
    };
    return map[category] || '📦';
  },

  getCategoryClass(category) {
    const map = {
      'Sauces & Condiments': 'cat-sauces',
      'Dairy & Cheese': 'cat-dairy',
      'Beverages & Cold Drinks': 'cat-beverages',
      'Bakery & Buns': 'cat-bakery',
      'Frozen & Patties': 'cat-frozen',
      'Other': 'cat-other'
    };
    return map[category] || 'cat-other';
  },

  getStorageIcon(storage) {
    const map = {
      'Chiller / Refrigerator': '❄️ Chiller / Fridge',
      'Deep Freezer': '🧊 Deep Freezer',
      'Dry Shelf / Storage': '📦 Dry Storage',
      'Kitchen Counter': '🏪 Kitchen Counter'
    };
    return map[storage] || storage || '📦 Store';
  },

  calculateProgress(inwardDateStr, expiryDateStr) {
    if (!expiryDateStr) return { percent: 0, barClass: 'bar-safe' };
    const exp = new Date(expiryDateStr).getTime();
    const inDate = inwardDateStr ? new Date(inwardDateStr).getTime() : (exp - 60 * 24 * 3600 * 1000);
    const now = new Date().getTime();

    if (now >= exp) return { percent: 100, barClass: 'bar-expired' };
    if (now <= inDate) return { percent: 0, barClass: 'bar-safe' };

    const totalDuration = exp - inDate;
    const elapsed = now - inDate;
    const pct = Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));

    const daysLeft = Math.round((exp - now) / (1000 * 60 * 60 * 24));
    let barClass = 'bar-safe';
    if (daysLeft <= 0) barClass = 'bar-expired';
    else if (daysLeft <= 15) barClass = 'bar-warning';

    return { percent: pct, barClass };
  },

  render() {
    const allItems = getExpiryItems().map(item => ({
      ...item,
      meta: calculateExpiryMeta(item.expiryDate)
    }));

    // Calculate Summary Stats
    const totalCount = allItems.length;
    const totalUnits = allItems.reduce((sum, i) => sum + (parseFloat(i.quantity) || 0), 0);
    const warningCount = allItems.filter(i => i.meta.isExpiringSoon).length;
    const expiredCount = allItems.filter(i => i.meta.isExpired).length;
    const safeCount = allItems.filter(i => i.meta.status === 'safe').length;
    
    // Total Current Stock Value (sum of all active stock cost * qty)
    const totalStockValue = allItems
      .reduce((sum, i) => sum + ((parseFloat(i.cost) || 0) * (parseFloat(i.quantity) || 0)), 0);

    // Value at risk (cost of expired + 15-day warning items)
    const atRiskValue = allItems
      .filter(i => i.meta.isExpiringSoon || i.meta.isExpired)
      .reduce((sum, i) => sum + ((parseFloat(i.cost) || 0) * (parseFloat(i.quantity) || 0)), 0);

    // Update KPI UI
    const elTot = document.getElementById('kpiTotalCount');
    const elTotUnits = document.getElementById('kpiTotalUnitsSub');
    const elStockVal = document.getElementById('kpiTotalStockValue');
    const elWarn = document.getElementById('kpiWarningCount');
    const elExp = document.getElementById('kpiExpiredCount');
    const elSafe = document.getElementById('kpiSafeCount');
    const elRisk = document.getElementById('kpiRiskValue');

    if (elTot) elTot.textContent = totalCount;
    if (elTotUnits) elTotUnits.textContent = `${totalUnits} total units in stock`;
    if (elStockVal) elStockVal.textContent = '₹ ' + totalStockValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (elWarn) elWarn.textContent = warningCount;
    if (elExp) elExp.textContent = expiredCount;
    if (elSafe) elSafe.textContent = safeCount;
    if (elRisk) elRisk.textContent = '₹ ' + atRiskValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Update Tab Badges
    const badgeAll = document.getElementById('tabBadgeAll');
    const badgeWarn = document.getElementById('tabBadgeWarn');
    const badgeExp = document.getElementById('tabBadgeExp');
    const badgeSafe = document.getElementById('tabBadgeSafe');

    if (badgeAll) badgeAll.textContent = totalCount;
    if (badgeWarn) badgeWarn.textContent = warningCount;
    if (badgeExp) badgeExp.textContent = expiredCount;
    if (badgeSafe) badgeSafe.textContent = safeCount;

    // Render Urgent 15-Day Banner
    this.renderUrgentBanner(allItems);

    // Render Filtered Table / Grid
    const filtered = this.getProcessedItems();
    const container = document.getElementById('expContainer');
    if (!container) return;

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="exp-empty">
          <div class="exp-empty-icon"><i data-lucide="package-search"></i></div>
          <h4>No Stock Items Found</h4>
          <p>No stock items match your search or filter criteria. Click below to add inward stock.</p>
          <div style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap; margin-top:8px;">
            <button class="btn btn-primary" onclick="ExpiryPage.openModal()" style="display:inline-flex; align-items:center; gap:8px; font-weight:750;">
              <i data-lucide="plus-circle"></i> Add Inward Stock Item
            </button>
            <button class="btn btn-outline" onclick="ExpiryPage.seedDemoStock(); ExpiryPage.render(); toast('Sample stock items loaded!', 'info');" style="display:inline-flex; align-items:center; gap:8px; font-weight:750;">
              <i data-lucide="sparkles"></i> Load Sample Stock
            </button>
          </div>
        </div>
      `;
      if (typeof lucide !== 'undefined') lucide.createIcons();
      return;
    }

    if (this.viewMode === 'table') {
      this.renderTable(filtered, container);
    } else {
      this.renderGrid(filtered, container);
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  renderUrgentBanner(allItems) {
    const banner = document.getElementById('expUrgentBanner');
    if (!banner) return;

    const urgentItems = allItems.filter(i => i.meta.isExpiringSoon || i.meta.isExpired);

    if (urgentItems.length === 0) {
      banner.style.display = 'none';
      return;
    }

    banner.style.display = 'flex';
    const hasExpired = urgentItems.some(i => i.meta.isExpired);
    banner.className = 'exp-urgent-banner' + (hasExpired ? ' has-expired' : '');

    const urgentListHtml = urgentItems.slice(0, 5).map(item => {
      const isExp = item.meta.isExpired;
      const chipText = `${item.name} (${item.meta.shortLabel})`;
      return `<span class="exp-urgent-chip">${isExp ? '🔴' : '⏳'} ${chipText}</span>`;
    }).join('');

    const moreText = urgentItems.length > 5 ? `<span class="exp-urgent-chip">+${urgentItems.length - 5} more items</span>` : '';

    banner.innerHTML = `
      <div class="exp-urgent-left">
        <div class="exp-urgent-icon">
          <i data-lucide="${hasExpired ? 'alert-octagon' : 'alert-triangle'}"></i>
        </div>
        <div>
          <div class="exp-urgent-title">
            <span>${hasExpired ? '⚠️ Attention: Stock Expiry Action Required' : '⏳ 15-Day Expiry Notice (Action Recommended)'}</span>
          </div>
          <div class="exp-urgent-subtitle">
            A total of <strong>${urgentItems.length} items</strong> have expired or are expiring within the next 15 days:
          </div>
          <div class="exp-urgent-chips">
            ${urgentListHtml}
            ${moreText}
          </div>
        </div>
      </div>
      <div style="flex-shrink:0;">
        <button class="btn btn-outline btn-sm" onclick="ExpiryPage.setStatusTab('warning')" style="background:var(--bg-card); font-weight:750; box-shadow:0 2px 6px rgba(0,0,0,0.05);">
          View Urgent List →
        </button>
      </div>
    `;
  },

  renderTable(items, container) {
    let rowsHtml = items.map((item, idx) => {
      const meta = item.meta;
      const catIcon = this.getCategoryIcon(item.category);
      const catClass = this.getCategoryClass(item.category);
      const storageStr = this.getStorageIcon(item.storageLocation);
      const rowClass = meta.isExpired ? 'row-expired' : (meta.isExpiringSoon ? 'row-urgent' : '');
      const costTotal = (parseFloat(item.cost) || 0) * (parseFloat(item.quantity) || 1);
      const prog = this.calculateProgress(item.inwardDate, item.expiryDate);

      return `
        <tr class="${rowClass}">
          <td style="font-weight:800; color:var(--text-muted); width:36px;">${idx + 1}</td>
          <td>
            <div class="exp-product-cell">
              <div class="exp-cat-avatar ${catClass}" title="${item.category}">${catIcon}</div>
              <div>
                <div class="exp-item-title">${this.escapeHtml(item.name)}</div>
                <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                  ${item.brand ? `<span class="exp-brand-pill"><i data-lucide="tag" style="width:11px; height:11px; vertical-align:middle;"></i> ${this.escapeHtml(item.brand)}</span>` : ''}
                  ${item.batchNo ? `<span style="font-size:0.72rem; color:var(--text-muted);">Batch: ${this.escapeHtml(item.batchNo)}</span>` : ''}
                </div>
              </div>
            </div>
          </td>
          <td>
            <div style="font-weight:650; color:var(--text-head); margin-bottom:2px;">${this.escapeHtml(item.category)}</div>
            <div class="exp-storage-tag">${storageStr}</div>
          </td>
          <td>
            <div style="font-size:0.84rem; color:var(--text-muted);">${item.inwardDate ? fmtDate(item.inwardDate) : '-'}</div>
          </td>
          <td>
            <div style="font-weight:800; font-size:0.94rem; color:var(--text-head); margin-bottom:4px;">
              ${item.expiryDate ? fmtDate(item.expiryDate) : '<span style="color:var(--text-muted);">Not Set</span>'}
            </div>
            <div>
              <span class="badge-countdown ${meta.badgeClass}">
                ${meta.isExpired ? '🔴' : (meta.isExpiringSoon ? '⏳' : '🟢')} ${meta.label}
              </span>
            </div>
            <div class="exp-progress-wrap" title="Shelf Life Elapsed: ${prog.percent}%">
              <div class="exp-progress-bar ${prog.barClass}" style="width: ${prog.percent}%;"></div>
            </div>
          </td>
          <td>
            <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(255,255,255,0.06); border:1px solid var(--border); border-radius:var(--r-md); padding:2px 6px;">
              <button type="button" onclick="ExpiryPage.adjustQuantity('${item.id}', -1)" title="Use 1 Unit (-1)" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-weight:800; font-size:1rem; padding:0 4px; line-height:1; transition:var(--tr);">−</button>
              <strong style="font-size:0.94rem; color:var(--text-head); min-width:24px; text-align:center;">${item.quantity}</strong>
              <button type="button" onclick="ExpiryPage.adjustQuantity('${item.id}', 1)" title="Add 1 Unit (+1)" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-weight:800; font-size:1rem; padding:0 4px; line-height:1; transition:var(--tr);">+</button>
            </div>
            <span style="font-size:0.78rem; color:var(--text-muted); margin-left:4px; font-weight:600;">${this.escapeHtml(item.unit || 'Units')}</span>
          </td>
          <td>
            ${costTotal > 0 ? `<div style="font-weight:800; color:var(--text-head);">₹ ${costTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div><div style="font-size:0.74rem; color:var(--text-muted);">₹ ${item.cost} / unit</div>` : '<span style="color:var(--text-muted);">-</span>'}
          </td>
          <td>
            <div style="display:flex; gap:6px; align-items:center; justify-content:center;">
              <button class="exp-action-btn btn-consume" title="Mark as Used / Consumed" onclick="ExpiryPage.markUsed('${item.id}')">
                <i data-lucide="check-check" style="width:16px; height:16px;"></i>
              </button>
              <button class="exp-action-btn" title="Edit Stock Item" onclick="ExpiryPage.openModal('${item.id}')">
                <i data-lucide="edit-2" style="width:15px; height:15px;"></i>
              </button>
              <button class="exp-action-btn btn-del" title="Delete Stock Item" onclick="ExpiryPage.deleteItem('${item.id}')">
                <i data-lucide="trash-2" style="width:15px; height:15px;"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <div class="exp-table-wrap">
        <table class="exp-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Product & Brand</th>
              <th>Category & Storage</th>
              <th>Inward Date</th>
              <th>Expiry Date & Notice</th>
              <th>Quantity</th>
              <th>Cost (₹)</th>
              <th style="text-align:center;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;
  },

  renderGrid(items, container) {
    const cardsHtml = items.map(item => {
      const meta = item.meta;
      const catIcon = this.getCategoryIcon(item.category);
      const catClass = this.getCategoryClass(item.category);
      const storageStr = this.getStorageIcon(item.storageLocation);
      const cardClass = meta.isExpired ? 'card-expired' : (meta.isExpiringSoon ? 'card-urgent' : '');
      const prog = this.calculateProgress(item.inwardDate, item.expiryDate);

      return `
        <div class="exp-item-card ${cardClass}">
          <div class="exp-card-top">
            <div style="display:flex; gap:12px; align-items:center;">
              <div class="exp-cat-avatar ${catClass}">${catIcon}</div>
              <div>
                <div class="exp-item-title">${this.escapeHtml(item.name)}</div>
                ${item.brand ? `<span class="exp-brand-pill">${this.escapeHtml(item.brand)}</span>` : ''}
              </div>
            </div>
            <span class="badge-countdown ${meta.badgeClass}">
              ${meta.shortLabel}
            </span>
          </div>

          <div class="exp-card-meta">
            <div class="exp-card-row">
              <span style="color:var(--text-muted);">Category:</span>
              <strong style="color:var(--text-head);">${this.escapeHtml(item.category)}</strong>
            </div>
            <div class="exp-card-row">
              <span style="color:var(--text-muted);">Storage:</span>
              <span>${storageStr}</span>
            </div>
            <div class="exp-card-row">
              <span style="color:var(--text-muted);">Expiry Date:</span>
              <strong style="color:var(--text-head);">${item.expiryDate ? fmtDate(item.expiryDate) : 'Not Set'}</strong>
            </div>
            <div class="exp-card-row">
              <span style="color:var(--text-muted);">Stock Qty:</span>
              <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(255,255,255,0.06); border:1px solid var(--border); border-radius:var(--r-md); padding:2px 6px;">
                <button type="button" onclick="ExpiryPage.adjustQuantity('${item.id}', -1)" title="Use 1 Unit" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-weight:800; font-size:1rem; padding:0 4px; line-height:1;">−</button>
                <strong style="color:var(--text-head); font-size:0.94rem; min-width:20px; text-align:center;">${item.quantity}</strong>
                <button type="button" onclick="ExpiryPage.adjustQuantity('${item.id}', 1)" title="Add 1 Unit" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-weight:800; font-size:1rem; padding:0 4px; line-height:1;">+</button>
              </div>
              <span style="font-size:0.78rem; color:var(--text-muted); font-weight:600;">${this.escapeHtml(item.unit || '')}</span>
            </div>
            <div style="margin-top:4px;">
              <div style="display:flex; justify-content:space-between; font-size:0.72rem; color:var(--text-muted); margin-bottom:2px;">
                <span>Shelf-Life Elapsed</span>
                <span>${prog.percent}%</span>
              </div>
              <div class="exp-progress-wrap" style="width:100%;">
                <div class="exp-progress-bar ${prog.barClass}" style="width: ${prog.percent}%;"></div>
              </div>
            </div>
          </div>

          <div class="exp-card-actions">
            <button class="btn btn-outline btn-sm" onclick="ExpiryPage.markUsed('${item.id}')" style="display:inline-flex; align-items:center; gap:5px; font-weight:700;">
              <i data-lucide="check-check" style="width:14px; height:14px;"></i> Used
            </button>
            <button class="exp-action-btn" title="Edit" onclick="ExpiryPage.openModal('${item.id}')">
              <i data-lucide="edit-2" style="width:15px; height:15px;"></i>
            </button>
            <button class="exp-action-btn btn-del" title="Delete" onclick="ExpiryPage.deleteItem('${item.id}')">
              <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `<div class="exp-grid-view">${cardsHtml}</div>`;
  },

  openModal(editId = null) {
    const modal = document.getElementById('stockModal');
    if (!modal) return;

    // Reset fields
    document.getElementById('stkEditId').value = '';
    document.getElementById('stkName').value = '';
    document.getElementById('stkBrand').value = '';
    document.getElementById('stkCategory').value = 'Sauces & Condiments';
    document.getElementById('stkStorage').value = 'Chiller / Refrigerator';
    document.getElementById('stkQty').value = '1';
    document.getElementById('stkUnit').value = 'Bottles';
    document.getElementById('stkInwardDate').value = today();
    document.getElementById('stkExpiryDate').value = '';
    document.getElementById('stkCost').value = '';
    document.getElementById('stkBatch').value = '';
    document.getElementById('stkNotes').value = '';
    document.getElementById('stkTitleText').textContent = 'Add Inward Stock Item';

    const pBox = document.getElementById('stkPreviewBox');
    if (pBox) pBox.style.display = 'none';

    if (editId) {
      const items = getExpiryItems();
      const item = items.find(i => i.id === editId);
      if (item) {
        document.getElementById('stkEditId').value = item.id;
        document.getElementById('stkName').value = item.name || '';
        document.getElementById('stkBrand').value = item.brand || '';
        document.getElementById('stkCategory').value = item.category || 'Sauces & Condiments';
        document.getElementById('stkStorage').value = item.storageLocation || 'Chiller / Refrigerator';
        document.getElementById('stkQty').value = item.quantity || 1;
        document.getElementById('stkUnit').value = item.unit || 'Bottles';
        document.getElementById('stkInwardDate').value = item.inwardDate || today();
        document.getElementById('stkExpiryDate').value = item.expiryDate || '';
        document.getElementById('stkCost').value = item.cost || '';
        document.getElementById('stkBatch').value = item.batchNo || '';
        document.getElementById('stkNotes').value = item.notes || '';
        document.getElementById('stkTitleText').textContent = 'Edit Stock Item';
        this.updateModalPreview();
      }
    }

    openModal('stockModal');
    setTimeout(() => {
      const nameInput = document.getElementById('stkName');
      if (nameInput) nameInput.focus();
    }, 100);
  },

  closeModal() {
    closeModal('stockModal');
  },

  applyPreset(name, brand, category, storage, unit, daysOffset = 45, cost = '') {
    document.getElementById('stkName').value = name;
    document.getElementById('stkBrand').value = brand;
    document.getElementById('stkCategory').value = category;
    document.getElementById('stkStorage').value = storage;
    document.getElementById('stkUnit').value = unit;
    if (cost) document.getElementById('stkCost').value = cost;
    
    // Set expiry date
    const exp = new Date();
    exp.setDate(exp.getDate() + daysOffset);
    document.getElementById('stkExpiryDate').value = exp.toISOString().substring(0, 10);
    this.updateModalPreview();
    toast(`Preset loaded: ${name}`, 'info');
  },

  applyPresetAndOpen(name, brand, category, storage, unit, daysOffset = 45, cost = '') {
    this.openModal();
    this.applyPreset(name, brand, category, storage, unit, daysOffset, cost);
  },

  addDaysToExpiry(days) {
    const base = new Date();
    base.setDate(base.getDate() + days);
    const dateStr = base.toISOString().substring(0, 10);
    document.getElementById('stkExpiryDate').value = dateStr;
    this.updateModalPreview();
    toast(`Expiry set to +${days} days (${fmtDate(dateStr)})`, 'info');
  },

  updateModalPreview() {
    const expDate = document.getElementById('stkExpiryDate').value;
    const box = document.getElementById('stkPreviewBox');
    const txt = document.getElementById('stkPreviewText');
    const badge = document.getElementById('stkPreviewBadge');
    if (!box || !txt || !badge) return;

    if (!expDate) {
      box.style.display = 'none';
      return;
    }

    const meta = calculateExpiryMeta(expDate);
    box.style.display = 'flex';
    box.style.background = meta.isExpired ? 'rgba(244, 63, 94, 0.1)' : (meta.isExpiringSoon ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.1)');
    box.style.border = `1px solid ${meta.isExpired ? 'rgba(244, 63, 94, 0.3)' : (meta.isExpiringSoon ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)')}`;

    txt.textContent = `Shelf Life: ${meta.label}`;
    txt.style.color = meta.isExpired ? '#e11d48' : (meta.isExpiringSoon ? '#b45309' : '#059669');

    badge.className = `badge-countdown ${meta.badgeClass}`;
    badge.textContent = meta.shortLabel;
  },

  async saveItem() {
    const name = document.getElementById('stkName').value.trim();
    const brand = document.getElementById('stkBrand').value.trim();
    const category = document.getElementById('stkCategory').value;
    const storageLocation = document.getElementById('stkStorage').value;
    const quantity = parseFloat(document.getElementById('stkQty').value) || 1;
    const unit = document.getElementById('stkUnit').value;
    const inwardDate = document.getElementById('stkInwardDate').value || today();
    const expiryDate = document.getElementById('stkExpiryDate').value;
    const cost = parseFloat(document.getElementById('stkCost').value) || 0;
    const batchNo = document.getElementById('stkBatch').value.trim();
    const notes = document.getElementById('stkNotes').value.trim();
    const editId = document.getElementById('stkEditId').value;

    if (!name) {
      toast('Please enter product / item name!', 'warning');
      document.getElementById('stkName').focus();
      return;
    }

    if (!expiryDate) {
      toast('Please select an expiry date!', 'warning');
      document.getElementById('stkExpiryDate').focus();
      return;
    }

    const itemObj = {
      name,
      brand,
      category,
      storageLocation,
      quantity,
      unit,
      inwardDate,
      expiryDate,
      cost,
      batchNo,
      notes
    };

    if (editId) {
      itemObj.id = editId;
    }

    this.closeModal();
    const saved = await saveExpiryItemToFirebase(itemObj);
    if (saved) {
      toast(editId ? 'Stock item updated successfully!' : 'New stock item added successfully!', 'success');
      this.render();
    }
  },

  async deleteItem(id) {
    const items = getExpiryItems();
    const item = items.find(i => i.id === id);
    const itemName = item ? item.name : 'this item';

    if (!confirm(`Are you sure you want to delete "${itemName}" from the stock tracker?`)) {
      return;
    }

    const ok = await deleteExpiryItemFromFirebase(id);
    if (ok) {
      toast('Stock item deleted!', 'success');
      this.render();
    }
  },

  async markUsed(id) {
    const items = getExpiryItems();
    const item = items.find(i => i.id === id);
    if (!item) return;

    if (item.quantity > 1) {
      const usedQty = prompt(`How much quantity was used / consumed? (Current Stock: ${item.quantity} ${item.unit})`, '1');
      if (usedQty === null) return;
      const num = parseFloat(usedQty);
      if (num >= item.quantity) {
        await deleteExpiryItemFromFirebase(id);
        toast(`"${item.name}" was completely consumed and removed from active stock!`, 'success');
      } else if (num > 0) {
        item.quantity = item.quantity - num;
        await saveExpiryItemToFirebase(item);
        toast(`Recorded ${num} ${item.unit} consumed. Remaining stock: ${item.quantity} ${item.unit}`, 'success');
      }
    } else {
      if (confirm(`Has "${item.name}" been completely consumed? It will be removed from active stock.`)) {
        await deleteExpiryItemFromFirebase(id);
        toast(`"${item.name}" marked as consumed!`, 'success');
      }
    }
    this.render();
  },

  async adjustQuantity(id, delta) {
    const items = getExpiryItems();
    const item = items.find(i => i.id === id);
    if (!item) return;

    const current = parseFloat(item.quantity) || 0;
    const newQty = Math.max(0, Math.round((current + delta) * 100) / 100);

    if (newQty <= 0) {
      if (confirm(`Stock for "${item.name}" has reached 0. Mark as completely consumed and remove from active stock?`)) {
        await deleteExpiryItemFromFirebase(id);
        toast(`"${item.name}" marked as consumed!`, 'success');
        this.render();
        return;
      }
    } else {
      item.quantity = newQty;
      await saveExpiryItemToFirebase(item);
      toast(`${item.name} stock: ${newQty} ${item.unit}`, 'info');
      this.render();
    }
  },

  exportExcel() {
    const items = this.getProcessedItems();
    if (!items.length) {
      toast('No stock items to export!', 'warning');
      return;
    }
    if (typeof XLSX === 'undefined') {
      toast('Excel export library not loaded!', 'error');
      return;
    }

    try {
      const rows = items.map((item, i) => {
        const meta = calculateExpiryMeta(item.expiryDate);
        return {
          '#': i + 1,
          'Product Name': item.name,
          'Brand / Company': item.brand || '-',
          'Category': item.category || '-',
          'Storage Location': item.storageLocation || '-',
          'Inward Date': item.inwardDate || '-',
          'Expiry Date': item.expiryDate || '-',
          'Days Left': meta.daysLeft < 0 ? `Expired (${Math.abs(meta.daysLeft)}d ago)` : `${meta.daysLeft} Days`,
          'Status (15-Day Notice)': meta.label,
          'Quantity': item.quantity,
          'Unit': item.unit || 'Units',
          'Unit Cost (₹)': item.cost || 0,
          'Total Value (₹)': (parseFloat(item.cost) || 0) * (parseFloat(item.quantity) || 1),
          'Batch No': item.batchNo || '-',
          'Notes': item.notes || '-'
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Stock Expiry Tracker');
      XLSX.writeFile(wb, 'Crust-Chilly-Stock-Expiry-' + today() + '.xlsx');
      toast('Stock Expiry Excel Exported!', 'success');
    } catch (err) {
      console.error(err);
      toast('Failed to export Excel!', 'error');
    }
  },

  exportPDF() {
    const items = this.getProcessedItems();
    if (!items.length) {
      toast('No stock items to export!', 'warning');
      return;
    }

    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('l', 'mm', 'a4'); // Landscape

      // Header Banner
      doc.setFillColor(139, 92, 246);
      doc.rect(0, 0, 297, 28, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.text('Crust & Chilly — Stock & Expiry Notice Report', 14, 14);
      doc.setFontSize(10);
      doc.text(`Generated on: ${new Date().toLocaleString('en-IN')} | Total Items: ${items.length}`, 14, 22);

      const tableData = items.map((item, idx) => {
        const meta = calculateExpiryMeta(item.expiryDate);
        return [
          idx + 1,
          item.name + (item.brand ? ` (${item.brand})` : ''),
          item.category,
          item.storageLocation,
          item.inwardDate || '-',
          item.expiryDate || '-',
          meta.shortLabel,
          `${item.quantity} ${item.unit || ''}`,
          item.cost ? `₹ ${item.cost}` : '-'
        ];
      });

      doc.autoTable({
        head: [['#', 'Product & Brand', 'Category', 'Storage', 'Inward Date', 'Expiry Date', 'Status / Notice', 'Qty', 'Cost']],
        body: tableData,
        startY: 32,
        theme: 'striped',
        headStyles: { fillColor: [109, 40, 217], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 8.5, cellPadding: 3 },
        didParseCell: function(data) {
          if (data.section === 'body' && data.column.index === 6) {
            const raw = data.cell.raw || '';
            if (raw.includes('Expired')) {
              data.cell.styles.textColor = [225, 29, 72];
              data.cell.styles.fontStyle = 'bold';
            } else if (raw.includes('Days Left') && parseInt(raw) <= 15) {
              data.cell.styles.textColor = [217, 119, 6];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      });

      doc.save(`Crust-Chilly-Expiry-Report-${today()}.pdf`);
      toast('Stock Expiry PDF Exported!', 'success');
    } catch (err) {
      console.error(err);
      toast('Failed to export PDF!', 'error');
    }
  },

  seedDemoStock() {
    const todayObj = new Date();
    const getDateStr = (offsetDays) => {
      const d = new Date(todayObj);
      d.setDate(d.getDate() + offsetDays);
      return d.toISOString().substring(0, 10);
    };

    const sampleItems = [
      {
        id: 'exp_demo_1',
        name: 'Burger Mayonnaise 1kg',
        brand: 'Veeba',
        category: 'Sauces & Condiments',
        storageLocation: 'Chiller / Refrigerator',
        quantity: 3,
        unit: 'Bottles',
        inwardDate: getDateStr(-25),
        expiryDate: getDateStr(3), // 3 days left -> ⏳ 15-day notice
        cost: 185,
        batchNo: 'VB-MAY-901',
        notes: 'Main burger base sauce, keep chilled.'
      },
      {
        id: 'exp_demo_2',
        name: 'Pizza & Pasta Sauce',
        brand: 'Cremica',
        category: 'Sauces & Condiments',
        storageLocation: 'Chiller / Refrigerator',
        quantity: 2,
        unit: 'Bottles',
        inwardDate: getDateStr(-20),
        expiryDate: getDateStr(6), // 6 days left -> ⏳ 15-day notice
        cost: 210,
        batchNo: 'CR-PZ-442',
        notes: 'Use for 7-inch & 10-inch pizzas.'
      },
      {
        id: 'exp_demo_3',
        name: 'Cheese Blend Sauce',
        brand: 'Cremica',
        category: 'Sauces & Condiments',
        storageLocation: 'Chiller / Refrigerator',
        quantity: 4,
        unit: 'Bottles',
        inwardDate: getDateStr(-15),
        expiryDate: getDateStr(11), // 11 days left -> ⏳ 15-day notice
        cost: 240,
        batchNo: 'CR-CH-108',
        notes: 'For cheesy fries and loaded burgers.'
      },
      {
        id: 'exp_demo_4',
        name: 'Thousand Island Dressing',
        brand: 'Veeba',
        category: 'Sauces & Condiments',
        storageLocation: 'Chiller / Refrigerator',
        quantity: 2,
        unit: 'Bottles',
        inwardDate: getDateStr(-10),
        expiryDate: getDateStr(35), // 🟢 Safe
        cost: 195,
        batchNo: 'VB-TI-220',
        notes: 'Salad and submarine sandwich dressing.'
      },
      {
        id: 'exp_demo_5',
        name: 'Chipotle Southwest Sauce',
        brand: 'Veeba',
        category: 'Sauces & Condiments',
        storageLocation: 'Chiller / Refrigerator',
        quantity: 3,
        unit: 'Bottles',
        inwardDate: getDateStr(-5),
        expiryDate: getDateStr(50), // 🟢 Safe
        cost: 205,
        batchNo: 'VB-CP-881',
        notes: 'Spicy wraps and tacos.'
      },
      {
        id: 'exp_demo_6',
        name: 'Mozzarella Cheese Diced 1kg',
        brand: 'Amul',
        category: 'Dairy & Cheese',
        storageLocation: 'Deep Freezer',
        quantity: 5,
        unit: 'Packets',
        inwardDate: getDateStr(-18),
        expiryDate: getDateStr(5), // 5 days left -> ⏳ 15-day notice
        cost: 440,
        batchNo: 'AM-MZ-611',
        notes: 'Store in -18°C deep freezer.'
      },
      {
        id: 'exp_demo_7',
        name: 'Pasteurised Table Butter 500g',
        brand: 'Amul',
        category: 'Dairy & Cheese',
        storageLocation: 'Chiller / Refrigerator',
        quantity: 4,
        unit: 'Packets',
        inwardDate: getDateStr(-12),
        expiryDate: getDateStr(65), // 🟢 Safe
        cost: 275,
        batchNo: 'AM-BT-309',
        notes: 'For garlic breads and buns toasting.'
      },
      {
        id: 'exp_demo_8',
        name: 'Thums Up Cans 250ml',
        brand: 'Coca-Cola',
        category: 'Beverages & Cold Drinks',
        storageLocation: 'Chiller / Refrigerator',
        quantity: 24,
        unit: 'Cans',
        inwardDate: getDateStr(-90),
        expiryDate: getDateStr(-2), // 🔴 Expired 2 days ago
        cost: 35,
        batchNo: 'CC-TU-552',
        notes: 'Batch expired, return or replace.'
      },
      {
        id: 'exp_demo_9',
        name: 'Sprite Cans 250ml',
        brand: 'Coca-Cola',
        category: 'Beverages & Cold Drinks',
        storageLocation: 'Chiller / Refrigerator',
        quantity: 24,
        unit: 'Cans',
        inwardDate: getDateStr(-10),
        expiryDate: getDateStr(80), // 🟢 Safe
        cost: 35,
        batchNo: 'CC-SP-101',
        notes: 'Serve chilled.'
      },
      {
        id: 'exp_demo_10',
        name: 'Mint Mayonnaise',
        brand: 'Veeba',
        category: 'Sauces & Condiments',
        storageLocation: 'Chiller / Refrigerator',
        quantity: 2,
        unit: 'Bottles',
        inwardDate: getDateStr(-8),
        expiryDate: getDateStr(40), // 🟢 Safe
        cost: 170,
        batchNo: 'VB-MM-713',
        notes: 'Paneer tikka rolls and sandwiches.'
      }
    ];

    currentExpiryItems = sampleItems;
    localStorage.setItem('bd_expiry_items', JSON.stringify(sampleItems));
  },

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, function (m) {
      return ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[m];
    });
  }
};

// Global hooks for HTML onclick attributes
function openStockModal(editId) { ExpiryPage.openModal(editId); }
function closeStockModal() { ExpiryPage.closeModal(); }
function saveStockItem() { ExpiryPage.saveItem(); }
function exportExpiryExcel() { ExpiryPage.exportExcel(); }
function exportExpiryPDF() { ExpiryPage.exportPDF(); }

document.addEventListener('DOMContentLoaded', () => {
  ExpiryPage.init();
});
