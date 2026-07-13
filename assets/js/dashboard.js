/* ============================================
   DASHBOARD.JS — Advanced Analytics
   ============================================ */

const Dash = {
  charts: { bar: null, donut: null, line: null },
  period: 'month',

  init(){
    this.setupYearSelector();
    this.loadAll();
    this.setupSearch();
    this.setupWelcome();
  },

  loadAll(){
    const all = getTxns();
    this.loadSummary(all);
    this.loadAnalytics(all);
    this.loadInsights(all);
    this.loadComparison(all);
    this.loadTopCategories(all);
    this.loadPaymentModes(all);
    this.loadRecent(all);
    this.buildBarChart(all);
    this.buildDonutChart(all);
    this.buildLineChart(all);
  },

  setupWelcome(){
    const h = new Date().getHours();
    let msg = '🌙 Good Night!';
    if(h >= 5 && h < 12) msg = '🌅 Good Morning!';
    else if(h >= 12 && h < 17) msg = '☀️ Good Afternoon!';
    else if(h >= 17 && h < 21) msg = '🌇 Good Evening!';
    const el = document.getElementById('welcomeMsg');
    if(el) el.textContent = msg;
    const sub = document.getElementById('heroSubtext');
    if(sub) sub.textContent = fmtDateFull(today());
  },

  loadSummary(all){
    const period = this.period;
    const txns = filterByPeriod(all, period);
    const t = calcTotals(txns);
    const allT = calcTotals(all);

    this.setEl('pIncome', inr(t.income));
    this.setEl('pExpense', inr(t.expense));
    this.setEl('pProfit', inr(t.profit));
    this.setEl('totalBal', inr(allT.profit));
    this.setEl('totalCount', all.length + ' records');

    const iC = txns.filter(x => x.type === 'income').length;
    const eC = txns.filter(x => x.type === 'expense').length;
    this.setEl('pIncomeCount', iC + ' income');
    this.setEl('pExpenseCount', eC + ' expense');

    const margin = t.income > 0 ? Math.round((t.profit / t.income) * 100) : 0;
    this.setEl('pMargin', margin + '% profit margin');

    // Trends (compare with previous period)
    this.updateTrends(all, period);

    // Profit color
    const pEl = document.getElementById('pProfit');
    if(pEl) pEl.className = 'sc-value ' + (t.profit >= 0 ? 'text-profit' : 'text-expense');
  },

  updateTrends(all, period){
    let prevPeriod;
    if(period === 'today') prevPeriod = 'yesterday';
    else if(period === 'week') prevPeriod = 'lastweek';
    else if(period === 'month') prevPeriod = 'lastmonth';
    else prevPeriod = null;

    const cur = calcTotals(filterByPeriod(all, period));
    let iTrend = 0, eTrend = 0, pTrend = 0;

    if(prevPeriod){
      const prev = calcTotals(filterByPeriod(all, prevPeriod));
      iTrend = prev.income > 0 ? Math.round(((cur.income - prev.income) / prev.income) * 100) : (cur.income > 0 ? 100 : 0);
      eTrend = prev.expense > 0 ? Math.round(((cur.expense - prev.expense) / prev.expense) * 100) : (cur.expense > 0 ? 100 : 0);
      pTrend = prev.profit !== 0 ? Math.round(((cur.profit - prev.profit) / Math.abs(prev.profit)) * 100) : (cur.profit > 0 ? 100 : 0);
    }

    this.setTrend('incomeTrend', iTrend, true);
    this.setTrend('expenseTrend', eTrend, false);
    this.setTrend('profitTrend', pTrend, true);
  },

  setTrend(id, val, higherIsBetter){
    const el = document.getElementById(id);
    if(!el) return;
    const arrow = val > 0 ? '↑' : val < 0 ? '↓' : '→';
    const cls = val === 0 ? 'neutral' : (higherIsBetter ? (val > 0 ? 'up' : 'down') : (val > 0 ? 'down' : 'up'));
    el.className = 'sc-trend ' + cls;
    el.textContent = arrow + ' ' + Math.abs(val) + '%';
  },

  loadAnalytics(all){
    if(!all.length){
      this.setEl('msAvgIncome', '₹ 0');
      this.setEl('msAvgExpense', '₹ 0');
      this.setEl('msSavings', '0%');
      return;
    }

    // Get unique days
    const days = new Set(all.map(t => t.date));
    const numDays = Math.max(days.size, 1);

    const tot = calcTotals(all);
    const avgIncome = tot.income / numDays;
    const avgExpense = tot.expense / numDays;
    const savingsRate = tot.income > 0 ? Math.round((tot.profit / tot.income) * 100) : 0;

    this.setEl('msAvgIncome', inr(avgIncome));
    this.setEl('msAvgExpense', inr(avgExpense));
    this.setEl('msSavings', savingsRate + '%');
    this.setEl('msIncomeDays', `Across ${numDays} active day${numDays !== 1 ? 's' : ''}`);
    this.setEl('msExpenseDays', `Across ${numDays} active day${numDays !== 1 ? 's' : ''}`);
    this.setEl('msSavingsSub', savingsRate >= 30 ? '🎉 Excellent!' : savingsRate >= 15 ? '👍 Good' : savingsRate > 0 ? '⚠️ Improve' : '❌ Loss');

    // Progress bars
    const maxAvg = Math.max(avgIncome, avgExpense, 1);
    const iBar = document.getElementById('msIncomeBar');
    const eBar = document.getElementById('msExpenseBar');
    const sBar = document.getElementById('msSavingsBar');
    if(iBar) iBar.style.width = Math.min((avgIncome / maxAvg) * 100, 100) + '%';
    if(eBar) eBar.style.width = Math.min((avgExpense / maxAvg) * 100, 100) + '%';
    if(sBar) sBar.style.width = Math.max(0, Math.min(savingsRate, 100)) + '%';
  },

  loadInsights(all){
    const box = document.getElementById('insightsBox');
    if(!box) return;

    const insights = [];
    if(!all.length){
      insights.push({ type: 'info', icon: '💡', text: 'Add your first transaction to get started!' });
    } else {
      const tot = calcTotals(all);
      const monthTxns = filterByPeriod(all, 'month');
      const monthT = calcTotals(monthTxns);
      const lastMonthT = calcTotals(filterByPeriod(all, 'lastmonth'));

      // Profit/Loss insight
      if(tot.profit > 0){
        insights.push({ type: 'success', icon: '💰', text: `Great! You're in <strong>profit</strong> of ${inr(tot.profit)}` });
      } else if(tot.profit < 0){
        insights.push({ type: 'danger', icon: '⚠️', text: `You're in <strong>loss</strong> by ${inr(Math.abs(tot.profit))}. Reduce expenses.` });
      }

      // Month comparison
      if(lastMonthT.expense > 0){
        const diff = monthT.expense - lastMonthT.expense;
        const pct = Math.abs(Math.round((diff / lastMonthT.expense) * 100));
        if(diff > 0){
          insights.push({ type: 'warn', icon: '📈', text: `Expenses are <strong>${pct}% higher</strong> than last month` });
        } else if(diff < 0){
          insights.push({ type: 'success', icon: '📉', text: `Expenses are <strong>${pct}% lower</strong> than last month. 👏` });
        }
      }

      // Top category
      const expenses = all.filter(t => t.type === 'expense');
      if(expenses.length){
        const grouped = {};
        expenses.forEach(t => grouped[t.category] = (grouped[t.category] || 0) + parseFloat(t.amount));
        const top = Object.entries(grouped).sort((a,b) => b[1]-a[1])[0];
        insights.push({ type: 'info', icon: '🎯', text: `Biggest expense: <strong>${top[0]}</strong> (${inr(top[1])})` });
      }

      // Savings rate
      if(tot.income > 0){
        const rate = Math.round((tot.profit / tot.income) * 100);
        if(rate >= 30){
          insights.push({ type: 'success', icon: '🏆', text: `Excellent savings rate of <strong>${rate}%</strong>!` });
        } else if(rate < 10 && rate >= 0){
          insights.push({ type: 'warn', icon: '💡', text: `Your savings rate is only <strong>${rate}%</strong>. Aim for 20%+` });
        }
      }
    }

    box.innerHTML = insights.slice(0, 4).map(i => `
      <div class="insight-item ${i.type}">
        <span class="insight-icon">${i.icon}</span>
        <div class="insight-text">${i.text}</div>
      </div>
    `).join('');
  },

  loadComparison(all){
    const thisM = calcTotals(filterByPeriod(all, 'month'));
    const lastM = calcTotals(filterByPeriod(all, 'lastmonth'));

    this.setEl('cmpLast', inr(lastM.profit));
    this.setEl('cmpThis', inr(thisM.profit));

    const arrow = document.getElementById('cmpArrow');
    if(!arrow) return;

    if(lastM.profit === 0){
      arrow.className = 'compare-arrow neutral';
      arrow.textContent = thisM.profit > 0 ? '↑ New profit!' : '→ No change';
    } else {
      const diff = thisM.profit - lastM.profit;
      const pct = Math.round((diff / Math.abs(lastM.profit)) * 100);
      arrow.className = 'compare-arrow ' + (diff >= 0 ? 'up' : 'down');
      arrow.textContent = (diff >= 0 ? '↑' : '↓') + ' ' + Math.abs(pct) + '% vs last month';
    }
  },

  loadTopCategories(all){
    const box = document.getElementById('topCatBox');
    if(!box) return;
    const expenses = all.filter(t => t.type === 'expense');
    if(!expenses.length){
      box.innerHTML = '<div class="empty"><p>No expense data</p></div>';
      return;
    }
    const grouped = {};
    expenses.forEach(t => grouped[t.category] = (grouped[t.category] || 0) + parseFloat(t.amount));
    const sorted = Object.entries(grouped).sort((a,b) => b[1]-a[1]).slice(0, 5);
    const max = sorted[0][1];
    box.innerHTML = sorted.map(([c, a], i) => `
      <div class="tc-item">
        <div class="tc-rank ${i < 3 ? 'r' + (i+1) : ''}">${i+1}</div>
        <div class="tc-info">
          <div class="tc-name">${c}</div>
          <div class="tc-bar"><div class="tc-fill" style="width:${(a/max)*100}%"></div></div>
        </div>
        <div class="tc-amt">${inrShort(a)}</div>
      </div>
    `).join('');
  },

  loadPaymentModes(all){
    const box = document.getElementById('payModeBox');
    if(!box) return;
    if(!all.length){
      box.innerHTML = '<div class="empty"><p>No data</p></div>';
      return;
    }
    const grouped = {};
    all.forEach(t => {
      const m = t.mode || 'Cash';
      if(!grouped[m]) grouped[m] = { total: 0, count: 0 };
      grouped[m].total += parseFloat(t.amount);
      grouped[m].count++;
    });
    const total = Object.values(grouped).reduce((s, x) => s + x.total, 0);
    const sorted = Object.entries(grouped).sort((a,b) => b[1].total - a[1].total);
    const icons = { Cash:'💵', Online:'📱', UPI:'📲', 'Bank Transfer':'🏦', Card:'💳', Cheque:'📄' };
    box.innerHTML = sorted.map(([m, d]) => {
      const pct = Math.round((d.total / total) * 100);
      return `<div class="pm-item">
        <div class="pm-ic">${icons[m] || '💰'}</div>
        <div class="pm-info">
          <div class="pm-name">${m}</div>
          <div class="pm-sub">${d.count} transactions</div>
        </div>
        <div>
          <div class="pm-amt">${inrShort(d.total)}</div>
          <div class="pm-pct">${pct}%</div>
        </div>
      </div>`;
    }).join('');
  },

  loadRecent(all){
    const tbody = document.getElementById('recentBody');
    if(!tbody) return;
    const sorted = [...all].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 8);
    if(!sorted.length){
      tbody.innerHTML = `<tr><td colspan="5"><div class="empty"><div class="empty-icon">📋</div><h4>No transactions</h4></div></td></tr>`;
      return;
    }
    tbody.innerHTML = sorted.map(t => `
      <tr>
        <td style="font-size:0.8rem;">${fmtDate(t.date)}</td>
        <td><span class="badge ${t.type === 'income' ? 'badge-in' : 'badge-out'}">${t.type === 'income' ? '💰 In' : '💸 Out'}</span></td>
        <td style="font-size:0.8rem;">${t.category}</td>
        <td class="${t.type === 'income' ? 'amt-in' : 'amt-out'}">${t.type === 'income' ? '+' : '-'}${inrShort(t.amount)}</td>
        <td style="font-size:0.75rem;color:var(--text-muted);">${t.mode || 'Cash'}</td>
      </tr>
    `).join('');
  },

  setupYearSelector(){
    const sel = document.getElementById('chartYear');
    if(!sel) return;
    const cur = new Date().getFullYear();
    for(let y = cur; y >= cur - 4; y--){
      const o = document.createElement('option');
      o.value = y;
      o.textContent = y;
      if(y === cur) o.selected = true;
      sel.appendChild(o);
    }
  },

  buildBarChart(all){
    const canvas = document.getElementById('barChart');
    if(!canvas) return;
    const year = parseInt(document.getElementById('chartYear')?.value) || new Date().getFullYear();
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const income = new Array(12).fill(0);
    const expense = new Array(12).fill(0);
    for(let i = 0; i < all.length; i++){
      const t = all[i];
      const d = new Date(t.date);
      if(d.getFullYear() !== year) continue;
      const m = d.getMonth();
      const a = parseFloat(t.amount);
      if(t.type === 'income') income[m] += a;
      else if(t.type === 'expense') expense[m] += a;
    }
    if(this.charts.bar) this.charts.bar.destroy();
    this.charts.bar = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [
          { label: 'Income', data: income, backgroundColor: 'rgba(16,185,129,0.85)', borderRadius: 6 },
          { label: 'Expense', data: expense, backgroundColor: 'rgba(244,63,94,0.85)', borderRadius: 6 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', align: 'end', labels: { usePointStyle: true, pointStyle: 'circle', font: { size: 12, weight: '600' }, padding: 16 } },
          tooltip: {
            backgroundColor: '#0f172a', titleColor: '#fff', bodyColor: '#cbd5e1',
            padding: 12, cornerRadius: 10, borderColor: '#06b6d4', borderWidth: 1,
            callbacks: { label: ctx => ` ${ctx.dataset.label}: ${inr(ctx.parsed.y)}` }
          }
        },
        scales: {
          x: { grid: { display: false }, border: { display: false }, ticks: { color: '#94a3b8', font: { size: 11 } } },
          y: {
            beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' }, border: { display: false },
            ticks: { color: '#94a3b8', font: { size: 11 }, callback: v => inrShort(v) }
          }
        }
      }
    });
  },

  buildDonutChart(all){
    const canvas = document.getElementById('donutChart');
    if(!canvas) return;
    const period = document.getElementById('donutPeriod')?.value || 'month';
    const txns = filterByPeriod(all, period).filter(t => t.type === 'expense');
    const grouped = {};
    txns.forEach(t => grouped[t.category] = (grouped[t.category] || 0) + parseFloat(t.amount));
    const labels = Object.keys(grouped);
    const values = Object.values(grouped);
    const colors = ['#06b6d4','#f43f5e','#fbbf24','#10b981','#8b5cf6','#3b82f6','#ec4899','#84cc16','#f97316','#6366f1','#14b8a6','#fb923c'];

    if(this.charts.donut) this.charts.donut.destroy();
    if(!labels.length){
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      document.getElementById('donutLegend').innerHTML = '<p style="text-align:center;color:var(--text-muted);font-size:0.82rem;padding:20px;">No expense data</p>';
      return;
    }
    this.charts.donut = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors.slice(0, labels.length),
          borderWidth: 3, borderColor: '#fff', hoverBorderWidth: 4, hoverOffset: 8
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '68%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a', titleColor: '#fff', bodyColor: '#cbd5e1',
            padding: 12, cornerRadius: 10,
            callbacks: {
              label: ctx => {
                const total = ctx.dataset.data.reduce((a,b) => a+b, 0);
                const pct = Math.round((ctx.parsed / total) * 100);
                return ` ${inr(ctx.parsed)} (${pct}%)`;
              }
            }
          }
        }
      }
    });
    const total = values.reduce((a,b) => a+b, 0);
    document.getElementById('donutLegend').innerHTML = labels.map((l, i) => `
      <div class="leg-row">
        <div class="leg-dot" style="background:${colors[i]}"></div>
        <span class="leg-name">${l}</span>
        <span class="leg-val">${inrShort(values[i])}</span>
        <span class="leg-pct">${Math.round((values[i]/total)*100)}%</span>
      </div>
    `).join('');
  },

  buildLineChart(all){
    const canvas = document.getElementById('lineChart');
    if(!canvas) return;
    const days = 30;
    const labels = [];
    const income = [];
    const expense = [];
    const now = new Date();
    for(let i = days - 1; i >= 0; i--){
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      labels.push(d.getDate() + '/' + (d.getMonth() + 1));
      let inc = 0, exp = 0;
      for(let j = 0; j < all.length; j++){
        const t = all[j];
        if(t.date === ds){
          if(t.type === 'income') inc += parseFloat(t.amount);
          else if(t.type === 'expense') exp += parseFloat(t.amount);
        }
      }
      income.push(inc);
      expense.push(exp);
    }
    if(this.charts.line) this.charts.line.destroy();
    const ctx = canvas.getContext('2d');
    const g1 = ctx.createLinearGradient(0, 0, 0, 220);
    g1.addColorStop(0, 'rgba(16,185,129,0.25)');
    g1.addColorStop(1, 'rgba(16,185,129,0)');
    const g2 = ctx.createLinearGradient(0, 0, 0, 220);
    g2.addColorStop(0, 'rgba(244,63,94,0.25)');
    g2.addColorStop(1, 'rgba(244,63,94,0)');

    this.charts.line = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Income', data: income, borderColor: '#10b981', backgroundColor: g1, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, fill: true, tension: 0.4 },
          { label: 'Expense', data: expense, borderColor: '#f43f5e', backgroundColor: g2, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, fill: true, tension: 0.4 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', align: 'end', labels: { usePointStyle: true, pointStyle: 'circle', font: { size: 12, weight: '600' }, padding: 16 } },
          tooltip: {
            backgroundColor: '#0f172a', titleColor: '#fff', bodyColor: '#cbd5e1',
            padding: 12, cornerRadius: 10,
            callbacks: { label: ctx => ` ${ctx.dataset.label}: ${inr(ctx.parsed.y)}` }
          }
        },
        scales: {
          x: { grid: { display: false }, border: { display: false }, ticks: { color: '#94a3b8', font: { size: 10 }, maxRotation: 0 } },
          y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' }, border: { display: false }, ticks: { color: '#94a3b8', font: { size: 11 }, callback: v => inrShort(v) } }
        }
      }
    });
  },

  setupSearch(){
    const input = document.getElementById('headerSearch');
    if(!input) return;
    const handler = debounce(e => {
      const q = e.target.value.trim().toLowerCase();
      const all = getTxns();
      if(!q){ this.loadRecent(all); return; }
      const results = all.filter(t =>
        t.category.toLowerCase().includes(q) ||
        (t.notes || '').toLowerCase().includes(q) ||
        (t.from || '').toLowerCase().includes(q) ||
        (t.vendor || '').toLowerCase().includes(q) ||
        String(t.amount).includes(q)
      ).slice(0, 8);
      const tbody = document.getElementById('recentBody');
      if(!results.length){
        tbody.innerHTML = `<tr><td colspan="5"><div class="empty"><div class="empty-icon">🔍</div><h4>No results</h4></div></td></tr>`;
        return;
      }
      tbody.innerHTML = results.map(t => `
        <tr>
          <td style="font-size:0.8rem;">${fmtDate(t.date)}</td>
          <td><span class="badge ${t.type === 'income' ? 'badge-in' : 'badge-out'}">${t.type === 'income' ? '💰 In' : '💸 Out'}</span></td>
          <td style="font-size:0.8rem;">${t.category}</td>
          <td class="${t.type === 'income' ? 'amt-in' : 'amt-out'}">${t.type === 'income' ? '+' : '-'}${inrShort(t.amount)}</td>
          <td style="font-size:0.75rem;color:var(--text-muted);">${t.mode || 'Cash'}</td>
        </tr>
      `).join('');
    }, 250);
    input.addEventListener('input', handler);
  },

  setEl(id, val){
    const el = document.getElementById(id);
    if(el) el.textContent = val;
  }
};

