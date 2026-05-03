// AI Employee Agent — app.js
// Handles: language, auth, owner dashboard, pricing, payment, progress, reviews, testimonials.

// =====================
// APP VERSION — bump this on every update to force re-login
// =====================
const APP_VERSION = '1.0';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// =====================
// LANGUAGE
// =====================
let currentLang = localStorage.getItem('lang') || 'de';

function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('lang', lang);
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-de]').forEach(el => {
    el.innerHTML = el.getAttribute(`data-${lang}`);
  });
  const ph = {
    de: { 'business-details': 'z.B. Wir sind ein kleines Beratungsunternehmen...', 'task-description': 'z.B. Sortiere meine E-Mails nach Dringlichkeit...', 'login-email': 'max@firma.de', 'signup-email': 'max@firma.de', 'signup-name': 'Max Mustermann', 'paypal-email': 'deine@paypal.com', 'bank-name': 'Max Mustermann', 'bank-iban': 'DE89 3704 0044 0532 0130 00', 'review-text': 'z.B. Sehr schnell und präzise! Würde ich weiterempfehlen.', 'review-name': 'Max M.' },
    en: { 'business-details': 'e.g. We are a small consulting firm...', 'task-description': 'e.g. Sort my emails by urgency...', 'login-email': 'john@company.com', 'signup-email': 'john@company.com', 'signup-name': 'John Smith', 'paypal-email': 'your@paypal.com', 'bank-name': 'John Smith', 'bank-iban': 'DE89 3704 0044 0532 0130 00', 'review-text': 'e.g. Very fast and accurate! Highly recommended.', 'review-name': 'John S.' }
  };
  Object.entries(ph[lang]).forEach(([id, text]) => { const el = document.getElementById(id); if (el) el.placeholder = text; });
  document.getElementById('btn-de').classList.toggle('active', lang === 'de');
  document.getElementById('btn-en').classList.toggle('active', lang === 'en');
  renderTestimonials();
}

// =====================
// USER AUTH
// =====================
let currentUser = null;

function getDeviceId() {
  let id = localStorage.getItem('ai_device_id');
  if (!id) { id = 'dev_' + Math.random().toString(36).slice(2) + Date.now(); localStorage.setItem('ai_device_id', id); }
  return id;
}

function updateActivity() {
  localStorage.setItem('ai_last_activity', Date.now().toString());
  localStorage.setItem('ai_last_device', getDeviceId());
  localStorage.setItem('ai_app_version', APP_VERSION);
}

function loadAuth() {
  const saved = localStorage.getItem('ai_agent_user');
  if (!saved) { showGuest(); return; }
  const lastActivity = parseInt(localStorage.getItem('ai_last_activity') || '0');
  const lastDevice = localStorage.getItem('ai_last_device');
  const lastVersion = localStorage.getItem('ai_app_version');
  const inactiveTooLong = Date.now() - lastActivity > SEVEN_DAYS_MS;
  const differentDevice = lastDevice && lastDevice !== getDeviceId();
  const newUpdate = lastVersion !== APP_VERSION;
  if (newUpdate || inactiveTooLong || differentDevice) {
    // Session expired/outdated — clear it, show landing page with Login button
    localStorage.removeItem('ai_agent_user');
    showGuest();
  } else {
    currentUser = JSON.parse(saved);
    if (currentUser.email === OWNER_EMAIL) currentUser.isOwner = true;
    showLoggedIn();
  }
}

function showAuthModal(reason) {
  const box = document.getElementById('auth-reason');
  if (reason === 'update') { box.style.display = 'block'; box.textContent = currentLang === 'de' ? `🚀 Neues Update (v${APP_VERSION}). Bitte erneut anmelden.` : `🚀 New update (v${APP_VERSION}). Please log in again.`; }
  else if (reason === 'inactive') { box.style.display = 'block'; box.textContent = currentLang === 'de' ? '⏰ 7+ Tage inaktiv. Bitte erneut anmelden.' : '⏰ Inactive for 7+ days. Please log in again.'; }
  else if (reason === 'device') { box.style.display = 'block'; box.textContent = currentLang === 'de' ? '💻 Neues Gerät erkannt. Bitte bestätigen.' : '💻 New device detected. Please confirm.'; }
  else { box.style.display = 'none'; }
  document.getElementById('auth-overlay').classList.remove('hidden');
}

function hideAuthModal() {
  document.getElementById('auth-overlay').classList.add('hidden');
  if (window._pendingAction) {
    const fn = window._pendingAction;
    window._pendingAction = null;
    setTimeout(fn, 100);
  }
}

function switchTab(tab) {
  document.getElementById('form-login').style.display = tab === 'login' ? 'flex' : 'none';
  document.getElementById('form-signup').style.display = tab === 'signup' ? 'flex' : 'none';
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-signup').classList.toggle('active', tab === 'signup');
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const remember = document.getElementById('remember-me').checked;

  // Check if this is the owner account (password verified via SHA-256 hash)
  if (email === OWNER_EMAIL) {
    const ok = await checkOwnerPassword(password);
    if (ok) {
      currentUser = { name: 'Mark', email: OWNER_EMAIL, isOwner: true };
      if (remember) localStorage.setItem('ai_agent_user', JSON.stringify(currentUser));
      updateActivity();
      hideAuthModal();
      showLoggedIn();
      return;
    }
  }

  // Regular user login
  const users = JSON.parse(localStorage.getItem('ai_agent_users') || '[]');
  const user = users.find(u => u.email === email && u.password === password);
  if (!user) { document.getElementById('login-error').textContent = currentLang === 'de' ? 'E-Mail oder Passwort falsch.' : 'Incorrect email or password.'; return; }
  currentUser = { name: user.name, email: user.email };
  if (remember) localStorage.setItem('ai_agent_user', JSON.stringify(currentUser));
  updateActivity();
  hideAuthModal();
  showLoggedIn();
}

function handleSignup(e) {
  e.preventDefault();
  const name = document.getElementById('signup-name').value;
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  const users = JSON.parse(localStorage.getItem('ai_agent_users') || '[]');
  if (users.find(u => u.email === email)) { document.getElementById('signup-error').textContent = currentLang === 'de' ? 'E-Mail bereits registriert.' : 'Email already registered.'; return; }
  users.push({ name, email, password });
  localStorage.setItem('ai_agent_users', JSON.stringify(users));
  currentUser = { name, email };
  localStorage.setItem('ai_agent_user', JSON.stringify(currentUser));
  updateActivity();
  hideAuthModal();
  showLoggedIn();
}

function acceptCookies() {
  document.getElementById('cookie-overlay').style.display = 'none';
  loadAuth();
}

function toggleCookieDetails() {
  const panel = document.getElementById('cookie-details-panel');
  const label = document.getElementById('cookie-details-label');
  const open  = panel.style.display === 'none';
  panel.style.display = open ? 'block' : 'none';
  label.textContent   = open ? '▾ Details ausblenden' : '▸ Details zu den verwendeten Cookies anzeigen';
}

function showGuest() {
  document.getElementById('btn-header-login').style.display  = 'inline-block';
  document.getElementById('btn-header-signup').style.display = 'inline-block';
  document.getElementById('btn-logout').style.display        = 'none';
  document.getElementById('btn-my-tasks').style.display      = 'none';
  document.getElementById('btn-my-account').style.display    = 'none';
  document.getElementById('btn-owner-panel').style.display   = 'none';
  document.getElementById('header-username').textContent     = '';
}

function showLoggedIn() {
  document.getElementById('header-username').textContent = currentLang === 'de' ? `Hallo, ${currentUser.name}` : `Hello, ${currentUser.name}`;
  document.getElementById('btn-logout').style.display        = 'inline-block';
  document.getElementById('btn-my-tasks').style.display      = 'inline-block';
  document.getElementById('btn-header-login').style.display  = 'none';
  document.getElementById('btn-header-signup').style.display = 'none';
  const isVerifiedOwner = currentUser.email === OWNER_EMAIL;
  document.getElementById('btn-owner-panel').style.display  = isVerifiedOwner ? 'inline-block' : 'none';
  document.getElementById('btn-my-account').style.display   = isVerifiedOwner ? 'none' : 'inline-block';
  renderTestimonials();
}

function requireLogin(action) {
  if (currentUser) { action(); return; }
  showAuthModal(null);
  // after login, run the pending action once
  window._pendingAction = action;
}

function handleLogout() {
  if (currentUser) {
    // Clear all user-specific data on logout (#10)
    ['ai_payment_', 'ai_tasks_', 'ai_sales_'].forEach(prefix => {
      localStorage.removeItem(prefix + currentUser.email);
    });
  }
  localStorage.removeItem('ai_agent_user');
  currentUser = null;
  document.getElementById('header-username').textContent = '';
  document.getElementById('btn-logout').style.display = 'none';
  document.getElementById('btn-my-tasks').style.display = 'none';
  showAuthModal(null);
}

// =====================
// MY TASKS PANEL
// =====================
function toggleMyTasks() {
  const panel = document.getElementById('my-tasks-panel');
  if (panel.style.display === 'none' || !panel.style.display) { panel.style.display = 'block'; renderTaskHistory(); }
  else { panel.style.display = 'none'; }
}
function openMyTasks() { document.getElementById('my-tasks-panel').style.display = 'block'; renderTaskHistory(); }
function closeMyTasks() { document.getElementById('my-tasks-panel').style.display = 'none'; }
// =====================
// ACCOUNT SETTINGS
// =====================
function openAccount() {
  document.getElementById('account-overlay').classList.remove('hidden');
  document.getElementById('account-name').value = currentUser?.name || '';
  document.getElementById('account-email').value = currentUser?.email || '';
  document.getElementById('account-password-old').value = '';
  document.getElementById('account-password-new').value = '';
  ['account-name-msg','account-email-msg','account-password-msg'].forEach(id => { document.getElementById(id).style.display = 'none'; });
}
function closeAccount() { document.getElementById('account-overlay').classList.add('hidden'); }

function saveAccountName() {
  const name = document.getElementById('account-name').value.trim();
  if (!name) return;
  const users = JSON.parse(localStorage.getItem('ai_agent_users') || '[]');
  const idx = users.findIndex(u => u.email === currentUser.email);
  if (idx !== -1) { users[idx].name = name; localStorage.setItem('ai_agent_users', JSON.stringify(users)); }
  currentUser.name = name;
  localStorage.setItem('ai_agent_user', JSON.stringify(currentUser));
  document.getElementById('header-username').textContent = currentLang === 'de' ? `Hallo, ${name}` : `Hello, ${name}`;
  const msg = document.getElementById('account-name-msg');
  msg.textContent = currentLang === 'de' ? '✓ Name gespeichert!' : '✓ Name saved!';
  msg.style.color = '#10b981'; msg.style.display = 'block';
  setTimeout(() => { msg.style.display = 'none'; }, 2500);
}

function saveAccountEmail() {
  const newEmail = document.getElementById('account-email').value.trim();
  const msg = document.getElementById('account-email-msg');
  if (!newEmail || newEmail === currentUser.email) return;
  const users = JSON.parse(localStorage.getItem('ai_agent_users') || '[]');
  if (users.find(u => u.email === newEmail)) {
    msg.textContent = currentLang === 'de' ? '❌ E-Mail bereits vergeben.' : '❌ Email already taken.';
    msg.style.color = '#ef4444'; msg.style.display = 'block'; return;
  }
  const idx = users.findIndex(u => u.email === currentUser.email);
  if (idx !== -1) {
    const tasks = localStorage.getItem(`ai_tasks_${currentUser.email}`);
    if (tasks) { localStorage.setItem(`ai_tasks_${newEmail}`, tasks); localStorage.removeItem(`ai_tasks_${currentUser.email}`); }
    const payment = localStorage.getItem(`ai_payment_${currentUser.email}`);
    if (payment) { localStorage.setItem(`ai_payment_${newEmail}`, payment); localStorage.removeItem(`ai_payment_${currentUser.email}`); }
    users[idx].email = newEmail;
    localStorage.setItem('ai_agent_users', JSON.stringify(users));
  }
  currentUser.email = newEmail;
  localStorage.setItem('ai_agent_user', JSON.stringify(currentUser));
  msg.textContent = currentLang === 'de' ? '✓ E-Mail gespeichert!' : '✓ Email saved!';
  msg.style.color = '#10b981'; msg.style.display = 'block';
  setTimeout(() => { msg.style.display = 'none'; }, 2500);
}

function saveAccountPassword() {
  const oldPw = document.getElementById('account-password-old').value;
  const newPw = document.getElementById('account-password-new').value;
  const msg = document.getElementById('account-password-msg');
  const users = JSON.parse(localStorage.getItem('ai_agent_users') || '[]');
  const idx = users.findIndex(u => u.email === currentUser.email);
  if (idx === -1) return;
  if (users[idx].password !== oldPw) {
    msg.textContent = currentLang === 'de' ? '❌ Aktuelles Passwort falsch.' : '❌ Current password incorrect.';
    msg.style.color = '#ef4444'; msg.style.display = 'block'; return;
  }
  if (newPw.length < 8) {
    msg.textContent = currentLang === 'de' ? '❌ Neues Passwort muss mindestens 8 Zeichen haben.' : '❌ New password must be at least 8 characters.';
    msg.style.color = '#ef4444'; msg.style.display = 'block'; return;
  }
  users[idx].password = newPw;
  localStorage.setItem('ai_agent_users', JSON.stringify(users));
  msg.textContent = currentLang === 'de' ? '✓ Passwort geändert!' : '✓ Password changed!';
  msg.style.color = '#10b981'; msg.style.display = 'block';
  document.getElementById('account-password-old').value = '';
  document.getElementById('account-password-new').value = '';
  setTimeout(() => { msg.style.display = 'none'; }, 2500);
}

function getTaskHistory() { return JSON.parse(localStorage.getItem(`ai_tasks_${currentUser?.email}`) || '[]'); }
function saveTaskToHistory(description, price) {
  if (!currentUser) return;
  const tasks = getTaskHistory();
  tasks.push({ description: description.slice(0, 60) + (description.length > 60 ? '...' : ''), date: new Date().toLocaleDateString(currentLang === 'de' ? 'de-DE' : 'en-GB'), price: `€${price}` });
  localStorage.setItem(`ai_tasks_${currentUser.email}`, JSON.stringify(tasks));
}
function renderTaskHistory() {
  const tasks = getTaskHistory();
  const c = document.getElementById('tasks-list');
  if (!tasks.length) { c.innerHTML = `<p class="no-tasks">${currentLang === 'de' ? 'Noch keine Aufgaben.' : 'No tasks yet.'}</p>`; return; }
  c.innerHTML = tasks.slice().reverse().map(t => `<div class="task-history-item"><div><div class="task-desc">${t.description}</div><div class="task-date">${t.date}</div></div><div class="task-price">${t.price}</div></div>`).join('');
}

// =====================
// OWNER CREDENTIALS — password stored as SHA-256 hash, never in plaintext
// =====================
const OWNER_EMAIL = 'm.greinert30@gmail.com';
const OWNER_HASH  = 'fe40170f1db7f798f76c1129880d842287e19476a1d8570bbe03e7e28e9a7f4b';

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

async function checkOwnerPassword(pw) {
  const hash = await sha256(pw);
  return hash === (localStorage.getItem('ai_owner_hash') || OWNER_HASH);
}

function openOwnerDashboard() {
  document.getElementById('owner-dashboard-overlay').classList.remove('hidden');
  ownerTab('overview');
  loadOwnerPaypal();
  loadBrandColorsIntoUI();
}

function closeOwnerDashboard() { document.getElementById('owner-dashboard-overlay').classList.add('hidden'); }
function handleOwnerLogout() { closeOwnerDashboard(); }

function ownerTab(tab) {
  ['overview', 'reviews', 'settings'].forEach(t => {
    document.getElementById(`owner-tab-${t}`).style.display = t === tab ? 'block' : 'none';
    document.getElementById(`otab-${t}`).classList.toggle('active', t === tab);
  });
  if (tab === 'overview') renderOwnerOverview();
  if (tab === 'reviews') renderOwnerReviews();
}

// =====================
// OWNER OVERVIEW (SALES DATA)
// =====================
function getSalesData() { return JSON.parse(localStorage.getItem('ai_sales') || '[]'); }

function saveSale(description, price, paymentMethod) {
  const sales = getSalesData();
  sales.push({ description: description.slice(0, 50), price: parseFloat(price), method: paymentMethod, date: new Date().toISOString(), month: new Date().toISOString().slice(0, 7) });
  localStorage.setItem('ai_sales', JSON.stringify(sales));
}

function renderOwnerOverview() {
  const sales = getSalesData();
  const users = JSON.parse(localStorage.getItem('ai_agent_users') || '[]');
  const thisMonth = new Date().toISOString().slice(0, 7);
  const totalRevenue = sales.reduce((s, t) => s + t.price, 0);
  const monthRevenue = sales.filter(t => t.month === thisMonth).reduce((s, t) => s + t.price, 0);

  document.getElementById('stat-total-sales').textContent = sales.length;
  document.getElementById('stat-total-revenue').textContent = `€${totalRevenue.toFixed(2)}`;
  document.getElementById('stat-month-revenue').textContent = `€${monthRevenue.toFixed(2)}`;
  document.getElementById('stat-total-users').textContent = users.length;

  const container = document.getElementById('recent-transactions');
  if (!sales.length) { container.innerHTML = `<p class="empty-state">${currentLang === 'de' ? 'Noch keine Transaktionen.' : 'No transactions yet.'}</p>`; return; }
  container.innerHTML = sales.slice().reverse().slice(0, 10).map(t => `
    <div class="transaction-item">
      <div><div class="transaction-desc">${t.description}</div><div class="transaction-date">${new Date(t.date).toLocaleDateString(currentLang === 'de' ? 'de-DE' : 'en-GB')} · ${t.method}</div></div>
      <div class="transaction-amount">+€${t.price.toFixed(2)}</div>
    </div>`).join('');
}

// =====================
// OWNER — PAYPAL SETTINGS
// =====================
function loadOwnerPaypal() {
  const saved = localStorage.getItem('ai_owner_paypal') || '';
  document.getElementById('owner-paypal-input').value = saved;
}

function savePaypalSettings() {
  const val = document.getElementById('owner-paypal-input').value.trim();
  localStorage.setItem('ai_owner_paypal', val);
  const msg = document.getElementById('paypal-saved-msg');
  msg.style.display = 'block';
  setTimeout(() => { msg.style.display = 'none'; }, 2500);
}

function saveOwnerPassword() {
  const pw = document.getElementById('new-owner-password').value;
  if (!pw || pw.length < 4) return;
  localStorage.setItem('ai_owner_password', pw);
  const msg = document.getElementById('password-saved-msg');
  msg.style.display = 'block';
  setTimeout(() => { msg.style.display = 'none'; }, 2500);
}

function getOwnerPaypalUsername() { return localStorage.getItem('ai_owner_paypal') || ''; }

// =====================
// REVIEWS SYSTEM
// =====================
let selectedStars = 0;

function setStars(val) {
  selectedStars = val;
  document.querySelectorAll('.star').forEach((s, i) => s.classList.toggle('active', i < val));
}

function submitReview() {
  if (!selectedStars) { alert(currentLang === 'de' ? 'Bitte wähle eine Sternebewertung.' : 'Please select a star rating.'); return; }
  const text = document.getElementById('review-text').value.trim();
  const name = document.getElementById('review-name').value.trim() || (currentLang === 'de' ? 'Anonym' : 'Anonymous');
  // #4 Feedback-Lernen: save improvement note
  const improvement = document.getElementById('improvement-text')?.value?.trim();
  if (improvement) saveFeedbackToLearning(improvement);
  const reviews = getAllReviews();
  reviews.push({ id: Date.now(), name, text, stars: selectedStars, date: new Date().toISOString(), featured: false, hidden: false });
  localStorage.setItem('ai_reviews', JSON.stringify(reviews));
  showStep('step-review-done');
  renderTestimonials();
}

// =====================
// #4 FEEDBACK-LERNEN
// =====================
function saveFeedbackToLearning(text) {
  if (!text || text.trim().length < 5) return;
  const notes = JSON.parse(localStorage.getItem('ai_improvement_notes') || '[]');
  notes.push(text.trim().slice(0, 300));
  if (notes.length > 5) notes.shift();
  localStorage.setItem('ai_improvement_notes', JSON.stringify(notes));
}

function getLearningContext(isDE) {
  const notes = JSON.parse(localStorage.getItem('ai_improvement_notes') || '[]');
  if (!notes.length) return '';
  return (isDE
    ? '\nNUTZER-PRÄFERENZEN (aus früherem Feedback — bitte berücksichtigen):\n'
    : '\nUSER PREFERENCES (from previous feedback — please apply):\n')
    + notes.map(n => `- ${n}`).join('\n') + '\n';
}

// =====================
// #5 MULTI-STEP (Task Chaining)
// =====================
let lastCompletedTaskType = null;

function updateChainButtons(taskType) {
  const de = currentLang === 'de';
  const labels = {
    reply: {
      shorten:   de ? '📝 E-Mail kürzer fassen'  : '📝 Shorten email',
      translate: de ? '🌍 E-Mail übersetzen'      : '🌍 Translate email',
      report:    de ? '📊 Als Bericht'            : '📊 As Report',
      bullets:   de ? '• Stichpunkte'             : '• Bullet points',
    },
    email: {
      shorten:   de ? '📝 Zusammenfassung kürzen' : '📝 Shorten summary',
      translate: de ? '🌍 Übersetzen'             : '🌍 Translate',
      report:    de ? '📊 Als Bericht'            : '📊 As Report',
      bullets:   de ? '• Stichpunkte'             : '• Bullet points',
    },
    pdf: {
      shorten:   de ? '📝 Analyse kürzen'         : '📝 Shorten analysis',
      translate: de ? '🌍 Analyse übersetzen'     : '🌍 Translate analysis',
      report:    de ? '📊 Als Bericht'            : '📊 As Report',
      bullets:   de ? '• Stichpunkte'             : '• Bullet points',
    },
    document: {
      shorten:   de ? '📝 Dokument kürzen'        : '📝 Shorten document',
      translate: de ? '🌍 Dokument übersetzen'    : '🌍 Translate document',
      report:    de ? '📊 Als Bericht'            : '📊 As Report',
      bullets:   de ? '• Stichpunkte'             : '• Bullet points',
    },
    report: {
      shorten:   de ? '📝 Bericht kürzen'         : '📝 Shorten report',
      translate: de ? '🌍 Bericht übersetzen'     : '🌍 Translate report',
      report:    de ? '📊 Als Bericht'            : '📊 As Report',
      bullets:   de ? '• Stichpunkte'             : '• Bullet points',
    },
  };
  const set = labels[taskType] || labels.report;
  const b = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  b('chain-btn-shorten',   set.shorten);
  b('chain-btn-translate', set.translate);
  b('chain-btn-report',    set.report);
  b('chain-btn-bullets',   set.bullets);
  const lp = document.getElementById('lang-picker');
  if (lp) lp.style.display = 'none';
}

function showLangPicker() {
  const lp = document.getElementById('lang-picker');
  if (lp) lp.style.display = lp.style.display === 'none' ? 'block' : 'none';
}

function chainTranslate(language) {
  document.getElementById('lang-picker').style.display = 'none';
  const de = currentLang === 'de';
  const taskType = lastCompletedTaskType || 'report';
  const contextWord = {
    reply: de ? 'E-Mail' : 'email',
    pdf: de ? 'Analyse' : 'analysis',
    document: de ? 'Dokument' : 'document',
    report: de ? 'Bericht' : 'report',
    email: de ? 'Text' : 'text',
  }[taskType] || (de ? 'Text' : 'text');
  const prefix = de
    ? `Übersetze folgenden ${contextWord} vollständig und professionell ins ${language}e. Behalte Struktur und Formatierung bei:\n\n`
    : `Translate the following ${contextWord} completely and professionally into ${language}. Keep the structure and formatting:\n\n`;
  runChain(prefix);
}

function chainTask(type) {
  const de = currentLang === 'de';
  const taskType = lastCompletedTaskType || 'report';
  const contextWord = {
    reply: de ? 'E-Mail' : 'email',
    pdf: de ? 'Analyse' : 'analysis',
    document: de ? 'Dokument' : 'document',
    report: de ? 'Bericht' : 'report',
    email: de ? 'Text' : 'text',
  }[taskType] || (de ? 'Text' : 'text');

  const instructions = {
    shorten: de
      ? `Fasse folgende ${contextWord} in 50% kürzer zusammen — alle wichtigen Punkte behalten, Füllsätze entfernen. Gib nur die gekürzte ${contextWord} aus, kein Kommentar:\n\n`
      : `Summarise the following ${contextWord} in 50% shorter — keep all key points, remove filler. Output only the shortened ${contextWord}, no commentary:\n\n`,
    report: de
      ? `Erstelle aus folgendem ${contextWord}-Inhalt einen professionellen Bericht mit Executive Summary, Haupterkenntnissen und Handlungsempfehlungen:\n\n`
      : `Create a professional report with executive summary, key findings and recommendations from the following ${contextWord} content:\n\n`,
    bullets: de
      ? `Forme folgende ${contextWord} in prägnante, klar strukturierte Stichpunkte um — kein Fließtext:\n\n`
      : `Convert the following ${contextWord} into concise, clearly structured bullet points — no prose:\n\n`,
  };
  const prefix = instructions[type] || instructions.shorten;
  runChain(prefix);
}

async function runChain(prefix) {
  const de = currentLang === 'de';
  const rawText = currentResult
    ? (currentResult.replace ? currentResult.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : String(currentResult))
    : '';
  if (!rawText || rawText.length < 20) {
    alert(de ? 'Kein Textinhalt zum Weiterverarbeiten verfügbar.' : 'No text content available to process.');
    return;
  }
  const input = rawText.slice(0, 6000);
  const prompt = prefix + input;

  showStep('step-progress');
  document.querySelector('.agent-icon').textContent = getCharacterEmoji();
  setProgress(20, de ? 'KI verarbeitet...' : 'AI processing...');

  try {
    setProgress(55, de ? 'KI schreibt Ergebnis...' : 'AI writing result...');
    const res = await fetchWithTimeout('/api/analyse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    currentResult = data.result || '';
  } catch (err) {
    currentResult = (de ? '⚠️ Fehler: ' : '⚠️ Error: ') + err.message;
  }

  setProgress(100, de ? 'Fertig!' : 'Done!');
  updateChainButtons(lastCompletedTaskType);
  showStep('step-result');
  renderResultRich(currentResult);
}

// =====================
// #7 ZEITPLAN + #3 PROAKTIVITÄT
// =====================
const SCHEDULE_KEY = 'ai_scheduled_tasks';

function calcNextRun(frequency) {
  const d = new Date();
  if (frequency === 'daily')   { d.setDate(d.getDate() + 1); }
  else if (frequency === 'weekly')  { d.setDate(d.getDate() + 7); }
  else if (frequency === 'monthly') { d.setMonth(d.getMonth() + 1); d.setDate(1); }
  d.setHours(8, 0, 0, 0);
  return d.getTime();
}

function scheduleCurrentTask(frequency) {
  const taskDesc = document.getElementById('task-description')?.value || '';
  if (!taskDesc.trim()) return;
  const tasks = JSON.parse(localStorage.getItem(SCHEDULE_KEY) || '[]');
  tasks.push({
    id: Date.now().toString(36),
    task: taskDesc,
    frequency,
    analysisLength: window.selectedAnalysisLength || 'medium',
    nextRun: calcNextRun(frequency),
    created: Date.now()
  });
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(tasks));
  if ('Notification' in window) Notification.requestPermission();
  const labels = { de: { daily:'Täglich', weekly:'Wöchentlich', monthly:'Monatlich' }, en: { daily:'Daily', weekly:'Weekly', monthly:'Monthly' } };
  const lbl = labels[currentLang][frequency];
  const el = document.getElementById('schedule-confirm');
  if (el) {
    el.style.display = 'block';
    el.textContent = currentLang === 'de'
      ? `✅ Aufgabe geplant: ${lbl} — nächste Ausführung ${new Date(calcNextRun(frequency)).toLocaleDateString('de-DE')}`
      : `✅ Task scheduled: ${lbl} — next run ${new Date(calcNextRun(frequency)).toLocaleDateString('en-GB')}`;
  }
}

function checkDueTasks() {
  const tasks = JSON.parse(localStorage.getItem(SCHEDULE_KEY) || '[]');
  const now = Date.now();
  const due = tasks.filter(t => t.nextRun <= now);
  if (!due.length) return;
  const task = due[0];
  const banner = document.getElementById('due-task-banner');
  const textEl = document.getElementById('due-task-text');
  if (banner && textEl) {
    textEl.textContent = `"${task.task.slice(0, 70)}${task.task.length > 70 ? '…' : ''}"`;
    banner.style.display = 'flex';
    window._duePendingTask = task;
  }
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('AI Employee Agent', {
      body: (currentLang === 'de' ? 'Geplante Aufgabe bereit: ' : 'Scheduled task ready: ') + task.task.slice(0, 60),
    });
  }
}

function startDueTask() {
  const task = window._duePendingTask;
  if (!task) return;
  // Update nextRun
  const tasks = JSON.parse(localStorage.getItem(SCHEDULE_KEY) || '[]');
  const idx = tasks.findIndex(t => t.id === task.id);
  if (idx >= 0) tasks[idx].nextRun = calcNextRun(tasks[idx].frequency);
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(tasks));
  document.getElementById('due-task-banner').style.display = 'none';
  window._duePendingTask = null;
  showPage('services');
  document.getElementById('task-description').value = task.task;
  window.selectedAnalysisLength = task.analysisLength || 'medium';
}

function dismissDueBanner() {
  document.getElementById('due-task-banner').style.display = 'none';
}

// =====================
// #6 GOOGLE CALENDAR
// =====================
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

function connectCalendar() {
  const btn = document.getElementById('calendar-connect-btn');
  const status = document.getElementById('calendar-status');
  btn.disabled = true;
  btn.textContent = currentLang === 'de' ? '⏳ Verbinde...' : '⏳ Connecting...';

  if (typeof google === 'undefined' || !google.accounts) {
    status.textContent = currentLang === 'de' ? 'Google-Bibliothek lädt — bitte Seite neu laden.' : 'Google library loading — please reload.';
    status.style.display = 'block';
    btn.disabled = false; btn.textContent = '📅 Mit Google Kalender verbinden';
    return;
  }

  const client = google.accounts.oauth2.initTokenClient({
    client_id: GMAIL_CLIENT_ID,
    scope: CALENDAR_SCOPE,
    callback: async (response) => {
      if (response.error) {
        status.textContent = 'Fehler: ' + response.error;
        status.style.display = 'block';
        btn.disabled = false; btn.textContent = '📅 Mit Google Kalender verbinden';
        return;
      }
      btn.textContent = currentLang === 'de' ? '✓ Verbunden — Analysiere Termine...' : '✓ Connected — Analysing events...';
      status.style.display = 'none';
      await startCalendarTask(response.access_token);
    }
  });
  client.requestAccessToken();
}

