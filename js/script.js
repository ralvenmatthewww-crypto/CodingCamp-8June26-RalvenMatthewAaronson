/**
 * main.js
 * Expense & Budget Visualizer — all JavaScript combined.
 *
 * Sections:
 *   1. DB      — localStorage CRUD & aggregation helpers
 *   2. Charts  — vanilla Canvas pie/donut & bar chart renderers
 *   3. UI      — DOM rendering helpers (cards, lists, toasts)
 *   4. App     — main controller (navigation, events, page logic)
 */

/* ================================================================
   1. DB — Data layer (localStorage)
   ================================================================ */
const DB = {
  KEYS: {
    TRANSACTIONS: 'bv_transactions',
    BUDGETS:      'bv_budgets',
    CATEGORIES:   'bv_categories',
  },

  // ---------- Categories ----------
  defaultCategories: [
    { id: 'food',          label: 'Food & Dining',  icon: '🍔' },
    { id: 'transport',     label: 'Transport',       icon: '🚗' },
    { id: 'housing',       label: 'Housing',         icon: '🏠' },
    { id: 'utilities',     label: 'Utilities',       icon: '💡' },
    { id: 'health',        label: 'Health',          icon: '🏥' },
    { id: 'entertainment', label: 'Entertainment',   icon: '🎬' },
    { id: 'shopping',      label: 'Shopping',        icon: '🛍️' },
    { id: 'education',     label: 'Education',       icon: '📚' },
    { id: 'savings',       label: 'Savings',         icon: '🐖' },
    { id: 'income',        label: 'Income',          icon: '💵' },
    { id: 'other',         label: 'Other',           icon: '📦' },
  ],

  getCategories() {
    const stored = localStorage.getItem(this.KEYS.CATEGORIES);
    return stored ? JSON.parse(stored) : [...this.defaultCategories];
  },

  saveCategories(categories) {
    localStorage.setItem(this.KEYS.CATEGORIES, JSON.stringify(categories));
  },

  getCategoryById(id) {
    return this.getCategories().find(c => c.id === id) || { id, label: id, icon: '📦' };
  },

  // ---------- Transactions ----------
  getTransactions() {
    const stored = localStorage.getItem(this.KEYS.TRANSACTIONS);
    return stored ? JSON.parse(stored) : [];
  },

  saveTransactions(transactions) {
    localStorage.setItem(this.KEYS.TRANSACTIONS, JSON.stringify(transactions));
  },

  addTransaction(data) {
    const transactions = this.getTransactions();
    const newTxn = {
      id:          'txn_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      type:        data.type,
      description: data.description.trim(),
      amount:      parseFloat(data.amount),
      category:    data.category,
      date:        data.date,
      notes:       data.notes || '',
      createdAt:   new Date().toISOString(),
    };
    transactions.unshift(newTxn);
    this.saveTransactions(transactions);
    return newTxn;
  },

  updateTransaction(id, data) {
    const transactions = this.getTransactions();
    const idx = transactions.findIndex(t => t.id === id);
    if (idx === -1) return null;
    transactions[idx] = {
      ...transactions[idx],
      type:        data.type,
      description: data.description.trim(),
      amount:      parseFloat(data.amount),
      category:    data.category,
      date:        data.date,
      notes:       data.notes || '',
      updatedAt:   new Date().toISOString(),
    };
    this.saveTransactions(transactions);
    return transactions[idx];
  },

  deleteTransaction(id) {
    this.saveTransactions(this.getTransactions().filter(t => t.id !== id));
  },

  // ---------- Budgets ----------
  getBudgets() {
    const stored = localStorage.getItem(this.KEYS.BUDGETS);
    return stored ? JSON.parse(stored) : [];
  },

  saveBudgets(budgets) {
    localStorage.setItem(this.KEYS.BUDGETS, JSON.stringify(budgets));
  },

  addBudget(data) {
    const budgets = this.getBudgets();
    const exists  = budgets.find(b => b.category === data.category && b.month === data.month);
    if (exists) return { error: 'A budget for this category and month already exists.' };

    const budget = {
      id:        'bgt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      category:  data.category,
      limit:     parseFloat(data.limit),
      month:     data.month,
      createdAt: new Date().toISOString(),
    };
    budgets.push(budget);
    this.saveBudgets(budgets);
    return budget;
  },

  updateBudget(id, data) {
    const budgets = this.getBudgets();
    const idx = budgets.findIndex(b => b.id === id);
    if (idx === -1) return null;
    budgets[idx] = { ...budgets[idx], category: data.category, limit: parseFloat(data.limit), month: data.month };
    this.saveBudgets(budgets);
    return budgets[idx];
  },

  deleteBudget(id) {
    this.saveBudgets(this.getBudgets().filter(b => b.id !== id));
  },

  // ---------- Aggregation Helpers ----------

  /** Transactions filtered by a YYYY-MM date range */
  getTransactionsByRange(from, to) {
    return this.getTransactions().filter(t => {
      const month = t.date.slice(0, 7);
      return (!from || month >= from) && (!to || month <= to);
    });
  },

  /** Sum income and expenses for an array of transactions */
  getTotals(transactions) {
    return transactions.reduce(
      (acc, t) => {
        if (t.type === 'income')  acc.income  += t.amount;
        if (t.type === 'expense') acc.expense += t.amount;
        return acc;
      },
      { income: 0, expense: 0 }
    );
  },

  /** Expense totals grouped by category id */
  getExpensesByCategory(transactions) {
    const map = {};
    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => { map[t.category] = (map[t.category] || 0) + t.amount; });
    return map;
  },

  /** Income & expense totals grouped by month (YYYY-MM), sorted ascending */
  getMonthlyTotals(transactions) {
    const map = {};
    transactions.forEach(t => {
      const month = t.date.slice(0, 7);
      if (!map[month]) map[month] = { income: 0, expense: 0 };
      map[month][t.type] += t.amount;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {});
  },

  /** Total spent for a specific budget (category + month) */
  getBudgetSpent(category, month) {
    return this.getTransactions()
      .filter(t => t.type === 'expense' && t.category === category && t.date.slice(0, 7) === month)
      .reduce((sum, t) => sum + t.amount, 0);
  },

  /** Current month as 'YYYY-MM' */
  currentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  },
};


