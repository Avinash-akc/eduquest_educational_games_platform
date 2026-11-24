/* ---------- Sound ---------- */
let soundEnabled = true, audioCtx = null;
function playTone(type) {
  if (!soundEnabled) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    if (type === 'correct') {
      osc.type = 'sine';
      [523.25, 659.25, 783.99].forEach((f, i) => osc.frequency.setValueAtTime(f, now + i * 0.09));
      gain.gain.setValueAtTime(0.15, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now); osc.stop(now + 0.35);
    } else if (type === 'wrong') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, now); osc.frequency.linearRampToValueAtTime(155, now + 0.25);
      gain.gain.setValueAtTime(0.15, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now); osc.stop(now + 0.3);
    } else {
      osc.type = 'sine';
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => osc.frequency.setValueAtTime(f, now + i * 0.1));
      gain.gain.setValueAtTime(0.16, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc.start(now); osc.stop(now + 0.55);
    }
  } catch (e) {}
}
function toggleSound() {
  soundEnabled = !soundEnabled;
  document.getElementById('sound-btn').textContent = soundEnabled ? '🔊' : '🔇';
  showToast(soundEnabled ? 'Sound effects enabled' : 'Sound effects muted');
}

/* ---------- Metadata ---------- */
const CATEGORIES = [
  { id: "Science", title: "Science", icon: "🔬", grad: "linear-gradient(135deg,#6366f1,#2563eb)", desc: "Explore the laws of the universe across Physics, Chemistry, and Biology.", sub: true, label: "45 Questions (3 Branches)" },
  { id: "Mathematics", title: "Mathematics", icon: "📐", grad: "linear-gradient(135deg,#10b981,#0d9488)", desc: "Sharpen your logic with algebra, geometry, probability, and number theory.", label: "15 Questions" },
  { id: "Social Science", title: "Social Science", icon: "🌍", grad: "linear-gradient(135deg,#f59e0b,#ea580c)", desc: "Journey through world history, civics, economics, and global geography.", label: "15 Questions" },
  { id: "General Knowledge", title: "General Knowledge", icon: "💡", grad: "linear-gradient(135deg,#a855f7,#db2777)", desc: "Test your awareness of world landmarks, art, astronomy, and discoveries.", label: "15 Questions" },
  { id: "Good & Bad Habits", title: "Good & Bad Habits", icon: "🌱", grad: "linear-gradient(135deg,#06b6d4,#0284c7)", desc: "Master healthy routines, study techniques, digital safety, and wellness.", label: "15 Questions" }
];
const ACHIEVEMENTS = [
  { icon: "🎯", title: "First Steps", desc: "Complete your first quiz", check: u => u.history.length >= 1 },
  { icon: "⚡", title: "Rising Scholar", desc: "Earn 250+ Total XP", check: u => u.xp >= 250 },
  { icon: "👑", title: "Grand Master", desc: "Earn 1,000+ Total XP", check: u => u.xp >= 1000 },
  { icon: "💎", title: "Flawless Victory", desc: "Score 100% on any quiz", check: u => u.history.some(h => h.accuracy === 100) },
  { icon: "🔥", title: "Deep Diver", desc: "Complete a 15-question quiz", check: u => u.history.some(h => h.total >= 15) },
  { icon: "🌈", title: "Polymath", desc: "Play 3 different subjects", check: u => new Set(u.history.map(h => h.category.split(':')[0])).size >= 3 }
];

/* ---------- Storage & State ---------- */
const USERS_KEY = 'eduquest_users_v2', SESSION_KEY = 'eduquest_active_email_v2';
let currentUser = null;
let setupState = { category: 'Science', subcategory: 'Physics', count: 10, useTimer: true };
let activeQuiz = { timerInterval: null };
const $ = id => document.getElementById(id);

function getUsersDB() { try { return JSON.parse(localStorage.getItem(USERS_KEY)) || {}; } catch { return {}; } }
function saveUsersDB(db) { localStorage.setItem(USERS_KEY, JSON.stringify(db)); }
function persistCurrentUser() {
  if (!currentUser) return;
  const db = getUsersDB(); db[currentUser.email] = currentUser; saveUsersDB(db);
}