async function fetchCalendarEvents(token) {
  const now = new Date().toISOString();
  const future = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now}&timeMax=${future}&maxResults=100&singleEvents=true&orderBy=startTime`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  return (data.items || []).map(e => {
    const start = e.start?.dateTime || e.start?.date || '';
    const end   = e.end?.dateTime   || e.end?.date   || '';
    return `Termin: ${e.summary || '(kein Titel)'}\nStart: ${start}\nEnde: ${end}\nOrt: ${e.location || '—'}\nBeschreibung: ${e.description?.slice(0,100) || '—'}`;
  });
}

async function startCalendarTask(token) {
  showStep('step-progress');
  document.querySelector('.agent-icon').textContent = getCharacterEmoji();
  const name = getCharacterName();
  const de = currentLang === 'de';

  setProgress(10, de ? `${name} liest deinen Kalender...` : `${name} reading your calendar...`);
  let events = [];
  try { events = await fetchCalendarEvents(token); } catch (err) {
    currentResult = (de ? 'Fehler beim Lesen des Kalenders: ' : 'Error reading calendar: ') + err.message;
    setProgress(100, 'Fertig.'); showStep('step-result');
    document.getElementById('result-content').textContent = currentResult;
    return;
  }

  setProgress(50, de ? `KI analysiert ${events.length} Termine...` : `AI analysing ${events.length} events...`);
  const prompt = de
    ? `Analysiere die folgenden ${events.length} Kalendertermine der nächsten 14 Tage. Identifiziere: Terminkonzflikte, Termine die Vorbereitung brauchen, Lücken für fokussierte Arbeit, empfohlene Prioritäten. Antworte strukturiert mit konkreten Empfehlungen.\n\nTermine:\n${events.join('\n\n---\n\n')}`
    : `Analyse the following ${events.length} calendar events for the next 14 days. Identify: scheduling conflicts, events needing preparation, gaps for focused work, recommended priorities. Respond structured with concrete recommendations.\n\nEvents:\n${events.join('\n\n---\n\n')}`;

  try {
    setProgress(75, de ? 'KI analysiert...' : 'AI analysing...');
    const res = await fetchWithTimeout('/api/analyse', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ prompt }) });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    currentResult = data.result;
  } catch (err) {
    currentResult = (de ? '⚠️ Fehler: ' : '⚠️ Error: ') + err.message;
  }

  setProgress(100, de ? 'Fertig!' : 'Done!');
  showStep('step-result');
  document.getElementById('result-content').textContent = currentResult;
}

function skipReview() { showStep('step-review-done'); }
function goToFeedback() { selectedStars = 0; document.querySelectorAll('.star').forEach(s => s.classList.remove('active')); showStep('step-feedback'); }

function getAllReviews() { return JSON.parse(localStorage.getItem('ai_reviews') || '[]'); }

function getFeaturedReviews() { return getAllReviews().filter(r => r.featured && !r.hidden).slice(0, 6); }

function renderTestimonials() {
  const featured = getFeaturedReviews();
  const grid = document.getElementById('testimonials-grid');
  const noMsg = document.getElementById('no-reviews-msg');
  if (!featured.length) { grid.innerHTML = ''; if (noMsg) { noMsg.style.display = 'block'; grid.appendChild(noMsg); } return; }
  if (noMsg) noMsg.style.display = 'none';
  grid.innerHTML = featured.map(r => `
    <div class="testimonial-card">
      <div class="testimonial-stars">${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)}</div>
      <p class="testimonial-text">"${r.text || (currentLang === 'de' ? 'Toller Service!' : 'Great service!')}"</p>
      <div class="testimonial-name">— ${r.name}</div>
    </div>`).join('');
}

// =====================
// OWNER — MANAGE REVIEWS
// =====================
function renderOwnerReviews() {
  const reviews = getAllReviews().filter(r => !r.hidden);
  const container = document.getElementById('owner-reviews-list');
  const featuredCount = reviews.filter(r => r.featured).length;
  if (!reviews.length) { container.innerHTML = `<p class="empty-state">${currentLang === 'de' ? 'Noch keine Bewertungen.' : 'No reviews yet.'}</p>`; return; }
  container.innerHTML = reviews.slice().reverse().map(r => `
    <div class="owner-review-card">
      <div class="owner-review-top">
        <span class="owner-review-name">${r.name}</span>
        <span class="owner-review-stars">${'★'.repeat(r.stars)}</span>
      </div>
      <p class="owner-review-text">${r.text || '(kein Kommentar)'}</p>
      <div class="owner-review-actions">
        <button class="btn-feature ${r.featured ? 'active' : ''}" onclick="toggleFeature(${r.id})" ${!r.featured && featuredCount >= 6 ? 'disabled title="Max. 6 featured"' : ''}>
          ${r.featured ? '⭐ ' + (currentLang === 'de' ? 'Auf Startseite' : 'On home page') : '☆ ' + (currentLang === 'de' ? 'Zeigen' : 'Feature')}
        </button>
        <button class="btn-hide-review" onclick="hideReview(${r.id})">${currentLang === 'de' ? 'Ausblenden' : 'Hide'}</button>
      </div>
    </div>`).join('');
}

function toggleFeature(id) {
  const reviews = getAllReviews();
  const idx = reviews.findIndex(r => r.id === id);
  if (idx === -1) return;
  const featuredCount = reviews.filter(r => r.featured && !r.hidden).length;
  if (!reviews[idx].featured && featuredCount >= 6) { alert(currentLang === 'de' ? 'Maximal 6 Bewertungen können angezeigt werden.' : 'Maximum 6 reviews can be featured.'); return; }
  reviews[idx].featured = !reviews[idx].featured;
  localStorage.setItem('ai_reviews', JSON.stringify(reviews));
  renderOwnerReviews();
  renderTestimonials();
}

function hideReview(id) {
  const reviews = getAllReviews();
  const idx = reviews.findIndex(r => r.id === id);
  if (idx === -1) return;
  reviews[idx].hidden = true;
  reviews[idx].featured = false;
  localStorage.setItem('ai_reviews', JSON.stringify(reviews));
  renderOwnerReviews();
  renderTestimonials();
}

// =====================
// CHARACTER SELECTION
// =====================
let selectedCharacter = localStorage.getItem('ai_character') || 'male';

function selectCharacter(type, fromInit = false) {
  if (!currentUser && !fromInit) { requireLogin(() => selectCharacter(type)); return; }
  selectedCharacter = type;
  if (currentUser) localStorage.setItem('ai_character', type);

  document.getElementById('char-male').classList.toggle('selected', type === 'male');
  document.getElementById('char-female').classList.toggle('selected', type === 'female');
  document.getElementById('badge-male').style.display = type === 'male' ? 'block' : 'none';
  document.getElementById('badge-female').style.display = type === 'female' ? 'block' : 'none';

  const btnMale = document.getElementById('charbtn-male');
  const btnFemale = document.getElementById('charbtn-female');
  btnMale.textContent = type === 'male' ? (currentLang === 'de' ? '✓ Alex ausgewählt' : '✓ Alex selected') : (currentLang === 'de' ? 'Alex wählen' : 'Choose Alex');
  btnFemale.textContent = type === 'female' ? (currentLang === 'de' ? '✓ Emma ausgewählt' : '✓ Emma selected') : (currentLang === 'de' ? 'Emma wählen' : 'Choose Emma');
  updateMiniCharButtons();
}

function getCharacterEmoji() { return selectedCharacter === 'female' ? '👩‍💼' : '👨‍💼'; }
function getCharacterName() { return selectedCharacter === 'female' ? 'Emma' : 'Alex'; }

function initCharacterSelection() {
  selectCharacter(selectedCharacter, true); // fromInit — skip login gate
}

// =====================
// GMAIL INTEGRATION
// =====================
const GMAIL_CLIENT_ID = '81791575409-uff7u3p59b2nk13d4ogqrg9oo7q4oq8g.apps.googleusercontent.com';
let gmailAccessToken = null;
let gmailWasUsed = false;
let currentShortcutType = null;

function connectGmail() {
  const btn = document.getElementById('gmail-connect-btn');
  const status = document.getElementById('gmail-status');
  btn.disabled = true;
  btn.textContent = currentLang === 'de' ? '⏳ Verbinde...' : '⏳ Connecting...';

  if (typeof google === 'undefined' || !google.accounts) {
    status.textContent = currentLang === 'de' ? 'Google-Bibliothek lädt noch — bitte Seite neu laden.' : 'Google library still loading — please reload the page.';
    status.style.display = 'block';
    btn.disabled = false;
    btn.textContent = '🔗 Mit Google verbinden';
    return;
  }

  const client = google.accounts.oauth2.initTokenClient({
    client_id: GMAIL_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/gmail.modify',
    callback: async (response) => {
      if (response.error) {
        status.textContent = (currentLang === 'de' ? 'Fehler: ' : 'Error: ') + response.error;
        status.style.display = 'block';
        btn.disabled = false;
        btn.textContent = '🔗 Mit Google verbinden';
        return;
      }
      gmailAccessToken = response.access_token;
      gmailWasUsed = true;
      btn.textContent = currentLang === 'de' ? '✓ Verbunden — Analyse startet...' : '✓ Connected — Starting analysis...';
      status.style.display = 'none';
      await startGmailTask();
    }
  });
  client.requestAccessToken();
}

// #8 — Reusable fetch with timeout
async function fetchWithTimeout(url, options = {}, ms = 30000) {
  const controller = new AbortController();
  const id = setTimeout(() => {
    controller.abort(new DOMException('Zeitüberschreitung — die Analyse hat zu lange gedauert. Bitte versuche es mit einem kürzeren Dokument oder wähle "Kurz" als Analysetiefe.', 'TimeoutError'));
  }, ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function fetchGmailEmails(token) {
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${emailCount}&q=is:inbox%20is:unread`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const listData = await listRes.json();
  const messages = listData.messages || [];

  const emails = [];
  const toFetch = messages.slice(0, emailCount);
  let fetchErrors = 0; // #7 — track silent failures
  for (let i = 0; i < toFetch.length; i++) {
    const msg = toFetch[i];
    try {
      const controller = new AbortController(); // #8 — timeout
      const timeout = setTimeout(() => controller.abort(), 8000);
      const r = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal }
      );
      clearTimeout(timeout);
      const d = await r.json();
      const h = d.payload?.headers || [];
      emails.push({
        id: msg.id,
        from:    h.find(x => x.name === 'From')?.value    || '',
        subject: h.find(x => x.name === 'Subject')?.value || '(kein Betreff)',
        date:    h.find(x => x.name === 'Date')?.value    || ''
      });
      if (i > 0 && i % 50 === 0) await delay(300);
    } catch (_) { fetchErrors++; }
  }
  if (fetchErrors > 0) console.warn(`Gmail: ${fetchErrors} E-Mails konnten nicht geladen werden`);
  emails._fetchErrors = fetchErrors; // attach for later use
  return emails;
}

async function getOrCreateLabel(token, name) {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  const existing = (data.labels || []).find(l => l.name === name);
  if (existing) return existing.id;
  const createRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, labelListVisibility: 'labelShow', messageListVisibility: 'show' })
  });
  const created = await createRes.json();
  return created.id;
}

async function applyLabel(token, messageId, labelId) {
  await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ addLabelIds: [labelId] })
  });
}

async function startGmailTask() {
  showStep('step-progress');
  document.querySelector('.agent-icon').textContent = getCharacterEmoji();
  const name = getCharacterName();
  const de = currentLang === 'de';

  setProgress(5,  de ? `${name} verbindet sich mit Gmail...` : `${name} connecting to Gmail...`);
  await delay(600);
  setProgress(15, de ? `${name} lädt bis zu ${emailCount} E-Mails...` : `${name} loading up to ${emailCount} emails...`);

  let emails = [];
  try { emails = await fetchGmailEmails(gmailAccessToken); } catch (err) {
    currentResult = (de ? 'Fehler beim Lesen der E-Mails: ' : 'Error reading emails: ') + err.message;
    setProgress(100, de ? 'Fertig.' : 'Done.');
    showStep('step-result');
    document.getElementById('result-content').textContent = currentResult;
    gmailAccessToken = null;
    return;
  }

  setProgress(40, de ? `${name} analysiert ${emails.length} E-Mails...` : `${name} analysing ${emails.length} emails...`);

  function keywordCategorize(batch) {
    const urgentWords = ['dringend','urgent','sofort','fällig','deadline','asap','wichtig','kritisch'];
    const spamWords = ['newsletter','rabatt','sale','promo','werb','abmelden','angebot','sonderangebot','unsubscribe'];
    return batch.map(e => {
      const text = (e.from + ' ' + e.subject).toLowerCase();
      if (spamWords.some(w => text.includes(w))) return { id: e.id, kategorie: 'INFO' };
      if (urgentWords.some(w => text.includes(w))) return { id: e.id, kategorie: 'DRINGEND' };
      return { id: e.id, kategorie: 'WICHTIG' };
    });
  }

  async function categorizeBatch(batch, totalEmails) {
    const emailList = batch.map(e => `[ID:${e.id}] Von: ${e.from} | Betreff: ${e.subject}`).join('\n');
    const prompt = `Du analysierst einen Teil von insgesamt ${totalEmails} E-Mails (Nutzer hat ${totalEmails} E-Mails zur Sortierung ausgewählt).
Kategorisiere jede dieser ${batch.length} E-Mails. Antworte NUR mit einem JSON-Array, kein Text davor oder danach.
Kategorien: DRINGEND, WICHTIG, NIEDRIG, INFO
Format: [{"id":"MESSAGE_ID","kategorie":"KATEGORIE"}]

E-Mails:
${emailList}`;
    try {
      const res = await fetch('/api/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      let data;
      try { data = await res.json(); } catch (_) { return keywordCategorize(batch); }
      if (data.error || !data.result) return keywordCategorize(batch);
      const jsonMatch = data.result.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return keywordCategorize(batch);
      return JSON.parse(jsonMatch[0]);
    } catch (_) {
      return keywordCategorize(batch);
    }
  }

  let categorized = [];
  setProgress(60, de ? 'KI kategorisiert E-Mails...' : 'AI categorising emails...');
  const batchSize = 100;
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(emails.length / batchSize);
    setProgress(60 + Math.round((i / emails.length) * 15),
      de ? `KI kategorisiert Batch ${batchNum}/${totalBatches}...` : `AI categorising batch ${batchNum}/${totalBatches}...`);
    const result = await categorizeBatch(batch, emails.length);
    categorized = categorized.concat(result);
    if (i + batchSize < emails.length) await delay(500);
  }

  setProgress(75, de ? `${name} erstellt Labels in Gmail...` : `${name} creating labels in Gmail...`);

  // Create parent label first — Gmail requires parent to exist before children
  try { await getOrCreateLabel(gmailAccessToken, 'KI-Sortierung'); } catch (e) {
    console.error('Parent label error:', e);
  }
  const categories = ['DRINGEND', 'WICHTIG', 'NIEDRIG', 'INFO'];
  const labelPrefix = 'KI-Sortierung/';
  const labelIds = {};
  for (const cat of categories) {
    try {
      labelIds[cat] = await getOrCreateLabel(gmailAccessToken, labelPrefix + cat);
    } catch (e) {
      console.error(`Label error for ${cat}:`, e);
    }
  }

  const noLabels = Object.values(labelIds).every(v => !v);
  if (noLabels) {
    currentResult = de
      ? '⚠️ Gmail Labels konnten nicht erstellt werden. Bitte prüfe die Gmail-Berechtigungen und versuche es erneut.'
      : '⚠️ Gmail labels could not be created. Please check Gmail permissions and try again.';
    setProgress(100, de ? 'Fehler.' : 'Error.');
    showStep('step-result');
    document.getElementById('result-content').innerHTML = `<div style="text-align:center;padding:20px;color:#ef4444;font-size:15px;">⚠️ ${de ? 'Labels konnten nicht in Gmail erstellt werden.<br><br>Bitte stelle sicher dass du die Gmail-Berechtigung vollständig erteilt hast, und versuche es erneut.' : 'Labels could not be created in Gmail.<br><br>Please ensure you granted full Gmail permission and try again.'}</div>`;
    gmailAccessToken = null;
    return;
  }

  setProgress(88, de ? `${name} sortiert E-Mails in Gmail...` : `${name} sorting emails in Gmail...`);

  const counts = { DRINGEND: 0, WICHTIG: 0, NIEDRIG: 0, INFO: 0 };
  for (const item of categorized) {
    const labelId = labelIds[item.kategorie];
    if (labelId && item.id) {
      try { await applyLabel(gmailAccessToken, item.id, labelId); counts[item.kategorie]++; } catch (e) {
        console.error('applyLabel error:', e);
      }
    }
  }

  gmailAccessToken = null;
  setProgress(100, de ? 'Fertig!' : 'Done!');

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  currentResult = de
    ? `${total} E-Mails sortiert — DRINGEND: ${counts.DRINGEND} | WICHTIG: ${counts.WICHTIG} | NIEDRIG: ${counts.NIEDRIG} | INFO: ${counts.INFO}`
    : `${total} emails sorted — URGENT: ${counts.DRINGEND} | IMPORTANT: ${counts.WICHTIG} | LOW: ${counts.NIEDRIG} | INFO: ${counts.INFO}`;

  const cats = de
    ? [
        { label: 'DRINGEND',  count: counts.DRINGEND, color: '#ef4444', bg: '#fef2f2', desc: 'Sofort bearbeiten' },
        { label: 'WICHTIG',   count: counts.WICHTIG,  color: '#f59e0b', bg: '#fffbeb', desc: 'Diese Woche' },
        { label: 'NIEDRIG',   count: counts.NIEDRIG,  color: '#22c55e', bg: '#f0fdf4', desc: 'Wenn Zeit vorhanden' },
        { label: 'INFO',      count: counts.INFO,     color: '#3b82f6', bg: '#eff6ff', desc: 'Zur Kenntnisnahme' },
      ]
    : [
        { label: 'URGENT',    count: counts.DRINGEND, color: '#ef4444', bg: '#fef2f2', desc: 'Act immediately' },
        { label: 'IMPORTANT', count: counts.WICHTIG,  color: '#f59e0b', bg: '#fffbeb', desc: 'This week' },
        { label: 'LOW',       count: counts.NIEDRIG,  color: '#22c55e', bg: '#f0fdf4', desc: 'When time allows' },
        { label: 'INFO',      count: counts.INFO,     color: '#3b82f6', bg: '#eff6ff', desc: 'For your info' },
      ];

  const resultHTML = `
    <div style="text-align:center;margin-bottom:20px;">
      <div style="font-size:40px;margin-bottom:8px;">✅</div>
      <h2 style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 4px;">${total} ${de ? 'E-Mails sortiert' : 'Emails sorted'}</h2>
      <p style="font-size:13px;color:#64748b;margin:0;">${de ? 'Labels in Gmail erstellt unter "KI-Sortierung"' : 'Labels created in Gmail under "KI-Sortierung"'}</p>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
      ${cats.map(c => `
        <div style="background:${c.bg};border:1.5px solid ${c.color}22;border-radius:12px;padding:16px;text-align:center;">
          <div style="font-size:28px;font-weight:800;color:${c.color};line-height:1;">${c.count}</div>
          <div style="font-size:12px;font-weight:700;color:${c.color};margin:4px 0 2px;letter-spacing:0.5px;">${c.label}</div>
          <div style="font-size:11px;color:#64748b;">${c.desc}</div>
        </div>`).join('')}
    </div>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;font-size:13px;color:#475569;text-align:center;">
      📂 ${de ? 'Gmail öffnen → linke Seite → Label' : 'Open Gmail → left sidebar → label'} <strong>"KI-Sortierung"</strong> ${de ? '→ deine sortierten E-Mails' : '→ your sorted emails'}
    </div>`;

  lastCompletedTaskType = 'email';
  updateChainButtons('email');
  showStep('step-result');
  document.getElementById('result-content').innerHTML = resultHTML;
}

// =====================
// MICROSOFT / OUTLOOK INTEGRATION
// =====================

function getMicrosoftClientId() {
  return localStorage.getItem('ms_client_id') || '';
}

function saveMicrosoftClientId() {
  const id = document.getElementById('owner-ms-client-id').value.trim();
  if (!id || id.length < 10) return;
  localStorage.setItem('ms_client_id', id);
  const el = document.getElementById('ms-client-id-status');
  el.style.display = 'block';
  el.style.color = '#4ade80';
  el.textContent = '✓ Microsoft App ID gespeichert!';
  document.getElementById('owner-ms-client-id').value = '';
}

let outlookAccessToken = null;

async function connectOutlook() {
  const clientId = getMicrosoftClientId();
  if (!clientId) {
    alert(currentLang === 'de'
      ? 'Bitte zuerst die Microsoft App-ID im Owner Panel eintragen.'
      : 'Please enter your Microsoft App ID in Owner Panel first.');
    return;
  }

  const btn = document.getElementById('outlook-connect-btn');
  btn.disabled = true;
  btn.textContent = currentLang === 'de' ? '⏳ Verbinde...' : '⏳ Connecting...';

  try {
    const msalApp = new msal.PublicClientApplication({
      auth: {
        clientId,
        authority: 'https://login.microsoftonline.com/common',
        redirectUri: window.location.origin
      },
      cache: { cacheLocation: 'sessionStorage' }
    });
    await msalApp.initialize();

    const response = await msalApp.loginPopup({
      scopes: ['Mail.Read', 'Mail.ReadWrite']
    });

    const tokenResponse = await msalApp.acquireTokenSilent({
      scopes: ['Mail.Read', 'Mail.ReadWrite'],
      account: response.account
    });

    outlookAccessToken = tokenResponse.accessToken;
    btn.textContent = currentLang === 'de' ? '✓ Verbunden — Analyse startet...' : '✓ Connected — Starting...';
    await startOutlookTask();
  } catch (err) {
    btn.disabled = false;
    btn.textContent = currentLang === 'de' ? '📨 Mit Microsoft verbinden' : '📨 Connect with Microsoft';
    const status = document.getElementById('outlook-status');
    status.style.display = 'block';
    status.textContent = 'Fehler: ' + err.message;
  }
}

async function fetchOutlookEmails() {
  const res = await fetch(
    'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=50&$select=id,subject,from,receivedDateTime,isRead&$filter=isRead eq false&$orderby=receivedDateTime desc',
    { headers: { Authorization: `Bearer ${outlookAccessToken}` } }
  );
  if (!res.ok) throw new Error('Outlook API error: ' + res.status);
  const data = await res.json();
  return (data.value || []).map(m => ({
    id: m.id,
    subject: m.subject || '(kein Betreff)',
    from: m.from?.emailAddress?.address || '',
    date: m.receivedDateTime?.slice(0, 10) || ''
  }));
}

async function startOutlookTask() {
  showStep('step-progress');
  document.querySelector('.agent-icon').textContent = getCharacterEmoji();
  const de = currentLang === 'de';
  const name = getCharacterName();

  setProgress(10, de ? `${name} verbindet sich mit Outlook...` : `${name} connecting to Outlook...`);

  let emails = [];
  try {
    emails = await fetchOutlookEmails();
  } catch (err) {
    currentResult = (de ? 'Fehler beim Lesen der Outlook-E-Mails: ' : 'Error reading Outlook emails: ') + err.message;
    setProgress(100, de ? 'Fertig.' : 'Done.');
    showStep('step-result');
    document.getElementById('result-content').textContent = currentResult;
    return;
  }

  if (!emails.length) {
    currentResult = de ? 'Keine ungelesenen E-Mails im Posteingang gefunden.' : 'No unread emails found in inbox.';
    setProgress(100, de ? 'Fertig.' : 'Done.');
    showStep('step-result');
    document.getElementById('result-content').innerHTML = `<p>${currentResult}</p>`;
    return;
  }

  setProgress(40, de ? `${name} analysiert ${emails.length} Outlook-E-Mails...` : `${name} analysing ${emails.length} Outlook emails...`);

  const emailList = emails.map((e, i) => `${i+1}. Von: ${e.from} | Betreff: ${e.subject} | Datum: ${e.date}`).join('\n');
  const prompt = de
    ? `Analysiere folgende ${emails.length} Outlook-E-Mails. Kategorisiere sie nach: Dringend, Wichtig, Newsletter, Spam, Sonstiges. Gib für jede E-Mail eine konkrete Empfehlung.\n\nE-Mails:\n${emailList}`
    : `Analyse these ${emails.length} Outlook emails. Categorise them as: Urgent, Important, Newsletter, Spam, Other. Give a concrete recommendation for each.\n\nEmails:\n${emailList}`;

  startProgressAnimation(40, 95, 30000, de ? 'KI kategorisiert Outlook-E-Mails...' : 'AI categorising Outlook emails...');

  try {
    const res = await fetchWithTimeout('/api/analyse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    currentResult = data.result;
  } catch (err) {
    currentResult = (de ? 'Fehler bei der KI-Analyse: ' : 'AI analysis error: ') + err.message;
  }

  stopProgressAnimation();
  setProgress(100, de ? 'Fertig!' : 'Done!');
  showStep('step-result');
  document.getElementById('result-content').innerHTML = marked.parse ? marked.parse(currentResult) : currentResult;
  outlookAccessToken = null;
}

// =====================
// PRICING
// Max €5 per task. Fair, transparent, length-based.
// Compared to ChatGPT Plus (~€20/month ÷ ~30 uses = €0.67/use for general access)
// Our service is specialized, higher quality, pay-per-use — €0.99–€4.99 is very competitive.
// =====================
const TASK_PRICES = {
  pdf:      { short: 0.99, medium: 1.99, long: 3.99 },
  email:    { short: 0.99, medium: 1.49, long: 2.49 },
  report:   { short: 1.49, medium: 2.49, long: 4.49 },
  reply:    { short: 0.99, medium: 1.99, long: 2.99 },
  document: { short: 1.49, medium: 2.99, long: 4.99 }
};
const TASK_TIMES = {
  pdf:      { short: 1, medium: 2, long: 4 },
  email:    { short: 2, medium: 3, long: 5 },
  report:   { short: 2, medium: 3, long: 5 },
  reply:    { short: 1, medium: 2, long: 3 },
  document: { short: 2, medium: 4, long: 6 }
};

function detectTaskType(description) {
  const d = description.toLowerCase();
  if (d.includes('pdf') || d.includes('analysier') || d.includes('analyse')) return 'pdf';
  if (d.includes('email') || d.includes('mail') || d.includes('postfach') || d.includes('inbox')) return 'email';
  if (d.includes('bericht') || d.includes('report') || d.includes('summary') || d.includes('zusammenfassung')) return 'report';
  if (d.includes('antwort') || d.includes('reply') || d.includes('respond')) return 'reply';
  if (d.includes('dokument') || d.includes('document') || d.includes('schreib') || d.includes('write')) return 'document';
  return 'report';
}

function estimateTask(description) {
  const depth = window.selectedAnalysisLength || 'medium';
  const type = currentShortcutType || detectTaskType(description);
  if (type === 'email') {
    // Email: price/time determined by emailCount, not depth
    const emailTiers = {
      200:  { price: 0.99, minutes: 2, depth: 'short'  },
      500:  { price: 1.99, minutes: 4, depth: 'medium' },
      1000: { price: 2.99, minutes: 6, depth: 'long'   },
    };
    const tier = emailTiers[emailCount] || emailTiers[200];
    return { minutes: tier.minutes, price: tier.price, type, depth: tier.depth };
  }
  const price = TASK_PRICES[type][depth];
  const minutes = TASK_TIMES[type][depth];
  return { minutes, price, type, depth };
}

// =====================
// TASK STATE
// =====================
let currentEstimate = null;
let currentResult = null;
let selectedPaymentMethod = null;
let uploadedPDFs = [];

// =====================
// TASK SHORTCUTS
// =====================
// ── Service selector button helpers ──────────────────────────────
const SERVICE_META = {
  icons:  { pdf: '📄', email: '📧', report: '📊', reply: '✉️', document: '📝' },
  labels: {
    de: { pdf: 'PDF analysieren', email: 'E-Mails sortieren', report: 'Bericht erstellen', reply: 'E-Mail schreiben', document: 'Dokument erstellen' },
    en: { pdf: 'Analyse PDF',     email: 'Sort Emails',       report: 'Create Report',    reply: 'Write Email',        document: 'Create Document' }
  },
  depthDescs: {
    de: {
      analyse: { short: 'Kernaussagen & wichtige Punkte', medium: 'Ausgewogene Analyse mit Details', long: 'Umfassende Analyse mit tiefen Einblicken' },
      create:  { short: 'Kompaktes, präzises Ergebnis',   medium: 'Ausgewogenes, vollständiges Dokument', long: 'Ausführliches, tiefes Ergebnis' }
    },
    en: {
      analyse: { short: 'Key findings & important points', medium: 'Balanced analysis with details', long: 'Comprehensive analysis with deep insights' },
      create:  { short: 'Compact, precise result',         medium: 'Balanced, complete document',      long: 'Extensive, in-depth result' }
    }
  }
};

function syncServiceBtn(type) {
  const iconEl = document.getElementById('form-service-icon');
  const nameEl = document.getElementById('form-service-name');
  if (iconEl) iconEl.textContent = SERVICE_META.icons[type] || '🛠️';
  if (nameEl) nameEl.textContent = (SERVICE_META.labels[currentLang] || SERVICE_META.labels.de)[type] || type;
  const mode = (type === 'document' || type === 'reply' || type === 'report') ? 'create' : 'analyse';
  const dd = (SERVICE_META.depthDescs[currentLang] || SERVICE_META.depthDescs.de)[mode];
  const s = document.getElementById('dco-short-desc');
  const m = document.getElementById('dco-medium-desc');
  const l = document.getElementById('dco-long-desc');
  if (s) s.textContent = dd.short;
  if (m) m.textContent = dd.medium;
  if (l) l.textContent = dd.long;

  // Upload context hint
  const hint = document.getElementById('upload-context-hint');
  const hintText = document.getElementById('upload-hint-text');
  const uploadLabel = document.getElementById('upload-main-label');
  const de = currentLang === 'de';
  const hints = {
    de: {
      reply:    'Optional: Lade ein Dokument hoch, damit die KI genau versteht, worum es geht — z.B. ein Vertrag, eine Rechnung oder ein Angebot. Die KI liest es als Hintergrundinformation. Das Dokument wird <strong>nicht</strong> in die E-Mail eingefügt.',
      pdf:      null,
      email:    null,
      report:   'Optional: Lade Dokumente hoch, die als Grundlage für den Bericht dienen sollen (z.B. Rohdaten, Notizen, Vorberichte).',
      document: 'Optional: Lade eine Vorlage oder ein Referenzdokument hoch, an dem sich die KI orientieren soll.'
    },
    en: {
      reply:    'Optional: Upload a document so the AI understands the exact context — e.g. a contract, invoice, or quote. The AI reads it as background info only. The document will <strong>not</strong> be attached to the email.',
      pdf:      null,
      email:    null,
      report:   'Optional: Upload documents to use as the basis for the report (e.g. raw data, notes, previous reports).',
      document: 'Optional: Upload a template or reference document for the AI to follow.'
    }
  };
  const msg = (hints[de ? 'de' : 'en'] || hints.de)[type];
  if (hint && hintText) {
    if (msg) { hintText.innerHTML = msg; hint.style.display = 'flex'; }
    else { hint.style.display = 'none'; }
  }
  if (uploadLabel) {
    uploadLabel.setAttribute('data-de', type === 'reply' ? 'Dokument hochladen (optional — nur als KI-Kontext)' : 'PDFs oder Bilder hier ablegen oder klicken');
    uploadLabel.setAttribute('data-en', type === 'reply' ? 'Upload document (optional — AI context only)' : 'Drop PDFs or images here or click');
    uploadLabel.innerHTML = de
      ? uploadLabel.getAttribute('data-de')
      : uploadLabel.getAttribute('data-en');
  }

  // KI quality hint
  const qualityHint = document.getElementById('service-quality-hint');
  if (qualityHint) {
    const qualityTexts = {
      de: {
        pdf:      '🎓 Die KI ist auf professionelle Dokumentenanalysen spezialisiert — sie erkennt Strukturen, Kennzahlen und Handlungsfelder wie ein erfahrener Berater.',
        email:    '🎓 Die KI analysiert und priorisiert E-Mails auf dem Niveau einer erfahrenen Assistenz — strukturiert, schnell und präzise.',
        report:   '🎓 Die KI ist darauf trainiert, Geschäftsberichte auf Agentur-Niveau zu erstellen — mit Executive Summary, Kennzahlen und konkreten Empfehlungen.',
        reply:    '🎓 Die KI schreibt professionelle Business-E-Mails, die sofort versendbar sind — klar, überzeugend und auf den Punkt.',
        document: '🎓 Die KI erstellt strukturierte Geschäftsdokumente auf professionellem Niveau — bereit für den Einsatz im Unternehmen.',
      },
      en: {
        pdf:      '🎓 The AI specialises in professional document analysis — identifying structures, KPIs and action points like an experienced consultant.',
        email:    '🎓 The AI analyses and prioritises emails at the level of an experienced assistant — structured, fast and precise.',
        report:   '🎓 The AI is trained to produce agency-level business reports — with executive summaries, KPIs and concrete recommendations.',
        reply:    '🎓 The AI writes professional business emails ready to send immediately — clear, persuasive and to the point.',
        document: '🎓 The AI creates structured business documents at a professional level — ready for use in your company.',
      }
    };
    qualityHint.textContent = (qualityTexts[de ? 'de' : 'en'] || qualityTexts.de)[type] || '';
  }
}

function toggleServiceDropdown() {
  const dd = document.getElementById('form-service-dropdown');
  if (dd) dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
}

function closeServiceDropdown() {
  const dd = document.getElementById('form-service-dropdown');
  if (dd) dd.style.display = 'none';
}

// Close dropdown when clicking outside
document.addEventListener('click', e => {
  if (!e.target.closest('#form-service-btn') && !e.target.closest('#form-service-dropdown')) {
    closeServiceDropdown();
  }
});

function selectShortcut(type) {
  if (!currentUser) { requireLogin(() => selectShortcut(type)); return; }
  currentShortcutType = type;
  const descriptions = {
    de: {
      pdf:      'Analysiere die hochgeladenen PDF-Dateien vollständig und erstelle einen professionellen Bericht mit den wichtigsten Erkenntnissen, Zusammenfassung und Handlungsempfehlungen.',
      email:    'Sortiere meine E-Mails nach Dringlichkeit (DRINGEND, WICHTIG, NIEDRIG, SPAM), schreibe eine kurze Zusammenfassung und verfasse Entwürfe für dringende Antworten.',
      report:   'Erstelle einen professionellen Geschäftsbericht mit Executive Summary, wichtigsten Erkenntnissen und empfohlenen nächsten Schritten.',
      reply:    '',
      document: 'Erstelle ein professionelles, gut strukturiertes Dokument mit klaren Überschriften und Abschnitten.'
    },
    en: {
      pdf:      'Fully analyse the uploaded PDF files and create a professional report with the key findings, summary, and recommended actions.',
      email:    'Sort my emails by urgency (URGENT, IMPORTANT, LOW, SPAM), write a short summary and draft replies for the urgent ones.',
      report:   'Create a professional business report with an executive summary, key findings, and recommended next steps.',
      reply:    '',
      document: 'Create a professional, well-structured document with clear headings and sections.'
    }
  };
  const desc = descriptions[currentLang][type] || descriptions['de'][type];
  document.getElementById('task-description').value = desc;
  updateCharCount('task-description', 'task-char-count', 2000);
  syncServiceBtn(type);
  if (type === 'pdf') document.getElementById('pdf-drop-zone').style.borderColor = 'var(--electric)';
  document.getElementById('depth-selector').style.display = (type === 'email') ? 'none' : 'flex';
  const ecs = document.getElementById('email-count-selector');
  if (ecs) ecs.style.display = (type === 'email') ? 'flex' : 'none';
  if (type === 'email') setEmailCount(emailCount);
  const ewr = document.getElementById('email-write-form');
  if (ewr) ewr.style.display = (type === 'reply') ? 'flex' : 'none';
  const dc = document.getElementById('desc-step-card');
  if (dc) dc.style.display = (type === 'reply') ? 'none' : 'flex';
  const td = document.getElementById('task-description');
  if (td) { td.required = (type !== 'reply'); }
}

// =====================
// PAGE NAVIGATION
// =====================
function showPage(page) {
  const main = document.getElementById('page-main');
  const task = document.getElementById('page-task');
  const reviewCta = document.getElementById('review-cta-section');

  if (page === 'main') {
    main.style.display = 'block';
    task.style.display = 'none';
    if (reviewCta) reviewCta.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    main.style.display = 'none';
    task.style.display = 'block';
    if (reviewCta) reviewCta.style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'instant' });

    if (page === 'pdf') {
      document.getElementById('service-picker').style.display = 'none';
      document.getElementById('task-page-icon').textContent = '📄';
      document.getElementById('task-page-title').textContent = currentLang === 'de' ? 'PDF analysieren' : 'Analyse PDF';
      preselectPDF();
      showStep('step-form');
    } else if (page === 'services') {
      document.getElementById('service-picker').style.display = 'block';
      document.getElementById('task-page-icon').textContent = '🛠️';
      document.getElementById('task-page-title').textContent = currentLang === 'de' ? 'Dienst auswählen' : 'Select Service';
      document.querySelectorAll('.task-shortcut').forEach(b => b.style.display = 'inline-block');
      showStep('step-form');
    }
    updateMiniCharButtons();
  }
}

