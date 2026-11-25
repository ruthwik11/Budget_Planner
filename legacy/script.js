/* ==========================================================================
   BUDGET PLANNER - EUROPE TRIP (₹15 LAKHS) JAVASCRIPT ENGINE
   ========================================================================== */

// --------------------------------------------------------------------------
// 1. STORAGE KEYS & CATEGORY CONFIGURATION
// --------------------------------------------------------------------------
const LOCAL_STORAGE_USERS = 'europe_budget_db_users';
const LOCAL_STORAGE_TXS = 'europe_budget_db_transactions';
const LOCAL_STORAGE_SAVINGS = 'europe_budget_db_savings';
const LOCAL_STORAGE_BUDGETS = 'europe_budget_db_budgets';
const LOCAL_STORAGE_AUDIT = 'europe_budget_db_audit_logs';

const SESSION_STORAGE_ACTIVE = 'europe_budget_session_active';

const CATEGORY_COLORS = {
  Lodge: '#8b5cf6',            // Purpl
  Food: '#f59e0b',             // Amber
  Cabs: '#3b82f6',             // Blue
  Entertainment: '#ec4899',    // Pink
  Flights: '#06b6d4',          // Cyan
  Sightseeing: '#10b981',      // Emerald
  Shopping: '#e11d48',         // Rose
  'Visa & Insurance': '#6366f1',// Indigo
  Other: '#64748b',            // Slate
  'Trip Fund': '#10b981',      // Green`+++++++++++++
  'Savings Deposit': '#3b82f6',
  'Sponsorship': '#8b5cf6'
};

const CATEGORY_ICONS = {
  Lodge: 'fa-hotel',
  Food: 'fa-utensils',
  Cabs: 'fa-taxi',
  Entertainment: 'fa-ticket',
  Flights: 'fa-plane-departure',
  Sightseeing: 'fa-landmark',
  Shopping: 'fa-bag-shopping',
  'Visa & Insurance': 'fa-passport',
  Other: 'fa-coins',
  'Trip Fund': 'fa-vault',
  'Savings Deposit': 'fa-piggy-bank',
  'Sponsorship': 'fa-hand-holding-dollar'
};

// Exchange rate: 1 EUR = ₹90 INR
const EUR_EXCHANGE_RATE = 90;

// --------------------------------------------------------------------------
// 2. DUAL STORAGE ENGINE (localStorage DB + sessionStorage Session)
// --------------------------------------------------------------------------
let db = {
  users: [],
  transactions: [],
  savingsGoals: [],
  categoryBudgets: {},
  auditLogs: []
};

let activeSession = null; // { userId, name, username, role }
let currentTheme = 'dark';
let currentCurrency = '₹'; // '₹' for INR or '€' for EUR

function initDatabase() {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');

  // Default Users
  const defaultUsers = [
    { id: 'usr-1', name: 'Alex Morgan', username: 'alex', password: 'user123', role: 'user', status: 'active', createdAt: `${year}-01-10` },
    { id: 'usr-2', name: 'Sarah Connor', username: 'sarah', password: 'user123', role: 'user', status: 'active', createdAt: `${year}-02-15` },
    { id: 'usr-admin', name: 'System Admin', username: 'admin', password: 'admin123', role: 'admin', status: 'active', createdAt: `${year}-01-01` }
  ];

  // Default Transactions (15 Lakhs Europe Trip Preset)
  const defaultTxs = [
    { id: 'tx-0', userId: 'usr-1', type: 'income', title: 'Europe Trip Allocated Master Budget', amount: 1500000, category: 'Trip Fund', date: `${year}-${month}-01` },
    { id: 'tx-1', userId: 'usr-1', type: 'expense', title: 'International Return Flights (India <-> Paris/Rome)', amount: 280000, category: 'Flights', date: `${year}-${month}-02` },
    { id: 'tx-2', userId: 'usr-1', type: 'expense', title: 'Schengen Visa VFS Application & Biometrics', amount: 18000, category: 'Visa & Insurance', date: `${year}-${month}-03` },
    { id: 'tx-3', userId: 'usr-1', type: 'expense', title: 'Overseas Travel & Medical Insurance', amount: 14000, category: 'Visa & Insurance', date: `${year}-${month}-04` },
    { id: 'tx-4', userId: 'usr-1', type: 'expense', title: 'Paris Hotel Stay (5 Nights near Eiffel Tower)', amount: 140000, category: 'Lodge', date: `${year}-${month}-05` },
    { id: 'tx-5', userId: 'usr-1', type: 'expense', title: 'Swiss Alps Chalet in Interlaken (4 Nights)', amount: 160000, category: 'Lodge', date: `${year}-${month}-06` },
    { id: 'tx-6', userId: 'usr-1', type: 'expense', title: 'Eurail 10-Day Continuous Pass (Trains & Intercity)', amount: 85000, category: 'Cabs', date: `${year}-${month}-07` },
    { id: 'tx-7', userId: 'usr-1', type: 'expense', title: 'Paris Seine River Cruise & Lido Dinner Show', amount: 35000, category: 'Entertainment', date: `${year}-${month}-08` },
    { id: 'tx-8', userId: 'usr-1', type: 'expense', title: 'Eiffel Tower Summit & Louvre Museum Entry', amount: 22000, category: 'Sightseeing', date: `${year}-${month}-09` },
    { id: 'tx-9', userId: 'usr-1', type: 'expense', title: 'French Gourmet Dining & Cafes in Paris', amount: 45000, category: 'Food', date: `${year}-${month}-10` },
    { id: 'tx-10', userId: 'usr-1', type: 'expense', title: 'Rome Colosseum & Vatican Museums Tour', amount: 28000, category: 'Sightseeing', date: `${year}-${month}-11` },
    { id: 'tx-11', userId: 'usr-1', type: 'expense', title: 'Italian Trattoria & Gelato Tasting Tour', amount: 32000, category: 'Food', date: `${year}-${month}-12` },
    { id: 'tx-12', userId: 'usr-1', type: 'expense', title: 'Airport Transfers & Local City Cabs/Taxis', amount: 28000, category: 'Cabs', date: `${year}-${month}-13` },
    { id: 'tx-13', userId: 'usr-1', type: 'expense', title: 'Galeries Lafayette Souvenirs & Fashion Outlets', amount: 55000, category: 'Shopping', date: `${year}-${month}-14` },

    // User 2 Sample Data
    { id: 'tx-14', userId: 'usr-2', type: 'income', title: 'Europe Trip Allocation', amount: 1200000, category: 'Trip Fund', date: `${year}-${month}-01` },
    { id: 'tx-15', userId: 'usr-2', type: 'expense', title: 'Return Flight Tickets', amount: 240000, category: 'Flights', date: `${year}-${month}-03` },
    { id: 'tx-16', userId: 'usr-2', type: 'expense', title: 'Amsterdam Hostel & Hotel', amount: 110000, category: 'Lodge', date: `${year}-${month}-06` }
  ];

  // Default European City Leg Budgets
  const defaultSavings = [
    { id: 'goal-1', userId: 'usr-1', title: 'Paris & France Leg', targetAmount: 450000, savedAmount: 380000, targetDate: `${year}-07-15` },
    { id: 'goal-2', userId: 'usr-1', title: 'Swiss Alps & Zurich Leg', targetAmount: 400000, savedAmount: 320000, targetDate: `${year}-07-22` },
    { id: 'goal-3', userId: 'usr-1', title: 'Italy - Rome & Venice Leg', targetAmount: 350000, savedAmount: 280000, targetDate: `${year}-07-29` },
    { id: 'goal-4', userId: 'usr-1', title: 'Netherlands - Amsterdam Leg', targetAmount: 300000, savedAmount: 220000, targetDate: `${year}-08-05` }
  ];

  // Default Category Budgets (Summing to 15 Lakhs for usr-1)
  const defaultBudgets = {
    'usr-1': {
      Lodge: 400000,
      Flights: 300000,
      Food: 250000,
      Cabs: 150000,
      Entertainment: 150000,
      Sightseeing: 100000,
      'Visa & Insurance': 50000,
      Shopping: 100000,
      Other: 100000
    },
    'usr-2': {
      Lodge: 350000,
      Flights: 250000,
      Food: 200000,
      Cabs: 120000,
      Entertainment: 100000,
      Sightseeing: 80000,
      'Visa & Insurance': 40000,
      Shopping: 60000,
      Other: 50000
    }
  };

  // Default Audit Logs
  const defaultLogs = [
    { id: 'log-1', timestamp: new Date().toLocaleString(), action: 'Database Initialized', performedBy: 'System', details: 'Initialized 15 Lakhs Europe Trip Budget Planner database.' }
  ];

  return { users: defaultUsers, transactions: defaultTxs, savingsGoals: defaultSavings, categoryBudgets: defaultBudgets, auditLogs: defaultLogs };
}

