/* ============================================
   DASHBOARD.JS v1.0.0 — Yesterday Support
   ============================================ */

'use strict';

const Dash = {
  charts: { bar: null, donut: null, line: null, compare: null, payMode: null, sparkIncome: null, sparkExpense: null, sparkProfit: null, sparkBalance: null, sparkAvgIncome: null, sparkAvgExpense: null, sparkSavings: null },
  period: 'today',
  customStart: '',
  customEnd: '',
  isFirstLoad: true,
  activeBillTab: 'pending',

  init: function () {
    try {
      if (typeof Chart !== 'undefined') {
        Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";
      }
      this.lineChartTab = 'historical';
      this.simSessionStats = { income: 0, count: 0 };
      this.liveSalesData = [];
      // Load saved preferences & stealth mode
      this.loadPrivacyMode();
      this.loadCustomizerPreferences();

      // Check default period preference
      let savedPeriod = 'today';
      try {
        const p = JSON.parse(localStorage.getItem('bd_dash_prefs') || '{}');
        if (p.defaultPeriod) savedPeriod = p.defaultPeriod;
      } catch (e) { }
      this.period = savedPeriod;

      // Enforce default visual tab highlight
      const activeBtn = document.querySelector(`.pb-tab[data-p="${this.period}"]`) || document.querySelector('.pb-tab[data-p="today"]');
      if (activeBtn) {
        document.querySelectorAll('.pb-tab').forEach(t => t.classList.remove('active'));
        activeBtn.classList.add('active');
      }

      // Ensure chart dropdown defaults
      this.setupYearSelector();
      const donutSel = document.getElementById('donutPeriod');
      if (donutSel) donutSel.value = 'month';

      // SEED DATA UPGRADE: Only seed realistic demo data if in demo mode or clean local preview
      let currentTxns = getTxns();
      const isDemoMode = localStorage.getItem('bd_mode') === 'demo';
      const hasNoUser = !localStorage.getItem('bd_user_uid');
      if (isDemoMode || ((!currentTxns || currentTxns.length === 0) && hasNoUser)) {
        currentTxns = this.seedRealisticData();
      }

      this.setupWelcome();
      this.loadAll();
      this.setupSearch();
      this.animateNumbers();
      this.loadNotifications();

      // Trigger automatic chart load immediately & after short delay
      setTimeout(() => {
        const txns = getTxns();
        this.buildBarChart(txns);
        this.buildDonutChart(txns);
        this.buildLineChart(txns);
      }, 150);

      // Outside click closes notifications
      document.addEventListener('click', e => {
        const wrapper = document.querySelector('.notif-wrapper');
        if (wrapper && !wrapper.contains(e.target)) {
          const dropdown = document.getElementById('notifDropdown');
          if (dropdown) dropdown.style.display = 'none';
        }
      });

      if (localStorage.getItem('bd_mode') === 'demo') {
        setTimeout(() => {
          PizzaCafeSimulator.toggle(true);
        }, 1000);
      }
    } catch (err) {
      console.error('Dashboard init error:', err);
    }
  },

  loadAll: function () {
    const all = getTxns();
    try { this.loadSummary(all); } catch (e) { console.error('loadSummary err:', e); }
    try { this.loadCashOnline(all); } catch (e) { console.error('loadCashOnline err:', e); }
    try { this.loadAnalytics(all); } catch (e) { console.error('loadAnalytics err:', e); }
    try { this.loadInsights(all); } catch (e) { console.error('loadInsights err:', e); }
    try { this.loadComparison(all); } catch (e) { console.error('loadComparison err:', e); }
    try { this.loadTopCategories(all); } catch (e) { console.error('loadTopCategories err:', e); }
    try { this.loadPaymentModes(all); } catch (e) { console.error('loadPaymentModes err:', e); }
    try { this.loadRecent(all); } catch (e) { console.error('loadRecent err:', e); }
    try { this.loadGoals(all); } catch (e) { console.error('loadGoals err:', e); }
    try { this.loadCategoryBudgets(all); } catch (e) { console.error('loadCategoryBudgets err:', e); }
    try { this.loadVendors(); } catch (e) { console.error('loadVendors err:', e); }
    try { this.loadBills(); } catch (e) { console.error('loadBills err:', e); }
    try { this.renderExpiryAlerts(); } catch (e) { console.error('renderExpiryAlerts err:', e); }
    try { this.buildSparklines(all); } catch (e) { }
    if (typeof lucide !== 'undefined') { try { lucide.createIcons(); } catch (e) { } }

    // Real-time listener for Stock updates from Expiry Tracker page or storage changes
    if (!this._stockListenersAttached) {
      this._stockListenersAttached = true;
      window.addEventListener('stockUpdated', () => {
        try { this.loadVendors(); } catch (e) { }
      });
      window.addEventListener('storage', (e) => {
        if (e.key === 'bd_expiry_items' || e.key === 'bd_vendors') {
          try { this.loadVendors(); } catch (e) { }
        }
      });
    }

    const renderAllCharts = () => {
      const txns = getTxns();
      try { this.buildBarChart(txns); } catch (e) { console.error('buildBarChart err:', e); }
      try { this.buildDonutChart(txns); } catch (e) { console.error('buildDonutChart err:', e); }
      try { this.buildLineChart(txns); } catch (e) { console.error('buildLineChart err:', e); }
      try { this.buildCompareChart(txns); } catch (e) { console.error('buildCompareChart err:', e); }
      try { this.buildPayModeChart(txns); } catch (e) { console.error('buildPayModeChart err:', e); }
      try { this.buildSparklines(txns); } catch (e) { console.error('buildSparklines err:', e); }
    };

    if (typeof Chart !== 'undefined') {
      renderAllCharts();
    } else {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (typeof Chart !== 'undefined') {
          clearInterval(interval);
          renderAllCharts();
        } else if (attempts >= 30) {
          clearInterval(interval);
        }
      }, 100);
    }
  },

  animateNumbers: function () {
    setTimeout(() => {
      const numberIds = [
        'pIncome', 'pExpense', 'pProfit', 'totalBal',
        'cashIn', 'cashOut', 'cashBalance',
        'onlineIn', 'onlineOut', 'onlineBalance',
        'msAvgIncome', 'msAvgExpense', 'msSavings',
        'msAvgIncomeMonth', 'msAvgExpenseMonth', 'msSavingsMonth',
        'cmpLast', 'cmpThis',
        'lineIncomeTotal', 'lineExpenseTotal', 'lineNetTotal',
        'goalRevCurrent', 'goalExpCurrent', 'goalPrfCurrent'
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

  setupWelcome: function () {
    const h = getISTDateObject().getHours();
    let msg = '🌙 Good Night';
    if (h >= 5 && h < 12) msg = '🌅 Good Morning';
    else if (h >= 12 && h < 17) msg = '☀️ Good Afternoon';
    else if (h >= 17 && h < 21) msg = '🌇 Good Evening';
    this.setText('welcomeMsg', msg + '!');
    this.setText('heroSubtext', fmtDateFull(today()));
  },

  loadSummary: function (all) {
    const txns = filterByPeriod(all, this.period, this.customStart, this.customEnd);
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
  updatePeriodLabel: function () {
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
      let periodLabel = labels[this.period] || labels.month;
      if (this.period === 'custom') {
        periodLabel = `📅 Custom: ${fmtDate(this.customStart)} to ${fmtDate(this.customEnd)}`;
      }
      subtitleEl.textContent = periodLabel;
    }
  },

  loadCashOnline: function (all) {
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

    // Update Cash vs Online collection ratio bar
    const totalReceived = cashIn + onlineIn;
    const cashPct = totalReceived > 0 ? Math.round((cashIn / totalReceived) * 100) : 50;
    const onlinePct = totalReceived > 0 ? (100 - cashPct) : 50;

    const ratioCashEl = document.getElementById('ratioFillCash');
    const ratioOnlineEl = document.getElementById('ratioFillOnline');
    const ratioTextEl = document.getElementById('cashRatioText');
    const ratioCashValEl = document.getElementById('ratioCashVal');
    const ratioOnlineValEl = document.getElementById('ratioOnlineVal');

    if (ratioCashEl) ratioCashEl.style.width = cashPct + '%';
    if (ratioOnlineEl) ratioOnlineEl.style.width = onlinePct + '%';
    if (ratioTextEl) {
      ratioTextEl.textContent = `${cashPct}% Cash (${inr(cashIn)}) • ${onlinePct}% Online (${inr(onlineIn)})`;
    }
    if (ratioCashValEl) {
      ratioCashValEl.innerHTML = `${cashPct}% <small>(${inr(cashIn)})</small>`;
    }
    if (ratioOnlineValEl) {
      ratioOnlineValEl.innerHTML = `${onlinePct}% <small>(${inr(onlineIn)})</small>`;
    }
  },

  // UPDATED: Better trend logic for Yesterday
  updateTrends: function (all, period) {
    let prevPeriod = null;
    if (period === 'today') prevPeriod = 'yesterday';
    else if (period === 'week') prevPeriod = 'lastweek';
    else if (period === 'month') prevPeriod = 'lastmonth';
    else if (period === 'yesterday') {
      // For yesterday, compare with day before yesterday (2 days ago)
      // We'll show trends but they'll require custom logic
      prevPeriod = null;
    }

    const cur = calcTotals(filterByPeriod(all, period, this.customStart, this.customEnd));
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
  getDayBeforeYesterdayTxns: function (all) {
    const d = new Date(new Date().getTime() - 2 * 24 * 60 * 60 * 1000);
    const parts = getISTDateParts(d);
    const dateStr = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
    return all.filter(t => t.date === dateStr);
  },

  calcTrend: function (cur, prev) {
    if (prev > 0) return Math.round(((cur - prev) / prev) * 100);
    if (cur > 0) return 100;
    return 0;
  },

  setTrend: function (id, val) {
    const el = document.getElementById(id);
    if (!el) return;
    const arrow = val > 0 ? '↑' : val < 0 ? '↓' : '→';
    const display = Math.abs(val) > 999 ? '999+' : Math.abs(val);
    el.textContent = arrow + ' ' + display + '%';
  },

  loadAnalytics: function (all) {
    if (!all.length) {
      this.setText('msAvgIncome', '₹ 0');
      this.setText('msAvgExpense', '₹ 0');
      this.setText('msSavings', '0%');
      this.setText('msIncomeDays', 'No data yet');
      this.setText('msExpenseDays', 'No data yet');
      this.setText('msSavingsSub', 'Start adding data');
      this.setText('msAvgIncomeMonth', '₹ 0');
      this.setText('msAvgExpenseMonth', '₹ 0');
      this.setText('msSavingsMonth', '0%');
      this.setText('msIncomeMonths', 'No data yet');
      this.setText('msExpenseMonths', 'No data yet');
      this.setText('msSavingsMonthSub', 'Start adding data');
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

    // --- CURRENT MONTH ANALYTICS (Active days in current month) ---
    const monthTxns = (typeof filterByPeriod === 'function') ? filterByPeriod(all, 'month') : [];
    if (!monthTxns.length) {
      this.setText('msAvgIncomeMonth', '₹ 0');
      this.setText('msAvgExpenseMonth', '₹ 0');
      this.setText('msSavingsMonth', '0%');
      this.setText('msIncomeMonths', 'No data this month');
      this.setText('msExpenseMonths', 'No data this month');
      this.setText('msSavingsMonthSub', 'Start adding data');
      this.setBarWidth('msIncomeMonthBar', 0);
      this.setBarWidth('msExpenseMonthBar', 0);
      this.setBarWidth('msSavingsMonthBar', 0);
    } else {
      const mDaySet = new Set();
      for (let i = 0; i < monthTxns.length; i++) {
        if (monthTxns[i].date) mDaySet.add(monthTxns[i].date);
      }
      const mNumDays = Math.max(mDaySet.size, 1);
      const mTot = calcTotals(monthTxns);
      const mAvgIncome = mTot.income / mNumDays;
      const mAvgExpense = mTot.expense / mNumDays;
      const mSavingsRate = mTot.income > 0 ? Math.round((mTot.profit / mTot.income) * 100) : 0;

      this.setText('msAvgIncomeMonth', inr(mAvgIncome));
      this.setText('msAvgExpenseMonth', inr(mAvgExpense));
      this.setText('msSavingsMonth', mSavingsRate + '%');

      const mDayLabel = mNumDays === 1 ? 'day' : 'days';
      this.setText('msIncomeMonths', 'Across ' + mNumDays + ' active ' + mDayLabel + ' this month');
      this.setText('msExpenseMonths', 'Across ' + mNumDays + ' active ' + mDayLabel + ' this month');

      let mSub = '❌ Loss';
      if (mSavingsRate >= 30) mSub = '🎉 Excellent!';
      else if (mSavingsRate >= 20) mSub = '💪 Great!';
      else if (mSavingsRate >= 10) mSub = '👍 Good';
      else if (mSavingsRate > 0) mSub = '⚠️ Improve';
      this.setText('msSavingsMonthSub', mSub);

      const maxAvgMonth = Math.max(mAvgIncome, mAvgExpense, 1);
      this.setBarWidth('msIncomeMonthBar', (mAvgIncome / maxAvgMonth) * 100);
      this.setBarWidth('msExpenseMonthBar', (mAvgExpense / maxAvgMonth) * 100);
      this.setBarWidth('msSavingsMonthBar', Math.max(0, mSavingsRate));
    }
  },

  setBarWidth: function (id, percent) {
    const bar = document.getElementById(id);
    if (bar) {
      setTimeout(() => {
        bar.style.width = Math.min(Math.max(percent, 0), 100) + '%';
      }, 300);
    }
  },

  loadInsights: function (all) {
    const box = document.getElementById('insightsBox');
    if (!box) return;
    const insights = [];

    // Calculate Cash Flow Health Score
    let score = 50;

    const monthT = calcTotals(filterByPeriod(all, 'month'));
    const lastMonthT = calcTotals(filterByPeriod(all, 'lastmonth'));
    const todayT = calcTotals(filterByPeriod(all, 'today'));
    const yesterdayT = calcTotals(filterByPeriod(all, 'yesterday'));

    const revTarget = parseFloat(localStorage.getItem('vision_revenue_target') || 150000);
    const expCap = parseFloat(localStorage.getItem('vision_expense_cap') || 60000);

    if (!all.length) {
      score = 0;
      insights.push({ type: 'info', icon: 'lightbulb', text: 'Add your first transaction to get personalized insights!' });
    } else {
      const tot = calcTotals(all);

      if (tot.profit > 0) {
        insights.push({ type: 'success', icon: 'banknote', text: "You're in <strong>profit</strong> of " + inr(tot.profit) });
      } else if (tot.profit < 0) {
        insights.push({ type: 'danger', icon: 'alert-triangle', text: "You're in <strong>loss</strong> by " + inr(Math.abs(tot.profit)) });
      }

      const savingsRate = monthT.income > 0 ? (monthT.profit / monthT.income) * 100 : 0;
      if (savingsRate >= 40) {
        score += 20;
      } else if (savingsRate >= 20) {
        score += 10;
      } else if (savingsRate < 0) {
        score -= 20;
      }

      if (expCap > 0) {
        const pace = monthT.expense / expCap;
        if (pace <= 0.6) {
          score += 15;
        } else if (pace <= 0.9) {
          score += 5;
        } else if (pace > 1.0) {
          score -= 20;
          insights.push({ type: 'danger', icon: 'alert-octagon', text: 'Warning: Monthly <strong>Expense Cap exceeded</strong>!' });
        }
      }

      if (revTarget > 0) {
        const pace = monthT.income / revTarget;
        if (pace >= 1.0) {
          score += 15;
        } else if (pace >= 0.5) {
          score += 5;
        }
      }

      score = Math.max(5, Math.min(100, score));

      if (yesterdayT.profit !== 0 && todayT.profit !== 0) {
        const diff = todayT.profit - yesterdayT.profit;
        if (diff > 0) {
          insights.push({
            type: 'success',
            icon: 'trending-up',
            text: 'Today is <strong>' + inr(diff) + ' better</strong> than yesterday!'
          });
        } else if (diff < 0) {
          insights.push({
            type: 'warn',
            icon: 'trending-down',
            text: 'Today is <strong>' + inr(Math.abs(diff)) + ' less</strong> than yesterday'
          });
        }
      }

      if (lastMonthT.expense > 0) {
        const diff = monthT.expense - lastMonthT.expense;
        const pct = Math.abs(Math.round((diff / lastMonthT.expense) * 100));
        if (diff > 0 && pct >= 10) {
          insights.push({ type: 'warn', icon: 'trending-up', text: 'Expenses are <strong>' + pct + '% higher</strong> than last month' });
        } else if (diff < 0 && pct >= 10) {
          insights.push({ type: 'success', icon: 'trending-down', text: 'Expenses are <strong>' + pct + '% lower</strong> than last month' });
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
          insights.push({ type: 'info', icon: 'target', text: 'Biggest expense: <strong>' + escapeHtml(sorted[0][0]) + '</strong> (' + inr(sorted[0][1]) + ')' });
        }
      }
    }

    box.innerHTML = insights.slice(0, 4).map(i =>
      '<div class="insight-item ' + i.type + '"><span class="insight-icon" style="display:inline-flex; align-items:center; justify-content:center;"><i data-lucide="' + i.icon + '" style="width: 14px; height: 14px;"></i></span><div class="insight-text">' + i.text + '</div></div>'
    ).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Update SVG Circular Gauge
    const circle = document.getElementById('healthScoreCircle');
    const valueEl = document.getElementById('healthScoreValue');
    const statusEl = document.getElementById('healthStatusText');

    if (circle && valueEl && statusEl) {
      valueEl.textContent = score + '%';
      const offset = 213.63 - (score / 100) * 213.63;
      circle.style.strokeDashoffset = offset;

      if (score >= 80) {
        circle.setAttribute('stroke', '#10b981');
        statusEl.textContent = '🌟 Optimal Cash Flow (' + score + '/100)';
        statusEl.style.color = '#10b981';
      } else if (score >= 50) {
        circle.setAttribute('stroke', '#6366f1');
        statusEl.textContent = '👍 Healthy Pacing (' + score + '/100)';
        statusEl.style.color = '#6366f1';
      } else {
        circle.setAttribute('stroke', '#ef4444');
        statusEl.textContent = '⚠️ Attention Needed (' + score + '/100)';
        statusEl.style.color = '#ef4444';
      }
    }
  },

  loadComparison: function (all) {
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

  loadTopCategories: function (all) {
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
      const cat = t.category || 'Other';
      grouped[cat] = (grouped[cat] || 0) + parseFloat(t.amount || 0);
    }
    const sorted = Object.entries(grouped).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const max = sorted[0][1] || 1;

    box.innerHTML = sorted.map((item, i) => {
      const cat = item[0] || 'Other';
      const amt = item[1];
      const rankClass = 'r' + (i + 1);
      const cleanName = cat.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDC00-\uDFFF]/g, '').trim() || cat;
      const icon = (window.getLucideIconName && window.getLucideIconName(cat)) || 'tag';

      return `<div class="tc-item">
        <div class="tc-rank ${rankClass}">#${i + 1}</div>
        <div class="tc-body">
          <div class="tc-header">
            <div class="tc-name-wrap">
              <span class="tc-icon"><i data-lucide="${icon}"></i></span>
              <span class="tc-name" title="${escapeHtml(cleanName)}">${escapeHtml(cleanName)}</span>
            </div>
            <div class="tc-amt">${inrShort(amt)}</div>
          </div>
          <div class="tc-bar">
            <div class="tc-fill" style="width:0%"></div>
          </div>
        </div>
      </div>`;
    }).join('');

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }

    setTimeout(() => {
      const fills = box.querySelectorAll('.tc-fill');
      sorted.forEach((item, i) => {
        if (fills[i]) fills[i].style.width = Math.min(100, Math.max(10, (item[1] / max) * 100)) + '%';
      });
    }, 150);
  },

  loadPaymentModes: function (all) {
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
    const icons = { 'Cash': 'coins', 'Online': 'smartphone', 'UPI': 'phone-call', 'Bank Transfer': 'landmark', 'Card': 'credit-card', 'Cheque': 'file-text' };

    box.innerHTML = sorted.map(item => {
      const mode = item[0], data = item[1];
      const pct = total > 0 ? Math.round((data.total / total) * 100) : 0;
      const icon = icons[mode] || 'wallet';
      let modeCls = 'mode-cash';
      const ml = mode.toLowerCase();
      if (ml.includes('upi') || ml.includes('gpay') || ml.includes('phonepe') || ml.includes('paytm')) modeCls = 'mode-upi';
      else if (ml.includes('card')) modeCls = 'mode-card';
      else if (ml.includes('bank') || ml.includes('transfer') || ml.includes('neft')) modeCls = 'mode-bank';
      else if (ml.includes('online')) modeCls = 'mode-online';

      return `<div class="pm-item">
        <div class="pm-ic ${modeCls}"><i data-lucide="${icon}"></i></div>
        <div class="pm-info">
          <div class="pm-name">${escapeHtml(mode)}</div>
          <div class="pm-sub">${data.count} transaction${data.count === 1 ? '' : 's'}</div>
        </div>
        <div class="pm-stats">
          <div class="pm-amt">${inrShort(data.total)}</div>
          <div class="pm-pct-badge ${modeCls}">${pct}%</div>
        </div>
      </div>`;
    }).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  loadRecent: function (all) {
    this._recentAll = all || [];
    const tbody = document.getElementById('recentBody');
    if (!tbody) return;
    if (!all.length) {
      tbody.innerHTML = '<tr><td colspan="5"><div class="empty"><div class="empty-icon" style="display:flex; justify-content:center;"><i data-lucide="clipboard-list" style="width: 32px; height: 32px;"></i></div><h4>No transactions yet</h4></div></td></tr>';
      if (typeof lucide !== 'undefined') lucide.createIcons();
      return;
    }

    let filtered = all.slice();
    const typeFilter = this._recentTypeFilter || this.recentTypeFilter;
    if (typeFilter && typeFilter !== 'all') {
      filtered = filtered.filter(t => t.type === typeFilter);
    }
    const searchQuery = this._recentSearchQuery || this.recentSearchQuery;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        (t.category && t.category.toLowerCase().includes(q)) ||
        (t.mode && t.mode.toLowerCase().includes(q)) ||
        (t.notes && t.notes.toLowerCase().includes(q)) ||
        (t.from && t.from.toLowerCase().includes(q)) ||
        (t.vendor && t.vendor.toLowerCase().includes(q)) ||
        String(t.amount || '').includes(q)
      );
    }

    const badge = document.getElementById('recentFilterBadge');
    if (badge) {
      const hasFilter = (typeFilter && typeFilter !== 'all') || Boolean(searchQuery);
      badge.style.display = hasFilter ? 'inline-block' : 'none';
      if (hasFilter) badge.textContent = `${filtered.length} found`;
    }

    const sorted = filtered.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
    if (!sorted.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:24px; color:var(--text-muted); font-size:0.8rem;">No matching transactions found</td></tr>';
      return;
    }

    tbody.innerHTML = sorted.map(t => {
      const isI = t.type === 'income';
      const safeId = encodeURIComponent(t.id);

      const rawCat = t.category || '-';
      const catClean = rawCat.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDC00-\uDFFF]/g, '').trim() || rawCat;
      const catIcon = (window.getLucideIconName && window.getLucideIconName(rawCat)) || (isI ? 'trending-up' : 'tag');

      const rawMode = t.mode || 'Cash';
      const modeClean = rawMode.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDC00-\uDFFF]/g, '').trim() || rawMode;
      const modeIcon = (window.getLucideIconName && window.getLucideIconName(rawMode)) || 'wallet';
      let modeCls = 'mode-cash';
      const ml = rawMode.toLowerCase();
      if (ml.includes('card')) modeCls = 'mode-card';
      else if (ml.includes('upi') || ml.includes('gpay') || ml.includes('phonepe') || ml.includes('paytm')) modeCls = 'mode-upi';
      else if (ml.includes('bank') || ml.includes('transfer') || ml.includes('neft')) modeCls = 'mode-bank';
      else if (ml.includes('online')) modeCls = 'mode-online';

      return `<tr onclick="Dash.viewTxnDetails(decodeURIComponent('${safeId}'))" style="cursor:pointer;" title="Click to view transaction receipt & details">
        <td class="tx-date">${fmtDate(t.date)}</td>
        <td class="tx-type"><span class="badge ${isI ? 'badge-in' : 'badge-out'}"><i data-lucide="${isI ? 'arrow-down-left' : 'arrow-up-right'}" style="width:11px; height:11px;"></i>${isI ? 'In' : 'Out'}</span></td>
        <td class="tx-cat">
          <div class="tx-cat-wrap">
            <span class="tx-cat-icon ${isI ? 'cat-in' : 'cat-out'}"><i data-lucide="${catIcon}" style="width:13px; height:13px;"></i></span>
            <span class="tx-cat-name">${catClean}</span>
          </div>
        </td>
        <td class="tx-amt"><span class="tx-amt-pill ${isI ? 'amt-in' : 'amt-out'}">${isI ? '+' : '-'}${inrShort(t.amount)}</span></td>
        <td class="tx-mode"><span class="tx-mode-pill ${modeCls}"><i data-lucide="${modeIcon}" style="width:11px; height:11px;"></i><span>${modeClean}</span></span></td>
      </tr>`;
    }).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  setupYearSelector: function () {
    const sel = document.getElementById('chartYear');
    if (!sel) return;
    const cur = getISTDateParts().year;
    if (sel.options.length === 0) {
      for (let y = cur; y >= cur - 4; y--) {
        const o = document.createElement('option');
        o.value = y;
        o.textContent = y;
        if (y === cur) o.selected = true;
        sel.appendChild(o);
      }
    }
    if (!sel.value) sel.value = String(cur);
  },

  buildBarChart: function (all) {
    const canvas = document.getElementById('barChart');
    if (!canvas || typeof Chart === 'undefined') return;
    try {
      const yearEl = document.getElementById('chartYear');
      let year = yearEl && yearEl.value ? parseInt(yearEl.value, 10) : NaN;
      if (isNaN(year)) year = getISTDateParts().year;
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const income = new Array(12).fill(0);
      const expense = new Array(12).fill(0);
      for (let i = 0; i < all.length; i++) {
        const t = all[i];
        if (!t.date) continue;
        const parts = t.date.split('-');
        const y = parseInt(parts[0]);
        if (y !== year) continue;
        const m = parseInt(parts[1]) - 1;
        const a = parseFloat(t.amount) || 0;
        if (t.type === 'income') income[m] += a;
        else if (t.type === 'expense') expense[m] += a;
      }

      const incomeColor = themeColors.getIncome();
      const expenseColor = themeColors.getExpense();
      const borderVal = themeColors.getBorder();
      const textMutedVal = themeColors.getTextMuted();

      if (this.charts.bar) {
        this.charts.bar.destroy();
        this.charts.bar = null;
      }

      let datasets = [];
      if (this.barChartMode === 'profit') {
        const netProfit = months.map((_, i) => income[i] - expense[i]);
        datasets = [{
          label: 'Net Profit / Margin',
          data: netProfit,
          backgroundColor: netProfit.map(v => v >= 0 ? 'rgba(16, 185, 129, 0.75)' : 'rgba(244, 63, 94, 0.75)'),
          borderColor: netProfit.map(v => v >= 0 ? '#10b981' : '#f43f5e'),
          borderWidth: 1.5,
          borderRadius: { topLeft: 8, topRight: 8 },
          maxBarThickness: 36
        }];
      } else {
        datasets = [
          {
            label: 'Income',
            data: income,
            backgroundColor: 'rgba(16, 185, 129, 0.72)',
            borderColor: incomeColor,
            borderWidth: 1.5,
            borderRadius: { topLeft: 8, topRight: 8 },
            maxBarThickness: 32
          },
          {
            label: 'Expense',
            data: expense,
            backgroundColor: 'rgba(244, 63, 94, 0.72)',
            borderColor: expenseColor,
            borderWidth: 1.5,
            borderRadius: { topLeft: 8, topRight: 8 },
            maxBarThickness: 32
          }
        ];
      }

      this.charts.bar = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: months,
          datasets: datasets
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 500, easing: 'easeOutQuart' },
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              position: 'top',
              align: 'end',
              labels: { usePointStyle: true, pointStyle: 'circle', font: { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: '700' }, padding: 16, color: textMutedVal }
            },
            tooltip: {
              backgroundColor: 'rgba(15, 23, 42, 0.94)',
              titleColor: '#ffffff',
              bodyColor: '#cbd5e1',
              padding: 12,
              cornerRadius: 12,
              borderColor: borderVal + '33',
              borderWidth: 1,
              titleFont: { family: "'Plus Jakarta Sans', sans-serif", weight: 'bold' },
              bodyFont: { family: "'Plus Jakarta Sans', sans-serif" },
              callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + inr(ctx.parsed.y) }
            }
          },
          scales: {
            x: { grid: { display: false }, border: { display: false }, ticks: { color: textMutedVal, font: { family: "'Plus Jakarta Sans', sans-serif", size: 11, weight: '600' } } },
            y: { beginAtZero: true, grid: { color: themeColors.getGridColor() }, border: { display: false }, ticks: { color: textMutedVal, font: { family: "'Plus Jakarta Sans', sans-serif", size: 11, weight: '600' }, callback: v => inrShort(v) } }
          }
        }
      });
    } catch (err) {
      console.error('buildBarChart error:', err);
    }
  },

  buildDonutChart: function (all) {
    const canvas = document.getElementById('donutChart');
    if (!canvas || typeof Chart === 'undefined') return;
    const period = document.getElementById('donutPeriod') ? document.getElementById('donutPeriod').value : 'month';
    const txns = filterByPeriod(all, period).filter(t => t.type === 'expense');
    const grouped = {};
    for (let i = 0; i < txns.length; i++) {
      const t = txns[i];
      grouped[t.category] = (grouped[t.category] || 0) + parseFloat(t.amount || 0);
    }

    const sorted = Object.entries(grouped).sort((a, b) => b[1] - a[1]);
    const labels = sorted.map(x => x[0]);
    const values = sorted.map(x => x[1]);
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#0ea5e9'];
    const total = values.reduce((a, b) => a + b, 0);

    const legend = document.getElementById('donutLegend');
    if (legend) {
      if (!labels.length) {
        legend.innerHTML = '<div class="empty" style="padding:24px; text-align:center; color:var(--text-muted);"><p>No expense records</p></div>';
      } else {
        legend.innerHTML = labels.map((l, i) =>
          '<div class="leg-row"><div class="leg-dot" style="background:' + colors[i % colors.length] + '"></div><span class="leg-name">' + window.getFormattedOptionHtml(l, 13) + '</span><span class="leg-val">' + inrShort(values[i]) + '</span><span class="leg-pct">' + Math.round((values[i] / total) * 100) + '%</span></div>'
        ).join('');
        if (typeof lucide !== 'undefined') {
          lucide.createIcons();
        }
      }
    }

    if (!labels.length) {
      if (this.charts.donut) {
        this.charts.donut.destroy();
        this.charts.donut = null;
      }
      this.charts.donut = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: ['No Expenses'],
          datasets: [{
            data: [1],
            backgroundColor: ['rgba(15, 23, 42, 0.08)'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '68%',
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false }
          }
        }
      });
      return;
    }

    const datasets = [];
    const ringsCount = Math.min(4, labels.length);
    for (let i = 0; i < ringsCount; i++) {
      datasets.push({
        label: labels[i],
        data: [values[i], total - values[i]],
        backgroundColor: [colors[i % colors.length], 'rgba(15, 23, 42, 0.04)'],
        borderWidth: 2,
        borderColor: '#ffffff',
        hoverBorderColor: '#ffffff',
        borderRadius: 4,
        weight: 0.8
      });
    }

    if (this.charts.donut) {
      this.charts.donut.data.labels = labels.slice(0, ringsCount);
      this.charts.donut.data.datasets = datasets;
      this.charts.donut.update();
      return;
    }

    this.charts.donut = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: labels.slice(0, ringsCount),
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '50%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                const datasetLabel = ctx.dataset.label || '';
                const val = ctx.raw;
                if (ctx.dataIndex === 1) return null;
                return ' ' + datasetLabel + ': ' + inr(val);
              }
            }
          }
        }
      }
    });
  },

  buildPayModeChart: function (all) {
    const canvas = document.getElementById('payModeChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const grouped = {};
    for (let i = 0; i < all.length; i++) {
      const t = all[i];
      const mode = t.mode || 'Cash';
      grouped[mode] = (grouped[mode] || 0) + parseFloat(t.amount || 0);
    }

    const labels = Object.keys(grouped);
    const values = Object.values(grouped);

    if (!labels.length) {
      if (this.charts.payMode) {
        this.charts.payMode.destroy();
        this.charts.payMode = null;
      }
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const modeColorMap = {
      'upi': '#10b981',
      'card': '#f43f5e',
      'bank transfer': '#8b5cf6',
      'bank': '#8b5cf6',
      'cash': '#f59e0b',
      'online': '#06b6d4',
      'cheque': '#64748b'
    };
    const fallbackColors = ['#10b981', '#f43f5e', '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899'];
    const sliceColors = labels.map((l, idx) => {
      const key = String(l).toLowerCase().trim();
      for (const [k, v] of Object.entries(modeColorMap)) {
        if (key.includes(k)) return v;
      }
      return fallbackColors[idx % fallbackColors.length];
    });

    if (this.charts.payMode) {
      this.charts.payMode.data.labels = labels;
      this.charts.payMode.data.datasets[0].data = values;
      this.charts.payMode.data.datasets[0].backgroundColor = sliceColors;
      this.charts.payMode.update();
      return;
    }

    this.charts.payMode = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: sliceColors,
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverBorderColor: '#ffffff',
          borderRadius: 4,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.94)',
            titleColor: '#ffffff',
            bodyColor: '#cbd5e1',
            padding: 12,
            cornerRadius: 12,
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            titleFont: { family: "'Plus Jakarta Sans', sans-serif", weight: 'bold' },
            bodyFont: { family: "'Plus Jakarta Sans', sans-serif" },
            callbacks: {
              label: function (ctx) {
                const totalAmt = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct = totalAmt > 0 ? Math.round((ctx.parsed / totalAmt) * 100) : 0;
                return ' ' + ctx.label + ': ' + inr(ctx.parsed) + ' (' + pct + '%)';
              }
            }
          }
        }
      }
    });
  },

  buildLineChart: function (all) {
    const canvas = document.getElementById('lineChart');
    if (!canvas || typeof Chart === 'undefined') return;

    if (this.charts.line) {
      this.charts.line.destroy();
      this.charts.line = null;
    }

    const brandColor = themeColors.getBrand();
    const incomeColor = themeColors.getIncome();
    const expenseColor = themeColors.getExpense();
    const textMutedVal = themeColors.getTextMuted();
    const borderVal = themeColors.getBorder();

    const ctx = canvas.getContext('2d');

    if (this.lineChartTab === 'live') {
      const dataPoints = this.liveSalesData && this.liveSalesData.length ? this.liveSalesData : [
        { time: 'Ready', amount: 0 }
      ];

      const labels = dataPoints.map(dp => dp.time);
      const sales = dataPoints.map(dp => dp.amount);
      const totalSessionIncome = sales.reduce((a, b) => a + b, 0);

      this.setText('lineIncomeTotal', inr(totalSessionIncome));
      this.setText('lineExpenseTotal', inr(0));
      this.setText('lineNetTotal', inr(totalSessionIncome));
      const subtextEl = document.getElementById('lineChartSubtext');
      if (subtextEl) subtextEl.textContent = 'Session live sales stream';

      this.charts.line = new Chart(canvas, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Live Sales (₹)',
            data: sales,
            borderColor: brandColor,
            backgroundColor: 'rgba(99, 102, 241, 0.20)',
            borderWidth: 3,
            pointRadius: 4,
            pointHoverRadius: 7,
            pointBackgroundColor: brandColor,
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            fill: true,
            tension: 0.42
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 400 },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(15, 23, 42, 0.94)',
              titleColor: '#ffffff',
              bodyColor: '#cbd5e1',
              padding: 12,
              cornerRadius: 12,
              borderColor: borderVal + '33',
              borderWidth: 1,
              callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + inr(ctx.parsed.y) }
            }
          },
          scales: {
            x: { grid: { display: false }, border: { display: false }, ticks: { color: textMutedVal, font: { family: "'Plus Jakarta Sans', sans-serif", size: 10, weight: '600' } } },
            y: { beginAtZero: true, grid: { color: themeColors.getGridColor() }, border: { display: false }, ticks: { color: textMutedVal, font: { family: "'Plus Jakarta Sans', sans-serif", size: 11, weight: '600' }, callback: v => inrShort(v) } }
          }
        }
      });

    } else {
      const days = 7;
      const labels = [];
      const income = [];
      const expense = [];
      const net = [];
      const dateMap = {};

      for (let i = 0; i < all.length; i++) {
        const t = all[i];
        if (!dateMap[t.date]) dateMap[t.date] = { income: 0, expense: 0 };
        const amt = parseFloat(t.amount || 0);
        if (t.type === 'income') dateMap[t.date].income += amt;
        else if (t.type === 'expense') dateMap[t.date].expense += amt;
      }

      let runningNet = 0;
      let totalIncome = 0, totalExpense = 0;
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(new Date().getTime() - i * 24 * 60 * 60 * 1000);
        const parts = getISTDateParts(d);
        const ds = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
        labels.push(parts.day + '/' + parts.month);

        const dayData = dateMap[ds] || { income: 0, expense: 0 };
        income.push(dayData.income);
        expense.push(dayData.expense);

        runningNet += (dayData.income - dayData.expense);
        net.push(runningNet);

        totalIncome += dayData.income;
        totalExpense += dayData.expense;
      }

      this.setText('lineIncomeTotal', inr(totalIncome));
      this.setText('lineExpenseTotal', inr(totalExpense));
      this.setText('lineNetTotal', inr(totalIncome - totalExpense));
      const subtextEl = document.getElementById('lineChartSubtext');
      if (subtextEl) subtextEl.textContent = 'Last 7 days';

      const gradIncome = ctx.createLinearGradient(0, 0, 0, 260);
      gradIncome.addColorStop(0, 'rgba(16, 185, 129, 0.22)');
      gradIncome.addColorStop(1, 'rgba(16, 185, 129, 0.00)');

      const gradExpense = ctx.createLinearGradient(0, 0, 0, 260);
      gradExpense.addColorStop(0, 'rgba(244, 63, 94, 0.16)');
      gradExpense.addColorStop(1, 'rgba(244, 63, 94, 0.00)');

      const gradNet = ctx.createLinearGradient(0, 0, 0, 260);
      gradNet.addColorStop(0, 'rgba(139, 92, 246, 0.24)');
      gradNet.addColorStop(1, 'rgba(139, 92, 246, 0.00)');

      this.charts.line = new Chart(canvas, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Income', data: income,
              borderColor: incomeColor, backgroundColor: gradIncome,
              borderWidth: 2.5, pointRadius: 3, pointHoverRadius: 6,
              pointBackgroundColor: incomeColor, pointBorderColor: '#ffffff', pointBorderWidth: 2,
              fill: true, tension: 0.42
            },
            {
              label: 'Expense', data: expense,
              borderColor: expenseColor, backgroundColor: gradExpense,
              borderWidth: 2.5, pointRadius: 3, pointHoverRadius: 6,
              pointBackgroundColor: expenseColor, pointBorderColor: '#ffffff', pointBorderWidth: 2,
              fill: true, tension: 0.42
            },
            {
              label: 'Net Cash Flow', data: net,
              borderColor: brandColor, backgroundColor: gradNet,
              borderWidth: 3, pointRadius: 3.5, pointHoverRadius: 7,
              pointBackgroundColor: brandColor, pointBorderColor: '#ffffff', pointBorderWidth: 2,
              fill: true, tension: 0.42
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 600, easing: 'easeOutQuart' },
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(15, 23, 42, 0.94)',
              titleColor: '#ffffff',
              bodyColor: '#cbd5e1',
              padding: 12,
              cornerRadius: 12,
              borderColor: borderVal + '33',
              borderWidth: 1,
              titleFont: { family: "'Plus Jakarta Sans', sans-serif", weight: 'bold' },
              bodyFont: { family: "'Plus Jakarta Sans', sans-serif" },
              callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + inr(ctx.parsed.y) }
            }
          },
          scales: {
            x: { grid: { display: false }, border: { display: false }, ticks: { color: textMutedVal, font: { family: "'Plus Jakarta Sans', sans-serif", size: 10, weight: '600' }, maxRotation: 0 } },
            y: { beginAtZero: true, grid: { color: themeColors.getGridColor() }, border: { display: false }, ticks: { color: textMutedVal, font: { family: "'Plus Jakarta Sans', sans-serif", size: 11, weight: '600' }, callback: v => inrShort(v) } }
          }
        }
      });
    }
  },

  buildCompareChart: function (all) {
    const canvas = document.getElementById('compareChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const thisM = calcTotals(filterByPeriod(all, 'month'));
    const lastM = calcTotals(filterByPeriod(all, 'lastmonth'));

    const ctx = canvas.getContext('2d');

    if (this.charts.compare) {
      this.charts.compare.destroy();
      this.charts.compare = null;
    }

    const brandColor = themeColors.getBrand();
    const brandDarkColor = themeColors.getBrandDark();
    const textMutedVal = themeColors.getTextMuted();
    const borderVal = themeColors.getBorder();

    this.charts.compare = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['Income', 'Expense', 'Profit'],
        datasets: [
          {
            label: 'Last Month',
            data: [lastM.income, lastM.expense, lastM.profit],
            backgroundColor: 'rgba(148, 163, 184, 0.38)',
            borderColor: '#94a3b8',
            borderWidth: 1.5,
            borderRadius: 8,
            maxBarThickness: 26
          },
          {
            label: 'This Month',
            data: [thisM.income, thisM.expense, thisM.profit],
            backgroundColor: 'rgba(99, 102, 241, 0.78)',
            borderColor: '#6366f1',
            borderWidth: 1.5,
            borderRadius: 8,
            maxBarThickness: 26
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: {
              usePointStyle: true,
              pointStyle: 'circle',
              boxWidth: 7,
              boxHeight: 7,
              font: { size: 10, family: "'Plus Jakarta Sans', sans-serif", weight: '700' },
              color: textMutedVal,
              padding: 10
            }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.94)',
            titleColor: '#ffffff',
            bodyColor: '#cbd5e1',
            padding: 10,
            cornerRadius: 10,
            borderColor: borderVal + '33',
            borderWidth: 1,
            titleFont: { family: "'Plus Jakarta Sans', sans-serif", weight: 'bold' },
            bodyFont: { family: "'Plus Jakarta Sans', sans-serif" },
            callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + inr(ctx.parsed.y) }
          }
        },
        scales: {
          x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 10, family: "'Plus Jakarta Sans', sans-serif", weight: '700' }, color: textMutedVal } },
          y: { beginAtZero: true, grid: { color: themeColors.getGridColor(), borderDash: [3, 3], drawTicks: false }, border: { display: false }, ticks: { font: { size: 9, family: "'Plus Jakarta Sans', sans-serif", weight: '600' }, color: textMutedVal, callback: v => inrShort(v) } }
        }
      }
    });
  },


  buildSparklines: function (all) {
    if (typeof Chart === 'undefined') return;

    // Gather last 7 days date strings
    const dateStrings = [];
    const dateLabels = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(new Date().getTime() - i * 24 * 60 * 60 * 1000);
      const parts = getISTDateParts(d);
      const ds = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
      dateStrings.push(ds);
      dateLabels.push(parts.day + '/' + parts.month);
    }

    const incomeData = new Array(7).fill(0);
    const expenseData = new Array(7).fill(0);
    const profitData = new Array(7).fill(0);
    const balanceData = new Array(7).fill(0);
    const savingsRateData = new Array(7).fill(0);

    const dateMap = {};
    all.forEach(t => {
      if (!t.date) return;
      if (!dateMap[t.date]) dateMap[t.date] = { income: 0, expense: 0 };
      const amt = parseFloat(t.amount || 0);
      if (t.type === 'income') dateMap[t.date].income += amt;
      else if (t.type === 'expense') dateMap[t.date].expense += amt;
    });

    let balance = 0;
    const windowStart = dateStrings[0];
    const sortedAll = all.slice().sort((a, b) => a.date.localeCompare(b.date));
    const dailyBalances = {};

    sortedAll.forEach(t => {
      const amt = parseFloat(t.amount || 0);
      if (t.type === 'income') balance += amt;
      else if (t.type === 'expense') balance -= amt;
      dailyBalances[t.date] = balance;
    });

    let lastRunningBalance = 0;
    const firstDateIndex = sortedAll.findIndex(t => t.date >= windowStart);
    if (firstDateIndex > 0) {
      const prevTxn = sortedAll[firstDateIndex - 1];
      lastRunningBalance = dailyBalances[prevTxn.date] || 0;
    } else if (firstDateIndex === -1 && sortedAll.length > 0) {
      lastRunningBalance = balance;
    }

    dateStrings.forEach((ds, idx) => {
      const dayData = dateMap[ds] || { income: 0, expense: 0 };
      incomeData[idx] = dayData.income;
      expenseData[idx] = dayData.expense;
      profitData[idx] = dayData.income - dayData.expense;

      if (dailyBalances[ds] !== undefined) {
        lastRunningBalance = dailyBalances[ds];
      }
      balanceData[idx] = lastRunningBalance;

      const inc = dayData.income;
      const exp = dayData.expense;
      const rate = inc > 0 ? Math.round(((inc - exp) / inc) * 100) : 0;
      savingsRateData[idx] = Math.max(0, rate);
    });

    // Current month sparkline data (Month-over-Month trend for past 6 months)
    const curNow = (typeof getISTDateObject === 'function') ? getISTDateObject() : new Date();
    const curParts = (typeof getISTDateParts === 'function') ? getISTDateParts(curNow) : { year: curNow.getFullYear(), month: curNow.getMonth() + 1, day: curNow.getDate() };
    const curYear = curParts.year;
    const curMonth = curParts.month;

    const monthShortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const curMonthLabels = [];
    const curMonthKeys = [];
    for (let i = 5; i >= 0; i--) {
      let m = curMonth - i;
      let y = curYear;
      if (m <= 0) {
        m += 12;
        y -= 1;
      }
      curMonthLabels.push(monthShortNames[m - 1]);
      curMonthKeys.push(`${y}-${String(m).padStart(2, '0')}`);
    }

    const curMonthIncome = new Array(6).fill(0);
    const curMonthExpense = new Array(6).fill(0);
    const curMonthSavingsRate = new Array(6).fill(0);

    for (let i = 0; i < all.length; i++) {
      const t = all[i];
      if (!t.date) continue;
      const ym = t.date.substring(0, 7);
      const mIdx = curMonthKeys.indexOf(ym);
      if (mIdx !== -1) {
        const amt = parseFloat(t.amount || 0);
        if (t.type === 'income') curMonthIncome[mIdx] += amt;
        else if (t.type === 'expense') curMonthExpense[mIdx] += amt;
      }
    }

    for (let i = 0; i < 6; i++) {
      const inc = curMonthIncome[i];
      const exp = curMonthExpense[i];
      const rate = inc > 0 ? Math.round(((inc - exp) / inc) * 100) : 0;
      curMonthSavingsRate[i] = Math.max(0, rate);
    }

    const sparkConfigs = [
      { id: 'sparklineIncome', data: incomeData, labels: dateLabels, color: themeColors.getIncome(), label: 'Income', chartKey: 'sparkIncome' },
      { id: 'sparklineExpense', data: expenseData, labels: dateLabels, color: themeColors.getExpense(), label: 'Expense', chartKey: 'sparkExpense' },
      { id: 'sparklineProfit', data: profitData, labels: dateLabels, color: themeColors.getProfit(), label: 'Profit', chartKey: 'sparkProfit' },
      { id: 'sparklineBalance', data: balanceData, labels: dateLabels, color: themeColors.getBrand(), label: 'Balance', chartKey: 'sparkBalance' },
      { id: 'sparklineAvgIncome', data: incomeData, labels: dateLabels, color: themeColors.getIncome(), label: 'Avg Income', chartKey: 'sparkAvgIncome' },
      { id: 'sparklineAvgExpense', data: expenseData, labels: dateLabels, color: themeColors.getExpense(), label: 'Avg Expense', chartKey: 'sparkAvgExpense' },
      { id: 'sparklineSavingsRate', data: savingsRateData, labels: dateLabels, color: themeColors.getPurple(), label: 'Savings Rate', chartKey: 'sparkSavings' },
      { id: 'sparklineAvgIncomeMonth', data: curMonthIncome, labels: curMonthLabels, color: themeColors.getIncome(), label: 'Avg Income / Month', chartKey: 'sparkAvgIncomeMonth' },
      { id: 'sparklineAvgExpenseMonth', data: curMonthExpense, labels: curMonthLabels, color: themeColors.getExpense(), label: 'Avg Expense / Month', chartKey: 'sparkAvgExpenseMonth' },
      { id: 'sparklineSavingsRateMonth', data: curMonthSavingsRate, labels: curMonthLabels, color: themeColors.getPurple(), label: 'Savings Rate / Month', chartKey: 'sparkSavingsMonth' }
    ];

    sparkConfigs.forEach(conf => {
      const canvas = document.getElementById(conf.id);
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const gradient = ctx.createLinearGradient(0, 0, 0, 45);
      gradient.addColorStop(0, conf.color + '26');
      gradient.addColorStop(1, conf.color + '00');

      if (this.charts[conf.chartKey]) {
        this.charts[conf.chartKey].destroy();
        this.charts[conf.chartKey] = null;
      }

      this.charts[conf.chartKey] = new Chart(canvas, {
        type: 'line',
        data: {
          labels: conf.labels || dateLabels,
          datasets: [{
            data: conf.data,
            borderColor: conf.color,
            backgroundColor: gradient,
            borderWidth: 1.8,
            pointRadius: function(ctx) {
              const dataArr = (ctx && ctx.chart && ctx.chart.data && ctx.chart.data.datasets && ctx.chart.data.datasets[0]) ? ctx.chart.data.datasets[0].data : [];
              const countNonZero = dataArr.filter(v => v > 0).length;
              return countNonZero <= 2 ? 3 : 0;
            },
            pointHoverRadius: 4,
            fill: true,
            tension: 0.45
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 500 },
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false }
          },
          scales: {
            x: { display: false },
            y: { display: false }
          }
        }
      });
    });
  },

  toggleNotifDropdown: function () {
    const dropdown = document.getElementById('notifDropdown');
    if (!dropdown) return;
    const isClosed = dropdown.style.display === 'none' || !dropdown.style.display;
    dropdown.style.display = isClosed ? 'block' : 'none';

    if (isClosed) {
      let notifs = [];
      try {
        notifs = JSON.parse(localStorage.getItem('bd_notifications') || '[]');
      } catch (e) { }
      notifs.forEach(n => n.read = true);
      localStorage.setItem('bd_notifications', JSON.stringify(notifs));
      this.updateNotifBadge(notifs);
      this.loadNotifications();
    }
  },

  addNotification: function (type, title, message) {
    let notifs = [];
    try {
      notifs = JSON.parse(localStorage.getItem('bd_notifications') || '[]');
    } catch (e) { }

    const n = {
      id: 'notif_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      type: type || 'info',
      title: title,
      message: message,
      time: new Date().toISOString(),
      read: false
    };

    notifs.unshift(n);
    if (notifs.length > 15) notifs = notifs.slice(0, 15);

    localStorage.setItem('bd_notifications', JSON.stringify(notifs));
    this.updateNotifBadge(notifs);
    this.loadNotifications();
  },

  clearNotifs: function () {
    localStorage.setItem('bd_notifications', '[]');
    this.updateNotifBadge([]);
    this.loadNotifications();
  },

  updateNotifBadge: function (notifs) {
    const badge = document.getElementById('notifBadge');
    if (!badge) return;
    const unreadCount = notifs.filter(n => !n.read).length;
    if (unreadCount > 0) {
      badge.textContent = unreadCount;
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }
  },

  loadNotifications: function () {
    const body = document.getElementById('notifBody');
    if (!body) return;

    let notifs = [];
    try {
      notifs = JSON.parse(localStorage.getItem('bd_notifications') || '[]');
    } catch (e) { }

    this.updateNotifBadge(notifs);

    if (!notifs.length) {
      body.innerHTML = '<div style="padding:24px; text-align:center; color:var(--text-muted); font-size:0.8rem;">🔔 No new notifications</div>';
      return;
    }

    body.innerHTML = notifs.map(n => {
      const d = new Date(n.time);
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      let icon = 'ℹ️';
      if (n.type === 'success') icon = '🟢';
      else if (n.type === 'danger') icon = '🚨';
      else if (n.type === 'warn') icon = '⚠️';

      const unreadStyle = !n.read ? 'background:rgba(163,150,255,0.04); font-weight:600;' : '';

      return `
        <div class="notif-item" style="padding:10px 18px; border-bottom:1.5px solid var(--border); display:flex; gap:12px; font-size:0.78rem; transition:var(--tr); ${unreadStyle}">
          <span style="font-size:1.1rem; flex-shrink:0;">${icon}</span>
          <div style="flex:1;">
            <div style="color:var(--text-head); font-weight:800; margin-bottom:2px;">${n.title}</div>
            <div style="color:var(--text-light); line-height:1.3; font-weight:450;">${n.message}</div>
            <div style="color:var(--text-muted); font-size:0.68rem; margin-top:4px;">${timeStr}</div>
          </div>
        </div>
      `;
    }).join('');
  },

  seedRealisticData: function () {
    const txns = [];
    const categories = {
      income: ['💰 Cash Income', '📱 Online Payment', '🛒 Sales', '↩️ Refund Received', '📈 Investment Return', '🎁 Gift / Bonus', '🛵 Swiggy', '🛵 Zomato', '📦 Other Income'],
      expense: ['🧾 Electricity Bill', '📡 Internet Bill', '📱 Mobile Bill', '🏠 Rent', '🛒 Grocery', '🥦 Vegetables', '🍞 Bread / Bakery', '🍔 Food & Dining', '🚗 Transport', '⛽ Fuel', '👥 Salary', '🔨 Maintenance', '📢 Marketing', '📦 Supplies', '📋 Tax', '↩️ Refund Given', '💸 Other Expense']
    };
    const notes = {
      '🛒 Sales': ['🍕 Margherita Pizza', '🍕 Pepperoni Pizza', '🍕 Veggie Supreme Pizza', '🥤 Classic Cold Coffee', '🍟 Crispy French Fries', '🍧 Chilly Vanilla Ice Cream', '🍰 Sizzling Chocolate Brownie'],
      '📦 Supplies': ['🧀 Mozzarella Cheese restock', '🍅 Fresh Vegetables supply', '📦 Pizza Boxes pack', '🥤 Cups and Straws restock'],
      '👥 Salary': ['Staff salary (Part-time)', 'Helper weekly wages'],
      '🧾 Electricity Bill': ['Electricity power bill payment'],
      '🔨 Maintenance': ['Oven cleaning service', 'Kitchen chimney filter repair'],
      '🍔 Food & Dining': ['Staff lunch', 'Tea & snacks for team']
    };

    const customers = ['Aditya Sharma', 'Priya Patel', 'Rahul Verma', 'Sneha Reddy', 'Amit Gupta', 'Neha Sen', 'Rohan Das', 'Anjali Nair'];
    const vendors = ['Dairyland Cheese', 'Organic Veggies Ltd', 'Packaging Pro', 'Local Supermart', 'Chef Warehouse'];

    let currentBalance = 0;

    for (let i = 83; i >= 1; i--) {
      const daysAgo = Math.floor(i / 2.8);
      const d = new Date(new Date().getTime() - daysAgo * 24 * 60 * 60 * 1000);
      const parts = getISTDateParts(d);
      const dateStr = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;

      const type = Math.random() < 0.72 ? 'income' : 'expense';
      const cat = categories[type][Math.floor(Math.random() * categories[type].length)];
      const mode = ['UPI', 'Cash', 'Card', 'Bank Transfer'][Math.floor(Math.random() * 4)];

      let amount = 0;
      if (type === 'income') {
        amount = Math.floor(Math.random() * 400) + 150;
      } else {
        amount = Math.floor(Math.random() * 600) + 80;
      }

      const noteList = notes[cat] || ['Misc ' + type];
      const note = noteList[Math.floor(Math.random() * noteList.length)];
      const entity = type === 'income'
        ? customers[Math.floor(Math.random() * customers.length)]
        : vendors[Math.floor(Math.random() * vendors.length)];

      txns.push({
        id: 't_seed_' + i,
        type,
        date: dateStr,
        category: cat,
        amount,
        mode,
        from: type === 'income' ? entity : '',
        vendor: type === 'expense' ? entity : '',
        notes: note,
        savedAt: new Date(d).toISOString()
      });

      if (type === 'income') currentBalance += amount;
      else currentBalance -= amount;
    }

    const targetBalance = 31155;
    const diff = targetBalance - currentBalance;
    const adjustType = diff >= 0 ? 'income' : 'expense';
    const adjustAmt = Math.abs(diff);

    const d = new Date();
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    txns.push({
      id: 't_seed_84',
      type: adjustType,
      date: dateStr,
      category: adjustType === 'income' ? '🛒 Sales' : '📦 Supplies',
      amount: adjustAmt,
      mode: 'UPI',
      from: adjustType === 'income' ? 'Sanket Barot' : '',
      vendor: adjustType === 'expense' ? 'Dairyland Cheese' : '',
      notes: adjustType === 'income' ? '✨ Special catering order payout' : '🧀 Bulk Mozzarella Cheese adjustment purchase',
      savedAt: new Date().toISOString()
    });

    localStorage.setItem(APP.storageKey, JSON.stringify(txns));
    if (typeof currentTxns !== 'undefined') currentTxns = txns;
    if (typeof window !== 'undefined') window.currentTxns = txns;
    return txns;
  },

  setupSearch: function () {
    const input = document.getElementById('headerSearch');
    if (!input) return;
    const self = this;
    const handler = debounce(function (e) {
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

  setText: function (id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  },

  loadGoals: function (all) {
    const revTarget = parseFloat(localStorage.getItem('vision_revenue_target') || '150000');
    const expCap = parseFloat(localStorage.getItem('vision_expense_cap') || '60000');
    const prfTarget = parseFloat(localStorage.getItem('vision_profit_target') || '1000000');

    const parts = getISTDateParts();
    const currentYear = parts.year;
    const currentMonthStr = `${currentYear}-${String(parts.month).padStart(2, '0')}`;

    let mtdIncome = 0;
    let mtdExpense = 0;
    let ytdIncome = 0;
    let ytdExpense = 0;

    all.forEach(t => {
      if (t.date) {
        const amt = parseFloat(t.amount) || 0;
        if (t.date.substring(0, 7) === currentMonthStr) {
          if (t.type === 'income') mtdIncome += amt;
          else if (t.type === 'expense') mtdExpense += amt;
        }
        if (t.date.substring(0, 4) === String(currentYear)) {
          if (t.type === 'income') ytdIncome += amt;
          else if (t.type === 'expense') ytdExpense += amt;
        }
      }
    });

    const ytdProfit = ytdIncome - ytdExpense;
    const revPct = revTarget > 0 ? (mtdIncome / revTarget) * 100 : 0;
    const expPct = expCap > 0 ? (mtdExpense / expCap) * 100 : 0;
    const prfPct = prfTarget > 0 ? (ytdProfit / prfTarget) * 100 : 0;

    this.setText('goalRevTarget', inr(revTarget));
    this.setText('goalRevCurrent', inr(mtdIncome));
    this.setText('goalRevPct', Math.round(revPct) + '%');
    const revBar = document.getElementById('goalRevBar');
    if (revBar) revBar.style.width = Math.min(100, Math.max(0, revPct)) + '%';
    const revStatusEl = document.getElementById('goalRevStatus');
    if (revStatusEl) {
      if (mtdIncome >= revTarget) {
        revStatusEl.textContent = '🎉 Monthly revenue target achieved!';
        revStatusEl.style.color = 'var(--income)';
      } else {
        revStatusEl.textContent = `₹ ${inrShort(revTarget - mtdIncome)} remaining to hit target`;
        revStatusEl.style.color = 'var(--text-light)';
      }
    }

    this.setText('goalExpTarget', inr(expCap));
    this.setText('goalExpCurrent', inr(mtdExpense));
    this.setText('goalExpPct', Math.round(expPct) + '%');
    const expBar = document.getElementById('goalExpBar');
    if (expBar) expBar.style.width = Math.min(100, Math.max(0, expPct)) + '%';
    const expStatusEl = document.getElementById('goalExpStatus');
    if (expStatusEl) {
      if (mtdExpense > expCap) {
        expStatusEl.textContent = '🚨 Over monthly expense budget limit!';
        expStatusEl.style.color = 'var(--expense)';
      } else {
        expStatusEl.textContent = `₹ ${inrShort(expCap - mtdExpense)} remaining before limit`;
        expStatusEl.style.color = 'var(--text-light)';
      }
    }

    this.setText('goalPrfTarget', inr(prfTarget));
    this.setText('goalPrfCurrent', inr(ytdProfit));
    this.setText('goalPrfPct', Math.round(prfPct) + '%');
    const prfBar = document.getElementById('goalPrfBar');
    if (prfBar) prfBar.style.width = Math.min(100, Math.max(0, prfPct)) + '%';
    const prfStatusEl = document.getElementById('goalPrfStatus');
    if (prfStatusEl) {
      if (ytdProfit >= prfTarget) {
        prfStatusEl.textContent = '🏆 Milestone achieved!';
        prfStatusEl.style.color = 'var(--purple)';
      } else {
        prfStatusEl.textContent = `₹ ${inrShort(prfTarget - ytdProfit)} remaining for milestone`;
        prfStatusEl.style.color = 'var(--text-light)';
      }
    }

    // ============================================
    // DAILY REVENUE RUN RATE & PACE CALCULATION
    // ============================================
    const todayStr = today();
    const currentDay = parts.day;
    const daysInMonth = new Date(currentYear, parts.month, 0).getDate();
    const remainingDays = Math.max(1, daysInMonth - currentDay + 1);
    const elapsedDays = Math.max(1, currentDay);

    let todayIncome = 0;
    all.forEach(t => {
      if (t.type === 'income' && t.date === todayStr) {
        todayIncome += (parseFloat(t.amount) || 0);
      }
    });

    const remainingToRevTarget = Math.max(0, revTarget - mtdIncome);
    const requiredDailyPace = revTarget > 0 ? (remainingToRevTarget / remainingDays) : 0;
    const currentDailyPace = mtdIncome / elapsedDays;
    const projectedMonthEnd = mtdIncome + (currentDailyPace * Math.max(0, daysInMonth - currentDay));

    const paceDaysLeftEl = document.getElementById('paceDaysLeftText');
    if (paceDaysLeftEl) {
      paceDaysLeftEl.textContent = `Day ${currentDay} of ${daysInMonth} • ${Math.max(0, daysInMonth - currentDay)} day${(daysInMonth - currentDay) === 1 ? '' : 's'} remaining`;
    }

    this.setText('paceRequired', `${inr(requiredDailyPace)} / day`);
    this.setText('paceCurrent', `${inr(currentDailyPace)} / day`);
    this.setText('paceTodayRev', inr(todayIncome));
    this.setText('paceProjected', inr(projectedMonthEnd));

    const todayPacePct = requiredDailyPace > 0 ? Math.round((todayIncome / requiredDailyPace) * 100) : (mtdIncome >= revTarget ? 100 : 0);
    const todayPctTextEl = document.getElementById('paceTodayPct');
    if (todayPctTextEl) {
      todayPctTextEl.textContent = `${todayPacePct}% of daily target`;
    }

    const todayBarTextEl = document.getElementById('paceTodayBarText');
    if (todayBarTextEl) {
      todayBarTextEl.textContent = `${inr(todayIncome)} / ${inr(requiredDailyPace)} (${todayPacePct}%)`;
    }

    const todayBarEl = document.getElementById('paceTodayBar');
    if (todayBarEl) {
      todayBarEl.style.width = `${Math.min(100, Math.max(0, todayPacePct))}%`;
      if (todayPacePct >= 100) {
        todayBarEl.style.background = 'var(--income)';
      } else if (todayPacePct >= 70) {
        todayBarEl.style.background = 'linear-gradient(90deg, #3b82f6 0%, #10b981 100%)';
      } else {
        todayBarEl.style.background = 'linear-gradient(90deg, #f59e0b 0%, #3b82f6 100%)';
      }
    }

    const badgeEl = document.getElementById('paceStatusBadge');
    if (badgeEl) {
      if (mtdIncome >= revTarget) {
        badgeEl.innerHTML = `<span class="badge-pulse-green" style="font-size:0.72rem; font-weight:800; padding:4px 10px; border-radius:var(--r-full); background:rgba(16,185,129,0.15); color:var(--income); display:inline-flex; align-items:center; gap:4px;"><i data-lucide="trophy" style="width:12px; height:12px;"></i> Target Achieved! 🎉</span>`;
      } else if (currentDailyPace >= requiredDailyPace) {
        badgeEl.innerHTML = `<span class="badge-pulse-green" style="font-size:0.72rem; font-weight:800; padding:4px 10px; border-radius:var(--r-full); background:rgba(16,185,129,0.12); color:var(--income); display:inline-flex; align-items:center; gap:4px;"><i data-lucide="trending-up" style="width:12px; height:12px;"></i> Ahead of Pace 🚀</span>`;
      } else if (currentDailyPace >= requiredDailyPace * 0.8) {
        badgeEl.innerHTML = `<span style="font-size:0.72rem; font-weight:800; padding:4px 10px; border-radius:var(--r-full); background:rgba(245,158,11,0.12); color:#d97706; display:inline-flex; align-items:center; gap:4px;"><i data-lucide="activity" style="width:12px; height:12px;"></i> Close to Target Pace ⚡</span>`;
      } else {
        const gap = Math.round(requiredDailyPace - currentDailyPace);
        badgeEl.innerHTML = `<span class="badge-pulse-red" style="font-size:0.72rem; font-weight:800; padding:4px 10px; border-radius:var(--r-full); background:rgba(244,63,94,0.12); color:var(--expense); display:inline-flex; align-items:center; gap:4px;"><i data-lucide="alert-circle" style="width:12px; height:12px;"></i> Need +${inr(gap)}/day Boost</span>`;
      }
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  },

  loadCategoryBudgets: function (all) {
    const grid = document.getElementById('categoryBudgetGrid');
    if (!grid) return;

    const budgets = getBudgets();
    const parts = getISTDateParts();
    const currentMonthStr = `${parts.year}-${String(parts.month).padStart(2, '0')}`;

    // Helper to strip emoji for robust fallback matching
    const stripEmoji = (str) => (str || '').replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDC00-\uDFFF]/g, '').trim().toLowerCase();

    // Calculate current month's spending per category
    const mtdCatSpend = {};
    const mtdCatSpendClean = {};
    all.forEach(t => {
      if (t.type === 'expense' && t.date && t.date.substring(0, 7) === currentMonthStr) {
        const cat = (t.category || 'Other Expense').trim();
        const amt = parseFloat(t.amount) || 0;
        mtdCatSpend[cat] = (mtdCatSpend[cat] || 0) + amt;
        const clean = stripEmoji(cat);
        mtdCatSpendClean[clean] = (mtdCatSpendClean[clean] || 0) + amt;
      }
    });

    const badgeEl = document.getElementById('budgetTotalBadge');
    if (badgeEl) badgeEl.textContent = `${budgets.length} Active Budget${budgets.length === 1 ? '' : 's'}`;

    if (!budgets || budgets.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 36px 20px; text-align: center; background: var(--bg-app); border: 1.5px dashed var(--border); border-radius: var(--r-lg);">
          <div style="display:flex; justify-content:center; margin-bottom:10px;"><i data-lucide="pie-chart" style="width:36px; height:36px; color:var(--brand);"></i></div>
          <h4 style="font-size:0.95rem; font-weight:700; color:var(--text-head); margin-bottom:4px;">No Category Budgets Set</h4>
          <p style="font-size:0.8rem; color:var(--text-muted); max-width:400px; margin:0 auto 16px;">Set monthly spending limits for categories like Raw Materials, Utilities, Marketing, etc. to monitor overspending in real-time.</p>
          <button class="btn btn-primary btn-sm" onclick="openBudgetModal()" style="display:inline-flex; align-items:center; gap:6px;">
            <i data-lucide="plus-circle" style="width:15px; height:15px;"></i>Set First Category Budget
          </button>
        </div>
      `;
      this.setText('totalBudgetAllocated', '₹ 0.00');
      this.setText('totalBudgetSpent', '₹ 0.00');
      this.setText('totalBudgetRemaining', '₹ 0.00');
      const healthEl = document.getElementById('budgetHealthStatus');
      if (healthEl) healthEl.innerHTML = `<span style="display:inline-flex; align-items:center; gap:5px; color:var(--text-muted);"><i data-lucide="info" style="width:16px;height:16px;"></i> Not Configured</span>`;
      if (typeof lucide !== 'undefined') lucide.createIcons();
      return;
    }

    let totalAllocated = 0;
    let totalSpentInBudgets = 0;
    let anyOverBudget = false;
    let anyWarning = false;

    // Calculate overall totals first regardless of search or filter
    budgets.forEach(bgt => {
      const cat = bgt.category;
      const limit = parseFloat(bgt.amount) || 0;
      const clean = stripEmoji(cat);
      const spent = mtdCatSpend[cat] !== undefined ? mtdCatSpend[cat] : (mtdCatSpendClean[clean] || 0);
      totalAllocated += limit;
      totalSpentInBudgets += spent;
      if (spent > limit) anyOverBudget = true;
      else if (limit > 0 && (spent / limit) >= 0.75) anyWarning = true;
    });

    // Filter by tab and search
    let displayBudgets = budgets.slice();
    if (this.activeBudgetFilter && this.activeBudgetFilter !== 'all') {
      displayBudgets = displayBudgets.filter(bgt => {
        const cat = bgt.category;
        const limit = parseFloat(bgt.amount) || 0;
        const clean = stripEmoji(cat);
        const spent = mtdCatSpend[cat] !== undefined ? mtdCatSpend[cat] : (mtdCatSpendClean[clean] || 0);
        const pct = limit > 0 ? (spent / limit) * 100 : 0;
        const isOver = spent > limit;
        const isWarn = !isOver && pct >= 75;
        if (this.activeBudgetFilter === 'over') return isOver;
        if (this.activeBudgetFilter === 'warn') return isWarn;
        if (this.activeBudgetFilter === 'safe') return !isOver && !isWarn;
        return true;
      });
    }

    if (this.budgetSearchQuery) {
      const q = this.budgetSearchQuery.toLowerCase();
      displayBudgets = displayBudgets.filter(bgt => (bgt.category || '').toLowerCase().includes(q));
    }

    if (displayBudgets.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 28px 16px; text-align: center; background: var(--bg-app); border: 1.5px dashed var(--border); border-radius: var(--r-lg);">
          <div style="font-size:1.6rem; margin-bottom:6px;">🔍</div>
          <div style="font-size:0.88rem; font-weight:700; color:var(--text-head); margin-bottom:4px;">No matching category budgets</div>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:12px;">Try adjusting your search query or reset filter to "All".</div>
          <button class="btn btn-outline btn-xs" onclick="Dash.filterBudgets('all', document.querySelector('.filter-chip-btn[data-budget-filter=\\'all\\']')); const si = document.getElementById('budgetSearchInput'); if (si) { si.value = ''; Dash.searchBudgets(''); }">Reset Filter</button>
        </div>
      `;
    } else {
      const cardsHtml = displayBudgets.map(bgt => {
        const cat = bgt.category;
        const limit = parseFloat(bgt.amount) || 0;
        const clean = stripEmoji(cat);
        const spent = mtdCatSpend[cat] !== undefined ? mtdCatSpend[cat] : (mtdCatSpendClean[clean] || 0);

        const pct = limit > 0 ? (spent / limit) * 100 : 0;
        const roundedPct = Math.round(pct);
        const isOver = spent > limit;
        const isWarn = !isOver && pct >= 75;
        const remaining = Math.max(0, limit - spent);
        const overspentAmt = isOver ? (spent - limit) : 0;

        // Status Badge & Classes
        let statusHtml = '';
        let statusClass = 'status-safe';
        let barColor = 'linear-gradient(90deg, #10b981 0%, #34d399 100%)';

        if (isOver) {
          statusClass = 'status-over';
          barColor = 'linear-gradient(90deg, #f43f5e 0%, #fb7185 100%)';
          statusHtml = `<span class="bgt-status-badge over"><i data-lucide="alert-triangle" style="width:11px; height:11px;"></i> Over by ${inr(overspentAmt)}</span>`;
        } else if (isWarn) {
          statusClass = 'status-warn';
          barColor = 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)';
          statusHtml = `<span class="bgt-status-badge warn"><i data-lucide="alert-circle" style="width:11px; height:11px;"></i> ${roundedPct}% Used</span>`;
        } else {
          statusClass = 'status-safe';
          statusHtml = `<span class="bgt-status-badge safe"><i data-lucide="check-circle" style="width:11px; height:11px;"></i> Safe (${roundedPct}%)</span>`;
        }

        const iconName = window.getLucideIconName(cat) || 'package';
        const cleanName = cat.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDC00-\uDFFF]/g, '').trim();
        const safeCat = encodeURIComponent(cat);

        return `
          <div class="category-budget-card ${statusClass}">
            <div>
              <!-- Top Header: Category Info & Status -->
              <div class="bgt-card-header">
                <div class="bgt-header-info">
                  <div class="bgt-avatar-icon">
                    <i data-lucide="${iconName}" style="width:18px; height:18px;"></i>
                  </div>
                  <div class="bgt-title-meta">
                    <div class="bgt-category-name" title="${escapeHtml(cleanName)}">${escapeHtml(cleanName)}</div>
                    <div class="bgt-target-tag">Monthly Target</div>
                  </div>
                </div>
                <div>${statusHtml}</div>
              </div>

              <!-- Figures Box -->
              <div class="bgt-figures-box">
                <div>
                  <div class="bgt-fig-label">MTD Spent</div>
                  <div class="bgt-fig-spent ${isOver ? 'over' : (isWarn ? 'warn' : '')}">${inr(spent)}</div>
                </div>
                <div class="bgt-fig-meta">
                  <div class="bgt-fig-label">Limit</div>
                  <div class="bgt-fig-limit">${inr(limit)}</div>
                </div>
              </div>

              <!-- Progress Track -->
              <div class="bgt-progress-track">
                <div class="bgt-progress-bar" style="width:${Math.min(100, Math.max(0, pct))}%; background:${barColor};"></div>
              </div>
            </div>

            <!-- Bottom Footer Toolbar -->
            <div class="bgt-card-footer">
              <div class="bgt-footer-status">
                ${isOver ? `
                  <span style="display:inline-flex; align-items:center; gap:4px; color:var(--expense); font-weight:700;">
                    <i data-lucide="alert-triangle" style="width:12px; height:12px;"></i> Exceeded by ${inr(overspentAmt)}
                  </span>
                ` : `
                  <span style="display:inline-flex; align-items:center; gap:4px; color:var(--text-light); font-weight:600;">
                    <i data-lucide="sparkles" style="width:12px; height:12px; color:#10b981;"></i> ${inr(remaining)} remaining
                  </span>
                `}
              </div>
              <button class="bgt-edit-btn" onclick="editCategoryBudget(decodeURIComponent('${safeCat}'), ${limit})" title="Adjust Limit for ${escapeHtml(cleanName)}">
                <i data-lucide="sliders-horizontal" style="width:12px; height:12px;"></i>
                <span>Adjust</span>
              </button>
            </div>
          </div>
        `;
      }).join('');

      grid.innerHTML = cardsHtml;
    }

    // Update Summary Row
    const remainingTotal = Math.max(0, totalAllocated - totalSpentInBudgets);
    this.setText('totalBudgetAllocated', inr(totalAllocated));
    this.setText('totalBudgetSpent', inr(totalSpentInBudgets));
    this.setText('totalBudgetRemaining', inr(remainingTotal));

    const healthEl = document.getElementById('budgetHealthStatus');
    if (healthEl) {
      if (anyOverBudget) {
        healthEl.innerHTML = `<span style="display:inline-flex; align-items:center; gap:5px; color:var(--expense);"><i data-lucide="alert-octagon" style="width:16px;height:16px;"></i> Attention Needed</span>`;
      } else if (anyWarning) {
        healthEl.innerHTML = `<span style="display:inline-flex; align-items:center; gap:5px; color:#f59e0b;"><i data-lucide="alert-triangle" style="width:16px;height:16px;"></i> Approaching Limits</span>`;
      } else {
        healthEl.innerHTML = `<span style="display:inline-flex; align-items:center; gap:5px; color:var(--income);"><i data-lucide="shield-check" style="width:16px;height:16px;"></i> All on Track</span>`;
      }
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Check Reminders for overspent budgets
    this.checkBudgetReminders(budgets, mtdCatSpend, currentMonthStr);
  },

  loadVendors: function () {
    const grid = document.getElementById('vendorGrid');
    if (!grid) return;

    const vendors = getVendors();
    const currentMonthStr = typeof today === 'function' ? today().substring(0, 7) : new Date().toISOString().substring(0, 7);

    let totalPending = 0;
    let totalBilled = 0;
    let totalPaid = 0;
    let monthlyBilled = 0;
    let monthlyPaid = 0;
    let pendingCount = 0;

    vendors.forEach(v => {
      const billed = parseFloat(v.totalAmount) || 0;
      const paid = parseFloat(v.paidAmount) || 0;
      const pending = Math.max(0, billed - paid);
      totalBilled += billed;
      totalPaid += paid;
      totalPending += pending;
      if (pending > 0) pendingCount++;

      // Monthly Purchases Calculation
      const historyPurchases = Array.isArray(v.history)
        ? v.history.filter(h => h.type === 'purchase')
        : [];
      if (historyPurchases.length > 0) {
        monthlyBilled += historyPurchases
          .filter(h => h.date && h.date.startsWith(currentMonthStr))
          .reduce((sum, h) => sum + (parseFloat(h.amount) || 0), 0);

        const totalHistPurchased = historyPurchases.reduce((sum, h) => sum + (parseFloat(h.amount) || 0), 0);
        const initialAmtDiff = Math.max(0, billed - totalHistPurchased);
        if (initialAmtDiff > 0 && v.date && v.date.startsWith(currentMonthStr)) {
          monthlyBilled += initialAmtDiff;
        }
      } else {
        if (v.date && v.date.startsWith(currentMonthStr)) {
          monthlyBilled += billed;
        }
      }

      // Monthly Payments Calculation
      const historyPayments = Array.isArray(v.history)
        ? v.history.filter(h => h.type === 'payment')
        : [];
      if (historyPayments.length > 0) {
        monthlyPaid += historyPayments
          .filter(h => h.date && h.date.startsWith(currentMonthStr))
          .reduce((sum, h) => sum + (parseFloat(h.amount) || 0), 0);

        const totalHistPaid = historyPayments.reduce((sum, h) => sum + (parseFloat(h.amount) || 0), 0);
        const diffPaid = Math.max(0, paid - totalHistPaid);
        if (diffPaid > 0 && v.date && v.date.startsWith(currentMonthStr)) {
          monthlyPaid += diffPaid;
        }
      } else {
        if (v.date && v.date.startsWith(currentMonthStr)) {
          monthlyPaid += paid;
        }
      }
    });

    const badgeEl = document.getElementById('vendorPendingBadge');
    if (badgeEl) {
      badgeEl.textContent = `${pendingCount} Due`;
      badgeEl.style.background = pendingCount > 0 ? 'rgba(244,63,94,0.12)' : 'rgba(16,185,129,0.12)';
      badgeEl.style.color = pendingCount > 0 ? 'var(--expense)' : 'var(--income)';
    }

    const stockItems = (typeof getExpiryItems === 'function' ? getExpiryItems() : []);
    const totalStockValue = stockItems.reduce((sum, i) => sum + ((parseFloat(i.cost) || 0) * (parseFloat(i.quantity) || 0)), 0);

    this.setText('totalVendorPending', inr(totalPending));
    this.setText('monthlyVendorBilled', inr(monthlyBilled));
    this.setText('monthlyVendorPaid', inr(monthlyPaid));
    this.setText('totalVendorBilled', inr(totalBilled));
    this.setText('totalVendorPaid', inr(totalPaid));
    this.setText('totalVendorStockValue', inr(totalStockValue));

    if (!vendors || vendors.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 36px 20px; text-align: center; background: var(--bg-app); border: 1.5px dashed var(--border); border-radius: var(--r-lg);">
          <div style="display:flex; justify-content:center; margin-bottom:10px;"><i data-lucide="truck" style="width:36px; height:36px; color:var(--brand);"></i></div>
          <h4 style="font-size:0.95rem; font-weight:700; color:var(--text-head); margin-bottom:4px;">No Supplier Outstandings Recorded</h4>
          <p style="font-size:0.8rem; color:var(--text-muted); max-width:420px; margin:0 auto 16px;">Track dairy, vegetables, bakery, and packaging suppliers you owe money to, log new inventory received, and record partial/full payments.</p>
          <button class="btn btn-primary btn-sm" onclick="openVendorModal()" style="display:inline-flex; align-items:center; gap:6px;">
            <i data-lucide="plus-circle" style="width:15px; height:15px;"></i>Add First Supplier / Vendor
          </button>
        </div>
      `;
      if (typeof lucide !== 'undefined') lucide.createIcons();
      return;
    }

    // Filter by Tab and Search
    let displayVendors = vendors.slice();
    if (this.activeVendorTab && this.activeVendorTab !== 'all') {
      displayVendors = displayVendors.filter(v => {
        const billed = parseFloat(v.totalAmount) || 0;
        const paid = parseFloat(v.paidAmount) || 0;
        const pending = Math.max(0, billed - paid);
        if (this.activeVendorTab === 'pending') return pending > 0;
        if (this.activeVendorTab === 'settled') return pending <= 0;
        return true;
      });
    }

    if (this.vendorSearchQuery) {
      const q = this.vendorSearchQuery.toLowerCase();
      displayVendors = displayVendors.filter(v => {
        return (v.name || '').toLowerCase().includes(q) ||
               (v.phone || '').toLowerCase().includes(q) ||
               (v.category || '').toLowerCase().includes(q);
      });
    }

    // Sort displayVendors
    const sortMode = this.vendorSortMode || 'pending-desc';
    displayVendors.sort((a, b) => {
      const aBilled = parseFloat(a.totalAmount) || 0;
      const aPaid = parseFloat(a.paidAmount) || 0;
      const aPending = Math.max(0, aBilled - aPaid);

      const bBilled = parseFloat(b.totalAmount) || 0;
      const bPaid = parseFloat(b.paidAmount) || 0;
      const bPending = Math.max(0, bBilled - bPaid);

      if (sortMode === 'pending-desc') {
        return bPending - aPending;
      } else if (sortMode === 'name-asc') {
        return (a.name || '').localeCompare(b.name || '');
      } else if (sortMode === 'billed-desc') {
        return bBilled - aBilled;
      }
      return 0;
    });

    if (displayVendors.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 28px 16px; text-align: center; background: var(--bg-app); border: 1.5px dashed var(--border); border-radius: var(--r-lg);">
          <div style="font-size:1.6rem; margin-bottom:6px;">🔍</div>
          <div style="font-size:0.88rem; font-weight:700; color:var(--text-head); margin-bottom:4px;">No matching suppliers found</div>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:12px;">Try adjusting your search query or reset filter to "All".</div>
          <button class="btn btn-outline btn-xs" onclick="Dash.filterVendorsTab('all', document.querySelector('.filter-chip-btn[data-vendor-filter=\\'all\\']')); const vi = document.getElementById('vendorSearchInput'); if (vi) { vi.value = ''; Dash.searchVendors(''); }">Reset Filter</button>
        </div>
      `;
      if (typeof lucide !== 'undefined') lucide.createIcons();
      return;
    }

    const cardsHtml = displayVendors.map(v => {
      const billed = parseFloat(v.totalAmount) || 0;
      const paid = parseFloat(v.paidAmount) || 0;
      const pending = Math.max(0, billed - paid);
      const isSettled = pending <= 0;
      const isPartial = !isSettled && paid > 0;
      const pctPaid = billed > 0 ? Math.min(100, Math.round((paid / billed) * 100)) : 100;

      const vNameClean = (v.name || '').trim().toLowerCase();
      const vendorStockVal = stockItems
        .filter(item => {
          if (!vNameClean) return false;
          const itemBrand = (item.brand || '').trim().toLowerCase();
          const itemName = (item.name || '').trim().toLowerCase();
          const itemSupplier = (item.supplier || '').trim().toLowerCase();
          return itemBrand === vNameClean ||
                 (itemBrand && vNameClean.includes(itemBrand)) ||
                 (itemBrand && itemBrand.includes(vNameClean)) ||
                 (itemSupplier && (itemSupplier.includes(vNameClean) || vNameClean.includes(itemSupplier))) ||
                 itemName.includes(vNameClean);
        })
        .reduce((sum, item) => sum + ((parseFloat(item.cost) || 0) * (parseFloat(item.quantity) || 0)), 0);

      let statusBadge = '';
      let statusClass = 'status-settled';
      if (isSettled) {
        statusBadge = `<span class="v-status-badge settled"><i data-lucide="check-circle" style="width:11px; height:11px;"></i> Settled</span>`;
        statusClass = 'status-settled';
      } else if (isPartial) {
        statusBadge = `<span class="v-status-badge partial"><i data-lucide="clock" style="width:11px; height:11px;"></i> ${pctPaid}% Paid</span>`;
        statusClass = 'status-partial';
      } else {
        statusBadge = `<span class="v-status-badge unpaid"><i data-lucide="alert-circle" style="width:11px; height:11px;"></i> Unpaid</span>`;
        statusClass = 'status-unpaid';
      }

      const iconName = window.getLucideIconName(v.category) || 'package';
      const safeId = encodeURIComponent(v.id);

      return `
        <div class="vendor-card ${statusClass}">
          <div>
            <!-- Top Header: Vendor Meta & Controls -->
            <div class="v-header">
              <div class="v-header-info">
                <div class="v-avatar-icon">
                  <i data-lucide="${iconName}" style="width:18px; height:18px;"></i>
                </div>
                <div class="v-title-meta">
                  <div class="v-supplier-name" title="${escapeHtml(v.name)}">${escapeHtml(v.name)}</div>
                  <div class="v-tags-row">
                    <span class="v-pill-tag">${escapeHtml(v.category)}</span>
                    ${v.phone ? `<a href="tel:${escapeHtml(v.phone)}" class="v-pill-tag phone" title="Call Supplier"><i data-lucide="phone" style="width:10px; height:10px;"></i> ${escapeHtml(v.phone)}</a>` : ''}
                    ${vendorStockVal > 0 ? `<span class="v-pill-tag stock" title="Current In-Stock Inventory Value"><i data-lucide="package" style="width:10px; height:10px;"></i> ${inr(vendorStockVal)}</span>` : ''}
                  </div>
                </div>
              </div>
              <div class="v-header-controls">
                <div>${statusBadge}</div>
                <div class="v-icon-actions">
                  <button class="v-icon-btn" onclick="editVendor(decodeURIComponent('${safeId}'))" title="Edit Supplier Details">
                    <i data-lucide="edit-2" style="width:12px; height:12px;"></i>
                  </button>
                  <button class="v-icon-btn delete" onclick="deleteVendor(decodeURIComponent('${safeId}'))" title="Delete Supplier">
                    <i data-lucide="trash-2" style="width:12px; height:12px;"></i>
                  </button>
                </div>
              </div>
            </div>

            <!-- Amount Figures -->
            <div class="v-figures-box">
              <div>
                <div class="v-fig-due-title">Pending Due</div>
                <div class="v-fig-due-amt ${isSettled ? 'settled' : ''}">${inr(pending)}</div>
              </div>
              <div class="v-fig-meta">
                <div class="v-fig-total-title">Total Bill / Paid</div>
                <div class="v-fig-total-amt">${inr(billed)}</div>
                <div class="v-fig-paid-sub">(${inr(paid)} paid)</div>
              </div>
            </div>

            <!-- Progress Bar -->
            <div class="v-progress-track">
              <div class="v-progress-bar" style="width:${pctPaid}%; background:${isSettled ? 'var(--income)' : (isPartial ? '#f59e0b' : 'var(--expense)')};"></div>
            </div>

            <!-- Due Date or Status Note -->
            ${v.dueDate ? `
              <div class="v-due-pill">
                <i data-lucide="calendar" style="width:12px; height:12px; color:var(--text-light);"></i>
                <span>Due: <strong style="color:var(--text-head);">${fmtDate(v.dueDate)}</strong></span>
              </div>
            ` : `
              <div class="v-due-pill" style="opacity:0.75;">
                <i data-lucide="check" style="width:12px; height:12px; color:var(--text-light);"></i>
                <span>${pctPaid}% settled</span>
              </div>
            `}
          </div>

          <!-- Bottom Action Toolbar: Standardized 2-Row Layout -->
          <div class="v-card-footer">
            ${!isSettled ? `
              <button class="v-btn-pay-primary" onclick="openVendorPayModal(decodeURIComponent('${safeId}'))" title="Record Payment to ${escapeHtml(v.name)}">
                <span style="display:inline-flex; align-items:center; gap:5px;">
                  <i data-lucide="dollar-sign" style="width:14px; height:14px;"></i> Pay Now
                </span>
                <span>${inr(pending)}</span>
              </button>
            ` : `
              <div class="v-banner-settled">
                <i data-lucide="check-circle" style="width:14px; height:14px;"></i>
                <span>All Clear • No Dues</span>
              </div>
            `}

            <div class="v-actions-grid">
              <button class="v-sub-btn bill" onclick="openVendorBillModal(decodeURIComponent('${safeId}'))" title="Add New Goods / Bill">
                <i data-lucide="plus-circle" style="width:12px; height:12px;"></i>
                <span>+ Bill</span>
              </button>
              <button class="v-sub-btn ledger" onclick="openVendorHistoryModal(decodeURIComponent('${safeId}'))" title="View Full Ledger History">
                <i data-lucide="file-text" style="width:12px; height:12px;"></i>
                <span>Ledger</span>
              </button>
              <button class="v-sub-btn whatsapp" onclick="Dash.sendVendorWhatsApp(decodeURIComponent('${safeId}'))" title="Share Ledger via WhatsApp">
                <i data-lucide="message-circle" style="width:12px; height:12px;"></i>
                <span>WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    grid.innerHTML = cardsHtml;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  checkBudgetReminders: function (budgets, mtdCatSpend, currentMonthStr) {
    let notified = {};
    try {
      notified = JSON.parse(localStorage.getItem('bd_notified_budgets') || '{}');
    } catch (e) { }

    let hasNew = false;
    budgets.forEach(bgt => {
      const cat = bgt.category;
      const limit = parseFloat(bgt.amount) || 0;
      const spent = mtdCatSpend[cat] || 0;
      const notifKey = `${cat}_${currentMonthStr}`;

      if (spent > limit && !notified[notifKey]) {
        const cleanName = cat.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDC00-\uDFFF]/g, '').trim();
        this.addNotification(
          'danger',
          '🚨 Budget Exceeded!',
          `Monthly limit for "${cleanName}" reached. Spent ${inr(spent)} of ${inr(limit)} limit.`
        );
        notified[notifKey] = true;
        hasNew = true;
      }
    });

    if (hasNew) {
      localStorage.setItem('bd_notified_budgets', JSON.stringify(notified));
    }
  },

  loadBills: function () {
    const listContainer = document.getElementById('pendingBillsList');
    if (!listContainer) return;

    this.activeBillTab = this.activeBillTab || 'pending';
    const bills = getBills();

    // Separate bills
    const pendingBills = bills.filter(b => b.status === 'pending');
    const paidBills = bills.filter(b => b.status === 'paid');

    // Run due reminders check
    this.checkBillReminders(pendingBills);

    // Sort bills
    pendingBills.sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });

    paidBills.sort((a, b) => {
      const dateA = a.paidDate || a.savedAt || '';
      const dateB = b.paidDate || b.savedAt || '';
      return new Date(dateB) - new Date(dateA);
    });

    const activeList = this.activeBillTab === 'pending' ? pendingBills : paidBills;

    if (activeList.length === 0) {
      if (this.activeBillTab === 'pending') {
        listContainer.innerHTML = `
          <div style="padding:32px 16px; text-align:center; color:var(--text-muted);">
            <div style="font-size:1.8rem; margin-bottom:8px;">🎉</div>
            <div style="font-weight:700; font-size:0.82rem; color:var(--text-head); font-family:var(--font);">All Bills Paid!</div>
            <div style="font-size:0.72rem; color:var(--text-light); margin-top:2px; font-family:var(--font);">No pending bills found.</div>
          </div>
        `;
      } else {
        listContainer.innerHTML = `
          <div style="padding:32px 16px; text-align:center; color:var(--text-muted);">
            <div style="font-size:1.8rem; margin-bottom:8px;">📋</div>
            <div style="font-weight:700; font-size:0.82rem; color:var(--text-head); font-family:var(--font);">No Payment History</div>
            <div style="font-size:0.72rem; color:var(--text-light); margin-top:2px; font-family:var(--font);">Paid bills will appear here.</div>
          </div>
        `;
      }
      return;
    }

    const catEmojis = {
      '🧾 Electricity Bill': '🧾',
      '🏠 Rent': '🏠',
      '📦 Supplies / Supplier': '📦',
      '📡 Internet Bill': '📡',
      '📱 Mobile Bill': '📱',
      '👥 Salary': '👥',
      '🔨 Maintenance': '🔨',
      '📋 Tax': '📋',
      '💸 Other Bill': '💸'
    };

    const todayStr = today();
    const todayDate = new Date(todayStr + 'T00:00:00Z');

    listContainer.innerHTML = activeList.map(b => {
      // Find emoji
      let emoji = '🧾';
      Object.keys(catEmojis).forEach(k => {
        if (b.category.includes(k) || k.includes(b.category)) {
          emoji = catEmojis[k];
        }
      });

      // Cleanup category name for display (strip emoji)
      const cleanCatName = b.category.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '').trim();
      const displayTitle = b.vendor ? b.vendor.trim() : cleanCatName;
      const displaySub = b.vendor ? cleanCatName + (b.notes ? ` • ${b.notes}` : '') : (b.notes ? b.notes : '');

      let badgeHtml = '';
      if (b.status === 'paid') {
        const pDate = b.paidDate ? fmtDate(b.paidDate) : fmtDate(b.savedAt);
        badgeHtml = `<span class="bill-due-badge paid"><i data-lucide="check-circle-2" style="width: 10px; height: 10px;"></i> Paid ${pDate}</span>`;
      } else {
        const dueDate = new Date(b.dueDate + 'T00:00:00Z');
        if (isNaN(dueDate.getTime())) {
          badgeHtml = `<span class="bill-due-badge normal"><i data-lucide="calendar" style="width: 10px; height: 10px;"></i> Due: ${fmtDate(b.dueDate)}</span>`;
        } else {
          const diffTime = dueDate.getTime() - todayDate.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays < 0) {
            badgeHtml = `<span class="bill-due-badge overdue"><i data-lucide="alert-octagon" style="width: 10px; height: 10px;"></i> Overdue by ${Math.abs(diffDays)}d</span>`;
          } else if (diffDays === 0) {
            badgeHtml = `<span class="bill-due-badge due-today"><i data-lucide="alert-circle" style="width: 10px; height: 10px;"></i> Due Today 🚨</span>`;
          } else if (diffDays <= 3) {
            badgeHtml = `<span class="bill-due-badge upcoming"><i data-lucide="clock" style="width: 10px; height: 10px;"></i> Due in ${diffDays}d ⚠️</span>`;
          } else {
            badgeHtml = `<span class="bill-due-badge normal"><i data-lucide="calendar" style="width: 10px; height: 10px;"></i> Due in ${diffDays}d</span>`;
          }
        }
      }

      const payBtnHtml = b.status === 'pending'
        ? `<button class="btn-pay-bill" onclick="Dash.payBill('${b.id}')" title="Mark as Paid"><i data-lucide="check" style="width: 14px; height: 14px;"></i></button>`
        : '';

      return `
        <div class="bill-item">
          <div style="display: flex; gap: 12px; align-items: center; min-width: 0; flex: 1;">
            <div class="bill-icon">${emoji}</div>
            <div style="min-width: 0; flex: 1;">
              <div style="font-weight: 800; font-size: 0.85rem; color: var(--text-head); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${displayTitle}">
                ${displayTitle}
              </div>
              <div style="font-size: 0.72rem; color: var(--text-light); margin-top: 2px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${displaySub}">
                ${displaySub}
              </div>
              <div>${badgeHtml}</div>
            </div>
          </div>
          <div style="text-align: right; flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
            <div style="font-weight: 800; font-size: 0.92rem; color: var(--text-head);">${inr(b.amount)}</div>
            <div class="bill-actions">
              ${payBtnHtml}
              <button class="btn-delete-bill" onclick="Dash.deleteBill('${b.id}')" title="Delete Bill"><i data-lucide="trash-2" style="width: 14px; height: 14px;"></i></button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  },

  switchBillTab: function (tab) {
    this.activeBillTab = tab;

    // Update active visual styles
    const tabPending = document.getElementById('billTabPending');
    const tabPaid = document.getElementById('billTabPaid');

    if (tabPending && tabPaid) {
      if (tab === 'pending') {
        tabPending.classList.add('active');
        tabPending.style.color = 'var(--brand)';
        tabPending.style.borderBottomColor = 'var(--brand)';

        tabPaid.classList.remove('active');
        tabPaid.style.color = 'var(--text-light)';
        tabPaid.style.borderBottomColor = 'transparent';
      } else {
        tabPaid.classList.add('active');
        tabPaid.style.color = 'var(--brand)';
        tabPaid.style.borderBottomColor = 'var(--brand)';

        tabPending.classList.remove('active');
        tabPending.style.color = 'var(--text-light)';
        tabPending.style.borderBottomColor = 'transparent';
      }
    }

    this.loadBills();
  },

  openBillModal: function () {
    document.getElementById('bEditId').value = '';
    document.getElementById('bDate').value = today();
    document.getElementById('bCat').value = '';
    document.getElementById('bAmt').value = '';
    document.getElementById('bVendor').value = '';
    document.getElementById('bNote').value = '';

    openModal('billModal');
  },

  saveBill: async function () {
    const saveBtn = document.querySelector('#billModal .btn-primary');
    if (saveBtn && saveBtn.classList.contains('loading')) return;

    const date = document.getElementById('bDate').value.trim();
    const cat = document.getElementById('bCat').value.trim();
    const amt = document.getElementById('bAmt').value.trim();
    const vendor = document.getElementById('bVendor').value.trim();
    const notes = document.getElementById('bNote').value.trim();
    const editId = document.getElementById('bEditId').value.trim();

    if (!date) { toast('Please select a due date', 'error'); return; }
    if (!cat) { toast('Please select a category', 'error'); return; }
    const amount = parseFloat(amt);
    if (!amount || amount <= 0 || isNaN(amount)) {
      toast('Please enter a valid amount', 'error');
      return;
    }

    if (saveBtn) saveBtn.classList.add('loading');

    const bill = {
      id: editId || 'bill_' + uid(),
      category: cat,
      amount: amount,
      dueDate: date,
      vendor: vendor,
      notes: notes,
      status: 'pending',
      paidDate: '',
      savedAt: new Date().toISOString()
    };

    try {
      await saveBillToFirebase(bill);
      closeModal('billModal');
      toast('Bill saved successfully! 🧾', 'success');
      this.loadBills();
    } catch (err) {
      console.error('Save bill error:', err);
      toast('Failed to save bill', 'error');
    } finally {
      if (saveBtn) saveBtn.classList.remove('loading');
    }
  },

  deleteBill: async function (id) {
    if (!confirm('Are you sure you want to delete this bill?')) return;

    try {
      await deleteBillFromFirebase(id);
      toast('Bill deleted successfully 🗑️', 'success');
      this.loadBills();
    } catch (err) {
      console.error('Delete bill error:', err);
      toast('Failed to delete bill', 'error');
    }
  },

  payBill: function (id) {
    const bills = getBills();
    const bill = bills.find(b => b.id === id);
    if (!bill) return;

    resetForm('expense');

    document.getElementById('eDate').value = today();
    document.getElementById('eCat').value = bill.category;
    document.getElementById('eAmt').value = bill.amount;
    document.getElementById('eMode').value = 'UPI'; // Default UPI
    document.getElementById('eVendor').value = bill.vendor || '';
    document.getElementById('eNote').value = `Paid Bill: ${bill.notes || ''}`.trim();
    document.getElementById('eBillId').value = bill.id;

    if (typeof previewAmt === 'function') {
      previewAmt('expense');
    }

    openModal('expenseModal');
  },

  checkBillReminders: function (pendingBills) {
    const todayStr = today();
    const todayDate = new Date(todayStr + 'T00:00:00Z');

    let notified = {};
    try {
      notified = JSON.parse(localStorage.getItem('bd_notified_bills') || '{}');
    } catch (e) { }

    let updatedNotified = { ...notified };
    let hasNewNotification = false;

    pendingBills.forEach(bill => {
      if (!bill.dueDate) return;

      const dueDate = new Date(bill.dueDate + 'T00:00:00Z');
      if (isNaN(dueDate.getTime())) return;
      const diffTime = dueDate.getTime() - todayDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 3) {
        if (notified[bill.id] !== bill.dueDate) {
          let msg = '';
          let type = 'warn';
          let title = 'Bill Reminder';

          const cleanCatName = bill.category.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '').trim();

          if (diffDays < 0) {
            title = '🚨 Bill Overdue!';
            msg = `${cleanCatName} of ${inr(bill.amount)} for ${bill.vendor || 'Supplier'} was due on ${fmtDate(bill.dueDate)} (Overdue by ${Math.abs(diffDays)} days).`;
            type = 'danger';
          } else if (diffDays === 0) {
            title = '⏰ Bill Due Today!';
            msg = `${cleanCatName} of ${inr(bill.amount)} for ${bill.vendor || 'Supplier'} is due TODAY.`;
            type = 'danger';
          } else {
            title = '⏳ Upcoming Bill';
            msg = `${cleanCatName} of ${inr(bill.amount)} for ${bill.vendor || 'Supplier'} is due in ${diffDays} days (on ${fmtDate(bill.dueDate)}).`;
            type = 'warn';
          }

          this.addNotification(type, title, msg);
          updatedNotified[bill.id] = bill.dueDate;
          hasNewNotification = true;
        }
      }
    });

    if (hasNewNotification) {
      localStorage.setItem('bd_notified_bills', JSON.stringify(updatedNotified));
    }
  },

  /* ========================================================
     POWER FEATURES & CUSTOMIZER SUITE
     ======================================================== */

  togglePrivacyMode: function (force) {
    const isPrivate = force !== undefined ? !!force : document.body.getAttribute('data-privacy') !== 'true';
    if (isPrivate) {
      document.body.setAttribute('data-privacy', 'true');
      localStorage.setItem('bd_stealth_mode', 'true');
    } else {
      document.body.removeAttribute('data-privacy');
      localStorage.removeItem('bd_stealth_mode');
    }
    const icon = document.getElementById('privacyToggleIcon');
    const label = document.getElementById('privacyToggleLabel');
    if (icon) {
      icon.setAttribute('data-lucide', isPrivate ? 'eye' : 'eye-off');
    }
    if (label) {
      label.textContent = isPrivate ? 'Show Numbers' : 'Stealth Privacy';
    }
    const chk = document.getElementById('customizerStealthMode') || document.getElementById('prefStealthMode');
    if (chk) chk.checked = isPrivate;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    if (typeof toast === 'function') {
      toast(isPrivate ? '🔒 Privacy stealth mode enabled (numbers hidden)' : '🔓 Privacy mode disabled', 'info');
    }
  },

  loadPrivacyMode: function () {
    const isPrivate = localStorage.getItem('bd_stealth_mode') === 'true';
    if (isPrivate) {
      document.body.setAttribute('data-privacy', 'true');
      const icon = document.getElementById('privacyToggleIcon');
      const label = document.getElementById('privacyToggleLabel');
      if (icon) icon.setAttribute('data-lucide', 'eye');
      if (label) label.textContent = 'Show Numbers';
      const chk = document.getElementById('customizerStealthMode') || document.getElementById('prefStealthMode');
      if (chk) chk.checked = true;
    }
  },

  toggleDensity: function (isCompact) {
    if (isCompact) {
      document.body.setAttribute('data-density', 'compact');
    } else {
      document.body.removeAttribute('data-density');
    }
  },

  loadCustomizerPreferences: function () {
    let prefs = {};
    try {
      prefs = JSON.parse(localStorage.getItem('bd_dash_prefs') || '{}');
    } catch (e) { }

    // Density
    const isCompact = prefs.density === 'compact';
    this.toggleDensity(isCompact);
    const dChk = document.getElementById('customizerDensity') || document.getElementById('prefDensity');
    if (dChk) dChk.checked = isCompact;

    // Stealth Mode in Customizer
    const sChk = document.getElementById('customizerPrivacy') || document.getElementById('customizerStealthMode') || document.getElementById('prefStealthMode');
    if (sChk) sChk.checked = localStorage.getItem('bd_stealth_mode') === 'true';

    // Default Period
    const pSel = document.getElementById('customizerDefaultPeriod') || document.getElementById('prefDefaultPeriod');
    if (pSel && prefs.defaultPeriod) pSel.value = prefs.defaultPeriod;

    // Visible Sections mapping
    const sectionMap = {
      custSecVision: ['sectionVisionGoals'],
      custSecBudgets: ['sectionBudgets'],
      custSecVendors: ['sectionVendors'],
      custSecAverages: ['sectionDailyAverages', 'sectionMonthlyAverages'],
      custSecCharts: ['sectionCharts', 'sectionCashflow'],
      custSecInsights: ['sectionInsights'],
      custSecRecent: ['sectionRecent'],
      custSecComparisons: ['sectionComparisons']
    };

    const hidden = prefs.hiddenSections || [];

    Object.keys(sectionMap).forEach(key => {
      const chk = document.getElementById(key);
      const targets = sectionMap[key];
      const isHidden = targets.some(targetId => hidden.includes(targetId));

      targets.forEach(targetId => {
        const secEl = document.getElementById(targetId);
        if (secEl) {
          secEl.style.display = isHidden ? 'none' : '';
        }
      });

      if (chk) {
        chk.checked = !isHidden;
      }
    });
  },

  saveCustomizerPreferences: function () {
    const dChk = document.getElementById('customizerDensity') || document.getElementById('prefDensity');
    const isCompact = dChk ? dChk.checked : false;

    const pSel = document.getElementById('customizerDefaultPeriod') || document.getElementById('prefDefaultPeriod');
    const defaultPeriod = pSel ? pSel.value : 'today';

    const sChk = document.getElementById('customizerPrivacy') || document.getElementById('customizerStealthMode') || document.getElementById('prefStealthMode');
    const isStealth = sChk ? sChk.checked : false;

    const sectionMap = {
      custSecVision: ['sectionVisionGoals'],
      custSecBudgets: ['sectionBudgets'],
      custSecVendors: ['sectionVendors'],
      custSecAverages: ['sectionDailyAverages', 'sectionMonthlyAverages'],
      custSecCharts: ['sectionCharts', 'sectionCashflow'],
      custSecInsights: ['sectionInsights'],
      custSecRecent: ['sectionRecent'],
      custSecComparisons: ['sectionComparisons']
    };

    const hiddenSections = [];
    Object.keys(sectionMap).forEach(key => {
      const chk = document.getElementById(key);
      if (chk && !chk.checked) {
        sectionMap[key].forEach(targetId => hiddenSections.push(targetId));
      }
    });

    const prefs = {
      density: isCompact ? 'compact' : 'comfortable',
      defaultPeriod: defaultPeriod,
      hiddenSections: hiddenSections
    };

    localStorage.setItem('bd_dash_prefs', JSON.stringify(prefs));
    this.togglePrivacyMode(isStealth);
    this.loadCustomizerPreferences();
    if (typeof closeModal === 'function') closeModal('dashCustomizerModal');
    if (typeof toast === 'function') toast('✨ Dashboard view customized successfully!', 'success');
  },

  resetCustomizerDefaults: function () {
    localStorage.removeItem('bd_dash_prefs');
    localStorage.removeItem('bd_stealth_mode');
    document.body.removeAttribute('data-density');
    document.body.removeAttribute('data-privacy');
    this.loadCustomizerPreferences();
    const dChk = document.getElementById('customizerDensity') || document.getElementById('prefDensity');
    if (dChk) dChk.checked = false;
    const sChk = document.getElementById('customizerPrivacy') || document.getElementById('customizerStealthMode') || document.getElementById('prefStealthMode');
    if (sChk) sChk.checked = false;
    const pSel = document.getElementById('customizerDefaultPeriod') || document.getElementById('prefDefaultPeriod');
    if (pSel) pSel.value = 'today';
    ['custSecVision', 'custSecBudgets', 'custSecVendors', 'custSecAverages', 'custSecCharts', 'custSecInsights', 'custSecRecent', 'custSecComparisons'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.checked = true;
    });
    if (typeof closeModal === 'function') closeModal('dashCustomizerModal');
    if (typeof toast === 'function') toast('Default layout restored!', 'info');
    if (typeof toast === 'function') toast('🔄 Reset dashboard preferences to default', 'info');
  },

  navigatePeriod: function (dir) {
    const sequence = ['today', 'yesterday', 'week', 'month', 'lastmonth', 'year', 'all'];
    const curIdx = sequence.indexOf(this.period);
    let nextIdx = (curIdx === -1 ? 0 : curIdx) + dir;
    if (nextIdx < 0) nextIdx = 0;
    if (nextIdx >= sequence.length) nextIdx = sequence.length - 1;
    const nextPeriod = sequence[nextIdx];
    if (typeof switchPeriod === 'function') {
      switchPeriod(nextPeriod);
    } else {
      this.switchPeriod(nextPeriod);
    }
    const tabBtn = document.querySelector(`.pb-tab[data-p="${nextPeriod}"]`);
    if (tabBtn) {
      document.querySelectorAll('.pb-tab').forEach(t => t.classList.remove('active'));
      tabBtn.classList.add('active');
    }
  },

  drilldownSummary: function (type) {
    if (type === 'income' || type === 'expense') {
      const recentSec = document.getElementById('sectionRecent');
      if (recentSec) {
        recentSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const btn = document.querySelector(`.filter-chip-btn[data-recent-type="${type}"]`);
        this.filterRecentType(type, btn);
        if (typeof toast === 'function') {
          toast(`🔍 Filtered Recent Activity to ${type.toUpperCase()}`, 'info');
        }
      }
    } else if (type === 'profit' || type === 'balance') {
      const targetSec = document.getElementById('sectionCharts') || document.getElementById('sectionCashflow');
      if (targetSec) {
        targetSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (typeof toast === 'function') {
          toast(`📊 Viewing ${type.toUpperCase()} analytics & cash flow breakdown`, 'info');
        }
      }
    }
  },

  copyCashReport: function () {
    const all = getTxns();
    const periodTxns = typeof filterByPeriod === 'function' ? filterByPeriod(all, this.period || 'today') : all;
    let cashIn = 0, onlineIn = 0, cashOut = 0, onlineOut = 0;

    periodTxns.forEach(t => {
      const amt = parseFloat(t.amount) || 0;
      const isCash = (t.mode || '').toLowerCase() === 'cash';
      if (t.type === 'income') {
        if (isCash) cashIn += amt; else onlineIn += amt;
      } else {
        if (isCash) cashOut += amt; else onlineOut += amt;
      }
    });

    const netCash = cashIn - cashOut;
    const totalIn = cashIn + onlineIn;
    const totalOut = cashOut + onlineOut;
    const netProfit = totalIn - totalOut;

    const reportDate = this.period === 'today' ? 'Today' : (this.period.toUpperCase());
    const text = `📊 *DAILY BUSINESS CLOSING REPORT* (${reportDate})
━━━━━━━━━━━━━━━━━━
💰 *Total Revenue:* ${inr(totalIn)}
  • 🟢 Cash Sales: ${inr(cashIn)}
  • 📱 Online/UPI Sales: ${inr(onlineIn)}

💸 *Total Expenses:* ${inr(totalOut)}
  • Cash Expenses: ${inr(cashOut)}
  • Online Expenses: ${onlineOut > 0 ? inr(onlineOut) : '₹ 0'}

━━━━━━━━━━━━━━━━━━
💵 *Physical Cash In Till / Drawer:* ${inr(netCash)}
📈 *Net Margin / Profit:* ${inr(netProfit)}
🕒 Generated: ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        if (typeof toast === 'function') toast('📋 Daily Closing Report copied to clipboard!', 'success');
      }).catch(() => {});
    }

    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  },

  filterBudgets: function (filterType, btn) {
    this.activeBudgetFilter = filterType;
    if (btn) {
      const toolbar = btn.closest('.filter-chips-toolbar');
      if (toolbar) {
        toolbar.querySelectorAll('.filter-chip-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      }
    }
    const all = getTxns();
    this.loadCategoryBudgets(all);
  },

  searchBudgets: function (query) {
    this.budgetSearchQuery = (query || '').trim();
    const all = getTxns();
    this.loadCategoryBudgets(all);
  },

  applyBudgetPreset: function (category, amount) {
    const sel = document.getElementById('bCategory');
    const amt = document.getElementById('bAmount');
    if (sel) {
      for (let i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value.includes(category) || sel.options[i].text.includes(category)) {
          sel.selectedIndex = i;
          break;
        }
      }
    }
    if (amt) {
      amt.value = amount;
      amt.focus();
    }
  },

  filterVendorsTab: function (filterType, btn) {
    this.activeVendorTab = filterType;
    if (btn) {
      const toolbar = btn.closest('.filter-chips-toolbar');
      if (toolbar) {
        toolbar.querySelectorAll('.filter-chip-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      }
    }
    this.loadVendors();
  },

  searchVendors: function (query) {
    this.vendorSearchQuery = (query || '').trim();
    this.loadVendors();
  },

  sortVendors: function (sortVal) {
    this.vendorSortMode = sortVal;
    this.loadVendors();
  },

  sendVendorWhatsApp: function (vendorId) {
    const vendors = getVendors();
    const v = vendors.find(item => String(item.id) === String(vendorId));
    if (!v) {
      if (typeof toast === 'function') toast('Vendor not found', 'danger');
      return;
    }

    const billed = parseFloat(v.totalAmount) || 0;
    const paid = parseFloat(v.paidAmount) || 0;
    const pending = Math.max(0, billed - paid);

    let phone = (v.phone || '').replace(/\D/g, '');
    if (phone.length === 10) phone = '91' + phone;

    const msg = `Namaste *${v.name}* ji,
This is a ledger statement update from our business:
━━━━━━━━━━━━━━━━━━
📋 Total Goods Billed: ${inr(billed)}
✅ Amount Paid So Far: ${inr(paid)}
⚠️ Current Balance Due: *${inr(pending)}*
${v.dueDate ? `📅 Agreed Payment Due Date: ${fmtDate(v.dueDate)}` : ''}
━━━━━━━━━━━━━━━━━━
Please acknowledge this statement. Thank you!`;

    const encoded = encodeURIComponent(msg);
    const waUrl = phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(waUrl, '_blank');
    if (typeof toast === 'function') toast(`💬 Opened WhatsApp ledger statement for ${v.name}`, 'success');
  },

  askAiAdvisor: function (topic) {
    const respBox = document.getElementById('aiAdvisorResponse');
    if (!respBox) return;

    document.querySelectorAll('.ai-prompt-chip').forEach(c => c.classList.remove('active'));
    const clickedChip = document.querySelector(`.ai-prompt-chip[onclick*="${topic}"]`);
    if (clickedChip) clickedChip.classList.add('active');

    const all = getTxns();
    const monthTxns = (typeof filterByPeriod === 'function') ? filterByPeriod(all, 'month') : all;
    const workingSet = monthTxns.length ? monthTxns : all;
    const totMonth = calcTotals(workingSet);
    const vendors = getVendors();
    let totalPendingVendors = 0;
    vendors.forEach(v => {
      totalPendingVendors += Math.max(0, (parseFloat(v.totalAmount) || 0) - (parseFloat(v.paidAmount) || 0));
    });

    let html = '';
    if (topic === 'expenses' || topic === 'cut_expense') {
      const catTotals = {};
      workingSet.filter(t => t.type === 'expense').forEach(t => {
        catTotals[t.category] = (catTotals[t.category] || 0) + (parseFloat(t.amount) || 0);
      });
      const sortedCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
      const topCat = sortedCats[0] ? sortedCats[0][0] : 'Supplies';
      const topAmt = sortedCats[0] ? inr(sortedCats[0][1]) : '₹ 0';
      const topCat2 = sortedCats[1] ? sortedCats[1][0] : null;
      const topAmt2 = sortedCats[1] ? inr(sortedCats[1][1]) : null;

      html = `
        <div style="font-weight:800; font-size:0.95rem; color:var(--text-head); margin-bottom:6px; display:flex; align-items:center; gap:6px;">
          <i data-lucide="alert-triangle" style="width:16px; height:16px; color:#f43f5e;"></i> Top Expense Leaks & Savings Audit
        </div>
        <div style="font-size:0.84rem; line-height:1.5; color:var(--text-body); margin-bottom:8px;">
          Your #1 largest expense drain is <strong>${topCat}</strong> at <strong style="color:var(--expense);">${topAmt}</strong>${topCat2 ? ` followed by <strong>${topCat2}</strong> (${topAmt2})` : ''} this period.
        </div>
        <div style="font-size:0.82rem; line-height:1.6; background:var(--bg-card); padding:10px 14px; border-radius:var(--r-md); border:1px solid var(--border);">
          💡 <strong>Actionable Steps to Plug the Leaks:</strong><br>
          1. <strong>Set Budget Limits:</strong> Open the <em>Category Budgets</em> section above and set a strict monthly limit on <strong>${topCat}</strong>.<br>
          2. <strong>Supplier Renegotiation:</strong> Request a 5–8% wholesale discount or bulk delivery credit from your primary supplier.<br>
          3. <strong>Track Expiry Losses:</strong> Keep ingredients in the Expiry Tracker to eliminate silent food spoilage.
        </div>
      `;
    } else if (topic === 'profit' || topic === 'margin') {
      const margin = totMonth.income > 0 ? Math.round((totMonth.profit / totMonth.income) * 100) : 0;
      let advice = '';
      if (margin >= 30) {
        advice = '✨ <strong>Outstanding Profitability (30%+):</strong> Your business is operating with exceptional health. You have safe headroom to invest in targeted marketing or promotional combo discounts to expand customer footfall.';
      } else if (margin >= 15) {
        advice = '👍 <strong>Healthy Margin (15%–29%):</strong> Steady performance. To push your margin above 25%, focus on upselling high-margin beverages, sides, and signature desserts.';
      } else {
        advice = '⚠️ <strong>Margin Squeeze Alert (&lt;15%):</strong> Expenses are absorbing too much revenue. Conduct an immediate cost review on raw supplies and revise prices on low-margin items.';
      }
      html = `
        <div style="font-weight:800; font-size:0.95rem; color:var(--text-head); margin-bottom:6px; display:flex; align-items:center; gap:6px;">
          <i data-lucide="trending-up" style="width:16px; height:16px; color:var(--brand);"></i> Profit Margin Optimization
        </div>
        <div style="font-size:0.84rem; line-height:1.5; color:var(--text-body); margin-bottom:8px;">
          Net Profit Margin: <strong style="color:${margin >= 20 ? 'var(--income)' : 'var(--expense)'}; font-size:0.95rem;">${margin}%</strong> (${inr(totMonth.profit)} profit on ${inr(totMonth.income)} revenue).
        </div>
        <div style="font-size:0.82rem; line-height:1.6; background:var(--bg-card); padding:10px 14px; border-radius:var(--r-md); border:1px solid var(--border);">
          ${advice}
        </div>
      `;
    } else if (topic === 'cash' || topic === 'cashflow') {
      let cashIn = 0, onlineIn = 0;
      workingSet.filter(t => t.type === 'income').forEach(t => {
        const amt = parseFloat(t.amount) || 0;
        if ((t.mode || 'Cash') === 'Cash') cashIn += amt;
        else onlineIn += amt;
      });
      const totRec = cashIn + onlineIn;
      const cashPct = totRec > 0 ? Math.round((cashIn / totRec) * 100) : 50;
      const onlinePct = 100 - cashPct;

      html = `
        <div style="font-weight:800; font-size:0.95rem; color:var(--text-head); margin-bottom:6px; display:flex; align-items:center; gap:6px;">
          <i data-lucide="coins" style="width:16px; height:16px; color:#10b981;"></i> Cash vs Online Working Capital Health
        </div>
        <div style="font-size:0.84rem; line-height:1.5; color:var(--text-body); margin-bottom:8px;">
          Collection Ratio: <strong>${cashPct}% Cash</strong> (${inr(cashIn)}) vs <strong>${onlinePct}% Online</strong> (${inr(onlineIn)}). Supplier Khata Dues: <strong style="color:var(--expense);">${inr(totalPendingVendors)}</strong>.
        </div>
        <div style="font-size:0.82rem; line-height:1.6; background:var(--bg-card); padding:10px 14px; border-radius:var(--r-md); border:1px solid var(--border);">
          ${totMonth.profit >= totalPendingVendors ?
            '✅ <strong>Strong Liquidity:</strong> Your operating surplus comfortably covers all supplier liabilities. Maintain at least 40% in liquid bank/UPI balance for seamless vendor settlements.' :
            '⚠️ <strong>Working Capital Watch:</strong> Supplier dues are near or exceeding monthly profit. Use the <em>WhatsApp Closing</em> button above to balance physical register cash daily and prioritize clearing high-priority supplier dues.'}
        </div>
      `;
    } else if (topic === 'pace' || topic === 'peak_days') {
      const revTarget = parseFloat(localStorage.getItem('vision_revenue_target') || '150000');
      const parts = getISTDateParts();
      const daysInMonth = new Date(parts.year, parts.month, 0).getDate();
      const dayNow = parts.day || 1;
      const daysRemaining = Math.max(1, daysInMonth - dayNow);
      const remainingTarget = Math.max(0, revTarget - totMonth.income);
      const requiredDailyPace = remainingTarget / daysRemaining;
      const currentAvgPace = dayNow > 0 ? totMonth.income / dayNow : 0;

      html = `
        <div style="font-weight:800; font-size:0.95rem; color:var(--text-head); margin-bottom:6px; display:flex; align-items:center; gap:6px;">
          <i data-lucide="gauge" style="width:16px; height:16px; color:#8b5cf6;"></i> Target Pace & Growth Velocity
        </div>
        <div style="font-size:0.84rem; line-height:1.5; color:var(--text-body); margin-bottom:8px;">
          Revenue Target: <strong>${inr(revTarget)}</strong> | Current MTD: <strong>${inr(totMonth.income)}</strong> (${Math.round((totMonth.income / (revTarget || 1)) * 100)}%).
        </div>
        <div style="font-size:0.82rem; line-height:1.6; background:var(--bg-card); padding:10px 14px; border-radius:var(--r-md); border:1px solid var(--border);">
          🎯 <strong>Velocity Calculation:</strong><br>
          • <strong>Required Run Rate:</strong> <strong>${inr(requiredDailyPace)}/day</strong> across remaining ${daysRemaining} days.<br>
          • <strong>Current Velocity:</strong> <strong>${inr(currentAvgPace)}/day</strong>.<br>
          • <strong>Strategy:</strong> ${currentAvgPace >= requiredDailyPace ?
            '🚀 <em>You are on track to exceed monthly targets! Maintain current momentum and upsell weekend specials.</em>' :
            '⚡ <em>Slight acceleration needed. Introduce a daily combo special or launch an evening social media push to bridge the pace gap.</em>'}
        </div>
      `;
    }

    respBox.innerHTML = html;
    respBox.style.display = 'block';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  searchRecent: function (query) {
    this._recentSearchQuery = (query || '').trim();
    this.recentSearchQuery = this._recentSearchQuery;
    const all = getTxns();
    this.loadRecent(all);
  },

  filterRecentType: function (type, btn) {
    this._recentTypeFilter = type;
    this.recentTypeFilter = type;
    if (btn) {
      const container = btn.parentElement || btn.closest('.recent-type-switcher') || btn.closest('.filter-chips-toolbar');
      if (container) {
        container.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      }
    }
    const all = getTxns();
    this.loadRecent(all);
  },

  viewTxnDetails: function (txnId) {
    const all = getTxns();
    const t = all.find(item => String(item.id) === String(txnId));
    if (!t) {
      if (typeof toast === 'function') toast('Transaction not found', 'danger');
      return;
    }

    const isInc = t.type === 'income';
    const modal = document.getElementById('txnDetailModal');
    if (!modal) return;

    const badgeEl = document.getElementById('txnDetailBadge');
    if (badgeEl) {
      badgeEl.innerHTML = `<span class="badge" style="background:${isInc ? 'rgba(16,185,129,0.14)' : 'rgba(244,63,94,0.14)'}; color:${isInc ? 'var(--income)' : 'var(--expense)'}; font-weight:800; font-size:0.75rem; letter-spacing:0.5px;">${isInc ? '🟢 INCOME / REVENUE' : '🔴 EXPENSE / OUTFLOW'}</span>`;
    }

    const amtEl = document.getElementById('txnDetailAmount');
    if (amtEl) {
      amtEl.textContent = (isInc ? '+' : '-') + inr(t.amount);
      amtEl.style.color = isInc ? 'var(--income)' : 'var(--expense)';
    }

    const catEl = document.getElementById('txnDetailCategory');
    if (catEl) {
      catEl.textContent = `${t.category || 'General'}  •  Ref: #${t.id}`;
    }

    const dateEl = document.getElementById('txnDetailDate');
    if (dateEl) {
      dateEl.textContent = typeof fmtDate === 'function' ? fmtDate(t.date || today()) : (t.date || '--');
    }

    const modeEl = document.getElementById('txnDetailMode');
    if (modeEl) {
      modeEl.textContent = t.mode === 'Cash' ? '💵 Cash' : (t.mode === 'Card' ? '💳 Card' : '📱 ' + (t.mode || 'UPI'));
    }

    const partyLabelEl = document.getElementById('txnDetailPartyLabel');
    if (partyLabelEl) {
      partyLabelEl.textContent = isInc ? 'Received From:' : 'Paid To / Supplier:';
    }

    const partyEl = document.getElementById('txnDetailParty');
    if (partyEl) {
      partyEl.textContent = t.from || t.vendor || (isInc ? 'Direct Walk-in Customer' : 'General Operational');
    }

    const notesEl = document.getElementById('txnDetailNotes');
    if (notesEl) {
      notesEl.textContent = t.notes ? `"${t.notes}"` : 'None recorded';
    }

    const delBtn = document.getElementById('txnDetailDeleteBtn');
    if (delBtn) {
      delBtn.onclick = () => {
        if (confirm('Are you sure you want to delete this transaction permanently?')) {
          if (typeof deleteTxn === 'function') {
            deleteTxn(t.id);
          } else {
            let txns = getTxns().filter(x => String(x.id) !== String(t.id));
            localStorage.setItem(APP.storageKey, JSON.stringify(txns));
            if (typeof triggerUIUpdate === 'function') triggerUIUpdate();
            else Dash.loadAll();
          }
          if (typeof closeModal === 'function') closeModal('txnDetailModal');
          if (typeof toast === 'function') toast('🗑️ Transaction removed', 'info');
        }
      };
    }

    modal.classList.add('open');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  applyGoalPreset: function (type) {
    const revInput = document.getElementById('vRevTarget');
    const expInput = document.getElementById('vExpCap');
    const all = getTxns();
    const monthTxns = typeof filterByPeriod === 'function' ? filterByPeriod(all, 'month') : all;
    const curTot = calcTotals(monthTxns.length ? monthTxns : all);
    const curIncome = curTot.income || 100000;

    if (type === 'growth15') {
      const targetRev = Math.round(curIncome * 1.15);
      const targetExp = Math.round(targetRev * 0.45);
      if (revInput) revInput.value = targetRev;
      if (expInput) expInput.value = targetExp;
    } else if (type === 'growth25') {
      const targetRev = Math.round(curIncome * 1.25);
      const targetExp = Math.round(targetRev * 0.42);
      if (revInput) revInput.value = targetRev;
      if (expInput) expInput.value = targetExp;
    } else if (type === 'cafe_standard') {
      if (revInput) revInput.value = 180000;
      if (expInput) expInput.value = 65000;
    } else if (type === 'conservative') {
      if (revInput) revInput.value = 120000;
      if (expInput) expInput.value = 45000;
    }
    if (typeof toast === 'function') toast(`🎯 Applied "${type}" goal template`, 'info');
  },

  renderExpiryAlerts: function () {
    const banner = document.getElementById('dashExpiryBanner');
    if (banner) banner.style.display = 'none';
  },

  switchBarChartMode: function (mode) {
    this.barChartMode = mode;
    const all = getTxns();
    this.buildBarChart(all);
  }
};