function updateMiniCharButtons() {
  document.querySelectorAll('.mini-char-btn').forEach(b => b.classList.remove('active'));
  const activeId = selectedCharacter === 'female' ? 'mini-char-female' : 'mini-char-male';
  const el = document.getElementById(activeId);
  if (el) el.classList.add('active');
}

function pickService(type) {
  if (!currentUser) { requireLogin(() => pickService(type)); return; }
  currentShortcutType = type;
  document.getElementById('service-picker').style.display = 'none';
  const icons = { email: '📧', report: '📊', reply: '✉️', document: '📝' };
  const titles = {
    de: { email: 'E-Mails sortieren', report: 'Bericht erstellen', reply: 'E-Mail schreiben', document: 'Dokument erstellen' },
    en: { email: 'Sort Emails', report: 'Create Report', reply: 'Write Email', document: 'Create Document' }
  };
  document.getElementById('task-page-icon').textContent = icons[type] || '🛠️';
  document.getElementById('task-page-title').textContent = titles[currentLang]?.[type] || titles['de'][type];
  const descriptions = {
    de: {
      email:    'Sortiere meine E-Mails nach Dringlichkeit (DRINGEND, WICHTIG, NIEDRIG, SPAM), schreibe eine kurze Zusammenfassung und verfasse Entwürfe für dringende Antworten.',
      report:   'Erstelle einen professionellen Geschäftsbericht mit Executive Summary, wichtigsten Erkenntnissen und empfohlenen nächsten Schritten.',
      reply:    '',
      document: 'Erstelle ein professionelles, gut strukturiertes Dokument mit klaren Überschriften und Abschnitten.'
    },
    en: {
      email:    'Sort my emails by urgency (URGENT, IMPORTANT, LOW, SPAM), write a short summary and draft replies for the urgent ones.',
      report:   'Create a professional business report with an executive summary, key findings, and recommended next steps.',
      reply:    '',
      document: 'Create a professional, well-structured document with clear headings and sections.'
    }
  };
  const td = document.getElementById('task-description');
  td.value = descriptions[currentLang]?.[type] || descriptions['de'][type];
  updateCharCount('task-description', 'task-char-count', 2000);
  td.required = (type !== 'reply');
  syncServiceBtn(type);
  document.getElementById('depth-selector').style.display = (type === 'email') ? 'none' : 'flex';
  const ecs3 = document.getElementById('email-count-selector');
  if (ecs3) ecs3.style.display = (type === 'email') ? 'flex' : 'none';
  if (type === 'email') setEmailCount(emailCount);
  const ewr = document.getElementById('email-write-form');
  if (ewr) ewr.style.display = (type === 'reply') ? 'flex' : 'none';
  const dc = document.getElementById('desc-step-card');
  if (dc) dc.style.display = (type === 'reply') ? 'none' : 'flex';
  showStep('step-form');
}

function preselectPDF() {
  currentShortcutType = 'pdf';
  const desc = currentLang === 'de'
    ? 'Analysiere die hochgeladenen PDF-Dateien vollständig und erstelle einen professionellen Bericht mit den wichtigsten Erkenntnissen, Zusammenfassung und Handlungsempfehlungen.'
    : 'Fully analyse the uploaded PDF files and create a professional report with the key findings, summary, and recommended actions.';
  document.getElementById('task-description').value = desc;
  updateCharCount('task-description', 'task-char-count', 2000);
  syncServiceBtn('pdf');
  document.getElementById('pdf-drop-zone').style.borderColor = 'var(--electric)';
  document.getElementById('depth-selector').style.display = 'flex';
  const ecs = document.getElementById('email-count-selector');
  if (ecs) ecs.style.display = 'none';
  const ewr = document.getElementById('email-write-form');
  if (ewr) ewr.style.display = 'none';
  const dc = document.getElementById('desc-step-card');
  if (dc) dc.style.display = 'flex';
}

function updateCharCount(textareaId, counterId) {
  const ta = document.getElementById(textareaId);
  const counter = document.getElementById(counterId);
  if (ta && counter) counter.textContent = ta.value.length;
}

// =====================
// PDF UPLOAD
// =====================
function isImageFile(f) {
  return f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(f.name);
}

function handlePDFUpload(files) {
  const allowed = Array.from(files).filter(f =>
    f.type === 'application/pdf' || f.name.endsWith('.pdf') || isImageFile(f)
  );
  allowed.forEach(f => {
    const duplicate = uploadedPDFs.some(existing => existing.name === f.name && existing.size === f.size);
    if (!duplicate && uploadedPDFs.length < 10) uploadedPDFs.push(f);
  });
  renderPDFList();

  if (uploadedPDFs.length > 0) {
    const td = document.getElementById('task-description');
    const empty = !td.value.trim();
    const generic = td.value.includes('Sortiere') || td.value.includes('Sort my');
    const hasImages = uploadedPDFs.some(isImageFile);
    const hasPDFs   = uploadedPDFs.some(f => !isImageFile(f));
    if (empty || generic) {
      const desc = currentLang === 'de'
        ? hasImages && !hasPDFs
          ? 'Analysiere die hochgeladenen Bilder vollständig. Beschreibe was du siehst, extrahiere alle wichtigen Informationen, Texte und Details.'
          : 'Analysiere die hochgeladenen Dateien vollständig und erstelle einen professionellen Bericht mit den wichtigsten Erkenntnissen, Zusammenfassung und Handlungsempfehlungen.'
        : hasImages && !hasPDFs
          ? 'Fully analyse the uploaded images. Describe what you see, extract all important information, text and details.'
          : 'Fully analyse the uploaded files and create a professional report with the key findings, summary, and recommended actions.';
      td.value = desc;
      document.querySelectorAll('.task-shortcut').forEach(b => b.classList.remove('active'));
      const pdfBtn = document.querySelector('.task-shortcut[onclick*="pdf"]');
      if (pdfBtn) pdfBtn.classList.add('active');
    }
  }
}

function handleDragOver(e) {
  e.preventDefault();
  document.getElementById('pdf-drop-zone').classList.add('drag-over');
}

function handleDragLeave(_e) {
  document.getElementById('pdf-drop-zone').classList.remove('drag-over');
}

function handleDrop(e) {
  e.preventDefault();
  document.getElementById('pdf-drop-zone').classList.remove('drag-over');
  handlePDFUpload(e.dataTransfer.files);
}

function removePDF(index) {
  uploadedPDFs.splice(index, 1);
  renderPDFList();
}

function renderPDFList() {
  const list = document.getElementById('pdf-file-list');
  if (!uploadedPDFs.length) { list.innerHTML = ''; return; }
  list.innerHTML = uploadedPDFs.map((f, i) => {
    const kb = (f.size / 1024).toFixed(0);
    const size = kb > 1024 ? `${(kb/1024).toFixed(1)} MB` : `${kb} KB`;
    const icon = isImageFile(f) ? '🖼️' : '📄';
    return `<div class="pdf-file-item">
      <span class="pdf-file-name">${icon} ${f.name}<span class="pdf-file-size">${size}</span></span>
      <button type="button" class="pdf-file-remove" onclick="removePDF(${i})">×</button>
    </div>`;
  }).join('');
}

function submitTask(e) {
  e.preventDefault();
  if (!currentUser) {
    requireLogin(() => {
      document.querySelector('#step-form form')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    });
    return;
  }
  updateActivity();
  currentEstimate = estimateTask(document.getElementById('task-description').value, uploadedPDFs.length);
  showStep('step-price');
  document.getElementById('price-icon').textContent = getCharacterEmoji();
  const name = getCharacterName();
  document.getElementById('price-time-text').textContent = currentLang === 'de' ? `${name} braucht ca. ${currentEstimate.minutes} Minute${currentEstimate.minutes !== 1 ? 'n' : ''}` : `${name} needs about ${currentEstimate.minutes} minute${currentEstimate.minutes !== 1 ? 's' : ''}`;
  document.getElementById('price-amount').textContent = `€${currentEstimate.price.toFixed(2)}`;
}

function cancelTask() { showStep('step-form'); }

// =====================
// PAYMENT
// =====================
function goToPayment() {
  showStep('step-payment');
  document.getElementById('payment-amount-label').textContent = `€${currentEstimate.price.toFixed(2)}`;
  const saved = getSavedPayment();
  if (saved) {
    document.getElementById('saved-payment').style.display = 'block';
    document.getElementById('new-payment').style.display = 'none';
    document.getElementById('saved-method-icon').textContent = saved.type === 'paypal' ? '🅿️' : '🏦';
    document.getElementById('saved-method-label').textContent = saved.type === 'paypal' ? `PayPal — ${saved.value}` : (currentLang === 'de' ? `Banküberweisung — ${saved.value}` : `Bank Transfer — ${saved.value}`);
    selectedPaymentMethod = saved;
  } else {
    document.getElementById('saved-payment').style.display = 'none';
    document.getElementById('new-payment').style.display = 'block';
  }
}

function selectPayment(type) {
  selectedPaymentMethod = type;
  document.getElementById('opt-paypal').classList.toggle('selected', type === 'paypal');
  document.getElementById('opt-bank').classList.toggle('selected', type === 'bank');
  document.getElementById('paypal-form').style.display = type === 'paypal' ? 'block' : 'none';
  document.getElementById('bank-form').style.display = type === 'bank' ? 'block' : 'none';
}

function changPaymentMethod() {
  document.getElementById('saved-payment').style.display = 'none';
  document.getElementById('new-payment').style.display = 'block';
  selectedPaymentMethod = null;
  if (currentUser) localStorage.removeItem(`ai_payment_${currentUser.email}`);
}

function getSavedPayment() {
  if (!currentUser) return null;
  const s = localStorage.getItem(`ai_payment_${currentUser.email}`);
  return s ? JSON.parse(s) : null;
}

function savePayment(type) {
  if (!currentUser) return;
  // Only save payment TYPE preference — never store IBAN or PayPal address
  localStorage.setItem(`ai_payment_${currentUser.email}`, JSON.stringify({ type }));
}

function confirmPayment() {
  if (typeof selectedPaymentMethod === 'string') {
    if (selectedPaymentMethod === 'paypal') {
      const email = document.getElementById('paypal-email').value;
      if (!email) { alert(currentLang === 'de' ? 'Bitte PayPal E-Mail eingeben.' : 'Please enter PayPal email.'); return; }
      if (document.getElementById('save-paypal').checked) savePayment('paypal');

      // Open PayPal payment to owner's account if configured
      const ownerPaypal = getOwnerPaypalUsername();
      if (ownerPaypal) {
        window.open(`https://paypal.me/${ownerPaypal}/${currentEstimate.price.toFixed(2)}EUR`, '_blank');
      }
    } else if (selectedPaymentMethod === 'bank') {
      const iban = document.getElementById('bank-iban').value;
      if (!iban) { alert(currentLang === 'de' ? 'Bitte IBAN eingeben.' : 'Please enter IBAN.'); return; }
      if (document.getElementById('save-bank').checked) savePayment('bank');
    }
  }
  const desc = document.getElementById('task-description').value;
  const method = typeof selectedPaymentMethod === 'string' ? selectedPaymentMethod : selectedPaymentMethod?.type || 'unknown';
  saveSale(desc, currentEstimate.price.toFixed(2), method);
  saveTaskToHistory(desc, currentEstimate.price.toFixed(2));
  
  // Email tasks → Gmail connect step (no local agent needed)
  const resolvedType = currentShortcutType || detectTaskType(desc);
  if (resolvedType === 'email') {
    window.skippedSetup = true;
    document.getElementById('gmail-step-icon').textContent = getCharacterEmoji();
    showStep('step-gmail');
    return;
  }

  // Document/report/reply creation → skip setup & apps, go straight to AI generation
  const taskType = resolvedType;
  if (taskType === 'document' || taskType === 'report' || taskType === 'reply') {
    window.skippedSetup = true;
    startTask();
    return;
  }

  applySmartPermissions();

  const needsLocalAccess = document.getElementById('perm-email').checked ||
                           document.getElementById('perm-files').checked ||
                           document.getElementById('perm-browser').checked ||
                           document.getElementById('perm-calendar').checked;

  window.skippedSetup = !needsLocalAccess;

  if (needsLocalAccess) {
    showStep('step-setup');
    applyLangToSetup();
  } else {
    goToAppSelection();
  }
}

// =====================
// SETUP & TASK
// =====================
function applyLangToSetup() {
  document.querySelectorAll('[data-de]').forEach(el => { el.textContent = el.getAttribute(`data-${currentLang}`); });
}

// Auto-checks only the permissions that are actually needed for this task
function applySmartPermissions() {
  const desc = document.getElementById('task-description').value.toLowerCase();
  
  // If they uploaded a PDF, we don't need local file permissions because we already have the file.
  const isFiles  = (desc.includes('pdf') || desc.includes('dokument') || desc.includes('document') || desc.includes('datei') || desc.includes('file')) && uploadedPDFs.length === 0;
  
  const isEmail  = desc.includes('email') || desc.includes('mail') || desc.includes('postfach') || desc.includes('inbox') || desc.includes('antwort') || desc.includes('reply');
  const isBrowser = desc.includes('browser') || desc.includes('website') || desc.includes('web') || desc.includes('online') || desc.includes('recherch');
  const isCalendar = desc.includes('kalender') || desc.includes('calendar') || desc.includes('termin') || desc.includes('appointment') || desc.includes('meeting');

  document.getElementById('perm-email').checked    = isEmail;
  document.getElementById('perm-files').checked    = isFiles;
  document.getElementById('perm-browser').checked  = isBrowser;
  document.getElementById('perm-calendar').checked = isCalendar;

  // Highlight active permission items
  document.querySelectorAll('.permission-item').forEach(item => {
    const cb = item.querySelector('input[type="checkbox"]');
    item.style.opacity = cb.checked ? '1' : '0.45';
    item.style.borderColor = cb.checked ? 'var(--electric)' : '';
    item.style.background = cb.checked ? 'linear-gradient(135deg,#eff6ff,#e0f2fe)' : '';
  });
}

// =====================
// WINDOWS AGENT DOWNLOAD
// =====================
function downloadAgent() {
  const siteName = 'AI Employee Agent';
  const script = `@echo off
title ${siteName} — Setup
color 0B
echo.
echo  ================================================
echo    AI Employee Agent — Windows Setup
echo  ================================================
echo.
echo  Checking system requirements...
timeout /t 1 /nobreak > nul
echo  [OK] Windows detected
timeout /t 1 /nobreak > nul
echo  [OK] Browser found
timeout /t 1 /nobreak > nul
echo  [OK] Permissions ready
echo.
echo  Connecting to AI Employee Agent...
timeout /t 2 /nobreak > nul
echo.
echo  Opening your AI Employee Agent in the browser...
start "" "https://ai-employee-agent.vercel.app"
timeout /t 1 /nobreak > nul
echo.
echo  ================================================
echo    Agent is ready!
echo    You can close this window.
echo  ================================================
echo.
pause > nul
`;
  const blob = new Blob([script], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'AI-Employee-Agent-Setup.bat';
  a.click();
  URL.revokeObjectURL(url);
}

// =====================
// APP SELECTION STEP
// =====================
const APP_OPTIONS = {
  email: {
    de: { label: '📧 In welcher App soll ich deine E-Mails sortieren?', apps: ['Microsoft Outlook', 'Gmail', 'Thunderbird', 'Apple Mail', 'Web.de / GMX', 'Andere'] },
    en: { label: '📧 Which app should I use to sort your emails?',      apps: ['Microsoft Outlook', 'Gmail', 'Thunderbird', 'Apple Mail', 'Web.de / GMX', 'Other'] }
  },
  files: {
    de: { label: '📁 Wo liegen die Dateien, auf die ich zugreifen soll?', apps: ['Desktop', 'Dokumente (Eigene Dateien)', 'OneDrive', 'Google Drive', 'Dropbox', 'Anderer Ordner'] },
    en: { label: '📁 Where are the files I should access?',              apps: ['Desktop', 'Documents (My Files)', 'OneDrive', 'Google Drive', 'Dropbox', 'Another folder'] }
  },
  browser: {
    de: { label: '🌐 Welchen Browser soll ich verwenden?', apps: ['Microsoft Edge', 'Google Chrome', 'Mozilla Firefox', 'Safari', 'Brave', 'Anderen'] },
    en: { label: '🌐 Which browser should I use?',         apps: ['Microsoft Edge', 'Google Chrome', 'Mozilla Firefox', 'Safari', 'Brave', 'Other'] }
  },
  calendar: {
    de: { label: '📅 In welcher Kalender-App soll ich arbeiten?', apps: ['Outlook Kalender', 'Google Kalender', 'Apple Kalender', 'Windows Kalender', 'Anderen'] },
    en: { label: '📅 Which calendar app should I work in?',        apps: ['Outlook Calendar', 'Google Calendar', 'Apple Calendar', 'Windows Calendar', 'Other'] }
  }
};

function goToAppSelection() {
  const checked = {
    email:    document.getElementById('perm-email').checked,
    files:    document.getElementById('perm-files').checked,
    browser:  document.getElementById('perm-browser').checked,
    calendar: document.getElementById('perm-calendar').checked
  };

  const active = Object.entries(checked).filter(([,v]) => v).map(([k]) => k);

  const backBtn = document.getElementById('btn-back-apps');
  if (backBtn) {
    backBtn.onclick = () => showStep(window.skippedSetup ? 'step-payment' : 'step-setup');
  }

  // If nothing is checked, skip directly to task
  if (active.length === 0) { startTask(); return; }

  // Update character icon + name in the step header
  document.getElementById('app-step-icon').textContent = getCharacterEmoji();
  const name = getCharacterName();
  document.getElementById('app-step-title').textContent  = currentLang === 'de' ? `${name} fragt kurz nach...` : `${name} has a quick question...`;
  document.getElementById('app-step-subtitle').textContent = currentLang === 'de'
    ? `Damit ich genau weiß, wo ich arbeiten soll — beantworte kurz folgende ${active.length > 1 ? 'Fragen' : 'Frage'}:`
    : `So I know exactly where to work — please answer the following ${active.length > 1 ? 'questions' : 'question'}:`;

  // Build questions
  const container = document.getElementById('app-questions');
  container.innerHTML = '';
  active.forEach(key => {
    const opt = APP_OPTIONS[key][currentLang];
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;flex-direction:column;gap:10px;';
    div.innerHTML = `
      <label style="font-weight:700;font-size:15px;color:var(--dark);">${opt.label}</label>
      <div style="display:flex;flex-wrap:wrap;gap:8px;" id="app-opts-${key}">
        ${opt.apps.map(app => `
          <button type="button" class="task-shortcut" onclick="selectApp('${key}', this)"
            style="font-size:13px;">${app}</button>
        `).join('')}
      </div>
      <input type="text" id="app-custom-${key}" placeholder="${currentLang === 'de' ? 'Oder eigene Eingabe...' : 'Or type your own...'}"
        style="padding:9px 14px;border:1.5px solid rgba(37,99,235,0.2);border-radius:9px;font-size:14px;outline:none;transition:border-color 0.2s;"
        oninput="clearAppSelection('${key}')" />
    `;
    container.appendChild(div);
  });

  showStep('step-apps');
}

function selectApp(key, btn) {
  document.querySelectorAll(`#app-opts-${key} .task-shortcut`).forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(`app-custom-${key}`).value = '';
}

function clearAppSelection(key) {
  document.querySelectorAll(`#app-opts-${key} .task-shortcut`).forEach(b => b.classList.remove('active'));
}

let emailCount = 200;
function setEmailTone(tone, btn) {
  document.getElementById('ew-tone').value = tone;
  document.querySelectorAll('.ew-tone-btn').forEach(b => b.classList.remove('active-tone'));
  btn.classList.add('active-tone');
}

function setEmailCount(count) {
  emailCount = count;
  [200, 500, 1000].forEach(n => {
    const btn = document.getElementById('ecount-' + n);
    if (!btn) return;
    btn.classList.toggle('active-depth', n === count);
  });
  const td = document.getElementById('task-description');
  if (td) {
    const de = currentLang === 'de';
    td.value = de
      ? `Sortiere meine E-Mails (bis zu ${count} E-Mails) nach Dringlichkeit in die Kategorien DRINGEND, WICHTIG, NIEDRIG und SPAM. Schreibe eine Zusammenfassung und verfasse Entwürfe für dringende Antworten.`
      : `Sort my emails (up to ${count} emails) by urgency into URGENT, IMPORTANT, LOW and SPAM. Write a summary and draft replies for urgent ones.`;
  }
}

function setDepth(level) {
  window.selectedAnalysisLength = level;
  ['short','medium','long'].forEach(l => {
    const btn = document.getElementById(`depth-${l}`);
    if (btn) btn.classList.toggle('active-depth', l === level);
  });
}

function confirmApps() {
  // Collect answers and store for use in progress messages
  window.selectedApps = {};
  ['email','files','browser','calendar'].forEach(key => {
    const el = document.getElementById(`app-opts-${key}`);
    if (!el) return;
    const active = el.querySelector('.task-shortcut.active');
    const custom = document.getElementById(`app-custom-${key}`)?.value?.trim();
    if (active) window.selectedApps[key] = active.textContent.trim();
    else if (custom) window.selectedApps[key] = custom;
  });
  // Default depth if not set
  if (!window.selectedAnalysisLength) window.selectedAnalysisLength = 'medium';
  startTask();
}

async function startTask() {
  showStep('step-progress');
  document.querySelector('.agent-icon').textContent = getCharacterEmoji();
  const name = getCharacterName();
  const desc = document.getElementById('task-description').value.toLowerCase();
  const isPDF = uploadedPDFs.length > 0 || desc.includes('pdf');
  const pdfCount = uploadedPDFs.length || 1;

  const apps = window.selectedApps || {};
  const emailApp    = apps.email    || (currentLang === 'de' ? 'deiner E-Mail-App'   : 'your email app');
  const filesApp    = apps.files    || (currentLang === 'de' ? 'deinen Dateien'      : 'your files');
  const browserApp  = apps.browser  || (currentLang === 'de' ? 'dem Browser'         : 'the browser');
  const calendarApp = apps.calendar || (currentLang === 'de' ? 'deinem Kalender'     : 'your calendar');

  setProgress(0, currentLang === 'de' ? `${name} liest deine Aufgabe...` : `${name} is reading your task...`);

  const steps = isPDF
    ? (currentLang === 'de'
        ? [[10,`${name} öffnet ${pdfCount > 1 ? `${pdfCount} PDFs` : 'das PDF'} aus ${filesApp}...`],[22,`${name} liest Seite für Seite durch...`],[40,`${name} analysiert den Inhalt tief...`],[58,`${name} erkennt Schlüsselthemen und Daten...`],[75,`${name} erstellt die professionelle Analyse...`],[90,`${name} formatiert deinen Bericht...`],[100,'Fertig! Deine Analyse ist bereit.']]
        : [[10,`${name} is opening ${pdfCount > 1 ? `${pdfCount} PDFs` : 'the PDF'} from ${filesApp}...`],[22,`${name} is reading every single page...`],[40,`${name} is deeply analysing the content...`],[58,`${name} is identifying key topics and data...`],[75,`${name} is creating the professional analysis...`],[90,`${name} is formatting your report...`],[100,'Done! Your analysis is ready.']])
    : desc.includes('email') || desc.includes('mail') || apps.email
        ? (currentLang === 'de'
            ? [[8,`${name} öffnet ${emailApp}...`],[20,`${name} liest alle E-Mails durch...`],[38,`${name} sortiert nach Dringlichkeit...`],[58,`${name} markiert wichtige E-Mails...`],[75,`${name} schreibt Antwort-Entwürfe...`],[90,`${name} bereitet das Ergebnis vor...`],[100,'Fertig! Dein Postfach ist sortiert.']]
            : [[8,`${name} is opening ${emailApp}...`],[20,`${name} is reading all emails...`],[38,`${name} is sorting by urgency...`],[58,`${name} is flagging important emails...`],[75,`${name} is writing draft replies...`],[90,`${name} is preparing the result...`],[100,'Done! Your inbox is sorted.']])
        : apps.browser
        ? (currentLang === 'de'
            ? [[8,`${name} öffnet ${browserApp}...`],[22,`${name} navigiert zur gewünschten Seite...`],[42,`${name} liest und verarbeitet die Inhalte...`],[65,`${name} erstellt eine Zusammenfassung...`],[85,`${name} bereitet das Ergebnis vor...`],[100,'Fertig! Deine Ergebnisse sind bereit.']]
            : [[8,`${name} is opening ${browserApp}...`],[22,`${name} is navigating to the right page...`],[42,`${name} is reading and processing content...`],[65,`${name} is creating a summary...`],[85,`${name} is preparing the result...`],[100,'Done! Your results are ready.']])
        : apps.calendar
        ? (currentLang === 'de'
            ? [[8,`${name} öffnet ${calendarApp}...`],[25,`${name} liest alle Termine durch...`],[48,`${name} sortiert und priorisiert...`],[72,`${name} erstellt die Übersicht...`],[90,`${name} bereitet das Ergebnis vor...`],[100,'Fertig! Deine Termine sind sortiert.']]
            : [[8,`${name} is opening ${calendarApp}...`],[25,`${name} is reading all appointments...`],[48,`${name} is sorting and prioritising...`],[72,`${name} is creating the overview...`],[90,`${name} is preparing the result...`],[100,'Done! Your calendar is sorted.']])
        : (currentLang === 'de'
            ? [[10,`${name} analysiert die Aufgabe...`],[25,`${name} wählt den besten Ansatz...`],[45,`${name} arbeitet an deiner Aufgabe...`],[65,`${name} verarbeitet die Ergebnisse...`],[85,`${name} bereitet dein Ergebnis vor...`],[100,'Fertig! Deine Ergebnisse sind bereit.']]
            : [[10,`${name} is analysing the task...`],[25,`${name} is choosing the best approach...`],[45,`${name} is working on your task...`],[65,`${name} is processing the results...`],[85,`${name} is preparing your results...`],[100,'Done! Your results are ready.']]);

  let taskDesc = document.getElementById('task-description').value;
  const businessDetails = document.getElementById('business-details')?.value || '';
  const analysisLength = window.selectedAnalysisLength || 'medium';

  // For email writing form, build prompt from structured fields
  if (currentShortcutType === 'reply') {
    const to      = document.getElementById('ew-to')?.value.trim() || '';
    const subject = document.getElementById('ew-subject')?.value.trim() || '';
    const points  = document.getElementById('ew-points')?.value.trim() || '';
    const tone    = document.getElementById('ew-tone')?.value || 'professionell';
    const de = currentLang === 'de';
    // Validate required fields (#4)
    if (!to || !subject) {
      ['ew-to','ew-subject'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.value.trim()) el.style.border = '1.5px solid #ef4444';
      });
      alert(de ? 'Bitte "An wen" und "Betreff" ausfüllen.' : 'Please fill in "To" and "Subject".');
      showStep('step-form');
      return;
    }
    document.getElementById('ew-to').style.border = '';
    document.getElementById('ew-subject').style.border = '';
    const toneLabels = { de: { professionell:'professionell und sachlich', freundlich:'freundlich und persönlich', formal:'förmlich und respektvoll' }, en: { professionell:'professional and factual', freundlich:'friendly and personal', formal:'formal and respectful' } };
    const toneLabel = (toneLabels[de ? 'de' : 'en'] || toneLabels.de)[tone] || tone;
    taskDesc = de
      ? `EMPFÄNGER: ${to}
BETREFF-ZIEL: ${subject}
INHALT MUSS ENTHALTEN: ${points || '(nur Betreff und Empfänger angegeben)'}
TON: ${toneLabel}`
      : `RECIPIENT: ${to}
SUBJECT GOAL: ${subject}
CONTENT MUST INCLUDE: ${points || '(only subject and recipient provided)'}
TONE: ${toneLabel}`;
  }

  // Always use real AI for document/report/reply creation (no PDF required)
  const taskKind = currentShortcutType || detectTaskType(taskDesc);
  const useRealAI = uploadedPDFs.length > 0 || taskKind === 'document' || taskKind === 'report' || taskKind === 'reply';

  if (useRealAI) {
    // Real AI mode — PDF uploaded, call server-side Gemini API
    for (const [pct, msg] of steps) { await delay(600); setProgress(pct, msg); }
    setProgress(95, currentLang === 'de' ? 'KI analysiert — bitte warten...' : 'AI is analysing — please wait...');
    try {
      currentResult = await runRealAI(taskDesc, businessDetails, analysisLength);
    } catch (err) {
      console.error('Real AI failed:', err);
      currentResult = currentLang === 'de'
        ? `⚠️ Analyse konnte nicht abgeschlossen werden.\n\nFehler: ${err.message}\n\nBitte versuche es erneut oder kontaktiere den Support.`
        : `⚠️ Analysis could not be completed.\n\nError: ${err.message}\n\nPlease try again or contact support.`;
    }
  } else {
    // Demo mode — no PDF uploaded, run without real document content
    for (const [pct, msg] of steps) { await delay(1200); setProgress(pct, msg); }
    await delay(800);
    currentResult = generateDemoResult(taskDesc);
  }

  setProgress(100, currentLang === 'de' ? 'Fertig!' : 'Done!');
  lastCompletedTaskType = currentShortcutType || detectTaskType(taskDesc);
  updateChainButtons(lastCompletedTaskType);
  showStep('step-result');
  renderResultRich(currentResult);

  // Demo mode banner (#6)
  const isDemo = !useRealAI;
  let demoBanner = document.getElementById('demo-mode-banner');
  if (!demoBanner) {
    demoBanner = document.createElement('div');
    demoBanner.id = 'demo-mode-banner';
    demoBanner.style.cssText = 'background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.4);border-radius:10px;padding:10px 14px;font-size:13px;color:#f59e0b;margin-bottom:12px;text-align:center;';
    document.getElementById('result-content').before(demoBanner);
  }
  demoBanner.style.display = isDemo ? 'block' : 'none';
  demoBanner.textContent = currentLang === 'de'
    ? '⚠️ Demo-Ergebnis — lade ein Dokument hoch für eine echte KI-Analyse'
    : '⚠️ Demo result — upload a document for real AI analysis';
}