function loadLocalStorage() {
  try {
    const rawUsers = localStorage.getItem(LOCAL_STORAGE_USERS);
    const rawTxs = localStorage.getItem(LOCAL_STORAGE_TXS);
    const rawSavings = localStorage.getItem(LOCAL_STORAGE_SAVINGS);
    const rawBudgets = localStorage.getItem(LOCAL_STORAGE_BUDGETS);
    const rawLogs = localStorage.getItem(LOCAL_STORAGE_AUDIT);

    if (rawUsers && rawTxs) {
      db.users = JSON.parse(rawUsers);
      db.transactions = JSON.parse(rawTxs);
      db.savingsGoals = rawSavings ? JSON.parse(rawSavings) : [];
      db.categoryBudgets = rawBudgets ? JSON.parse(rawBudgets) : {};
      db.auditLogs = rawLogs ? JSON.parse(rawLogs) : [];
    } else {
      const defaults = initDatabase();
      db = defaults;
      saveLocalStorage();
    }
  } catch (e) {
    console.error('Error loading localStorage DB', e);
    db = initDatabase();
  }
}

function saveLocalStorage() {
  try {
    localStorage.setItem(LOCAL_STORAGE_USERS, JSON.stringify(db.users));
    localStorage.setItem(LOCAL_STORAGE_TXS, JSON.stringify(db.transactions));
    localStorage.setItem(LOCAL_STORAGE_SAVINGS, JSON.stringify(db.savingsGoals));
    localStorage.setItem(LOCAL_STORAGE_BUDGETS, JSON.stringify(db.categoryBudgets));
    localStorage.setItem(LOCAL_STORAGE_AUDIT, JSON.stringify(db.auditLogs));
  } catch (e) {
    console.error('Error saving localStorage DB', e);
  }
}

function loadSessionStorage() {
  try {
    const sessionData = sessionStorage.getItem(SESSION_STORAGE_ACTIVE);
    if (sessionData) {
      activeSession = JSON.parse(sessionData);
    }
  } catch (e) {
    console.error('Error loading sessionStorage', e);
    activeSession = null;
  }
}

function saveSessionStorage() {
  try {
    if (activeSession) {
      sessionStorage.setItem(SESSION_STORAGE_ACTIVE, JSON.stringify(activeSession));
    } else {
      sessionStorage.removeItem(SESSION_STORAGE_ACTIVE);
    }
  } catch (e) {
    console.error('Error saving sessionStorage', e);
  }
}

function logAuditEvent(action, details) {
  const log = {
    id: 'log-' + Date.now(),
    timestamp: new Date().toLocaleString(),
    action,
    performedBy: activeSession ? `${activeSession.name} (${activeSession.role})` : 'System',
    details
  };
  db.auditLogs.unshift(log);
  saveLocalStorage();
}

// --------------------------------------------------------------------------
// 3. GLOBAL CHART INSTANCES
// --------------------------------------------------------------------------
let dashDoughnutChartInstance = null;
let analyticsDoughnutChartInstance = null;
let analyticsMonthlyChartInstance = null;
let analyticsComparisonChartInstance = null;
let adminExpenseChartInstance = null;
let adminUserDistChartInstance = null;