// GLOBAL
function switchLineChartTab(tab, btn) {
  if (typeof Dash === 'undefined') return;

  Dash.lineChartTab = tab;

  const header = btn.closest('.chart-tab-group') || btn.parentElement;
  if (header) {
    const tabs = header.querySelectorAll('.pb-tab');
    tabs.forEach(t => {
      t.classList.remove('active');
      t.style.color = '';
    });
  }
  btn.classList.add('active');
  btn.style.color = '';

  const pulse = document.querySelector('#chartTabVelocity .live-pulse');
  if (pulse) {
    pulse.style.display = (tab === 'live' && typeof PizzaCafeSimulator !== 'undefined' && PizzaCafeSimulator.active) ? 'inline-block' : 'none';
  }

  Dash.buildLineChart(getTxns());
}

function switchPeriod(p, btn) {
  Dash.period = p;
  const tabs = document.querySelectorAll('.pb-tab');
  for (let i = 0; i < tabs.length; i++) tabs[i].classList.remove('active');
  if (btn) btn.classList.add('active');

  const wrap = document.getElementById('customDateRangeWrap');
  if (wrap) wrap.style.display = 'none';

  Dash.loadSummary(getTxns());
  setTimeout(() => Dash.animateNumbers(), 100);
}

function toggleCustomPeriod(btn) {
  const tabs = document.querySelectorAll('.pb-tab');
  for (let i = 0; i < tabs.length; i++) tabs[i].classList.remove('active');
  if (btn) btn.classList.add('active');

  const wrap = document.getElementById('customDateRangeWrap');
  if (wrap) {
    wrap.style.display = wrap.style.display === 'none' ? 'block' : 'none';
  }

  const startInput = document.getElementById('customStart');
  const endInput = document.getElementById('customEnd');
  if (startInput && !startInput.value) startInput.value = today();
  if (endInput && !endInput.value) endInput.value = today();
}