// Global functions
function switchPeriod(p, btn){
  Dash.period = p;
  document.querySelectorAll('.pb-tab').forEach(b => b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  Dash.loadSummary(getTxns());
}

function buildBarChart(){ Dash.buildBarChart(getTxns()); }
function buildDonutChart(){ Dash.buildDonutChart(getTxns()); }

function saveTransaction(type){
  const isI = type === 'income';
  const date = document.getElementById(isI ? 'iDate' : 'eDate').value;
  const cat = document.getElementById(isI ? 'iCat' : 'eCat').value;
  const amt = document.getElementById(isI ? 'iAmt' : 'eAmt').value;
  const mode = document.getElementById(isI ? 'iMode' : 'eMode').value;
  const from = isI ? document.getElementById('iFrom').value : '';
  const vendor = !isI ? document.getElementById('eVendor').value : '';
  const notes = document.getElementById(isI ? 'iNote' : 'eNote').value;
  const editId = document.getElementById(isI ? 'iEditId' : 'eEditId').value;

  if(!date){ toast('Please select a date', 'error'); return; }
  if(!cat){ toast('Please select a category', 'error'); return; }
  if(!amt || parseFloat(amt) <= 0){ toast('Enter a valid amount', 'error'); return; }

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
  } else {
    txns.push(entry);
  }

  saveTxns(txns);
  closeModal(isI ? 'incomeModal' : 'expenseModal');
  resetForm(type);
  Dash.loadAll();
  toast((editId ? 'Updated' : 'Added') + ' ' + type + '!');
}

function resetForm(type){
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
}

function openIncomeModal(){
  resetForm('income');
  document.getElementById('iDate').value = today();
  openModal('incomeModal');
}

function openExpenseModal(){
  resetForm('expense');
  document.getElementById('eDate').value = today();
  openModal('expenseModal');
}

document.addEventListener('DOMContentLoaded', () => Dash.init());