function setProgress(pct, msg) {
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('progress-percent').textContent = pct + '%';
  if (msg) document.getElementById('progress-message').textContent = msg;
}

let _progressTimer = null;
function startProgressAnimation(fromPct, targetPct, durationMs, msg) {
  if (_progressTimer) clearInterval(_progressTimer);
  const start = Date.now();
  const range = targetPct - fromPct;
  if (msg) document.getElementById('progress-message').textContent = msg;
  _progressTimer = setInterval(() => {
    const elapsed = Date.now() - start;
    const t = Math.min(elapsed / durationMs, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    const pct = Math.round(fromPct + range * eased);
    document.getElementById('progress-fill').style.width = pct + '%';
    document.getElementById('progress-percent').textContent = pct + '%';
    if (t >= 1) clearInterval(_progressTimer);
  }, 80);
}
function stopProgressAnimation() {
  if (_progressTimer) { clearInterval(_progressTimer); _progressTimer = null; }
}

// =====================
// SMART DOWNLOAD
// =====================
function downloadResult() {
  const desc = document.getElementById('task-description').value.toLowerCase();
  const isEmail = desc.includes('email') || desc.includes('mail') || desc.includes('postfach') || (window.selectedApps && window.selectedApps.email);

  if (isEmail) {
    downloadEmailResult();
  } else {
    // PDF for everything else (PDF analysis, document creation, reports, replies)
    downloadPDF(window.selectedAnalysisLength || 'medium');
  }
}

function closeLengthSelector() {
  document.getElementById('length-selector-overlay').classList.add('hidden');
}

// =====================
// PDF GENERATION (jsPDF) — uses actual AI result
// =====================
// ── Step 1: parse currentResult into typed blocks ──────────────────────────
function parseResultBlocks(text) {
  const blocks = [];
  const lines  = text.split('\n');
  let afterDivider = false;
  const isTableRow = s => /^\|.+\|/.test(s);
  const isSepRow   = s => /^\|[\s\-:|]+\|/.test(s);

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const t   = raw.trim();

    if (!t) { afterDivider = false; if (blocks.length === 0 || blocks[blocks.length-1].type !== 'gap') blocks.push({ type: 'gap' }); continue; }

    // ━━━ divider → flag that next line is a section title
    if (/^━{3,}/.test(t)) {
      let lastType = null;
      for (let j = blocks.length - 1; j >= 0; j--) {
        if (blocks[j].type !== 'gap') { lastType = blocks[j].type; break; }
      }
      afterDivider = lastType !== 'section';
      continue;
    }

    // Section title (line immediately after a top ━━━)
    if (afterDivider) {
      afterDivider = false;
      const title = t.replace(/^[\u{0080}-\u{FFFF}\u{10000}-\u{10FFFF}]+\s*/gu, '')
                     .replace(/^[^a-zA-Z0-9\u00C0-\u024F]+/, '')
                     .replace(/\*+$/, '').trim();
      blocks.push({ type: 'section', text: title || t.replace(/[^\x20-\x7E\u00C0-\u024F]/g,'').replace(/\*+/g,'').trim() });
      continue;
    }

    afterDivider = false;

    // [CHART:type|title|label:val,label:val,...]
    const chartMatch = t.match(/^\[CHART:(line|bar|pie)\|([^|]+)\|(.+)\]$/i);
    if (chartMatch) {
      const chartType = chartMatch[1].toLowerCase();
      const title = chartMatch[2].trim();
      const data = [];
      const pairRe = /([^,]+?):([-+]?\d+(?:\.\d+)?)/g;
      let pm;
      while ((pm = pairRe.exec(chartMatch[3])) !== null) {
        data.push({ label: pm[1].trim(), value: parseFloat(pm[2]) });
      }
      if (data.length >= 2) blocks.push({ type: 'chart', chartType, title, data });
      continue;
    }

    // Markdown table — collect all consecutive pipe rows
    if (isTableRow(t)) {
      const rows = [];
      while (i < lines.length && (isTableRow(lines[i].trim()) || isSepRow(lines[i].trim()))) {
        const row = lines[i].trim();
        if (!isSepRow(row)) {
          rows.push(row.replace(/^\||\|$/g, '').split('|').map(c => c.trim().replace(/\*\*/g, '')));
        }
        i++;
      }
      i--; // step back — outer loop will increment
      if (rows.length >= 1) blocks.push({ type: 'table', headers: rows[0], rows: rows.slice(1) });
      continue;
    }

    // Markdown headings
    const mdHeading = t.match(/^#{1,6}\s+(.+)/);
    if (mdHeading) {
      const hText = mdHeading[1].replace(/^[\u{0080}-\u{10FFFF}]+\s*/gu, '').replace(/^[^a-zA-Z0-9\u00C0-\u024F]+/, '').trim();
      blocks.push({ type: 'section', text: hText || mdHeading[1] });
      continue;
    }

    // **Bold line** on its own → section heading
    const boldLine = t.match(/^\*\*([^*]{3,})\*\*[:\s]*$/);
    if (boldLine) { blocks.push({ type: 'section', text: boldLine[1].trim() }); continue; }

    // KPI lines inside KENNZAHLEN section
    const prevSection = blocks.slice().reverse().find(b => b.type === 'section');
    const inKpiSection = prevSection && /kennzahl|metric|key.*figure|auf einen blick|at a glance/i.test(prevSection.text);
    if (inKpiSection && /^[^:]+:\s*[^\w\s]{0,3}\d/.test(t)) {
      const colonIdx = t.indexOf(':');
      blocks.push({ type: 'kpi', label: t.slice(0, colonIdx).trim(), value: t.slice(colonIdx + 1).trim() });
      continue;
    }

    // Risk bullets 🔴 🟡 🟢
    if (/^[\uD83D][\uDD34]/.test(t) || t.startsWith('\uD83D\uDD34') || /^\u{1F534}/u.test(t)) {
      blocks.push({ type: 'risk', level: 'critical', text: stripLeadingSymbol(t) }); continue;
    }
    if (/^\u{1F7E1}/u.test(t)) { blocks.push({ type: 'risk', level: 'important', text: stripLeadingSymbol(t) }); continue; }
    if (/^\u{1F7E2}/u.test(t)) { blocks.push({ type: 'risk', level: 'low',      text: stripLeadingSymbol(t) }); continue; }

    // Labeled bullet
    const lblM = t.match(/^[*\-]\s+\*\*([^*:]+):\*\*\s*(.*)/);
    if (lblM) {
      const label = lblM[1].trim(), text = lblM[2].trim();
      if (/^(Erkenntnis|Insight|Hinweis|Tipp|Note|Tip)/i.test(label)) { blocks.push({ type: 'insight', label, text }); continue; }
      blocks.push({ type: 'labeled_bullet', label, text }); continue;
    }

    // Numbered items
    const numM = t.match(/^(\d+)\.\s+(.+)/);
    if (numM) { blocks.push({ type: 'numbered', n: parseInt(numM[1]), text: numM[2] }); continue; }

    // Arrow / dash / star bullets
    if (/^(→|•|\-\s|\*\s)/.test(t)) {
      blocks.push({ type: 'bullet', text: t.replace(/^(→|•|\-\s+|\*\s+)/, '').trim() }); continue;
    }

    // Meta lines
    if (/^(Datei|File|Gelesen|Read|Referenz|Reference|Erstellt|Created|Status|Analysiert|Analysed by):/.test(t)) {
      blocks.push({ type: 'meta', text: t }); continue;
    }

    // Body
    blocks.push({ type: 'body', text: t });
  }

  return blocks;
}

function stripLeadingSymbol(s) {
  // Remove leading emoji + any KRITISCH/CRITICAL/WICHTIG etc. prefix words
  return s.replace(/^[\u{0080}-\u{10FFFF}]+\s*/gu, '')
          .replace(/^(KRITISCH|CRITICAL|WICHTIG|IMPORTANT|GERING|LOW|DRINGEND|URGENT)[\s:—-]*/i, '')
          .trim();
}

// ── Rich HTML result renderer (on-screen) ──────────────────────────────────
function renderResultRich(text) {
  const container = document.getElementById('result-content');
  if (!container) return;
  container.innerHTML = '';
  const blocks = parseResultBlocks(text || '');
  let kpiGrid = null;

  blocks.forEach(b => {
    if (b.type !== 'kpi' && b.type !== 'gap') kpiGrid = null;

    switch (b.type) {
      case 'gap': {
        const el = document.createElement('div'); el.style.height = '8px'; container.appendChild(el); break;
      }
      case 'section': {
        const el = document.createElement('div'); el.className = 'r-section'; el.textContent = b.text; container.appendChild(el); break;
      }
      case 'table': {
        const wrap = document.createElement('div'); wrap.className = 'r-table-wrap';
        const tbl = document.createElement('table'); tbl.className = 'r-table';
        const thead = document.createElement('thead');
        const hr = document.createElement('tr');
        b.headers.forEach(h => { const th = document.createElement('th'); th.textContent = h; hr.appendChild(th); });
        thead.appendChild(hr); tbl.appendChild(thead);
        const tbody = document.createElement('tbody');
        b.rows.forEach((row, ri) => {
          const tr = document.createElement('tr'); if (ri % 2 === 1) tr.className = 'r-odd';
          row.forEach(cell => { const td = document.createElement('td'); td.textContent = cell; tr.appendChild(td); });
          tbody.appendChild(tr);
        });
        tbl.appendChild(tbody); wrap.appendChild(tbl); container.appendChild(wrap); break;
      }
      case 'chart': {
        const wrap = document.createElement('div'); wrap.className = 'r-chart-wrap';
        const title = document.createElement('div'); title.className = 'r-chart-title'; title.textContent = b.title;
        wrap.appendChild(title);
        const canvas = document.createElement('canvas'); canvas.height = 220; wrap.appendChild(canvas);
        container.appendChild(wrap);
        setTimeout(() => renderChartOnCanvas(canvas, b), 30);
        break;
      }
      case 'kpi': {
        if (!kpiGrid) { kpiGrid = document.createElement('div'); kpiGrid.className = 'r-kpi-grid'; container.appendChild(kpiGrid); }
        const kpi = document.createElement('div'); kpi.className = 'r-kpi';
        const lbl = document.createElement('div'); lbl.className = 'r-kpi-label'; lbl.textContent = b.label;
        const val = document.createElement('div'); val.className = 'r-kpi-value'; val.textContent = b.value;
        kpi.appendChild(lbl); kpi.appendChild(val); kpiGrid.appendChild(kpi); break;
      }
      case 'risk': {
        const el = document.createElement('div'); el.className = `r-risk r-risk-${b.level}`;
        el.textContent = b.text; container.appendChild(el); break;
      }
      case 'insight': {
        const el = document.createElement('div'); el.className = 'r-insight';
        if (b.label) { const s = document.createElement('strong'); s.textContent = b.label + ': '; el.appendChild(s); }
        el.appendChild(document.createTextNode(b.text)); container.appendChild(el); break;
      }
      case 'labeled_bullet': {
        const el = document.createElement('div'); el.className = 'r-labeled-bullet';
        const s = document.createElement('strong'); s.textContent = b.label + ': '; el.appendChild(s);
        el.appendChild(document.createTextNode(b.text)); container.appendChild(el); break;
      }
      case 'bullet': {
        const el = document.createElement('div'); el.className = 'r-bullet'; el.textContent = b.text; container.appendChild(el); break;
      }
      case 'numbered': {
        const el = document.createElement('div'); el.className = 'r-numbered'; el.textContent = `${b.n}. ${b.text}`; container.appendChild(el); break;
      }
      case 'meta': {
        const el = document.createElement('div'); el.className = 'r-meta'; el.textContent = b.text; container.appendChild(el); break;
      }
      default: {
        const el = document.createElement('p'); el.className = 'r-body'; el.textContent = b.text || ''; container.appendChild(el); break;
      }
    }
  });
}

function renderChartOnCanvas(canvas, block) {
  if (typeof Chart === 'undefined') return;
  const colors = block.data.map((_, i) => `hsl(${(210 + i * 42) % 360}, 65%, 58%)`);
  const accent = getBrandColors().accent;
  const accentRgba = `rgba(${accent.join(',')},0.82)`;
  const accentRgb = `rgb(${accent.join(',')})`;

  new Chart(canvas, {
    type: block.chartType,
    data: {
      labels: block.data.map(d => d.label),
      datasets: [{
        label: block.title,
        data: block.data.map(d => d.value),
        backgroundColor: block.chartType === 'pie' ? colors : accentRgba,
        borderColor: block.chartType === 'pie' ? colors.map(c => c.replace('58%', '45%')) : accentRgb,
        borderWidth: 2,
        fill: block.chartType === 'line',
        tension: 0.35,
      }]
    },
    options: {
      animation: { duration: 500 },
      responsive: true,
      plugins: {
        legend: { display: block.chartType === 'pie', labels: { color: '#cbd5e1', font: { size: 12 } } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y ?? ctx.parsed}` } }
      },
      scales: block.chartType === 'pie' ? {} : {
        x: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.07)' } }
      }
    }
  });
}

// ── Step 2: render blocks into jsPDF ───────────────────────────────────────
function downloadPDF(length) {
  closeLengthSelector();

  if (!window.jspdf) { alert('PDF-Bibliothek wird geladen — bitte erneut versuchen.'); return; }
  const { jsPDF } = window.jspdf;
  const doc      = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW    = doc.internal.pageSize.getWidth();
  const pageH    = doc.internal.pageSize.getHeight();
  const mL = 20, mR = 20, mTop = 16, mBot = 16;
  const cW       = pageW - mL - mR;
  let y          = mTop;

  // ── COLOUR PALETTE — use brand colors if set, otherwise corporate neutral ──
  const brand  = getBrandColors();
  const navy   = brand.navy;        // default #0f172a
  const steel  = [30,  41,  59];   // #1e293b
  const accent = brand.accent;      // default #2563eb
  const mid    = [71, 85, 105];    // #475569
  const silver = [148,163,184];    // #94a3b8
  const ice    = [241,245,249];    // #f1f5f9
  const white  = [255,255,255];
  const red    = [220, 38, 38];
  const amber  = [217,119, 6];
  const green  = [22, 163, 74];
  // Darken bright accents for text-on-white use (WCAG contrast)
  const accentL = (accent[0] * 0.299 + accent[1] * 0.587 + accent[2] * 0.114) / 255;
  const textAccent = accentL > 0.45 ? accent.map(c => Math.max(0, Math.round(c * 0.52))) : accent;

  const fileName   = uploadedPDFs.length > 0 ? uploadedPDFs[0].name : '';
  // When no PDF is uploaded use the task description as the cover title
  const taskDescEl = document.getElementById('task-description');
  const taskDescVal = (taskDescEl?.value || '').trim().slice(0, 70);
  const fileBase   = (fileName
    ? fileName.replace(/\.pdf$/i, '')
    : (taskDescVal || (currentLang === 'de' ? 'KI-Analyse' : 'AI Analysis')))
    .replace(/Geschaeftsbericht/g, 'Geschäftsbericht')
    .replace(/geschaeftsbericht/g, 'geschäftsbericht')
    .replace(/Geschaefts/g, 'Geschäfts');
  const today    = new Date().toLocaleDateString(currentLang === 'de' ? 'de-DE' : 'en-GB');
  const nowTime  = new Date().toLocaleTimeString(currentLang === 'de' ? 'de-DE' : 'en-GB', { hour:'2-digit', minute:'2-digit' });
  const refNr    = 'REF-' + Date.now().toString(36).toUpperCase().slice(-6);
  const depthLbl = { de:{ short:'Kurzzusammenfassung', medium:'Standardanalyse', long:'Tiefenanalyse' }, en:{ short:'Brief Summary', medium:'Standard Analysis', long:'In-Depth Analysis' } }[currentLang][length];
  const docType  = window.currentDocType || 'allgemein';
  const docTypeLabels = {
    de: { geschaeftsbericht:'GESCHÄFTSBERICHT', vertrag:'VERTRAG', jahresabschluss:'JAHRESABSCHLUSS', rechnung:'RECHNUNG', protokoll:'PROTOKOLL', allgemein:'DOKUMENT' },
    en: { geschaeftsbericht:'BUSINESS REPORT', vertrag:'CONTRACT', jahresabschluss:'FINANCIAL STATEMENT', rechnung:'INVOICE', protokoll:'MEETING MINUTES', allgemein:'DOCUMENT' }
  };
  const dtLabel = docTypeLabels[currentLang === 'de' ? 'de' : 'en'][docType] || 'DOKUMENT';

  // ── HELPERS ──
  function newPage() {
    doc.addPage();
    y = mTop + 10;
    drawRunningHeader();
  }
  function guard(h = 8) { if (y + h > pageH - mBot - 10) newPage(); }

  function drawRunningHeader() {
    doc.setFillColor(...navy);
    doc.rect(0, 0, pageW, 10, 'F');
    // Accent bottom line on header
    doc.setFillColor(...accent);
    doc.rect(0, 10, pageW, 0.5, 'F');
    doc.setTextColor(...silver);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    const headerLeft = safe(brand.company
      ? brand.company.toUpperCase()
      : (currentLang === 'de' ? 'ANALYSEBERICHT - VERTRAULICH' : 'ANALYSIS REPORT - CONFIDENTIAL'));
    doc.text(headerLeft, mL, 6.5);
    doc.text(`${refNr}  |  ${today}`, pageW - mR, 6.5, { align: 'right' });
    // Defensive reset
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...steel);
  }

  function sep(gap = 3) {
    y += gap;
    doc.setDrawColor(...ice);
    doc.setLineWidth(0.3);
    doc.line(mL, y, pageW - mR, y);
    y += gap + 1;
  }

  function sectionHead(label) {
    guard(24);
    y += 6;
    // Full-width dark navy band
    doc.setFillColor(...navy);
    doc.rect(0, y, pageW, 11, 'F');
    // Bold accent left bar
    doc.setFillColor(...accent);
    doc.rect(0, y, 5, 11, 'F');
    // Subtle right accent glow
    doc.setFillColor(...accent);
    doc.rect(pageW - 2, y, 2, 11, 'F');
    // White uppercase label
    const clean = label.replace(/[\u{1F300}-\u{1FFFF}]/gu,'').replace(/[^\x20-\x7E\u00C0-\u024F]/g,'').trim();
    doc.setTextColor(...white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(clean.toUpperCase(), mL, y + 7.4);
    y += 20;
    // Defensive reset
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...steel);
  }

  function body(text, opts = {}) {
    const { bold = false, size = 9.5, color = steel, indent = 0 } = opts;
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, cW - indent);
    lines.forEach(ln => { guard(9); doc.text(ln, mL + indent, y); y += 5.2; });
    y += 1;
  }

  function bullet(text, level = 0) {
    const indent = 5 + level * 5;
    // Detect risk level from leading emoji text
    let dotColor = accent;
    if (text.startsWith('KRITISCH') || text.startsWith('CRITICAL') || text.includes('[KRITISCH]') || text.includes('[CRITICAL]')) dotColor = red;
    else if (text.startsWith('WICHTIG') || text.startsWith('IMPORTANT') || text.includes('[WICHTIG]')) dotColor = amber;
    else if (text.startsWith('GERING') || text.startsWith('LOW')) dotColor = green;

    // Clean risk prefix icons
    const cleaned = text.replace(/^[🔴🟡🟢]\s*/u,'').replace(/^\[(KRITISCH|CRITICAL|WICHTIG|IMPORTANT|GERING|LOW)\]\s*/,'');

    const lines = doc.splitTextToSize(cleaned, cW - indent - 5);
    guard(lines.length * 5.2 + 3); // guard full bullet height before drawing
    doc.setFillColor(...dotColor);
    doc.circle(mL + indent + 1.2, y - 1.5, 1, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...steel);
    lines.forEach(ln => {
      doc.text(ln, mL + indent + 4, y);
      y += 5.2;
    });
    y += 0.3;
  }

  function numberedItem(n, text) {
    const lines = doc.splitTextToSize(text, cW - 9);
    guard(lines.length * 5.2 + 3);
    doc.setFillColor(...accent);
    doc.circle(mL + 3, y - 1.5, 2.5, 'F');
    doc.setTextColor(...white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text(String(n), mL + 3, y - 0.7, { align:'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...steel);
    lines.forEach(ln => { doc.text(ln, mL + 9, y); y += 5.2; });
    y += 1;
  }

  // ── COVER PAGE ──
  const de = currentLang === 'de';
  doc.setFillColor(...navy);
  doc.rect(0, 0, pageW, pageH, 'F');

  // Left accent bar
  doc.setFillColor(...accent);
  doc.rect(0, 0, 6, pageH, 'F');

  // Top-right dot scatter decoration
  doc.setGState(doc.GState({ opacity: 0.18 }));
  doc.setFillColor(...accent);
  const dotPositions = [];
  const seed = { v: 42 };
  const rng = () => { seed.v = (seed.v * 1664525 + 1013904223) & 0xffffffff; return (seed.v >>> 0) / 0xffffffff; };
  for (let i = 0; i < 55; i++) {
    const dx = pageW - 5 - rng() * 55;
    const dy = rng() * 55;
    const r  = 0.6 + rng() * 1.4;
    dotPositions.push([dx, dy, r]);
  }
  dotPositions.forEach(([dx, dy, r]) => doc.circle(dx, dy, r, 'F'));
  doc.setGState(doc.GState({ opacity: 1 }));

  // ── Chips row ──
  const chipY = 22;
  const chipW = doc.getTextWidth(dtLabel) + 16;
  doc.setFillColor(...accent);
  doc.roundedRect(mL + 8, chipY, chipW, 8.5, 1.5, 1.5, 'F');
  doc.setTextColor(...white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(dtLabel, mL + 8 + 8, chipY + 6);

  const depthX = mL + 8 + chipW + 6;
  const depthChipW = doc.getTextWidth(depthLbl) + 14;
  doc.setFillColor(...navy);
  doc.roundedRect(depthX, chipY, depthChipW, 8.5, 1.5, 1.5, 'F');
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.5);
  doc.roundedRect(depthX, chipY, depthChipW, 8.5, 1.5, 1.5, 'S');
  doc.setTextColor(...silver);
  doc.setFont('helvetica', 'bold');
  doc.text(depthLbl.toUpperCase(), depthX + 7, chipY + 6);

  // ── Title ──
  doc.setTextColor(...white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  const titleLines = doc.splitTextToSize(fileBase, pageW - mL - mR - 30);
  let ty = 46;
  titleLines.slice(0, 3).forEach(ln => { doc.text(ln, mL + 8, ty); ty += 12; });

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...silver);
  doc.text(de ? 'KI-gestützte Dokumentenanalyse' : 'AI-powered document analysis', mL + 8, ty + 4);
  ty += 14;

  // Red divider
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.7);
  doc.line(mL + 8, ty, pageW - mR, ty);
  ty += 10;

  // ── Metadata — labels in accent color ──
  const metaPairs = [
    [de ? 'Datei'     : 'File',      fileName ? (fileName.length > 42 ? fileName.slice(0,39)+'...' : fileName) : '—'],
    [de ? 'Erstellt'  : 'Created',   today + '  ' + nowTime],
    [de ? 'Tiefe'     : 'Depth',     depthLbl],
    [de ? 'Referenz'  : 'Reference', refNr],
  ];
  doc.setFontSize(9);
  metaPairs.forEach(([label, val]) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...accent);
    doc.text(label + ':', mL + 8, ty);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...white);
    doc.text(val, mL + 8 + 35, ty);
    ty += 9.5;
  });
  ty += 6;

  // ── Info card ──
  const cardX = mL + 8, cardW = cW - 8;
  const cardH = 66;
  doc.setFillColor(navy[0] + 12, navy[1] + 12, navy[2] + 12);
  doc.roundedRect(cardX, ty, cardW, cardH, 3, 3, 'F');
  // Left accent strip
  doc.setFillColor(...accent);
  doc.roundedRect(cardX, ty, 3.5, cardH, 1.5, 1.5, 'F');
  // Card header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...accent);
  doc.text(de ? 'ANALYSE  UBERSICHT' : 'ANALYSIS  OVERVIEW', cardX + 12, ty + 10);
  // Divider in card
  doc.setDrawColor(accent[0], accent[1], accent[2]);
  doc.setLineWidth(0.25);
  doc.line(cardX + 12, ty + 14, cardX + cardW - 8, ty + 14);

  // Feature rows with icon circles
  const feats = [
    ['\u25CF', de ? 'Visuelle KI-Analyse'  : 'Visual AI Analysis',  de ? 'Tabellen & Grafiken erkannt'   : 'Tables & charts detected'],
    ['\u25CF', de ? 'Seitenreferenzen'     : 'Page References',      de ? 'Jede Aussage belegt'           : 'Every claim sourced'],
    ['\u25CF', de ? 'Vertraulich'          : 'Confidential',         de ? 'Daten nach Analyse gelöscht'   : 'Data deleted after analysis'],
  ];
  feats.forEach(([, left, right], i) => {
    const fy = ty + 23 + i * 14;
    // Icon circle
    doc.setFillColor(accent[0], accent[1], accent[2]);
    doc.setGState(doc.GState({ opacity: 0.18 }));
    doc.circle(cardX + 18, fy - 2.5, 5, 'F');
    doc.setGState(doc.GState({ opacity: 1 }));
    doc.setDrawColor(...accent);
    doc.setLineWidth(0.5);
    doc.circle(cardX + 18, fy - 2.5, 5, 'S');
    // Label + value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...white);
    doc.text(left, cardX + 27, fy);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...silver);
    doc.text(right, cardX + 27 + 55, fy);
  });
  ty += cardH + 10;

  // ── Quote block ──
  const taskPreview = (taskDescEl?.value || '').trim().slice(0, 180);
  const quoteText = taskPreview || (de ? 'KI-Analyse angefordert' : 'AI analysis requested');
  // Large quotation mark
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(...accent);
  doc.text('\u201E', mL + 8, ty + 8);
  // Quote text
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(160, 180, 210);
  const qLines = doc.splitTextToSize(quoteText + (taskPreview.length === 180 ? '\u2026' : '\u201C'), cardW - 18);
  qLines.slice(0, 3).forEach((ln, i) => doc.text(ln, mL + 22, ty + 4 + i * 6.5));
  ty += 10 + Math.min(qLines.length, 3) * 6.5;

  // Divider above footer
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.5);
  doc.line(mL + 8, pageH - 26, pageW - mR, pageH - 26);

  // ── Footer ──
  const footY = pageH - 16;
  // Shield circle
  doc.setFillColor(...navy);
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.6);
  doc.circle(mL + 14, footY - 2, 6, 'S');
  // Inner dot — avoids unsupported Unicode in Helvetica
  doc.setFillColor(...accent);
  doc.circle(mL + 14, footY - 2, 1.5, 'F');
  // "VERTRAULICH" label
  doc.setFontSize(9);
  doc.setTextColor(...accent);
  doc.text(de ? 'VERTRAULICH' : 'CONFIDENTIAL', mL + 23, footY);
  // Right side text
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...silver);
  doc.text(
    de ? 'Erstellt mit AI Employee Agent  \u2022  Alle Daten nach Analyse gelöscht'
       : 'Created with AI Employee Agent  \u2022  All data deleted after analysis',
    pageW - mR, footY, { align: 'right' }
  );

  // ── PARSE blocks early (needed for TOC) ──
  const blocks = parseResultBlocks(currentResult || '');
  let nCounter = 0;
  let kpiCol = 0;
  function closeKpiRow() { if (kpiCol % 2 === 1) { y += 15; kpiCol++; } }

  // ── TABLE OF CONTENTS PAGE (#7) — for medium and long ──
  if (length !== 'short') {
    doc.addPage();
    drawRunningHeader();
    let ty2 = mTop + 14;

    doc.setFillColor(...accent);
    doc.rect(mL, ty2, 3, 8, 'F');
    doc.setFillColor(...ice);
    doc.rect(mL + 3, ty2, cW - 3, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...navy);
    doc.text(currentLang === 'de' ? 'INHALTSVERZEICHNIS' : 'TABLE OF CONTENTS', mL + 7, ty2 + 5.5);
    ty2 += 14;

    // Filter: exclude cited detail headings (sub-sub-sections like "Bruttoinlandsprodukt (laut Seite 17):")
    const sectionNames = blocks
      .filter(b => b.type === 'section')
      .map(b => b.text)
      .filter(name => !/(laut seite|per page|according to page)/i.test(name))
      .filter(name => !/^tl;?dr|dringlichkeit|urgency:/i.test(name.trim()));
    let tocNum = 0;
    sectionNames.forEach(name => {
      const clean = name.replace(/[^\x20-\x7E\u00C0-\u024F]/g,'').trim();
      if (!clean) return;
      // Detect indentation level
      const isLevel2 = /^\d+\.\d+/.test(clean);
      const isLevel1 = !isLevel2 && /^\d+\./.test(clean);
      const isTop   = !isLevel1 && !isLevel2 && clean === clean.toUpperCase() && clean.length > 3;
      const indent  = isLevel2 ? 8 : (isLevel1 ? 4 : 0);
      const fSize   = isLevel2 ? 8.5 : 9.5;
      const fStyle  = isTop ? 'bold' : 'normal';
      const tColor  = isLevel2 ? mid : steel;
      tocNum++;
      let displayName = clean.replace(/^\d+\.\d*\s*/, '');
      if (ty2 > pageH - mBot - 10) { doc.addPage(); drawRunningHeader(); ty2 = mTop + 14; }
      doc.setFont('helvetica', fStyle);
      doc.setFontSize(fSize);
      doc.setTextColor(...tColor);
      // Truncate if too long to fit before the page number area
      const maxTocW = pageW - mL - mR - 20 - indent;
      while (displayName.length > 4 && doc.getTextWidth(`${tocNum}.  ${displayName}`) > maxTocW) {
        displayName = displayName.slice(0, -1);
      }
      if (doc.getTextWidth(`${tocNum}.  ${displayName}`) > maxTocW) displayName = displayName.slice(0, -3) + '…';
      doc.text(`${tocNum}.  ${displayName}`, mL + 4 + indent, ty2);
      // Dotted leader line
      doc.setDrawColor(...ice);
      doc.setLineWidth(0.3);
      const textEnd = mL + 4 + indent + doc.getTextWidth(`${tocNum}.  ${displayName}`) + 3;
      for (let dx = textEnd; dx < pageW - mR - 14; dx += 3) {
        doc.line(dx, ty2 - 1, dx + 1.5, ty2 - 1);
      }
      ty2 += isLevel2 ? 7 : 8;
    });
  }

  // ── CONTENT PAGES ──
  doc.addPage();
  drawRunningHeader();
  y = mTop + 12;

  // Helper: safely strip all non-printable / non-latin characters for jsPDF
  function safe(s) {
    return s
      .replace(/\*\*([^*]+)\*\*/g, '$1') // strip **bold** markdown
      .replace(/\*([^*]+)\*/g, '$1')     // strip *italic* markdown
      .replace(/`([^`]+)`/g, '$1')       // strip `code` markdown
      .replace(/\u2014|\u2013/g, ' - ')
      .replace(/\u2018|\u2019/g, "'")
      .replace(/\u201C|\u201D/g, '"')
      .replace(/\u2022/g, '-')
      .replace(/[^\x20-\x7E\u00C0-\u024F]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  blocks.forEach(b => {
    switch (b.type) {
      case 'gap':
        y += 2;
        break;

      case 'table': {
        closeKpiRow();
        const cols = b.headers.length || 1;
        const cellPad = 2.5;
        const pageUsable = pageH - mTop - 14 - mBot;

        // Clean all cell content through safe() to strip emojis and unsupported chars
        const cleanHeaders = b.headers.map(h => safe(h || ''));
        const cleanRows = b.rows.map(row => row.map(c => safe(c || '')));

        // Proportional column widths: last column gets 40% if 3+ cols, else equal
        let colWidths;
        if (cols === 1) {
          colWidths = [cW];
        } else if (cols === 2) {
          colWidths = [cW * 0.45, cW * 0.55];
        } else if (cols === 3) {
          colWidths = [cW * 0.28, cW * 0.22, cW * 0.50];
        } else {
          // 4+ cols: first col 25%, last col 35%, rest split equally
          const middle = (cW * 0.40) / (cols - 2);
          colWidths = [cW * 0.25, ...Array(cols - 2).fill(middle), cW * 0.35];
        }
        const colXpos = [mL];
        for (let i = 1; i < cols; i++) colXpos.push(colXpos[i-1] + colWidths[i-1]);

        // Dynamic header height — allow multi-line headers
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        let maxHeaderLines = 1;
        cleanHeaders.forEach((h, ci) => {
          const ls = doc.splitTextToSize(h, colWidths[ci] - cellPad * 2);
          maxHeaderLines = Math.max(maxHeaderLines, ls.length);
        });
        const headerH = maxHeaderLines * 4.5 + 5;

        // Pre-calculate row heights using cleaned text
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        const rowHeights = cleanRows.map(row => {
          let rowH = 6;
          row.forEach((cell, ci) => {
            const ls = doc.splitTextToSize(cell, colWidths[ci] - cellPad * 2);
            rowH = Math.max(rowH, ls.length * 4.5 + 3);
          });
          return rowH;
        });
        const totalTableH = headerH + rowHeights.reduce((s, h) => s + h, 0) + 6;

        if (y + totalTableH > pageH - mBot) {
          doc.addPage(); drawRunningHeader(); y = mTop + 14;
        }

        const drawTable = (startRow) => {
          // Header row
          doc.setFillColor(...accent);
          doc.rect(mL, y, cW, headerH, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(...white);
          cleanHeaders.forEach((h, ci) => {
            const hLines = doc.splitTextToSize(h, colWidths[ci] - cellPad * 2);
            hLines.forEach((ln, li) => doc.text(ln, colXpos[ci] + cellPad, y + 5 + li * 4.5));
          });
          y += headerH;

          for (let ri = startRow; ri < cleanRows.length; ri++) {
            const row = cleanRows[ri];
            const rowH = rowHeights[ri];

            if (y + rowH > pageH - mBot && totalTableH > pageUsable) {
              doc.addPage(); drawRunningHeader(); y = mTop + 14;
              drawTable(ri);
              return;
            }

            if (ri % 2 === 0) { doc.setFillColor(...ice); doc.rect(mL, y, cW, rowH, 'F'); }

            doc.setDrawColor(...silver);
            doc.setLineWidth(0.2);
            colXpos.forEach(x => doc.line(x, y, x, y + rowH));
            doc.line(mL + cW, y, mL + cW, y + rowH);
            doc.line(mL, y + rowH, mL + cW, y + rowH);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(...steel);
            row.forEach((cell, ci) => {
              const wrapped = doc.splitTextToSize(cell, colWidths[ci] - cellPad * 2);
              wrapped.forEach((line, li) => doc.text(line, colXpos[ci] + cellPad, y + 4.5 + li * 4.5));
            });
            y += rowH;
          }

          doc.setDrawColor(...accent);
          doc.setLineWidth(0.4);
          doc.line(mL, y, mL + cW, y);
          y += 5;
        };

        drawTable(0);
        break;
      }

      case 'chart': {
        closeKpiRow();
        if (typeof Chart === 'undefined' || !b.data?.length) break;
        guard(68);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...navy);
        doc.text(safe(b.title), mL, y + 4); y += 9;
        const cvs = document.createElement('canvas');
        cvs.width = 900; cvs.height = 380;
        document.body.appendChild(cvs);
        const clrs = b.data.map((_, i) => `hsl(${(210 + i * 42) % 360},65%,50%)`);
        const acRgb = `rgb(${accent.join(',')})`;
        try {
          const ch = new Chart(cvs, {
            type: b.chartType,
            data: {
              labels: b.data.map(d => d.label),
              datasets: [{
                label: b.title, data: b.data.map(d => d.value),
                backgroundColor: b.chartType === 'pie' ? clrs : `rgba(${accent.join(',')},0.75)`,
                borderColor: b.chartType === 'pie' ? clrs : acRgb,
                borderWidth: 2, fill: false, tension: 0.35
              }]
            },
            options: { animation: false, responsive: false, plugins: { legend: { display: b.chartType === 'pie' } } }
          });
          const imgData = cvs.toDataURL('image/png');
          ch.destroy();
          const imgH = cW * (cvs.height / cvs.width);
          doc.addImage(imgData, 'PNG', mL, y, cW, imgH);
          y += imgH + 4;
        } finally { document.body.removeChild(cvs); }
        break;
      }

      case 'section': {
        closeKpiRow();
        kpiCol = 0;
        nCounter = 0;
        const t = safe(b.text);
        if (t) sectionHead(t);
        break;
      }

      case 'body': {
        closeKpiRow();
        const t = safe(b.text);
        if (t) body(t);
        break;
      }

      case 'meta': {
        closeKpiRow();
        const t = safe(b.text);
        if (t) body(t, { color: silver, size: 8.5 });
        break;
      }

      case 'bullet': {
        closeKpiRow();
        const t = safe(b.text);
        if (t) bullet(t);
        break;
      }

      case 'numbered': {
        closeKpiRow();
        nCounter++;
        const t = safe(b.text);
        if (t) numberedItem(nCounter, t);
        break;
      }

      case 'kpi': { // colored KPI tiles — 2-column grid
        const lbl = safe(b.label);
        const val = safe(b.value);
        if (!lbl || !val) break;
        const tileW = (cW - 4) / 2;
        const isLeft = kpiCol % 2 === 0;
        const col = isLeft ? mL : mL + tileW + 4;
        if (isLeft) guard(14); // only check page break at start of new row
        // tile background (drawn at current y, height 12)
        doc.setFillColor(...ice);
        doc.roundedRect(col, y, tileW, 12, 2, 2, 'F');
        // left accent bar
        doc.setFillColor(...accent);
        doc.roundedRect(col, y, 3, 12, 1, 1, 'F');
        // label
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        doc.text(lbl, col + 6, y + 4.5);
        // value
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(...navy);
        doc.text(val, col + 6, y + 10);
        kpiCol++;
        if (kpiCol % 2 === 0) y += 15; // advance y only after a complete row (2 tiles)
        break;
      }

      case 'labeled_bullet': {
        closeKpiRow();
        const lbl = safe(b.label || '');
        const txt = safe(b.text || '');
        if (!lbl) break;
        guard(8);
        // Accent square dot
        doc.setFillColor(...accent);
        doc.rect(mL + 2, y - 3, 2.5, 2.5, 'F');
        // Bold blue label
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(...textAccent);
        const lblW = doc.getTextWidth(lbl + ':') + 2;
        doc.text(lbl + ':', mL + 7, y);
        if (txt) {
          const remaining = cW - 7 - lblW - 2;
          const txtLines = doc.splitTextToSize(txt, remaining);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...steel);
          if (txtLines.length === 1 && doc.getTextWidth(txt) <= remaining) {
            doc.text(txt, mL + 7 + lblW + 2, y);
            y += 5.5;
          } else {
            y += 5.5;
            txtLines.forEach(ln => { guard(6); doc.text(ln, mL + 12, y); y += 5.2; });
          }
        } else {
          y += 5.5;
        }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(...steel);
        y += 0.5;
        break;
      }

      case 'insight': {
        closeKpiRow();
        const lbl = safe(b.label || '');
        const txt = safe(b.text || '');
        if (!txt && !lbl) break;
        const insLines = doc.splitTextToSize(txt || lbl, cW - 16);
        const boxH = 8 + insLines.length * 5.2 + 4;
        guard(boxH + 4);
        y += 2;
        doc.setFillColor(236, 253, 245);
        doc.roundedRect(mL, y, cW, boxH, 3, 3, 'F');
        doc.setFillColor(...green);
        doc.roundedRect(mL, y, 4, boxH, 1, 1, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...green);
        doc.text((lbl || 'ERKENNTNIS').toUpperCase(), mL + 8, y + 5.5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(6, 78, 59);
        let iy = y + 11;
        insLines.forEach(ln => { doc.text(ln, mL + 8, iy); iy += 5.2; });
        y += boxH + 4;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(...steel);
        break;
      }

      case 'risk': {
        closeKpiRow();
        const t = safe(b.text);
        if (!t) break;
        const colors = { critical: red, important: amber, low: green };
        const labels = {
          de: { critical: 'KRITISCH', important: 'WICHTIG', low: 'GERING' },
          en: { critical: 'CRITICAL', important: 'IMPORTANT', low: 'LOW' }
        };
        const lbl = labels[currentLang][b.level];
        guard(7);
        // Coloured prefix badge
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...colors[b.level]);
        doc.text(lbl, mL + 4, y);
        // Rest of text
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(...steel);
        const tw = doc.getTextWidth(lbl) + 4;
        const lines = doc.splitTextToSize(t, cW - tw - 6);
        lines.forEach(ln => { guard(6); doc.text(ln, mL + tw + 3, y); y += 5.2; });
        y += 1;
        break;
      }
    }
  });

  // Close any incomplete KPI row at end of content
  closeKpiRow();

  // ── ANALYSE-STATISTIK ──
  const numTables  = blocks.filter(b => b.type === 'table').length;
  const numCharts  = blocks.filter(b => b.type === 'chart').length;
  const numChars   = (currentResult || '').replace(/\s+/g, '').length;
  const numPages   = window.lastAnalysedPages ?? (uploadedPDFs.length > 0 ? uploadedPDFs[0].name ? '?' : 0 : 0);

  sep(4);
  guard(28);
  const statsBoxH = 26;
  doc.setFillColor(...navy);
  doc.roundedRect(mL, y, cW, statsBoxH, 3, 3, 'F');
  doc.setFillColor(...accent);
  doc.roundedRect(mL, y, 4, statsBoxH, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...accent);
  doc.text(de ? 'ANALYSE-STATISTIK' : 'ANALYSIS STATISTICS', mL + 10, y + 7);
  const statsItems = [
    [de ? 'Seiten' : 'Pages',     String(numPages)],
    [de ? 'Zeichen' : 'Chars',    numChars.toLocaleString()],
    [de ? 'Tabellen' : 'Tables',  String(numTables)],
    [de ? 'Grafiken' : 'Charts',  String(numCharts)],
  ];
  const statColW = cW / statsItems.length;
  statsItems.forEach(([lbl, val], i) => {
    const sx = mL + 10 + i * statColW;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...silver);
    doc.text(lbl, sx, y + 15);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...white);
    doc.text(val, sx, y + 22);
  });
  y += statsBoxH + 5;

  // ── FINAL PAGE FOOTER ──
  sep(2);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...silver);
  body(de
    ? `Referenz: ${refNr}  |  Erstellt: ${today} ${nowTime}  |  Alle hochgeladenen Daten wurden nach der Analyse sicher und unwiderruflich geloscht.`
    : `Reference: ${refNr}  |  Created: ${today} ${nowTime}  |  All uploaded data was securely and permanently deleted after analysis.`,
    { color: silver, size: 8 });

  // ── PAGE NUMBERS (skip cover) ──
  const total = doc.internal.getNumberOfPages();
  for (let i = 2; i <= total; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...silver);
    doc.text(`${i - 1} / ${total - 1}`, pageW - mR, pageH - 5, { align:'right' });
  }

  const outName = fileBase + `_${depthLbl.replace(/\s/g,'_')}_${refNr}.pdf`;
  doc.save(outName);
}

// =====================
// EMAIL HTML DOWNLOAD
// =====================
function downloadEmailResult() {
  const emailApp  = (window.selectedApps && window.selectedApps.email) || 'Outlook';
  const charName  = getCharacterName();
  const today     = new Date().toLocaleDateString(currentLang === 'de' ? 'de-DE' : 'en-GB');
  const resultTxt = currentResult || '';

  // Convert plain text result to formatted HTML
  const lines = resultTxt.split('\n');
  let html = lines.map(line => {
    if (line.startsWith('━')) return `<hr style="border:none;border-top:2px solid #e2e8f0;margin:12px 0;">`;
    if (line.match(/^📧|^📊|^✅|^⚠️|^🚫/)) return `<h2 style="color:#2563eb;font-size:16px;margin:18px 0 8px;">${line}</h2>`;
    if (line.match(/^🔴|^🟡|^🟢/)) return `<p style="margin:4px 0 4px 16px;">${line}</p>`;
    if (line.match(/^ENTWURF|^DRAFT/)) return `<h3 style="color:#0f172a;font-size:14px;margin:16px 0 6px;border-left:3px solid #2563eb;padding-left:10px;">${line}</h3>`;
    if (line.match(/^\[/)) return `<p style="margin:5px 0 5px 12px;font-weight:600;">${line}</p>`;
    if (line.trim() === '') return `<br>`;
    return `<p style="margin:3px 0;">${line}</p>`;
  }).join('');

  const fullHTML = `<!DOCTYPE html>
<html lang="${currentLang}">
<head>
<meta charset="UTF-8">
<title>${currentLang === 'de' ? 'E-Mail Analyse' : 'Email Analysis'} — AI Employee Agent</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fbff; color: #0f172a; margin: 0; padding: 0; }
  .header { background: linear-gradient(135deg, #0a0f1e, #1e3a8a); color: white; padding: 24px 32px; }
  .header h1 { font-size: 22px; margin: 0 0 4px; }
  .header p  { font-size: 13px; color: #94a3b8; margin: 0; }
  .content { max-width: 760px; margin: 0 auto; padding: 32px; }
  .note { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 12px 16px; font-size: 13px; color: #1e40af; margin-bottom: 24px; }
  hr { border: none; border-top: 2px solid #e2e8f0; margin: 14px 0; }
  h2 { color: #2563eb; }
</style>
</head>
<body>
<div class="header">
  <h1>📧 ${currentLang === 'de' ? 'E-Mail Analyse' : 'Email Analysis'} — ${emailApp}</h1>
  <p>${currentLang === 'de' ? `Erstellt von ${charName} • ${today}` : `Created by ${charName} • ${today}`}</p>
</div>
<div class="content">
  <div class="note">
    💡 ${currentLang === 'de'
      ? `Die Entwürfe unten kannst du direkt in ${emailApp} kopieren und versenden.`
      : `The drafts below can be copied directly into ${emailApp} and sent.`}
  </div>
  ${html}
  <hr>
  <p style="font-size:12px;color:#94a3b8;">🔒 ${currentLang === 'de' ? 'Alle Daten wurden nach der Analyse sicher gelöscht.' : 'All data was securely deleted after analysis.'}</p>
</div>
</body>
</html>`;

  const blob = new Blob([fullHTML], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = currentLang === 'de' ? 'E-Mail_Analyse.html' : 'Email_Analysis.html';
  a.click();
  URL.revokeObjectURL(url);
}

// =====================
// GENERAL HTML REPORT DOWNLOAD
// =====================
function downloadHTMLReport() {
  const charName = getCharacterName();
  const today    = new Date().toLocaleDateString(currentLang === 'de' ? 'de-DE' : 'en-GB');
  const lines    = (currentResult || '').split('\n');

  const html = lines.map(line => {
    if (line.startsWith('━')) return `<hr>`;
    if (line.match(/^📊|^✅|^⚠️|^📋|^🔑/)) return `<h2>${line}</h2>`;
    if (line.match(/^→|^🔴|^🟡|^🟢/)) return `<p class="bullet">${line}</p>`;
    if (line.trim() === '') return `<br>`;
    return `<p>${line}</p>`;
  }).join('');

  const fullHTML = `<!DOCTYPE html>
<html lang="${currentLang}">
<head>
<meta charset="UTF-8">
<title>${currentLang === 'de' ? 'Ergebnis' : 'Result'} — AI Employee Agent</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fbff; color: #0f172a; margin: 0; padding: 0; }
  .header { background: linear-gradient(135deg, #0a0f1e, #1e3a8a); color: white; padding: 24px 32px; }
  .header h1 { font-size: 20px; margin: 0 0 4px; }
  .header p  { font-size: 13px; color: #94a3b8; margin: 0; }
  .content { max-width: 760px; margin: 0 auto; padding: 32px; }
  h2 { color: #2563eb; font-size: 15px; margin: 20px 0 8px; }
  p  { margin: 4px 0; line-height: 1.7; }
  .bullet { padding-left: 16px; }
  hr { border: none; border-top: 2px solid #e2e8f0; margin: 14px 0; }
  .footer { font-size: 12px; color: #94a3b8; margin-top: 32px; }
</style>
</head>
<body>
<div class="header">
  <h1>✅ ${currentLang === 'de' ? 'Aufgabe abgeschlossen' : 'Task complete'}</h1>
  <p>${currentLang === 'de' ? `Erstellt von ${charName} • ${today}` : `Created by ${charName} • ${today}`}</p>
</div>
<div class="content">
  ${html}
  <hr>
  <p class="footer">🔒 ${currentLang === 'de' ? 'Alle Daten wurden nach Abschluss sicher gelöscht.' : 'All data was securely deleted after completion.'}</p>
</div>
</body>
</html>`;

  const blob = new Blob([fullHTML], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = currentLang === 'de' ? 'Ergebnis.html' : 'Result.html';
  a.click();
  URL.revokeObjectURL(url);
}

function confirmDeleteData() {
  const modal = document.getElementById('delete-confirm-modal');
  if (modal) modal.style.display = 'flex';
}

async function deleteData() {
  showStep('step-deleting');
  const emailChecked    = document.getElementById('perm-email')?.checked || gmailWasUsed;
  const filesChecked    = document.getElementById('perm-files')?.checked;
  const browserChecked  = document.getElementById('perm-browser')?.checked;
  const calendarChecked = document.getElementById('perm-calendar')?.checked;
  const agentInstalled  = !window.skippedSetup;

  // Clear Gmail token and flag
  gmailAccessToken = null;
  gmailWasUsed = false;

  const de = currentLang === 'de';
  const items = [
    { icon: '🗑', text: de ? 'Aufgabendaten werden gelöscht...' : 'Deleting task data...' },
    ...(emailChecked    ? [{ icon: '📧', text: de ? 'Gmail-Zugang wird gelöscht...'   : 'Removing Gmail access...' }]    : []),
    ...(filesChecked    ? [{ icon: '📁', text: de ? 'Dateizugriff wird entzogen...'     : 'Revoking file access...' }]     : []),
    ...(browserChecked  ? [{ icon: '🌐', text: de ? 'Browser-Zugriff wird entzogen...' : 'Revoking browser access...' }]  : []),
    ...(calendarChecked ? [{ icon: '📅', text: de ? 'Kalender-Zugriff wird entzogen...' : 'Revoking calendar access...' }] : []),
    ...(agentInstalled  ? [{ icon: '🔌', text: de ? 'Agent wird vom Computer getrennt...' : 'Disconnecting agent...' }]    : [])
  ];

  const list = document.getElementById('revoke-list');
  list.innerHTML = '';
  for (const item of items) {
    await delay(600);
    const el = document.createElement('div');
    el.className = 'revoke-item';
    el.innerHTML = `<span>${item.icon}</span><span>${item.text}</span>`;
    list.appendChild(el);
    await delay(400);
    el.classList.add('done');
    el.querySelector('span:last-child').textContent = item.text.replace('...', ' ✓');
  }
  await delay(600);

  const checklist = document.getElementById('deleted-checklist');
  if (checklist) {
    const doneItems = [
      { icon: '🗑', text: de ? 'Alle Aufgabendaten gelöscht' : 'All task data deleted' },
      ...(emailChecked    ? [{ icon: '📧', text: de ? 'Gmail-Zugang aus den Daten gelöscht'   : 'Gmail access removed from data' }]    : []),
      ...(filesChecked    ? [{ icon: '📁', text: de ? 'Dateizugriff entzogen'     : 'File access revoked' }]     : []),
      ...(browserChecked  ? [{ icon: '🌐', text: de ? 'Browser-Zugriff entzogen' : 'Browser access revoked' }]  : []),
      ...(calendarChecked ? [{ icon: '📅', text: de ? 'Kalender-Zugriff entzogen' : 'Calendar access revoked' }] : []),
      ...(agentInstalled  ? [{ icon: '🔌', text: de ? 'Agent vom Computer getrennt' : 'Agent disconnected' }]    : [])
    ];
    checklist.innerHTML = doneItems.map(i => `<div class="deleted-check"><span>${i.icon}</span><span>${i.text}</span></div>`).join('');
  }

  currentResult = null;
  showStep('step-deleted');
}

function resetForm() {
  document.getElementById('task-description').value = '';
  document.getElementById('business-details').value = '';
  document.getElementById('pdf-file-list').innerHTML = '';
  document.querySelectorAll('.task-shortcut').forEach(b => { b.classList.remove('active'); b.style.display = 'inline-block'; });
  uploadedPDFs = [];
  window.selectedApps = {};
  selectedPaymentMethod = null; currentEstimate = null;
  gmailAccessToken = null;
  gmailWasUsed = false;
  currentShortcutType = null;
  showStep('step-form');
}

function goHome() { resetForm(); showPage('main'); }

// =====================
// STEP NAVIGATION
// =====================
const ALL_STEPS = ['step-form','step-price','step-payment','step-setup','step-apps','step-gmail','step-calendar','step-progress','step-result','step-deleting','step-deleted','step-feedback','step-review-done'];
function showStep(id) { ALL_STEPS.forEach(s => { document.getElementById(s).style.display = s === id ? 'block' : 'none'; }); }

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// =====================
// DEMO RESULT GENERATOR
// =====================
function generateDemoResult(desc) {
  const d = desc.toLowerCase();
  const fileName  = uploadedPDFs.length > 0 ? uploadedPDFs[0].name : 'dokument.pdf';
  const fn = fileName.toLowerCase();

  // Investor detection: check BOTH task description AND filename
  const investorKws = [
    'investor','investoren','aktie','aktionär','aktionaer',
    'geschäftsbericht','geschaeftsbericht','jahresbericht','annual report',
    'finanzbericht','financial report','nachhaltigkeitsbericht','sustainability',
    'konzernabschluss','konzernbericht','ifrs','gaap',
    'umsatz','gewinn','marge','dividende','ebit','ebitda',
    'cash flow','cashflow','bilanz','quartalsbericht','quarterly',
    'earnings','revenue','profit','bewertung','valuation','investment',
    'porsche','volkswagen','bmw','mercedes','siemens','sap','allianz',
    'bericht_2024','bericht_2025','bericht_2026','report_2024','report_2025','report_2026',
    'q1_','q2_','q3_','q4_','h1_','h2_'
  ];
  const isInvestor = investorKws.some(kw => d.includes(kw) || fn.includes(kw));

  const isPDF     = uploadedPDFs.length > 0 || d.includes('pdf');
  const isEmail   = d.includes('email') || d.includes('mail') || d.includes('postfach') || d.includes('inbox');
  const isReport  = d.includes('report') || d.includes('bericht') || d.includes('summary') || d.includes('zusammenfassung');
  const isReply   = d.includes('reply') || d.includes('antwort') || d.includes('respond');
  if (currentLang === 'de') {

    if (isInvestor) return (
`INVESTOREN-ANALYSE ABGESCHLOSSEN
Dokument: ${fileName}
Gelesen: vollstaendig — kein Abschnitt, kein Anhang, keine Fussnoote uebersprungen

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INVESTOR SUMMARY — SCHNELLUEBERBLICK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Unternehmen: Muster AG — Hersteller von Industriekomponenten, borsennottiert seit 2018
Dokument: Geschaftsbericht 2025 (IFRS, geprueft)
Urteil: HALTEN — mit klarer Beobachtungsliste fuer Q1 2026
Wichtigster Fakt: Das bereinigte EBIT (ohne Einmallasten) betraegt ca. 4,2 Mrd. EUR — das Kerngeschaeft ist gesund. Die ausgewiesene Zahl von 413 Mio. EUR ist durch 3,9 Mrd. EUR Sonderlasten verzerrt und spiegelt nicht die operative Realitaet wider.
Groesstes Risiko: Kostenstruktur ist trotz Umsatzrueckgang nicht gesunken — bei weiterem Umsatzrueckgang beschleunigt sich der Margenverfall uberproportional.
Groesste Chance: Restrukturierung greift 2026, bereinigte Marge erholt sich auf 5-7 % — wenn das gelingt, ist die Aktie auf aktuellem Niveau guenstig bewertet.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WICHTIGSTE KENNZAHLEN 2025 vs. 2024
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Umsatz:             36,27 Mrd. EUR    (VJ: 40,08 Mrd.)    -9,5%
Bruttogewinn:        5,05 Mrd. EUR    (VJ: 10,33 Mrd.)    -51,1%
EBIT (ausgewiesen):    413 Mio. EUR   (VJ: 5.637 Mio.)    -92,7%
EBIT (bereinigt):    ~4,2 Mrd. EUR    (VJ: ~5,6 Mrd.)     -25%
Net Cash Flow:       1,51 Mrd. EUR    (VJ: 3,74 Mrd.)     -59,6%
Nettogewinn:           310 Mio. EUR   (VJ: 3.595 Mio.)    -91,4%
Gewinn je Aktie:       0,47 EUR       (VJ: 3,94 EUR)       -88%
Operative Marge:         1,1 %        (VJ: 14,1 %)         -13 Pp.
Bereinigte Marge:      ~11,6 %        (VJ: 14,1 %)          -2,5 Pp.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUSGEWIESENE vs. BEREINIGTE ERGEBNISSE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Einmallasten 2025 gesamt: ~3,9 Mrd. EUR
  - Strategische Neuausrichtung / Abschreibungen:   2,4 Mrd. EUR
  - Batterieaktivitaeten Restrukturierung:          0,7 Mrd. EUR
  - US-Importzoelle:                                0,7 Mrd. EUR

Ausgewiesenes EBIT:          413 Mio. EUR
+ Einmallasten:            3.900 Mio. EUR
= Bereinigtes EBIT:        4.313 Mio. EUR
  Bereinigte Marge:         ~11,9 %

Urteil zur Bereinigung: Die strategischen Abschreibungen (2,4 Mrd.) sind echt einmalig — sie spiegeln eine Produktstrategie-Kurskorrektur wider, die nicht jedes Jahr anfaellt. Die Zollbelastung (0,7 Mrd.) ist hingegen NICHT einmalig — sie wird 2026 fortbestehen. Das bedeutet: Das bereinigte EBIT ist realistischerweise eher ~3,6 Mrd. EUR als 4,3 Mrd. EUR. Trotzdem: Das Kerngeschaeft funktioniert.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MANAGEMENT-GLAUBWUERDIGKEIT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Kennzahl          | Guidance 2025  | Ergebnis 2025 | Abweichung
Umsatz            | 39-40 Mrd.     | 36,27 Mrd.    | -9 bis -10%
Operative Marge   | 10-12 %        | 1,1 %         | -9 bis -11 Pp.
Net CF Marge      | 8-10 %         | 4,7 %         | -3 bis -5 Pp.

Bewertung: Management hat seine eigene Guidance 2025 massiv verfehlt — bei jeder einzelnen Kernkennzahl. Das ist kein kleiner Fehler. Die 2026-Guidance (5,5-7,5 % Marge) ist mit Skepsis zu betrachten. Positiv: Das Management spricht offen davon, dass es 2025 "nicht zufriedenstellend" war — kein Schoenfaerben. Aber: Vertrauen muss erst durch Liefern wiederhergestellt werden.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERSTECKTE VERBINDUNGEN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERBINDUNG 1: Umsatz -9,5% + Umsatzkosten +4,9% = Inflexible Kostenstruktur
Trotz sinkenden Umsatzes sind die Produktionskosten gestiegen. Das bedeutet: Die Fixkostenstruktur ist starr nach unten. Bei einem weiteren Umsatzrueckgang 2026 wuerde die Marge ueberproportional einbrechen. Die Restrukturierung muss genau dieses Problem loesen — tut sie das nicht, sind 5,5-7,5% Marge unrealistisch.

VERBINDUNG 2: Guidance-Verfehlung 2025 + Einmalige Restrukturierungskosten 2026 angekuendigt = Doppeltes Risiko
Management hat 2025 die Guidance um ~10 Prozentpunkte verfehlt UND kuendigt fuer 2026 weitere ~700-900 Mio. EUR Einmalkosten an. Wenn 2026 erneut unerwartete Belastungen hinzukommen (z.B. Zoelle steigen, China schwaecher), koennte die Guidance ein zweites Mal verfehlt werden. Das waere ein erheblicher Vertrauensschaden fuer die Aktie.

VERBINDUNG 3: Starker BEV-Anteilsanstieg (22%) + Taycan-Einbruch (-22%) = Wachstum durch Modellmix, nicht durch Taycan
Der BEV-Anteil stieg von 12,7% auf 22,2% — aber Taycan brach um 21,6% ein. Das Wachstum kommt vom neuen elektrischen Macan. Das ist gut (Macan ist Volumensmodell), aber es bedeutet: Taycan, das Flaggschiff-EV, laeuft nicht. Wenn Taycan nicht zurueckkommt, fehlt ein wichtiger Margentreiber im Premium-EV-Segment.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RISIKEN FUER INVESTOREN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KRITISCH — US-Zoelle: Bereits 700 Mio. EUR Schaden 2025 — bleibt bestehen. Worst-case bei Eskalation: +500-800 Mio. EUR zusaetzliche Belastung. Wahrscheinlichkeit: hoch.

KRITISCH — China-Schwaeche: Luxussegment unter strukturellem Druck, EV-Preiskampf durch lokale Konkurrenten. Worst-case: weiterer Volumenrueckgang -10 bis -15 % in China. Wahrscheinlichkeit: mittel-hoch.

WICHTIG — Kostenstruktur-Starrheit: Kosten fallen nicht proportional mit Umsatz. Jeder weitere 1 Mrd. EUR Umsatzverlust trifft die Marge ueberproportional. Wahrscheinlichkeit: hoch bei weiterem Marktabschwung.

WICHTIG — Guidance-Glaubwuerdigkeit: 2025 wurde Guidance massiv verfehlt. Eine zweite Verfehlung 2026 wuerde das Vertrauen der Investoren nachhaltig beschaedigen und den Kurs stark belasten.

MONITOR — Taycan-Erholung: Das Premium-EV-Flaggschiff muss wieder wachsen. Wenn nicht, fehlt ein wichtiger Margentreiber fuer die langfristige Profitabilitaet.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BULL CASE vs. BEAR CASE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BULL CASE (Marge 2026 bei 7%+):
  - Restrukturierung greift: Kostenbase sinkt um 1,5-2 Mrd. EUR
  - China stabilisiert sich: Cayenne- und Taycan-Absatz erholen sich
  - Macan EV setzt Wachstum fort
  - Zoelle werden verhandelt oder teilweise abgebaut
  Implikation: Bereinigtes EBIT naehert sich 2024er Niveaus wieder an — Aktie stark unterbewertet

BEAR CASE (Marge 2026 verfehlt, unter 4%):
  - Restrukturierung bringt nicht die erwarteten Einsparungen
  - China bleibt schwach, US-Zoelle eskalieren
  - Weitere Einmallasten uebersteigen angekuendigte 700-900 Mio.
  - Dividende wird ein zweites Mal gekuerzt
  Implikation: Vertrauensverlust, weiterer Kursrueckgang, moegliche Rating-Abstufung

Der entscheidende Indikator: Die Umsatzkosten in Q1 2026. Wenn sie trotz gleichbleibendem Umsatz sinken, greift die Restrukturierung. Wenn nicht, ist der Bull Case gefaehrdet.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DIVIDENDEN-ANALYSE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Dividende 2025: 1,00 EUR je Stammaktie (VJ: ~2,30 EUR) — Kuerzung -57%
Ausschuettungsquote auf Nettogewinn: >200% — die Dividende ist durch den Gewinn NICHT gedeckt
Ausschuettungsquote auf Free Cash Flow: ~66% des Net Cash Flow — hier ist sie tragbar
Nachhaltigkeitsurteil: Kurzfristig tragbar dank solider Liquiditaet. Bei einem weiteren schlechten Jahr muss die Dividende erneut ueberdacht werden.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INVESTOR ACTION PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. SOFORT — Q1 2026 Bericht genau beobachten: Sind Umsatzkosten gesunken? Ist die Marge auf Kurs zur Guidance? Das ist der frueheste Indikator ob die Restrukturierung wirkt.

2. VOR NAECHSTEN EARNINGS — China-Absatzdaten verfolgen: Monatliche Zulassungszahlen in China sind der frueheste Indikator fuer die regionale Erholung — wichtig fuer Cayenne und Taycan.

3. LANGFRISTIG — Guidance-Tracking einrichten: Nach dem 2025-Debakel ist Glaubwuerdigkeit das wichtigste Asset. Jede Revision der 2026-Guidance nach unten ist ein starkes Warnsignal.

Alle hochgeladenen Daten wurden nach der Analyse sicher geloescht.`
    );

    if (isPDF) return (
`PDF-ANALYSE ABGESCHLOSSEN
Datei: ${fileName}
Gelesen: vollstaendig, Seite 1 bis zum Ende — keine Seite uebersprungen

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXECUTIVE SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Dokumenttyp: Dienstleistungsvertrag mit Servicebedingungen und Datenschutzklauseln
Gesamtumfang: 18 Seiten, 6 Kapitel, 17 Klauseln, 2 Anhange
Zweck: Langfristige Bindung des Kunden an eine SaaS-Plattform — mit automatischer Verlaengerung und einseitigen Preisrechten zugunsten des Anbieters
Wichtigste Sofortmassnahme: Kuendigungsfrist laeuft am 30.04.2026 ab — sofort im Kalender eintragen, sonst automatische 12-Monat-Verlaengerung
Klartexturteil: Ich wuerde diesen Vertrag in der aktuellen Form nicht unterzeichnen. Die Kombination aus fehlendem AVV, einseitiger Haftungskappe und nicht verhandelbarer Preisanpassung macht ihn unausgewogen. Zwei gezielte Nachverhandlungen und ein AVV reichen, um ihn akzeptabel zu machen — aber ohne diese drei Punkte besteht reales rechtliches und finanzielles Risiko.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ABSCHNITTSWEISE ANALYSE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Kapitel 1 — Vertragsgegenstand (S. 1-2)
Beschreibt den Leistungsumfang: Bereitstellung einer cloudbasierten Softwarelosung (SaaS) fur Projektmanagement. Leistungen klar definiert. Keine versteckten Zusatzleistungen. Keine Ueberraschungen in diesem Abschnitt.
Hinweis: Die genaue Versionsnummer der Software ist nicht festgeschrieben — Anbieter kann Updates liefern ohne Zustimmung.

Kapitel 2 — Laufzeit und Kundigung (S. 3-4)
Erstlaufzeit 12 Monate ab Unterzeichnung. Danach automatische Verlangerung um jeweils 12 Monate, sofern nicht 3 Monate vor Ablauf schriftlich gekundigt wird. Schriftform per Einschreiben vorgeschrieben — E-Mail allein genugt NICHT.
Kritisch: Viele Unternehmen verpassen diese Frist. Bei Verpassung: 12 Monate Kostenbindung ohne Ausweg.

Kapitel 3 — Vergutung und Zahlung (S. 5-7)
Monatliche Grundgebur: 890,00 EUR netto. Zahlungsziel: 14 Tage nach Rechnungsdatum. Verzugszins: 2% pro Monat (entspricht 24% p.a. — deutlich uber gesetzlichem Standard von 9% uber Basiszins). Preisanpassung: bis zu 5% jährlich, 30 Tage Vorankündigung per E-Mail, keine Zustimmung erforderlich.
Risiko: Uber 5 Jahre kann der Monatsbeitrag auf uber 1.136 EUR steigen ohne Nachverhandlung.

Kapitel 4 — Leistungsgarantien (SLA) (S. 8-10)
Verfugbarkeitsgarantie: 99,5% pro Monat (erlaubte Ausfallzeit: ca. 3,6 Std./Monat). Entschadigung bei Unterschreitung: 10% der Monatsgebur pro angefangenem 0,5%-Punkt Unterschreitung, maximal 30% einer Monatsgebur. Wartungsfenster: samstags 02:00-06:00 Uhr, zaehlen nicht als Ausfallzeit.
Luecke: Reaktionszeit bei kritischen Fehlern ist nicht definiert — nur "angemessene Zeit" (GAP — schriftliche Klarung empfohlen).

Kapitel 5 — Haftung und Gewahleistung (S. 11-13)
Gewahrleistung: 6 Monate. Gesetzlicher Standard: 24 Monate. Haftungsausschluss fur Folgeschaden, entgangenen Gewinn und Datenverluste. Haftungshoechstbetrag: 3 Monatspauschen (2.670 EUR) — unabhangig von tatsachlichem Schaden.
Kritisch: Bei einem Datenverlust durch Anbieterversagen konnten reale Schaden deutlich uber 2.670 EUR liegen ohne Entschadigung.

Kapitel 6 — Datenschutz und Datenverarbeitung (S. 14-16)
Kundendaten werden auf Servern in Deutschland gespeichert (positiv). Datenlöschung nach Vertragsende: 90 Tage Aufbewahrung, dann Loschen. DSGVO-Konformitat wird erwahnt, aber kein Auftragsverarbeitungsvertrag (AVV) liegt vor oder wird referenziert.
Kritisch: Ein AVV ist nach Art. 28 DSGVO zwingend erforderlich. Fehlt er, drohen Bussgelder bis 10 Mio. EUR oder 2% des Jahresumsatzes.

Anhang A — Technische Spezifikationen (S. 17)
Serverstandort: Frankfurt am Main. Backup: tagliche Sicherung, 30 Tage Aufbewahrung. Verschlusselung: TLS 1.2 in Transit, AES-256 at Rest. Positiv: technisch auf gutem Standard.

Anhang B — Preisliste Zusatzleistungen (S. 18)
Zusatznutzer: 45 EUR/Monat/Nutzer. Support-Eskalation Premium: 120 EUR/Std. Schulungspaket: 890 EUR einmalig. Achtung: Diese Preise sind nicht gedeckelt und konnen jederzeit angepasst werden.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KEY FINDINGS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. KUENDIGUNGSFRIST (S. 3, Kl. 3.2): 3 Monate vor Ablauf, schriftlich per Einschreiben — naechste Frist: 30.04.2026 fuer Ablauf 31.07.2026. Praktische Bedeutung: Wer vergisst zu kundigen, zahlt 12 weitere Monate = 10.680 EUR.

2. ZAHLUNGSVERZUG (S. 5, Kl. 5.3): 2% Monatszins bei Verzug = 24% p.a. Praktische Bedeutung: Eine Rechnung von 890 EUR kostet nach 3 Monaten Verzogerung 52,40 EUR extra.

3. PREISANPASSUNG (S. 6, Kl. 5.5): Max. 5% p.a. ohne Zustimmung. Praktische Bedeutung: Nach 5 Jahren: 890 EUR wird zu 1.136 EUR/Monat (+2.952 EUR/Jahr).

4. HAFTUNGSKAPPE (S. 12, Kl. 11.4): Maximal 3 Monatspauschen = 2.670 EUR Ersatz bei Schaden. Praktische Bedeutung: Bei Datenverlust oder langen Ausfallen ist realer Schaden oft vielfach hoher.

5. GEWAHRLEISTUNG (S. 11, Kl. 11.1): Nur 6 Monate — Gesetz schreibt 24 Monate vor. Praktische Bedeutung: Klagewege nach 6 Monaten eingeschrankt, obwohl gesetzlich 24 Monate moeglich.

6. DSGVO AVV FEHLT (S. 14, Kl. 13): Kein Auftragsverarbeitungsvertrag referenziert. Praktische Bedeutung: Rechtspflicht nach Art. 28 DSGVO verletzt — Bussgeld bis 10 Mio. EUR moeglich.

7. SLA-LUECKE (S. 9, Kl. 8.3): Reaktionszeit bei kritischen Fehlern = "angemessen" ohne Zeitangabe. Praktische Bedeutung: Keine rechtliche Handhabe bei langen Reaktionszeiten.

8. ZUSATZNUTZER (Anhang B, S. 18): 45 EUR/Monat/Nutzer extra. Praktische Bedeutung: Bei 5 Zusatznutzern: +2.700 EUR/Jahr ungeplante Kosten.

9. DATENLOSCHING (S. 15, Kl. 13.4): 90 Tage nach Vertragsende, dann unwiederbringlich geloscht. Praktische Bedeutung: Datensicherung vor Vertragsende muss selbst durchgefuhrt werden.

10. WARTUNGSFENSTER (S. 9, Kl. 8.1): Samstag 02:00-06:00 Uhr zaehlt nicht als Ausfallzeit. Praktische Bedeutung: Fuer Samstag-Betrieb kritisch — Verfugbarkeit de facto geringer.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERSTECKTE VERBINDUNGEN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERBINDUNG 1: Kl. 11.4 (Haftungskappe 2.670 EUR) + Kl. 13 (Kein AVV) = Doppeltes Katastrophenrisiko
Kl. 11.4 begrenzt den Schadensersatz auf 3 Monatspauschen (2.670 EUR). Gleichzeitig fehlt der AVV nach Art. 28 DSGVO. Im Fall eines Datenlecks beim Anbieter: Der Anbieter schuldet maximal 2.670 EUR — aber die Datenschutzbehoerde richtet ihre Busse gegen SIE als Auftraggeber, nicht gegen den Anbieter. Das bedeutet: Sie tragen das Bussgeldrisiko (bis 10 Mio. EUR), der Anbieter haftet nur 2.670 EUR. Diese Kombination ist nicht zufallig — sie ist Standardpraxis in Anbietervertragen. Massnahme: AVV zwingend erfordern UND Haftungsklausel um DSGVO-Schaden erweitern.

VERBINDUNG 2: Kl. 3.2 (3-Monatsfrist) + Kl. 5.5 (5% Preisanpassung) = Preiswachstum ohne Ausstiegsoption
Die Kuendigungsfrist betraegt 3 Monate. Die Preisanpassung wird 30 Tage vorher angekuendigt. Das bedeutet: Wenn im Mai eine Preiserhoehung kommt, haben Sie faktisch keine Moeglichkeit, noch rechtzeitig zu kuendigen — die Frist endet am 30.04. Da ist die Anpassung noch nicht angekuendigt. Ergebnis: Sie akzeptieren die neue Preisstufe oder zahlen trotzdem noch 12 Monate zum alten Preis weiter. Massnahme: Sonderkundigungsrecht bei Preisanpassung vertraglich festschreiben.

VERBINDUNG 3: Kl. 8.3 (keine Reaktionszeit) + Kl. 11.4 (Haftungskappe) = Null Handhabe bei langen Ausfallen
Kl. 8.3 definiert keine Reaktionszeit fuer kritische Fehler ("angemessen"). Kl. 11.4 begrenzt den Schadensersatz auf 2.670 EUR. Wenn Ihr System 4 Tage ausfaellt und dabei z.B. 15.000 EUR Umsatz entgeht: Sie koennen weder eine Reaktionspflicht einklagen (sie ist nicht definiert), noch den realen Schaden geltend machen (Kappe greift). Massnahme: Reaktionszeit explizit vertraglich festlegen (z.B. 4h kritisch, 24h normal).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WAS FEHLT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FEHLT 1: Auftragsverarbeitungsvertrag (AVV) — In jedem Vertrag, bei dem ein Dienstleister personenbezogene Daten verarbeitet, ist ein AVV nach DSGVO Art. 28 Pflicht. Er fehlt vollstaendig. Risiko: Direkte Compliance-Verletzung ab Vertragsstart. Was anfordern: "Bitte uebermitteln Sie uns vor Unterzeichnung einen vollstaendigen AVV gemaess Art. 28 DSGVO."

FEHLT 2: Sonderkundigungsrecht bei wesentlichen Aenderungen — Kein einziger Paragraph raeumt dem Kunden das Recht ein, bei wesentlichen Leistungsaenderungen (z.B. Einstellung des Produkts, Preiserhoehung ueber Schwellwert) ausserordentlich zu kuendigen. Das ist unueblich und einseitig. Was einfuegen: "Bei Preiserhoehungen ueber X% oder wesentlichen Leistungsaenderungen hat der Auftraggeber ein 30-taegiges Sonderkundigungsrecht."

FEHLT 3: Subunternehmerklausel — Das Dokument regelt nicht, ob der Anbieter Teilleistungen (insbesondere Datenhaltung oder Support) an Dritte auslagern darf. Falls ja, wuerden Ihre Daten moeglicherweise bei einem unbekannten Dritten liegen. Was einfuegen: "Eine Weitergabe personenbezogener Daten an Subunternehmer bedarf der vorherigen schriftlichen Zustimmung des Auftraggebers."

FEHLT 4: Eskalationsweg bei Streitigkeiten — Es gibt keinen definierten Prozess fuer den Fall, dass der Anbieter eine Leistung nicht erbringt und der Kunde reklamiert. Ohne diesen ist der einzige Weg sofort der Rechtsweg. Was einfuegen: "Bei strittigen Leistungsfragen gilt zunaechst ein 30-taegiger Mediationsversuch vor Einleitung rechtlicher Schritte."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ZAHLEN, DATEN UND BETRAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
890,00 EUR — Monatliche Grundgebur (S. 5)
14 Tage — Zahlungsziel (S. 5)
2% p.M. — Verzugszins (S. 6)
5% p.a. — Max. Preisanpassung (S. 6)
99,5% — Verfugbarkeitsgarantie pro Monat (S. 8)
3,6 Std./Monat — Erlaubte Ausfallzeit bei 99,5% (S. 8)
10% — Entschadigung pro 0,5% SLA-Unterschreitung (S. 9)
30% — Maximale Entschadigung pro Monat (S. 9)
6 Monate — Gewahrleistungsfrist (S. 11)
2.670 EUR — Haftungshoechstbetrag (S. 12)
90 Tage — Datenspeicherung nach Vertragsende (S. 15)
30 Tage — Vorankungdigungsfrist Preisanpassung (S. 6)
3 Monate — Kundigungsfrist (S. 3)
12 Monate — Verlangerungszeitraum (S. 3)
30.04.2026 — Naechste Kundigungsfrist (errechnet)
45 EUR — Preis pro Zusatznutzer/Monat (Anhang B)
120 EUR/Std. — Premium-Support (Anhang B)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RISIKEN UND KRITISCHE PUNKTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KRITISCH — Kein AVV vorhanden (S. 14): DSGVO Art. 28 verletzt. Konsequenz: Bussgeld bis 10 Mio. EUR. AVV sofort anfordern oder Vertrag nicht unterzeichnen.

KRITISCH — Kuendigungsfrist verpassbar (S. 3): Frist 30.04.2026 — bei Nichteinhaltung: 12 Monate Kostenbindung = 10.680 EUR. Sofort im Kalender eintragen.

WICHTIG — Gewahrleistung nur 6 Monate (S. 11): Gesetzlicher Anspruch 24 Monate. Konsequenz: Rechtsdurchsetzung nach Monat 7 deutlich erschwert. Nachverhandlung auf 24 Monate fordern.

WICHTIG — Haftungskappe 2.670 EUR (S. 12): Reale Schaden konnen bei Systemausfall oder Datenverlust weit hoher sein. Konsequenz: Eigene Haftpflichtversicherung pruefen.

WICHTIG — Preisanpassung ohne Zustimmung (S. 6): 5% p.a. kumulativ. Konsequenz: Unkontrollierter Kostenanstieg uber Vertragslaufzeit. Cap auf 2% oder absolute Obergrenze verhandeln.

GERING — SLA ohne Reaktionszeit (S. 9): Kein messbarer Standard bei Entstorung. Konsequenz: Bei schweren Ausfallen keine rechtliche Handhabe. Schriftliche Klarung in den Vertrag aufnehmen.

GERING — Zusatznutzerpreise nicht gedeckelt (Anhang B): Konnten jederzeit angepasst werden. Konsequenz: Planungsunsicherheit bei Teamerweiterung. Festpreis fur 24 Monate aushandeln.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LUECKEN UND FEHLENDE INFORMATIONEN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LUECKE 1: Kein AVV (Auftragsverarbeitungsvertrag) beigefugt oder referenziert (S. 14) — Rechtspflicht nach DSGVO Art. 28 — sofort vom Anbieter anfordern.

LUECKE 2: Reaktionszeit bei kritischen Fehlern nicht definiert (S. 9, Kl. 8.3) — "angemessen" ist nicht messbar — konkrete SLA-Zeiten (z.B. 4h kritisch, 24h normal) schriftlich vereinbaren.

LUECKE 3: Softwareversion nicht festgeschrieben (S. 1) — Anbieter kann Funktionsumfang durch Updates andern — Klausel "wesentliche Funktionsanderungen bedurfen Zustimmung" einfugen.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MASSNAHMENPLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. SOFORT — Kuendigungsfrist eintragen — Bis: heute noch — Wer: Geschaeftsfuhrer — Warum: Frist 30.04.2026, Verpassung = 10.680 EUR Zwangskosten.

2. SOFORT — AVV anfordern — Bis: vor Unterzeichnung — Wer: Datenschutzbeauftragter/Rechtsabteilung — Warum: Ohne AVV droht Bussgeld bis 10 Mio. EUR.

3. DIESE WOCHE — Gewahrleistung nachverhandeln — Bis: vor Vertragsabschluss — Wer: Einkauf/Rechtsabt. — Warum: 6 Monate statt 24 Monate = Rechtsverzicht uber gesetzlichem Standard.

4. DIESE WOCHE — Preisdeckel verhandeln — Bis: vor Unterzeichnung — Wer: Einkauf — Warum: 5% p.a. unkontrolliert; Cap auf 2% oder Festpreis 36 Monate vereinbaren.

5. BIS MONATSENDE — Zahlungsfristen in Buchhaltung hinterlegen — Bis: 30.04.2026 — Wer: Buchhaltung — Warum: 14 Tage Zahlungsziel, Verzug kostet 2%/Monat.

6. VOR VERTRAGSSTART — Datensicherung einrichten — Bis: Vertragsstart — Wer: IT — Warum: Daten nach Vertragsende nach 90 Tagen unwiderbringlich geloscht.

7. LANGFRISTIG — Reaktionszeit-SLA schriftlich erganzen — Bis: spatestens nach 3 Monaten als Erganzungsvereinbarung — Wer: Rechtsabteilung — Warum: Aktuell keine rechtliche Handhabe bei langen Entstorungszeiten.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DOKUMENT-QUALITAETSBEWERTUNG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Klarheit: 4/5 — Gut lesbar, Fachbegriffe klar verwendet, kaum Interpretationsspielraum.
Vollstandigkeit: 3/5 — AVV fehlt, Reaktionszeiten fehlen, Softwareversion nicht festgeschrieben.
Ausgewogenheit: 2/5 — Mehrere Klauseln einseitig zugunsten Anbieter (Haftungskappe, kurze Gewahrleistung, einseitige Preisanpassung).
Rechtssicherheit: 2/5 — DSGVO-Pflichtverletzung durch fehlenden AVV ist gravierend.
Gesamturteil: UNTERZEICHNUNG MIT ANDERUNGEN — nicht in aktueller Form empfohlen. Mindestbedingung: AVV nachliefern, Gewahrleistung auf 24 Monate, Preisdeckel vereinbaren.

Alle hochgeladenen Daten wurden nach der Analyse sicher geloscht.`
    );

    if (isEmail || isReply) return (
`📧 E-MAIL POSTFACH — VOLLSTÄNDIG SORTIERT
Zugriff: Microsoft Outlook — Posteingang
Gefundene E-Mails: ${emailCount} | Verarbeitet: ${emailCount} | Übersprungen: 0

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔴  DRINGEND — Sofort bearbeiten (3)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[1] Von: buchhaltung@lieferant-gmbh.de
    Betreff: Rechnung #2024-0847 — Zahlung überfällig
    Eingang: Heute, 08:14 Uhr
    → Offener Betrag: 1.840,00 € — Fälligkeitsdatum war gestern
    → ENTWURF bereit (siehe unten)

[2] Von: max.mueller@wichtigkunde.de
    Betreff: Angebot gewünscht bis Freitag — dringend!
    Eingang: Gestern, 17:52 Uhr
    → Kunde wartet auf Rückmeldung — Frist in 2 Tagen
    → ENTWURF bereit (siehe unten)

[3] Von: noreply@hosting-provider.com
    Betreff: ⚠️ SSL-Zertifikat läuft in 3 Tagen ab
    Eingang: Heute, 06:30 Uhr
    → Website wird ohne Erneuerung als "nicht sicher" angezeigt

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🟡  WICHTIG — Diese Woche bearbeiten (7)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[4]  Terminanfrage von Herrn Schneider — Donnerstag 14:00 Uhr
[5]  Projektupdate von deinem Entwicklerteam — Fortschrittsbericht
[6]  Bestellung #5521 wurde versandt — Tracking-Nummer anbei
[7]  Vertragsangebot von Software AG — Gültigkeit bis 30.04.2026
[8]  Feedback von Kundin Frau Weber — sehr positiv, Antwort empfohlen
[9]  Steuerberater: Unterlagen für Q1 benötigt bis Monatsende
[10] Angebot für neue Reinigungsfirma — Vergleichsangebot vorhanden

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🟢  NIEDRIG — Wenn Zeit vorhanden (8)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[11-18] Newsletter, Bestätigungsmails, automatische Benachrichtigungen,
        Werbemails, Systembenachrichtigungen — kein Handlungsbedarf

🚫  SPAM / GELÖSCHT (4)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4 E-Mails als Spam markiert und in den Papierkorb verschoben.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✉️  FERTIGE ANTWORT-ENTWÜRFE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ENTWURF 1 — An: buchhaltung@lieferant-gmbh.de
Betreff: AW: Rechnung #2024-0847

Sehr geehrte Damen und Herren,

vielen Dank für Ihre Erinnerung bezüglich der Rechnung #2024-0847.
Wir entschuldigen uns für die Verzögerung und werden die ausstehende
Zahlung in Höhe von 1.840,00 € bis spätestens 19.04.2026 begleichen.

Mit freundlichen Grüßen

───────────────────────────
ENTWURF 2 — An: max.mueller@wichtigkunde.de
Betreff: AW: Angebot — Ihre Anfrage

Sehr geehrter Herr Müller,

herzlichen Dank für Ihr Interesse. Ich freue mich, Ihnen mitteilen zu
können, dass wir Ihr gewünschtes Angebot bis Donnerstag, 18.04.2026,
ausarbeiten und Ihnen zusenden werden.

Für Rückfragen stehe ich jederzeit gerne zur Verfügung.

Mit freundlichen Grüßen

🔒 E-Mail-Zugriff wurde nach Abschluss vollständig entzogen. Alle Daten gelöscht.`
    );

    if (isReport) return (
`📊 GESCHÄFTSBERICHT — FERTIGGESTELLT
Erstellt am: ${new Date().toLocaleDateString('de-DE')}
Zeitraum: Aktuell | Status: Abgeschlossen

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋  EXECUTIVE SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Das Unternehmen zeigt eine stabile Entwicklung mit Wachstumspotenzial in 2 Kernbereichen
• Umsatz im letzten Quartal: +12% gegenüber Vorquartal — positiver Trend
• Hauptrisiko: 2 Großkunden machen 60% des Umsatzes aus — Abhängigkeit reduzieren
• Personalkapazität erreicht 85% Auslastung — Einstellung prüfen für Q3
• Kundenzufriedenheit: 4,6/5 — sehr gut, Empfehlungsrate 71%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈  WICHTIGSTE KENNZAHLEN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Umsatz (aktuell):      +12% gegenüber Vormonat
Neue Kunden:           +5 im letzten Monat
Offene Angebote:       8 (Gesamtwert: ca. 24.000 €)
Kundenzufriedenheit:   4,6 / 5,0
Pünktliche Lieferung:  94%
Reklamationsquote:     2,1% — unter Branchenschnitt

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  RISIKEN & SCHWACHSTELLEN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Kundenkonzentration: Top-2-Kunden = 60% Umsatz → Abhängigkeit verringern
2. Personalengpass: 3 offene Stellen seit > 3 Monaten → Recruiting beschleunigen
3. Zahlungsverzögerungen: Ø Zahlungsziel überschritten um 8 Tage → Mahnsystem prüfen

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅  EMPFOHLENE MASSNAHMEN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
→ Neukundenstrategie: 5 Leads pro Woche als Mindestziel setzen
→ Recruiting: Stellenausschreibungen auf 3 weiteren Plattformen schalten
→ Mahnsystem: automatische Zahlungserinnerung nach 10 Tagen einrichten
→ Q2-Ziel: Umsatzwachstum von 8% gegenüber Q1 anstreben
→ Kundenbindung: Bestandskunden-Rabatt von 5% ab Jahr 2 einführen`
    );

    return (
`✅ AUFGABE VOLLSTÄNDIG ABGESCHLOSSEN
Aufgabe: ${desc}
Fertiggestellt: ${new Date().toLocaleString('de-DE')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋  ERGEBNIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Die Aufgabe wurde vollständig und professionell abgeschlossen. Alle relevanten Informationen wurden verarbeitet, strukturiert und aufbereitet.

Die Ergebnisse sind sofort verwendbar und wurden für den direkten Einsatz im Geschäftsalltag formatiert.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅  NÄCHSTE SCHRITTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
→ Ergebnis herunterladen und speichern
→ Bei Bedarf: Neue Aufgabe starten
→ Feedback hinterlassen — hilft uns zu verbessern

🔒 Alle Daten wurden nach Abschluss sicher gelöscht.`
    );

  } else {

    if (isPDF) return (
`PDF ANALYSIS COMPLETE
File: ${fileName}
Read: completely, page 1 through to the end — no section skipped

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXECUTIVE SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Document type: Service agreement with terms of service and data protection clauses
Total scope: 18 pages, 6 chapters, 17 clauses, 2 appendices
Purpose: Long-term binding of the client to a SaaS platform — with automatic renewal and unilateral pricing rights in the provider's favour
Most critical immediate action: Cancellation deadline falls on 30 Apr 2026 — add to calendar immediately, or face automatic 12-month renewal
Plain-language verdict: I would not sign this contract in its current form. The combination of a missing DPA, a one-sided liability cap, and a price adjustment clause the client cannot veto makes it unbalanced. Two targeted renegotiations and a DPA would make it acceptable — but without those three things, this document carries real legal and financial risk.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION-BY-SECTION ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Chapter 1 — Scope of Services (pp. 1-2)
Defines the service scope: provision of a cloud-based SaaS solution for project management. Services are clearly defined. No hidden add-ons. No surprises in this section.
Note: The exact software version number is not locked in — the provider can push updates without prior consent.

Chapter 2 — Term and Cancellation (pp. 3-4)
Initial term: 12 months from signing. Thereafter: automatic renewal for 12-month periods unless cancelled in writing at least 3 months before expiry. Written notice by recorded post required — email alone is NOT sufficient.
Critical: Many businesses miss this deadline. If missed: 12 months of costs with no exit = 10,680 GBP.

Chapter 3 — Fees and Payment (pp. 5-7)
Monthly base fee: 890.00 GBP net. Payment term: 14 days from invoice date. Late payment interest: 2% per month (equivalent to 24% p.a. — well above the statutory rate). Price adjustment: up to 5% annually, 30-day advance notice by email, no consent required.
Risk: Over 5 years the monthly fee can exceed 1,136 GBP without renegotiation.

Chapter 4 — Service Level Guarantees (SLA) (pp. 8-10)
Availability guarantee: 99.5% per month (permitted downtime: approx. 3.6 hours/month). Compensation for breach: 10% of monthly fee per 0.5 percentage point below threshold, maximum 30% of one monthly fee. Maintenance windows: Saturdays 02:00-06:00, not counted as downtime.
Gap: Response time for critical failures is not defined — only "reasonable time" (GAP — written clarification recommended).

Chapter 5 — Liability and Warranty (pp. 11-13)
Warranty period: 6 months. Statutory standard: 24 months. Exclusion of liability for consequential loss, lost profit, and data loss. Maximum liability: 3 monthly fees (2,670 GBP) — regardless of actual damage incurred.
Critical: In the event of data loss caused by the provider, real damages could far exceed 2,670 GBP with no recourse.

Chapter 6 — Data Protection and Processing (pp. 14-16)
Customer data stored on servers in Germany (positive). Deletion after contract end: 90-day retention, then deleted. GDPR compliance is mentioned but no Data Processing Agreement (DPA) is included or referenced.
Critical: A DPA is mandatory under GDPR Art. 28. Without one, fines of up to 10 million EUR or 2% of annual turnover are possible.

Appendix A — Technical Specifications (p. 17)
Server location: Frankfurt am Main. Backup: daily, 30-day retention. Encryption: TLS 1.2 in transit, AES-256 at rest. Positive: technically strong standard.

Appendix B — Additional Services Price List (p. 18)
Additional users: 45 GBP/month/user. Premium support escalation: 120 GBP/hour. Training package: 890 GBP one-time. Note: These prices are not capped and can be adjusted at any time.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KEY FINDINGS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. CANCELLATION DEADLINE (p. 3, Cl. 3.2): 3 months before expiry, in writing by recorded post — next deadline: 30 Apr 2026 for expiry on 31 Jul 2026. Practical meaning: Missing this date = 12 more months locked in = 10,680 GBP unavoidable cost.

2. LATE PAYMENT INTEREST (p. 5, Cl. 5.3): 2% per month = 24% p.a. Practical meaning: An invoice of 890 GBP overdue by 3 months generates 52.40 GBP in interest charges.

3. PRICE ADJUSTMENT CLAUSE (p. 6, Cl. 5.5): Up to 5% p.a. without consent. Practical meaning: After 5 years, 890 GBP becomes 1,136 GBP/month (+2,952 GBP/year).

4. LIABILITY CAP (p. 12, Cl. 11.4): Maximum 3 monthly fees = 2,670 GBP compensation for any damage. Practical meaning: In a data loss or extended outage, real losses are routinely far higher.

5. WARRANTY PERIOD (p. 11, Cl. 11.1): Only 6 months — statute requires 24 months. Practical meaning: Legal remedies after month 6 severely restricted despite statutory entitlement.

6. GDPR DPA MISSING (p. 14, Cl. 13): No Data Processing Agreement referenced. Practical meaning: Legal obligation under GDPR Art. 28 violated — fine up to 10 million EUR possible.

7. SLA GAP — RESPONSE TIME (p. 9, Cl. 8.3): Response time for critical failures = "reasonable" with no timeframe specified. Practical meaning: No legal basis to challenge slow incident response.

8. ADDITIONAL USER PRICING (Appendix B, p. 18): 45 GBP/month/user extra. Practical meaning: 5 additional users = +2,700 GBP/year unplanned cost.

9. DATA DELETION (p. 15, Cl. 13.4): 90 days after contract end, then permanently deleted. Practical meaning: Data export must be arranged personally before contract ends.

10. MAINTENANCE WINDOW (p. 9, Cl. 8.1): Saturday 02:00-06:00 not counted as downtime. Practical meaning: For businesses operating on Saturdays, effective availability is lower than the stated 99.5%.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HIDDEN CONNECTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONNECTION 1: Cl. 11.4 (Liability cap 2,670 GBP) + Cl. 13 (No DPA) = Double catastrophe risk
Cl. 11.4 limits the provider's liability to 3 monthly fees (2,670 GBP). Simultaneously, the DPA required by GDPR Art. 28 is missing. In the event of a data breach at the provider's end: the provider owes you a maximum of 2,670 GBP — but the data protection authority directs its fine at YOU as the data controller, not at the provider. This means you bear the fine risk (up to 10 million EUR), while the provider's exposure is capped at 2,670 GBP. This combination is not accidental — it is standard practice in vendor contracts. Action: require a DPA AND extend the liability clause to explicitly cover GDPR-related damages.

CONNECTION 2: Cl. 3.2 (3-month notice) + Cl. 5.5 (5% price adjustment) = Price increase with no escape route
The cancellation notice period is 3 months. Price adjustments are announced 30 days in advance. This means: if a price increase arrives in May, you have no realistic way to cancel in time — the deadline was 30 April. By the time the new price is announced, your exit window has already closed. Result: you either accept the new price level or continue paying for another 12 months regardless. Action: negotiate a special termination right triggered by any price increase.

CONNECTION 3: Cl. 8.3 (no response time) + Cl. 11.4 (liability cap) = Zero recourse during extended outages
Cl. 8.3 defines no response time for critical failures ("reasonable time" only). Cl. 11.4 caps compensation at 2,670 GBP. If your system is down for 4 days and you lose 15,000 GBP in revenue: you cannot enforce a response deadline (it does not exist), and you cannot claim the real loss (the cap applies). Action: negotiate specific response times into the contract (e.g. 4h critical, 24h standard) before signing.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT IS MISSING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MISSING 1: Data Processing Agreement (DPA) — In any contract where a provider processes personal data, a DPA under GDPR Art. 28 is legally mandatory. It is entirely absent here. Risk: direct compliance violation from day one of the contract. What to request: "Please provide a complete DPA in accordance with GDPR Art. 28 before we proceed to signature."

MISSING 2: Special termination right for material changes — No clause gives the client the right to terminate early if the service changes materially (e.g. product discontinuation, price increase above a threshold). This is unusual and one-sided. What to add: "In the event of price increases exceeding X% or material service changes, the client retains a 30-day special termination right."

MISSING 3: Subcontractor clause — The document does not address whether the provider may sub-contract any part of the service (particularly data storage or support) to third parties. If they can, your data may end up with an unknown party without your knowledge. What to add: "Transfer of personal data to subcontractors requires prior written consent from the client."

MISSING 4: Dispute resolution pathway — There is no defined process for what happens if the provider fails to deliver a service and the client disputes it. Without one, the only option is immediate legal action. What to add: "In the event of disputed service delivery, the parties agree to a 30-day mediation period before initiating legal proceedings."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NUMBERS, DATES AND AMOUNTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
890.00 GBP — Monthly base fee (p. 5)
14 days — Payment term (p. 5)
2% p.m. — Late payment interest (p. 6)
5% p.a. — Maximum annual price increase (p. 6)
99.5% — Monthly availability guarantee (p. 8)
3.6 hours/month — Permitted downtime at 99.5% (p. 8)
10% — Compensation per 0.5% SLA breach (p. 9)
30% — Maximum monthly compensation (p. 9)
6 months — Warranty period (p. 11)
2,670 GBP — Maximum liability cap (p. 12)
90 days — Data retention after contract end (p. 15)
30 days — Advance notice period for price increases (p. 6)
3 months — Cancellation notice period (p. 3)
12 months — Auto-renewal period (p. 3)
30 Apr 2026 — Next cancellation deadline (calculated)
45 GBP — Additional user price per month (Appendix B)
120 GBP/hour — Premium support rate (Appendix B)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RISKS AND CRITICAL ATTENTION POINTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL — No DPA in place (p. 14): GDPR Art. 28 violated. Consequence: Fine up to 10 million EUR. Request DPA immediately or do not sign.

CRITICAL — Cancellation deadline easily missed (p. 3): Deadline 30 Apr 2026 — if missed: 12-month cost lock-in = 10,680 GBP. Add to calendar now.

IMPORTANT — Warranty only 6 months (p. 11): Statutory entitlement is 24 months. Consequence: Legal enforcement after month 6 severely limited. Negotiate extension to 24 months.

IMPORTANT — Liability cap at 2,670 GBP (p. 12): Real damages from system failure or data loss can be far higher. Consequence: Review your own liability insurance coverage.

IMPORTANT — Price increase without consent (p. 6): 5% p.a. compounding. Consequence: Uncontrolled cost escalation over contract term. Negotiate a 2% cap or fixed price ceiling.

LOW — SLA without response time (p. 9): No measurable standard for incident resolution. Consequence: No legal basis for challenging slow response. Add written clarification to contract.

LOW — Additional user prices not capped (Appendix B): Can be revised at any time. Consequence: Planning uncertainty when expanding the team. Negotiate fixed pricing for 24 months.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GAPS AND MISSING INFORMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GAP 1: No DPA (Data Processing Agreement) included or referenced (p. 14) — mandatory under GDPR Art. 28 — request from provider immediately.

GAP 2: Response time for critical failures not defined (p. 9, Cl. 8.3) — "reasonable time" is not measurable — agree specific SLA times in writing (e.g. 4h critical, 24h standard).

GAP 3: Software version not contractually locked (p. 1) — provider can change functionality via updates — add clause: "material feature changes require client consent."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ACTION PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. PRIORITY: IMMEDIATE — Add cancellation deadline to calendar — By: today — Who: Managing Director — Why: Deadline 30 Apr 2026; missing it = 10,680 GBP forced cost.

2. PRIORITY: IMMEDIATE — Request DPA from provider — By: before signing — Who: Data Protection Officer / Legal — Why: Without DPA, GDPR fine up to 10 million EUR possible.

3. PRIORITY: THIS WEEK — Renegotiate warranty period — By: before contract close — Who: Procurement / Legal — Why: 6 months instead of 24 months = waiving statutory entitlement.

4. PRIORITY: THIS WEEK — Negotiate price increase cap — By: before signing — Who: Procurement — Why: 5% p.a. uncapped; agree 2% cap or fixed price for 36 months.

5. PRIORITY: THIS MONTH — Enter payment deadlines in accounting software — By: 30 Apr 2026 — Who: Finance — Why: 14-day payment term; late payment costs 2%/month.

6. PRIORITY: BEFORE CONTRACT START — Set up data export and backup — By: contract start date — Who: IT — Why: Data permanently deleted 90 days after contract ends.

7. PRIORITY: LONG TERM — Add response-time SLA in a supplementary agreement — By: no later than 3 months after signing — Who: Legal — Why: Currently no legal basis to challenge slow incident resolution.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DOCUMENT QUALITY ASSESSMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Clarity:           4/5 — Well written, technical terms clearly defined, minimal ambiguity.
Completeness:      3/5 — DPA missing, response times absent, software version not locked.
Balance/Fairness:  2/5 — Multiple clauses one-sided in favour of provider (liability cap, short warranty, unilateral price increases).
Legal soundness:   2/5 — GDPR violation through missing DPA is severe.
Overall verdict:   APPROVE WITH AMENDMENTS — not recommended in current form. Minimum conditions: DPA must be added, warranty extended to 24 months, price increase cap agreed.

All uploaded files were securely deleted after analysis.`
    );

    if (isEmail || isReply) return (
`📧 EMAIL INBOX — FULLY SORTED
Access: Microsoft Outlook — Inbox
Emails found: ${emailCount} | Processed: ${emailCount} | Skipped: 0

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔴  URGENT — Act immediately (3)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[1] From: accounting@supplier-ltd.com
    Subject: Invoice #2024-0847 — Payment overdue
    Received: Today, 08:14 AM
    → Outstanding: £1,840.00 — due date was yesterday
    → DRAFT REPLY ready (see below)

[2] From: john.smith@importantclient.com
    Subject: Quote needed by Friday — urgent!
    Received: Yesterday, 5:52 PM
    → Client waiting — deadline in 2 days
    → DRAFT REPLY ready (see below)

[3] From: noreply@hosting-provider.com
    Subject: ⚠️ SSL certificate expires in 3 days
    Received: Today, 06:30 AM
    → Website will show "Not secure" without renewal

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🟡  IMPORTANT — Handle this week (7)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[4]  Meeting request from Mr. Thompson — Thursday 2:00 PM
[5]  Project update from your dev team — progress report attached
[6]  Order #5521 has been dispatched — tracking number included
[7]  Contract offer from Software Corp — valid until 30 Apr 2026
[8]  Positive feedback from client Ms. Davis — reply recommended
[9]  Accountant: Q1 documents needed by end of month
[10] Quote for new cleaning service — comparison offer available

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🟢  LOW PRIORITY — When time allows (8)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[11-18] Newsletters, confirmation emails, automated notifications,
        promotional emails, system alerts — no action required

🚫  SPAM / DELETED (4)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4 emails flagged as spam and moved to trash.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✉️  READY-TO-SEND DRAFT REPLIES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DRAFT 1 — To: accounting@supplier-ltd.com
Subject: RE: Invoice #2024-0847

Dear Sir or Madam,

Thank you for your reminder regarding invoice #2024-0847.
We sincerely apologise for the delay and confirm that the outstanding
payment of £1,840.00 will be transferred by 19 April 2026 at the latest.

Kind regards,

───────────────────────────
DRAFT 2 — To: john.smith@importantclient.com
Subject: RE: Quote Request

Dear Mr. Smith,

Thank you very much for your interest. I am pleased to confirm that
we will prepare and send you the requested quote by Thursday, 18 April 2026.

Please don't hesitate to contact me if you have any questions in the meantime.

Kind regards,

🔒 Email access was fully revoked after completion. All data deleted.`
    );

    if (isReport) return (
`📊 BUSINESS REPORT — COMPLETED
Created: ${new Date().toLocaleDateString('en-GB')}
Period: Current | Status: Finalised

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋  EXECUTIVE SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Business is showing stable growth with strong potential in 2 core areas
• Revenue last quarter: +12% vs. previous quarter — positive trend
• Key risk: 2 major clients account for 60% of revenue — reduce dependency
• Staff capacity at 85% — consider hiring for Q3
• Customer satisfaction: 4.6/5 — excellent, referral rate 71%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈  KEY METRICS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Revenue (current):     +12% vs. last month
New clients:           +5 in the past month
Open proposals:        8 (total value approx. £24,000)
Customer satisfaction: 4.6 / 5.0
On-time delivery:      94%
Complaint rate:        2.1% — below industry average

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  RISKS & WEAKNESSES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Client concentration: Top 2 clients = 60% revenue → reduce dependency
2. Staffing gap: 3 open positions for > 3 months → accelerate recruitment
3. Late payments: Average 8 days overdue → review payment reminder system

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅  RECOMMENDED ACTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
→ New clients: set minimum target of 5 leads per week
→ Recruitment: post vacancies on 3 additional platforms
→ Payment reminders: set up automatic follow-up after 10 days
→ Q2 target: 8% revenue growth vs. Q1
→ Client retention: introduce 5% loyalty discount from year 2 onwards`
    );

    return (
`✅ TASK FULLY COMPLETED
Task: ${desc}
Completed: ${new Date().toLocaleString('en-GB')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋  RESULT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The task has been completed fully and professionally. All relevant information was processed, structured, and prepared for immediate use.

The results are formatted for direct use in your day-to-day business operations.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅  NEXT STEPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
→ Download and save your result
→ Start a new task if needed
→ Leave feedback — it helps us improve

🔒 All data was securely deleted after completion.`
    );
  }
}

function isRealAIEnabled() {
  return true; // API key stored on server (Vercel env var)
}

// =====================
// BRAND COLORS
// =====================
function pickBrandColor(hex, btn) {
  localStorage.setItem('brand_primary', hex);
  // Update active swatch highlight
  document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active-swatch'));
  if (btn) btn.classList.add('active-swatch');
  // Sync custom color picker value
  const custom = document.getElementById('brand-color-custom');
  if (custom) custom.value = hex;
}

function initBrandColorSwatches() {
  const saved = localStorage.getItem('brand_primary') || '#2563eb';
  const custom = document.getElementById('brand-color-custom');
  if (custom) custom.value = saved;
  const swatches = document.querySelectorAll('.color-swatch[data-color]');
  swatches.forEach(s => {
    s.classList.toggle('active-swatch', s.dataset.color === saved);
  });
}

function saveBrandColors() {
  const primary   = document.getElementById('brand-primary-color').value;
  const secondary = document.getElementById('brand-secondary-color').value;
  const company   = document.getElementById('brand-company-name').value.trim();
  localStorage.setItem('brand_primary',   primary);
  localStorage.setItem('brand_secondary', secondary);
  localStorage.setItem('brand_company',   company);
  const st = document.getElementById('brand-colors-status');
  st.style.display = 'block';
  setTimeout(() => { st.style.display = 'none'; }, 2500);
}

function getBrandColors() {
  const hex2rgb = h => {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
    return r ? [parseInt(r[1],16), parseInt(r[2],16), parseInt(r[3],16)] : null;
  };
  const accent = hex2rgb(localStorage.getItem('brand_primary') || '#2563eb') || [37, 99, 235];
  // Auto-derive dark version: mix accent with near-black at 22% accent strength
  const navy = accent.map(c => Math.round(c * 0.22 + 8));
  return {
    accent,
    navy,
    company: localStorage.getItem('brand_company') || '',
  };
}

function loadBrandColorsIntoUI() {
  const p = document.getElementById('brand-primary-color');
  const s = document.getElementById('brand-secondary-color');
  const c = document.getElementById('brand-company-name');
  if (p) p.value = localStorage.getItem('brand_primary')   || '#2563eb';
  if (s) s.value = localStorage.getItem('brand_secondary') || '#0f172a';
  if (c) c.value = localStorage.getItem('brand_company')   || '';
}

// =====================
// FORGOT / RESET PASSWORD
// =====================
function showForgotPassword(show = true) {
  document.getElementById('form-login').style.display   = show ? 'none' : 'flex';
  document.getElementById('forgot-panel').style.display = show ? 'flex' : 'none';
  if (!show) document.getElementById('forgot-msg').textContent = '';
}

async function handleForgotPassword() {
  const email = (document.getElementById('forgot-email').value || '').trim().toLowerCase();
  const msgEl = document.getElementById('forgot-msg');
  if (!email) { msgEl.style.color='#f87171'; msgEl.textContent='Bitte E-Mail eingeben.'; return; }

  msgEl.style.color = '#94a3b8';
  msgEl.textContent = 'Sende E-Mail…';

  try {
    const res  = await fetch('/api/send-reset', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Fehler beim Senden');
    msgEl.style.color = '#4ade80';
    msgEl.textContent = '✓ E-Mail gesendet! Bitte prüfe deinen Posteingang.';
  } catch (err) {
    msgEl.style.color = '#f87171';
    msgEl.textContent = err.message;
  }
}

async function handleResetPassword() {
  const token = window._resetToken;
  const newPw = (document.getElementById('reset-new-pw').value || '').trim();
  const msgEl = document.getElementById('reset-msg');
  if (newPw.length < 8) { msgEl.style.color='#f87171'; msgEl.textContent='Min. 8 Zeichen.'; return; }

  msgEl.style.color = '#94a3b8'; msgEl.textContent = 'Prüfe Token…';
  try {
    const res  = await fetch('/api/verify-reset', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error);

    const email = data.email.toLowerCase();
    if (email === OWNER_EMAIL) throw new Error('Owner-Passwort kann hier nicht geändert werden.');

    const users = JSON.parse(localStorage.getItem('ai_agent_users') || '[]');
    const idx   = users.findIndex(u => u.email.toLowerCase() === email);
    if (idx === -1) {
      // User not in this device's localStorage yet — add them with new password
      users.push({ name: email.split('@')[0], email, password: newPw });
    } else {
      users[idx].password = newPw;
    }
    localStorage.setItem('ai_agent_users', JSON.stringify(users));

    msgEl.style.color = '#4ade80';
    msgEl.textContent = '✓ Passwort gespeichert! Du wirst jetzt angemeldet…';

    // Remove token from URL and auto-login
    window.history.replaceState({}, '', window.location.pathname);
    setTimeout(() => {
      document.getElementById('reset-panel').style.display = 'none';
      document.getElementById('form-login').style.display  = 'flex';
      document.getElementById('login-email').value    = email;
      document.getElementById('login-password').value = newPw;
      document.getElementById('form-login').dispatchEvent(new Event('submit'));
    }, 1500);
  } catch (err) {
    msgEl.style.color = '#f87171';
    msgEl.textContent = err.message;
  }
}

function checkResetToken() {
  const params = new URLSearchParams(window.location.search);
  const token  = params.get('reset');
  if (!token) return false;
  window._resetToken = token;

  // Force-show auth modal regardless of login state on this device
  const overlay = document.getElementById('auth-modal');
  if (overlay) { overlay.style.display = 'flex'; overlay.classList.remove('hidden'); }
  document.getElementById('form-login').style.display   = 'none';
  document.getElementById('forgot-panel').style.display = 'none';
  document.getElementById('form-signup').style.display  = 'none';
  const rp = document.getElementById('reset-panel');
  if (rp) rp.style.display = 'flex';

  // Decode email from token payload for display (no server call yet)
  try {
    const payload = token.split('.')[0];
    const decoded = atob(payload.replace(/-/g,'+').replace(/_/g,'/'));
    const email   = decoded.split('|')[0];
    const lbl     = document.getElementById('reset-email-label');
    if (lbl) lbl.textContent = email;
  } catch (_) {}

  return true; // signals DOMContentLoaded to skip loadAuth()
}

// =====================
// PDF TEXT EXTRACTION (PDF.js)
// =====================
async function extractPDFText(file) {
  if (typeof pdfjsLib === 'undefined') throw new Error('PDF.js nicht geladen');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const typedArray = new Uint8Array(e.target.result);
        const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
        const totalPages = pdf.numPages;
        const PAGE_HARD_LIMIT = 150;
        const maxPages = Math.min(totalPages, PAGE_HARD_LIMIT);
        if (totalPages > PAGE_HARD_LIMIT) {
          console.warn(`PDF hat ${totalPages} Seiten — nur erste ${PAGE_HARD_LIMIT} werden verarbeitet`);
        }

        // Extract each page with table-aware reconstruction (#9)
        async function extractPage(i) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const items = content.items;
          if (!items.length) return '';

          // Group items by row (y-coordinate within 4 units = same row)
          const rows = {};
          items.forEach(item => {
            if (!item.str.trim()) return;
            const y = Math.round(item.transform[5] / 4) * 4;
            if (!rows[y]) rows[y] = [];
            rows[y].push({ x: item.transform[4], text: item.str });
          });

          // Sort rows top-to-bottom (PDF y is bottom-up), cells left-to-right
          const sortedRows = Object.entries(rows)
            .sort(([a], [b]) => Number(b) - Number(a))
            .map(([_, cells]) => {
              const sorted = cells.sort((a, b) => a.x - b.x).map(c => c.text);
              // If row has multiple cells with clear x-gaps → format as table row
              if (sorted.length > 2) return sorted.join(' | ');
              return sorted.join(' ');
            });

          return sortedRows.join('\n').replace(/[ \t]+/g, ' ').trim();
        }

        let allPages = [];
        for (let i = 1; i <= maxPages; i++) {
          const pageText = await extractPage(i);
          if (pageText.length > 10) allPages.push({ page: i, text: pageText });
        }

        // Smart chunking (#6): if too long, keep first 40% + last 60% (intro + conclusions)
        let fullText = `[Dokument: ${file.name} | ${totalPages} Seiten]\n\n`;
        const MAX_CHARS = 110000;
        const allCombined = allPages.map(p => `--- Seite ${p.page} ---\n${p.text}`).join('\n\n');

        if (allCombined.length <= MAX_CHARS) {
          fullText += allCombined;
        } else {
          const front = Math.floor(MAX_CHARS * 0.4);
          const back  = MAX_CHARS - front;
          const frontText = allCombined.slice(0, front);
          const backText  = allCombined.slice(-back);
          fullText += frontText + '\n\n[... mittlere Seiten übersprungen — Anfang & Ende priorisiert ...]\n\n' + backText;
        }

        if (totalPages > maxPages) {
          fullText += `\n[Hinweis: Dokument hat ${totalPages} Seiten. Erste ${maxPages} analysiert.]`;
        }
        resolve(fullText);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// =====================
// BUILD PROMPT FOR REAL AI
// =====================

// Detect document type for tailored prompt (#1)
function detectDocType(filename, taskDesc) {
  const t = (filename + ' ' + taskDesc).toLowerCase();
  if (/(geschäftsbericht|jahresbericht|annual.?report|geschaeftsbericht|quartalsbericht|konzernbericht|quarterly|q[1-4]\s*20\d\d|halbjahresbericht|interim.?report)/.test(t)) return 'geschaeftsbericht';
  if (/(vertrag|contract|agreement|vereinbarung|lizenz|mietvertrag|kaufvertrag|dienstleistungsvertrag|nda|terms.of)/.test(t)) return 'vertrag';
  if (/(jahresabschluss|bilanz|gewinn.verlust|balance.sheet|income.statement|ifrs|gaap|buchführung|buchfuehrung|cashflow|p&l)/.test(t)) return 'jahresabschluss';
  if (/(rechnung|invoice|faktura|angebot|quotation)/.test(t)) return 'rechnung';
  if (/(protokoll|minutes|meeting|sitzung|besprechung)/.test(t)) return 'protokoll';
  return 'allgemein';
}

// Detect language from the task description text
function detectLanguage(text) {
  const t = text.toLowerCase();
  const deWords = ['ich','bitte','und','der','die','das','ein','für','mit','auf','von','zu','an','ist','sind','habe','mach','schreib','analysiere','fasse','erstell','gib','zeig','kannst','soll','bitte','zusammenfassung','bericht','dokument','vertrag','rechnung'];
  const deScore = deWords.filter(w => t.includes(w)).length;
  if (deScore >= 2) return 'de';
  // Add more languages if needed in future
  return 'en';
}

function buildPrompt(taskDesc, businessDetails, docText, docType, analysisLength) {
  const writtenLang = detectLanguage(taskDesc);
  const isDE = writtenLang === 'de';
  const businessCtx = businessDetails
    ? (isDE ? `Kontext des Unternehmens: ${businessDetails}\n` : `Business context: ${businessDetails}\n`)
    : '';

  // Doc-type specific section templates (#1, #4)
  const docTypeSections = {
    geschaeftsbericht: isDE
      ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KENNZAHLEN AUF EINEN BLICK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Alle wichtigen Zahlen als: Bezeichnung: Wert (z.B. Umsatz 2024: €1,2 Mrd. | Wachstum: +12% | EBITDA-Marge: 18%). JEDE Zeile = eine Kennzahl.]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXECUTIVE SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Kompaktes Fazit: Wie läuft das Unternehmen? Was sind die wichtigsten Botschaften des Berichts?]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
JAHRESVERGLEICH & ENTWICKLUNG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Vergleich mit Vorjahr: Was ist besser geworden, was schlechter? Konkrete Zahlen und Prozent-Veränderungen nennen, inkl. Seitenreferenz (laut Seite X).]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SEGMENTANALYSE & MARKTPOSITION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Welche Bereiche/Segmente laufen gut, welche schwächeln? Marktposition und Wettbewerbsstellung.]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RISIKEN & CHANCEN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Alle genannten Risiken und Chancen — quantifiziert wo möglich, mit Seitenreferenz.]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUSBLICK & HANDLUNGSEMPFEHLUNGEN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Prognose des Unternehmens für die Zukunft + konkrete Empfehlungen für Investoren/Management]`
      : `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KEY METRICS AT A GLANCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[All key numbers as: Label: Value (e.g. Revenue 2024: €1.2bn | Growth: +12% | EBITDA margin: 18%). ONE metric per line.]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXECUTIVE SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Compact conclusion: How is the company performing? What are the report's key messages?]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YEAR-ON-YEAR COMPARISON & TRENDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Compare to prior year: what improved, what declined? Specific numbers and % changes, with page references (see page X).]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SEGMENT ANALYSIS & MARKET POSITION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Which segments are performing well, which are struggling? Market and competitive position.]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RISKS & OPPORTUNITIES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[All stated risks and opportunities — quantified where possible, with page reference.]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTLOOK & RECOMMENDATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Company's own forecast + concrete recommendations for investors/management]`,

    vertrag: isDE
      ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KENNZAHLEN AUF EINEN BLICK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Alle wichtigen Zahlen/Fristen als: Bezeichnung: Wert (z.B. Laufzeit: 24 Monate | Kündigungsfrist: 3 Monate | Preissteigerung: 5% p.a.). JEDE Zeile = ein Wert.]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXECUTIVE SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Kernaussage: Worum geht es, wer sind die Parteien, was sind die Hauptpflichten?]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KRITISCHE KLAUSELN & RISIKEN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Alle einseitigen, riskanten oder ungewöhnlichen Klauseln — mit Klausel-Nummer und Seitenangabe (laut Seite X).]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FRISTEN & TERMINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Alle Fristen, Laufzeiten, Kündigungsfristen, Verlängerungsklauseln — konkret]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EMPFEHLUNG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Unterschreiben? Was nachverhandeln? Konkrete Punkte.]`
      : `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KEY METRICS AT A GLANCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[All key numbers/deadlines as: Label: Value (e.g. Term: 24 months | Notice period: 3 months | Price increase: 5% p.a.). ONE value per line.]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXECUTIVE SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Core: what is this about, who are the parties, what are the main obligations?]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL CLAUSES & RISKS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[All one-sided, risky or unusual clauses — with clause number and page reference (see page X).]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEADLINES & TERMS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[All deadlines, terms, notice periods, renewal clauses — specific dates]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RECOMMENDATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Sign or not? What to renegotiate? Specific points.]`,

    create_document: isDE
      ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EINLEITUNG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Zweck und Hintergrund des Dokuments — klar und professionell.]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HAUPTTEIL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Strukturierter Hauptinhalt mit klaren Unterabschnitten. Vollständig ausgearbeitet gemäß Aufgabe.]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DETAILS & ERLÄUTERUNGEN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Alle relevanten Details, Hintergründe, Begründungen — professionell und präzise formuliert.]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FAZIT & NÄCHSTE SCHRITTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Abschluss und konkrete nächste Schritte.]`
      : `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INTRODUCTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Purpose and background of the document — clear and professional.]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MAIN CONTENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Structured main content with clear subsections. Fully developed per the task.]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DETAILS & EXPLANATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[All relevant details, background, reasoning — professional and precise.]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONCLUSION & NEXT STEPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Closing and concrete next steps.]`,

    create_report: isDE
      ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXECUTIVE SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Die wichtigsten Erkenntnisse und Empfehlungen in 3-5 Sätzen.]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANALYSE & ERKENNTNISSE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Ausführliche Analyse mit allen relevanten Erkenntnissen, strukturiert und nummeriert.]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RISIKEN & CHANCEN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Alle relevanten Risiken und Chancen — quantifiziert und bewertet.]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HANDLUNGSEMPFEHLUNGEN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Konkrete, umsetzbare Empfehlungen mit klaren Prioritäten und Zeitrahmen.]`
      : `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXECUTIVE SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Key findings and recommendations in 3-5 sentences.]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANALYSIS & FINDINGS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Detailed analysis with all relevant findings, structured and numbered.]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RISKS & OPPORTUNITIES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[All relevant risks and opportunities — quantified and assessed.]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RECOMMENDATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Concrete, actionable recommendations with clear priorities and timeframes.]`,

    create_reply: isDE
      ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANTWORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Professionelle, vollständige Antwort — im richtigen Ton, direkt umsetzbar.]`
      : `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REPLY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Professional, complete reply — right tone, ready to send.]`,

    allgemein: isDE
      ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KENNZAHLEN AUF EINEN BLICK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Alle wichtigen Zahlen/Werte aus dem Dokument als: Bezeichnung: Wert. JEDE Zeile = ein Wert. Falls keine Zahlen vorhanden, diesen Abschnitt weglassen.]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXECUTIVE SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Kompaktes Fazit]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HAUPTERKENNTNISSE & ANALYSE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Die wichtigsten Punkte, gut strukturiert, mit Seitenangaben (laut Seite X).]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RISIKEN & CHANCEN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Konkrete Risiken und Chancen]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NÄCHSTE SCHRITTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Klarer Aktionsplan]`
      : `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KEY METRICS AT A GLANCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[All important numbers from the document as: Label: Value. ONE per line. Omit if no numbers present.]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXECUTIVE SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Compact conclusion]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KEY FINDINGS & ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Most important points, well structured, with page references (see page X).]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RISKS & OPPORTUNITIES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Concrete risks and opportunities]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NEXT STEPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Clear action plan]`
  };

  // Calculate page-count-based targets (#2 — length control)
  // Detect source page count from docText header "[Dokument: name | X Seiten]"
  const pageMatch = docText.match(/\|\s*(\d+)\s*Seit/i);
  const sourcePages = pageMatch ? parseInt(pageMatch[1]) : 0;
  let shortTarget, mediumTarget, longTarget;
  if (sourcePages > 0) {
    // Percentage of source: short=12.5%, medium=25%, long=50%
    shortTarget  = isDE ? `ca. ${Math.max(2, Math.round(sourcePages * 0.125))} Seiten (12,5% des Originals mit ${sourcePages} Seiten)` : `approx. ${Math.max(2, Math.round(sourcePages * 0.125))} pages (12.5% of the ${sourcePages}-page original)`;
    mediumTarget = isDE ? `ca. ${Math.max(4, Math.round(sourcePages * 0.25))} Seiten (25% des Originals)`  : `approx. ${Math.max(4, Math.round(sourcePages * 0.25))} pages (25% of original)`;
    longTarget   = isDE ? `ca. ${Math.max(8, Math.round(sourcePages * 0.5))} Seiten (50% des Originals)`   : `approx. ${Math.max(8, Math.round(sourcePages * 0.5))} pages (50% of original)`;
  } else {
    shortTarget  = isDE ? 'ca. 3 Seiten (700-900 Wörter)'    : 'approx. 3 pages (700-900 words)';
    mediumTarget = isDE ? 'ca. 5 Seiten (1400-1800 Wörter)'  : 'approx. 5 pages (1400-1800 words)';
    longTarget   = isDE ? 'ca. 8-10 Seiten (2500-3500 Wörter)' : 'approx. 8-10 pages (2500-3500 words)';
  }
  const depthInstructions = {
    short: isDE
      ? `AUSGABELÄNGE: KURZ — Ziel ${shortTarget}.
• Nur die wichtigsten Erkenntnisse — kein Fließtext, keine Wiederholungen.
• Tabellen NUR wenn mehr als 4 Zahlen direkt vergleichbar sind.
• Keine Grafiken — Zahlen als Stichpunkte genügen.
• Jeder Satz trägt einen eigenständigen Informationswert.`
      : `OUTPUT LENGTH: SHORT — Target ${shortTarget}.
• Key findings only — no prose, no repetition.
• Tables ONLY if more than 4 numbers are directly comparable.
• No charts — bullet-point numbers suffice.
• Every sentence must carry independent information value.`,
    medium: isDE
      ? `AUSGABELÄNGE: MITTEL — Ziel ${mediumTarget}.
• Deutlich umfangreicher als Kurz: jeder Abschnitt vollständig ausgeführt mit Kontext und Begründung.
• TABELLEN PFLICHT: Jede Zahlenreihe, jeder Vergleich, jedes Vor-/Nachteil-Paar → als Markdown-Tabelle.
• MAXIMAL 2 GRAFIKEN — nur wenn mindestens 4 reale Datenpunkte vorhanden: die eine wichtigste Entwicklung als [CHART:line|...] oder [CHART:bar|...].
• Kennzahlen-Abschnitt vollständig befüllen.
• Risiken und Chancen jeweils mit Begründung.`
      : `OUTPUT LENGTH: MEDIUM — Target ${mediumTarget}.
• Clearly more extensive than short: every section fully developed with context and reasoning.
• TABLES MANDATORY: Every data series, comparison, pros/cons → as Markdown table.
• MAXIMUM 2 CHARTS — only if at least 4 real data points exist: the single most important trend as [CHART:line|...] or [CHART:bar|...].
• Fill the key metrics section completely.
• Risks and opportunities each with justification.`,
    long: isDE
      ? `AUSGABELÄNGE: LANG — Ziel ${longTarget}.
• MAXIMALE TIEFE — deutlich länger als Mittel: Jede Kennzahl einzeln kommentiert, jede Aussage mit Seitenreferenz belegt.
• TABELLEN ÜBERALL: Jede Liste, jeder Vergleich, jede Zahlenreihe → Markdown-Tabelle. Kein Fließtext für Daten.
• MAXIMAL 5 ESSENTIELLE GRAFIKEN — wähle nur die aussagekräftigsten aus: Überblende nicht mit Grafiken. Qualität vor Quantität.
  - Wichtigste Entwicklung über Zeit → [CHART:line|Titel|Jahr:Wert,...]
  - Wichtigster Kategorienvergleich → [CHART:bar|Titel|Kat:Wert,...]
  - Wichtigste Anteile (nur wenn wirklich relevant) → [CHART:pie|Titel|Kat:Wert,...]
• TIEFEN-ANALYSE in allen 5 Dimensionen vollständig ausführen — keine Dimension kürzen.
• Anomalie-Bericht: jeden Fund einzeln bewerten mit 🔴/🟡/🟢 und konkreter Handlungsempfehlung.
• Alle Abschnitte auf maximale Substanz bringen — kein Abschnitt darf kürzer als 3 Sätze sein.`
      : `OUTPUT LENGTH: LONG — Target ${longTarget}.
• MAXIMUM DEPTH — significantly longer than medium: every metric individually commented, every claim backed by page reference.
• TABLES EVERYWHERE: Every list, comparison, data series → Markdown table. No prose for data.
• MAXIMUM 5 ESSENTIAL CHARTS — choose only the most impactful ones: do not overwhelm with charts. Quality over quantity.
  - Most important trend over time → [CHART:line|Title|Year:Value,...]
  - Most important category comparison → [CHART:bar|Title|Cat:Value,...]
  - Most important shares (only if truly relevant) → [CHART:pie|Title|Cat:Value,...]
• DEEP ANALYSIS in all 5 dimensions fully developed — no dimension shortened.
• Anomaly report: rate each finding individually with 🔴/🟡/🟢 and concrete recommended action.
• All sections at maximum substance — no section shorter than 3 sentences.`
  };

  const sections = docTypeSections[docType] || docTypeSections['allgemein'];
  const depth = depthInstructions[analysisLength] || depthInstructions['medium'];
  const learningCtx = getLearningContext(isDE);

  const docTypeLabels = {
    de: { geschaeftsbericht: 'Geschäftsbericht', vertrag: 'Vertrag', jahresabschluss: 'Jahresabschluss', rechnung: 'Rechnung', protokoll: 'Protokoll', allgemein: 'Dokument' },
    en: { geschaeftsbericht: 'Business Report', vertrag: 'Contract', jahresabschluss: 'Financial Statement', rechnung: 'Invoice', protokoll: 'Meeting Minutes', allgemein: 'Document' }
  };
  const dtLabel = docTypeLabels[isDE ? 'de' : 'en'][docType.replace('create_','')] || 'Dokument';
  const isCreation = docType.startsWith('create_');

  const personaDE = (docType === 'create_reply')
    ? `Du bist ein erfahrener E-Mail-Texter. Schreibe jetzt die fertige, sofort versendbare E-Mail — mit allen Angaben, die der Nutzer gemacht hat. Keine Vorlage, keine Platzhalter, keine Optionen. Einfach die echte E-Mail.

${businessCtx}${learningCtx}
${taskDesc}

REGELN:
• Schreibe die E-Mail DIREKT — beginne mit "Betreff:" und dann der Anrede.
• Benutze alle oben angegebenen Informationen (Empfänger, Thema, Inhalt, Ton).
• Keine Platzhalter wie [NAME] oder [ERGÄNZEN] — der Nutzer hat alles angegeben.
• Keine Erklärungen vor oder nach der E-Mail — nur die E-Mail selbst.
• Aktive Sprache, max. 3–4 Absätze, klare Handlungsaufforderung am Ende.
• Ton: ${taskDesc.match(/TON:\s*(.+)/)?.[1] || 'professionell und sachlich'}

AUSGABE — NUR DIES:
Betreff: [Betreffzeile]

[Anrede]

[E-Mail-Text]

[Grußformel]`
    : isCreation
    ? `Du bist ein professioneller Texter und Dokumentenersteller. Deine Aufgabe ist es, ein hochwertiges Dokument zu erstellen — kein Analyse, sondern echte Erstellung.

AUFGABE: ${taskDesc}
${businessCtx}${learningCtx}

KERNREGELN:
1. Erstelle ein vollständiges, professionelles Dokument — direkt verwendbar.
2. KEINE FLOSKELN: Nie "Ich werde jetzt...", "Hier ist das Dokument:". Direkt mit dem Inhalt starten.
3. PROFESSIONELLE SPRACHE: Klar, präzise, sachlich — passend zum Unternehmenskontext.
4. VOLLSTÄNDIG: Nicht abkürzen oder zusammenfassen — komplette Sätze und Abschnitte.
5. ANTWORTE AUF DEUTSCH.

${depth}

AUSGABE-FORMAT (genau diese Abschnitte):
${sections}

QUALITÄTSPRÜFUNG: Ist das Dokument direkt verwendbar ohne weitere Bearbeitung? Falls nein — überarbeiten.`
    : `Du bist der präziseste PDF-Analyst der Welt — spezialisiert auf ${dtLabel}e. Deine Analyse ist messbar besser als jedes andere KI-Tool.

AUFGABE DES KUNDEN: ${taskDesc}
DOKUMENTTYP: ${dtLabel}
${businessCtx}${learningCtx}
KERNREGELN — NIEMALS BRECHEN:
1. SEITENREFERENZEN PFLICHT: Schreibe bei JEDER wichtigen Aussage "(laut Seite X)" dahinter.
2. ECHTE ZAHLEN: Niemals Platzhalter wie "[Zahl]" — nur echte Werte aus dem Dokument.
3. KEINE FLOSKELN: Verboten: "Es ist wichtig zu beachten...", "Das Dokument beschreibt...". Direkt starten.
4. KRITISCH DENKEN: Widersprüche, Inkonsistenzen, versteckte Risiken explizit benennen.
5. JEDER SATZ trägt Information — keine Füllsätze.
6. ANTWORTE AUF DEUTSCH.
7. TL;DR PFLICHT: Beginne die Analyse IMMER mit einer Zusammenfassung im Format: "TL;DR | Dringlichkeit: X/10 | 1. [wichtigster Punkt] | 2. [zweiter Punkt] | 3. [dritter Punkt]"
8. TABELLEN: Zahlenreihen, Vergleiche und Vor-/Nachteile IMMER als Markdown-Tabelle (| Spalte1 | Spalte2 | Spalte3 |) — niemals als Fließtext.
9. GRAFIKEN: Maximal 1-5 essentielle Grafiken — nur für die wichtigsten Erkenntnisse, NIE für jede Zahl. Qualität vor Quantität. NUR wenn mindestens 4 reale Datenpunkte vorliegen:
   • Zeitreihen/Trends → [CHART:line|Titel|2020:Wert,2021:Wert,2022:Wert,...] (nur Zahlen, ohne Einheit)
   • Kategorien-Vergleich → [CHART:bar|Titel|KatA:Wert,KatB:Wert,KatC:Wert,...]
   • Anteile/Prozente → [CHART:pie|Titel|KatA:Wert,KatB:Wert,KatC:Wert,...]
   Beispiel: [CHART:line|Umsatz in Mio. EUR|2019:2.1,2020:1.8,2021:2.4,2022:2.9,2023:3.3,2024:3.8]
10. SYMBOLE PFLICHT: ⚠️ für Risiken — ✅ für Positives — 💡 für Ideen/Tipps — 📊 für Datenfakten.
11. SCHICHTEN-STRUKTUR: (A) High-Level: Was ist das Dokument? (2 Sätze) — (B) Deep-Dive: Detaillierte Analyse — (C) Annex: Technische Details am Ende.
12. STRUKTUR-BAUKASTEN PFLICHT — jede Analyse enthält diese 5 Blöcke:
    • EXECUTIVE DASHBOARD: Die 3 kritischsten Erkenntnisse auf einen Blick.
    • FAKTEN-CHECK: Tabelle mit ALLEN wichtigen Zahlen, Daten und harten Zusagen.
    • KLEINGEDRUCKT-ANALYSE: Alle Einschränkungen, Risiken oder Bedingungen die den Erfolg gefährden.
    • ANOMALIE-BERICHT: Alles was ungewöhnlich, widersprüchlich oder neu im Vergleich zu Standard-Dokumenten ist.
    • HANDLUNGSEMPFEHLUNG: Was sollte der Leser als nächstes konkret tun?
13. ANOMALIE-FOKUS — suche aktiv nach diesen Warnsignalen und benenne sie explizit:
    • Dramatische Änderungen: Zahlen oder Kennwerte die sich um mehr als 20% verändert haben.
    • Widersprüche: Aussagen die sich innerhalb des Dokuments widersprechen.
    • Ungewöhnliche Formulierungen: Abschwächungen, Hedge-Sätze oder unklare Zusagen im Vergleich zu Vorjahren.
    • Fehlende Informationen: Was wird NICHT erwähnt, obwohl es bei diesem Dokumenttyp standard wäre?
    • Timing-Anomalien: Fristen, Daten oder Deadlines die auffällig kurz oder unüblich sind.
    • Für jeden Anomalie-Fund: Bewertung 🔴 Kritisch / 🟡 Auffällig / 🟢 Beobachten.
14. TIEFEN-ANALYSE in 5 Dimensionen — wende diese auf jedes Dokument an:
    • DIE EXPLIZITE BOTSCHAFT ("Was"-Faktor): Was behauptet das Dokument offiziell? Welche strategische Richtung wird kommuniziert?
    • DIE KRITISCHE LÜCKE ("Blinder Fleck"): Was fehlt zwischen den Zeilen? Was wird heruntergespielt oder bewusst weggelassen?
    • DIE DATEN-LOGIK ("Realitäts-Check"): Sind die Zahlen kohärent? Wetten die Zahlen auf eine Zukunft die nicht eintreten muss?
    • OPERATIVE EFFIZIENZ: Wird hier wirklich optimiert oder nur schöngerechnet? Wie entwickeln sich Margen und Kosten pro Einheit?
    • INNOVATIONS-ARCHITEKTUR: Wird nur optimiert oder neu erfunden? Welche Investments deuten auf langfristige strukturelle Veränderungen hin?

${depth}

AUSGABE-FORMAT (genau diese Abschnitte, in dieser Reihenfolge):
${sections}

QUALITÄTSPRÜFUNG:
- Habe ich im Abschnitt "KENNZAHLEN" alle wichtigen Zahlen als "Bezeichnung: Wert" eingetragen?
- Hat jede wichtige Aussage eine Seitenreferenz (laut Seite X)?
- Überschreite ich die Mindestlänge?`;

  const personaEN = (docType === 'create_reply')
    ? `You are an experienced email copywriter. Write the finished, ready-to-send email now — using all the details the user has provided. No template, no placeholders, no options. Just the actual email.

${businessCtx}${learningCtx}
${taskDesc}

RULES:
• Write the email DIRECTLY — start with "Subject:" then the greeting.
• Use all the information provided above (recipient, topic, content, tone).
• No placeholders like [NAME] or [ADD] — the user has provided everything.
• No explanations before or after the email — only the email itself.
• Active voice, max 3–4 paragraphs, clear call to action at the end.
• Tone: ${taskDesc.match(/TONE:\s*(.+)/)?.[1] || 'professional and factual'}

OUTPUT — ONLY THIS:
Subject: [subject line]

[Greeting]

[Email body]

[Sign-off]`
    : isCreation
    ? `You are a professional writer and document creator. Your task is to create a high-quality document — not an analysis, but actual creation.

TASK: ${taskDesc}
${businessCtx}${learningCtx}
CORE RULES:
1. Create a complete, professional document — directly usable.
2. NO FILLER: Never "I will now...", "Here is the document:". Start directly with content.
3. PROFESSIONAL LANGUAGE: Clear, precise, formal — appropriate to the business context.
4. COMPLETE: Do not abbreviate or summarise — full sentences and sections.
5. RESPOND IN ENGLISH.

${depth}

OUTPUT FORMAT (exactly these sections):
${sections}

QUALITY CHECK: Is the document directly usable without further editing? If not — revise.`
    : `You are the world's most precise PDF analyst — specialised in ${dtLabel}s. Your analysis is measurably better than any other AI tool.

CLIENT TASK: ${taskDesc}
DOCUMENT TYPE: ${dtLabel}
${businessCtx}${learningCtx}
CORE RULES — NEVER BREAK:
1. PAGE REFERENCES MANDATORY: After EVERY important claim write "(see page X)".
2. REAL NUMBERS: Never use placeholders like "[number]" — only actual values from the document.
3. NO FILLER: Banned: "It is important to note...", "The document describes...". Start directly.
4. THINK CRITICALLY: Name contradictions, inconsistencies, hidden risks explicitly.
5. EVERY SENTENCE carries information — no padding.
6. RESPOND IN ENGLISH.
7. TL;DR MANDATORY: Always begin with: "TL;DR | Urgency: X/10 | 1. [most important] | 2. [second] | 3. [third]"
8. TABLES: Data series, comparisons, pros/cons ALWAYS as Markdown table (| Col1 | Col2 | Col3 |) — never as prose.
9. CHARTS: Maximum 1-5 essential charts — only for the most important insights, NEVER for every number. Quality over quantity. Only when at least 4 real data points exist:
   • Time series/trends → [CHART:line|Title|2020:Value,2021:Value,2022:Value,...] (numbers only, no units)
   • Category comparison → [CHART:bar|Title|CatA:Value,CatB:Value,CatC:Value,...]
   • Proportions/percentages → [CHART:pie|Title|CatA:Value,CatB:Value,CatC:Value,...]
   Example: [CHART:line|Revenue in M EUR|2019:2.1,2020:1.8,2021:2.4,2022:2.9,2023:3.3,2024:3.8]
10. SYMBOLS MANDATORY: ⚠️ for risks — ✅ for positives — 💡 for ideas/tips — 📊 for data facts.
11. LAYERED STRUCTURE: (A) High-Level: What is this document? (2 sentences) — (B) Deep-Dive: Detailed analysis — (C) Annex: Technical details at the end.
12. STRUCTURE TOOLKIT MANDATORY — every analysis contains these 5 blocks:
    • EXECUTIVE DASHBOARD: The 3 most critical findings at a glance.
    • FACT CHECK: Table with ALL important numbers, dates and hard commitments.
    • FINE PRINT ANALYSIS: All limitations, risks or conditions that could jeopardise success.
    • ANOMALY REPORT: Everything unusual, contradictory or new compared to standard documents of this type.
    • RECOMMENDED ACTION: Based on the content — what should the reader do next, concretely?
13. ANOMALY FOCUS — actively search for these warning signals and name them explicitly:
    • Dramatic changes: Numbers or metrics that changed by more than 20%.
    • Contradictions: Statements that contradict each other within the document.
    • Unusual language: Hedging, softened commitments or vague promises compared to previous periods.
    • Missing information: What is NOT mentioned that would be standard for this document type?
    • Timing anomalies: Deadlines or dates that are unusually short or atypical.
    • For each anomaly found: Rating 🔴 Critical / 🟡 Notable / 🟢 Watch.
14. DEEP ANALYSIS in 5 dimensions — apply these to every document:
    • THE EXPLICIT MESSAGE ("What" factor): What does the document officially claim? What strategic direction is communicated?
    • THE CRITICAL GAP ("Blind Spot"): What is missing between the lines? What is downplayed or deliberately omitted?
    • DATA LOGIC ("Reality Check"): Are the numbers coherent? Do the figures bet on a future that may not materialise?
    • OPERATIONAL EFFICIENCY: Is this genuine optimisation or just cosmetic accounting? How are margins and unit costs trending?
    • INNOVATION ARCHITECTURE: Optimisation only, or genuine reinvention? Which investments signal long-term structural change?

${depth}

OUTPUT FORMAT (exactly these sections, in this order):
${sections}

QUALITY CHECK:
- Have I entered all key numbers as "Label: Value" in the METRICS section?
- Does every important claim have a page reference (see page X)?
- Am I meeting the minimum length?`;

  const hasDoc = docText && docText.length > 50;

  // For email writing with an attached document: special PDF-as-context block
  if (docType === 'create_reply' && hasDoc) {
    const pdfInstruction = isDE
      ? `\n\n━━━ KRITISCHE ANWEISUNG — ZWINGEND EINHALTEN ━━━
Schreibe AUSSCHLIESSLICH die E-Mail. Erstelle keinen Analysebericht, keine Zusammenfassung und kein Inhaltsverzeichnis zum Dokument. Das Dokument dient NUR als Wissensbasis für die Fakten in der Mail.

DIREKTSTART: Beginne deine Antwort sofort mit den Betreffzeilen-Optionen. Kein einziges Wort davor.

STRIKTE VERBOTE — NIEMALS BRECHEN:
❌ Kein Analysebericht, keine Zusammenfassung, kein Inhaltsverzeichnis
❌ Kein "Ich habe das Dokument gelesen..." oder "Laut Seite X..." oder "Das PDF zeigt..."
❌ Keine Erklärung, dass ein Dokument vorhanden ist
❌ Kein Satz, der nicht direkt Teil der E-Mail ist
❌ Kein Kommentar nach der E-Mail ("Ich hoffe, das hilft..." etc.)

INFORMATIONS-EXTRAKTION: Suche im Dokument nur nach den 2–3 Fakten, die für den Empfänger der Mail wirklich relevant sind. Ignoriere alles andere.

DER EINZIGE ERLAUBTE OUTPUT:
• 3 Betreff-Optionen (A/B/C)
• Die fertige E-Mail (Anrede → Inhalt → CTA → Grußformel)
• Optional: 1–2 [ERGÄNZEN]-Markierungen für persönliche Details

━━━ DOKUMENT (nur als Wissensbasis — NICHT analysieren, NICHT erwähnen) ━━━\n${docText}`
      : `\n\nIMPORTANT: The document below is background knowledge only. Do NOT analyse it, summarise it, or mention it. Use only the 2–3 facts relevant to the email. Start your response directly with "Subject:".

━━━ DOCUMENT (background only — do NOT analyse or mention) ━━━\n${docText}`;
    return (isDE ? personaDE : personaEN) + pdfInstruction;
  }

  const docSection = (!isCreation && hasDoc)
    ? `\n\n━━━ QUELLDOKUMENT ━━━\n${docText}`
    : '';
  return (isDE ? personaDE : personaEN) + docSection;
}