/* ---------- Auth ---------- */
function showAuthForm(name) {
  ['login', 'register', 'forgot'].forEach(f => $(f + '-form').classList.toggle('hidden', f !== name));
}
function switchAuthTab(tab) {
  showAuthForm(tab);
  $('tab-login').classList.toggle('active', tab === 'login');
  $('tab-register').classList.toggle('active', tab === 'register');
}
function showForgot(e) {
  e.preventDefault();
  $('forgot-email').value = $('login-email').value;
  showAuthForm('forgot');
}
function hideForgot(e) { e.preventDefault(); switchAuthTab('login'); }

function handleReset(e) {
  e.preventDefault();
  const email = $('forgot-email').value.trim().toLowerCase();
  const newPass = $('forgot-password').value;
  const db = getUsersDB();
  if (!db[email]) { showToast('No account found with this email.', 'error'); return; }
  db[email].password = newPass;
  saveUsersDB(db);
  $('forgot-password').value = '';
  $('login-email').value = email;
  switchAuthTab('login');
  showToast('Password updated! Please log in.', 'success');
}

function handleRegister(e) {
  e.preventDefault();
  const name = $('reg-name').value.trim();
  const email = $('reg-email').value.trim().toLowerCase();
  const password = $('reg-password').value;
  const grade = $('reg-grade').value;
  const db = getUsersDB();
  if (db[email]) {
    showToast('An account with this email already exists. Please log in.', 'error');
    switchAuthTab('login'); $('login-email').value = email; return;
  }
  const user = { name, email, password, grade, xp: 0, streak: 1, lastActiveDate: new Date().toDateString(), history: [] };
  db[email] = user; saveUsersDB(db);
  loginUserSession(user);
  showToast(`Welcome to EduQuest, ${name}! Account created.`, 'success');
}
function handleLogin(e) {
  e.preventDefault();
  const email = $('login-email').value.trim().toLowerCase();
  const user = getUsersDB()[email];
  if (!user || user.password !== $('login-password').value) {
    showToast('Invalid email or password. Try "Forgot password?" or Guest Login.', 'error'); return;
  }
  updateDailyStreak(user);
  loginUserSession(user);
  showToast(`Welcome back, ${user.name}!`, 'success');
}
function handleDemoLogin() {
  const db = getUsersDB(), email = 'guest@eduquest.demo';
  if (!db[email]) {
    db[email] = { name: 'Alex Explorer', email, password: 'demo', grade: 'High School', xp: 180, streak: 3,
      lastActiveDate: new Date().toDateString(),
      history: [{ category: 'Science:Physics', title: 'Science • Physics', score: 4, total: 5, accuracy: 80, xp: 90, date: 'Yesterday' }] };
    saveUsersDB(db);
  }
  loginUserSession(db[email]);
  showToast('Signed in as Demo Guest!', 'success');
}
function updateDailyStreak(user) {
  const today = new Date().toDateString();
  if (user.lastActiveDate !== today) {
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    user.streak = user.lastActiveDate === yesterday ? (user.streak || 0) + 1 : 1;
    user.lastActiveDate = today;
  }
}
function loginUserSession(user) {
  currentUser = user;
  localStorage.setItem(SESSION_KEY, user.email);
  persistCurrentUser();
  $('auth-view').classList.add('hidden');
  $('app-shell').classList.remove('hidden');
  navigateTo('dashboard');
}
function handleLogout() {
  clearInterval(activeQuiz.timerInterval);
  currentUser = null;
  localStorage.removeItem(SESSION_KEY);
  $('app-shell').classList.add('hidden');
  $('auth-view').classList.remove('hidden');
  switchAuthTab('login');
  showToast('Signed out successfully.');
}

