/* ============================================================
   SpamGuard — JavaScript (улучшенная версия)
   Работает полностью в браузере — без сервера (GitHub Pages ready)
   ============================================================ */

let currentTab = 'url';
let selectedFile = null;
let lastResult   = null;      // для экспорта
let checkHistory = [];        // история проверок (макс. 8)

/* ────────────────────────────────────────────────────────────
   PARTICLE BACKGROUND
   ──────────────────────────────────────────────────────────── */
(function initParticles() {
  const canvas = document.getElementById('particleCanvas');
  const ctx    = canvas.getContext('2d');

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.x   = Math.random() * canvas.width;
      this.y   = Math.random() * canvas.height;
      this.r   = Math.random() * 2 + 0.5;
      this.vx  = (Math.random() - 0.5) * 0.4;
      this.vy  = (Math.random() - 0.5) * 0.4;
      this.a   = Math.random() * 0.6 + 0.1;
      this.clr = Math.random() < 0.5 ? '#6C63FF' : '#00D4AA';
    }
    update() {
      this.x += this.vx; this.y += this.vy;
      if (this.x < 0 || this.x > canvas.width ||
          this.y < 0 || this.y > canvas.height) this.reset();
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = this.clr;
      ctx.globalAlpha = this.a;
      ctx.fill();
    }
  }

  const particles = Array.from({ length: 80 }, () => new Particle());

  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(108,99,255,${0.12 * (1 - dist / 120)})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
      particles[i].update();
      particles[i].draw();
    }
    requestAnimationFrame(loop);
  }
  loop();
})();

/* ────────────────────────────────────────────────────────────
   TAB SWITCHING
   ──────────────────────────────────────────────────────────── */
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.getElementById('panel-' + tab).classList.add('active');
  hideResult();
  hideError();
}

/* ────────────────────────────────────────────────────────────
   HELPERS
   ──────────────────────────────────────────────────────────── */
function scrollToAnalyzer() {
  document.getElementById('analyzer').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function clearInput(inputId, clearId) {
  document.getElementById(inputId).value = '';
  document.getElementById(clearId).style.display = 'none';
}

function setExample(type, value) {
  if (type === 'url') {
    const el = document.getElementById('url-input');
    el.value = value;
    document.getElementById('url-clear').style.display = 'flex';
    el.focus();
  } else if (type === 'message') {
    const el = document.getElementById('message-input');
    el.value = value;
    updateCharCount();
    el.focus();
  }
}

function updateCharCount() {
  const len = document.getElementById('message-input').value.length;
  document.getElementById('char-count').textContent = len + ' символов';
}

function showSpinner(id) { document.getElementById(id).classList.remove('hidden'); }
function hideSpinner(id) { document.getElementById(id).classList.add('hidden'); }

function showToast(message, duration = 3000) {
  const toast = document.getElementById('toast');
  document.getElementById('toast-message').textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.add('hidden'), duration);
}

function setButtonState(btnId, spinnerId, loading) {
  const btn = document.getElementById(btnId);
  btn.querySelectorAll('span').forEach(t => t.style.opacity = loading ? '0.5' : '1');
  loading ? showSpinner(spinnerId) : hideSpinner(spinnerId);
  btn.disabled = loading;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ────────────────────────────────────────────────────────────
   LIVE URL INDICATOR (debounced)
   ──────────────────────────────────────────────────────────── */
let _liveTimer = null;

document.getElementById('url-input').addEventListener('input', function () {
  // Show/hide clear button
  document.getElementById('url-clear').style.display = this.value ? 'flex' : 'none';

  // Debounce live hint
  clearTimeout(_liveTimer);
  const val = this.value.trim();
  if (!val) { hideLiveIndicator(); return; }
  _liveTimer = setTimeout(() => showLiveHint(val), 700);
});

document.getElementById('url-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') analyzeURL();
});
document.getElementById('message-input').addEventListener('input', updateCharCount);

