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

  init: function () {
    try {
      if (typeof Chart !== 'undefined') {
        Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";
      }
      this.lineChartTab = 'historical';
      this.simSessionStats = { income: 0, count: 0 };
      this.liveSalesData = [];
      this.period = 'today';

      // Enforce default visual tab highlight for Today
      const todayBtn = document.querySelector('.pb-tab[data-p="today"]');
      if (todayBtn) {
        document.querySelectorAll('.pb-tab').forEach(t => t.classList.remove('active'));
        todayBtn.classList.add('active');
      }

      // SEED DATA UPGRADE FOR DEMO MODE
      if (localStorage.getItem('bd_mode') === 'demo') {
        const currentTxns = getTxns();
        if (currentTxns.length < 10) {
          console.log('Seeding rich transaction database...');
          this.seedRealisticData();
        }
      }

      this.setupWelcome();
      this.setupYearSelector();
      this.loadAll();
      this.setupSearch();
      this.animateNumbers();
      this.loadNotifications();

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
    this.loadSummary(all);
    this.loadCashOnline(all);
    this.loadAnalytics(all);
    this.loadInsights(all);
    this.loadComparison(all);
    this.loadTopCategories(all);
    this.loadPaymentModes(all);
    this.loadRecent(all);
    this.loadGoals(all);
    if (typeof Chart !== 'undefined') {
      this.buildBarChart(all);
      this.buildDonutChart(all);
      this.buildLineChart(all);
      this.buildCompareChart(all);
      this.buildPayModeChart(all);
      this.buildSparklines(all);
    } else {
      setTimeout(() => {
        if (typeof Chart !== 'undefined') {
          const txns = getTxns();
          this.buildBarChart(txns);
          this.buildDonutChart(txns);
          this.buildLineChart(txns);
          this.buildCompareChart(txns);
          this.buildPayModeChart(txns);
          this.buildSparklines(txns);
        }
      }, 500);
    }
  },

  animateNumbers: function () {
    setTimeout(() => {
      const numberIds = [
        'pIncome', 'pExpense', 'pProfit', 'totalBal',
        'cashIn', 'cashOut', 'cashBalance',
        'onlineIn', 'onlineOut', 'onlineBalance',
        'msAvgIncome', 'msAvgExpense', 'msSavings',
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
      grouped[t.category] = (grouped[t.category] || 0) + parseFloat(t.amount || 0);
    }
    const sorted = Object.entries(grouped).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const max = sorted[0][1];
    box.innerHTML = sorted.map((item, i) => {
      const cat = item[0], amt = item[1];
      const width = (amt / max) * 100;
      const rankClass = i < 3 ? 'r' + (i + 1) : '';
      return '<div class="tc-item"><div class="tc-rank ' + rankClass + '">' + (i + 1) + '</div><div class="tc-info"><div class="tc-name">' + window.getFormattedOptionHtml(cat, 13) + '</div><div class="tc-bar"><div class="tc-fill" style="width:0%"></div></div></div><div class="tc-amt">' + inrShort(amt) + '</div></div>';
    }).join('');

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }

    setTimeout(() => {
      const fills = box.querySelectorAll('.tc-fill');
      sorted.forEach((item, i) => {
        if (fills[i]) fills[i].style.width = ((item[1] / max) * 100) + '%';
      });
    }, 300);
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
      const icon = icons[mode] || 'banknote';
      return '<div class="pm-item"><div class="pm-ic" style="display:flex; align-items:center; justify-content:center;"><i data-lucide="' + icon + '" style="width: 16px; height: 16px; color: var(--brand);"></i></div><div class="pm-info"><div class="pm-name">' + escapeHtml(mode) + '</div><div class="pm-sub">' + data.count + ' transactions</div></div><div><div class="pm-amt">' + inrShort(data.total) + '</div><div class="pm-pct">' + pct + '%</div></div></div>';
    }).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  loadRecent: function (all) {
    const tbody = document.getElementById('recentBody');
    if (!tbody) return;
    if (!all.length) {
      tbody.innerHTML = '<tr><td colspan="5"><div class="empty"><div class="empty-icon" style="display:flex; justify-content:center;"><i data-lucide="clipboard-list" style="width: 32px; height: 32px;"></i></div><h4>No transactions yet</h4></div></td></tr>';
      if (typeof lucide !== 'undefined') lucide.createIcons();
      return;
    }
    const sorted = all.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
    tbody.innerHTML = sorted.map(t => {
      const isI = t.type === 'income';
      return '<tr><td style="font-size:0.82rem;">' + fmtDate(t.date) + '</td><td><span class="badge ' + (isI ? 'badge-in' : 'badge-out') + '" style="display:inline-flex; align-items:center; gap:4px;"><i data-lucide="' + (isI ? 'arrow-down-left' : 'arrow-up-right') + '" style="width:12px; height:12px;"></i>' + (isI ? 'In' : 'Out') + '</span></td><td style="font-size:0.82rem;font-weight:600;">' + window.getFormattedOptionHtml(t.category || '-', 13) + '</td><td class="' + (isI ? 'amt-in' : 'amt-out') + '">' + (isI ? '+' : '-') + inrShort(t.amount) + '</td><td style="font-size:0.78rem;color:var(--text-muted);">' + window.getFormattedOptionHtml(t.mode || 'Cash', 13) + '</td></tr>';
    }).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  setupYearSelector: function () {
    const sel = document.getElementById('chartYear');
    if (!sel || sel.options.length > 0) return;
    const cur = getISTDateParts().year;
    for (let y = cur; y >= cur - 4; y--) {
      const o = document.createElement('option');
      o.value = y;
      o.textContent = y;
      if (y === cur) o.selected = true;
      sel.appendChild(o);
    }
  },

  buildBarChart: function (all) {
    const canvas = document.getElementById('barChart');
    if (!canvas || typeof Chart === 'undefined') return;
    const year = parseInt(document.getElementById('chartYear') ? document.getElementById('chartYear').value : getISTDateParts().year);
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

    const ctx = canvas.getContext('2d');
    const incomeColor = themeColors.getIncome();
    const expenseColor = themeColors.getExpense();
    const borderVal = themeColors.getBorder();
    const textMutedVal = themeColors.getTextMuted();

    const gInc = ctx.createLinearGradient(0, 0, 0, 300);
    gInc.addColorStop(0, incomeColor + 'D0'); // Soft Green
    gInc.addColorStop(1, incomeColor + '1A');

    const gExp = ctx.createLinearGradient(0, 0, 0, 300);
    gExp.addColorStop(0, expenseColor + 'D0'); // Soft Red
    gExp.addColorStop(1, expenseColor + '1A');

    if (this.charts.bar) {
      this.charts.bar.destroy();
      this.charts.bar = null;
    }

    this.charts.bar = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [
          { label: 'Income', data: income, backgroundColor: gInc, borderColor: incomeColor, borderWidth: 1.5, borderRadius: { topLeft: 10, topRight: 10 }, maxBarThickness: 32 },
          { label: 'Expense', data: expense, backgroundColor: gExp, borderColor: expenseColor, borderWidth: 1.5, borderRadius: { topLeft: 10, topRight: 10 }, maxBarThickness: 32 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600, easing: 'easeOutQuart' },
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
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
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

    const sorted = Object.entries(grouped).sort((a, b) => b[1] - a[1]);
    const labels = sorted.map(x => x[0]);
    const values = sorted.map(x => x[1]);
    const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#38bdf8', '#ec4899', '#f59e0b'];
    const total = values.reduce((a, b) => a + b, 0);

    const legend = document.getElementById('payModeBox');
    if (legend) {
      if (!labels.length) {
        legend.innerHTML = '<div class="empty" style="padding:12px; text-align:center; color:var(--text-muted);"><p>No transaction data</p></div>';
      } else {
        legend.innerHTML = labels.map((l, i) =>
          '<div class="leg-row"><div class="leg-dot" style="background:' + colors[i % colors.length] + '"></div><span class="leg-name">' + escapeHtml(l) + '</span><span class="leg-val">' + inrShort(values[i]) + '</span><span class="leg-pct">' + Math.round((values[i] / total) * 100) + '%</span></div>'
        ).join('');
      }
    }

    if (!labels.length) {
      if (this.charts.payMode) {
        this.charts.payMode.destroy();
        this.charts.payMode = null;
      }
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
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

    if (this.charts.payMode) {
      this.charts.payMode.data.labels = labels.slice(0, ringsCount);
      this.charts.payMode.data.datasets = datasets;
      this.charts.payMode.update();
      return;
    }

    this.charts.payMode = new Chart(canvas, {
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

      const gLive = ctx.createLinearGradient(0, 0, 0, 280);
      gLive.addColorStop(0, brandColor + '4D');
      gLive.addColorStop(1, brandColor + '00');

      this.charts.line = new Chart(canvas, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Live Sales (₹)',
            data: sales,
            borderColor: brandColor,
            backgroundColor: gLive,
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

      const g1 = ctx.createLinearGradient(0, 0, 0, 280);
      g1.addColorStop(0, incomeColor + '59');
      g1.addColorStop(1, incomeColor + '00');

      const g2 = ctx.createLinearGradient(0, 0, 0, 280);
      g2.addColorStop(0, expenseColor + '59');
      g2.addColorStop(1, expenseColor + '00');

      const g3 = ctx.createLinearGradient(0, 0, 0, 280);
      g3.addColorStop(0, brandColor + '59');
      g3.addColorStop(1, brandColor + '00');

      this.charts.line = new Chart(canvas, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Income', data: income,
              borderColor: incomeColor, backgroundColor: g1,
              borderWidth: 3, pointRadius: 0, pointHoverRadius: 7,
              pointBackgroundColor: incomeColor, pointBorderColor: '#ffffff', pointBorderWidth: 3,
              fill: true, tension: 0.42
            },
            {
              label: 'Expense', data: expense,
              borderColor: expenseColor, backgroundColor: g2,
              borderWidth: 3, pointRadius: 0, pointHoverRadius: 7,
              pointBackgroundColor: expenseColor, pointBorderColor: '#ffffff', pointBorderWidth: 3,
              fill: true, tension: 0.42
            },
            {
              label: 'Net Cash Flow', data: net,
              borderColor: brandColor, backgroundColor: g3,
              borderWidth: 3, pointRadius: 0, pointHoverRadius: 7,
              pointBackgroundColor: brandColor, pointBorderColor: '#ffffff', pointBorderWidth: 3,
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
            legend: {
              display: true,
              position: 'top',
              align: 'end',
              labels: {
                boxWidth: 8,
                boxHeight: 8,
                usePointStyle: true,
                pointStyle: 'circle',
                padding: 12,
                font: { family: "'Plus Jakarta Sans', sans-serif", size: 9, weight: '700' },
                color: textMutedVal
              }
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
            x: { grid: { display: false }, border: { display: false }, ticks: { color: textMutedVal, font: { family: "'Plus Jakarta Sans', sans-serif", size: 10, weight: '600' }, maxRotation: 0 } },
            y: { beginAtZero: true, grid: { color: themeColors.getGridColor() }, border: { display: false }, ticks: { color: textMutedVal, font: { family: "'Plus Jakarta Sans', sans-serif", size: 11, weight: '600' }, callback: v => inrShort(v) } }
          }
        }
      });
    }
  },

  buildCompareChart: function(all) {
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
            backgroundColor: 'rgba(15, 23, 42, 0.08)', // Faint neutral
            borderColor: textMutedVal,
            borderWidth: 1.5,
            borderRadius: 10
          },
          {
            label: 'This Month',
            data: [thisM.income, thisM.expense, thisM.profit],
            backgroundColor: brandColor + '40', // brand with 25% opacity
            borderColor: brandDarkColor,
            borderWidth: 1.5,
            borderRadius: 10
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
            labels: {
              boxWidth: 12,
              font: { size: 9, family: "'Plus Jakarta Sans', sans-serif", weight: '600' },
              color: textMutedVal,
              padding: 6
            }
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
          x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 9, family: "'Plus Jakarta Sans', sans-serif" }, color: textMutedVal } },
          y: { grid: { color: themeColors.getGridColor(), borderDash: [4, 4], drawTicks: false }, border: { display: false }, ticks: { font: { size: 8, family: "'Plus Jakarta Sans', sans-serif" }, color: textMutedVal, callback: v => inrShort(v) } }
        }
      }
    });
  },

  buildPayModeChart: function(all) {
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
    const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#38bdf8', '#ec4899', '#f59e0b'];

    if (this.charts.payMode) {
      this.charts.payMode.data.labels = labels.length ? labels : ['No Data'];
      this.charts.payMode.data.datasets[0].data = labels.length ? values : [1];
      this.charts.payMode.data.datasets[0].backgroundColor = labels.length ? colors.slice(0, labels.length) : ['#e2e8f0'];
      this.charts.payMode.update();
      return;
    }

    if (!labels.length) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    this.charts.payMode = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: colors.slice(0, labels.length),
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
          legend: {
            display: true,
            position: 'right',
            labels: {
              boxWidth: 8,
              font: { size: 9, family: "'Plus Jakarta Sans', sans-serif", weight: '700' },
              color: '#9aa3b2',
              padding: 8
            }
          },
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
              label: function(ctx) {
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

  buildSparklines: function (all) {
    const ids = [
      'sparklineIncome', 'sparklineExpense', 'sparklineProfit', 'sparklineBalance',
      'sparklineAvgIncome', 'sparklineAvgExpense', 'sparklineSavingsRate'
    ];
    const canvases = ids.map(id => document.getElementById(id));
    if (canvases.some(c => !c) || typeof Chart === 'undefined') return;

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

    const sparkConfigs = [
      { id: 'sparklineIncome', data: incomeData, color: themeColors.getIncome(), label: 'Income', chartKey: 'sparkIncome' },
      { id: 'sparklineExpense', data: expenseData, color: themeColors.getExpense(), label: 'Expense', chartKey: 'sparkExpense' },
      { id: 'sparklineProfit', data: profitData, color: themeColors.getProfit(), label: 'Profit', chartKey: 'sparkProfit' },
      { id: 'sparklineBalance', data: balanceData, color: themeColors.getBrand(), label: 'Balance', chartKey: 'sparkBalance' },
      { id: 'sparklineAvgIncome', data: incomeData, color: themeColors.getIncome(), label: 'Avg Income', chartKey: 'sparkAvgIncome' },
      { id: 'sparklineAvgExpense', data: expenseData, color: themeColors.getExpense(), label: 'Avg Expense', chartKey: 'sparkAvgExpense' },
      { id: 'sparklineSavingsRate', data: savingsRateData, color: themeColors.getPurple(), label: 'Savings Rate', chartKey: 'sparkSavings' }
    ];

    sparkConfigs.forEach(conf => {
      const canvas = document.getElementById(conf.id);
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
          labels: dateLabels,
          datasets: [{
            data: conf.data,
            borderColor: conf.color,
            backgroundColor: gradient,
            borderWidth: 1.8,
            pointRadius: 0,
            pointHoverRadius: 3,
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
      } catch (e) {}
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
    } catch (e) {}

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
    } catch (e) {}

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

    const d = new Date(now);
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
        const remaining = prfTarget - ytdProfit;
        if (remaining > 0) {
          prfStatusEl.textContent = `₹ ${inrShort(remaining)} remaining to hit milestone`;
          prfStatusEl.style.color = 'var(--text-light)';
        } else {
          prfStatusEl.textContent = `Goal reached (Current: ${inrShort(ytdProfit)})`;
          prfStatusEl.style.color = 'var(--purple)';
        }
      }
    }
  }
};

// GLOBAL
function switchLineChartTab(tab, btn) {
  if (typeof Dash === 'undefined') return;

  Dash.lineChartTab = tab;

  const header = btn.parentElement;
  if (header) {
    const tabs = header.querySelectorAll('.pb-tab');
    tabs.forEach(t => {
      t.classList.remove('active');
      t.style.color = 'var(--text-light)';
    });
  }
  btn.classList.add('active');
  btn.style.color = 'var(--text-head)';

  const pulse = document.querySelector('#chartTabVelocity .live-pulse');
  if (pulse) {
    pulse.style.display = (tab === 'live' && PizzaCafeSimulator.active) ? 'inline-block' : 'none';
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
    } catch (e) {}
    txns.push(txn);
    localStorage.setItem(APP.storageKey, JSON.stringify(txns));

    if (typeof triggerUIUpdate === 'function') {
      triggerUIUpdate();
    } else if (typeof Dash !== 'undefined' && typeof Dash.loadAll === 'function') {
      Dash.loadAll();
    }
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Dash.init());
} else {
  Dash.init();
}