function applyCustomDateRange() {
  const startVal = document.getElementById('customStart').value;
  const endVal = document.getElementById('customEnd').value;

  if (!startVal || !endVal) {
    toast('Please select both start and end dates', 'warning');
    return;
  }

  if (startVal > endVal) {
    toast('Start date cannot be after end date', 'warning');
    return;
  }

  Dash.period = 'custom';
  Dash.customStart = startVal;
  Dash.customEnd = endVal;

  Dash.loadSummary(getTxns());
  setTimeout(() => Dash.animateNumbers(), 100);
}

function resetCustomDateRange() {
  const startInput = document.getElementById('customStart');
  const endInput = document.getElementById('customEnd');
  if (startInput) startInput.value = today();
  if (endInput) endInput.value = today();

  const todayBtn = document.querySelector('.pb-tab[data-p="today"]');
  if (todayBtn) {
    switchPeriod('today', todayBtn);
  }
}

function exportTransactionsCSV() {
  const txns = getTxns();
  if (!txns.length) {
    toast('No transactions to export!', 'error');
    return;
  }

  const headers = ['ID', 'Type', 'Date', 'Category', 'Amount', 'Mode', 'From', 'Vendor', 'Notes', 'SavedAt'];
  const csvRows = [headers.join(',')];

  txns.forEach(t => {
    const row = [
      t.id || '',
      t.type || '',
      t.date || '',
      `"${(t.category || '').replace(/"/g, '""')}"`,
      t.amount || 0,
      t.mode || '',
      `"${(t.from || '').replace(/"/g, '""')}"`,
      `"${(t.vendor || '').replace(/"/g, '""')}"`,
      `"${(t.notes || '').replace(/"/g, '""')}"`,
      t.savedAt || ''
    ];
    csvRows.push(row.join(','));
  });

  const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', 'business_transactions_export.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  toast('Transactions exported successfully! 📥', 'success');
}