function showLiveHint(url) {
  // Быстрая клиентская эвристика (без API)
  let score = 0;
  const low = url.toLowerCase();
  if (!low.startsWith('https')) score += 15;
  if (/@/.test(low))            score += 25;
  if (/\.xyz|\.tk|\.top|\.ml|\.cf|\.gq/.test(low)) score += 25;
  if (/bit\.ly|tinyurl|goo\.gl/.test(low))          score += 12;
  const level = score < 15 ? 'safe' : score < 30 ? 'low' : score < 45 ? 'medium' : 'high';
  const labels = { safe: '✅ Выглядит безопасно', low: '⚠️ Проверьте перед открытием', medium: '🔶 Подозрительная ссылка', high: '🚨 Очень подозрительно!' };

  let el = document.getElementById('url-live-ind');
  if (!el) {
    el = document.createElement('div');
    el.id = 'url-live-ind';
    el.className = 'live-indicator';
    el.innerHTML = '<span class="live-dot"></span><span class="live-text"></span>';
    document.querySelector('#panel-url .input-hint').after(el);
  }
  el.className = `live-indicator ${level}-ind visible`;
  el.querySelector('.live-text').textContent = labels[level];
}

function hideLiveIndicator() {
  const el = document.getElementById('url-live-ind');
  if (el) el.classList.remove('visible');
}

/* ────────────────────────────────────────────────────────────
   FILE UPLOAD
   ──────────────────────────────────────────────────────────── */
function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  selectedFile = file;
  document.getElementById('upload-selected').classList.remove('hidden');
  document.getElementById('file-name-display').textContent = file.name;
}

function removeFile(event) {
  event.stopPropagation();
  selectedFile = null;
  document.getElementById('file-input').value = '';
  document.getElementById('upload-selected').classList.add('hidden');
}

// Drag & drop
const uploadArea  = document.getElementById('upload-area');
const dragOverlay = document.getElementById('drag-overlay');

document.addEventListener('dragenter', e => { e.preventDefault(); dragOverlay.classList.remove('hidden'); });
dragOverlay.addEventListener('dragleave', () => dragOverlay.classList.add('hidden'));
dragOverlay.addEventListener('dragover', e => e.preventDefault());
dragOverlay.addEventListener('drop', e => {
  e.preventDefault();
  dragOverlay.classList.add('hidden');
  const file = e.dataTransfer.files[0];
  if (file) {
    selectedFile = file;
    switchTab('document');
    scrollToAnalyzer();
    document.getElementById('upload-selected').classList.remove('hidden');
    document.getElementById('file-name-display').textContent = file.name;
  }
});

uploadArea.addEventListener('dragover', e => {
  e.preventDefault(); dragOverlay.classList.add('hidden');
  uploadArea.classList.add('drag-over');
});
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
uploadArea.addEventListener('drop', e => {
  e.preventDefault(); uploadArea.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) {
    selectedFile = file;
    document.getElementById('upload-selected').classList.remove('hidden');
    document.getElementById('file-name-display').textContent = file.name;
  }
});

/* ────────────────────────────────────────────────────────────
   ANALYZE: URL
   ──────────────────────────────────────────────────────────── */
function analyzeURL() {
  const url = document.getElementById('url-input').value.trim();
  if (!url) { showToast('⚠️ Введите URL для проверки'); return; }
  hideLiveIndicator();
  setButtonState('analyze-url-btn', 'url-spinner', true);
  hideResult(); hideError();
  try {
    const data = analyzeUrlLocal(url);
    renderResult(data);
  } catch(e) {
    showError('Ошибка анализа: ' + e.message);
  } finally {
    setButtonState('analyze-url-btn', 'url-spinner', false);
  }
}

/* ────────────────────────────────────────────────────────────
   ANALYZE: MESSAGE
   ──────────────────────────────────────────────────────────── */
function analyzeMessage() {
  const message = document.getElementById('message-input').value.trim();
  if (!message) { showToast('⚠️ Введите сообщение для проверки'); return; }
  setButtonState('analyze-msg-btn', 'msg-spinner', true);
  hideResult(); hideError();
  try {
    const data = analyzeMessageLocal(message);
    renderResult(data);
  } catch(e) {
    showError('Ошибка анализа: ' + e.message);
  } finally {
    setButtonState('analyze-msg-btn', 'msg-spinner', false);
  }
}

