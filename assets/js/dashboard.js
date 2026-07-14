/* ============================================
   DASHBOARD.JS v4.1 — Yesterday Support
   ============================================ */

'use strict';

const Dash = {
  charts: { bar: null, donut: null, line: null },
  period: 'month',
  isFirstLoad: true,

  init: function() {
    try {
      this.setupWelcome();
      this.setupYearSelector();
      this.loadAll();
      this.setupSearch();
      this.animateNumbers();
    } catch (err) {
      console.error('Dashboard init error:', err);
    }
  },

  loadAll: function() {
    const all = getTxns();
    this.loadSummary(all);
    this.loadCashOnline(all);
    this.loadAnalytics(all);
    this.loadInsights(all);
    this.loadComparison(all);
    this.loadTopCategories(all);
    this.loadPaymentModes(all);
    this.loadRecent(all);
    if (typeof Chart !== 'undefined') {
      this.buildBarChart(all);
      this.buildDonutChart(all);
      this.buildLineChart(all);
    } else {
      setTimeout(() => {
        if (typeof Chart !== 'undefined') {
          this.buildBarChart(getTxns());
          this.buildDonutChart(getTxns());
          this.buildLineChart(getTxns());
        }
      }, 500);
    }
  },

  animateNumbers: function() {
    setTimeout(() => {
      const numberIds = [
        'pIncome', 'pExpense', 'pProfit', 'totalBal',
        'cashIn', 'cashOut', 'cashBalance',
        'onlineIn', 'onlineOut', 'onlineBalance',
        'msAvgIncome', 'msAvgExpense', 'msSavings',
        'cmpLast', 'cmpThis',
        'lineIncomeTotal', 'lineExpenseTotal', 'lineNetTotal'
      ];

      numberIds.forEach(id => {
        const el = document.getElementById(id);
        if (el && el.textContent && el.textContent !== '₹ 0.00' && el.textContent !== '0%') {
          const val = el.textContent;
          animateNumber(el, val);
        }
      });
    }, 800);
  },

  setupWelcome: function() {
    const h = new Date().getHours();
    let msg = '🌙 Good Night';
    if (h >= 5 && h < 12) msg = '🌅 Good Morning';
    else if (h >= 12 && h < 17) msg = '☀️ Good Afternoon';
    else if (h >= 17 && h < 21) msg = '🌇 Good Evening';
    this.setText('welcomeMsg', msg + '!');
    this.setText('heroSubtext', fmtDateFull(today()));
  },

  loadSummary: function(all) {
    const txns = filterByPeriod(all, this.period);
    const t = calcTotals(txns);
    const allT = calcTotals(all);
    this.setText('pIncome', inr(t.income));
    this.setText('pExpense', inr(t.expense));
    this.setText('pProfit', inr(t.profit));
    this.setText('totalBal', inr(allT.profit));
    this.setText('totalCount', all.length + ' records');
    let iC = 0, eC = 0;
    for (let i = 0; i < txns.length; i++) {
      if (txns[i].type === 'income') iC++;
      else if (txns[i].type === 'expense') eC++;
    }
    this.setText('pIncomeCount', iC + ' income');
    this.setText('pExpenseCount', eC + ' expense');
    const margin = t.income > 0 ? Math.round((t.profit / t.income) * 100) : 0;
    this.setText('pMargin', margin + '% profit margin');
    this.updateTrends(all, this.period);

    // Update subtext based on period
    this.updatePeriodLabel();
  },

  // NEW: Show what period is being viewed
  updatePeriodLabel: function() {
    const labels = {
      'today': "📅 Today's Financial Summary",
      'yesterday': "📅 Yesterday's Financial Summary",
      'week': "📅 This Week's Summary",
      'month': "📅 This Month's Summary",
      'year': "📅 This Year's Summary",
      'all': "📅 All Time Summary"
    };
    const subtitleEl = document.getElementById('heroSubtext');
    if (subtitleEl) {
      const periodLabel = labels[this.period] || labels.month;
      subtitleEl.textContent = periodLabel;
    }
  },

  loadCashOnline: function(all) {
    let cashIn = 0, cashInCount = 0, cashOut = 0, cashOutCount = 0;
    let onlineIn = 0, onlineInCount = 0, onlineOut = 0, onlineOutCount = 0;
    const cashModes = ['Cash'];
    const onlineModes = ['Online', 'UPI', 'Bank Transfer', 'Card', 'Cheque'];
    for (let i = 0; i < all.length; i++) {
      const t = all[i];
      const amt = parseFloat(t.amount) || 0;
      const mode = t.mode || 'Cash';
      if (cashModes.indexOf(mode) > -1) {
        if (t.type === 'income') { cashIn += amt; cashInCount++; }
        else if (t.type === 'expense') { cashOut += amt; cashOutCount++; }
      } else if (onlineModes.indexOf(mode) > -1) {
        if (t.type === 'income') { onlineIn += amt; onlineInCount++; }
        else if (t.type === 'expense') { onlineOut += amt; onlineOutCount++; }
      }
    }
    const cashBalance = cashIn - cashOut;
    const onlineBalance = onlineIn - onlineOut;
    this.setText('cashIn', inr(cashIn));
    this.setText('cashOut', inr(cashOut));
    this.setText('cashBalance', inr(cashBalance));
    this.setText('cashInCount', cashInCount + ' transaction' + (cashInCount !== 1 ? 's' : ''));
    this.setText('cashOutCount', cashOutCount + ' transaction' + (cashOutCount !== 1 ? 's' : ''));
    this.setText('onlineIn', inr(onlineIn));
    this.setText('onlineOut', inr(onlineOut));
    this.setText('onlineBalance', inr(onlineBalance));
    this.setText('onlineInCount', onlineInCount + ' transaction' + (onlineInCount !== 1 ? 's' : ''));
    this.setText('onlineOutCount', onlineOutCount + ' transaction' + (onlineOutCount !== 1 ? 's' : ''));
    const cashBalEl = document.getElementById('cashBalance');
    if (cashBalEl) cashBalEl.classList.toggle('negative', cashBalance < 0);
    const onlineBalEl = document.getElementById('onlineBalance');
    if (onlineBalEl) onlineBalEl.classList.toggle('negative', onlineBalance < 0);
  },

  // UPDATED: Better trend logic for Yesterday
  updateTrends: function(all, period) {
    let prevPeriod = null;
    if (period === 'today') prevPeriod = 'yesterday';
    else if (period === 'week') prevPeriod = 'lastweek';
    else if (period === 'month') prevPeriod = 'lastmonth';
    else if (period === 'yesterday') {
      // For yesterday, compare with day before yesterday (2 days ago)
      // We'll show trends but they'll require custom logic
      prevPeriod = null;
    }

    const cur = calcTotals(filterByPeriod(all, period));
    let iTrend = 0, eTrend = 0, pTrend = 0;

    if (prevPeriod) {
      const prev = calcTotals(filterByPeriod(all, prevPeriod));
      iTrend = this.calcTrend(cur.income, prev.income);
      eTrend = this.calcTrend(cur.expense, prev.expense);
      pTrend = this.calcTrend(cur.profit, prev.profit);
    } else if (period === 'yesterday') {
      // Special case: Compare Yesterday with Day before yesterday
      const dayBefore = this.getDayBeforeYesterdayTxns(all);
      const prev = calcTotals(dayBefore);
      iTrend = this.calcTrend(cur.income, prev.income);
      eTrend = this.calcTrend(cur.expense, prev.expense);
      pTrend = this.calcTrend(cur.profit, prev.profit);
    }

    this.setTrend('incomeTrend', iTrend);
    this.setTrend('expenseTrend', eTrend);
    this.setTrend('profitTrend', pTrend);
  },

  // NEW: Get day before yesterday transactions
  getDayBeforeYesterdayTxns: function(all) {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    const dateStr = d.toISOString().split('T')[0];
    return all.filter(t => t.date === dateStr);
  },

  calcTrend: function(cur, prev) {
    if (prev > 0) return Math.round(((cur - prev) / prev) * 100);
    if (cur > 0) return 100;
    return 0;
  },

  setTrend: function(id, val) {
    const el = document.getElementById(id);
    if (!el) return;
    const arrow = val > 0 ? '↑' : val < 0 ? '↓' : '→';
    const display = Math.abs(val) > 999 ? '999+' : Math.abs(val);
    el.textContent = arrow + ' ' + display + '%';
  },

  loadAnalytics: function(all) {
    if (!all.length) {
      this.setText('msAvgIncome', '₹ 0');
      this.setText('msAvgExpense', '₹ 0');
      this.setText('msSavings', '0%');
      this.setText('msIncomeDays', 'No data yet');
      this.setText('msExpenseDays', 'No data yet');
      this.setText('msSavingsSub', 'Start adding data');
      return;
    }
    const daySet = new Set();
    for (let i = 0; i < all.length; i++) daySet.add(all[i].date);
    const numDays = Math.max(daySet.size, 1);
    const tot = calcTotals(all);
    const avgIncome = tot.income / numDays;
    const avgExpense = tot.expense / numDays;
    const savingsRate = tot.income > 0 ? Math.round((tot.profit / tot.income) * 100) : 0;
    this.setText('msAvgIncome', inr(avgIncome));
    this.setText('msAvgExpense', inr(avgExpense));
    this.setText('msSavings', savingsRate + '%');
    const dayLabel = numDays === 1 ? 'day' : 'days';
    this.setText('msIncomeDays', 'Across ' + numDays + ' active ' + dayLabel);
    this.setText('msExpenseDays', 'Across ' + numDays + ' active ' + dayLabel);
    let sub = '❌ Loss';
    if (savingsRate >= 30) sub = '🎉 Excellent!';
    else if (savingsRate >= 20) sub = '💪 Great!';
    else if (savingsRate >= 10) sub = '👍 Good';
    else if (savingsRate > 0) sub = '⚠️ Improve';
    this.setText('msSavingsSub', sub);
    const maxAvg = Math.max(avgIncome, avgExpense, 1);
    this.setBarWidth('msIncomeBar', (avgIncome / maxAvg) * 100);
    this.setBarWidth('msExpenseBar', (avgExpense / maxAvg) * 100);
    this.setBarWidth('msSavingsBar', Math.max(0, savingsRate));
  },

  setBarWidth: function(id, percent) {
    const bar = document.getElementById(id);
    if (bar) {
      setTimeout(() => {
        bar.style.width = Math.min(Math.max(percent, 0), 100) + '%';
      }, 300);
    }
  },

  loadInsights: function(all) {
    const box = document.getElementById('insightsBox');
    if (!box) return;
    const insights = [];
    if (!all.length) {
      insights.push({ type: 'info', icon: '💡', text: 'Add your first transaction to get personalized insights!' });
    } else {
      const tot = calcTotals(all);
      const monthT = calcTotals(filterByPeriod(all, 'month'));
      const lastMonthT = calcTotals(filterByPeriod(all, 'lastmonth'));
      const todayT = calcTotals(filterByPeriod(all, 'today'));
      const yesterdayT = calcTotals(filterByPeriod(all, 'yesterday'));

      if (tot.profit > 0) {
        insights.push({ type: 'success', icon: '💰', text: "You're in <strong>profit</strong> of " + inr(tot.profit) });
      } else if (tot.profit < 0) {
        insights.push({ type: 'danger', icon: '⚠️', text: "You're in <strong>loss</strong> by " + inr(Math.abs(tot.profit)) });
      }

      // NEW: Yesterday vs Today insight
      if (yesterdayT.profit !== 0 && todayT.profit !== 0) {
        const diff = todayT.profit - yesterdayT.profit;
        if (diff > 0) {
          insights.push({
            type: 'success',
            icon: '📈',
            text: 'Today is <strong>' + inr(diff) + ' better</strong> than yesterday!'
          });
        } else if (diff < 0) {
          insights.push({
            type: 'warn',
            icon: '📉',
            text: 'Today is <strong>' + inr(Math.abs(diff)) + ' less</strong> than yesterday'
          });
        }
      }

      if (lastMonthT.expense > 0) {
        const diff = monthT.expense - lastMonthT.expense;
        const pct = Math.abs(Math.round((diff / lastMonthT.expense) * 100));
        if (diff > 0 && pct >= 10) {
          insights.push({ type: 'warn', icon: '📈', text: 'Expenses are <strong>' + pct + '% higher</strong> than last month' });
        } else if (diff < 0 && pct >= 10) {
          insights.push({ type: 'success', icon: '📉', text: 'Expenses are <strong>' + pct + '% lower</strong> than last month' });
        }
      }

      const expenses = all.filter(t => t.type === 'expense');
      if (expenses.length) {
        const grouped = {};
        for (let i = 0; i < expenses.length; i++) {
          const t = expenses[i];
          grouped[t.category] = (grouped[t.category] || 0) + parseFloat(t.amount || 0);
        }
        const sorted = Object.entries(grouped).sort((a, b) => b[1] - a[1]);
        if (sorted.length) {
          insights.push({ type: 'info', icon: '🎯', text: 'Biggest expense: <strong>' + escapeHtml(sorted[0][0]) + '</strong> (' + inr(sorted[0][1]) + ')' });
        }
      }
    }
    box.innerHTML = insights.slice(0, 4).map(i =>
      '<div class="insight-item ' + i.type + '"><span class="insight-icon">' + i.icon + '</span><div class="insight-text">' + i.text + '</div></div>'
    ).join('');
  },

  loadComparison: function(all) {
    const thisM = calcTotals(filterByPeriod(all, 'month'));
    const lastM = calcTotals(filterByPeriod(all, 'lastmonth'));
    this.setText('cmpLast', inr(lastM.profit));
    this.setText('cmpThis', inr(thisM.profit));
    const arrow = document.getElementById('cmpArrow');
    if (!arrow) return;
    if (lastM.profit === 0 && thisM.profit === 0) {
      arrow.className = 'compare-arrow neutral';
      arrow.textContent = '→ No data';
    } else if (lastM.profit === 0) {
      arrow.className = 'compare-arrow up';
      arrow.textContent = '↑ New this month';
    } else {
      const diff = thisM.profit - lastM.profit;
      const pct = Math.round((diff / Math.abs(lastM.profit)) * 100);
      const isUp = diff >= 0;
      arrow.className = 'compare-arrow ' + (isUp ? 'up' : 'down');
      arrow.textContent = (isUp ? '↑' : '↓') + ' ' + Math.abs(pct) + '% vs last month';
    }
  },

  loadTopCategories: function(all) {
    const box = document.getElementById('topCatBox');
    if (!box) return;
    const expenses = all.filter(t => t.type === 'expense');
    if (!expenses.length) {
      box.innerHTML = '<div class="empty"><p>No expense data yet</p></div>';
      return;
    }
    const grouped = {};
    for (let i = 0; i < expenses.length; i++) {
      const t = expenses[i];
      grouped[t.category] = (grouped[t.category] || 0) + parseFloat(t.amount || 0);
    }
    const sorted = Object.entries(grouped).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const max = sorted[0][1];
    box.innerHTML = sorted.map((item, i) => {
      const cat = item[0], amt = item[1];
      const width = (amt / max) * 100;
      const rankClass = i < 3 ? 'r' + (i + 1) : '';
      return '<div class="tc-item"><div class="tc-rank ' + rankClass + '">' + (i + 1) + '</div><div class="tc-info"><div class="tc-name">' + escapeHtml(cat) + '</div><div class="tc-bar"><div class="tc-fill" style="width:0%"></div></div></div><div class="tc-amt">' + inrShort(amt) + '</div></div>';
    }).join('');

    setTimeout(() => {
      const fills = box.querySelectorAll('.tc-fill');
      sorted.forEach((item, i) => {
        if (fills[i]) fills[i].style.width = ((item[1] / max) * 100) + '%';
      });
    }, 300);
  },

  loadPaymentModes: function(all) {
    const box = document.getElementById('payModeBox');
    if (!box) return;
    if (!all.length) {
      box.innerHTML = '<div class="empty"><p>No data yet</p></div>';
      return;
    }
    const grouped = {};
    for (let i = 0; i < all.length; i++) {
      const t = all[i];
      const mode = t.mode || 'Cash';
      if (!grouped[mode]) grouped[mode] = { total: 0, count: 0 };
      grouped[mode].total += parseFloat(t.amount || 0);
      grouped[mode].count++;
    }
    const total = Object.values(grouped).reduce((s, x) => s + x.total, 0);
    const sorted = Object.entries(grouped).sort((a, b) => b[1].total - a[1].total);
    const icons = { 'Cash':'💵', 'Online':'📱', 'UPI':'📲', 'Bank Transfer':'🏦', 'Card':'💳', 'Cheque':'📄' };
    box.innerHTML = sorted.map(item => {
      const mode = item[0], data = item[1];
      const pct = total > 0 ? Math.round((data.total / total) * 100) : 0;
      const icon = icons[mode] || '💰';
      return '<div class="pm-item"><div class="pm-ic">' + icon + '</div><div class="pm-info"><div class="pm-name">' + escapeHtml(mode) + '</div><div class="pm-sub">' + data.count + ' transactions</div></div><div><div class="pm-amt">' + inrShort(data.total) + '</div><div class="pm-pct">' + pct + '%</div></div></div>';
    }).join('');
  },

  loadRecent: function(all) {
    const tbody = document.getElementById('recentBody');
    if (!tbody) return;
    if (!all.length) {
      tbody.innerHTML = '<tr><td colspan="5"><div class="empty"><div class="empty-icon">📋</div><h4>No transactions yet</h4></div></td></tr>';
      return;
    }
    const sorted = all.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);
    tbody.innerHTML = sorted.map(t => {
      const isI = t.type === 'income';
      return '<tr><td style="font-size:0.82rem;">' + fmtDate(t.date) + '</td><td><span class="badge ' + (isI ? 'badge-in' : 'badge-out') + '">' + (isI ? '💰 In' : '💸 Out') + '</span></td><td style="font-size:0.82rem;font-weight:600;">' + escapeHtml(t.category || '-') + '</td><td class="' + (isI ? 'amt-in' : 'amt-out') + '">' + (isI ? '+' : '-') + inrShort(t.amount) + '</td><td style="font-size:0.78rem;color:var(--text-muted);">' + escapeHtml(t.mode || 'Cash') + '</td></tr>';
    }).join('');
  },

  setupYearSelector: function() {
    const sel = document.getElementById('chartYear');
    if (!sel || sel.options.length > 0) return;
    const cur = new Date().getFullYear();
    for (let y = cur; y >= cur - 4; y--) {
      const o = document.createElement('option');
      o.value = y;
      o.textContent = y;
      if (y === cur) o.selected = true;
      sel.appendChild(o);
    }
  },

  buildBarChart: function(all) {
    const canvas = document.getElementById('barChart');
    if (!canvas || typeof Chart === 'undefined') return;
    const year = parseInt(document.getElementById('chartYear') ? document.getElementById('chartYear').value : new Date().getFullYear());
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const income = new Array(12).fill(0);
    const expense = new Array(12).fill(0);
    for (let i = 0; i < all.length; i++) {
      const t = all[i];
      const d = new Date(t.date);
      if (d.getFullYear() !== year) continue;
      const m = d.getMonth();
      const a = parseFloat(t.amount) || 0;
      if (t.type === 'income') income[m] += a;
      else if (t.type === 'expense') expense[m] += a;
    }
    if (this.charts.bar) this.charts.bar.destroy();
    this.charts.bar = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [
          { label: 'Income', data: income, backgroundColor: 'rgba(16,185,129,0.85)', borderRadius: 8 },
          { label: 'Expense', data: expense, backgroundColor: 'rgba(239,68,68,0.85)', borderRadius: 8 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 1500, easing: 'easeOutQuart' },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', align: 'end', labels: { usePointStyle: true, pointStyle: 'circle', font: { size: 12, weight: '600' }, padding: 16, color: '#312e81' } },
          tooltip: {
            backgroundColor: '#1e1b4b', titleColor: '#fff', bodyColor: '#c7d2fe',
            padding: 14, cornerRadius: 12, borderColor: '#6366f1', borderWidth: 1,
            callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + inr(ctx.parsed.y) }
          }
        },
        scales: {
          x: { grid: { display: false }, border: { display: false }, ticks: { color: '#6366f1', font: { size: 11, weight: '600' } } },
          y: { beginAtZero: true, grid: { color: 'rgba(99,102,241,0.08)' }, border: { display: false }, ticks: { color: '#6366f1', font: { size: 11, weight: '600' }, callback: v => inrShort(v) } }
        }
      }
    });
  },

  buildDonutChart: function(all) {
    const canvas = document.getElementById('donutChart');
    if (!canvas || typeof Chart === 'undefined') return;
    const period = document.getElementById('donutPeriod') ? document.getElementById('donutPeriod').value : 'month';
    const txns = filterByPeriod(all, period).filter(t => t.type === 'expense');
    const grouped = {};
    for (let i = 0; i < txns.length; i++) {
      const t = txns[i];
      grouped[t.category] = (grouped[t.category] || 0) + parseFloat(t.amount || 0);
    }
    const labels = Object.keys(grouped);
    const values = Object.values(grouped);
    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#0ea5e9', '#ef4444', '#84cc16', '#f97316', '#a855f7', '#14b8a6', '#eab308'];
    if (this.charts.donut) this.charts.donut.destroy();
    if (!labels.length) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const legend = document.getElementById('donutLegend');
      if (legend) legend.innerHTML = '<div class="empty" style="padding:24px;"><p>No expense data</p></div>';
      return;
    }
    this.charts.donut = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: colors.slice(0, labels.length),
          borderWidth: 4, borderColor: '#fff', hoverBorderWidth: 5, hoverOffset: 12
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '70%',
        animation: { duration: 1500, easing: 'easeOutQuart', animateRotate: true, animateScale: true },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1e1b4b', titleColor: '#fff', bodyColor: '#c7d2fe',
            padding: 14, cornerRadius: 12, borderColor: '#6366f1', borderWidth: 1,
            callbacks: {
              label: function(ctx) {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct = Math.round((ctx.parsed / total) * 100);
                return ' ' + inr(ctx.parsed) + ' (' + pct + '%)';
              }
            }
          }
        }
      }
    });
    const total = values.reduce((a, b) => a + b, 0);
    const legend = document.getElementById('donutLegend');
    if (legend) {
      legend.innerHTML = labels.map((l, i) =>
        '<div class="leg-row"><div class="leg-dot" style="background:' + colors[i] + '"></div><span class="leg-name">' + escapeHtml(l) + '</span><span class="leg-val">' + inrShort(values[i]) + '</span><span class="leg-pct">' + Math.round((values[i] / total) * 100) + '%</span></div>'
      ).join('');
    }
  },

  buildLineChart: function(all) {
    const canvas = document.getElementById('lineChart');
    if (!canvas || typeof Chart === 'undefined') return;
    const days = 30;
    const labels = [];
    const income = [];
    const expense = [];
    const now = new Date();
    const dateMap = {};
    for (let i = 0; i < all.length; i++) {
      const t = all[i];
      if (!dateMap[t.date]) dateMap[t.date] = { income: 0, expense: 0 };
      const amt = parseFloat(t.amount || 0);
      if (t.type === 'income') dateMap[t.date].income += amt;
      else if (t.type === 'expense') dateMap[t.date].expense += amt;
    }
    let totalIncome = 0, totalExpense = 0;
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      labels.push(d.getDate() + '/' + (d.getMonth() + 1));
      const dayData = dateMap[ds] || { income: 0, expense: 0 };
      income.push(dayData.income);
      expense.push(dayData.expense);
      totalIncome += dayData.income;
      totalExpense += dayData.expense;
    }
    this.setText('lineIncomeTotal', inr(totalIncome));
    this.setText('lineExpenseTotal', inr(totalExpense));
    this.setText('lineNetTotal', inr(totalIncome - totalExpense));
    if (this.charts.line) this.charts.line.destroy();
    const ctx = canvas.getContext('2d');
    const g1 = ctx.createLinearGradient(0, 0, 0, 280);
    g1.addColorStop(0, 'rgba(16,185,129,0.35)');
    g1.addColorStop(1, 'rgba(16,185,129,0)');
    const g2 = ctx.createLinearGradient(0, 0, 0, 280);
    g2.addColorStop(0, 'rgba(239,68,68,0.35)');
    g2.addColorStop(1, 'rgba(239,68,68,0)');
    this.charts.line = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Income', data: income,
            borderColor: '#10b981', backgroundColor: g1,
            borderWidth: 3, pointRadius: 0, pointHoverRadius: 8,
            pointBackgroundColor: '#10b981', pointBorderColor: '#fff', pointBorderWidth: 3,
            fill: true, tension: 0.4
          },
          {
            label: 'Expense', data: expense,
            borderColor: '#ef4444', backgroundColor: g2,
            borderWidth: 3, pointRadius: 0, pointHoverRadius: 8,
            pointBackgroundColor: '#ef4444', pointBorderColor: '#fff', pointBorderWidth: 3,
            fill: true, tension: 0.4
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 2000, easing: 'easeOutQuart' },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1e1b4b', titleColor: '#fff', bodyColor: '#c7d2fe',
            padding: 14, cornerRadius: 12, borderColor: '#6366f1', borderWidth: 1,
            callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + inr(ctx.parsed.y) }
          }
        },
        scales: {
          x: { grid: { display: false }, border: { display: false }, ticks: { color: '#6366f1', font: { size: 10, weight: '600' }, maxRotation: 0 } },
          y: { beginAtZero: true, grid: { color: 'rgba(99,102,241,0.08)' }, border: { display: false }, ticks: { color: '#6366f1', font: { size: 11, weight: '600' }, callback: v => inrShort(v) } }
        }
      }
    });
  },

  setupSearch: function() {
    const input = document.getElementById('headerSearch');
    if (!input) return;
    const self = this;
    const handler = debounce(function(e) {
      const q = e.target.value.trim().toLowerCase();
      const all = getTxns();
      if (!q) { self.loadRecent(all); return; }
      const results = all.filter(t =>
        (t.category || '').toLowerCase().indexOf(q) > -1 ||
        (t.notes || '').toLowerCase().indexOf(q) > -1 ||
        (t.from || '').toLowerCase().indexOf(q) > -1 ||
        (t.vendor || '').toLowerCase().indexOf(q) > -1 ||
        String(t.amount).indexOf(q) > -1
      ).slice(0, 8);
      const tbody = document.getElementById('recentBody');
      if (!tbody) return;
      if (!results.length) {
        tbody.innerHTML = '<tr><td colspan="5"><div class="empty"><div class="empty-icon">🔍</div><h4>No results</h4></div></td></tr>';
        return;
      }
      tbody.innerHTML = results.map(t => {
        const isI = t.type === 'income';
        return '<tr><td style="font-size:0.82rem;">' + fmtDate(t.date) + '</td><td><span class="badge ' + (isI ? 'badge-in' : 'badge-out') + '">' + (isI ? '💰 In' : '💸 Out') + '</span></td><td style="font-size:0.82rem;font-weight:600;">' + escapeHtml(t.category || '-') + '</td><td class="' + (isI ? 'amt-in' : 'amt-out') + '">' + (isI ? '+' : '-') + inrShort(t.amount) + '</td><td style="font-size:0.78rem;color:var(--text-muted);">' + escapeHtml(t.mode || 'Cash') + '</td></tr>';
      }).join('');
    }, 300);
    input.addEventListener('input', handler);
  },

  setText: function(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }
};

