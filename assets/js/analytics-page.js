/* ============================================
   ANALYTICS-PAGE.JS v2.0 (Expanded)
   Crust & Chilly Business Dashboard
   Real-time Synced Analytics, Five Interactive Charts & Detailed Capital Channel reports
   ============================================ */

'use strict';

const AnalyticsPage = {
  charts: { 
    profitTrend: null, 
    categoryShare: null, 
    weekdayActivity: null,
    cumulativeBalance: null,
    paymentMode: null 
  },
  period: 'month', // Default period selection

  init: function() {
    try {
      if (typeof Chart !== 'undefined') {
        Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";
      }
      this.setupWelcomeDate();
      this.loadAll();
      this.setupModalDates();
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

  setupModalDates: function() {
    const iDate = document.getElementById('iDate');
    const eDate = document.getElementById('eDate');
    if (iDate) iDate.value = today();
    if (eDate) eDate.value = today();
  },

  onPeriodChange: function() {
    const select = document.getElementById('analyticsPeriod');
    if (select) {
      this.period = select.value;
      this.loadAll();
    }
  },

  loadAll: function() {
    const allTxns = getTxns();
    
    // 1. Filter by selected period (month, year, all)
    const filteredTxns = this.filterTxns(allTxns, this.period);

    // 2. Load KPIs
    this.loadKPIs(filteredTxns, allTxns);

    // 3. Load Forecast/Projections
    this.loadProjections(allTxns);

    // 4. Build five Charts
    this.buildCharts(filteredTxns);

    // 5. Load Detailed Capital Report & Ratios
    this.loadCapitalChannelsReport(filteredTxns, allTxns);

    // 6. Animate Numbers
    this.animateMetrics();
  },

  filterTxns: function(txns, period) {
    if (!Array.isArray(txns)) return [];
    if (period === 'all') return txns;
    return txns.filter(t => {
      if (!t.date) return false;
      if (period === 'week') return isThisWeek(t.date);
      if (period === 'month') return isThisMonth(t.date);
      if (period === 'year') return isThisYear(t.date);
      return true;
    });
  },

  loadKPIs: function(filtered, all) {
    // 1. Health Score Calculator
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
          const day = dateObj.getDay();
          weekdayCounts[day]++;
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

    // Components of score:
    // 1. Savings rate (up to 30 pts)
    let savingScore = 0;
    if (savingRate > 0) {
      savingScore = Math.min(30, Math.round(savingRate * 0.75));
    }

    // 2. Profit margin (up to 40 pts)
    let marginScore = 0;
    if (profitMargin > 0) {
      marginScore = Math.min(40, Math.round(profitMargin * 0.8));
    }

    // 3. Expense control (up to 20 pts)
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

    // 4. Activity consistency (up to 10 pts)
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
        scoreStatus.style.color = '#f59e0b';
      } else {
        scoreStatus.textContent = '🚨 Critical';
        scoreStatus.style.color = 'var(--expense)';
      }
    }
  },

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
        if (t.type === 'income') {
          monthlyData[monthKey].income += amt;
        } else if (t.type === 'expense') {
          monthlyData[monthKey].expense += amt;
        }
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

  buildCharts: function(txns) {
    if (typeof Chart === 'undefined') return;

    this.buildProfitTrendChart(txns);
    this.buildCategoryShareChart(txns);
    this.buildWeekdayActivityChart(txns);
    this.buildCumulativeBalanceChart(txns);
    this.buildPaymentModeChart(txns);
  },

  buildProfitTrendChart: function(txns) {
    if (this.charts.profitTrend) this.charts.profitTrend.destroy();

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
    const expenses = months.map(m => monthlyMap[m].expense);

    const ctx = document.getElementById('profitTrendChart');
    if (!ctx) return;

    this.charts.profitTrend = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels.length ? labels : ['No Data'],
        datasets: [
          {
            label: 'Net Profit',
            data: profits.length ? profits : [0],
            borderColor: '#115e59',
            backgroundColor: 'rgba(17, 94, 89, 0.05)',
            borderWidth: 3,
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#14b8a6',
            pointRadius: 3
          },
          {
            label: 'Total Revenue',
            data: incomes.length ? incomes : [0],
            borderColor: '#10b981',
            borderWidth: 1.5,
            borderDash: [4, 4],
            fill: false,
            pointRadius: 0,
            tension: 0.35
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'top', labels: { boxWidth: 12, font: { family: 'Plus Jakarta Sans', weight: 600 } } }
        },
        scales: {
          y: {
            grid: { color: 'rgba(99, 102, 241, 0.05)' },
            ticks: { font: { family: 'Plus Jakarta Sans' }, callback: value => inrShort(value) }
          },
          x: {
            grid: { display: false },
            ticks: { font: { family: 'Plus Jakarta Sans' } }
          }
        }
      }
    });
  },

  buildCategoryShareChart: function(txns) {
    if (this.charts.categoryShare) this.charts.categoryShare.destroy();

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

    const palette = ['#115e59', '#14b8a6', '#10b981', '#f59e0b', '#ef4444', '#0f766e', '#0ea5e9', '#0d9488', '#f43f5e', '#a855f7'];

    const ctx = document.getElementById('categoryShareChart');
    if (!ctx) return;

    this.charts.categoryShare = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels.length ? labels : ['No Expenses'],
        datasets: [{
          data: data.length ? data : [1],
          backgroundColor: data.length ? palette.slice(0, data.length) : ['#e2e8f0'],
          borderWidth: 2,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        cutout: '65%'
      }
    });

    const legendContainer = document.getElementById('categoryLegend');
    if (legendContainer) {
      legendContainer.innerHTML = '';
      if (!data.length) {
        legendContainer.innerHTML = '<div style="font-size:0.75rem; color:var(--text-light); text-align:center; grid-column:span 2;">No expenses categorized</div>';
        return;
      }
      const total = data.reduce((a, b) => a + b, 0);
      sortedCats.forEach((cat, idx) => {
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
  },

  buildWeekdayActivityChart: function(txns) {
    if (this.charts.weekdayActivity) this.charts.weekdayActivity.destroy();

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
    const labels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const countsData = order.map(d => weekdayCounts[d]);
    const valuesData = order.map(d => weekdaySums[d]);

    const ctx = document.getElementById('weekdayActivityChart');
    if (!ctx) return;

    this.charts.weekdayActivity = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Transactions Count',
            data: countsData,
            backgroundColor: 'rgba(99, 102, 241, 0.85)',
            hoverBackgroundColor: 'var(--brand)',
            borderRadius: 6,
            yAxisID: 'y'
          },
          {
            label: 'Transaction Value (₹)',
            data: valuesData,
            backgroundColor: 'rgba(16, 185, 129, 0.45)',
            hoverBackgroundColor: 'var(--income)',
            borderRadius: 6,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'top', labels: { font: { family: 'Plus Jakarta Sans', weight: 600 } } }
        },
        scales: {
          y: {
            type: 'linear',
            position: 'left',
            grid: { color: 'rgba(99, 102, 241, 0.05)' },
            ticks: { stepSize: 1, font: { family: 'Plus Jakarta Sans' } },
            title: { display: true, text: 'Records Count', font: { family: 'Plus Jakarta Sans', weight: 600 } }
          },
          y1: {
            type: 'linear',
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: { font: { family: 'Plus Jakarta Sans' }, callback: value => inrShort(value) },
            title: { display: true, text: 'Total Value (₹)', font: { family: 'Plus Jakarta Sans', weight: 600 } }
          },
          x: {
            grid: { display: false },
            ticks: { font: { family: 'Plus Jakarta Sans' } }
          }
        }
      }
    });
  },

  buildCumulativeBalanceChart: function(txns) {
    if (this.charts.cumulativeBalance) this.charts.cumulativeBalance.destroy();

    // Group ledger values by date ascending
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

    this.charts.cumulativeBalance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels.length ? labels : ['No Data'],
        datasets: [{
          label: 'Cumulative Capital (₹)',
          data: balances.length ? balances : [0],
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
          borderWidth: 3,
          fill: true,
          tension: 0.2,
          pointRadius: sortedDates.length > 25 ? 0 : 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            grid: { color: 'rgba(99, 102, 241, 0.05)' },
            ticks: { font: { family: 'Plus Jakarta Sans' }, callback: value => inrShort(value) }
          },
          x: {
            grid: { display: false },
            ticks: { font: { family: 'Plus Jakarta Sans' }, maxTicksLimit: 8 }
          }
        }
      }
    });
  },

  buildPaymentModeChart: function(txns) {
    if (this.charts.paymentMode) this.charts.paymentMode.destroy();

    const modeVolume = { 'Cash': 0, 'UPI': 0, 'Bank Transfer': 0, 'Card': 0, 'Cheque': 0, 'Online': 0 };
    txns.forEach(t => {
      const mode = t.mode || 'Cash';
      const amt = parseFloat(t.amount) || 0;
      if (modeVolume[mode] !== undefined) {
        modeVolume[mode] += amt;
      }
    });

    // filter only modes that have transactions
    const activeModes = Object.keys(modeVolume).filter(m => modeVolume[m] > 0);
    const data = activeModes.map(m => modeVolume[m]);

    const palette = {
      'Cash': '#10b981',
      'Online': '#115e59',
      'UPI': '#14b8a6',
      'Bank Transfer': '#0ea5e9',
      'Card': '#0f766e',
      'Cheque': '#f59e0b'
    };

    const colors = activeModes.map(m => palette[m] || '#64748b');

    const ctx = document.getElementById('paymentModeChart');
    if (!ctx) return;

    this.charts.paymentMode = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: activeModes.length ? activeModes : ['No capital flows'],
        datasets: [{
          data: data.length ? data : [1],
          backgroundColor: data.length ? colors : ['#e2e8f0'],
          borderWidth: 2,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        cutout: '65%'
      }
    });

    const legendContainer = document.getElementById('paymentModeLegend');
    if (legendContainer) {
      legendContainer.innerHTML = '';
      if (!data.length) {
        legendContainer.innerHTML = '<div style="font-size:0.75rem; color:var(--text-light); text-align:center; grid-column:span 2;">No capital channels loaded</div>';
        return;
      }
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
          <span style="white-space:nowrap; text-overflow:ellipsis; overflow:hidden; max-width:85px;">${mode}</span>
        `;
        legendContainer.appendChild(item);
      });
    }
  },

  loadCapitalChannelsReport: function(filtered, all) {
    const tbody = document.getElementById('capitalChannelsBody');
    if (!tbody) return;

    // Define core modes to build detailed breakdown
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

    // 2. Load detailed calculations in Performance stats grid
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
          const mKey = t.date.substring(0, 7); // YYYY-MM
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
        'avgTxVal', 'burnRateVal', 'healthScoreVal', 
        'projRevenue', 'projExpenses', 'projProfit', 
        'detExpenseRatio'
      ];
      targetIds.forEach(id => {
        const el = document.getElementById(id);
        if (el && el.textContent) {
          const val = el.textContent;
          if (val !== '₹ 0.00' && val !== '0%' && val !== '--%' && val !== '₹ 0' && val !== '--') {
            animateNumber(el, val);
          }
        }
      });
    }, 200);
  }
};

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