/* ────────────────────────────────────────────────────────────
   ANALYZE: DOCUMENT
   ──────────────────────────────────────────────────────────── */
function analyzeDocument() {
  if (!selectedFile) { showToast('⚠️ Выберите файл для проверки'); return; }
  setButtonState('analyze-doc-btn', 'doc-spinner', true);
  hideResult(); hideError();

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const text = e.target.result || '';
      if (!text.trim()) { showError('Файл пустой или не поддерживается'); return; }
      // Удаляем HTML-теги если это HTML-файл
      const clean = selectedFile.name.match(/\.html?$/i)
        ? text.replace(/<[^>]+>/g, ' ')
        : text;
      const data = analyzeTextLocal(clean, selectedFile.name);
      renderResult(data);
    } catch(e) {
      showError('Ошибка анализа файла: ' + e.message);
    } finally {
      setButtonState('analyze-doc-btn', 'doc-spinner', false);
    }
  };
  reader.onerror = function() {
    showError('Не удалось прочитать файл.');
    setButtonState('analyze-doc-btn', 'doc-spinner', false);
  };
  // Читаем как текст (поддерживаются .txt, .eml, .html, .csv, .log)
  reader.readAsText(selectedFile, 'UTF-8');
}

/* ────────────────────────────────────────────────────────────
   RENDER RESULT
   ──────────────────────────────────────────────────────────── */
function renderResult(data) {
  lastResult = data;
  const panel = document.getElementById('result-panel');

  // Risk class
  panel.className = 'result-panel risk-' + data.risk_level;

  // Icon & verdict
  document.getElementById('result-icon').textContent    = data.icon;
  document.getElementById('result-verdict').textContent = data.verdict;
  document.getElementById('result-score').textContent   = data.risk_score + '%';

  // Subject
  const subjectEl = document.getElementById('result-subject');
  const typeLabel = { url: '🔗 URL', message: '💬 Сообщение', document: '📄 Файл' };
  if (data.subject) {
    subjectEl.textContent  = (typeLabel[data.analysis_type] || '') + ': ' + data.subject;
    subjectEl.style.display = 'block';
  } else {
    subjectEl.style.display = 'none';
  }

  // Dominant threat
  const dtEl = document.getElementById('dominant-threat');
  dtEl.textContent = data.dominant_threat || '';

  // Risk bar
  setTimeout(() => {
    document.getElementById('risk-bar-fill').style.width = data.risk_score + '%';
    document.getElementById('risk-bar-thumb').style.left = data.risk_score + '%';
  }, 80);

  const barColors = { safe: 'var(--clr-safe)', low: 'var(--clr-warn)', medium: 'var(--clr-orange)', high: 'var(--clr-danger)' };
  document.getElementById('risk-bar-fill').style.background  = barColors[data.risk_level];
  document.getElementById('risk-bar-thumb').style.borderColor = barColors[data.risk_level];

  // ── CATEGORY BARS ──────────────────────────────────────────
  const cats = data.category_scores || {};
  const catMap = { phishing: 'phishing', fraud: 'fraud', spam: 'spam', manipulation: 'manipulation' };
  for (const [key] of Object.entries(catMap)) {
    const val = Math.min(cats[key] || 0, 100);
    setTimeout(() => {
      const barEl = document.getElementById('bar-' + key);
      const valEl = document.getElementById('cat-' + key);
      if (barEl) barEl.style.width = val + '%';
      if (valEl) valEl.textContent = val + '%';
    }, 150);
  }

  // Sender type
  document.getElementById('sender-type').textContent      = data.sender_type;
  document.getElementById('result-description').textContent = data.description;

  // Flags
  const flagsSection = document.getElementById('flags-section');
  const flagsList    = document.getElementById('flags-list');
  if (data.flags && data.flags.length > 0) {
    flagsList.innerHTML = data.flags.map(f => `<div class="flag-item">⚑ ${escHtml(f)}</div>`).join('');
    flagsSection.style.display = 'block';
  } else {
    flagsSection.style.display = 'none';
  }

  // Details
  const detailsSection = document.getElementById('details-section');
  const detailsList    = document.getElementById('details-list');
  if (data.details && data.details.length > 0) {
    detailsList.innerHTML = data.details.map(d => `<div class="detail-item">${escHtml(d)}</div>`).join('');
    detailsSection.style.display = 'block';
  } else {
    detailsSection.style.display = 'none';
  }

  // Recommendations
  const recSection = document.getElementById('recommendations-section');
  const recList    = document.getElementById('rec-list');
  if (data.recommendations && data.recommendations.length > 0) {
    recList.innerHTML = data.recommendations.map(r => `<div class="rec-item">${escHtml(r)}</div>`).join('');
    recSection.style.display = 'block';
  } else {
    recSection.style.display = 'none';
  }

  // Show panel & scroll
  panel.classList.remove('hidden');
  setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);

  // Animated score
  animateCounter(document.getElementById('result-score'), data.risk_score, '%');

  // Save to history
  addToHistory(data);
}