/* ---------- Navigation & Dashboard ---------- */
function navigateTo(view) {
  clearInterval(activeQuiz.timerInterval);
  ['dashboard', 'quiz', 'results'].forEach(v => $(v + '-view').classList.toggle('hidden', v !== view));
  if (view === 'dashboard') refreshDashboardUI();
}
const calculateLevel = xp => Math.floor(xp / 250) + 1;

function refreshDashboardUI() {
  if (!currentUser) return;
  const level = calculateLevel(currentUser.xp), total = currentUser.history.length;
  const avg = total ? Math.round(currentUser.history.reduce((a, h) => a + h.accuracy, 0) / total) : 0;
  const unlocked = ACHIEVEMENTS.filter(a => a.check(currentUser)).length;
  $('nav-avatar').textContent = currentUser.name.charAt(0).toUpperCase();
  $('nav-username').textContent = currentUser.name;
  $('nav-grade').textContent = currentUser.grade;
  $('nav-level').textContent = `Lvl ${level}`;
  $('nav-xp').textContent = `${currentUser.xp} XP`;
  $('dash-welcome-name').textContent = currentUser.name.split(' ')[0];
  $('dash-streak-badge').textContent = `${currentUser.streak || 1} Day Learning Streak`;
  $('stat-xp').textContent = currentUser.xp.toLocaleString();
  $('stat-level-sub').textContent = `Level ${level} Scholar`;
  $('stat-quizzes').textContent = total;
  $('stat-accuracy').textContent = `${avg}%`;
  $('stat-badges').textContent = `${unlocked} / ${ACHIEVEMENTS.length}`;
  $('categories-grid').innerHTML = CATEGORIES.map(c => `
    <div class="cat" onclick="openSetupModal('${c.id}')">
      <div class="cat-top"><div class="cat-icon" style="background:${c.grad}">${c.icon}</div><span class="tag">${c.label}</span></div>
      <h4>${c.title}</h4><p>${c.desc}</p>
      <div class="cat-foot"><span>${c.sub ? 'Physics • Chemistry • Biology' : '5, 10, or 15 Questions'}</span><span>Start ›</span></div>
    </div>`).join('');
}

/* ---------- Setup Modal ---------- */
function openSetupModal(id) {
  const c = CATEGORIES.find(x => x.id === id); if (!c) return;
  setupState.category = id;
  $('setup-icon').textContent = c.icon;
  $('setup-title').textContent = c.title;
  $('setup-desc').textContent = c.desc;
  $('setup-subcategory-section').classList.toggle('hidden', !c.sub);
  if (c.sub) selectSubcategory(setupState.subcategory);
  selectQuestionCount(setupState.count);
  $('setup-modal').classList.remove('hidden');
}
function closeSetupModal() { $('setup-modal').classList.add('hidden'); }
function selectSubcategory(sub) {
  setupState.subcategory = sub;
  document.querySelectorAll('.subcat-btn').forEach(b => b.classList.toggle('sel', b.dataset.sub === sub));
}
function selectQuestionCount(n) {
  setupState.count = n;
  document.querySelectorAll('.qcount-btn').forEach(b => b.classList.toggle('sel', Number(b.dataset.count) === n));
}

