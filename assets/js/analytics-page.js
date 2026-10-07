/* ============================================
   ANALYTICS-PAGE.JS v2.0.0 (Advanced Intelligence Suite)
   Crust & Chilly Business Dashboard
   Executive KPIs, MoM Growth, Category Drill-Down, Counterparties & Daily Ledger
   ============================================ */

'use strict';

const AnalyticsPage = {
  charts: { 
    profitTrend: null, 
    categoryShare: null, 
    weekdayActivity: null,
    cumulativeBalance: null,
    paymentMode: null,
    platformChannel: null
  },
  period: 'month',
  customStart: '',
  customEnd: '',
  categoryTab: 'all',
  categorySearch: '',
  dailySearch: '',
  cachedFilteredTxns: [],
  cachedDailySummary: [],

  init: function() {
    try {
      if (typeof Chart !== 'undefined') {
        Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";
      }
      this.setupWelcomeDate();
      this.setupCustomRangeDefaults();
      this.setupModalDates();
      this.loadAll();
    } catch (err) {
      console.error('AnalyticsPage init error:', err);
    }
  },

  setupWelcomeDate: function() {
    const headerDate = document.getElementById('headerDate');
    if (headerDate) {
      headerDate.textContent = fmtDateFull(today());
    }
  },

  setupCustomRangeDefaults: function() {
    const now = (typeof getISTDateObject === 'function') ? getISTDateObject() : new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const firstDay = `${y}-${m}-01`;
    const curDay = (typeof today === 'function') ? today() : new Date().toISOString().substring(0, 10);

    const sEl = document.getElementById('anStartDate');
    const eEl = document.getElementById('anEndDate');
    if (sEl && !sEl.value) sEl.value = firstDay;
    if (eEl && !eEl.value) eEl.value = curDay;

    this.customStart = sEl ? sEl.value : firstDay;
    this.customEnd = eEl ? eEl.value : curDay;
  },

  setupModalDates: function() {
    const iDate = document.getElementById('iDate');
    const eDate = document.getElementById('eDate');
    if (iDate) iDate.value = today();
    if (eDate) eDate.value = today();
  },

  onPeriodChange: function() {
    const select = document.getElementById('analyticsPeriod');
    const customWrap = document.getElementById('anCustomRangeWrap');
    if (!select) return;

    this.period = select.value;
    if (this.period === 'custom') {
      if (customWrap) customWrap.style.display = 'inline-flex';
    } else {
      if (customWrap) customWrap.style.display = 'none';
      this.loadAll();
    }
  },

  applyCustomRange: function() {
    const sEl = document.getElementById('anStartDate');
    const eEl = document.getElementById('anEndDate');
    if (!sEl || !eEl) return;
    if (!sEl.value || !eEl.value) {
      if (typeof toast === 'function') toast('Please pick both start and end date', 'warning');
      return;
    }
    if (sEl.value > eEl.value) {
      if (typeof toast === 'function') toast('Start date must be before end date', 'error');
      return;
    }
    this.customStart = sEl.value;
    this.customEnd = eEl.value;
    this.loadAll();
    if (typeof toast === 'function') toast('Custom date range applied', 'info');
  },

  /* Calculates exact start/end and prior comparison window */
  getPeriodBounds: function(period) {
    const now = (typeof getISTDateObject === 'function') ? getISTDateObject() : new Date();
    const todayStr = (typeof today === 'function') ? today() : new Date().toISOString().substring(0, 10);
    const toYMD = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    if (period === 'today') {
      const yest = new Date(now);
      yest.setDate(yest.getDate() - 1);
      const yestStr = toYMD(yest);
      return {
        start: todayStr, end: todayStr, label: `Today (${fmtDate(todayStr)})`,
        prevStart: yestStr, prevEnd: yestStr, prevLabel: 'Yesterday'
      };
    }

    if (period === 'yesterday') {
      const yest = new Date(now);
      yest.setDate(yest.getDate() - 1);
      const yestStr = toYMD(yest);
      const dayBefore = new Date(now);
      dayBefore.setDate(dayBefore.getDate() - 2);
      const dayBeforeStr = toYMD(dayBefore);
      return {
        start: yestStr, end: yestStr, label: `Yesterday (${fmtDate(yestStr)})`,
        prevStart: dayBeforeStr, prevEnd: dayBeforeStr, prevLabel: 'Day Before'
      };
    }

    if (period === 'week') {
      const cur = new Date(now);
      const day = cur.getDay() || 7; // Mon is 1
      const start = new Date(cur);
      start.setDate(cur.getDate() - day + 1);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);

      const prevStart = new Date(start);
      prevStart.setDate(prevStart.getDate() - 7);
      const prevEnd = new Date(end);
      prevEnd.setDate(prevEnd.getDate() - 7);

      return {
        start: toYMD(start), end: toYMD(end), label: `This Week (${fmtDate(toYMD(start))} - ${fmtDate(toYMD(end))})`,
        prevStart: toYMD(prevStart), prevEnd: toYMD(prevEnd), prevLabel: 'Last Week'
      };
    }

    if (period === 'lastweek') {
      const cur = new Date(now);
      const day = cur.getDay() || 7;
      const start = new Date(cur);
      start.setDate(cur.getDate() - day - 6);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);

      const prevStart = new Date(start);
      prevStart.setDate(prevStart.getDate() - 7);
      const prevEnd = new Date(end);
      prevEnd.setDate(prevEnd.getDate() - 7);

      return {
        start: toYMD(start), end: toYMD(end), label: `Last Week (${fmtDate(toYMD(start))} - ${fmtDate(toYMD(end))})`,
        prevStart: toYMD(prevStart), prevEnd: toYMD(prevEnd), prevLabel: '2 Weeks Ago'
      };
    }

    if (period === 'month') {
      const y = now.getFullYear();
      const m = now.getMonth();
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 0);

      const prevStart = new Date(y, m - 1, 1);
      const prevEnd = new Date(y, m, 0);

      const monthName = start.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
      return {
        start: toYMD(start), end: toYMD(end), label: `This Month (${monthName})`,
        prevStart: toYMD(prevStart), prevEnd: toYMD(prevEnd), prevLabel: 'Last Month'
      };
    }

    if (period === 'lastmonth') {
      const y = now.getFullYear();
      const m = now.getMonth();
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0);

      const prevStart = new Date(y, m - 2, 1);
      const prevEnd = new Date(y, m - 1, 0);

      const monthName = start.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
      return {
        start: toYMD(start), end: toYMD(end), label: `Last Month (${monthName})`,
        prevStart: toYMD(prevStart), prevEnd: toYMD(prevEnd), prevLabel: '2 Months Ago'
      };
    }

    if (period === 'quarter') {
      const y = now.getFullYear();
      const m = now.getMonth();
      const q = Math.floor(m / 3);
      const start = new Date(y, q * 3, 1);
      const end = new Date(y, (q + 1) * 3, 0);

      const prevStart = new Date(y, (q - 1) * 3, 1);
      const prevEnd = new Date(y, q * 3, 0);

      return {
        start: toYMD(start), end: toYMD(end), label: `This Quarter (Q${q + 1} ${y})`,
        prevStart: toYMD(prevStart), prevEnd: toYMD(prevEnd), prevLabel: `Q${q || 4} Prior`
      };
    }

    if (period === 'year') {
      const y = now.getFullYear();
      const start = `${y}-01-01`;
      const end = `${y}-12-31`;
      const prevStart = `${y - 1}-01-01`;
      const prevEnd = `${y - 1}-12-31`;
      return {
        start, end, label: `This Year (${y})`,
        prevStart, prevEnd, prevLabel: `Last Year (${y - 1})`
      };
    }

    if (period === 'custom') {
      const start = this.customStart || todayStr;
      const end = this.customEnd || todayStr;
      const sDate = new Date(start);
      const eDate = new Date(end);
      const diffMs = eDate.getTime() - sDate.getTime();
      const diffDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);

      const pEnd = new Date(sDate);
      pEnd.setDate(pEnd.getDate() - 1);
      const pStart = new Date(pEnd);
      pStart.setDate(pStart.getDate() - diffDays + 1);

      return {
        start, end, label: `Custom (${fmtDate(start)} - ${fmtDate(end)})`,
        prevStart: toYMD(pStart), prevEnd: toYMD(pEnd), prevLabel: 'Prior Window'
      };
    }

    // Default: 'all'
    return {
      start: '1970-01-01', end: '2099-12-31', label: 'All Time History',
      prevStart: null, prevEnd: null, prevLabel: 'None'
    };
  },

  filterTxnsByRange: function(txns, start, end) {
    if (!Array.isArray(txns)) return [];
    if (!start || !end) return txns;
    return txns.filter(t => t.date && t.date >= start && t.date <= end);
  },

  loadAll: function() {
    const allTxns = (typeof getTxns === 'function') ? getTxns() : (window.currentTxns || []);
    const bounds = this.getPeriodBounds(this.period);

    // Update active range badge
    const rangeText = document.getElementById('anRangeText');
    if (rangeText) rangeText.textContent = bounds.label;

    // Filter txns for active period & prior comparison period
    const filteredTxns = this.filterTxnsByRange(allTxns, bounds.start, bounds.end);
    const prevTxns = (bounds.prevStart && bounds.prevEnd)
      ? this.filterTxnsByRange(allTxns, bounds.prevStart, bounds.prevEnd)
      : [];

    this.cachedFilteredTxns = filteredTxns;

    // 1. Executive Financial Summary Cards & Growth %
    this.loadExecutiveSummary(filteredTxns, prevTxns, bounds);

    // 2. Smart Business Health & Operational Insights
    this.loadSmartInsights(filteredTxns, prevTxns, allTxns);

    // 3. Core KPI Gauges
    this.loadKPIs(filteredTxns, allTxns);

    // 4. Forecast & Projection
    this.loadProjections(allTxns);

    // 5. Daily Break-Even & Profit Runway Tracker
    this.loadBreakEvenTracker(allTxns);

    // 6. Platform Ordering Channel Breakdown & Commission
    this.loadPlatformAnalysis(filteredTxns);

    // 7. Visual Charts Grid
    this.buildCharts(filteredTxns);

    // 8. In-Depth Category Breakdown Matrix
    this.loadCategoryMatrix(filteredTxns);

    // 9. Commercial Counterparties & Khata Intelligence
    this.loadCommercialCounterparties(filteredTxns);

    // 10. Daily Cashflow Velocity Ledger
    this.loadDailyLedger(filteredTxns);

    // 11. Detailed Capital Channels Report
    this.loadCapitalChannelsReport(filteredTxns, allTxns);

    // 12. Number Animations
    this.animateMetrics();

    if (typeof lucide !== 'undefined') {
      try { lucide.createIcons(); } catch (e) { }
    }
  },

  /* ==========================================================================
     1. EXECUTIVE FINANCIAL SUMMARY & GROWTH %
     ========================================================================== */
  loadExecutiveSummary: function(filtered, prev, bounds) {
    const curTot = calcTotals(filtered);
    const prevTot = calcTotals(prev);

    let incCount = 0, expCount = 0;
    const activeDates = new Set();
    filtered.forEach(t => {
      if (t.type === 'income') incCount++;
      else if (t.type === 'expense') expCount++;
      if (t.date) activeDates.add(t.date);
    });

    const activeDaysCount = activeDates.size;
    const dailyAvgRev = activeDaysCount > 0 ? Math.round(curTot.income / activeDaysCount) : 0;

    // Calculate Growth vs previous period
    const calcGrowth = (cur, prev) => {
      if (prev === 0) return cur > 0 ? 100 : 0;
      return Math.round(((cur - prev) / Math.abs(prev)) * 100);
    };

    const revGrowth = calcGrowth(curTot.income, prevTot.income);
    const expGrowth = calcGrowth(curTot.expense, prevTot.expense);
    const prfGrowth = calcGrowth(curTot.profit, prevTot.profit);

    const formatBadge = (elId, pct, inverse) => {
      const el = document.getElementById(elId);
      if (!el) return;
      if (!bounds.prevStart) {
        el.className = 'an-growth-badge neutral';
        el.textContent = 'All Time';
        return;
      }
      const isPositive = pct > 0;
      const isGood = inverse ? pct <= 0 : pct >= 0;
      el.className = `an-growth-badge ${isGood ? 'up' : 'down'}`;
      el.innerHTML = `${isPositive ? '↗ +' : '↘ '}${pct}% vs ${bounds.prevLabel}`;
    };

    // Revenue updates
    const revEl = document.getElementById('scTotalRevenue');
    if (revEl) revEl.textContent = inr(curTot.income);
    formatBadge('scRevGrowthBadge', revGrowth, false);
    const revOrdersEl = document.getElementById('scRevOrders');
    if (revOrdersEl) revOrdersEl.textContent = `${incCount} order${incCount === 1 ? '' : 's'}`;
    const revDailyAvgEl = document.getElementById('scRevDailyAvg');
    if (revDailyAvgEl) revDailyAvgEl.textContent = `Avg ${inr(dailyAvgRev)} / day`;

    // Expense updates
    const expEl = document.getElementById('scTotalExpense');
    if (expEl) expEl.textContent = inr(curTot.expense);
    formatBadge('scExpGrowthBadge', expGrowth, true); // Lower expense is good
    const expCountEl = document.getElementById('scExpCount');
    if (expCountEl) expCountEl.textContent = `${expCount} record${expCount === 1 ? '' : 's'}`;
    const expRatioEl = document.getElementById('scExpRatio');
    const expRatioVal = curTot.income > 0 ? Math.round((curTot.expense / curTot.income) * 100) : (curTot.expense > 0 ? 100 : 0);
    if (expRatioEl) expRatioEl.textContent = `${expRatioVal}% of revenue`;

    // Net Profit updates
    const prfEl = document.getElementById('scNetProfit');
    if (prfEl) {
      prfEl.textContent = inr(curTot.profit);
      prfEl.style.color = curTot.profit >= 0 ? 'var(--income)' : 'var(--expense)';
    }
    formatBadge('scPrfGrowthBadge', prfGrowth, false);
    const marginPct = curTot.income > 0 ? Math.round((curTot.profit / curTot.income) * 100) : 0;
    const marginEl = document.getElementById('scProfitMargin');
    if (marginEl) {
      marginEl.textContent = `Margin: ${marginPct}%`;
      marginEl.style.color = marginPct >= 20 ? 'var(--income)' : (marginPct >= 0 ? '#d97706' : 'var(--expense)');
    }
    const statusEl = document.getElementById('scProfitStatus');
    if (statusEl) {
      if (marginPct >= 35) statusEl.textContent = 'High Margin 📈';
      else if (marginPct >= 15) statusEl.textContent = 'Healthy 👍';
      else if (marginPct > 0) statusEl.textContent = 'Low Margin ⚠️';
      else if (curTot.income === 0 && curTot.expense === 0) statusEl.textContent = 'No Activity';
      else statusEl.textContent = 'Operating Deficit 🚨';
    }

    // Velocity & Run-rate
    const runEl = document.getElementById('scDailyRunRate');
    if (runEl) runEl.textContent = `${inr(dailyAvgRev)} / day`;
    const paceEl = document.getElementById('scMonthPace');
    const now = (typeof getISTDateObject === 'function') ? getISTDateObject() : new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthPace = Math.round(dailyAvgRev * daysInMonth);
    if (paceEl) paceEl.textContent = `Pacing ~ ${inrShort(monthPace)} / mo`;
    const activeDaysEl = document.getElementById('scActiveDays');
    if (activeDaysEl) activeDaysEl.textContent = `${activeDaysCount} active days`;
  },

  /* ==========================================================================
     2. SMART BUSINESS HEALTH & OPERATIONAL INSIGHTS
     ========================================================================== */
  loadSmartInsights: function(filtered, prev, all) {
    const container = document.getElementById('smartInsightsGrid');
    if (!container) return;

    const curTot = calcTotals(filtered);
    const margin = curTot.income > 0 ? Math.round((curTot.profit / curTot.income) * 100) : 0;

    // 1. Find single largest expense category
    const catMap = {};
    filtered.forEach(t => {
      if (t.type === 'expense' && t.category) {
        catMap[t.category] = (catMap[t.category] || 0) + (parseFloat(t.amount) || 0);
      }
    });
    let topExpenseCat = 'None';
    let topExpenseAmt = 0;
    for (const c in catMap) {
      if (catMap[c] > topExpenseAmt) {
        topExpenseAmt = catMap[c];
        topExpenseCat = c;
      }
    }
    const topExpShare = curTot.expense > 0 ? Math.round((topExpenseAmt / curTot.expense) * 100) : 0;

    // 2. Platform Swiggy/Zomato commission leakage
    let aggRevenue = 0;
    let directRevenue = 0;
    filtered.forEach(t => {
      if (t.type !== 'income') return;
      const amt = parseFloat(t.amount) || 0;
      const text = `${t.category || ''} ${t.notes || ''} ${t.from || ''}`.toLowerCase();
      if (text.includes('swiggy') || text.includes('zomato')) aggRevenue += amt;
      else directRevenue += amt;
    });
    const estCommission = Math.round(aggRevenue * 0.22); // ~22% average Swiggy/Zomato fee

    // 3. Peak activity day
    const weekdaySums = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    filtered.forEach(t => {
      if (t.type === 'income' && t.date) {
        const parts = t.date.split('-');
        if (parts.length === 3) {
          const d = new Date(parts[0], parts[1] - 1, parts[2]);
          weekdaySums[d.getDay()] += parseFloat(t.amount) || 0;
        }
      }
    });
    let peakDayIdx = 0, peakDaySum = 0;
    for (let i = 0; i < 7; i++) {
      if (weekdaySums[i] > peakDaySum) {
        peakDaySum = weekdaySums[i];
        peakDayIdx = i;
      }
    }
    const peakDayShare = curTot.income > 0 ? Math.round((peakDaySum / curTot.income) * 100) : 0;

    // Render cards
    container.innerHTML = `
      <!-- Card 1: Profit Margin Diagnostic -->
      <div class="as-card">
        <div class="as-card-hd">
          <div class="as-card-icon" style="background:rgba(16,185,129,0.12); color:#10b981;">💎</div>
          <span class="as-card-title">Margin Efficiency</span>
        </div>
        <div class="as-card-val" style="color:${margin >= 25 ? 'var(--income)' : (margin >= 0 ? '#d97706' : 'var(--expense)')};">
          ${margin}% Net Margin
        </div>
        <div class="as-card-sub">
          ${margin >= 30 
            ? `Excellent profitability. For every ₹100 earned, ₹${margin} is retained as net business capital.` 
            : (margin > 0 
                ? `Moderate profitability. Retaining ₹${margin} per ₹100 revenue. Review operational costs.` 
                : 'Expenses exceeded revenue in this period. Review overheads and vendor spend.')}
        </div>
      </div>

      <!-- Card 2: Highest Cost Driver -->
      <div class="as-card">
        <div class="as-card-hd">
          <div class="as-card-icon" style="background:rgba(244,63,94,0.12); color:#f43f5e;">⚡</div>
          <span class="as-card-title">Top Expense Driver</span>
        </div>
        <div class="as-card-val" style="color:var(--expense);">
          ${topExpenseCat !== 'None' ? topExpenseCat.replace(/^[^\s]+\s+/, '') : 'No Outflows'}
        </div>
        <div class="as-card-sub">
          ${topExpenseAmt > 0 
            ? `${inr(topExpenseAmt)} consumed (${topExpShare}% of all period expenses). Monitoring this single category gives maximum cost savings.`
            : 'No expense records found in this selection.'}
        </div>
      </div>

      <!-- Card 3: Platform Commission Intelligence -->
      <div class="as-card">
        <div class="as-card-hd">
          <div class="as-card-icon" style="background:rgba(252,128,25,0.12); color:#fc8019;">🛵</div>
          <span class="as-card-title">Aggregator Commission</span>
        </div>
        <div class="as-card-val" style="color:#fc8019;">
          ~ ${inr(estCommission)}
        </div>
        <div class="as-card-sub">
          ${aggRevenue > 0 
            ? `Estimated 22% platform cut on Swiggy & Zomato (${inr(aggRevenue)} total). Counter sales keep 100% margin.` 
            : 'All income recorded was direct Counter or UPI with 0% platform commission deductions.'}
        </div>
      </div>

      <!-- Card 4: Revenue Velocity & Peak Day -->
      <div class="as-card">
        <div class="as-card-hd">
          <div class="as-card-icon" style="background:rgba(139,92,246,0.12); color:#8b5cf6;">🚀</div>
          <span class="as-card-title">Peak Revenue Day</span>
        </div>
        <div class="as-card-val" style="color:var(--brand);">
          ${peakDaySum > 0 ? dayNames[peakDayIdx] : 'Even Pace'}
        </div>
        <div class="as-card-sub">
          ${peakDaySum > 0 
            ? `${dayNames[peakDayIdx]} brings in ${inr(peakDaySum)} (${peakDayShare}% of total income). Ensure optimal staffing on this day.` 
            : 'Add transaction records to detect weekly revenue surges.'}
        </div>
      </div>
    `;
  },

  /* ==========================================================================
     3. HEALTH SCORE, BURN RATE & TRANSACTION METRICS
     ========================================================================== */
  loadKPIs: function(filtered, all) {
    this.calculateHealthScore(filtered);

    // 2. Burn Rate
    const totals = calcTotals(filtered);
    let burnRate = 0;
    if (totals.income > 0) {
      burnRate = Math.round((totals.expense / totals.income) * 100);
    } else if (totals.expense > 0) {
      burnRate = 100;
    }
    const burnValEl = document.getElementById('burnRateVal');
    if (burnValEl) burnValEl.textContent = burnRate + '%';
    const burnSubEl = document.getElementById('burnRateSub');
    if (burnSubEl) {
      if (burnRate > 90) burnSubEl.textContent = '⚠️ Critical burn rate';
      else if (burnRate > 70) burnSubEl.textContent = '📈 High expense margin';
      else if (burnRate > 0) burnSubEl.textContent = '👍 Moderate spending';
      else burnSubEl.textContent = '🎉 Safe spending (No expenses)';
    }

    // 3. Average Transaction Value
    let incomeCount = 0, expenseCount = 0;
    filtered.forEach(t => {
      if (t.type === 'income') incomeCount++;
      else if (t.type === 'expense') expenseCount++;
    });
    const avgIncome = incomeCount > 0 ? totals.income / incomeCount : 0;
    const avgExpense = expenseCount > 0 ? totals.expense / expenseCount : 0;
    const avgTxValEl = document.getElementById('avgTxVal');
    if (avgTxValEl) avgTxValEl.textContent = inr(avgIncome);
    const avgTxSubEl = document.getElementById('avgTxSub');
    if (avgTxSubEl) {
      avgTxSubEl.textContent = `Avg Expense: ${inr(avgExpense)}`;
    }

    // 4. Busiest Weekday Activity
    const weekdayCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    filtered.forEach(t => {
      if (t.date) {
        const parts = t.date.split('-');
        if (parts.length === 3) {
          const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
          weekdayCounts[dateObj.getDay()]++;
        }
      }
    });

    let peakDay = -1;
    let maxCount = 0;
    for (let day = 0; day < 7; day++) {
      if (weekdayCounts[day] > maxCount) {
        maxCount = weekdayCounts[day];
        peakDay = day;
      }
    }

    const peakDayValEl = document.getElementById('peakDayVal');
    const peakDaySubEl = document.getElementById('peakDaySub');
    if (peakDayValEl && peakDaySubEl) {
      if (peakDay !== -1 && maxCount > 0) {
        peakDayValEl.textContent = weekdayNames[peakDay];
        peakDaySubEl.textContent = `${maxCount} records logged`;
      } else {
        peakDayValEl.textContent = 'None';
        peakDaySubEl.textContent = 'Add data to analyze';
      }
    }
  },

  calculateHealthScore: function(txns) {
    const totals = calcTotals(txns);
    const savingRate = totals.income > 0 ? (totals.profit / totals.income) * 100 : 0;
    const profitMargin = totals.income > 0 ? (totals.profit / totals.income) * 100 : 0;

    let savingScore = 0;
    if (savingRate > 0) savingScore = Math.min(30, Math.round(savingRate * 0.75));

    let marginScore = 0;
    if (profitMargin > 0) marginScore = Math.min(40, Math.round(profitMargin * 0.8));

    let expenseControlScore = 0;
    if (totals.income > 0) {
      const expenseRatio = totals.expense / totals.income;
      if (expenseRatio <= 0.5) expenseControlScore = 20;
      else if (expenseRatio <= 0.7) expenseControlScore = 15;
      else if (expenseRatio <= 0.9) expenseControlScore = 8;
      else expenseControlScore = 2;
    } else if (totals.expense === 0) {
      expenseControlScore = 20;
    }

    const activeDays = new Set();
    txns.forEach(t => { if (t.date) activeDays.add(t.date); });
    let consistencyScore = Math.min(10, activeDays.size * 2);

    let finalScore = savingScore + marginScore + expenseControlScore + consistencyScore;
    if (totals.income === 0 && totals.expense > 0) {
      finalScore = Math.max(10, finalScore - 40);
    }
    finalScore = Math.min(100, Math.max(0, Math.round(finalScore)));

    const ringBar = document.getElementById('healthRingBar');
    const scoreVal = document.getElementById('healthScoreVal');
    const scoreStatus = document.getElementById('healthScoreStatus');

    if (scoreVal) scoreVal.textContent = finalScore;
    
    if (ringBar) {
      const circumference = 195;
      const offset = circumference - (finalScore / 100) * circumference;
      ringBar.style.strokeDasharray = circumference;
      ringBar.style.strokeDashoffset = offset;
    }

    if (scoreStatus) {
      if (finalScore >= 80) {
        scoreStatus.textContent = '🏆 Excellent';
        scoreStatus.style.color = 'var(--income)';
      } else if (finalScore >= 60) {
        scoreStatus.textContent = '💪 Healthy';
        scoreStatus.style.color = 'var(--brand)';
      } else if (finalScore >= 40) {
        scoreStatus.textContent = '⚠️ Attention';
        scoreStatus.style.color = '#d97706';
      } else {
        scoreStatus.textContent = '🚨 Critical';
        scoreStatus.style.color = 'var(--expense)';
      }
    }
  },

  /* ==========================================================================
     4. NEXT MONTH PROJECTIONS & PREDICTIVE MODEL
     ========================================================================== */
  loadProjections: function(allTxns) {
    if (!Array.isArray(allTxns) || !allTxns.length) {
      this.updateForecastUI(0, 0, 0);
      return;
    }

    const monthlyData = {};
    allTxns.forEach(t => {
      if (t.date) {
        const monthKey = t.date.substring(0, 7);
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { income: 0, expense: 0 };
        }
        const amt = parseFloat(t.amount) || 0;
        if (t.type === 'income') monthlyData[monthKey].income += amt;
        else if (t.type === 'expense') monthlyData[monthKey].expense += amt;
      }
    });

    const months = Object.keys(monthlyData).sort();
    if (months.length === 0) {
      this.updateForecastUI(0, 0, 0);
      return;
    }

    const recentMonthsKeys = months.slice(-3);
    let totalIncome = 0;
    let totalExpense = 0;
    recentMonthsKeys.forEach(m => {
      totalIncome += monthlyData[m].income;
      totalExpense += monthlyData[m].expense;
    });

    const divisor = recentMonthsKeys.length;
    const projectedRev = Math.round(totalIncome / divisor);
    const projectedExp = Math.round(totalExpense / divisor);
    const projectedPrf = projectedRev - projectedExp;

    this.updateForecastUI(projectedRev, projectedExp, projectedPrf);
  },

  updateForecastUI: function(rev, exp, prf) {
    const revEl = document.getElementById('projRevenue');
    const expEl = document.getElementById('projExpenses');
    const prfEl = document.getElementById('projProfit');
    const revBar = document.getElementById('projRevBar');
    const expBar = document.getElementById('projExpBar');
    const prfBar = document.getElementById('projPrfBar');

    if (revEl) revEl.textContent = inr(rev);
    if (expEl) expEl.textContent = inr(exp);
    if (prfEl) prfEl.textContent = inr(prf);

    const maxVal = Math.max(rev, exp, Math.abs(prf), 100);
    if (revBar) revBar.style.width = Math.min(100, (rev / maxVal) * 100) + '%';
    if (expBar) expBar.style.width = Math.min(100, (exp / maxVal) * 100) + '%';
    if (prfBar) prfBar.style.width = Math.min(100, (Math.max(0, prf) / maxVal) * 100) + '%';
  },

  /* ==========================================================================
     5. BREAK-EVEN & PROFIT RUNWAY TRACKER
     ========================================================================== */
  loadBreakEvenTracker: function(allTxns) {
    const rent = parseFloat(localStorage.getItem('bd_be_rent') || '20000');
    const staff = parseFloat(localStorage.getItem('bd_be_staff') || '15000');
    const utilities = parseFloat(localStorage.getItem('bd_be_utilities') || '5000');
    const other = parseFloat(localStorage.getItem('bd_be_other') || '2000');
    const totalMonthlyOverhead = rent + staff + utilities + other;

    const now = (typeof getISTDateObject === 'function') ? getISTDateObject() : new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const curDayNum = now.getDate();
    const dailyTarget = Math.round(totalMonthlyOverhead / daysInMonth);

    // Today's revenue
    const todayStr = (typeof today === 'function') ? today() : new Date().toISOString().substring(0, 10);
    const todayTxns = allTxns.filter(t => t.type === 'income' && t.date === todayStr);
    const todayRevenue = todayTxns.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    const todaySurplus = todayRevenue - dailyTarget;

    // Current month revenue & expenses
    const curMonthTxns = allTxns.filter(t => t.date && (typeof isThisMonth === 'function' ? isThisMonth(t.date) : true));
    const curMonthTotals = calcTotals(curMonthTxns);
    const curMonthRevenue = curMonthTotals.income;
    const curMonthProfit = curMonthTotals.profit;
    const monthCoveragePct = totalMonthlyOverhead > 0 ? Math.round((curMonthRevenue / totalMonthlyOverhead) * 100) : 100;

    // DOM updates
    const dtEl = document.getElementById('beDailyTarget');
    if (dtEl) dtEl.textContent = inr(dailyTarget);

    const trEl = document.getElementById('beTodayRevenue');
    if (trEl) trEl.textContent = inr(todayRevenue);

    const tcEl = document.getElementById('beTodayCount');
    if (tcEl) tcEl.textContent = `${todayTxns.length} transactions today`;

    const tsEl = document.getElementById('beTodaySurplus');
    if (tsEl) {
      if (todaySurplus >= 0) {
        tsEl.textContent = `+${inr(todaySurplus)}`;
        tsEl.style.color = 'var(--income)';
      } else {
        tsEl.textContent = `-${inr(Math.abs(todaySurplus))}`;
        tsEl.style.color = 'var(--expense)';
      }
    }

    const tssEl = document.getElementById('beTodaySurplusSub');
    if (tssEl) {
      tssEl.textContent = todaySurplus >= 0 ? 'Surplus beyond break-even 🎉' : `₹ ${inrShort(Math.abs(todaySurplus))} needed to break even`;
    }

    const moEl = document.getElementById('beMonthlyOverhead');
    if (moEl) moEl.textContent = inr(totalMonthlyOverhead);

    const obEl = document.getElementById('beOverheadBreakdown');
    if (obEl) obEl.textContent = `Rent: ${inrShort(rent)} · Staff: ${inrShort(staff)} · Util: ${inrShort(utilities)}`;

    // Pacing progress
    const pacingPct = dailyTarget > 0 ? Math.round((todayRevenue / dailyTarget) * 100) : 100;
    const bpEl = document.getElementById('bePacingPercent');
    if (bpEl) bpEl.textContent = `${pacingPct}%`;

    const bfEl = document.getElementById('bePacingFill');
    if (bfEl) {
      bfEl.style.width = `${Math.min(pacingPct, 100)}%`;
      if (pacingPct >= 100) {
        bfEl.style.background = 'linear-gradient(90deg, #10b981, #059669)';
      } else if (pacingPct >= 50) {
        bfEl.style.background = 'linear-gradient(90deg, #f59e0b, #d97706)';
      } else {
        bfEl.style.background = 'linear-gradient(90deg, #f43f5e, #e11d48)';
      }
    }

    const badgeEl = document.getElementById('beStatusBadge');
    if (badgeEl) {
      if (todaySurplus >= 0) {
        badgeEl.className = 'be-status-badge achieved';
        badgeEl.textContent = `🎉 Break-Even Achieved (+${inrShort(todaySurplus)})`;
      } else {
        badgeEl.className = 'be-status-badge pending';
        badgeEl.textContent = `⏳ ₹ ${inrShort(Math.abs(todaySurplus))} Needed Today`;
      }
    }

    const pnEl = document.getElementById('bePacingNote');
    if (pnEl) {
      pnEl.textContent = todaySurplus >= 0 ? `Daily target of ₹ ${inrShort(dailyTarget)} reached today!` : `₹ ${inr(Math.abs(todaySurplus))} remaining to cover today's fixed cost`;
    }

    const mcEl = document.getElementById('beMonthCoverageNote');
    if (mcEl) {
      mcEl.textContent = `Month Overhead Covered: ${monthCoveragePct}% (${inrShort(curMonthRevenue)} / ${inrShort(totalMonthlyOverhead)})`;
    }

    // Break-Even Milestone & Runway Cushion
    const msEl = document.getElementById('beEstimatedMilestone');
    if (msEl) {
      if (curMonthRevenue >= totalMonthlyOverhead) {
        msEl.textContent = `🎉 Break-Even reached for the month!`;
        msEl.style.color = 'var(--income)';
      } else {
        const dailyRunRate = curDayNum > 0 ? curMonthRevenue / curDayNum : 0;
        if (dailyRunRate > 0) {
          const estDay = Math.min(daysInMonth, Math.ceil(totalMonthlyOverhead / dailyRunRate));
          msEl.textContent = `📅 Projected Break-Even: Day ${estDay} of ${daysInMonth}`;
        } else {
          msEl.textContent = `📅 Projected Break-Even: Pending transactions`;
        }
      }
    }

    const rwEl = document.getElementById('beRunwayCushion');
    if (rwEl) {
      if (curMonthProfit > 0 && dailyTarget > 0) {
        const cushionDays = Math.round(curMonthProfit / dailyTarget);
        rwEl.textContent = `🛡️ Profit Runway: ${cushionDays} days overhead covered`;
        rwEl.style.color = 'var(--income)';
      } else {
        rwEl.textContent = `🛡️ Profit Runway: 0 days cushion`;
        rwEl.style.color = 'var(--text-muted)';
      }
    }
  },

  /* ==========================================================================
     6. IN-DEPTH CATEGORY BREAKDOWN & EXPENSE DRILLDOWN MATRIX
     ========================================================================== */
  setCategoryTab: function(tab) {
    this.categoryTab = tab;
    ['catTabAll', 'catTabExpense', 'catTabIncome'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(tab === 'all' ? 'catTabAll' : (tab === 'expense' ? 'catTabExpense' : 'catTabIncome'));
    if (activeBtn) activeBtn.classList.add('active');
    this.renderCategoryMatrixTable();
  },

  onCategorySearch: function(val) {
    this.categorySearch = (val || '').toLowerCase().trim();
    this.renderCategoryMatrixTable();
  },

  loadCategoryMatrix: function(filtered) {
    this.categoryMatrixData = [];
    const catMap = {};

    let totalIncome = 0;
    let totalExpense = 0;

    filtered.forEach(t => {
      const amt = parseFloat(t.amount) || 0;
      const type = t.type === 'income' ? 'income' : 'expense';
      const cat = t.category || (type === 'income' ? 'Other Income' : 'Other Expense');

      if (type === 'income') totalIncome += amt;
      else totalExpense += amt;

      const key = `${type}___${cat}`;
      if (!catMap[key]) {
        catMap[key] = {
          name: cat,
          type: type,
          total: 0,
          count: 0,
          max: 0
        };
      }
      catMap[key].total += amt;
      catMap[key].count++;
      if (amt > catMap[key].max) catMap[key].max = amt;
    });

    const list = Object.values(catMap);
    list.forEach(item => {
      const baseTotal = item.type === 'income' ? totalIncome : totalExpense;
      item.share = baseTotal > 0 ? Math.round((item.total / baseTotal) * 100) : 0;
      item.avg = item.count > 0 ? Math.round(item.total / item.count) : 0;
    });

    // Sort by total descending
    list.sort((a, b) => b.total - a.total);
    this.categoryMatrixData = list;
    this.renderCategoryMatrixTable();
  },

  renderCategoryMatrixTable: function() {
    const tbody = document.getElementById('categoryMatrixBody');
    if (!tbody) return;

    let items = this.categoryMatrixData || [];

    // Filter by tab
    if (this.categoryTab !== 'all') {
      items = items.filter(i => i.type === this.categoryTab);
    }

    // Filter by search
    if (this.categorySearch) {
      items = items.filter(i => i.name.toLowerCase().includes(this.categorySearch));
    }

    const countBadge = document.getElementById('catCountBadge');
    if (countBadge) {
      countBadge.textContent = `${items.length} Categories${items.length > 10 ? ' (Scroll ↓)' : ''}`;
    }

    if (!items.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; padding:30px; color:var(--text-muted);">
            No category transactions match the current filter.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = items.map(item => {
      const isInc = item.type === 'income';
      const color = isInc ? '#10b981' : '#f43f5e';
      return `
        <tr>
          <td style="font-weight:700; color:var(--text-head);">${item.name}</td>
          <td><span class="cat-type-badge ${isInc ? 'inc' : 'exp'}">${item.type}</span></td>
          <td style="font-weight:800; color:${color};">${inr(item.total)}</td>
          <td style="font-weight:700;">${item.share}%</td>
          <td>${item.count}</td>
          <td>${inr(item.avg)}</td>
          <td>${inr(item.max)}</td>
          <td>
            <div class="cat-bar-wrap">
              <div class="cat-progress-bar">
                <div class="cat-progress-fill" style="width:${Math.min(item.share, 100)}%; background:${color};"></div>
              </div>
              <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted); width:32px;">${item.share}%</span>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  /* ==========================================================================
     7. COMMERCIAL COUNTERPARTIES & KHATA INTELLIGENCE
     ========================================================================== */
  loadCommercialCounterparties: function(filtered) {
    const custMap = {};
    const vendMap = {};

    let totalCustAmt = 0;
    let totalVendAmt = 0;

    filtered.forEach(t => {
      const amt = parseFloat(t.amount) || 0;
      if (t.type === 'income') {
        const name = (t.from && t.from.trim()) ? t.from.trim() : (t.category || 'Direct Sales');
        if (!custMap[name]) custMap[name] = { name, total: 0, count: 0, lastDate: t.date };
        custMap[name].total += amt;
        custMap[name].count++;
        totalCustAmt += amt;
      } else if (t.type === 'expense') {
        const name = (t.vendor && t.vendor.trim()) ? t.vendor.trim() : (t.category || 'Direct Expense');
        if (!vendMap[name]) vendMap[name] = { name, total: 0, count: 0, category: t.category };
        vendMap[name].total += amt;
        vendMap[name].count++;
        totalVendAmt += amt;
      }
    });

    const topCustomers = Object.values(custMap).sort((a, b) => b.total - a.total).slice(0, 5);
    const topVendors = Object.values(vendMap).sort((a, b) => b.total - a.total).slice(0, 5);

    const tcTotalEl = document.getElementById('topCustomerTotal');
    if (tcTotalEl) tcTotalEl.textContent = inr(totalCustAmt);

    const tvTotalEl = document.getElementById('topVendorTotal');
    if (tvTotalEl) tvTotalEl.textContent = inr(totalVendAmt);

    // Render Customers
    const custListEl = document.getElementById('topCustomersList');
    if (custListEl) {
      if (!topCustomers.length) {
        custListEl.innerHTML = '<div style="font-size:0.78rem; color:var(--text-muted); text-align:center; padding:18px;">No customer records logged.</div>';
      } else {
        custListEl.innerHTML = topCustomers.map(c => {
          const avg = c.count > 0 ? Math.round(c.total / c.count) : 0;
          const letter = c.name.charAt(0).toUpperCase();
          return `
            <div class="party-item">
              <div class="party-item-left">
                <div class="party-avatar" style="background:rgba(16,185,129,0.12); color:#059669;">${letter}</div>
                <div class="party-info">
                  <div class="party-name">${c.name}</div>
                  <div class="party-sub">${c.count} orders · Avg ${inrShort(avg)}</div>
                </div>
              </div>
              <div class="party-item-right">
                <div class="party-amount" style="color:var(--income);">${inr(c.total)}</div>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // Render Vendors
    const vendListEl = document.getElementById('topVendorsList');
    if (vendListEl) {
      if (!topVendors.length) {
        vendListEl.innerHTML = '<div style="font-size:0.78rem; color:var(--text-muted); text-align:center; padding:18px;">No supplier records logged.</div>';
      } else {
        vendListEl.innerHTML = topVendors.map(v => {
          const avg = v.count > 0 ? Math.round(v.total / v.count) : 0;
          const letter = v.name.charAt(0).toUpperCase();
          return `
            <div class="party-item">
              <div class="party-item-left">
                <div class="party-avatar" style="background:rgba(244,63,94,0.12); color:#e11d48;">${letter}</div>
                <div class="party-info">
                  <div class="party-name">${v.name}</div>
                  <div class="party-sub">${v.count} bills · ${v.category || 'Expense'}</div>
                </div>
              </div>
              <div class="party-item-right">
                <div class="party-amount" style="color:var(--expense);">${inr(v.total)}</div>
              </div>
            </div>
          `;
        }).join('');
      }
    }
  },

  /* ==========================================================================
     8. DAILY CASHFLOW VELOCITY LEDGER
     ========================================================================== */
  onDailyLedgerSearch: function(val) {
    this.dailySearch = (val || '').toLowerCase().trim();
    this.renderDailyLedgerTable();
  },

  loadDailyLedger: function(filtered) {
    const dayMap = {};

    filtered.forEach(t => {
      if (!t.date) return;
      const amt = parseFloat(t.amount) || 0;
      if (!dayMap[t.date]) {
        dayMap[t.date] = { date: t.date, income: 0, expense: 0, count: 0 };
      }
      if (t.type === 'income') dayMap[t.date].income += amt;
      else if (t.type === 'expense') dayMap[t.date].expense += amt;
      dayMap[t.date].count++;
    });

    const sortedDates = Object.keys(dayMap).sort().reverse();
    this.cachedDailySummary = sortedDates.map(d => {
      const item = dayMap[d];
      const net = item.income - item.expense;
      const parts = d.split('-');
      const dObj = new Date(parts[0], parts[1] - 1, parts[2]);
      const dayName = dObj.toLocaleDateString('en-IN', { weekday: 'short' });
      return {
        date: d,
        formattedDate: `${fmtDate(d)} (${dayName})`,
        dayName: dayName,
        income: item.income,
        expense: item.expense,
        net: net,
        count: item.count
      };
    });

    this.renderDailyLedgerTable();
  },

  renderDailyLedgerTable: function() {
    const tbody = document.getElementById('dailyLedgerBody');
    if (!tbody) return;

    let items = this.cachedDailySummary || [];
    if (this.dailySearch) {
      items = items.filter(i => 
        i.date.includes(this.dailySearch) || 
        i.formattedDate.toLowerCase().includes(this.dailySearch)
      );
    }

    if (!items.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; padding:30px; color:var(--text-muted);">
            No cashflow movements match the active criteria.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = items.map(d => {
      let badgeClass = 'profitable';
      let badgeLabel = 'Net Surplus';
      if (d.income > 5000 && d.net > 0) {
        badgeClass = 'high-sales';
        badgeLabel = '🔥 High Sales';
      } else if (d.net < 0) {
        badgeClass = 'deficit';
        badgeLabel = '⚠️ Deficit';
      } else if (d.income === 0 && d.expense === 0) {
        badgeClass = 'inactive';
        badgeLabel = '💤 Inactive';
      }

      return `
        <tr>
          <td style="font-weight:700; color:var(--text-head);">${d.formattedDate}</td>
          <td style="font-weight:700; color:var(--income);">${inr(d.income)}</td>
          <td style="font-weight:700; color:var(--expense);">${inr(d.expense)}</td>
          <td style="font-weight:800; color:${d.net >= 0 ? 'var(--income)' : 'var(--expense)'};">
            ${d.net >= 0 ? '+' : ''}${inr(d.net)}
          </td>
          <td>${d.count} txns</td>
          <td><span class="daily-status-pill ${badgeClass}">${badgeLabel}</span></td>
        </tr>
      `;
    }).join('');
  },

  exportDailyLedgerCSV: function() {
    const items = this.cachedDailySummary || [];
    if (!items.length) {
      if (typeof toast === 'function') toast('No daily activity to export', 'warning');
      return;
    }

    let csv = 'Date,Day,Inflow Revenue (INR),Outflow Expense (INR),Net Cashflow (INR),Transactions\n';
    items.forEach(d => {
      csv += `"${d.date}","${d.dayName}",${d.income},${d.expense},${d.net},${d.count}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `crust_chilly_daily_cashflow_${this.period}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (typeof toast === 'function') toast('Daily cashflow CSV exported successfully', 'success');
  },

  /* ==========================================================================
     9. EXPORT COMPLETE ANALYTICS EXECUTIVE REPORT
     ========================================================================== */
  exportAnalyticsReport: function() {
    if (typeof XLSX === 'undefined') {
      if (typeof toast === 'function') toast('Export library loading, please try in a moment', 'info');
      return;
    }

    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Summary & Channels
      const curTot = calcTotals(this.cachedFilteredTxns);
      const summaryRows = [
        ['Crust & Chilly — Executive Analytics Report'],
        ['Report Period', this.period.toUpperCase()],
        ['Generated At', new Date().toLocaleString('en-IN')],
        [],
        ['Metric', 'Value'],
        ['Total Period Revenue', curTot.income],
        ['Total Period Expenses', curTot.expense],
        ['Net Operating Profit', curTot.profit],
        ['Profit Margin %', curTot.income > 0 ? ((curTot.profit / curTot.income) * 100).toFixed(1) + '%' : '0%'],
        ['Total Transactions Count', this.cachedFilteredTxns.length]
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary');

      // Sheet 2: Category Matrix
      if (this.categoryMatrixData && this.categoryMatrixData.length) {
        const catRows = [
          ['Category', 'Flow Type', 'Total (INR)', 'Share %', 'Count', 'Avg Ticket (INR)', 'Max Single (INR)']
        ];
        this.categoryMatrixData.forEach(c => {
          catRows.push([c.name, c.type, c.total, c.share + '%', c.count, c.avg, c.max]);
        });
        const wsCat = XLSX.utils.aoa_to_sheet(catRows);
        XLSX.utils.book_append_sheet(wb, wsCat, 'Category Breakdown');
      }

      // Sheet 3: Daily Ledger
      if (this.cachedDailySummary && this.cachedDailySummary.length) {
        const dailyRows = [
          ['Date', 'Day', 'Inflow (INR)', 'Outflow (INR)', 'Net (INR)', 'Count']
        ];
        this.cachedDailySummary.forEach(d => {
          dailyRows.push([d.date, d.dayName, d.income, d.expense, d.net, d.count]);
        });
        const wsDaily = XLSX.utils.aoa_to_sheet(dailyRows);
        XLSX.utils.book_append_sheet(wb, wsDaily, 'Daily Cashflow');
      }

      XLSX.writeFile(wb, `crust_chilly_analytics_${this.period}_${today()}.xlsx`);
      if (typeof toast === 'function') toast('Analytics Excel Report downloaded successfully! 📊', 'success');
    } catch (err) {
      console.error('Analytics export error:', err);
      if (typeof toast === 'function') toast('Failed to export report: ' + err.message, 'error');
    }
  },

  /* ==========================================================================
     10. VISUAL CHARTS BUILDER
     ========================================================================== */
  buildCharts: function(txns) {
    if (typeof Chart === 'undefined') return;

    this.buildProfitTrendChart(txns);
    this.buildCategoryShareChart(txns);
    this.buildWeekdayActivityChart(txns);
    this.buildCumulativeBalanceChart(txns);
    this.buildPaymentModeChart(txns);
  },

  buildProfitTrendChart: function(txns) {
    const monthlyMap = {};
    txns.forEach(t => {
      if (t.date) {
        const key = t.date.substring(0, 7);
        if (!monthlyMap[key]) monthlyMap[key] = { income: 0, expense: 0 };
        const amt = parseFloat(t.amount) || 0;
        if (t.type === 'income') monthlyMap[key].income += amt;
        else if (t.type === 'expense') monthlyMap[key].expense += amt;
      }
    });

    const months = Object.keys(monthlyMap).sort();
    const labels = months.map(m => {
      const date = new Date(m + '-02');
      return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
    });

    const profits = months.map(m => monthlyMap[m].income - monthlyMap[m].expense);
    const incomes = months.map(m => monthlyMap[m].income);

    const ctx = document.getElementById('profitTrendChart');
    if (!ctx) return;

    if (this.charts.profitTrend) {
      this.charts.profitTrend.destroy();
      this.charts.profitTrend = null;
    }

    const brandColor = themeColors.getBrand();
    const incomeColor = themeColors.getIncome();
    const textMutedVal = themeColors.getTextMuted();
    const borderVal = themeColors.getBorder();

    this.charts.profitTrend = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels.length ? labels : ['No Data'],
        datasets: [
          {
            label: 'Net Profit',
            data: profits.length ? profits : [0],
            borderColor: brandColor,
            backgroundColor: brandColor + '14',
            borderWidth: 3,
            fill: true,
            tension: 0.38,
            pointBackgroundColor: brandColor,
            pointRadius: 3,
            pointHoverRadius: 7
          },
          {
            label: 'Total Revenue',
            data: incomes.length ? incomes : [0],
            borderColor: incomeColor,
            borderWidth: 2,
            borderDash: [4, 4],
            fill: false,
            pointRadius: 0,
            tension: 0.38
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600, easing: 'easeOutQuart' },
        plugins: {
          legend: { display: true, position: 'top', labels: { boxWidth: 12, color: textMutedVal, font: { family: "'Plus Jakarta Sans', sans-serif", weight: 700 } } },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.94)',
            titleColor: '#ffffff',
            bodyColor: '#cbd5e1',
            padding: 12,
            cornerRadius: 12,
            borderColor: borderVal + '33',
            borderWidth: 1,
            titleFont: { family: "'Plus Jakarta Sans', sans-serif", weight: 'bold' },
            callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + inr(ctx.parsed.y) }
          }
        },
        scales: {
          y: {
            grid: { color: themeColors.getGridColor() },
            border: { display: false },
            ticks: { color: textMutedVal, font: { family: "'Plus Jakarta Sans', sans-serif" }, callback: value => inrShort(value) }
          },
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { color: textMutedVal, font: { family: "'Plus Jakarta Sans', sans-serif" } }
          }
        }
      }
    });
  },

  buildCategoryShareChart: function(txns) {
    const categoryMap = {};
    txns.forEach(t => {
      if (t.type === 'expense' && t.category) {
        const amt = parseFloat(t.amount) || 0;
        categoryMap[t.category] = (categoryMap[t.category] || 0) + amt;
      }
    });

    const sortedCats = Object.keys(categoryMap).sort((a, b) => categoryMap[b] - categoryMap[a]);
    const labels = sortedCats.map(c => c.replace(/^[^\s]+\s+/, ''));
    const data = sortedCats.map(c => categoryMap[c]);

    const palette = [themeColors.getBrand(), '#10B981', '#F59E0B', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#3B82F6'];

    const ctx = document.getElementById('categoryShareChart');
    if (!ctx) return;

    const legendContainer = document.getElementById('categoryLegend');
    if (legendContainer) {
      legendContainer.innerHTML = '';
      if (!data.length) {
        legendContainer.innerHTML = '<div style="font-size:0.75rem; color:var(--text-muted); text-align:center; grid-column:span 2;">No expenses categorized</div>';
      } else {
        const total = data.reduce((a, b) => a + b, 0);
        sortedCats.slice(0, 6).forEach((cat, idx) => {
          const rawAmt = categoryMap[cat];
          const pct = Math.round((rawAmt / total) * 100);
          const color = palette[idx % palette.length];

          const item = document.createElement('div');
          item.className = 'legend-item';
          item.innerHTML = `
            <div class="legend-color" style="background:${color};"></div>
            <span style="font-weight:700;">${pct}%</span>
            <span style="white-space:nowrap; text-overflow:ellipsis; overflow:hidden; max-width:80px;">${cat}</span>
          `;
          legendContainer.appendChild(item);
        });
      }
    }

    if (!data.length) {
      if (this.charts.categoryShare) {
        this.charts.categoryShare.destroy();
        this.charts.categoryShare = null;
      }
      return;
    }

    const total = data.reduce((a, b) => a + b, 0);
    const datasets = [];
    const ringsCount = Math.min(4, labels.length);
    for (let i = 0; i < ringsCount; i++) {
      datasets.push({
        label: labels[i],
        data: [data[i], total - data[i]],
        backgroundColor: [palette[i % palette.length], 'rgba(15, 23, 42, 0.04)'],
        borderWidth: 2,
        borderColor: '#ffffff',
        hoverBorderColor: '#ffffff',
        borderRadius: 4,
        weight: 0.8
      });
    }

    if (this.charts.categoryShare) {
      this.charts.categoryShare.destroy();
      this.charts.categoryShare = null;
    }

    this.charts.categoryShare = new Chart(ctx, {
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

  buildWeekdayActivityChart: function(txns) {
    const weekdaySums = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    const weekdayCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

    txns.forEach(t => {
      if (t.date) {
        const parts = t.date.split('-');
        if (parts.length === 3) {
          const dObj = new Date(parts[0], parts[1] - 1, parts[2]);
          const day = dObj.getDay();
          weekdayCounts[day]++;
          weekdaySums[day] += parseFloat(t.amount) || 0;
        }
      }
    });

    const order = [1, 2, 3, 4, 5, 6, 0];
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const countsData = order.map(d => weekdayCounts[d]);
    const valuesData = order.map(d => weekdaySums[d]);

    const ctx = document.getElementById('weekdayActivityChart');
    if (!ctx) return;

    if (this.charts.weekdayActivity) {
      this.charts.weekdayActivity.destroy();
      this.charts.weekdayActivity = null;
    }

    const brandColor = themeColors.getBrand();
    const incomeColor = themeColors.getIncome();
    const textMutedVal = themeColors.getTextMuted();
    const borderVal = themeColors.getBorder();

    this.charts.weekdayActivity = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Records Count',
            data: countsData,
            backgroundColor: brandColor,
            borderRadius: { topLeft: 10, topRight: 10 },
            yAxisID: 'y'
          },
          {
            label: 'Transaction Value (₹)',
            data: valuesData,
            backgroundColor: incomeColor,
            borderRadius: { topLeft: 10, topRight: 10 },
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600, easing: 'easeOutQuart' },
        plugins: {
          legend: { display: true, position: 'top', labels: { color: textMutedVal, font: { family: "'Plus Jakarta Sans', sans-serif", weight: 700 } } },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.94)',
            titleColor: '#ffffff',
            bodyColor: '#cbd5e1',
            padding: 12,
            cornerRadius: 12,
            borderColor: borderVal + '33',
            borderWidth: 1
          }
        },
        scales: {
          y: {
            type: 'linear',
            position: 'left',
            grid: { color: themeColors.getGridColor() },
            border: { display: false },
            ticks: { color: textMutedVal, stepSize: 1, font: { family: "'Plus Jakarta Sans', sans-serif" } }
          },
          y1: {
            type: 'linear',
            position: 'right',
            grid: { drawOnChartArea: false },
            border: { display: false },
            ticks: { color: textMutedVal, font: { family: "'Plus Jakarta Sans', sans-serif" }, callback: value => inrShort(value) }
          },
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { color: textMutedVal, font: { family: "'Plus Jakarta Sans', sans-serif" } }
          }
        }
      }
    });
  },

  buildCumulativeBalanceChart: function(txns) {
    const dailyMap = {};
    txns.forEach(t => {
      if (t.date) {
        if (!dailyMap[t.date]) dailyMap[t.date] = 0;
        const amt = parseFloat(t.amount) || 0;
        if (t.type === 'income') dailyMap[t.date] += amt;
        else if (t.type === 'expense') dailyMap[t.date] -= amt;
      }
    });

    const sortedDates = Object.keys(dailyMap).sort();
    let cumulative = 0;
    const balances = [];
    const labels = [];

    sortedDates.forEach(d => {
      cumulative += dailyMap[d];
      balances.push(Math.round(cumulative * 100) / 100);
      labels.push(fmtDate(d));
    });

    const ctx = document.getElementById('cumulativeBalanceChart');
    if (!ctx) return;

    if (this.charts.cumulativeBalance) {
      this.charts.cumulativeBalance.destroy();
      this.charts.cumulativeBalance = null;
    }

    const brandColor = themeColors.getBrand();
    const textMutedVal = themeColors.getTextMuted();
    const borderVal = themeColors.getBorder();

    this.charts.cumulativeBalance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels.length ? labels : ['No Data'],
        datasets: [{
          label: 'Cumulative Capital (₹)',
          data: balances.length ? balances : [0],
          borderColor: brandColor,
          backgroundColor: brandColor + '14',
          borderWidth: 3,
          fill: true,
          tension: 0.25,
          pointRadius: sortedDates.length > 25 ? 0 : 3,
          pointHoverRadius: 7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600, easing: 'easeOutQuart' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.94)',
            titleColor: '#ffffff',
            bodyColor: '#cbd5e1',
            padding: 12,
            cornerRadius: 12,
            borderColor: borderVal + '33',
            borderWidth: 1
          }
        },
        scales: {
          y: {
            grid: { color: themeColors.getGridColor() },
            border: { display: false },
            ticks: { color: textMutedVal, font: { family: "'Plus Jakarta Sans', sans-serif" }, callback: value => inrShort(value) }
          },
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { color: textMutedVal, font: { family: "'Plus Jakarta Sans', sans-serif" }, maxTicksLimit: 8 }
          }
        }
      }
    });
  },

  buildPaymentModeChart: function(txns) {
    const modeVolume = { 'Cash': 0, 'UPI': 0, 'Bank Transfer': 0, 'Card': 0, 'Cheque': 0, 'Online': 0 };
    txns.forEach(t => {
      const mode = t.mode || 'Cash';
      const amt = parseFloat(t.amount) || 0;
      if (modeVolume[mode] !== undefined) {
        modeVolume[mode] += amt;
      }
    });

    const activeModes = Object.keys(modeVolume).filter(m => modeVolume[m] > 0);
    const data = activeModes.map(m => modeVolume[m]);

    const palette = {
      'Cash': '#10b981',
      'Online': themeColors.getBrand(),
      'UPI': '#8b5cf6',
      'Bank Transfer': '#38bdf8',
      'Card': '#ec4899',
      'Cheque': '#f59e0b'
    };

    const colors = activeModes.map(m => palette[m] || '#64748b');

    const ctx = document.getElementById('paymentModeChart');
    if (!ctx) return;

    const legendContainer = document.getElementById('paymentModeLegend');
    if (legendContainer) {
      legendContainer.innerHTML = '';
      if (!data.length) {
        legendContainer.innerHTML = '<div style="font-size:0.75rem; color:var(--text-muted); text-align:center; grid-column:span 2;">No capital channels loaded</div>';
      } else {
        const total = data.reduce((a, b) => a + b, 0);
        activeModes.forEach((mode, idx) => {
          const rawAmt = modeVolume[mode];
          const pct = Math.round((rawAmt / total) * 100);
          const color = colors[idx];

          const item = document.createElement('div');
          item.className = 'legend-item';
          item.innerHTML = `
            <div class="legend-color" style="background:${color};"></div>
            <span style="font-weight:700;">${pct}%</span>
            <span style="white-space:nowrap; text-overflow:ellipsis; overflow:hidden; max-width:80px;">${mode}</span>
          `;
          legendContainer.appendChild(item);
        });
      }
    }

    if (!data.length) {
      if (this.charts.paymentMode) {
        this.charts.paymentMode.destroy();
        this.charts.paymentMode = null;
      }
      return;
    }

    const total = data.reduce((a, b) => a + b, 0);
    const datasets = [];
    const ringsCount = Math.min(4, activeModes.length);
    for (let i = 0; i < ringsCount; i++) {
      datasets.push({
        label: activeModes[i],
        data: [data[i], total - data[i]],
        backgroundColor: [colors[i], 'rgba(15, 23, 42, 0.04)'],
        borderWidth: 2,
        borderColor: '#ffffff',
        hoverBorderColor: '#ffffff',
        borderRadius: 4,
        weight: 0.8
      });
    }

    if (this.charts.paymentMode) {
      this.charts.paymentMode.destroy();
      this.charts.paymentMode = null;
    }

    this.charts.paymentMode = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: activeModes.slice(0, ringsCount),
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

  /* ==========================================================================
     11. PLATFORM CHANNELS & AGGREGATOR COMMISSION
     ========================================================================== */
  loadPlatformAnalysis: function(txns) {
    const platforms = {
      swiggy: { name: 'Swiggy', revenue: 0, count: 0, color: '#fc8019' },
      zomato: { name: 'Zomato', revenue: 0, count: 0, color: '#e23744' },
      counter: { name: 'Counter & Cash', revenue: 0, count: 0, color: '#10b981' },
      online: { name: 'Direct Online / UPI', revenue: 0, count: 0, color: '#6366f1' }
    };

    let totalPlatformRevenue = 0;

    txns.forEach(t => {
      if (t.type !== 'income') return;
      const amt = parseFloat(t.amount) || 0;
      const cat = (t.category || '').toLowerCase();
      const note = (t.notes || '').toLowerCase();
      const from = (t.from || '').toLowerCase();
      const mode = (t.mode || '').toLowerCase();
      const text = `${cat} ${note} ${from}`;

      let key = 'counter';
      if (text.includes('swiggy')) key = 'swiggy';
      else if (text.includes('zomato')) key = 'zomato';
      else if (mode === 'cash' || cat.includes('cash') || cat.includes('sales') || text.includes('counter') || text.includes('dine')) key = 'counter';
      else if (mode === 'upi' || mode === 'online' || mode === 'card' || mode === 'bank transfer' || cat.includes('online')) key = 'online';

      platforms[key].revenue += amt;
      platforms[key].count++;
      totalPlatformRevenue += amt;
    });

    const badgeEl = document.getElementById('platformPeriodBadge');
    if (badgeEl) {
      badgeEl.textContent = this.period.toUpperCase();
    }

    // Update each platform card
    Object.keys(platforms).forEach(k => {
      const p = platforms[k];
      const share = totalPlatformRevenue > 0 ? Math.round((p.revenue / totalPlatformRevenue) * 100) : 0;
      const avg = p.count > 0 ? Math.round(p.revenue / p.count) : 0;

      const revEl = document.getElementById(`${k}Revenue`);
      if (revEl) revEl.textContent = inr(p.revenue);

      const shareEl = document.getElementById(`${k}Share`);
      if (shareEl) shareEl.textContent = `${share}%`;

      const ordEl = document.getElementById(`${k}Orders`);
      if (ordEl) ordEl.textContent = `${p.count} orders · Avg ${inr(avg)}`;

      const barEl = document.getElementById(`${k}Bar`);
      if (barEl) barEl.style.width = `${share}%`;
    });

    // Smart Insights
    let topKey = 'counter';
    let maxRev = -1;
    let highestAovKey = 'counter';
    let maxAov = -1;

    Object.keys(platforms).forEach(k => {
      const p = platforms[k];
      if (p.revenue > maxRev) {
        maxRev = p.revenue;
        topKey = k;
      }
      const aov = p.count > 0 ? p.revenue / p.count : 0;
      if (aov > maxAov) {
        maxAov = aov;
        highestAovKey = k;
      }
    });

    const topNameEl = document.getElementById('topChannelName');
    if (topNameEl) {
      if (maxRev > 0) {
        const share = totalPlatformRevenue > 0 ? Math.round((maxRev / totalPlatformRevenue) * 100) : 0;
        topNameEl.textContent = `${platforms[topKey].name} (${inr(maxRev)} · ${share}%)`;
      } else {
        topNameEl.textContent = 'No income recorded yet';
      }
    }

    const aovEl = document.getElementById('highestAovChannel');
    if (aovEl) {
      if (maxAov > 0) {
        aovEl.textContent = `${platforms[highestAovKey].name} (${inr(maxAov)} / order)`;
      } else {
        aovEl.textContent = 'Awaiting transactions';
      }
    }

    const aggComm = Math.round((platforms.swiggy.revenue + platforms.zomato.revenue) * 0.22);
    const marginNoteEl = document.getElementById('marginInsightNote');
    if (marginNoteEl) {
      if (aggComm > 0) {
        marginNoteEl.textContent = `Direct Counter & Dine-in saves ~ ${inr(aggComm)} vs aggregator fees.`;
      } else {
        marginNoteEl.textContent = 'Direct Counter & Dine-in sales have 0% aggregator commission.';
      }
    }

    this.buildPlatformChart(platforms);
  },

  buildPlatformChart: function(platforms) {
    const canvas = document.getElementById('platformChannelChart');
    if (!canvas || typeof Chart === 'undefined') return;

    if (this.charts.platformChannel) {
      this.charts.platformChannel.destroy();
      this.charts.platformChannel = null;
    }

    const labels = [platforms.swiggy.name, platforms.zomato.name, platforms.counter.name, platforms.online.name];
    const data = [platforms.swiggy.revenue, platforms.zomato.revenue, platforms.counter.revenue, platforms.online.revenue];
    const colors = [platforms.swiggy.color, platforms.zomato.color, platforms.counter.color, platforms.online.color];

    this.charts.platformChannel = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors,
          borderRadius: 6,
          borderSkipped: false,
          barThickness: 22
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${inr(ctx.raw)}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(15, 23, 42, 0.06)' },
            ticks: {
              callback: v => inrShort(v),
              font: { size: 10, family: "'Plus Jakarta Sans', sans-serif" }
            }
          },
          y: {
            grid: { display: false },
            ticks: {
              font: { size: 11, weight: '700', family: "'Plus Jakarta Sans', sans-serif" }
            }
          }
        }
      }
    });
  },

  /* ==========================================================================
     12. CAPITAL CHANNELS & FINANCIAL RATIOS REPORT
     ========================================================================== */
  loadCapitalChannelsReport: function(filtered, all) {
    const tbody = document.getElementById('capitalChannelsBody');
    if (!tbody) return;

    const modes = ['Cash', 'UPI', 'Bank Transfer', 'Card', 'Cheque', 'Online'];
    const summary = {};
    modes.forEach(m => {
      summary[m] = { inward: 0, outward: 0, count: 0 };
    });

    let totalFilteredCount = filtered.length;
    filtered.forEach(t => {
      const m = t.mode || 'Cash';
      const amt = parseFloat(t.amount) || 0;
      if (summary[m]) {
        summary[m].count++;
        if (t.type === 'income') summary[m].inward += amt;
        else if (t.type === 'expense') summary[m].outward += amt;
      }
    });

    tbody.innerHTML = '';

    let anyData = false;
    modes.forEach(mode => {
      const s = summary[mode];
      if (s.count > 0) {
        anyData = true;
        const net = s.inward - s.outward;
        const share = totalFilteredCount > 0 ? Math.round((s.count / totalFilteredCount) * 100) : 0;
        
        let badgeClass = 'online';
        if (mode === 'Cash') badgeClass = 'cash';
        else if (mode === 'UPI') badgeClass = 'upi';
        else if (mode === 'Bank Transfer') badgeClass = 'bank';
        else if (mode === 'Card') badgeClass = 'card';
        else if (mode === 'Cheque') badgeClass = 'cheque';

        const row = document.createElement('tr');
        row.innerHTML = `
          <td><span class="capital-badge ${badgeClass}">${mode.toUpperCase()}</span></td>
          <td style="font-weight:700; color:var(--income);">${inr(s.inward)}</td>
          <td style="font-weight:700; color:var(--expense);">${inr(s.outward)}</td>
          <td style="font-weight:800; color:${net >= 0 ? 'var(--income)' : 'var(--expense)'};">${inr(net)}</td>
          <td>${s.count} transactions</td>
          <td style="font-weight:700; color:var(--brand);">${share}%</td>
        `;
        tbody.appendChild(row);
      }
    });

    if (!anyData) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-light); padding: 30px;">
            💼 No capital transaction details logged in this period.
          </td>
        </tr>
      `;
    }

    // Calculations in Performance stats grid
    const totals = calcTotals(filtered);
    
    // Operating Expense Ratio
    const expRatioEl = document.getElementById('detExpenseRatio');
    if (expRatioEl) {
      const expRatio = totals.income > 0 ? Math.round((totals.expense / totals.income) * 100) : 0;
      expRatioEl.textContent = expRatio + '%';
    }

    // Profitability Status
    const profitStatusEl = document.getElementById('detProfitStatus');
    if (profitStatusEl) {
      const margin = totals.income > 0 ? (totals.profit / totals.income) * 100 : 0;
      if (margin >= 30) profitStatusEl.textContent = 'High Profit Margin 📈';
      else if (margin >= 10) profitStatusEl.textContent = 'Moderate Margin 👍';
      else if (margin > 0) profitStatusEl.textContent = 'Low Margin ⚠️';
      else if (totals.income === 0 && totals.expense === 0) profitStatusEl.textContent = 'No Operations 💤';
      else profitStatusEl.textContent = 'Operating Deficit 🚨';
    }

    // Peak Revenue Month
    const peakMonthEl = document.getElementById('detPeakMonth');
    if (peakMonthEl) {
      const monthlyIncome = {};
      all.forEach(t => {
        if (t.type === 'income' && t.date) {
          const mKey = t.date.substring(0, 7);
          const amt = parseFloat(t.amount) || 0;
          monthlyIncome[mKey] = (monthlyIncome[mKey] || 0) + amt;
        }
      });
      let peakM = 'None';
      let peakVal = 0;
      for (const m in monthlyIncome) {
        if (monthlyIncome[m] > peakVal) {
          peakVal = monthlyIncome[m];
          peakM = m;
        }
      }
      if (peakVal > 0) {
        const dObj = new Date(peakM + '-02');
        const formattedMonth = dObj.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
        peakMonthEl.textContent = `${formattedMonth} (${inrShort(peakVal)})`;
      } else {
        peakMonthEl.textContent = 'No Data Yet';
      }
    }

    // Operating Consistency (Unique active days)
    const consistencyEl = document.getElementById('detConsistency');
    if (consistencyEl) {
      const activeDays = new Set();
      filtered.forEach(t => { if (t.date) activeDays.add(t.date); });
      const dayLabel = activeDays.size === 1 ? 'day' : 'days';
      consistencyEl.textContent = `${activeDays.size} active ${dayLabel}`;
    }
  },

  animateMetrics: function() {
    setTimeout(() => {
      const targetIds = [
        'scTotalRevenue', 'scTotalExpense', 'scNetProfit', 'scDailyRunRate',
        'avgTxVal', 'burnRateVal', 'healthScoreVal', 
        'projRevenue', 'projExpenses', 'projProfit', 
        'detExpenseRatio',
        'beDailyTarget', 'beTodayRevenue', 'beTodaySurplus', 'beMonthlyOverhead',
        'swiggyRevenue', 'zomatoRevenue', 'counterRevenue', 'onlineRevenue'
      ];
      targetIds.forEach(id => {
        const el = document.getElementById(id);
        if (el && el.textContent) {
          const val = el.textContent;
          if (val !== '₹ 0.00' && val !== '0%' && val !== '--%' && val !== '₹ 0' && val !== '--' && typeof animateNumber === 'function') {
            animateNumber(el, val);
          }
        }
      });
    }, 200);
  }
};

// ============================================
// BREAK-EVEN CONFIGURATION MODAL HANDLERS
// ============================================

function openBreakEvenModal() {
  const rent = localStorage.getItem('bd_be_rent') || '20000';
  const staff = localStorage.getItem('bd_be_staff') || '15000';
  const util = localStorage.getItem('bd_be_utilities') || '5000';
  const other = localStorage.getItem('bd_be_other') || '2000';

  const rEl = document.getElementById('beInputRent');
  const sEl = document.getElementById('beInputStaff');
  const uEl = document.getElementById('beInputUtilities');
  const oEl = document.getElementById('beInputOther');

  if (rEl) rEl.value = rent;
  if (sEl) sEl.value = staff;
  if (uEl) uEl.value = util;
  if (oEl) oEl.value = other;

  updateBreakEvenPreview();

  if (typeof openModal === 'function') {
    openModal('breakEvenModal');
  } else {
    const modal = document.getElementById('breakEvenModal');
    if (modal) modal.classList.add('open');
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function updateBreakEvenPreview() {
  const r = parseFloat(document.getElementById('beInputRent')?.value || 0);
  const s = parseFloat(document.getElementById('beInputStaff')?.value || 0);
  const u = parseFloat(document.getElementById('beInputUtilities')?.value || 0);
  const o = parseFloat(document.getElementById('beInputOther')?.value || 0);
  const tot = r + s + u + o;
  const now = new Date();
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daily = Math.round(tot / days);
  const prev = document.getElementById('bePreviewDaily');
  if (prev) prev.textContent = `${inr(daily)} / day (Total: ${inr(tot)}/mo)`;
}

function saveBreakEvenConfig() {
  const r = document.getElementById('beInputRent')?.value || '20000';
  const s = document.getElementById('beInputStaff')?.value || '15000';
  const u = document.getElementById('beInputUtilities')?.value || '5000';
  const o = document.getElementById('beInputOther')?.value || '2000';

  localStorage.setItem('bd_be_rent', r);
  localStorage.setItem('bd_be_staff', s);
  localStorage.setItem('bd_be_utilities', u);
  localStorage.setItem('bd_be_other', o);

  closeModal('breakEvenModal');
  if (typeof toast === 'function') toast('Fixed overhead updated successfully!', 'success');
  if (typeof AnalyticsPage !== 'undefined') AnalyticsPage.loadAll();
}

document.addEventListener('DOMContentLoaded', () => {
  ['beInputRent', 'beInputStaff', 'beInputUtilities', 'beInputOther'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateBreakEvenPreview);
  });
});

// ============================================
// QUICK ADD FORM & ACTION LOGIC (REUSED FROM DASHBOARD.JS)
// ============================================

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
  document.addEventListener('DOMContentLoaded', () => AnalyticsPage.init());
} else {
  AnalyticsPage.init();
}