/* ================================================================
   2. Charts — vanilla Canvas renderers
   ================================================================ */
const Charts = (() => {
  const PALETTE = [
    '#6c63ff', '#22c55e', '#ef4444', '#f59e0b', '#3b82f6',
    '#ec4899', '#14b8a6', '#a855f7', '#f97316', '#06b6d4',
    '#84cc16', '#e11d48',
  ];

  function getColor(index) {
    return PALETTE[index % PALETTE.length];
  }

  /**
   * Draws a donut chart.
   * @param {string} canvasId
   * @param {Array<{label:string, value:number}>} data
   * @param {string} legendId
   */
  function drawPie(canvasId, data, legendId) {
    const canvas = document.getElementById(canvasId);
    const legend = document.getElementById(legendId);
    if (!canvas) return;

    const ctx  = canvas.getContext('2d');
    const size = 180;
    canvas.width = canvas.height = size;
    ctx.clearRect(0, 0, size, size);

    const total = data.reduce((s, d) => s + d.value, 0);

    if (!total || data.length === 0) {
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, 70, 0, Math.PI * 2);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth   = 24;
      ctx.stroke();
      if (legend) legend.innerHTML = '<span style="color:#94a3b8;font-size:13px">No data yet</span>';
      return;
    }

    let startAngle = -Math.PI / 2;
    const cx = size / 2, cy = size / 2;
    const outerR = 80, innerR = 52;

    data.forEach((slice, i) => {
      const angle = (slice.value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, outerR, startAngle, startAngle + angle);
      ctx.closePath();
      ctx.fillStyle = getColor(i);
      ctx.fill();
      startAngle += angle;
    });

    // Donut hole
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    // Centre total label
    ctx.fillStyle    = '#1e293b';
    ctx.font         = 'bold 13px Segoe UI, sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(_fmtCurrency(total), cx, cy);

    // Legend
    if (legend) {
      legend.innerHTML = data.map((slice, i) => `
        <div class="legend-item">
          <span class="legend-dot" style="background:${getColor(i)}"></span>
          <span class="legend-label">${slice.label}</span>
          <span class="legend-value">${_fmtCurrency(slice.value)}</span>
        </div>
      `).join('');
    }
  }

  /**
   * Draws a grouped bar chart.
   * @param {string}   canvasId
   * @param {string[]} labels
   * @param {{income:number[], expense:number[]}} datasets
   */
  function drawBar(canvasId, labels, datasets) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const parent = canvas.parentElement;
    const W = parent ? Math.max(parent.offsetWidth - 4, 280) : 400;
    const H = 220;
    canvas.width  = W;
    canvas.height = H;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    if (!labels || labels.length === 0) {
      ctx.fillStyle  = '#94a3b8';
      ctx.font       = '13px Segoe UI, sans-serif';
      ctx.textAlign  = 'center';
      ctx.fillText('No data yet', W / 2, H / 2);
      return;
    }

    const padLeft = 52, padRight = 16, padTop = 16, padBottom = 40;
    const chartW  = W - padLeft - padRight;
    const chartH  = H - padTop  - padBottom;

    const allValues = [...(datasets.income || []), ...(datasets.expense || [])];
    const maxVal    = Math.max(...allValues, 1);

    // Grid lines + y-axis labels
    const gridLines = 4;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth   = 1;
    for (let i = 0; i <= gridLines; i++) {
      const y = padTop + chartH - (i / gridLines) * chartH;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + chartW, y);
      ctx.stroke();
      ctx.fillStyle  = '#94a3b8';
      ctx.font       = '10px Segoe UI, sans-serif';
      ctx.textAlign  = 'right';
      ctx.fillText(_fmtShort((maxVal / gridLines) * i), padLeft - 4, y + 4);
    }

    const groupWidth = chartW / labels.length;
    const barGap     = 4;
    const barWidth   = Math.max((groupWidth - barGap * 3) / 2, 6);

    labels.forEach((label, i) => {
      const groupX  = padLeft + i * groupWidth;
      const income  = (datasets.income  && datasets.income[i])  || 0;
      const expense = (datasets.expense && datasets.expense[i]) || 0;

      // Income bar
      const incH = (income / maxVal) * chartH;
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.roundRect(groupX + barGap, padTop + chartH - incH, barWidth, incH, [4, 4, 0, 0]);
      ctx.fill();

      // Expense bar
      const expH = (expense / maxVal) * chartH;
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.roundRect(groupX + barGap * 2 + barWidth, padTop + chartH - expH, barWidth, expH, [4, 4, 0, 0]);
      ctx.fill();

      // x-axis label
      ctx.fillStyle = '#64748b';
      ctx.font      = '10px Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, groupX + groupWidth / 2, H - padBottom + 14);
    });

    // Chart legend
    const legendY = H - 8;
    ctx.font      = '11px Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#22c55e';  ctx.fillRect(padLeft,      legendY - 8, 10, 10);
    ctx.fillStyle = '#475569';  ctx.fillText('Income',  padLeft + 14,  legendY);
    ctx.fillStyle = '#ef4444';  ctx.fillRect(padLeft + 70, legendY - 8, 10, 10);
    ctx.fillStyle = '#475569';  ctx.fillText('Expense', padLeft + 84,  legendY);
  }

  // Private formatting helpers (only used inside Charts)
  function _fmtCurrency(amount) {
    return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function _fmtShort(val) {
    return val >= 1000 ? '$' + (val / 1000).toFixed(1) + 'k' : '$' + Math.round(val);
  }

  return { drawPie, drawBar, getColor };
})();