// =====================
// VISUAL PDF RENDERING — renders pages to JPEG for Gemini Vision
// =====================
async function renderPDFPagesToImages(file) {
  if (typeof pdfjsLib === 'undefined') throw new Error('PDF.js nicht geladen');
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const totalPages = pdf.numPages;
  const pagesToRender = totalPages;
  const images = [];

  for (let i = 1; i <= pagesToRender; i++) {
    const page = await pdf.getPage(i);
    // scale 1.2 → ~714×1010px for A4 — still sharp enough for Gemini, ~50-70 KB per page
    const viewport = page.getViewport({ scale: 1.2 });
    const canvas = document.createElement('canvas');
    canvas.width  = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    images.push(canvas.toDataURL('image/jpeg', 0.42).split(',')[1]);
  }

  return { images, totalPages, renderedPages: pagesToRender };
}

// =====================
// REAL AI ENGINE — replaces demo mode when API key is set
// =====================
async function runRealAI(taskDesc, businessDetails, analysisLength) {
  const fn = uploadedPDFs.length > 0 ? uploadedPDFs[0].name : '';
  const taskKind = currentShortcutType || detectTaskType(taskDesc);
  // reply always = email creation, even with PDF (PDF = context only, never triggers analysis mode)
  const isCreationTask = taskKind === 'reply' || ((taskKind === 'document' || taskKind === 'report') && uploadedPDFs.length === 0);
  const docType = taskKind === 'reply' ? 'create_reply' : (isCreationTask ? ('create_' + taskKind) : detectDocType(fn, taskDesc));
  window.currentDocType = docType;

  let docText = '';
  let pageImages = [];   // base64 JPEG strings sent to Gemini Vision
  let totalPages  = 0;
  let fileUri     = null;  // Gemini File API URI (bypasses Vercel size limit)
  let fileMimeType = null;

  if (uploadedPDFs.length > 0) {
    const imageFiles = uploadedPDFs.filter(isImageFile);
    const pdfFiles   = uploadedPDFs.filter(f => !isImageFile(f));

    // ── Step 0: try Gemini File API for PDFs (1M context, no Vercel size limit)
    if (pdfFiles.length > 0) {
      try {
        setProgress(10, currentLang === 'de'
          ? 'PDF wird zu Gemini hochgeladen (1M Kontext)...'
          : 'Uploading PDF to Gemini (1M context)...');
        const pdfFile = pdfFiles[0];
        const arrayBuf = await pdfFile.arrayBuffer();

        // Step A: get a resumable upload URL from our server (keeps API key secret)
        const initRes = await fetch('/api/initiate-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: pdfFile.name, mimeType: 'application/pdf', fileSize: arrayBuf.byteLength }),
        });

        if (initRes.ok) {
          const { uploadUrl } = await initRes.json();
          if (uploadUrl) {
            setProgress(20, currentLang === 'de'
              ? 'PDF-Daten werden direkt zu Google übertragen...'
              : 'Transferring PDF data directly to Google...');

            // Step B: upload raw PDF bytes directly from browser to Google (bypasses Vercel)
            const uploadRes = await fetch(uploadUrl, {
              method: 'POST',
              headers: {
                'X-Goog-Upload-Offset': '0',
                'X-Goog-Upload-Command': 'upload, finalize',
              },
              body: arrayBuf,
            });

            if (uploadRes.ok) {
              const uploadData = await uploadRes.json();
              fileUri     = uploadData.file?.uri;
              fileMimeType = uploadData.file?.mimeType || 'application/pdf';
              totalPages  = 1;
              console.log('[File API] Upload successful:', fileUri);
            } else {
              console.warn('[File API] Upload step failed:', uploadRes.status);
            }
          }
        } else {
          console.warn('[File API] Init failed:', initRes.status);
        }
      } catch (err) {
        console.warn('[File API] Upload failed, falling back to visual rendering:', err.message);
      }
    }

    // ── Step 1: images uploaded directly → read as base64 for Gemini Vision
    if (!fileUri && imageFiles.length > 0) {
      setProgress(10, currentLang === 'de'
        ? 'Bilder werden geladen...'
        : 'Loading images...');
      for (const imgFile of imageFiles.slice(0, 10)) {
        try {
          const b64 = await new Promise((res, rej) => {
            const r = new FileReader();
            r.onload = e => res(e.target.result.split(',')[1]);
            r.onerror = rej;
            r.readAsDataURL(imgFile);
          });
          pageImages.push(b64);
          totalPages++;
        } catch (err) {
          console.warn('Image read failed:', err);
        }
      }
    }

    // ── Step 2: render PDF pages as images (fallback when File API unavailable)
    if (!fileUri && pdfFiles.length > 0) {
      setProgress(15, currentLang === 'de'
        ? 'PDF wird als Bilder gerendert (visuelle Analyse)...'
        : 'Rendering PDF pages for visual analysis...');
      try {
        const rendered = await renderPDFPagesToImages(pdfFiles[0]);
        pageImages  = [...pageImages, ...rendered.images];
        totalPages  += rendered.totalPages;
      } catch (err) {
        console.warn('Visual rendering failed, falling back to text:', err);
      }
    }

    // ── Step 3: text extraction (used as context in fallback path; skipped for File API)
    if (!fileUri) {
      setProgress(25, currentLang === 'de'
        ? 'Text wird extrahiert (für lange Dokumente)...'
        : 'Extracting text (for long documents)...');
      for (const file of pdfFiles) {
        try {
          const text = await extractPDFText(file);
          docText += text + '\n\n';
        } catch (err) {
          docText += `[Fehler beim Lesen von ${file.name}: ${err.message}]\n\n`;
        }
      }
      if (imageFiles.length > 0 && pdfFiles.length === 0) {
        docText = `[Bilder hochgeladen: ${imageFiles.map(f => f.name).join(', ')}]`;
      }
      const textLimit = pageImages.length > 0 ? 15000 : 80000;
      if (docText.length > textLimit) {
        docText = docText.slice(0, textLimit) + '\n\n[Text gekürzt — visuelle Analyse liefert vollständige Abdeckung]';
      }
    } else {
      docText = `[Dokument via Gemini File API hochgeladen: ${uploadedPDFs[0].name} — vollständige Analyse aller Seiten]`;
    }
  } else {
    docText = `[Kein Dokument hochgeladen. Aufgabe basiert nur auf der Beschreibung: ${taskDesc}]`;
  }

  setProgress(40, currentLang === 'de' ? 'KI analysiert das Dokument...' : 'AI is analysing the document...');

  const prompt = buildPrompt(taskDesc, businessDetails, docText, docType, analysisLength);

  startProgressAnimation(60, 95, 50000, currentLang === 'de' ? 'KI denkt und schreibt die Analyse...' : 'AI is thinking and writing the analysis...');

  let result;

  // Build request body — File API path sends fileUri; fallback path sends inline images
  let analyseBody;
  if (fileUri) {
    analyseBody = { prompt, fileUri, fileMimeType };
  } else {
    // Trim images to stay under Vercel's ~4.5MB CDN body limit
    const MAX_IMG_BYTES = 3.2 * 1024 * 1024;
    let trimmedImages = pageImages;
    const totalImgBytes = pageImages.reduce((s, b) => s + b.length * 0.75, 0);
    if (totalImgBytes > MAX_IMG_BYTES) {
      let cumBytes = 0;
      trimmedImages = [];
      for (const img of pageImages) {
        const imgBytes = img.length * 0.75;
        if (cumBytes + imgBytes > MAX_IMG_BYTES) break;
        trimmedImages.push(img);
        cumBytes += imgBytes;
      }
      console.warn(`[analyse] Payload trimmed from ${pageImages.length} to ${trimmedImages.length} pages`);
    }
    analyseBody = { prompt, images: trimmedImages };
  }

  // Always route through server proxy — API key stored securely in Vercel env vars
  const response = await fetchWithTimeout('/api/analyse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(analyseBody)
  }, 295000); // 295s browser timeout — matches Vercel 300s function limit

  // Guard against non-JSON error responses (e.g. HTTP 413 "Request Entity Too Large")
  let data;
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const msg = response.status === 413
      ? (currentLang === 'de' ? 'Dokument zu groß — bitte ein kürzeres PDF verwenden.' : 'Document too large — please use a shorter PDF.')
      : `HTTP ${response.status}: ${text.slice(0, 120)}`;
    stopProgressAnimation();
    throw new Error(msg);
  }
  try { data = await response.json(); } catch {
    stopProgressAnimation();
    throw new Error(currentLang === 'de' ? 'Ungültige Serverantwort erhalten.' : 'Invalid server response received.');
  }
  if (data.error) { stopProgressAnimation(); throw new Error(data.error); }
  if (!data.result) { stopProgressAnimation(); throw new Error(currentLang === 'de' ? 'Keine Antwort von der KI erhalten.' : 'No response received from AI.'); }
  result = data.result;
  window.lastAnalysedPages = data.pagesAnalysed ?? totalPages;

  const currentPct = parseInt(document.getElementById('progress-fill').style.width) || 95;
  startProgressAnimation(currentPct, 100, 600, currentLang === 'de' ? 'Fertig!' : 'Done!');
  await new Promise(r => setTimeout(r, 650));
  stopProgressAnimation();
  return result;
}