// GLOBAL
function switchPeriod(p, btn) {
  Dash.period = p;
  const tabs = document.querySelectorAll('.pb-tab');
  for (let i = 0; i < tabs.length; i++) tabs[i].classList.remove('active');
  if (btn) btn.classList.add('active');
  Dash.loadSummary(getTxns());
  setTimeout(() => Dash.animateNumbers(), 100);
}

function buildBarChart() { Dash.buildBarChart(getTxns()); }
function buildDonutChart() { Dash.buildDonutChart(getTxns()); }

async function saveTransaction(type) {
  const isI = type === 'income';
  const date = document.getElementById(isI ? 'iDate' : 'eDate').value.trim();
  const cat = document.getElementById(isI ? 'iCat' : 'eCat').value.trim();
  const amt = document.getElementById(isI ? 'iAmt' : 'eAmt').value.trim();
  const mode = document.getElementById(isI ? 'iMode' : 'eMode').value || 'Cash';
  const from = isI ? document.getElementById('iFrom').value.trim() : '';
  const vendor = !isI ? document.getElementById('eVendor').value.trim() : '';
  const notes = document.getElementById(isI ? 'iNote' : 'eNote').value.trim();
  const editId = document.getElementById(isI ? 'iEditId' : 'eEditId').value.trim();

  if (!date) { toast('Please select a date', 'error'); return; }
  if (!cat) { toast('Please select a category', 'error'); return; }
  const amount = parseFloat(amt);
  if (!amount || amount <= 0 || isNaN(amount)) {
    toast('Please enter a valid amount', 'error');
    return;
  }

  const entry = {
    id: editId || uid(),
    type, date, category: cat, amount, mode, from, vendor, notes,
    savedAt: new Date().toISOString()
  };

  // Save to Firebase
  if (editId) {
    await updateTxnInFirebase(editId, entry);
  } else {
    await saveTxnToFirebase(entry);
  }

  closeModal(isI ? 'incomeModal' : 'expenseModal');
  resetForm(type);
  const action = editId ? 'Updated' : 'Added';
  toast(action + ' ' + type + ' of ' + inr(amount) + ' ✅', 'success');
}

function resetForm(type) {
  const isI = type === 'income';
  const setVal = (id, val) => {
    const el = document.getElementById(id);
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
}

function openIncomeModal() {
  resetForm('income');
  const d = document.getElementById('iDate');
  if (d) d.value = today();
  openModal('incomeModal');
}

function openExpenseModal() {
  resetForm('expense');
  const d = document.getElementById('eDate');
  if (d) d.value = today();
  openModal('expenseModal');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Dash.init());
} else {
  Dash.init();
}