/* ================================================================
   3. UI — DOM rendering helpers
   ================================================================ */
const UI = (() => {
  // ---- Formatters ----
  function formatMoney(amount) {
    return '$' + Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatDate(dateStr) {
    const [y, m, d] = dateStr.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
  }

  function formatMonth(monthStr) {
    const [y, m] = monthStr.split('-');
    const months = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
    return `${months[parseInt(m, 10) - 1]} ${y}`;
  }

  // ---- Transaction Item ----
  function renderTransactionItem(txn) {
    const cat         = DB.getCategoryById(txn.category);
    const sign        = txn.type === 'income' ? '+' : '-';
    const amountClass = txn.type === 'income' ? 'income' : 'expense';
    return `
      <div class="transaction-item" data-id="${txn.id}">
        <div class="txn-icon">${cat.icon}</div>
        <div class="txn-info">
          <div class="txn-desc">${escapeHtml(txn.description)}</div>
          <div class="txn-meta">${cat.label} &bull; ${formatDate(txn.date)}${txn.notes ? ' &bull; ' + escapeHtml(txn.notes) : ''}</div>
        </div>
        <span class="txn-amount ${amountClass}">${sign}${formatMoney(txn.amount)}</span>
        <div class="txn-actions">
          <button class="btn-icon edit-txn"   data-id="${txn.id}" title="Edit"   aria-label="Edit transaction">✏️</button>
          <button class="btn-icon delete delete-txn" data-id="${txn.id}" title="Delete" aria-label="Delete transaction">🗑️</button>
        </div>
      </div>`;
  }

  // ---- Budget Progress (dashboard) ----
  function renderBudgetProgress(budget) {
    const spent     = DB.getBudgetSpent(budget.category, budget.month);
    const pct       = Math.min((spent / budget.limit) * 100, 100);
    const over      = spent > budget.limit;
    const warning   = pct >= 80 && !over;
    const cat       = DB.getCategoryById(budget.category);
    const fillClass = over ? 'fill-over' : warning ? 'fill-warning' : 'fill-ok';
    return `
      <div class="budget-progress-item">
        <div class="budget-progress-header">
          <span class="budget-progress-category">${cat.icon} ${cat.label}</span>
          <span class="budget-progress-amounts">
            ${formatMoney(spent)} / ${formatMoney(budget.limit)}
            ${over ? '<span style="color:#ef4444;font-weight:700"> Exceeded!</span>' : ''}
          </span>
        </div>
        <div class="progress-bar-track">
          <div class="progress-bar-fill ${fillClass}" style="width:${pct}%"></div>
        </div>
      </div>`;
  }

  // ---- Budget Card (budgets page) ----
  function renderBudgetCard(budget) {
    const spent       = DB.getBudgetSpent(budget.category, budget.month);
    const pct         = Math.min((spent / budget.limit) * 100, 100);
    const over        = spent > budget.limit;
    const warning     = pct >= 80 && !over;
    const cat         = DB.getCategoryById(budget.category);
    const fillClass   = over ? 'fill-over' : warning ? 'fill-warning' : 'fill-ok';
    const borderColor = over ? '#ef4444'   : warning ? '#f59e0b'      : '#6c63ff';
    return `
      <div class="budget-card" style="border-top-color:${borderColor}">
        <div class="budget-card-header">
          <span class="budget-card-title">${cat.icon} ${cat.label}</span>
          <span class="budget-card-month">${formatMonth(budget.month)}</span>
        </div>
        <div class="budget-card-amounts">
          <span class="budget-card-spent" style="color:${over ? '#ef4444' : 'inherit'}">${formatMoney(spent)} spent</span>
          <span class="budget-card-limit">of ${formatMoney(budget.limit)}</span>
        </div>
        <div class="progress-bar-track">
          <div class="progress-bar-fill ${fillClass}" style="width:${pct}%"></div>
        </div>
        <div class="budget-card-actions">
          <button class="btn btn-outline btn-sm edit-budget"   data-id="${budget.id}">Edit</button>
          <button class="btn btn-danger  btn-sm delete-budget" data-id="${budget.id}">Delete</button>
        </div>
      </div>`;
  }

  // ---- Report Summary Cards ----
  function renderReportSummary(transactions) {
    const totals  = DB.getTotals(transactions);
    const balance = totals.income - totals.expense;
    return `
      <div class="report-card">
        <div class="report-card-label">Income</div>
        <div class="report-card-value" style="color:#22c55e">${formatMoney(totals.income)}</div>
      </div>
      <div class="report-card">
        <div class="report-card-label">Expenses</div>
        <div class="report-card-value" style="color:#ef4444">${formatMoney(totals.expense)}</div>
      </div>
      <div class="report-card">
        <div class="report-card-label">Net Balance</div>
        <div class="report-card-value" style="color:${balance >= 0 ? '#3b82f6' : '#ef4444'}">${balance >= 0 ? '+' : '-'}${formatMoney(balance)}</div>
      </div>
      <div class="report-card">
        <div class="report-card-label">Transactions</div>
        <div class="report-card-value">${transactions.length}</div>
      </div>`;
  }

  // ---- Toast notifications ----
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast     = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3100);
  }

  // ---- Populate all category <select> elements ----
  function populateCategorySelects() {
    const categories = DB.getCategories();
    const selects = [
      document.getElementById('expense-category'),
      document.getElementById('budget-category'),
      document.getElementById('filter-category'),
      document.getElementById('report-category'),
    ].filter(Boolean);

    selects.forEach(sel => {
      const isFilter = sel.id === 'filter-category';
      sel.innerHTML  = (isFilter ? '<option value="">All Categories</option>' : '<option value="">Select category</option>')
        + categories.map(c => `<option value="${c.id}">${c.icon} ${c.label}</option>`).join('');
    });
  }

  // ---- XSS-safe HTML escape ----
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#39;');
  }

  return {
    formatMoney, formatDate, formatMonth,
    renderTransactionItem, renderBudgetProgress, renderBudgetCard, renderReportSummary,
    showToast, populateCategorySelects, escapeHtml,
  };
})();