// =====================
// SCROLL REVEAL — below the fold (IntersectionObserver)
// Hero animation is handled purely by CSS (@keyframes fadeSlideUp in style.css)
// =====================
function initScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const delay = parseFloat(entry.target.dataset.srDelay || 0);
      setTimeout(() => {
        entry.target.style.opacity   = '1';
        entry.target.style.transform = 'none';
      }, delay);
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  const groups = [
    { sel: '.pdf-highlight .section-chip',           delay: 0   },
    { sel: '.pdf-hl-left h2',                        delay: 80  },
    { sel: '.pdf-hl-left > p',                       delay: 160 },
    { sel: '.pdf-hl-features li',                    delay: 80,  stagger: 80  },
    { sel: '.pdf-hl-actions',                        delay: 400 },
    { sel: '.pdf-preview-card',                      delay: 200 },
    { sel: '.other-services .section-chip',          delay: 0   },
    { sel: '.other-services h2',                     delay: 80  },
    { sel: '.other-services .os-subtitle',           delay: 160 },
    { sel: '.os-card',                               delay: 60,  stagger: 90  },
    { sel: '.character-section h2',                  delay: 0   },
    { sel: '.character-section > p',                 delay: 80  },
    { sel: '.character-card',                        delay: 100, stagger: 130 },
    { sel: '.whydiff-inner .section-chip',           delay: 0   },
    { sel: '.whydiff-inner h2',                      delay: 80  },
    { sel: '.whydiff-intro',                         delay: 160 },
    { sel: '.whydiff-col',                           delay: 80,  stagger: 140 },
    { sel: '.forwho-inner .section-chip',            delay: 0   },
    { sel: '.forwho-inner h2',                       delay: 80  },
    { sel: '.forwho-sub',                            delay: 160 },
    { sel: '.forwho-card',                           delay: 60,  stagger: 100 },
    { sel: '.testimonials-section h2, .reviews-section h2', delay: 0 },
    { sel: '.testimonial-card, .review-card',        delay: 60,  stagger: 90  },
    { sel: '.steps-section h2, .how-it-works h2',   delay: 0   },
    { sel: '.step',                                  delay: 60,  stagger: 100 },
    { sel: '.pricing-section h2',                    delay: 0   },
    { sel: '.pricing-card',                          delay: 80,  stagger: 120 },
    { sel: '.stats-grid .stat-item',                 delay: 60,  stagger: 80  },
    { sel: '.sp-card',                               delay: 60,  stagger: 80  },
  ];

  groups.forEach(({ sel, delay, stagger }) => {
    document.querySelectorAll(sel).forEach((el, i) => {
      if (el.closest('.hero')) return;
      srHide(el);
      el.dataset.srDelay = String(delay + (stagger ? i * stagger : 0));
      observer.observe(el);
    });
  });
}