/* ────────────────────────────────────────────────────────────
   HISTORY
   ──────────────────────────────────────────────────────────── */
function addToHistory(data) {
  const entry = {
    icon:    data.icon,
    subject: data.subject || '—',
    type:    { url: 'URL', message: 'Сообщение', document: 'Документ' }[data.analysis_type] || '',
    score:   data.risk_score,
    level:   data.risk_level,
    time:    new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    data:    data,
  };
  checkHistory.unshift(entry);
  if (checkHistory.length > 8) checkHistory.pop();
  renderHistory();
}

function renderHistory() {
  const panel = document.getElementById('history-panel');
  const list  = document.getElementById('history-list');
  if (checkHistory.length === 0) { panel.style.display = 'none'; return; }

  panel.style.display = 'block';
  list.innerHTML = checkHistory.map((item, idx) => `
    <div class="history-item" onclick="restoreResult(${idx})">
      <span class="hist-icon">${item.icon}</span>
      <div class="hist-info">
        <div class="hist-subject">${escHtml(item.subject)}</div>
        <div class="hist-type">${item.type}</div>
      </div>
      <span class="hist-score ${item.level}">${item.score}%</span>
      <span class="hist-time">${item.time}</span>
    </div>
  `).join('');
}

function restoreResult(idx) {
  const item = checkHistory[idx];
  if (item) renderResult(item.data);
}

function clearHistory() {
  checkHistory = [];
  renderHistory();
}

/* ────────────────────────────────────────────────────────────
   EXPORT REPORT
   ──────────────────────────────────────────────────────────── */
