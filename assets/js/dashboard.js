/* ============================================
   AI TOOLCOR — DASHBOARD.JS (v2.0)
   Advanced Analytics & Reactive Dashboard
   business.aitoolcor.com
   ============================================ */

'use strict';

// ============================================
// DASHBOARD MODULE
// ============================================
const Dashboard = {

  // ===== State =====
  state: {
    period: 'month',
    year: new Date().getFullYear(),
    donutPeriod: 'month',
    isLoading: false,
    refreshTimer: null
  },

  // ===== Chart instances =====
  charts: {
    bar: null,
    donut: null,
    line: null
  },

  // ===== Color palette =====
  colors: {
    income: '#10b981',
    incomeSoft: 'rgba(16,185,129,0.85)',
    incomeGrad: 'rgba(16,185,129,0.25)',
    expense: '#f43f5e',
    expenseSoft: 'rgba(244,63,94,0.85)',
    expenseGrad: 'rgba(244,63,94,0.25)',
    profit: '#f59e0b',
    brand: '#06b6d4',
    palette: [
      '#06b6d4', '#f43f5e', '#fbbf24', '#10b981',
      '#8b5cf6', '#3b82f6', '#ec4899', '#84cc16',
      '#f97316', '#6366f1', '#14b8a6', '#fb923c',
      '#a855f7', '#0ea5e9', '#eab308', '#22c55e'
    ]
  },

  // ===== Icons =====
  icons: {
    payment: {
      'Cash': '💵',
      'Online': '📱',
      'UPI': '📲',
      'Bank Transfer': '🏦',
      'Card': '💳',
      'Cheque': '📄',
      'Other': '💰'
    }
  },

  // ============================================
  // INITIALIZATION
  // ============================================
  init() {
    if (this.state.isLoading) return;

    try {
      this.setupWelcome();
      this.setupYearSelector();
      this.loadAll();
      this.setupSearch();
      this.setupPeriodTabs();
      this.setupAutoRefresh();
      this.subscribeToStorage();

      console.log('%c📊 Dashboard initialized',
        'color:#06b6d4;font-weight:bold;');
    } catch (err) {
      console.error('Dashboard init error:', err);
      toast('Failed to load dashboard', 'error');
    }
  },

  // Reactive: reload when data changes
  subscribeToStorage() {
    if (typeof Store !== 'undefined' && Store.subscribe) {
      Store.subscribe(() => {
        this.loadAll();
      });
    }
  },

  // Auto-refresh every 60 seconds (for date-based data)
  setupAutoRefresh() {
    if (this.state.refreshTimer) clearInterval(this.state.refreshTimer);

    this.state.refreshTimer = setInterval(() => {
      if (!document.hidden) {
        this.setupWelcome();
      }
    }, 60000);
  },

  // ============================================
  // LOAD ALL SECTIONS
  // ============================================
  loadAll() {
    if (this.state.isLoading) return;
    this.state.isLoading = true;

    try {
      const all = getTxns();

      // Use requestAnimationFrame for smooth rendering
      requestAnimationFrame(() => {
        this.loadSummary(all);
        this.loadAnalytics(all);
        this.loadInsights(all);
        this.loadComparison(all);
        this.loadTopCategories(all);
        this.loadPaymentModes(all);
        this.loadRecent(all);
      });

      // Charts in next frame (heavier work)
      requestAnimationFrame(() => {
        this.buildBarChart(all);
        this.buildDonutChart(all);
        this.buildLineChart(all);
        this.state.isLoading = false;
      });
    } catch (err) {
      console.error('Dashboard load error:', err);
      this.state.isLoading = false;
    }
  },

  // ============================================
  // WELCOME MESSAGE
  // ============================================
  setupWelcome() {
    const h = new Date().getHours();
    const user = localStorage.getItem('bd_user') || '';
    const userName = user.split('@')[0].replace(/[^a-z]/gi, '') || 'there';
    const capitalizedName = userName.charAt(0).toUpperCase() + userName.slice(1);

    let msg, emoji;
    if (h >= 5 && h < 12) { msg = 'Good Morning'; emoji = '🌅'; }
    else if (h >= 12 && h < 17) { msg = 'Good Afternoon'; emoji = '☀️'; }
    else if (h >= 17 && h < 21) { msg = 'Good Evening'; emoji = '🌇'; }
    else { msg = 'Good Night'; emoji = '🌙'; }

    setText('welcomeMsg', `${emoji} ${msg}, ${capitalizedName}!`);
    setText('heroSubtext', DateUtil.formatFull(DateUtil.today()));
  },

  // ============================================
  // SUMMARY CARDS
  // ============================================
  loadSummary(all) {
    const period = this.state.period;
    const txns = filterByPeriod(all, period);
    const t = calcTotals(txns);
    const allT = calcTotals(all);

    setText('pIncome', inr(t.income));
    setText('pExpense', inr(t.expense));
    setText('pProfit', inr(t.profit));
    setText('totalBal', inr(allT.profit));
    setText('totalCount', `${all.length} record${all.length !== 1 ? 's' : ''}`);

    // Count by type
    let iC = 0, eC = 0;
    for (let i = 0; i < txns.length; i++) {
      if (txns[i].type === 'income') iC++;
      else if (txns[i].type === 'expense') eC++;
    }
    setText('pIncomeCount', `${iC} income`);
    setText('pExpenseCount', `${eC} expense`);

    // Margin
    const margin = t.income > 0
      ? Math.round((t.profit / t.income) * 100)
      : 0;
    setText('pMargin', `${margin}% profit margin`);

    // Update trends
    this.updateTrends(all, period);

    // Dynamic profit color
    const pEl = el('pProfit');
    if (pEl) {
      pEl.className = 'sc-value ' +
        (t.profit >= 0 ? 'text-profit' : 'text-expense');
    }

    // Balance color based on positive/negative
    const balEl = el('totalBal');
    if (balEl) {
      balEl.className = 'sc-value ' +
        (allT.profit >= 0 ? 'text-brand' : 'text-expense');
    }
  },

  // ============================================
  // TRENDS (vs Previous Period)
  // ============================================
  updateTrends(all, period) {
    const prevMap = {
      today: 'yesterday',
      week: 'lastweek',
      month: 'lastmonth'
    };
    const prevPeriod = prevMap[period];

    const cur = calcTotals(filterByPeriod(all, period));
    let iTrend = 0, eTrend = 0, pTrend = 0;

    if (prevPeriod) {
      const prev = calcTotals(filterByPeriod(all, prevPeriod));

      iTrend = this.calcTrend(cur.income, prev.income);
      eTrend = this.calcTrend(cur.expense, prev.expense);
      pTrend = this.calcProfitTrend(cur.profit, prev.profit);
    }

    this.setTrend('incomeTrend', iTrend, true);
    this.setTrend('expenseTrend', eTrend, false);
    this.setTrend('profitTrend', pTrend, true);
  },

  calcTrend(cur, prev) {
    if (prev > 0) return Math.round(((cur - prev) / prev) * 100);
    if (cur > 0) return 100;
    return 0;
  },

  calcProfitTrend(cur, prev) {
    if (prev !== 0) return Math.round(((cur - prev) / Math.abs(prev)) * 100);
    if (cur > 0) return 100;
    if (cur < 0) return -100;
    return 0;
  },

  setTrend(id, val, higherIsBetter) {
    const target = el(id);
    if (!target) return;

    let arrow, cls;
    if (val === 0) {
      arrow = '→'; cls = 'neutral';
    } else if (val > 0) {
      arrow = '↑'; cls = higherIsBetter ? 'up' : 'down';
    } else {
      arrow = '↓'; cls = higherIsBetter ? 'down' : 'up';
    }

    // Cap display at 999%
    const display = Math.abs(val) > 999 ? '999+' : Math.abs(val);

    target.className = 'sc-trend ' + cls;
    target.textContent = `${arrow} ${display}%`;
    target.title = `${val > 0 ? '+' : ''}${val}% vs previous period`;
  },

  // ============================================
  // ANALYTICS (Avg + Savings)
  // ============================================
  loadAnalytics(all) {
    if (!all.length) {
      setText('msAvgIncome', inr(0));
      setText('msAvgExpense', inr(0));
      setText('msSavings', '0%');
      setText('msIncomeDays', 'No data yet');
      setText('msExpenseDays', 'No data yet');
      setText('msSavingsSub', 'Start adding data');
      this.setBarWidth('msIncomeBar', 0);
      this.setBarWidth('msExpenseBar', 0);
      this.setBarWidth('msSavingsBar', 0);
      return;
    }

    // Unique active days
    const daySet = new Set();
    for (let i = 0; i < all.length; i++) {
      daySet.add(all[i].date);
    }
    const numDays = Math.max(daySet.size, 1);

    const tot = calcTotals(all);
    const avgIncome = tot.income / numDays;
    const avgExpense = tot.expense / numDays;
    const savingsRate = tot.income > 0
      ? Math.round((tot.profit / tot.income) * 100)
      : 0;

    setText('msAvgIncome', inr(avgIncome));
    setText('msAvgExpense', inr(avgExpense));
    setText('msSavings', savingsRate + '%');

    const dayLabel = numDays === 1 ? 'day' : 'days';
    setText('msIncomeDays', `Across ${numDays} active ${dayLabel}`);
    setText('msExpenseDays', `Across ${numDays} active ${dayLabel}`);

    // Savings label
    let savingsSub;
    if (savingsRate >= 30) savingsSub = '🎉 Excellent!';
    else if (savingsRate >= 20) savingsSub = '💪 Great!';
    else if (savingsRate >= 10) savingsSub = '👍 Good';
    else if (savingsRate > 0) savingsSub = '⚠️ Improve';
    else savingsSub = '❌ Loss';
    setText('msSavingsSub', savingsSub);

    // Progress bars
    const maxAvg = Math.max(avgIncome, avgExpense, 1);
    this.setBarWidth('msIncomeBar', (avgIncome / maxAvg) * 100);
    this.setBarWidth('msExpenseBar', (avgExpense / maxAvg) * 100);
    this.setBarWidth('msSavingsBar', Math.max(0, savingsRate));
  },

  setBarWidth(id, percent) {
    const bar = el(id);
    if (bar) {
      bar.style.width = Math.min(Math.max(percent, 0), 100) + '%';
    }
  },

  // ============================================
  // SMART INSIGHTS
  // ============================================
  loadInsights(all) {
    const box = el('insightsBox');
    if (!box) return;

    const insights = [];

    if (!all.length) {
      insights.push({
        type: 'info',
        icon: '💡',
        text: 'Add your first transaction to get personalized insights!'
      });
    } else {
      const tot = calcTotals(all);
      const monthT = calcTotals(filterByPeriod(all, 'month'));
      const lastMonthT = calcTotals(filterByPeriod(all, 'lastmonth'));
      const weekT = calcTotals(filterByPeriod(all, 'week'));

      // 1. Overall profit/loss
      if (tot.profit > 0) {
        insights.push({
          type: 'success',
          icon: '💰',
          text: `Great! You're in <strong>profit</strong> of ${inr(tot.profit)}`
        });
      } else if (tot.profit < 0) {
        insights.push({
          type: 'danger',
          icon: '⚠️',
          text: `You're in <strong>loss</strong> by ${inr(Math.abs(tot.profit))}. Consider reducing expenses.`
        });
      }

      // 2. Month-to-month expense comparison
      if (lastMonthT.expense > 0) {
        const diff = monthT.expense - lastMonthT.expense;
        const pct = Math.abs(Math.round((diff / lastMonthT.expense) * 100));

        if (diff > 0 && pct >= 10) {
          insights.push({
            type: 'warn',
            icon: '📈',
            text: `Expenses are <strong>${pct}% higher</strong> than last month`
          });
        } else if (diff < 0 && pct >= 10) {
          insights.push({
            type: 'success',
            icon: '📉',
            text: `Expenses are <strong>${pct}% lower</strong> than last month. 👏`
          });
        }
      }

      // 3. Biggest expense category
      const expenses = all.filter(t => t.type === 'expense');
      if (expenses.length) {
        const grouped = this.groupByCategory(expenses);
        const top = Object.entries(grouped).sort((a, b) => b[1] - a[1])[0];
        insights.push({
          type: 'info',
          icon: '🎯',
          text: `Biggest expense: <strong>${escapeHtml(top[0])}</strong> (${inr(top[1])})`
        });
      }

      // 4. Savings rate insight
      if (tot.income > 0) {
        const rate = Math.round((tot.profit / tot.income) * 100);
        if (rate >= 30) {
          insights.push({
            type: 'success',
            icon: '🏆',
            text: `Excellent savings rate of <strong>${rate}%</strong>! Keep it up!`
          });
        } else if (rate < 10 && rate >= 0) {
          insights.push({
            type: 'warn',
            icon: '💡',
            text: `Your savings rate is only <strong>${rate}%</strong>. Aim for 20%+`
          });
        }
      }

      // 5. Weekly activity check
      if (weekT.count === 0) {
        insights.push({
          type: 'info',
          icon: '📝',
          text: 'No transactions this week. Time to update your records!'
        });
      } else if (weekT.count >= 10) {
        insights.push({
          type: 'success',
          icon: '⚡',
          text: `Active week! <strong>${weekT.count} transactions</strong> recorded.`
        });
      }

      // 6. Best day of month
      if (monthT.income > 0 && monthT.expense > 0) {
        const ratio = monthT.income / monthT.expense;
        if (ratio > 2) {
          insights.push({
            type: 'success',
            icon: '🚀',
            text: `Income is <strong>${ratio.toFixed(1)}x higher</strong> than expenses this month!`
          });
        }
      }
    }

    // Render top 4 insights
    box.innerHTML = insights.slice(0, 4).map(i => `
      <div class="insight-item ${i.type}">
        <span class="insight-icon">${i.icon}</span>
        <div class="insight-text">${i.text}</div>
      </div>
    `).join('');
  },

  // ============================================
  // MONTH COMPARISON
  // ============================================
  loadComparison(all) {
    const thisM = calcTotals(filterByPeriod(all, 'month'));
    const lastM = calcTotals(filterByPeriod(all, 'lastmonth'));

    setText('cmpLast', inr(lastM.profit));
    setText('cmpThis', inr(thisM.profit));

    const arrow = el('cmpArrow');
    if (!arrow) return;

    if (lastM.profit === 0 && thisM.profit === 0) {
      arrow.className = 'compare-arrow neutral';
      arrow.textContent = '→ No transactions yet';
    } else if (lastM.profit === 0) {
      arrow.className = 'compare-arrow up';
      arrow.textContent = thisM.profit > 0
        ? '↑ New profit this month!'
        : '↓ Loss this month';
    } else {
      const diff = thisM.profit - lastM.profit;
      const pct = Math.round((diff / Math.abs(lastM.profit)) * 100);
      const isUp = diff >= 0;
      arrow.className = 'compare-arrow ' + (isUp ? 'up' : 'down');
      arrow.textContent = `${isUp ? '↑' : '↓'} ${Math.abs(pct)}% vs last month`;
    }
  },

  // ============================================
  // TOP EXPENSE CATEGORIES
  // ============================================
  loadTopCategories(all) {
    const box = el('topCatBox');
    if (!box) return;

    const expenses = all.filter(t => t.type === 'expense');
    if (!expenses.length) {
      box.innerHTML = '<div class="empty"><p>No expense data yet</p></div>';
      return;
    }

    const grouped = this.groupByCategory(expenses);
    const sorted = Object.entries(grouped)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const max = sorted[0][1];

    box.innerHTML = sorted.map(([cat, amt], i) => {
      const width = (amt / max) * 100;
      const rankClass = i < 3 ? `r${i + 1}` : '';
      return `
        <div class="tc-item">
          <div class="tc-rank ${rankClass}">${i + 1}</div>
          <div class="tc-info">
            <div class="tc-name" title="${escapeHtml(cat)}">${escapeHtml(cat)}</div>
            <div class="tc-bar">
              <div class="tc-fill" style="width:${width}%"></div>
            </div>
          </div>
          <div class="tc-amt">${inrShort(amt)}</div>
        </div>
      `;
    }).join('');
  },

  // ============================================
  // PAYMENT MODES
  // ============================================
  loadPaymentModes(all) {
    const box = el('payModeBox');
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
      grouped[mode].total += parseFloat(t.amount) || 0;
      grouped[mode].count++;
    }

    const total = Object.values(grouped).reduce((s, x) => s + x.total, 0);
    const sorted = Object.entries(grouped).sort((a, b) => b[1].total - a[1].total);

    box.innerHTML = sorted.map(([mode, data]) => {
      const pct = total > 0 ? Math.round((data.total / total) * 100) : 0;
      const icon = this.icons.payment[mode] || '💰';
      const plural = data.count !== 1 ? 's' : '';
      return `
        <div class="pm-item">
          <div class="pm-ic">${icon}</div>
          <div class="pm-info">
            <div class="pm-name">${escapeHtml(mode)}</div>
            <div class="pm-sub">${data.count} transaction${plural}</div>
          </div>
          <div>
            <div class="pm-amt">${inrShort(data.total)}</div>
            <div class="pm-pct">${pct}%</div>
          </div>
        </div>
      `;
    }).join('');
  },

  // ============================================
  // RECENT TRANSACTIONS
  // ============================================
  loadRecent(all) {
    const tbody = el('recentBody');
    if (!tbody) return;

    if (!all.length) {
      tbody.innerHTML = `
        <tr><td colspan="5">
          <div class="empty">
            <div class="empty-icon">📋</div>
            <h4>No transactions yet</h4>
            <p>Add your first income or expense</p>
          </div>
        </td></tr>
      `;
      return;
    }

    // Sort by date desc, then by savedAt desc
    const sorted = [...all]
      .sort((a, b) => {
        const dateCompare = new Date(b.date) - new Date(a.date);
        if (dateCompare !== 0) return dateCompare;
        return new Date(b.savedAt || 0) - new Date(a.savedAt || 0);
      })
      .slice(0, 8);

    tbody.innerHTML = sorted.map(t => this.renderRecentRow(t)).join('');
  },

  renderRecentRow(t) {
    const isI = t.type === 'income';
    const badgeClass = isI ? 'badge-in' : 'badge-out';
    const amtClass = isI ? 'amt-in' : 'amt-out';
    const sign = isI ? '+' : '-';
    const label = isI ? '💰 In' : '💸 Out';

    return `
      <tr>
        <td style="font-size:0.8rem;">${fmtDate(t.date)}</td>
        <td><span class="badge ${badgeClass}">${label}</span></td>
        <td style="font-size:0.8rem;">${escapeHtml(t.category || '-')}</td>
        <td class="${amtClass}">${sign}${inrShort(t.amount)}</td>
        <td style="font-size:0.75rem;color:var(--text-muted);">${escapeHtml(t.mode || 'Cash')}</td>
      </tr>
    `;
  },

  // ============================================
  // YEAR SELECTOR
  // ============================================
  setupYearSelector() {
    const sel = el('chartYear');
    if (!sel || sel.options.length > 0) return;

    // Find year range from data
    const txns = getTxns();
    const cur = new Date().getFullYear();
    let minYear = cur - 4;

    if (txns.length) {
      const years = txns.map(t => new Date(t.date).getFullYear()).filter(y => !isNaN(y));
      if (years.length) {
        minYear = Math.min(cur - 4, Math.min(...years));
      }
    }

    for (let y = cur; y >= minYear; y--) {
      const o = document.createElement('option');
      o.value = y;
      o.textContent = y;
      if (y === cur) o.selected = true;
      sel.appendChild(o);
    }
  },

  // ============================================
  // BAR CHART (Monthly Income vs Expense)
  // ============================================
  buildBarChart(all) {
    const canvas = el('barChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const year = parseInt(el('chartYear')?.value) || new Date().getFullYear();
    this.state.year = year;

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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

    if (this.charts.bar) {
      this.charts.bar.destroy();
      this.charts.bar = null;
    }

    this.charts.bar = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [
          {
            label: 'Income',
            data: income,
            backgroundColor: this.colors.incomeSoft,
            borderRadius: 6,
            borderSkipped: false
          },
          {
            label: 'Expense',
            data: expense,
            backgroundColor: this.colors.expenseSoft,
            borderRadius: 6,
            borderSkipped: false
          }
        ]
      },
      options: this.getBarOptions()
    });
  },

  getBarOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      animation: { duration: 600, easing: 'easeOutQuart' },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            font: { size: 12, weight: '600' },
            padding: 16
          }
        },
        tooltip: this.getTooltipOptions()
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: '#94a3b8', font: { size: 11 } }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(0,0,0,0.04)' },
          border: { display: false },
          ticks: {
            color: '#94a3b8',
            font: { size: 11 },
            callback: v => inrShort(v)
          }
        }
      }
    };
  },

  // ============================================
  // DONUT CHART (Expense Breakdown)
  // ============================================
  buildDonutChart(all) {
    const canvas = el('donutChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const period = el('donutPeriod')?.value || 'month';
    this.state.donutPeriod = period;

    const txns = filterByPeriod(all, period).filter(t => t.type === 'expense');
    const grouped = this.groupByCategory(txns);

    const entries = Object.entries(grouped).sort((a, b) => b[1] - a[1]);
    const labels = entries.map(e => e[0]);
    const values = entries.map(e => e[1]);
    const colors = this.colors.palette.slice(0, labels.length);

    if (this.charts.donut) {
      this.charts.donut.destroy();
      this.charts.donut = null;
    }

    if (!labels.length) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHTML('donutLegend',
        '<p style="text-align:center;color:var(--text-muted);font-size:0.82rem;padding:20px;">No expense data for this period</p>'
      );
      return;
    }

    this.charts.donut = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderWidth: 3,
          borderColor: '#fff',
          hoverBorderWidth: 4,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        animation: { duration: 800, animateRotate: true },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...this.getTooltipOptions(),
            callbacks: {
              label: ctx => {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct = Math.round((ctx.parsed / total) * 100);
                return ` ${inr(ctx.parsed)} (${pct}%)`;
              }
            }
          }
        }
      }
    });

    // Build custom legend
    const total = values.reduce((a, b) => a + b, 0);
    setHTML('donutLegend', labels.map((l, i) => `
      <div class="leg-row">
        <div class="leg-dot" style="background:${colors[i]}"></div>
        <span class="leg-name" title="${escapeHtml(l)}">${escapeHtml(l)}</span>
        <span class="leg-val">${inrShort(values[i])}</span>
        <span class="leg-pct">${Math.round((values[i] / total) * 100)}%</span>
      </div>
    `).join(''));
  },

  // ============================================
  // LINE CHART (30-Day Cash Flow)
  // ============================================
  buildLineChart(all) {
    const canvas = el('lineChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const days = 30;
    const labels = [];
    const income = [];
    const expense = [];
    const now = new Date();

    // Build date map for O(1) lookup
    const dateMap = {};
    for (let i = 0; i < all.length; i++) {
      const t = all[i];
      if (!dateMap[t.date]) dateMap[t.date] = { income: 0, expense: 0 };
      const amt = parseFloat(t.amount) || 0;
      if (t.type === 'income') dateMap[t.date].income += amt;
      else if (t.type === 'expense') dateMap[t.date].expense += amt;
    }

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      labels.push(`${d.getDate()}/${d.getMonth() + 1}`);
      const dayData = dateMap[ds] || { income: 0, expense: 0 };
      income.push(dayData.income);
      expense.push(dayData.expense);
    }

    if (this.charts.line) {
      this.charts.line.destroy();
      this.charts.line = null;
    }

    const ctx = canvas.getContext('2d');
    const g1 = ctx.createLinearGradient(0, 0, 0, 220);
    g1.addColorStop(0, this.colors.incomeGrad);
    g1.addColorStop(1, 'rgba(16,185,129,0)');
    const g2 = ctx.createLinearGradient(0, 0, 0, 220);
    g2.addColorStop(0, this.colors.expenseGrad);
    g2.addColorStop(1, 'rgba(244,63,94,0)');

    this.charts.line = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Income',
            data: income,
            borderColor: this.colors.income,
            backgroundColor: g1,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointBackgroundColor: this.colors.income,
            fill: true,
            tension: 0.4
          },
          {
            label: 'Expense',
            data: expense,
            borderColor: this.colors.expense,
            backgroundColor: g2,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointBackgroundColor: this.colors.expense,
            fill: true,
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        animation: { duration: 600 },
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: {
              usePointStyle: true,
              pointStyle: 'circle',
              font: { size: 12, weight: '600' },
              padding: 16
            }
          },
          tooltip: this.getTooltipOptions()
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { color: '#94a3b8', font: { size: 10 }, maxRotation: 0 }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(0,0,0,0.04)' },
            border: { display: false },
            ticks: {
              color: '#94a3b8',
              font: { size: 11 },
              callback: v => inrShort(v)
            }
          }
        }
      }
    });
  },

  // ============================================
  // COMMON TOOLTIP
  // ============================================
  getTooltipOptions() {
    return {
      backgroundColor: '#0f172a',
      titleColor: '#fff',
      bodyColor: '#cbd5e1',
      padding: 12,
      cornerRadius: 10,
      borderColor: '#06b6d4',
      borderWidth: 1,
      titleFont: { size: 12, weight: '700' },
      bodyFont: { size: 12 },
      displayColors: true,
      callbacks: {
        label: ctx => ` ${ctx.dataset.label}: ${inr(ctx.parsed.y)}`
      }
    };
  },

  // ============================================
  // SEARCH (Header)
  // ============================================
  setupSearch() {
    const input = el('headerSearch');
    if (!input) return;

    const handler = debounce(e => {
      const q = e.target.value.trim().toLowerCase();
      const all = getTxns();

      if (!q) {
        this.loadRecent(all);
        return;
      }

      const results = all.filter(t => {
        return (
          (t.category || '').toLowerCase().includes(q) ||
          (t.notes || '').toLowerCase().includes(q) ||
          (t.from || '').toLowerCase().includes(q) ||
          (t.vendor || '').toLowerCase().includes(q) ||
          (t.mode || '').toLowerCase().includes(q) ||
          String(t.amount).includes(q) ||
          fmtDate(t.date).toLowerCase().includes(q)
        );
      }).slice(0, 8);

      const tbody = el('recentBody');
      if (!tbody) return;

      if (!results.length) {
        tbody.innerHTML = `
          <tr><td colspan="5">
            <div class="empty">
              <div class="empty-icon">🔍</div>
              <h4>No results found</h4>
              <p>Try a different search term</p>
            </div>
          </td></tr>
        `;
        return;
      }

      tbody.innerHTML = results.map(t => this.renderRecentRow(t)).join('');
    }, 250);

    input.addEventListener('input', handler);

    // Clear search on Escape
    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        input.value = '';
        this.loadRecent(getTxns());
        input.blur();
      }
    });
  },

  // ============================================
  // PERIOD TABS
  // ============================================
  setupPeriodTabs() {
    const tabs = $$('.pb-tab');
    tabs.forEach(tab => {
      const period = tab.dataset.p;
      if (!period) return;

      tab.addEventListener('click', () => {
        this.switchPeriod(period, tab);
      });
    });
  },

  switchPeriod(period, btn) {
    this.state.period = period;
    $$('.pb-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    this.loadSummary(getTxns());
  },

  // ============================================
  // UTILITIES
  // ============================================
  groupByCategory(txns) {
    const grouped = {};
    for (let i = 0; i < txns.length; i++) {
      const t = txns[i];
      const cat = t.category || 'Uncategorized';
      grouped[cat] = (grouped[cat] || 0) + (parseFloat(t.amount) || 0);
    }
    return grouped;
  },

  // ============================================
  // CLEANUP (called on page unload)
  // ============================================
  destroy() {
    if (this.state.refreshTimer) {
      clearInterval(this.state.refreshTimer);
    }
    Object.values(this.charts).forEach(chart => {
      if (chart) chart.destroy();
    });
  }
};