// =====================
// INIT
// =====================
document.addEventListener('DOMContentLoaded', () => {
  setLang(currentLang);
  initBrandColorSwatches();

  const hasResetToken = checkResetToken();
  if (!hasResetToken) {
    const saved = localStorage.getItem('ai_agent_user');
    if (saved) {
      loadAuth();
    } else {
      document.getElementById('cookie-overlay').style.display = 'flex';
    }
  }
  renderTestimonials();
  initCharacterSelection();
  checkDueTasks();
  initScrollReveal();
});

// ── Support Chat Widget ──
let chatHistory = [];
let chatOpen = false;

function toggleChat() {
  chatOpen = !chatOpen;
  const panel = document.getElementById('chat-panel');
  const badge = document.getElementById('chat-badge');
  if (chatOpen) {
    panel.classList.remove('hidden');
    badge.classList.add('hidden');
    document.getElementById('chat-input').focus();
  } else {
    panel.classList.add('hidden');
  }
}

function sendQuickReply(btn) {
  const de = currentLang !== 'en';
  const text = de ? btn.dataset.de : btn.dataset.en;
  document.getElementById('chat-quick-replies')?.remove();
  sendChatMessage(text);
}

async function sendChatMessage(overrideText) {
  const input = document.getElementById('chat-input');
  const text = (overrideText || input.value.trim());
  if (!text) return;
  if (!overrideText) input.value = '';

  appendChatMsg('user', text);

  const typingId = 'ct-' + Date.now();
  const typingEl = document.createElement('div');
  typingEl.id = typingId;
  typingEl.className = 'chat-msg bot';
  typingEl.innerHTML = '<div class="chat-typing"><span></span><span></span><span></span></div>';
  document.getElementById('chat-messages').appendChild(typingEl);
  scrollChatBottom();

  try {
    const r = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history: chatHistory.slice(-20), lang: currentLang })
    });
    const data = await r.json();
    document.getElementById(typingId)?.remove();
    if (data.error) throw new Error(data.error);
    const reply = data.reply || (currentLang === 'en' ? 'Sorry, no response received.' : 'Keine Antwort erhalten.');
    appendChatMsg('bot', reply);
    chatHistory.push({ role: 'user', text }, { role: 'model', text: reply });
  } catch (err) {
    document.getElementById(typingId)?.remove();
    const errMsg = currentLang === 'en' ? 'Connection error. Please try again.' : 'Verbindungsfehler. Bitte versuche es erneut.';
    appendChatMsg('bot', errMsg);
    console.error('[chat]', err);
  }
}

function appendChatMsg(role, text) {
  const msgs = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = `chat-msg ${role}`;
  const now = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  div.innerHTML = `<div class="chat-bubble">${text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/\n/g,'<br>')}</div><div class="chat-time">${now}</div>`;
  msgs.appendChild(div);
  scrollChatBottom();
}

function scrollChatBottom() {
  const msgs = document.getElementById('chat-messages');
  if (msgs) msgs.scrollTop = msgs.scrollHeight;
}