function exportResult() {
  if (!lastResult) { showToast('Нет результата для экспорта'); return; }
  const d = lastResult;
  const typeLabel = { url: 'URL', message: 'Сообщение', document: 'Документ' };

  const cats = d.category_scores || {};
  const catText = Object.entries(cats)
    .map(([k, v]) => `  • ${k.charAt(0).toUpperCase()+k.slice(1)}: ${v}%`)
    .join('\n');

  const report = [
    '═══════════════════════════════════════════════════',
    '           SpamGuard — Отчёт об анализе',
    '═══════════════════════════════════════════════════',
    '',
    `Дата:         ${new Date().toLocaleString('ru-RU')}`,
    `Тип анализа:  ${typeLabel[d.analysis_type] || d.analysis_type}`,
    `Объект:       ${d.subject || '—'}`,
    '',
    '───────────────────────────────────────────────────',
    'РЕЗУЛЬТАТ',
    '───────────────────────────────────────────────────',
    `${d.icon} Вердикт:        ${d.verdict}`,
    `   Общий риск:    ${d.risk_score}%`,
    `   Тип угрозы:    ${d.dominant_threat || '—'}`,
    `   Тип отправит.: ${d.sender_type}`,
    '',
    '───────────────────────────────────────────────────',
    'КАТЕГОРИЙНЫЕ ОЦЕНКИ',
    '───────────────────────────────────────────────────',
    catText || '  —',
    '',
    '───────────────────────────────────────────────────',
    'ОПИСАНИЕ',
    '───────────────────────────────────────────────────',
    d.description,
    '',
    ...(d.flags && d.flags.length ? [
      '───────────────────────────────────────────────────',
      'ОБНАРУЖЕННЫЕ ПРИЗНАКИ',
      '───────────────────────────────────────────────────',
      ...d.flags.map(f => `  ⚑ ${f}`),
      '',
    ] : []),
    ...(d.details && d.details.length ? [
      '───────────────────────────────────────────────────',
      'ПОДРОБНЫЙ АНАЛИЗ',
      '───────────────────────────────────────────────────',
      ...d.details.map(det => `  ${det}`),
      '',
    ] : []),
    ...(d.recommendations && d.recommendations.length ? [
      '───────────────────────────────────────────────────',
      'РЕКОМЕНДАЦИИ',
      '───────────────────────────────────────────────────',
      ...d.recommendations.map(r => `  ${r}`),
      '',
    ] : []),
    '═══════════════════════════════════════════════════',
    '  SpamGuard — Защита от спама и мошенников',
    '═══════════════════════════════════════════════════',
  ].join('\n');

  const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `spamguard-report-${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('✅ Отчёт скачан!');
}

/* ────────────────────────────────────────────────────────────
   UTILITIES
   ──────────────────────────────────────────────────────────── */
function animateCounter(el, target, suffix = '') {
  let current = 0;
  const step  = target / 40;
  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = Math.round(current) + suffix;
    if (current >= target) clearInterval(timer);
  }, 25);
}

function hideResult() {
  document.getElementById('result-panel').classList.add('hidden');
  document.getElementById('risk-bar-fill').style.width = '0%';
  document.getElementById('risk-bar-thumb').style.left = '0%';
  // Reset category bars
  ['phishing','fraud','spam','manipulation'].forEach(k => {
    const b = document.getElementById('bar-' + k);
    const v = document.getElementById('cat-' + k);
    if (b) b.style.width = '0%';
    if (v) v.textContent = '0%';
  });
}

function showError(message) {
  document.getElementById('error-message').textContent = message;
  document.getElementById('error-panel').classList.remove('hidden');
  document.getElementById('error-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideError() {
  document.getElementById('error-panel').classList.add('hidden');
}

function resetAnalyzer() {
  hideResult(); hideError(); hideLiveIndicator();
  document.getElementById('url-input').value = '';
  document.getElementById('url-clear').style.display = 'none';
  document.getElementById('message-input').value = '';
  document.getElementById('char-count').textContent = '0 символов';
  removeFile({ stopPropagation: () => {} });
  lastResult = null;
  document.getElementById('analyzer').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function reportScam() {
  showToast('✅ Информация записана. Спасибо за сообщение!');
}

/* ────────────────────────────────────────────────────────────
   STATS COUNTER ANIMATION
   ──────────────────────────────────────────────────────────── */
const statsSection = document.getElementById('stats');
const observer = new IntersectionObserver(entries => {
  if (!entries[0].isIntersecting) return;
  document.querySelectorAll('.stat-value[data-target]').forEach(el => {
    const target = parseInt(el.dataset.target);
    let current  = 0;
    const step   = target / (1800 / 16);
    const timer  = setInterval(() => {
      current = Math.min(current + step, target);
      el.textContent = formatStatNumber(Math.round(current));
      if (current >= target) clearInterval(timer);
    }, 16);
  });
  observer.disconnect();
}, { threshold: 0.3 });
if (statsSection) observer.observe(statsSection);

function formatStatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'М';
  if (n >= 1000)    return (n / 1000).toFixed(0) + 'к';
  return n.toString();
}

/* ────────────────────────────────────────────────────────────
   THREAT CARDS — GLOW ON HOVER
   ──────────────────────────────────────────────────────────── */
document.querySelectorAll('.threat-card').forEach(card => {
  card.addEventListener('mousemove', e => {
    const r = card.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width)  * 100;
    const y = ((e.clientY - r.top)  / r.height) * 100;
    card.style.background = `radial-gradient(circle at ${x}% ${y}%, rgba(108,99,255,0.1), rgba(255,255,255,0.03) 60%)`;
  });
  card.addEventListener('mouseleave', () => { card.style.background = ''; });
});