// --------------------------------------------------------------------------
// 4. HELPER & CURRENCY FORMATTING FUNCTIONS
// --------------------------------------------------------------------------
function formatCurrency(amount) {
  const num = Number(amount || 0);

  if (currentCurrency === '€') {
    const eurVal = num / EUR_EXCHANGE_RATE;
    return `€${eurVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } else if (currentCurrency === '$') {
    const usdVal = num / 83;
    return `$${usdVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } else if (currentCurrency === '£') {
    const gbpVal = num / 105;
    return `£${gbpVal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } else {
    // Default INR ₹
    const inrVal = num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `₹${inrVal}`;
  }
}

function getInitials(name) {
  if (!name) return 'U';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
}

function getCurrentMonthString() {
  return new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

function getCurrentYearMonthISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// User-Specific Stats Calculations
function getUserTotals(userId, filterMonthISO = null) {
  let txs = db.transactions.filter(t => t.userId === userId);

  const totalIncome = txs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const totalExpenses = txs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const remainingBalance = totalIncome - totalExpenses;

  const userGoals = db.savingsGoals.filter(g => g.userId === userId);
  const totalSavings = userGoals.reduce((s, g) => s + Number(g.savedAmount), 0);

  const incomeCount = txs.filter(t => t.type === 'income').length;
  const expenseCount = txs.filter(t => t.type === 'expense').length;

  return { totalIncome, totalExpenses, remainingBalance, totalSavings, incomeCount, expenseCount };
}

function getUserCategoryExpenses(userId, filterMonthISO = null) {
  let txs = db.transactions.filter(t => t.userId === userId && t.type === 'expense');

  const categories = ['Lodge', 'Food', 'Cabs', 'Entertainment', 'Flights', 'Sightseeing', 'Shopping', 'Visa & Insurance', 'Other'];
  const totals = {};
  categories.forEach(cat => totals[cat] = 0);

  txs.forEach(t => {
    if (totals[t.category] !== undefined) totals[t.category] += Number(t.amount);
    else totals['Other'] += Number(t.amount);
  });

  return totals;
}

// --------------------------------------------------------------------------
// 5. ALERT ENGINE
// --------------------------------------------------------------------------
function showToastAlert(title, message, type = 'warning') {
  const container = document.getElementById('alert-banner-container');
  if (!container) return;

  const iconMap = {
    danger: 'fa-triangle-exclamation',
    warning: 'fa-circle-exclamation',
    info: 'fa-circle-info',
    success: 'fa-circle-check'
  };

  const toast = document.createElement('div');
  toast.className = `alert-toast alert-${type}`;
  toast.innerHTML = `
    <i class="fa-solid ${iconMap[type]} alert-icon"></i>
    <div class="alert-content">
      <h5>${title}</h5>
      <p>${message}</p>
    </div>
    <button class="close-alert-btn"><i class="fa-solid fa-xmark"></i></button>
  `;

  toast.querySelector('.close-alert-btn').addEventListener('click', () => toast.remove());
  container.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 6000);
}

function renderUserAlerts() {
  const alertContainer = document.getElementById('dashboard-alerts');
  if (!alertContainer || !activeSession) return;
  alertContainer.innerHTML = '';

  const totals = getUserTotals(activeSession.userId);
  const catExpenses = getUserCategoryExpenses(activeSession.userId);
  const userBudgets = db.categoryBudgets[activeSession.userId] || {};

  let alerts = [];

  if (totals.totalExpenses > totals.totalIncome && totals.totalIncome > 0) {
    alerts.push({
      type: 'danger',
      icon: 'fa-triangle-exclamation',
      title: 'Europe Trip Overbudget Warning!',
      message: 'Logged trip expenses have exceeded your total allocated budget!'
    });
  }

  Object.keys(userBudgets).forEach(cat => {
    const spent = catExpenses[cat] || 0;
    const limit = userBudgets[cat] || 0;
    if (limit > 0 && spent > limit) {
      alerts.push({
        type: 'danger',
        icon: 'fa-bell',
        title: `⚠️ ${cat} Budget Limit Exceeded!`,
        message: `Spent ${formatCurrency(spent)} of your ${formatCurrency(limit)} cap.`
      });
    }
  });

  alerts.forEach(alert => {
    const banner = document.createElement('div');
    banner.className = `dashboard-alert-banner ${alert.type === 'warning' ? 'warning' : ''}`;
    banner.innerHTML = `
      <i class="fa-solid ${alert.icon}"></i>
      <div>
        <strong>${alert.title}</strong>
        <p>${alert.message}</p>
      </div>
    `;
    alertContainer.appendChild(banner);
  });
}

// --------------------------------------------------------------------------
// 6. MAIN UI RENDER DISPATCHER
// --------------------------------------------------------------------------
function updateUI() {
  const loginScreen = document.getElementById('login-screen');
  const appScreen = document.getElementById('app-screen');

  if (!activeSession) {
    loginScreen.classList.remove('hidden');
    appScreen.classList.add('hidden');
    return;
  } else {
    loginScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');
  }

  // Theme & Currency Badges
  document.documentElement.setAttribute('data-theme', currentTheme);
  const themeIcon = document.querySelector('#theme-toggle-btn i');
  if (themeIcon) themeIcon.className = currentTheme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';

  const currLabel = document.getElementById('currency-toggle-label');
  if (currLabel) currLabel.textContent = `Currency: ${currentCurrency} ${currentCurrency === '€' ? 'EUR' : (currentCurrency === '$' ? 'USD' : 'INR')}`;

  // Header & User Info
  document.getElementById('user-display-name').textContent = activeSession.name;
  document.getElementById('sidebar-user-name').textContent = activeSession.name;
  document.getElementById('sidebar-user-avatar').textContent = getInitials(activeSession.name);
  document.getElementById('sidebar-user-role-label').textContent = activeSession.role === 'admin' ? 'System Admin' : 'Europe Traveler';
  document.getElementById('current-month-display').textContent = 'Europe Trip 2026';

  const userNav = document.getElementById('user-sidebar-nav');
  const adminNav = document.getElementById('admin-sidebar-nav');
  const portalBadge = document.getElementById('sidebar-portal-badge');
  const userQuickActions = document.getElementById('user-quick-actions');

  if (activeSession.role === 'admin') {
    portalBadge.className = 'badge badge-admin';
    portalBadge.innerHTML = '<i class="fa-solid fa-user-shield"></i> Admin Control Module';
    userNav.classList.add('hidden');
    adminNav.classList.remove('hidden');
    if (userQuickActions) userQuickActions.classList.add('hidden');
    renderAdminView();
  } else {
    portalBadge.className = 'badge badge-success';
    portalBadge.innerHTML = '<i class="fa-solid fa-plane-departure"></i> Traveler Portal';
    userNav.classList.remove('hidden');
    adminNav.classList.add('hidden');
    if (userQuickActions) userQuickActions.classList.remove('hidden');
    renderUserView();
  }
}

// --------------------------------------------------------------------------
// 7. USER MODULE RENDERERS
// --------------------------------------------------------------------------
function renderUserView() {
  const totals = getUserTotals(activeSession.userId);

  // Hero Card Stats
  document.getElementById('hero-target-budget').textContent = formatCurrency(totals.totalIncome);
  document.getElementById('hero-total-spent').textContent = formatCurrency(totals.totalExpenses);
  document.getElementById('hero-available-surplus').textContent = formatCurrency(totals.remainingBalance);

  // KPI Grid
  document.getElementById('dash-total-income').textContent = formatCurrency(totals.totalIncome);
  document.getElementById('dash-income-count').textContent = `Total Master Allocation`;

  document.getElementById('dash-total-expenses').textContent = formatCurrency(totals.totalExpenses);
  document.getElementById('dash-expense-count').textContent = `${totals.expenseCount} logged items`;

  document.getElementById('dash-remaining-balance').textContent = formatCurrency(totals.remainingBalance);
  const ratio = totals.totalIncome > 0 ? Math.max(0, (totals.remainingBalance / totals.totalIncome) * 100).toFixed(1) : 0;
  document.getElementById('dash-balance-ratio').textContent = `${ratio}% available surplus`;

  document.getElementById('dash-total-savings').textContent = formatCurrency(totals.totalSavings);

  renderUserAlerts();
  renderUserDashBudgets();
  renderUserRecentTxs();
  renderUserIncomeTable();
  renderUserExpenseTable();
  renderUserCategorySpendingGrid();
  renderUserSavingsGoals();
  renderUserCategoryBudgetsTab();
  renderUserMasterTxsTable();
  renderUserCharts();
}

function renderUserDashBudgets() {
  const container = document.getElementById('dash-budget-progress-list');
  if (!container) return;
  container.innerHTML = '';

  const catExpenses = getUserCategoryExpenses(activeSession.userId);
  const userBudgets = db.categoryBudgets[activeSession.userId] || {};
  const categories = Object.keys(userBudgets);

  categories.forEach(cat => {
    const spent = catExpenses[cat] || 0;
    const limit = userBudgets[cat] || 0;
    const percent = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;

    let fillClass = spent > limit && limit > 0 ? 'danger' : (percent >= 80 ? 'warning' : '');

    const item = document.createElement('div');
    item.className = 'progress-container';
    item.style.marginBottom = '0.75rem';
    item.innerHTML = `
      <div class="progress-info">
        <span><i class="fa-solid ${CATEGORY_ICONS[cat] || 'fa-tag'}"></i> ${cat}</span>
        <span>${formatCurrency(spent)} / ${formatCurrency(limit)} (${percent.toFixed(0)}%)</span>
      </div>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill ${fillClass}" style="width: ${percent}%;"></div>
      </div>
    `;
    container.appendChild(item);
  });
}

function renderUserRecentTxs() {
  const tbody = document.getElementById('dash-recent-transactions-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const txs = db.transactions
    .filter(t => t.userId === activeSession.userId)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 6);

  if (txs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No Europe trip expenses recorded yet.</td></tr>`;
    return;
  }

  txs.forEach(t => {
    const isIncome = t.type === 'income';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${t.date}</td>
      <td><span class="badge ${isIncome ? 'badge-success' : 'badge-danger'}">${isIncome ? 'Fund Deposit' : 'Trip Expense'}</span></td>
      <td><strong>${t.title}</strong></td>
      <td><i class="fa-solid ${CATEGORY_ICONS[t.category] || 'fa-tag'}"></i> ${t.category}</td>
      <td style="font-weight: 700; color: ${isIncome ? 'var(--color-success)' : 'var(--color-danger)'}">
        ${isIncome ? '+' : '-'}${formatCurrency(t.amount)}
      </td>
      <td>
        <button class="icon-btn btn-sm" onclick="deleteUserTransaction('${t.id}')" title="Delete Expense">
          <i class="fa-solid fa-trash-can" style="color: var(--color-danger);"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderUserIncomeTable() {
  const tbody = document.getElementById('income-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const incomes = db.transactions
    .filter(t => t.userId === activeSession.userId && t.type === 'income')
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const total = incomes.reduce((s, t) => s + Number(t.amount), 0);
  document.getElementById('income-page-total').textContent = `Total Fund: ${formatCurrency(total)}`;

  if (incomes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No allocated trip funds recorded.</td></tr>`;
    return;
  }

  incomes.forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${t.date}</td>
      <td><strong>${t.title}</strong></td>
      <td><span class="badge badge-success"><i class="fa-solid ${CATEGORY_ICONS[t.category] || 'fa-vault'}"></i> ${t.category}</span></td>
      <td style="font-weight:700; color: var(--color-success);">${formatCurrency(t.amount)}</td>
      <td>
        <button class="icon-btn btn-sm" onclick="deleteUserTransaction('${t.id}')">
          <i class="fa-solid fa-trash-can" style="color: var(--color-danger);"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderUserExpenseTable() {
  const tbody = document.getElementById('expense-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const expenses = db.transactions
    .filter(t => t.userId === activeSession.userId && t.type === 'expense')
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const total = expenses.reduce((s, t) => s + Number(t.amount), 0);
  document.getElementById('expense-page-total').textContent = `Total Spent: ${formatCurrency(total)}`;

  if (expenses.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No trip expenses logged.</td></tr>`;
    return;
  }

  expenses.forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${t.date}</td>
      <td><strong>${t.title}</strong></td>
      <td><span class="badge badge-danger"><i class="fa-solid ${CATEGORY_ICONS[t.category] || 'fa-receipt'}"></i> ${t.category}</span></td>
      <td style="font-weight:700; color: var(--color-danger);">${formatCurrency(t.amount)}</td>
      <td>
        <button class="icon-btn btn-sm" onclick="deleteUserTransaction('${t.id}')">
          <i class="fa-solid fa-trash-can" style="color: var(--color-danger);"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderUserCategorySpendingGrid() {
  const container = document.getElementById('category-spending-grid');
  if (!container) return;
  container.innerHTML = '';

  const catExpenses = getUserCategoryExpenses(activeSession.userId);
  Object.keys(catExpenses).forEach(cat => {
    const spent = catExpenses[cat] || 0;
    const box = document.createElement('div');
    box.className = 'cat-spending-box';
    box.innerHTML = `
      <div class="cat-icon" style="color: ${CATEGORY_COLORS[cat] || 'var(--color-primary)'}">
        <i class="fa-solid ${CATEGORY_ICONS[cat] || 'fa-tag'}"></i>
      </div>
      <div>
        <h5>${cat}</h5>
        <div class="cat-amount">${formatCurrency(spent)}</div>
      </div>
    `;
    container.appendChild(box);
  });
}

function renderUserSavingsGoals() {
  const container = document.getElementById('savings-goals-container');
  if (!container) return;
  container.innerHTML = '';

  const goals = db.savingsGoals.filter(g => g.userId === activeSession.userId);

  if (goals.length === 0) {
    container.innerHTML = `
      <div class="glass-card" style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
        <i class="fa-solid fa-earth-europe" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
        <h3>No European City Leg Budgets</h3>
        <p>Add city leg targets (e.g., France, Switzerland, Italy, Netherlands)!</p>
        <button class="btn btn-primary margin-top" onclick="openModal('add-goal-modal')"><i class="fa-solid fa-plus"></i> Create City Leg</button>
      </div>
    `;
    return;
  }

  goals.forEach(goal => {
    const percent = goal.targetAmount > 0 ? (goal.savedAmount / goal.targetAmount) * 100 : 0;
    const card = document.createElement('div');
    card.className = 'card glass-card goal-card';
    card.innerHTML = `
      <div class="goal-header">
        <div class="goal-icon-box"><i class="fa-solid fa-earth-europe"></i></div>
        <div class="goal-actions">
          <button class="icon-btn btn-sm" onclick="openDepositModal('${goal.id}')" title="Deposit Fund">
            <i class="fa-solid fa-plus" style="color: var(--color-success);"></i>
          </button>
          <button class="icon-btn btn-sm" onclick="deleteUserSavingsGoal('${goal.id}')" title="Delete">
            <i class="fa-solid fa-trash-can" style="color: var(--color-danger);"></i>
          </button>
        </div>
      </div>
      <div class="goal-body">
        <h4>${goal.title}</h4>
        <p class="goal-date"><i class="fa-solid fa-calendar-day"></i> Target Travel Date: ${goal.targetDate}</p>
      </div>
      <div class="progress-container">
        <div class="progress-info"><span>Allocated Progress</span><span>${percent.toFixed(1)}%</span></div>
        <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${Math.min(100, percent)}%;"></div></div>
        <div class="progress-info" style="margin-top:0.25rem;">
          <span style="color: var(--color-success);">${formatCurrency(goal.savedAmount)} allocated</span>
          <span style="color: var(--text-muted);">Target: ${formatCurrency(goal.targetAmount)}</span>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderUserCategoryBudgetsTab() {
  const container = document.getElementById('category-budgets-grid');
  if (!container) return;
  container.innerHTML = '';

  const catExpenses = getUserCategoryExpenses(activeSession.userId);
  const userBudgets = db.categoryBudgets[activeSession.userId] || {};

  Object.keys(userBudgets).forEach(cat => {
    const spent = catExpenses[cat] || 0;
    const limit = userBudgets[cat] || 0;
    const percent = limit > 0 ? (spent / limit) * 100 : 0;

    let isExceeded = spent > limit && limit > 0;
    let fillClass = isExceeded ? 'danger' : (percent >= 80 ? 'warning' : '');

    const card = document.createElement('div');
    card.className = 'card glass-card category-budget-card';
    card.innerHTML = `
      <div class="category-budget-header">
        <div class="category-budget-title">
          <div class="category-icon-pill" style="background: ${CATEGORY_COLORS[cat] || 'var(--color-primary)'};">
            <i class="fa-solid ${CATEGORY_ICONS[cat] || 'fa-tag'}"></i>
          </div>
          <div>
            <h4>${cat}</h4>
            <span class="badge ${isExceeded ? 'badge-danger' : 'badge-outline'}">
              ${isExceeded ? '⚠️ Over Budget' : `${percent.toFixed(0)}% Spent`}
            </span>
          </div>
        </div>
        <button class="icon-btn btn-sm" onclick="openEditBudgetModal('${cat}')" title="Edit Budget Limit">
          <i class="fa-solid fa-pen-to-square"></i>
        </button>
      </div>
      <div class="progress-container">
        <div class="progress-info">
          <span>Spent: <strong>${formatCurrency(spent)}</strong></span>
          <span>Budget Limit: <strong>${formatCurrency(limit)}</strong></span>
        </div>
        <div class="progress-bar-bg"><div class="progress-bar-fill ${fillClass}" style="width: ${Math.min(100, percent)}%;"></div></div>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderUserMasterTxsTable() {
  const tbody = document.getElementById('master-transactions-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const searchQuery = (document.getElementById('tx-search-input')?.value || '').toLowerCase().trim();
  const typeFilter = document.getElementById('tx-type-filter')?.value || 'all';
  const categoryFilter = document.getElementById('tx-category-filter')?.value || 'all';
  const monthFilter = document.getElementById('tx-month-filter')?.value || '';

  let filtered = db.transactions.filter(t => t.userId === activeSession.userId);

  if (searchQuery) filtered = filtered.filter(t => t.title.toLowerCase().includes(searchQuery) || t.category.toLowerCase().includes(searchQuery));
  if (typeFilter !== 'all') filtered = filtered.filter(t => t.type === typeFilter);
  if (categoryFilter !== 'all') filtered = filtered.filter(t => t.category === categoryFilter);
  if (monthFilter) filtered = filtered.filter(t => t.date && t.date.startsWith(monthFilter));

  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">No matching expenses found.</td></tr>`;
    return;
  }

  filtered.forEach(t => {
    const isIncome = t.type === 'income';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${t.date}</td>
      <td><span class="badge ${isIncome ? 'badge-success' : 'badge-danger'}">${isIncome ? 'Fund Deposit' : 'Trip Expense'}</span></td>
      <td><strong>${t.title}</strong></td>
      <td><i class="fa-solid ${CATEGORY_ICONS[t.category] || 'fa-tag'}"></i> ${t.category}</td>
      <td style="font-weight: 700; color: ${isIncome ? 'var(--color-success)' : 'var(--color-danger)'}">
        ${isIncome ? '+' : '-'}${formatCurrency(t.amount)}
      </td>
      <td>
        <button class="icon-btn btn-sm" onclick="deleteUserTransaction('${t.id}')">
          <i class="fa-solid fa-trash-can" style="color: var(--color-danger);"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderUserCharts() {
  const selectedMonth = document.getElementById('analytics-month-select')?.value || getCurrentYearMonthISO();
  const catExpenses = getUserCategoryExpenses(activeSession.userId);

  let highestCat = 'N/A';
  let maxSpent = 0;
  Object.keys(catExpenses).forEach(cat => {
    if (catExpenses[cat] > maxSpent) {
      maxSpent = catExpenses[cat];
      highestCat = cat;
    }
  });

  const userTxs = db.transactions.filter(t => t.userId === activeSession.userId && t.type === 'expense');
  document.getElementById('analytics-highest-category').textContent = `Highest Spending: ${highestCat} (${formatCurrency(maxSpent)})`;
  document.getElementById('analytics-transaction-count').textContent = `${userTxs.length} Logged Expenses`;

  const isDark = currentTheme === 'dark';
  const textColor = isDark ? '#f8fafc' : '#0f172a';

  // Dash Doughnut Chart
  const dashCanvas = document.getElementById('dashExpenseDoughnutChart');
  if (dashCanvas) {
    const labels = Object.keys(catExpenses).filter(c => catExpenses[c] > 0);
    const data = labels.map(c => catExpenses[c]);
    const bgColors = labels.map(c => CATEGORY_COLORS[c] || '#64748b');

    if (dashDoughnutChartInstance) dashDoughnutChartInstance.destroy();
    dashDoughnutChartInstance = new Chart(dashCanvas, {
      type: 'doughnut',
      data: {
        labels: labels.length > 0 ? labels : ['No Expenses'],
        datasets: [{ data: data.length > 0 ? data : [1], backgroundColor: bgColors.length > 0 ? bgColors : ['#cbd5e1'], borderWidth: 0 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: textColor } } } }
    });
  }

  // Analytics Pie Chart
  const analyticsDoughnutCanvas = document.getElementById('analyticsExpenseDoughnutChart');
  if (analyticsDoughnutCanvas) {
    const labels = Object.keys(catExpenses).filter(c => catExpenses[c] > 0);
    const data = labels.map(c => catExpenses[c]);
    const bgColors = labels.map(c => CATEGORY_COLORS[c] || '#64748b');

    if (analyticsDoughnutChartInstance) analyticsDoughnutChartInstance.destroy();
    analyticsDoughnutChartInstance = new Chart(analyticsDoughnutCanvas, {
      type: 'pie',
      data: {
        labels: labels.length > 0 ? labels : ['No Expenses'],
        datasets: [{ data: data.length > 0 ? data : [1], backgroundColor: bgColors.length > 0 ? bgColors : ['#cbd5e1'], borderWidth: 2, borderColor: isDark ? '#1e293b' : '#ffffff' }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: textColor } } } }
    });
  }

  // Daily Spending Timeline Bar Chart
  const spendingCanvas = document.getElementById('analyticsMonthlySpendingChart');
  if (spendingCanvas) {
    const dateMap = {};
    userTxs.forEach(t => {
      dateMap[t.date] = (dateMap[t.date] || 0) + Number(t.amount);
    });

    const sortedDates = Object.keys(dateMap).sort();
    const dateAmounts = sortedDates.map(d => dateMap[d]);

    if (analyticsMonthlyChartInstance) analyticsMonthlyChartInstance.destroy();
    analyticsMonthlyChartInstance = new Chart(spendingCanvas, {
      type: 'bar',
      data: {
        labels: sortedDates.length > 0 ? sortedDates : ['No Data'],
        datasets: [{ label: `Daily Expenses (${currentCurrency})`, data: dateAmounts.length > 0 ? dateAmounts : [0], backgroundColor: '#3b82f6', borderRadius: 6 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: textColor } },
          y: { ticks: { color: textColor } }
        },
        plugins: { legend: { labels: { color: textColor } } }
      }
    });
  }

  // Income vs Expense Comparison Chart
  const compCanvas = document.getElementById('analyticsIncomeVsExpenseChart');
  if (compCanvas) {
    const totals = getUserTotals(activeSession.userId);
    if (analyticsComparisonChartInstance) analyticsComparisonChartInstance.destroy();
    analyticsComparisonChartInstance = new Chart(compCanvas, {
      type: 'bar',
      data: {
        labels: ['Master Allocated Budget', 'Total Expenses Logged', 'Available Surplus'],
        datasets: [{
          label: `Financial Comparison (${currentCurrency})`,
          data: [totals.totalIncome, totals.totalExpenses, totals.remainingBalance],
          backgroundColor: ['#10b981', '#f43f5e', '#3b82f6'],
          borderRadius: 8
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: textColor } },
          y: { ticks: { color: textColor } }
        },
        plugins: { legend: { labels: { color: textColor } } }
      }
    });
  }
}

// --------------------------------------------------------------------------
// 8. ADMIN MODULE RENDERERS
// --------------------------------------------------------------------------
function renderAdminView() {
  const users = db.users;
  const activeCount = users.filter(u => u.status === 'active').length;
  const totalInc = db.transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const totalExp = db.transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const netBal = totalInc - totalExp;

  document.getElementById('admin-total-users').textContent = users.length;
  document.getElementById('admin-active-users').textContent = `${activeCount} active user(s)`;
  document.getElementById('admin-system-income').textContent = formatCurrency(totalInc);
  document.getElementById('admin-system-expenses').textContent = formatCurrency(totalExp);
  document.getElementById('admin-system-balance').textContent = formatCurrency(netBal);

  renderAdminUsersTable();
  renderAdminAllTxsTable();
  renderAdminAuditTable();
  renderAdminCharts();
}

function renderAdminUsersTable() {
  const tbody = document.getElementById('admin-users-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  db.users.forEach(u => {
    const userTxs = db.transactions.filter(t => t.userId === u.id);
    const spent = userTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="user-cell">
          <div class="user-avatar">${getInitials(u.name)}</div>
          <div><strong>${u.name}</strong></div>
        </div>
      </td>
      <td><code>${u.username}</code></td>
      <td><span class="badge ${u.role === 'admin' ? 'badge-admin' : 'badge-outline'}">${u.role}</span></td>
      <td><span class="badge ${u.status === 'active' ? 'badge-active' : 'badge-suspended'}">${u.status}</span></td>
      <td>${userTxs.length} items</td>
      <td style="font-weight: 700; color: var(--color-danger);">${formatCurrency(spent)}</td>
      <td>
        <div style="display:flex; gap: 0.35rem;">
          <button class="icon-btn btn-sm" onclick="toggleUserStatus('${u.id}')" title="${u.status === 'active' ? 'Suspend' : 'Activate'}">
            <i class="fa-solid ${u.status === 'active' ? 'fa-user-slash' : 'fa-user-check'}" style="color: var(--color-warning);"></i>
          </button>
          ${u.role !== 'admin' ? `
          <button class="icon-btn btn-sm" onclick="deleteUser('${u.id}')" title="Delete User">
            <i class="fa-solid fa-trash-can" style="color: var(--color-danger);"></i>
          </button>` : ''}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderAdminAllTxsTable() {
  const tbody = document.getElementById('admin-transactions-table-body');
  const userFilterSelect = document.getElementById('admin-tx-user-filter');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (userFilterSelect && userFilterSelect.options.length <= 1) {
    db.users.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = `${u.name} (${u.role})`;
      userFilterSelect.appendChild(opt);
    });
  }

  const searchQuery = (document.getElementById('admin-tx-search')?.value || '').toLowerCase().trim();
  const selectedUserId = userFilterSelect?.value || 'all';
  const typeFilter = document.getElementById('admin-tx-type-filter')?.value || 'all';

  let filtered = [...db.transactions];
  if (selectedUserId !== 'all') filtered = filtered.filter(t => t.userId === selectedUserId);
  if (typeFilter !== 'all') filtered = filtered.filter(t => t.type === typeFilter);
  if (searchQuery) filtered = filtered.filter(t => t.title.toLowerCase().includes(searchQuery) || t.category.toLowerCase().includes(searchQuery));

  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">No system transactions found.</td></tr>`;
    return;
  }

  filtered.forEach(t => {
    const owner = db.users.find(u => u.id === t.userId);
    const ownerName = owner ? owner.name : 'Unknown';
    const isIncome = t.type === 'income';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${ownerName}</strong></td>
      <td>${t.date}</td>
      <td><span class="badge ${isIncome ? 'badge-success' : 'badge-danger'}">${t.type}</span></td>
      <td>${t.title}</td>
      <td><i class="fa-solid ${CATEGORY_ICONS[t.category] || 'fa-tag'}"></i> ${t.category}</td>
      <td style="font-weight: 700; color: ${isIncome ? 'var(--color-success)' : 'var(--color-danger)'}">${formatCurrency(t.amount)}</td>
      <td>
        <button class="icon-btn btn-sm" onclick="adminDeleteTx('${t.id}')">
          <i class="fa-solid fa-trash-can" style="color: var(--color-danger);"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderAdminAuditTable() {
  const tbody = document.getElementById('admin-audit-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (db.auditLogs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">Audit log is empty.</td></tr>`;
    return;
  }

  db.auditLogs.forEach(log => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><small>${log.timestamp}</small></td>
      <td><span class="badge badge-admin">${log.action}</span></td>
      <td><strong>${log.performedBy}</strong></td>
      <td>${log.details}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderAdminCharts() {
  const isDark = currentTheme === 'dark';
  const textColor = isDark ? '#f8fafc' : '#0f172a';

  const catTotals = {};
  db.transactions.filter(t => t.type === 'expense').forEach(t => {
    catTotals[t.category] = (catTotals[t.category] || 0) + Number(t.amount);
  });

  const canvas1 = document.getElementById('adminSystemExpenseChart');
  if (canvas1) {
    const labels = Object.keys(catTotals);
    const data = labels.map(c => catTotals[c]);
    const bgColors = labels.map(c => CATEGORY_COLORS[c] || '#64748b');

    if (adminExpenseChartInstance) adminExpenseChartInstance.destroy();
    adminExpenseChartInstance = new Chart(canvas1, {
      type: 'doughnut',
      data: {
        labels: labels.length > 0 ? labels : ['No Data'],
        datasets: [{ data: data.length > 0 ? data : [1], backgroundColor: bgColors }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: textColor } } } }
    });
  }

  const canvas2 = document.getElementById('adminUserDistributionChart');
  if (canvas2) {
    const userNames = [];
    const userExpenses = [];

    db.users.forEach(u => {
      userNames.push(u.name);
      const exp = db.transactions.filter(t => t.userId === u.id && t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
      userExpenses.push(exp);
    });

    if (adminUserDistChartInstance) adminUserDistChartInstance.destroy();
    adminUserDistChartInstance = new Chart(canvas2, {
      type: 'bar',
      data: {
        labels: userNames,
        datasets: [{ label: `User Expenses (${currentCurrency})`, data: userExpenses, backgroundColor: 'rgba(139, 92, 246, 0.85)', borderRadius: 8 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: textColor } },
          y: { ticks: { color: textColor } }
        },
        plugins: { legend: { labels: { color: textColor } } }
      }
    });
  }
}

// --------------------------------------------------------------------------
// 9. ACTIONS & MUTATION ENGINE
// --------------------------------------------------------------------------
function deleteUserTransaction(id) {
  if (confirm('Delete this Europe trip expense record?')) {
    db.transactions = db.transactions.filter(t => t.id !== id);
    saveLocalStorage();
    updateUI();
    showToastAlert('Deleted', 'Expense record removed.', 'info');
  }
}

function deleteUserSavingsGoal(id) {
  if (confirm('Delete this European City Leg budget allocation?')) {
    db.savingsGoals = db.savingsGoals.filter(g => g.id !== id);
    saveLocalStorage();
    updateUI();
    showToastAlert('Leg Removed', 'City Leg allocation deleted.', 'info');
  }
}

function openDepositModal(goalId) {
  const goal = db.savingsGoals.find(g => g.id === goalId);
  if (!goal) return;
  document.getElementById('deposit-goal-id').value = goal.id;
  document.getElementById('deposit-goal-title').textContent = `City Leg: ${goal.title}`;
  document.getElementById('deposit-amount').value = '';
  openModal('deposit-modal');
}

function openEditBudgetModal(category) {
  const userBudgets = db.categoryBudgets[activeSession.userId] || {};
  document.getElementById('budget-category-key').value = category;
  document.getElementById('budget-category-label').textContent = `${category} Budget Limit (${currentCurrency})`;
  document.getElementById('budget-limit-input').value = userBudgets[category] || 0;
  openModal('edit-budget-modal');
}

function toggleUserStatus(userId) {
  const u = db.users.find(usr => usr.id === userId);
  if (u) {
    u.status = u.status === 'active' ? 'suspended' : 'active';
    logAuditEvent('User Status Updated', `Admin changed user "${u.username}" status to ${u.status}.`);
    saveLocalStorage();
    updateUI();
    showToastAlert('Status Updated', `Traveler ${u.name} is now ${u.status}.`, 'info');
  }
}

function deleteUser(userId) {
  const u = db.users.find(usr => usr.id === userId);
  if (u && confirm(`Permanently delete user ${u.name}? All user trip transactions will be deleted.`)) {
    db.users = db.users.filter(usr => usr.id !== userId);
    db.transactions = db.transactions.filter(t => t.userId !== userId);
    db.savingsGoals = db.savingsGoals.filter(g => g.userId !== userId);
    delete db.categoryBudgets[userId];
    logAuditEvent('User Deleted', `Admin deleted traveler account "${u.name}" (${userId}).`);
    saveLocalStorage();
    updateUI();
    showToastAlert('User Deleted', `Traveler ${u.name} removed from system.`, 'warning');
  }
}

function adminDeleteTx(txId) {
  if (confirm('Admin Delete: Remove transaction from system?')) {
    const tx = db.transactions.find(t => t.id === txId);
    db.transactions = db.transactions.filter(t => t.id !== txId);
    if (tx) logAuditEvent('Transaction Deleted', `Admin removed tx "${tx.title}" of amount ${tx.amount}.`);
    saveLocalStorage();
    updateUI();
    showToastAlert('Transaction Removed', 'System transaction deleted.', 'info');
  }
}

function exportTransactionsToCSV() {
  if (!activeSession) return;
  const userTxs = db.transactions.filter(t => t.userId === activeSession.userId);
  if (userTxs.length === 0) {
    showToastAlert('No Data', 'No expenses to export.', 'warning');
    return;
  }

  let csvContent = 'data:text/csv;charset=utf-8,ID,Date,Type,Description,Category,Amount\n';
  userTxs.forEach(t => {
    const row = [t.id, t.date, t.type, `"${t.title.replace(/"/g, '""')}"`, t.category, t.amount].join(',');
    csvContent += row + '\n';
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `Europe_Trip_Budget_Expenses_${activeSession.username}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToastAlert('Export Success', 'CSV Report downloaded successfully!', 'success');
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

function switchTab(tabId) {
  const isNav = activeSession.role === 'admin' ? '#admin-sidebar-nav' : '#user-sidebar-nav';
  document.querySelectorAll(`${isNav} .nav-item`).forEach(li => {
    if (li.dataset.tab === tabId) li.classList.add('active');
    else li.classList.remove('active');
  });

  document.querySelectorAll('.tab-panel').forEach(p => {
    if (p.id === `tab-${tabId}`) p.classList.add('active');
    else p.classList.remove('active');
  });

  closeMobileSidebar();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  updateUI();
}

function closeMobileSidebar() {
  document.getElementById('sidebar')?.classList.remove('active');
  document.getElementById('sidebar-overlay')?.classList.remove('active');
}

// --------------------------------------------------------------------------
// 10. INITIALIZATION & EVENT LISTENERS
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  loadLocalStorage();
  loadSessionStorage();

  const today = new Date().toISOString().split('T')[0];
  if (document.getElementById('inc-date')) document.getElementById('inc-date').value = today;
  if (document.getElementById('exp-date')) document.getElementById('exp-date').value = today;
  if (document.getElementById('goal-date')) document.getElementById('goal-date').value = `${new Date().getFullYear()}-08-15`;

  // Login Form Handler
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const role = document.getElementById('login-role').value;
      const username = document.getElementById('login-username').value.trim().toLowerCase();
      const password = document.getElementById('login-password').value;

      const userMatch = db.users.find(u => u.username.toLowerCase() === username && u.role === role);

      if (userMatch) {
        if (userMatch.status === 'suspended') {
          showToastAlert('Account Suspended', 'Your account has been suspended by system administrator.', 'danger');
          return;
        }
        activeSession = { userId: userMatch.id, name: userMatch.name, username: userMatch.username, role: userMatch.role };
        saveSessionStorage();
        logAuditEvent('User Login', `Traveler "${userMatch.username}" logged into ${role} module.`);
        updateUI();
        showToastAlert('Welcome to Europe Planner', `Logged in as ${userMatch.name} (${role.toUpperCase()})!`, 'success');
      } else {
        showToastAlert('Login Failed', 'Invalid credentials or portal selection. Try demo buttons below!', 'danger');
      }
    });
  }

  // Toggle Password Show/Hide
  const togglePassBtn = document.getElementById('toggle-password-btn');
  if (togglePassBtn) {
    togglePassBtn.addEventListener('click', () => {
      const passInput = document.getElementById('login-password');
      if (passInput) {
        const isPass = passInput.type === 'password';
        passInput.type = isPass ? 'text' : 'password';
        togglePassBtn.innerHTML = `<i class="fa-solid ${isPass ? 'fa-eye-slash' : 'fa-eye'}"></i>`;
      }
    });
  }

  // Quick Demo Login Handlers
  document.getElementById('demo-user-btn')?.addEventListener('click', () => {
    const alex = db.users.find(u => u.username === 'alex');
    if (alex) {
      activeSession = { userId: alex.id, name: alex.name, username: alex.username, role: alex.role };
      saveSessionStorage();
      updateUI();
      showToastAlert('Demo Traveler Mode', 'Logged in as Alex Morgan (Europe 15L Budget).', 'success');
    }
  });

  document.getElementById('demo-admin-btn')?.addEventListener('click', () => {
    const admin = db.users.find(u => u.username === 'admin');
    if (admin) {
      activeSession = { userId: admin.id, name: admin.name, username: admin.username, role: admin.role };
      saveSessionStorage();
      updateUI();
      showToastAlert('Demo Admin Mode', 'Logged in as System Administrator.', 'success');
    }
  });

  // Logout Handler
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    if (activeSession) logAuditEvent('User Logout', `Traveler "${activeSession.username}" logged out.`);
    activeSession = null;
    saveSessionStorage();
    updateUI();
    showToastAlert('Logged Out', 'Session ended.', 'info');
  });

  // Theme Toggle
  document.getElementById('theme-toggle-btn')?.addEventListener('click', () => {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    updateUI();
  });

  // Currency Toggle Button (Top Bar ₹ / € Switcher)
  document.getElementById('currency-toggle-btn')?.addEventListener('click', () => {
    if (currentCurrency === '₹') currentCurrency = '€';
    else if (currentCurrency === '€') currentCurrency = '$';
    else currentCurrency = '₹';

    const currSelect = document.getElementById('settings-currency');
    if (currSelect) currSelect.value = currentCurrency;

    updateUI();
    showToastAlert('Currency Changed', `Switched display currency to ${currentCurrency}`, 'info');
  });

  // Sidebar Nav Item Clicks
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab(item.dataset.tab);
    });
  });

  // Mobile Hamburger Menu
  document.getElementById('hamburger-btn')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.add('active');
    document.getElementById('sidebar-overlay')?.classList.add('active');
  });
  document.getElementById('close-sidebar-btn')?.addEventListener('click', closeMobileSidebar);
  document.getElementById('sidebar-overlay')?.addEventListener('click', closeMobileSidebar);

  // Forms: Quick Action Buttons & Tab Switchers
  document.getElementById('quick-add-income-btn')?.addEventListener('click', () => switchTab('income'));
  document.getElementById('quick-add-expense-btn')?.addEventListener('click', () => switchTab('expenses'));

  // Form: Add Income / Trip Fund
  document.getElementById('add-income-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('inc-source').value.trim();
    const amount = parseFloat(document.getElementById('inc-amount').value);
    const date = document.getElementById('inc-date').value;
    const category = document.getElementById('inc-category').value;

    if (title && amount > 0 && activeSession) {
      db.transactions.push({ id: 'tx-' + Date.now(), userId: activeSession.userId, type: 'income', title, amount, category, date });
      saveLocalStorage();
      e.target.reset();
      document.getElementById('inc-date').value = today;
      updateUI();
      showToastAlert('Fund Deposit Added', `Added ${formatCurrency(amount)} to trip budget.`, 'success');
    }
  });

  // Form: Add Expense
  document.getElementById('add-expense-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('exp-name').value.trim();
    const amount = parseFloat(document.getElementById('exp-amount').value);
    const date = document.getElementById('exp-date').value;
    const category = document.getElementById('exp-category').value;

    if (title && amount > 0 && activeSession) {
      db.transactions.push({ id: 'tx-' + Date.now(), userId: activeSession.userId, type: 'expense', title, amount, category, date });
      saveLocalStorage();
      e.target.reset();
      document.getElementById('exp-date').value = today;
      updateUI();
      showToastAlert('Expense Logged', `Recorded ${title} (${formatCurrency(amount)})`, 'info');
    }
  });

  // Form: City Leg Goal Modal
  document.getElementById('open-add-goal-modal-btn')?.addEventListener('click', () => openModal('add-goal-modal'));
  document.getElementById('add-goal-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('goal-name').value.trim();
    const targetAmount = parseFloat(document.getElementById('goal-target').value);
    const savedAmount = parseFloat(document.getElementById('goal-saved').value) || 0;
    const targetDate = document.getElementById('goal-date').value;

    if (title && targetAmount > 0 && activeSession) {
      db.savingsGoals.push({ id: 'goal-' + Date.now(), userId: activeSession.userId, title, targetAmount, savedAmount, targetDate });
      saveLocalStorage();
      closeModal('add-goal-modal');
      e.target.reset();
      updateUI();
      showToastAlert('City Leg Saved', `Leg "${title}" created.`, 'success');
    }
  });

  // Deposit Form
  document.getElementById('deposit-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const goalId = document.getElementById('deposit-goal-id').value;
    const amount = parseFloat(document.getElementById('deposit-amount').value);

    const goal = db.savingsGoals.find(g => g.id === goalId);
    if (goal && amount > 0) {
      goal.savedAmount += amount;
      saveLocalStorage();
      closeModal('deposit-modal');
      e.target.reset();
      updateUI();
      showToastAlert('Fund Allocated', `Added ${formatCurrency(amount)} to "${goal.title}"`, 'success');
    }
  });

  // Edit Category Budget Form
  document.getElementById('edit-budget-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const category = document.getElementById('budget-category-key').value;
    const limit = parseFloat(document.getElementById('budget-limit-input').value);

    if (category && !isNaN(limit) && activeSession) {
      if (!db.categoryBudgets[activeSession.userId]) db.categoryBudgets[activeSession.userId] = {};
      db.categoryBudgets[activeSession.userId][category] = limit;
      saveLocalStorage();
      closeModal('edit-budget-modal');
      updateUI();
      showToastAlert('Limit Updated', `${category} cap set to ${formatCurrency(limit)}`, 'success');
    }
  });

  // Export CSV Handler
  document.getElementById('export-csv-btn')?.addEventListener('click', exportTransactionsToCSV);
  document.getElementById('admin-export-csv-btn')?.addEventListener('click', exportTransactionsToCSV);

  // Settings Form
  document.getElementById('settings-profile-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const newName = document.getElementById('settings-user-name').value.trim();
    const newCurr = document.getElementById('settings-currency').value;
    const newMasterBudget = parseFloat(document.getElementById('settings-trip-budget').value);

    if (newName && activeSession) {
      activeSession.name = newName;
      currentCurrency = newCurr;
      const userObj = db.users.find(u => u.id === activeSession.userId);
      if (userObj) userObj.name = newName;

      if (!isNaN(newMasterBudget) && newMasterBudget > 0) {
        let masterTx = db.transactions.find(t => t.userId === activeSession.userId && t.type === 'income' && t.category === 'Trip Fund');
        if (masterTx) masterTx.amount = newMasterBudget;
      }

      saveLocalStorage();
      saveSessionStorage();
      updateUI();
      showToastAlert('Preferences Saved', 'Traveler profile & currency updated!', 'success');
    }
  });

  // Restore Default 15L Europe Data Button in Settings
  document.getElementById('reset-default-trip-btn')?.addEventListener('click', () => {
    if (confirm('Restore default 15 Lakhs Europe budget dataset?')) {
      const defaults = initDatabase();
      db = defaults;
      saveLocalStorage();
      updateUI();
      showToastAlert('Database Restored', '15 Lakhs Europe Trip default dataset loaded!', 'success');
    }
  });

  // Admin Create User Modal
  document.getElementById('admin-open-add-user-modal-btn')?.addEventListener('click', () => openModal('admin-add-user-modal'));
  document.getElementById('admin-add-user-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('new-user-name').value.trim();
    const username = document.getElementById('new-user-username').value.trim().toLowerCase();
    const password = document.getElementById('new-user-password').value;
    const role = document.getElementById('new-user-role').value;

    if (name && username) {
      const newUser = { id: 'usr-' + Date.now(), name, username, password, role, status: 'active', createdAt: today };
      db.users.push(newUser);
      db.categoryBudgets[newUser.id] = { Lodge: 400000, Flights: 300000, Food: 250000, Cabs: 150000, Entertainment: 150000, Sightseeing: 100000, 'Visa & Insurance': 50000, Shopping: 100000, Other: 100000 };
      logAuditEvent('Admin User Created', `Admin created new ${role} account "${username}".`);
      saveLocalStorage();
      closeModal('admin-add-user-modal');
      e.target.reset();
      updateUI();
      showToastAlert('Traveler Created', `Account ${name} created as ${role}.`, 'success');
    }
  });

  // Filters & Search
  ['tx-search-input', 'tx-type-filter', 'tx-category-filter', 'tx-month-filter'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', renderUserMasterTxsTable);
    document.getElementById(id)?.addEventListener('change', renderUserMasterTxsTable);
  });

  ['admin-tx-search', 'admin-tx-user-filter', 'admin-tx-type-filter'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', renderAdminAllTxsTable);
    document.getElementById(id)?.addEventListener('change', renderAdminAllTxsTable);
  });

  // Modal Close Buttons
  document.querySelectorAll('.close-modal-btn').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.modal));
  });

  // Admin Database Reset / Wipe
  document.getElementById('admin-reset-db-btn')?.addEventListener('click', () => {
    if (confirm('Reset localStorage database to default 15 Lakhs Europe trip dataset?')) {
      localStorage.clear();
      db = initDatabase();
      saveLocalStorage();
      logAuditEvent('Database Reset', 'Admin reset database to Europe Trip default dataset.');
      updateUI();
      showToastAlert('Database Restored', '15 Lakhs Europe Trip data restored.', 'info');
    }
  });

  document.getElementById('admin-wipe-db-btn')?.addEventListener('click', () => {
    if (confirm('DANGER: Wipe entire database from localStorage?')) {
      localStorage.clear();
      sessionStorage.clear();
      activeSession = null;
      db = { users: [], transactions: [], savingsGoals: [], categoryBudgets: {}, auditLogs: [] };
      updateUI();
      showToastAlert('Database Wiped', 'All localStorage records cleared.', 'warning');
    }
  });

  // Initial UI Render
  updateUI();
});