/* ---------- Quiz Engine ---------- */
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function startConfiguredQuiz() {
  setupState.useTimer = $('setup-timer-toggle').checked;
  closeSetupModal();
  const sci = setupState.category === 'Science';
  const bankKey = sci ? `Science:${setupState.subcategory}` : setupState.category;
  const displayTitle = sci ? `Science • ${setupState.subcategory}` : setupState.category;
  const pool = QUESTION_BANK[bankKey] || [];
  const questions = shuffleArray(pool).slice(0, Math.min(setupState.count, pool.length));
  activeQuiz = { bankKey, displayTitle, questions, currentIndex: 0, score: 0, xpEarned: 0, answered: false,
    timerInterval: null, timeLeft: 30, startTime: Date.now(), reviewLog: [] };
  $('quiz-category-badge').textContent = displayTitle;
  $('quiz-q-total').textContent = questions.length;
  $('quiz-timer-box').classList.toggle('hidden', !setupState.useTimer);
  navigateTo('quiz');
  renderCurrentQuestion();
}
function renderCurrentQuestion() {
  clearInterval(activeQuiz.timerInterval);
  activeQuiz.answered = false;
  const { currentIndex: idx, questions } = activeQuiz, q = questions[idx];
  const pct = Math.round(idx / questions.length * 100);
  $('quiz-q-current').textContent = idx + 1;
  $('quiz-live-score').textContent = activeQuiz.score;
  $('quiz-progress-pct').textContent = pct + '%';
  $('quiz-progress-bar').style.width = Math.max(6, pct) + '%';
  $('quiz-question-text').textContent = q.q;
  $('quiz-feedback-box').classList.add('hidden');
  $('quiz-next-btn').classList.add('hidden');
  $('quiz-options-container').innerHTML = q.options.map((o, i) =>
    `<button type="button" class="q-opt" onclick="submitAnswer(${i})"><span>${'ABCD'[i]}</span>${o}</button>`).join('');
  if (setupState.useTimer) {
    activeQuiz.timeLeft = 30; updateTimerDisplay();
    activeQuiz.timerInterval = setInterval(() => {
      activeQuiz.timeLeft--; updateTimerDisplay();
      if (activeQuiz.timeLeft <= 0) { clearInterval(activeQuiz.timerInterval); submitAnswer(-1); }
    }, 1000);
  }
}
function updateTimerDisplay() {
  $('quiz-timer-text').textContent = activeQuiz.timeLeft + 's';
  $('quiz-timer-box').classList.toggle('low', activeQuiz.timeLeft <= 8);
}
function submitAnswer(sel) {
  if (activeQuiz.answered) return;
  activeQuiz.answered = true;
  clearInterval(activeQuiz.timerInterval);
  const q = activeQuiz.questions[activeQuiz.currentIndex], ok = sel === q.ans;
  let gained = 0;
  if (ok) {
    activeQuiz.score++;
    gained = 20 + (setupState.useTimer && activeQuiz.timeLeft >= 15 ? 5 : 0);
    activeQuiz.xpEarned += gained;
    playTone('correct');
  } else playTone('wrong');
  $('quiz-live-score').textContent = activeQuiz.score;
  activeQuiz.reviewLog.push({ question: q.q, userAnswer: sel >= 0 ? q.options[sel] : 'Timed Out ⏱️',
    correctAnswer: q.options[q.ans], isCorrect: ok, explanation: q.exp });
  document.querySelectorAll('.q-opt').forEach((b, i) => {
    b.disabled = true;
    if (i === q.ans) b.classList.add('correct');
    else if (i === sel) b.classList.add('wrong');
    else b.classList.add('dim');
  });
  const fb = $('quiz-feedback-box');
  fb.className = ok ? 'good' : 'bad';
  $('quiz-feedback-title').textContent = ok ? `✓ Correct! (+${gained} XP)`
    : `✕ ${sel === -1 ? "Time's Up!" : 'Not quite!'} Correct answer: ${q.options[q.ans]}`;
  $('quiz-feedback-explanation').textContent = q.exp;
  const done = Math.round((activeQuiz.currentIndex + 1) / activeQuiz.questions.length * 100);
  $('quiz-progress-pct').textContent = done + '%';
  $('quiz-progress-bar').style.width = done + '%';
  const last = activeQuiz.currentIndex === activeQuiz.questions.length - 1;
  $('quiz-next-btn').textContent = last ? 'See Final Results' : 'Next Question';
  $('quiz-next-btn').classList.remove('hidden');
}
function nextQuestion() {
  if (activeQuiz.currentIndex < activeQuiz.questions.length - 1) { activeQuiz.currentIndex++; renderCurrentQuestion(); }
  else finishQuiz();
}
function confirmQuitQuiz() { navigateTo('dashboard'); showToast('Quiz exited.'); }