function buildBarChart() { Dash.buildBarChart(getTxns()); }
function buildDonutChart() { Dash.buildDonutChart(getTxns()); }

async function saveTransaction(type) {
  const isI = type === 'income';
  const modalId = isI ? 'incomeModal' : 'expenseModal';
  const btnSelector = isI ? '#incomeModal .btn-income' : '#expenseModal .btn-expense';
  const saveBtn = document.querySelector(btnSelector);

  // Prevent double-submit
  if (saveBtn && saveBtn.classList.contains('loading')) return;

  const date = document.getElementById(isI ? 'iDate' : 'eDate').value.trim();
  const cat = document.getElementById(isI ? 'iCat' : 'eCat').value.trim();
  const amt = document.getElementById(isI ? 'iAmt' : 'eAmt').value.trim();
  const mode = document.getElementById(isI ? 'iMode' : 'eMode').value || 'Cash';
  const from = isI ? document.getElementById('iFrom').value.trim() : '';
  const vendor = !isI ? document.getElementById('eVendor').value.trim() : '';
  const notes = document.getElementById(isI ? 'iNote' : 'eNote').value.trim();
  const editId = document.getElementById(isI ? 'iEditId' : 'eEditId').value.trim();
  const billId = !isI ? document.getElementById('eBillId').value.trim() : '';

  // Validation
  if (!date) { toast('Please select a date', 'error'); return; }
  if (!cat) { toast('Please select a category', 'error'); return; }
  const amount = parseFloat(amt);
  if (!amount || amount <= 0 || isNaN(amount)) {
    toast('Please enter a valid amount', 'error');
    return;
  }

  // Show loading state
  if (saveBtn) saveBtn.classList.add('loading');

  const entry = {
    id: editId || uid(),
    type, date, category: cat, amount, mode, from, vendor, notes,
    savedAt: new Date().toISOString()
  };

  try {
    // Save to Firebase
    if (editId) {
      await updateTxnInFirebase(editId, entry);
    } else {
      await saveTxnToFirebase(entry);
    }

    // If linked to a pending bill, mark the bill as paid
    if (!isI && billId) {
      const bills = getBills();
      const bill = bills.find(b => b.id === billId);
      if (bill) {
        bill.status = 'paid';
        bill.paidDate = date;
        await saveBillToFirebase(bill);
        console.log('✅ Marked bill as paid:', billId);
      }
    }

    // ✅ FULL RESET before closing (prevents data reappearing)
    resetForm(type);

    // Close modal with animation
    closeModalWithAnimation(modalId);

    const action = editId ? 'Updated' : 'Added';
    toast(action + ' ' + type + ' of ' + inr(amount) + ' ✅', 'success');
  } catch (err) {
    console.error('Save error:', err);
    toast('Failed to save. Please try again.', 'error');
  } finally {
    if (saveBtn) saveBtn.classList.remove('loading');
  }
}