/* ================================================================
   4. App — main controller
   ================================================================ */
(function () {
  'use strict';

  /* ----------------------------------------------------------
     Navigation
     ---------------------------------------------------------- */
  const navButtons = document.querySelectorAll('.nav-btn');
  const pages      = document.querySelectorAll('.page');

  function navigateTo(pageId) {
    navButtons.forEach(b => b.classList.toggle('active', b.dataset.page === pageId));
    pages.forEach(p => p.classList.toggle('active', p.id === `page-${pageId}`));

    if (pageId === 'dashboard') refreshDashboard();
    if (pageId === 'expenses')  refreshExpensesList();
    if (pageId === 'budget')    refreshBudgetsPage();
    if (pageId === 'reports')   initReports();
  }

  navButtons.forEach(btn => btn.addEventListener('click', () => navigateTo(btn.dataset.page)));

  /* ----------------------------------------------------------
     Dashboard
     ---------------------------------------------------------- */
  function refreshDashboard() {
    const currentMonth  = DB.currentMonth();
    const transactions  = DB.getTransactions();
    const thisMonth     = transactions.filter(t => t.date.slice(0, 7) === currentMonth);
    const totals        = DB.getTotals(thisMonth);
    const balance       = totals.income - totals.expense;

    document.getElementById('current-date').textContent =
      new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    document.getElementById('total-income').textContent   = UI.formatMoney(totals.income);
    document.getElementById('total-expenses').textContent = UI.formatMoney(totals.expense);

    const balanceEl       = document.getElementById('net-balance');
    balanceEl.textContent = (balance < 0 ? '-' : '') + UI.formatMoney(balance);
    balanceEl.style.color = balance < 0 ? '#ef4444' : '#22c55e';

    // Budget used %
    const budgets = DB.getBudgets().filter(b => b.month === currentMonth);
    if (budgets.length) {
      const totalLimit = budgets.reduce((s, b) => s + b.limit, 0);
      const pct        = totalLimit ? Math.round((totals.expense / totalLimit) * 100) : 0;
      document.getElementById('budget-used-pct').textContent = pct + '%';
    } else {
      document.getElementById('budget-used-pct').textContent = '—';
    }

    // Pie chart — this month's spending by category
    const byCat    = DB.getExpensesByCategory(thisMonth);
    const allCats  = DB.getCategories();
    const pieData  = Object.entries(byCat)
      .map(([id, value]) => ({ label: (allCats.find(c => c.id === id) || { label: id }).label, value }))
      .sort((a, b) => b.value - a.value);
    Charts.drawPie('pie-chart', pieData, 'pie-legend');

    // Bar chart — last 6 months
    const monthly   = DB.getMonthlyTotals(transactions);
    const monthKeys = Object.keys(monthly).slice(-6);
    const MON_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    Charts.drawBar('bar-chart',
      monthKeys.map(m => MON_NAMES[parseInt(m.split('-')[1], 10) - 1]),
      { income: monthKeys.map(k => monthly[k].income), expense: monthKeys.map(k => monthly[k].expense) }
    );

    // Budget progress bars
    const progressEl      = document.getElementById('budget-progress-list');
    progressEl.innerHTML  = budgets.length
      ? budgets.map(b => UI.renderBudgetProgress(b)).join('')
      : '<p class="empty-state">No budgets set yet. Go to Budgets to get started.</p>';

    // Recent transactions (5 most recent)
    const recentEl      = document.getElementById('recent-transactions');
    const recent        = transactions.slice(0, 5);
    if (recent.length) {
      recentEl.innerHTML = recent.map(t => UI.renderTransactionItem(t)).join('');
      bindTransactionActions(recentEl);
    } else {
      recentEl.innerHTML = '<p class="empty-state">No transactions yet.</p>';
    }
  }

  /* ----------------------------------------------------------
     Expenses Page
     ---------------------------------------------------------- */
  function refreshExpensesList() {
    UI.populateCategorySelects();

    let transactions = DB.getTransactions();
    const search     = document.getElementById('search-input').value.toLowerCase();
    const category   = document.getElementById('filter-category').value;
    const type       = document.getElementById('filter-type').value;
    const month      = document.getElementById('filter-month').value;

    if (search)   transactions = transactions.filter(t =>
      t.description.toLowerCase().includes(search) || (t.notes && t.notes.toLowerCase().includes(search)));
    if (category) transactions = transactions.filter(t => t.category === category);
    if (type)     transactions = transactions.filter(t => t.type === type);
    if (month)    transactions = transactions.filter(t => t.date.slice(0, 7) === month);

    const listEl      = document.getElementById('expenses-list');
    if (transactions.length) {
      listEl.innerHTML = transactions.map(t => UI.renderTransactionItem(t)).join('');
      bindTransactionActions(listEl);
    } else {
      listEl.innerHTML = '<p class="empty-state">No transactions found.</p>';
    }
  }

  ['search-input', 'filter-category', 'filter-type', 'filter-month'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', refreshExpensesList);
  });

  document.getElementById('clear-filters').addEventListener('click', () => {
    ['search-input', 'filter-category', 'filter-type', 'filter-month']
      .forEach(id => { document.getElementById(id).value = ''; });
    refreshExpensesList();
  });

  function bindTransactionActions(container) {
    container.addEventListener('click', e => {
      const editBtn   = e.target.closest('.edit-txn');
      const deleteBtn = e.target.closest('.delete-txn');
      if (editBtn)   openEditExpense(editBtn.dataset.id);
      if (deleteBtn) confirmDeleteTransaction(deleteBtn.dataset.id);
    });
  }

  /* ----------------------------------------------------------
     Expense Modal
     ---------------------------------------------------------- */
  const expenseModal      = document.getElementById('expense-modal');
  const expenseForm       = document.getElementById('expense-form');
  const expenseModalTitle = document.getElementById('expense-modal-title');

  function openExpenseModal(title = 'Add Transaction') {
    expenseModalTitle.textContent = title;
    expenseModal.classList.add('open');
    document.getElementById('expense-description').focus();
  }

  function closeExpenseModal() {
    expenseModal.classList.remove('open');
    expenseForm.reset();
    document.getElementById('expense-id').value           = '';
    document.getElementById('expense-form-error').textContent = '';
  }

  function openEditExpense(id) {
    const txn = DB.getTransactions().find(t => t.id === id);
    if (!txn) return;
    UI.populateCategorySelects();
    document.getElementById('expense-id').value          = txn.id;
    document.getElementById('expense-type').value        = txn.type;
    document.getElementById('expense-description').value = txn.description;
    document.getElementById('expense-amount').value      = txn.amount;
    document.getElementById('expense-category').value    = txn.category;
    document.getElementById('expense-date').value        = txn.date;
    document.getElementById('expense-notes').value       = txn.notes || '';
    openExpenseModal('Edit Transaction');
  }

  document.getElementById('open-add-expense').addEventListener('click', () => {
    UI.populateCategorySelects();
    document.getElementById('expense-date').value = new Date().toISOString().slice(0, 10);
    openExpenseModal('Add Transaction');
  });

  document.getElementById('close-expense-modal').addEventListener('click', closeExpenseModal);
  document.getElementById('cancel-expense').addEventListener('click', closeExpenseModal);
  expenseModal.addEventListener('click', e => { if (e.target === expenseModal) closeExpenseModal(); });

  expenseForm.addEventListener('submit', e => {
    e.preventDefault();
    const errEl       = document.getElementById('expense-form-error');
    errEl.textContent = '';

    const id          = document.getElementById('expense-id').value;
    const type        = document.getElementById('expense-type').value;
    const description = document.getElementById('expense-description').value.trim();
    const amount      = parseFloat(document.getElementById('expense-amount').value);
    const category    = document.getElementById('expense-category').value;
    const date        = document.getElementById('expense-date').value;
    const notes       = document.getElementById('expense-notes').value.trim();

    if (!description)      { errEl.textContent = 'Description is required.';          return; }
    if (!amount || amount <= 0) { errEl.textContent = 'Enter a valid positive amount.'; return; }
    if (!category)         { errEl.textContent = 'Please select a category.';          return; }
    if (!date)             { errEl.textContent = 'Please select a date.';              return; }

    if (id) {
      DB.updateTransaction(id, { type, description, amount, category, date, notes });
      UI.showToast('Transaction updated!', 'success');
    } else {
      DB.addTransaction({ type, description, amount, category, date, notes });
      UI.showToast('Transaction added!', 'success');
    }

    closeExpenseModal();
    refreshExpensesList();
    refreshDashboard();
  });

  function confirmDeleteTransaction(id) {
    if (!confirm('Delete this transaction? This cannot be undone.')) return;
    DB.deleteTransaction(id);
    UI.showToast('Transaction deleted.', 'info');
    refreshExpensesList();
    refreshDashboard();
  }

  /* ----------------------------------------------------------
     Budgets Page
     ---------------------------------------------------------- */
  function refreshBudgetsPage() {
    UI.populateCategorySelects();
    const budgets = DB.getBudgets();
    const gridEl  = document.getElementById('budgets-grid');
    if (budgets.length) {
      gridEl.innerHTML = budgets
        .sort((a, b) => b.month.localeCompare(a.month))
        .map(b => UI.renderBudgetCard(b)).join('');
      bindBudgetActions(gridEl);
    } else {
      gridEl.innerHTML = '<p class="empty-state">No budgets set. Add one to start tracking.</p>';
    }
  }

  function bindBudgetActions(container) {
    container.addEventListener('click', e => {
      const editBtn   = e.target.closest('.edit-budget');
      const deleteBtn = e.target.closest('.delete-budget');
      if (editBtn)   openEditBudget(editBtn.dataset.id);
      if (deleteBtn) confirmDeleteBudget(deleteBtn.dataset.id);
    });
  }

  /* ---- Budget Modal ---- */
  const budgetModal = document.getElementById('budget-modal');
  const budgetForm  = document.getElementById('budget-form');

  function openBudgetModal(title = 'Add Budget') {
    document.getElementById('budget-modal-title').textContent = title;
    budgetModal.classList.add('open');
  }

  function closeBudgetModal() {
    budgetModal.classList.remove('open');
    budgetForm.reset();
    document.getElementById('budget-id').value            = '';
    document.getElementById('budget-form-error').textContent = '';
  }

  function openEditBudget(id) {
    const budget = DB.getBudgets().find(b => b.id === id);
    if (!budget) return;
    UI.populateCategorySelects();
    document.getElementById('budget-id').value       = budget.id;
    document.getElementById('budget-category').value = budget.category;
    document.getElementById('budget-limit').value    = budget.limit;
    document.getElementById('budget-month').value    = budget.month;
    openBudgetModal('Edit Budget');
  }

  document.getElementById('open-add-budget').addEventListener('click', () => {
    UI.populateCategorySelects();
    document.getElementById('budget-month').value = DB.currentMonth();
    openBudgetModal('Add Budget');
  });

  document.getElementById('close-budget-modal').addEventListener('click', closeBudgetModal);
  document.getElementById('cancel-budget').addEventListener('click', closeBudgetModal);
  budgetModal.addEventListener('click', e => { if (e.target === budgetModal) closeBudgetModal(); });

  budgetForm.addEventListener('submit', e => {
    e.preventDefault();
    const errEl       = document.getElementById('budget-form-error');
    errEl.textContent = '';

    const id       = document.getElementById('budget-id').value;
    const category = document.getElementById('budget-category').value;
    const limit    = parseFloat(document.getElementById('budget-limit').value);
    const month    = document.getElementById('budget-month').value;

    if (!category)         { errEl.textContent = 'Please select a category.';   return; }
    if (!limit || limit <= 0) { errEl.textContent = 'Enter a valid limit amount.'; return; }
    if (!month)            { errEl.textContent = 'Please select a month.';       return; }

    if (id) {
      DB.updateBudget(id, { category, limit, month });
      UI.showToast('Budget updated!', 'success');
    } else {
      const result = DB.addBudget({ category, limit, month });
      if (result.error) { errEl.textContent = result.error; return; }
      UI.showToast('Budget added!', 'success');
    }

    closeBudgetModal();
    refreshBudgetsPage();
    refreshDashboard();
  });

  function confirmDeleteBudget(id) {
    if (!confirm('Delete this budget?')) return;
    DB.deleteBudget(id);
    UI.showToast('Budget deleted.', 'info');
    refreshBudgetsPage();
  }

  /* ----------------------------------------------------------
     Reports Page
     ---------------------------------------------------------- */
  function initReports() {
    const current = DB.currentMonth();
    const fromEl  = document.getElementById('report-from');
    const toEl    = document.getElementById('report-to');
    if (!fromEl.value) fromEl.value = current;
    if (!toEl.value)   toEl.value   = current;
    generateReport();
  }

  function generateReport() {
    const from = document.getElementById('report-from').value;
    const to   = document.getElementById('report-to').value;

    if (from && to && from > to) {
      UI.showToast('Start month must be before end month.', 'error');
      return;
    }

    const transactions = DB.getTransactionsByRange(from, to);
    document.getElementById('report-summary').innerHTML = UI.renderReportSummary(transactions);

    // Category pie
    const byCat   = DB.getExpensesByCategory(transactions);
    const cats    = DB.getCategories();
    const pieData = Object.entries(byCat)
      .map(([id, value]) => ({ label: (cats.find(c => c.id === id) || { label: id }).label, value }))
      .sort((a, b) => b.value - a.value);
    Charts.drawPie('report-pie-chart', pieData, 'report-pie-legend');

    // Monthly bar
    const monthly   = DB.getMonthlyTotals(transactions);
    const monthKeys = Object.keys(monthly);
    const MON_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    Charts.drawBar('report-bar-chart',
      monthKeys.map(m => { const [y, mo] = m.split('-'); return MON_NAMES[parseInt(mo, 10) - 1] + ' ' + y.slice(2); }),
      { income: monthKeys.map(k => monthly[k].income), expense: monthKeys.map(k => monthly[k].expense) }
    );
  }

  document.getElementById('generate-report').addEventListener('click', generateReport);

  // CSV Export
  document.getElementById('export-csv').addEventListener('click', () => {
    const from         = document.getElementById('report-from').value;
    const to           = document.getElementById('report-to').value;
    const transactions = DB.getTransactionsByRange(from, to);

    if (!transactions.length) { UI.showToast('No transactions to export.', 'error'); return; }

    const headers = ['Date', 'Type', 'Description', 'Category', 'Amount', 'Notes'];
    const rows    = transactions.map(t => {
      const cat = DB.getCategoryById(t.category);
      return [
        t.date, t.type,
        `"${t.description.replace(/"/g, '""')}"`,
        cat.label,
        t.amount.toFixed(2),
        `"${(t.notes || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csv  = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `transactions_${from || 'all'}_to_${to || 'all'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    UI.showToast('CSV exported!', 'success');
  });

  /* ----------------------------------------------------------
     Keyboard: close modals on Escape
     ---------------------------------------------------------- */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeExpenseModal(); closeBudgetModal(); }
  });

  /* ----------------------------------------------------------
     Init
     ---------------------------------------------------------- */
  function init() {
    UI.populateCategorySelects();
    refreshDashboard();

    // Redraw charts on resize
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const activePage = document.querySelector('.page.active');
        if (!activePage) return;
        const id = activePage.id.replace('page-', '');
        if (id === 'dashboard') refreshDashboard();
        if (id === 'reports')   generateReport();
      }, 200);
    });
  }

  init();
})();