/* ---------- Results ---------- */
function finishQuiz() {
  playTone('complete');
  const total = activeQuiz.questions.length, score = activeQuiz.score;
  const accuracy = Math.round(score / total * 100);
  const sec = Math.max(1, Math.round((Date.now() - activeQuiz.startTime) / 1000));
  const time = sec >= 60 ? `${Math.floor(sec / 60)}m ${sec % 60}s` : `${sec}s`;
  const xp = activeQuiz.xpEarned + 25;
  if (currentUser) {
    currentUser.xp += xp;
    currentUser.history.unshift({ category: activeQuiz.bankKey, title: activeQuiz.displayTitle, score, total, accuracy, xp,
      date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) });
    persistCurrentUser(); refreshDashboardUI();
  }
  $('result-category-label').textContent = activeQuiz.displayTitle;
  $('res-score').textContent = `${score} / ${total}`;
  $('res-accuracy').textContent = accuracy + '%';
  $('res-xp').textContent = `+${xp} XP`;
  $('res-time').textContent = time;
  const [icon, head, sub] = accuracy >= 80
    ? ['🏆', 'Outstanding Mastery!', 'Incredible accuracy! You crushed this challenge.']
    : accuracy >= 50
    ? ['🌟', 'Great Effort!', 'Solid performance. Review the explanations below to reach 100%!']
    : ['📚', 'Keep Practicing!', 'Every quiz makes you sharper. Check the explanations below and try again.'];
  $('result-trophy-badge').textContent = icon;
  $('result-headline').textContent = head;
  $('result-subtext').textContent = sub;
  $('results-review-list').innerHTML = activeQuiz.reviewLog.map((r, i) => `
    <div class="review ${r.isCorrect ? 'ok' : 'no'}">
      <b>${i + 1}. ${r.question}</b> — ${r.isCorrect ? '✓ Correct' : '✕ Missed'}
      <p>Your answer: ${r.userAnswer}${r.isCorrect ? '' : ` • Correct: ${r.correctAnswer}`}</p>
      <p class="ex">${r.explanation}</p>
    </div>`).join('');
  navigateTo('results');
}

/* ---------- Profile & Toast ---------- */
function openProfileModal() {
  if (!currentUser) return;
  const level = calculateLevel(currentUser.xp), inLevel = currentUser.xp % 250;
  $('prof-avatar').textContent = currentUser.name.charAt(0).toUpperCase();
  $('prof-name').textContent = currentUser.name;
  $('prof-meta').textContent = `${currentUser.email} • ${currentUser.grade}`;
  $('prof-level-label').textContent = `Level ${level} Scholar`;
  $('prof-xp-progress-text').textContent = `${inLevel} / 250 XP to Level ${level + 1}`;
  $('prof-xp-bar').style.width = Math.round(inLevel / 250 * 100) + '%';
  $('prof-badges-grid').innerHTML = ACHIEVEMENTS.map(b => {
    const on = b.check(currentUser);
    return `<div class="badge ${on ? 'on' : ''}"><i>${on ? b.icon : '🔒'}</i><b>${b.title}</b><small>${b.desc}</small></div>`;
  }).join('');
  $('prof-history-list').innerHTML = currentUser.history.length
    ? currentUser.history.slice(0, 10).map(h => `
      <div class="hist"><div><b>${h.title}</b><br><small>${h.date} • Score: ${h.score}/${h.total} (${h.accuracy}%)</small></div>
      <span class="xp">+${h.xp} XP</span></div>`).join('')
    : '<small>No quizzes completed yet. Pick a subject to start!</small>';
  $('profile-modal').classList.remove('hidden');
}
function closeProfileModal() { $('profile-modal').classList.add('hidden'); }

function showToast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = 'toast ' + type; t.textContent = msg;
  $('toast-container').appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, 3200);
}

/* ---------- Init ---------- */
window.onload = function () {
  const email = localStorage.getItem(SESSION_KEY), db = getUsersDB();
  if (email && db[email]) { updateDailyStreak(db[email]); loginUserSession(db[email]); }
};