function resetForm(type) {
  const isI = type === 'income';
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) {
      el.value = val;
      // Force clear any browser autofill
      el.setAttribute('value', val);
    }
  };

  // Clear all fields
  setVal(isI ? 'iDate' : 'eDate', '');
  setVal(isI ? 'iCat' : 'eCat', '');
  setVal(isI ? 'iAmt' : 'eAmt', '');
  setVal(isI ? 'iMode' : 'eMode', 'Cash');
  setVal(isI ? 'iNote' : 'eNote', '');
  setVal(isI ? 'iEditId' : 'eEditId', '');
  if (!isI) {
    setVal('eBillId', '');
  }

  if (isI) {
    setVal('iFrom', '');
    const p = document.getElementById('iPreview');
    if (p) p.style.display = 'none';
    const v = document.getElementById('iPreviewVal');
    if (v) v.textContent = '₹ 0.00';
  } else {
    setVal('eVendor', '');
    const p = document.getElementById('ePreview');
    if (p) p.style.display = 'none';
    const v = document.getElementById('ePreviewVal');
    if (v) v.textContent = '₹ 0.00';
  }

  // Reset modal title back to "Add"
  const titleEl = document.getElementById(isI ? 'incomeTitle' : 'expenseTitle');
  if (titleEl) {
    titleEl.innerHTML = isI
      ? '<i data-lucide="plus-circle" style="width: 20px; height: 20px;"></i><span>Add Income</span>'
      : '<i data-lucide="minus-circle" style="width: 20px; height: 20px;"></i><span>Add Expense</span>';
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  // Sync custom dropdowns (very important!)
  syncCustomDropdowns(isI ? 'incomeModal' : 'expenseModal');
}