// ============================================
// GLOBAL FUNCTIONS (for HTML onclick)
// ============================================
function switchPeriod(p, btn) {
  Dashboard.switchPeriod(p, btn);
}

function buildBarChart() {
  Dashboard.buildBarChart(getTxns());
}

function buildDonutChart() {
  Dashboard.buildDonutChart(getTxns());
}

// ============================================
// TRANSACTION FORM HANDLING
// ============================================
function saveTransaction(type) {
  const isI = type === 'income';

  const date = el(isI ? 'iDate' : 'eDate')?.value?.trim();
  const cat = el(isI ? 'iCat' : 'eCat')?.value?.trim();
  const amt = el(isI ? 'iAmt' : 'eAmt')?.value?.trim();
  const mode = el(isI ? 'iMode' : 'eMode')?.value || 'Cash';
  const from = isI ? (el('iFrom')?.value?.trim() || '') : '';
  const vendor = !isI ? (el('eVendor')?.value?.trim() || '') : '';
  const notes = (el(isI ? 'iNote' : 'eNote')?.value?.trim() || '');
  const editId = el(isI ? 'iEditId' : 'eEditId')?.value?.trim();

  // Validation
  if (!date) {
    toast('Please select a date', 'error');
    el(isI ? 'iDate' : 'eDate')?.focus();
    return;
  }

  if (!cat) {
    toast('Please select a category', 'error');
    el(isI ? 'iCat' : 'eCat')?.focus();
    return;
  }

  const amount = parseFloat(amt);
  if (!amount || amount <= 0 || isNaN(amount)) {
    toast('Please enter a valid amount', 'error');
    el(isI ? 'iAmt' : 'eAmt')?.focus();
    return;
  }

  // Prevent future dates (optional - remove if you want to allow)
  const selectedDate = new Date(date);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (selectedDate > today) {
    const confirm = window.confirm('This is a future date. Continue?');
    if (!confirm) return;
  }

  const entry = {
    id: editId || uid(),
    type,
    date,
    category: cat,
    amount,
    mode,
    from,
    vendor,
    notes,
    savedAt: editId ? undefined : new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  let success;
  if (editId) {
    // Preserve original savedAt
    const original = Store.find(editId);
    if (original) entry.savedAt = original.savedAt;
    success = Store.update(editId, entry);
  } else {
    success = Store.add(entry);
  }

  if (!success) {
    toast('Failed to save transaction!', 'error');
    return;
  }

  closeModal(isI ? 'incomeModal' : 'expenseModal');
  resetForm(type);

  // Show success with amount
  const action = editId ? 'Updated' : 'Added';
  const label = isI ? 'income' : 'expense';
  toast(`${action} ${label} of ${inr(amount)}!`, 'success');

  // Reload dashboard (or subscribe will handle it)
  Dashboard.loadAll();
}

function resetForm(type) {
  const isI = type === 'income';

  const setVal = (id, val) => {
    const e = el(id);
    if (e) e.value = val;
  };

  setVal(isI ? 'iDate' : 'eDate', today());
  setVal(isI ? 'iCat' : 'eCat', '');
  setVal(isI ? 'iAmt' : 'eAmt', '');
  setVal(isI ? 'iMode' : 'eMode', 'Cash');
  setVal(isI ? 'iNote' : 'eNote', '');
  setVal(isI ? 'iEditId' : 'eEditId', '');

  if (isI) {
    setVal('iFrom', '');
    const p = el('iPreview');
    if (p) p.style.display = 'none';
  } else {
    setVal('eVendor', '');
    const p = el('ePreview');
    if (p) p.style.display = 'none';
  }
}

function openIncomeModal() {
  resetForm('income');
  const dateEl = el('iDate');
  if (dateEl) dateEl.value = today();
  Modal.open('incomeModal');
}

function openExpenseModal() {
  resetForm('expense');
  const dateEl = el('eDate');
  if (dateEl) dateEl.value = today();
  Modal.open('expenseModal');
}

// ============================================
// PAGE LIFECYCLE
// ============================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Dashboard.init());
} else {
  Dashboard.init();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => Dashboard.destroy());

// Global export
window.Dashboard = Dashboard;