// NEW: Sync custom dropdowns after reset
function syncCustomDropdowns(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  const selects = modal.querySelectorAll('select[data-custom-select="true"]');
  selects.forEach(sel => {
    const wrapper = sel.nextElementSibling;
    if (!wrapper || !wrapper.classList.contains('custom-select')) return;

    const trigger = wrapper.querySelector('.custom-select-trigger');
    const options = wrapper.querySelectorAll('.custom-option');

    // Find matching option and update
    let matchedText = '';
    options.forEach(opt => {
      opt.classList.remove('selected');
      if (opt.getAttribute('data-value') === sel.value) {
        opt.classList.add('selected');
        matchedText = opt.textContent;
      }
    });

    // Fallback to first option
    if (!matchedText && options[0]) {
      matchedText = options[0].textContent;
    }

    if (trigger) trigger.textContent = matchedText;

    // Close if open
    wrapper.classList.remove('open');
  });
}

function openIncomeModal() {
  resetForm('income');
  const d = document.getElementById('iDate');
  if (d) d.value = today();
  // Re-sync after setting date
  setTimeout(() => {
    syncCustomDropdowns('incomeModal');
  }, 50);
  openModal('incomeModal');
}

function openExpenseModal() {
  resetForm('expense');
  const d = document.getElementById('eDate');
  if (d) d.value = today();
  // Re-sync after setting date
  setTimeout(() => {
    syncCustomDropdowns('expenseModal');
  }, 50);
  openModal('expenseModal');
}

// NEW: Smooth close animation
function closeModalWithAnimation(id) {
  const m = document.getElementById(id);
  if (!m) return;

  m.classList.add('closing');
  setTimeout(() => {
    m.classList.remove('open');
    m.classList.remove('closing');
    document.body.style.overflow = '';

    // ✅ Extra safety: reset form again after close
    const type = id === 'incomeModal' ? 'income' : (id === 'expenseModal' ? 'expense' : null);
    if (type) resetForm(type);
  }, 250);
}

function openGoalSettingsModal() {
  const rev = localStorage.getItem('vision_revenue_target') || '150000';
  const exp = localStorage.getItem('vision_expense_cap') || '60000';
  const prf = localStorage.getItem('vision_profit_target') || '1000000';

  const revEl = document.getElementById('targetMonthlyRev');
  const expEl = document.getElementById('targetMonthlyExp');
  const prfEl = document.getElementById('targetAnnualPrf');

  if (revEl) revEl.value = rev;
  if (expEl) expEl.value = exp;
  if (prfEl) prfEl.value = prf;

  openModal('goalSettingsModal');
}

function saveVisionGoals() {
  const revVal = document.getElementById('targetMonthlyRev').value.trim();
  const expVal = document.getElementById('targetMonthlyExp').value.trim();
  const prfVal = document.getElementById('targetAnnualPrf').value.trim();

  const rev = parseFloat(revVal);
  const exp = parseFloat(expVal);
  const prf = parseFloat(prfVal);

  if (isNaN(rev) || rev < 0) { toast('Please enter a valid revenue target', 'error'); return; }
  if (isNaN(exp) || exp < 0) { toast('Please enter a valid expense cap', 'error'); return; }
  if (isNaN(prf) || prf < 0) { toast('Please enter a valid profit milestone', 'error'); return; }

  localStorage.setItem('vision_revenue_target', rev);
  localStorage.setItem('vision_expense_cap', exp);
  localStorage.setItem('vision_profit_target', prf);

  closeModal('goalSettingsModal');
  Dash.loadAll();
  toast('Business targets updated successfully! 🎯', 'success');
}

// Category Budgets Modal Handlers
function openBudgetModal() {
  const catEl = document.getElementById('bgtCategory');
  const amtEl = document.getElementById('bgtAmount');
  if (catEl) {
    catEl.value = '';
    const wrapper = catEl.nextElementSibling;
    if (wrapper && wrapper.classList.contains('custom-select')) {
      const trigger = wrapper.querySelector('.custom-select-trigger');
      if (trigger) trigger.innerHTML = getFormattedOptionHtml('Select Category');
      const customOptions = wrapper.querySelectorAll('.custom-option');
      customOptions.forEach(opt => opt.classList.remove('selected'));
    }
  }
  if (amtEl) amtEl.value = '';
  populateBudgetModalList();
  openModal('budgetModal');
}

function populateBudgetModalList() {
  const listEl = document.getElementById('bgtModalList');
  const countEl = document.getElementById('bgtCountText');
  if (!listEl) return;

  const budgets = getBudgets();
  if (countEl) countEl.textContent = `${budgets.length} configured`;

  if (budgets.length === 0) {
    listEl.innerHTML = `<div style="text-align:center; padding:16px; font-size:0.8rem; color:var(--text-muted);">No category budgets configured yet. Use the form above to add one.</div>`;
    return;
  }

  listEl.innerHTML = budgets.map(b => {
    const iconName = window.getLucideIconName(b.category) || 'package';
    const cleanName = b.category.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDC00-\uDFFF]/g, '').trim();
    const safeCat = encodeURIComponent(b.category);
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:var(--bg-app); border:1px solid var(--border); border-radius:var(--r-md);">
        <div style="display:flex; align-items:center; gap:8px;">
          <i data-lucide="${iconName}" style="width:15px; height:15px; color:var(--brand);"></i>
          <span style="font-weight:700; font-size:0.84rem; color:var(--text-head);">${cleanName}</span>
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          <strong style="font-size:0.88rem; color:var(--text-head);">${inr(b.amount)}</strong>
          <button onclick="editCategoryBudget(decodeURIComponent('${safeCat}'), ${b.amount})" title="Edit" style="background:none; border:none; cursor:pointer; color:var(--text-light); padding:4px;">
            <i data-lucide="edit-2" style="width:14px; height:14px;"></i>
          </button>
          <button onclick="deleteCategoryBudget(decodeURIComponent('${safeCat}'))" title="Delete" style="background:none; border:none; cursor:pointer; color:var(--expense); padding:4px;">
            <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function editCategoryBudget(cat, amount) {
  const catEl = document.getElementById('bgtCategory');
  const amtEl = document.getElementById('bgtAmount');
  if (catEl) {
    catEl.value = cat;
    const wrapper = catEl.nextElementSibling;
    if (wrapper && wrapper.classList.contains('custom-select')) {
      const trigger = wrapper.querySelector('.custom-select-trigger');
      if (trigger) trigger.innerHTML = getFormattedOptionHtml(cat);
      const customOptions = wrapper.querySelectorAll('.custom-option');
      customOptions.forEach(opt => {
        if (opt.getAttribute('data-value') === cat) opt.classList.add('selected');
        else opt.classList.remove('selected');
      });
    }
  }
  if (amtEl) amtEl.value = amount;
  openModal('budgetModal');
}

async function saveCategoryBudgetFromModal() {
  const catEl = document.getElementById('bgtCategory');
  const amtEl = document.getElementById('bgtAmount');
  if (!catEl || !amtEl) return;

  const cat = catEl.value.trim();
  const amt = parseFloat(amtEl.value);

  if (!cat) {
    toast('Please select an expense category', 'warning');
    return;
  }
  if (isNaN(amt) || amt <= 0) {
    toast('Please enter a valid monthly limit amount (> ₹0)', 'warning');
    return;
  }

  await saveBudgetToFirebase(cat, amt);
  toast(`Budget limit of ${inr(amt)} set for "${cat}"! 🎯`, 'success');

  amtEl.value = '';
  catEl.value = '';
  const wrapper = catEl.nextElementSibling;
  if (wrapper && wrapper.classList.contains('custom-select')) {
    const trigger = wrapper.querySelector('.custom-select-trigger');
    if (trigger) trigger.innerHTML = getFormattedOptionHtml('Select Category');
    const customOptions = wrapper.querySelectorAll('.custom-option');
    customOptions.forEach(opt => opt.classList.remove('selected'));
  }
  populateBudgetModalList();
  if (typeof Dash !== 'undefined' && Dash.loadCategoryBudgets) {
    Dash.loadCategoryBudgets(getTxns());
  }
}

async function deleteCategoryBudget(cat) {
  if (!confirm(`Are you sure you want to remove the budget for "${cat}"?`)) return;
  await deleteBudgetFromFirebase(cat);
  toast(`Removed budget for "${cat}"`, 'success');
  populateBudgetModalList();
  if (typeof Dash !== 'undefined' && Dash.loadCategoryBudgets) {
    Dash.loadCategoryBudgets(getTxns());
  }
}

// ============================================
// VENDOR MODALS & CONTROLLER FUNCTIONS
// ============================================

function openVendorModal(vendorId) {
  const titleEl = document.getElementById('vendorModalTitle');
  const nameEl = document.getElementById('vndName');
  const catEl = document.getElementById('vndCategory');
  const phoneEl = document.getElementById('vndPhone');
  const amtEl = document.getElementById('vndAmount');
  const dueEl = document.getElementById('vndDueDate');
  const notesEl = document.getElementById('vndNotes');
  const editIdEl = document.getElementById('vndEditId');

  if (vendorId) {
    const vendors = getVendors();
    const v = vendors.find(item => item.id === vendorId);
    if (v) {
      if (titleEl) titleEl.innerHTML = '<i data-lucide="edit-2" style="width:20px;height:20px;"></i><span>Edit Supplier Details</span>';
      if (nameEl) nameEl.value = v.name || '';
      if (catEl) {
        catEl.value = v.category || '🛒 Grocery';
        updateCustomSelectVisual(catEl);
      }
      if (phoneEl) phoneEl.value = v.phone || '';
      if (amtEl) {
        amtEl.value = v.totalAmount || '';
        amtEl.disabled = true;
      }
      if (dueEl) dueEl.value = v.dueDate || '';
      if (notesEl) notesEl.value = v.notes || '';
      if (editIdEl) editIdEl.value = v.id;
    }
  } else {
    if (titleEl) titleEl.innerHTML = '<i data-lucide="truck" style="width:20px;height:20px;"></i><span>Add Supplier / Vendor</span>';
    if (nameEl) nameEl.value = '';
    if (catEl) {
      catEl.value = '🛒 Grocery';
      updateCustomSelectVisual(catEl);
    }
    if (phoneEl) phoneEl.value = '';
    if (amtEl) {
      amtEl.value = '';
      amtEl.disabled = false;
    }
    if (dueEl) dueEl.value = '';
    if (notesEl) notesEl.value = '';
    if (editIdEl) editIdEl.value = '';
  }

  openModal('vendorModal');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function saveVendorFromModal() {
  const nameEl = document.getElementById('vndName');
  const catEl = document.getElementById('vndCategory');
  const phoneEl = document.getElementById('vndPhone');
  const amtEl = document.getElementById('vndAmount');
  const dueEl = document.getElementById('vndDueDate');
  const notesEl = document.getElementById('vndNotes');
  const editIdEl = document.getElementById('vndEditId');

  if (!nameEl) return;
  const name = nameEl.value.trim();
  if (!name) {
    toast('Please enter the Supplier / Vendor name', 'warning');
    return;
  }

  const editId = editIdEl ? editIdEl.value : '';
  const initialAmt = parseFloat(amtEl ? amtEl.value : 0) || 0;

  if (editId) {
    const vendors = getVendors();
    const existing = vendors.find(v => v.id === editId);
    if (existing) {
      existing.name = name;
      existing.category = catEl ? catEl.value : existing.category;
      existing.phone = phoneEl ? phoneEl.value.trim() : '';
      existing.dueDate = dueEl ? dueEl.value : '';
      existing.notes = notesEl ? notesEl.value.trim() : '';
      await saveVendorToFirebase(existing);
      toast(`Supplier "${name}" updated! ✨`, 'success');
    }
  } else {
    const vendorObj = {
      name: name,
      category: catEl ? catEl.value : '🛒 Grocery',
      phone: phoneEl ? phoneEl.value.trim() : '',
      totalAmount: initialAmt,
      paidAmount: 0,
      dueDate: dueEl ? dueEl.value : '',
      notes: notesEl ? notesEl.value.trim() : '',
      date: new Date().toISOString().substring(0, 10),
      history: initialAmt > 0 ? [{
        id: 'h_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        type: 'purchase',
        amount: initialAmt,
        date: new Date().toISOString().substring(0, 10),
        mode: '',
        notes: notesEl && notesEl.value.trim() ? notesEl.value.trim() : 'Initial Opening Balance / Purchase',
        savedAt: new Date().toISOString()
      }] : []
    };
    await saveVendorToFirebase(vendorObj);
    toast(`Supplier "${name}" added to Khata! 🤝`, 'success');
  }

  closeModal('vendorModal');
  if (typeof Dash !== 'undefined' && Dash.loadVendors) {
    Dash.loadVendors();
  }
}

function editVendor(vendorId) {
  openVendorModal(vendorId);
}

async function deleteVendor(vendorId) {
  const vendors = getVendors();
  const v = vendors.find(item => item.id === vendorId);
  const name = v ? v.name : 'this supplier';
  if (!confirm(`Are you sure you want to remove "${name}" from Vendor Khata?`)) return;
  await deleteVendorFromFirebase(vendorId);
  toast(`Removed "${name}" from Khata`, 'success');
  if (typeof Dash !== 'undefined' && Dash.loadVendors) {
    Dash.loadVendors();
  }
}

function openVendorBillModal(vendorId) {
  const vendors = getVendors();
  const v = vendors.find(item => item.id === vendorId);
  if (!v) return;

  const targetEl = document.getElementById('vndBillTargetId');
  const nameEl = document.getElementById('vndBillSupplierName');
  const pendingEl = document.getElementById('vndBillCurrentPending');
  const amtEl = document.getElementById('vndBillAmt');
  const dateEl = document.getElementById('vndBillDate');
  const notesEl = document.getElementById('vndBillNotes');

  if (targetEl) targetEl.value = v.id;
  if (nameEl) nameEl.textContent = v.name;
  if (pendingEl) pendingEl.textContent = inr(v.pendingAmount || 0);
  if (amtEl) amtEl.value = '';
  if (dateEl) dateEl.value = new Date().toISOString().substring(0, 10);
  if (notesEl) notesEl.value = '';

  openModal('vendorBillModal');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function submitVendorBillModal() {
  const targetEl = document.getElementById('vndBillTargetId');
  const amtEl = document.getElementById('vndBillAmt');
  const dateEl = document.getElementById('vndBillDate');
  const notesEl = document.getElementById('vndBillNotes');

  const vendorId = targetEl ? targetEl.value : '';
  const amt = parseFloat(amtEl ? amtEl.value : 0) || 0;
  const date = dateEl ? dateEl.value : new Date().toISOString().substring(0, 10);
  const notes = notesEl ? notesEl.value.trim() : '';

  if (!vendorId) return;
  if (amt <= 0) {
    toast('Please enter a valid bill amount (> ₹0)', 'warning');
    return;
  }

  await addVendorBillToFirebase(vendorId, amt, date, notes);
  toast(`Added new purchase of ${inr(amt)} to supplier bill! 📦`, 'success');
  closeModal('vendorBillModal');
  if (typeof Dash !== 'undefined' && Dash.loadVendors) {
    Dash.loadVendors();
  }
}

function openVendorPayModal(vendorId) {
  const vendors = getVendors();
  const v = vendors.find(item => item.id === vendorId);
  if (!v) return;

  const targetEl = document.getElementById('vndPayTargetId');
  const nameEl = document.getElementById('vndPaySupplierName');
  const dueEl = document.getElementById('vndPayOutstandingAmt');
  const amtEl = document.getElementById('vndPayAmt');
  const dateEl = document.getElementById('vndPayDate');
  const modeEl = document.getElementById('vndPayMode');
  const notesEl = document.getElementById('vndPayNotes');

  if (targetEl) targetEl.value = v.id;
  if (nameEl) nameEl.textContent = v.name;
  if (dueEl) dueEl.textContent = inr(v.pendingAmount || 0);
  if (amtEl) {
    amtEl.value = v.pendingAmount || '';
    amtEl.max = v.pendingAmount || '';
  }
  if (dateEl) dateEl.value = new Date().toISOString().substring(0, 10);
  if (modeEl) {
    modeEl.value = 'UPI';
    updateCustomSelectVisual(modeEl);
  }
  if (notesEl) notesEl.value = '';

  openModal('vendorPayModal');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function submitVendorPayModal() {
  const targetEl = document.getElementById('vndPayTargetId');
  const amtEl = document.getElementById('vndPayAmt');
  const dateEl = document.getElementById('vndPayDate');
  const modeEl = document.getElementById('vndPayMode');
  const notesEl = document.getElementById('vndPayNotes');
  const autoExpenseEl = document.getElementById('vndPayAutoExpense');

  const vendorId = targetEl ? targetEl.value : '';
  const amt = parseFloat(amtEl ? amtEl.value : 0) || 0;
  const date = dateEl ? dateEl.value : new Date().toISOString().substring(0, 10);
  const mode = modeEl ? modeEl.value : 'UPI';
  const notes = notesEl ? notesEl.value.trim() : '';
  const autoExpense = autoExpenseEl ? autoExpenseEl.checked : true;

  if (!vendorId) return;
  if (amt <= 0) {
    toast('Please enter a valid payment amount (> ₹0)', 'warning');
    return;
  }

  await recordVendorPaymentToFirebase(vendorId, amt, date, mode, notes, autoExpense);
  toast(`Recorded payment of ${inr(amt)} to supplier! 💰`, 'success');
  closeModal('vendorPayModal');
  if (typeof Dash !== 'undefined' && Dash.loadVendors) {
    Dash.loadVendors();
  }
}

function openVendorHistoryModal(vendorId) {
  const vendors = getVendors();
  const v = vendors.find(item => item.id === vendorId);
  if (!v) return;

  const titleEl = document.getElementById('vndHistoryTitle');
  const billedEl = document.getElementById('vndHistBilled');
  const paidEl = document.getElementById('vndHistPaid');
  const pendingEl = document.getElementById('vndHistPending');
  const timelineEl = document.getElementById('vndHistoryTimeline');

  if (titleEl) titleEl.textContent = `${v.name} — Ledger History`;
  if (billedEl) billedEl.textContent = inr(v.totalAmount || 0);
  if (paidEl) paidEl.textContent = inr(v.paidAmount || 0);
  if (pendingEl) pendingEl.textContent = inr(v.pendingAmount || 0);

  const history = Array.isArray(v.history) ? v.history : [];

  if (history.length === 0) {
    timelineEl.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:0.82rem;">No transaction history recorded yet for this supplier.</div>`;
  } else {
    const sorted = [...history].sort((a, b) => new Date(b.date || b.savedAt) - new Date(a.date || a.savedAt));
    timelineEl.innerHTML = sorted.map(item => {
      const isPurchase = item.type === 'purchase';
      const dotColor = isPurchase ? 'var(--expense)' : 'var(--income)';
      const title = isPurchase ? '📦 Goods / Supply Bill' : '💰 Payment Made';
      const badge = isPurchase
        ? `<span style="font-size:0.75rem; font-weight:800; color:var(--expense);">+${inr(item.amount)} Bill</span>`
        : `<span style="font-size:0.75rem; font-weight:800; color:var(--income);">-${inr(item.amount)} Paid (${escapeHtml(item.mode || 'Cash')})</span>`;

      return `
        <div class="vendor-timeline-item">
          <div class="vendor-timeline-dot" style="background:${dotColor};"></div>
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <div style="font-size:0.84rem; font-weight:800; color:var(--text-head);">${title}</div>
              <div style="font-size:0.72rem; color:var(--text-light); margin-top:2px;">
                📅 ${fmtDate(item.date)} ${item.notes ? '• ' + escapeHtml(item.notes) : ''}
              </div>
            </div>
            <div>${badge}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  openModal('vendorHistoryModal');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function updateCustomSelectVisual(selectEl) {
  if (!selectEl) return;
  const wrapper = selectEl.nextElementSibling;
  if (wrapper && wrapper.classList.contains('custom-select')) {
    const trigger = wrapper.querySelector('.custom-select-trigger');
    if (trigger) trigger.innerHTML = getFormattedOptionHtml(selectEl.value);
    const customOptions = wrapper.querySelectorAll('.custom-option');
    customOptions.forEach(opt => {
      if (opt.getAttribute('data-value') === selectEl.value) opt.classList.add('selected');
      else opt.classList.remove('selected');
    });
  }
}

// Pizza Cafe Background Simulator Engine
const PizzaCafeSimulator = {
  active: false,
  timer: null,

  toggle: function (checked) {
    this.active = checked;
    if (this.active) {
      this.start();
    } else {
      this.stop();
    }
  },

  start: function () {
    this.stop();
    console.log('🍕 Pizza Cafe Simulator started silently in the background.');
    this.scheduleNext();
  },

  stop: function () {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  },

  scheduleNext: function () {
    if (!this.active) return;
    const delay = Math.floor(Math.random() * 15000) + 10000;
    this.timer = setTimeout(() => {
      this.generateTransaction();
      this.scheduleNext();
    }, delay);
  },

  generateTransaction: function () {
    const isSale = Math.random() < 0.75;
    const dateStr = today();

    if (isSale) {
      const pizzaItems = [
        { name: '🍕 Margherita Pizza (Large)', price: 349 },
        { name: '🍕 Pepperoni Feast (Medium)', price: 429 },
        { name: '🍕 Double Cheese Margherita', price: 299 },
        { name: '🍕 Garden Veggie Pizza', price: 379 },
        { name: '🍕 Paneer Tikka Supreme', price: 449 },
        { name: '🥤 Garlic Bread & Cold Drinks Combo', price: 189 }
      ];
      const item = pizzaItems[Math.floor(Math.random() * pizzaItems.length)];
      const qty = Math.random() < 0.2 ? 2 : 1;
      const amount = item.price * qty;
      const customers = ['Rahul Gupta', 'Pooja Patel', 'Aditya Nair', 'Neha Sharma', 'Vikram Das', 'Karan Verma', 'Simran Kaur'];
      const from = customers[Math.floor(Math.random() * customers.length)];
      const mode = ['UPI', 'Cash', 'Card'][Math.floor(Math.random() * 3)];

      const sale = {
        id: 't_sim_' + Date.now(),
        type: 'income',
        date: dateStr,
        category: '🛒 Sales',
        amount,
        mode,
        from,
        vendor: '',
        notes: `${qty}x ${item.name}`,
        savedAt: new Date().toISOString()
      };

      if (typeof Dash !== 'undefined') {
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        Dash.liveSalesData.push({ time: timeStr, amount });
        if (Dash.liveSalesData.length > 8) Dash.liveSalesData.shift();
      }

      this.saveSimTxn(sale);

      toast(`🍕 Pizza Cafe Sale: ${sale.notes} for ₹${sale.amount}`, 'success');

      if (typeof Dash !== 'undefined' && typeof Dash.addNotification === 'function') {
        Dash.addNotification('success', '🍕 Pizza Cafe Sale', `${sale.notes} sold to ${sale.from} for ₹${sale.amount}`);
      }
    } else {
      const expenseItems = [
        { name: '🧀 Mozzarella Cheese pack', price: 1200, category: '📦 Supplies', vendor: 'Dairyland Cheese' },
        { name: '🍅 Organic Tomato Purée box', price: 650, category: '📦 Supplies', vendor: 'Organic Veggies Ltd' },
        { name: '📦 Pizza Delivery Boxes (100pcs)', price: 950, category: '📦 Supplies', vendor: 'Packaging Pro' },
        { name: '⛽ Scooter fuel refill', price: 300, category: '⛽ Fuel', vendor: 'HP Petrol Pump' },
        { name: '🧹 Kitchen cleaning supplies', price: 450, category: '🔨 Maintenance', vendor: 'Local Supermart' }
      ];
      const item = expenseItems[Math.floor(Math.random() * expenseItems.length)];
      const amount = item.price;
      const mode = ['UPI', 'Cash', 'Card'][Math.floor(Math.random() * 3)];

      const expense = {
        id: 't_sim_' + Date.now(),
        type: 'expense',
        date: dateStr,
        category: item.category,
        amount,
        mode,
        from: '',
        vendor: item.vendor,
        notes: item.name,
        savedAt: new Date().toISOString()
      };

      this.saveSimTxn(expense);

      toast(`🧀 Supplies Expense: Purchased ${expense.notes} for ₹${expense.amount}`, 'danger');

      if (typeof Dash !== 'undefined' && typeof Dash.addNotification === 'function') {
        Dash.addNotification('danger', '🧀 Supplies Expense', `Purchased ${expense.notes} from ${expense.vendor} for ₹${expense.amount}`);
      }
    }
  },

  saveSimTxn: function (txn) {
    let txns = [];
    try {
      txns = JSON.parse(localStorage.getItem(APP.storageKey) || '[]');
    } catch (e) { }
    txns.push(txn);
    localStorage.setItem(APP.storageKey, JSON.stringify(txns));
    if (typeof currentTxns !== 'undefined') currentTxns = txns;
    if (typeof window !== 'undefined') window.currentTxns = txns;

    if (typeof triggerUIUpdate === 'function') {
      triggerUIUpdate();
    } else if (typeof Dash !== 'undefined' && typeof Dash.loadAll === 'function') {
      Dash.loadAll();
    }
  }
};

window.openDashCustomizerModal = function () {
  if (typeof Dash !== 'undefined' && typeof Dash.loadCustomizerPreferences === 'function') {
    Dash.loadCustomizerPreferences();
  }
  if (typeof openModal === 'function') {
    openModal('dashCustomizerModal');
  } else {
    const modal = document.getElementById('dashCustomizerModal');
    if (modal) {
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.openTxnDetailModal = function (txnId) {
  if (typeof Dash !== 'undefined' && Dash.viewTxnDetails) Dash.viewTxnDetails(txnId);
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Dash.init());
} else {
  Dash.init();
}