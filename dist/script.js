'use strict';
/* ════════════════════════════════════════════════
   藝文紀錄 PWA — script.js
   完整 App 邏輯：資料、UI、手勢、動畫
   ════════════════════════════════════════════════ */

// ─── Register Service Worker ───────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// ─── Constants ─────────────────────────────────
const STORAGE_KEY = 'arts_pwa_v1';

const TYPE_CONFIG = {
  '演唱會': { emoji: '🎤', dotClass: 'dot-concert', tagClass: 'type-concert', barColor: '#FF7518' },
  '展覽':   { emoji: '🖼',  dotClass: 'dot-exhibit',  tagClass: 'type-exhibit',  barColor: '#007AFF' },
  '電影':   { emoji: '🎬', dotClass: 'dot-movie',    tagClass: 'type-movie',    barColor: '#5856D6' },
  '劇場':   { emoji: '🎭', dotClass: 'dot-theater',  tagClass: 'type-theater',  barColor: '#34C759' },
  '其他':   { emoji: '✨', dotClass: 'dot-other',    tagClass: 'type-other',    barColor: '#FF9500' },
};

// ─── State ─────────────────────────────────────
let activities    = [];
let currentFilter = 'all';
let currentPage   = 'pageHome';
let sheetMode     = 'add';  // 'add' | 'edit'
let sheetOpen     = false;

// ─── DOM refs ──────────────────────────────────
const $ = id => document.getElementById(id);

const splash        = $('splash');
const app           = $('app');
const cardList      = $('cardList');
const emptyState    = $('emptyState');
const filterPills   = $('filterPills');
const bottomSheet   = $('bottomSheet');
const sheetBackdrop = $('sheetBackdrop');
const toast         = $('toast');
const iosDialog     = $('iosDialog');
const dialogBackdrop= $('dialogBackdrop');

// ════════════════════════════════════════════════
// SPLASH
// ════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  loadData();
  seedDemo();

  setTimeout(() => {
    splash.classList.add('fade-out');
    app.classList.remove('app-hidden');
    setTimeout(() => splash.style.display = 'none', 500);
  }, 1800);

  initTabs();
  initSheet();
  initForm();
  initFilters();
  initSettings();
  renderHome();
});

// ════════════════════════════════════════════════
// DATA
// ════════════════════════════════════════════════
function loadData() {
  try {
    activities = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { activities = []; }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(activities));
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function seedDemo() {
  if (activities.length > 0) return;
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  activities = [
    { id: genId(), title: 'TWICE＜THIS IS FOR＞WORLD TOUR IN TAIPEI', type: '演唱會', date: `${y}-${3}-21`, time: '18:00', location: '台北大巨蛋', price: 8800, note: '😭' },
    // { id: genId(), title: '侯孝賢影像回顧展',           type: '展覽',   date: `${y}-${m}-08`, time: '14:00', location: '台北當代藝術館', price: 280,  note: '館藏豐富，值得細看' },
    // { id: genId(), title: '機器人之夢',                  type: '電影',   date: `${y}-${m}-03`, time: '20:10', location: '光點台北',       price: 320,  note: '無台詞卻感人至深' },
    // { id: genId(), title: '等待果陀 ─ 果陀劇場',         type: '劇場',   date: `${y}-02-20`,   time: '19:30', location: '國家戲劇院',     price: 1200, note: '舞台設計極簡有力' },
  ];
  saveData();
}

// ════════════════════════════════════════════════
// TAB BAR
// ════════════════════════════════════════════════
function initTabs() {
  document.querySelectorAll('.tab-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const pageId = btn.dataset.page;
      if (pageId === currentPage) return;

      document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');

      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      $(pageId).classList.add('active');
      currentPage = pageId;

      if (pageId === 'pageStats') renderStats();
    });
  });
}

// ════════════════════════════════════════════════
// HOME — FILTER
// ════════════════════════════════════════════════
function initFilters() {
  filterPills.addEventListener('click', e => {
    const pill = e.target.closest('.pill');
    if (!pill) return;
    filterPills.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    currentFilter = pill.dataset.type;
    renderHome();
  });
}

// ════════════════════════════════════════════════
// HOME — RENDER
// ════════════════════════════════════════════════
function renderHome() {
  // Summary strip
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthCount = activities.filter(a => (a.date || '').startsWith(thisMonth)).length;
  const totalSpend = activities.reduce((s, a) => s + (Number(a.price) || 0), 0);
  $('homeCount').textContent = activities.length;
  $('homeTotal').textContent = `NT$${totalSpend.toLocaleString()}`;
  $('homeMonth').textContent = monthCount;

  // Filter & sort
  let list = [...activities];
  if (currentFilter !== 'all') list = list.filter(a => a.type === currentFilter);
  list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  cardList.innerHTML = '';

  if (list.length === 0) {
    cardList.appendChild(emptyState);
    emptyState.style.display = 'flex';
    return;
  }

  emptyState.style.display = 'none';
  list.forEach((activity, i) => {
    const card = createCard(activity, i);
    cardList.appendChild(card);
  });
}

// ─── Build a card element ───────────────────────
function createCard(activity, index = 0) {
  const { id, title, type, date, price } = activity;
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG['其他'];
  const priceNum = Number(price) || 0;
  const formattedDate = date ? formatDateShort(date) : '';

  const wrapper = document.createElement('div');
  wrapper.className = 'activity-card';
  wrapper.style.animationDelay = `${Math.min(index * 0.05, 0.4)}s`;
  wrapper.dataset.id = id;

  wrapper.innerHTML = `
    <div class="card-swipe-bg" aria-hidden="true">
      <span>🗑 刪除</span>
    </div>
    <div class="card-inner">
      <div class="card-type-dot ${cfg.dotClass}" aria-hidden="true">${cfg.emoji}</div>
      <div class="card-body">
        <p class="card-name">${escHtml(title)}</p>
        <div class="card-sub">
          ${formattedDate ? `<span class="card-date">${formattedDate}</span>` : ''}
          <span class="type-tag ${cfg.tagClass}">${escHtml(type)}</span>
        </div>
      </div>
      <div class="card-right">
        <span class="card-price ${priceNum === 0 ? 'free' : ''}">${priceNum > 0 ? `NT$${priceNum.toLocaleString()}` : '免費'}</span>
        <button class="card-edit-btn no-scale" data-id="${id}" aria-label="編輯 ${escHtml(title)}">編輯</button>
      </div>
    </div>
  `;

  // Edit button
  wrapper.querySelector('.card-edit-btn').addEventListener('click', e => {
    e.stopPropagation();
    openEdit(id);
  });

  // Swipe to delete
  initSwipe(wrapper, id);

  return wrapper;
}

// ════════════════════════════════════════════════
// SWIPE TO DELETE
// ════════════════════════════════════════════════
function initSwipe(wrapper, id) {
  const inner = wrapper.querySelector('.card-inner');
  let startX = 0, startY = 0, dx = 0;
  let isSwiping = false;
  let isVertical = null;
  const DELETE_THRESHOLD = -80;
  const MAX_SWIPE = -100;

  function onStart(e) {
    const touch = e.touches ? e.touches[0] : e;
    startX = touch.clientX;
    startY = touch.clientY;
    dx = 0;
    isVertical = null;
    isSwiping = false;
    inner.classList.add('swiping');
  }

  function onMove(e) {
    const touch = e.touches ? e.touches[0] : e;
    const moveX = touch.clientX - startX;
    const moveY = touch.clientY - startY;

    if (isVertical === null) {
      isVertical = Math.abs(moveY) > Math.abs(moveX);
    }

    if (isVertical) {
      inner.classList.remove('swiping');
      return;
    }

    if (!isSwiping) isSwiping = true;
    e.preventDefault();

    dx = Math.min(0, Math.max(MAX_SWIPE * 1.1, moveX));
    inner.style.transform = `translateX(${dx}px)`;
  }

  function onEnd() {
    inner.classList.remove('swiping');
    if (!isSwiping) return;

    if (dx < DELETE_THRESHOLD) {
      // Commit delete
      inner.style.transition = 'transform 0.25s ease';
      inner.style.transform = `translateX(-110%)`;
      wrapper.style.transition = 'max-height 0.3s ease, opacity 0.25s ease, margin 0.3s ease';
      wrapper.style.opacity = '0';
      setTimeout(() => {
        wrapper.style.maxHeight = '0';
        wrapper.style.marginBottom = '-10px';
      }, 50);
      setTimeout(() => {
        deleteActivity(id, false);
      }, 320);
    } else {
      // Snap back
      inner.style.transition = 'transform 0.35s var(--spring, cubic-bezier(0.34,1.56,0.64,1))';
      inner.style.transform = 'translateX(0)';
    }
  }

  wrapper.addEventListener('touchstart', onStart, { passive: true });
  wrapper.addEventListener('touchmove', onMove, { passive: false });
  wrapper.addEventListener('touchend', onEnd);
}

// ════════════════════════════════════════════════
// SHEET — Open / Close
// ════════════════════════════════════════════════
function initSheet() {
  $('btnOpenSheet').addEventListener('click', openAdd);
  $('sheetCancel').addEventListener('click', closeSheet);
  sheetBackdrop.addEventListener('click', closeSheet);
  $('sheetSave').addEventListener('click', handleSave);

  // Drag to dismiss
  let sheetStartY = 0, sheetDy = 0;
  const handle = bottomSheet.querySelector('.sheet-handle-area');

  handle.addEventListener('touchstart', e => {
    sheetStartY = e.touches[0].clientY;
    sheetDy = 0;
    bottomSheet.style.transition = 'none';
  }, { passive: true });

  handle.addEventListener('touchmove', e => {
    sheetDy = Math.max(0, e.touches[0].clientY - sheetStartY);
    bottomSheet.style.transform = `translateY(${sheetDy}px)`;
  }, { passive: true });

  handle.addEventListener('touchend', () => {
    bottomSheet.style.transition = '';
    bottomSheet.style.transform = '';
    if (sheetDy > 120) closeSheet();
  });
}

function openAdd() {
  sheetMode = 'add';
  $('sheetTitle').textContent = '新增活動';
  $('editId').value = '';
  clearForm();
  openSheet();
}

function openEdit(id) {
  const a = activities.find(x => x.id === id);
  if (!a) return;
  sheetMode = 'edit';
  $('sheetTitle').textContent = '編輯活動';
  $('editId').value = id;

  $('fTitle').value    = a.title    || '';
  $('fDate').value     = a.date     || '';
  $('fTime').value     = a.time     || '';
  $('fLocation').value = a.location || '';
  $('fPrice').value    = a.price != null ? a.price : '';
  $('fNote').value     = a.note     || '';

  // Set type picker
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.val === a.type);
  });

  openSheet();
}

function openSheet() {
  sheetOpen = true;
  bottomSheet.classList.add('open');
  sheetBackdrop.classList.add('open');
  document.body.style.overflow = 'hidden';
  clearErrors();
  setTimeout(() => $('fTitle').focus(), 450);
}

function closeSheet() {
  sheetOpen = false;
  bottomSheet.classList.remove('open');
  sheetBackdrop.classList.remove('open');
  document.body.style.overflow = '';
}

// ════════════════════════════════════════════════
// FORM — Save
// ════════════════════════════════════════════════
function initForm() {
  // Type picker
  document.getElementById('typePicker').addEventListener('click', e => {
    const btn = e.target.closest('.type-btn');
    if (!btn) return;
    document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
}

function handleSave() {
  if (!validateForm()) return;

  const selectedType = document.querySelector('.type-btn.active')?.dataset.val || '其他';
  const data = {
    title:    $('fTitle').value.trim(),
    type:     selectedType,
    date:     $('fDate').value,
    time:     $('fTime').value,
    location: $('fLocation').value.trim(),
    price:    Number($('fPrice').value) || 0,
    note:     $('fNote').value.trim(),
  };

  const editId = $('editId').value;

  if (editId) {
    const idx = activities.findIndex(a => a.id === editId);
    if (idx !== -1) activities[idx] = { ...activities[idx], ...data };
    showToast('活動已更新 ✓');
  } else {
    activities.unshift({ id: genId(), ...data });
    showToast('活動已新增 🎉');
  }

  saveData();
  closeSheet();
  renderHome();
}

function validateForm() {
  clearErrors();
  const title = $('fTitle').value.trim();
  if (!title) {
    $('fTitle').classList.add('error');
    $('errTitle').classList.add('show');
    $('fTitle').focus();
    return false;
  }
  return true;
}

function clearErrors() {
  document.querySelectorAll('.form-field.error').forEach(el => el.classList.remove('error'));
  document.querySelectorAll('.form-err.show').forEach(el => el.classList.remove('show'));
}

function clearForm() {
  $('fTitle').value = '';
  $('fDate').value  = new Date().toISOString().slice(0, 10);
  $('fTime').value  = '';
  $('fLocation').value = '';
  $('fPrice').value = '';
  $('fNote').value  = '';
  document.querySelectorAll('.type-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
}

// ════════════════════════════════════════════════
// DELETE
// ════════════════════════════════════════════════
function deleteActivity(id, withConfirm = true) {
  if (withConfirm) {
    showDialog(
      '刪除活動',
      '刪除後無法復原，確定要刪除這筆記錄嗎？',
      [
        { label: '取消', cls: '' },
        { label: '刪除', cls: 'destructive', action: () => {
          activities = activities.filter(a => a.id !== id);
          saveData();
          renderHome();
          showToast('已刪除');
        }}
      ]
    );
  } else {
    activities = activities.filter(a => a.id !== id);
    saveData();
    renderHome();
    showToast('已刪除');
  }
}

// ════════════════════════════════════════════════
// STATS PAGE
// ════════════════════════════════════════════════
function renderStats() {
  const total    = activities.length;
  const spend    = activities.reduce((s, a) => s + (Number(a.price) || 0), 0);
  const avg      = total ? Math.round(spend / total) : 0;
  const thisMonth= new Date().toISOString().slice(0, 7);
  const monthCnt = activities.filter(a => (a.date || '').startsWith(thisMonth)).length;

  $('stTotal').textContent = total;
  $('stSpend').textContent = `NT$${spend.toLocaleString()}`;
  $('stMonth').textContent = monthCnt;
  $('stAvg').textContent   = `NT$${avg.toLocaleString()}`;

  renderTypeBreakdown();
  renderBarChart();
  renderRecent();
}

function renderTypeBreakdown() {
  const counts = {};
  activities.forEach(a => { counts[a.type] = (counts[a.type] || 0) + 1; });
  const max = Math.max(...Object.values(counts), 1);
  const container = $('typeBreakdown');

  if (Object.keys(counts).length === 0) {
    container.innerHTML = '<p class="stats-empty">尚無資料</p>';
    return;
  }

  container.innerHTML = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => {
      const cfg = TYPE_CONFIG[type] || TYPE_CONFIG['其他'];
      const pct = Math.round((count / max) * 100);
      return `
        <div class="breakdown-row">
          <span class="breakdown-label">${cfg.emoji} ${type}</span>
          <div class="breakdown-bar-bg">
            <div class="breakdown-bar-fill" style="width:${pct}%; background:${cfg.barColor};"></div>
          </div>
          <span class="breakdown-count">${count}</span>
        </div>
      `;
    }).join('');
}

function renderBarChart() {
  const container = $('barChart');
  const now = new Date();
  const months = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = `${d.getMonth() + 1}月`;
    const count = activities.filter(a => (a.date || '').startsWith(key)).length;
    months.push({ label, count, key });
  }

  const maxCount = Math.max(...months.map(m => m.count), 1);

  if (months.every(m => m.count === 0)) {
    container.innerHTML = '<p class="stats-empty">尚無資料</p>';
    return;
  }

  container.innerHTML = months.map(({ label, count }) => {
    const heightPct = Math.round((count / maxCount) * 72);
    return `
      <div class="bar-group">
        ${count > 0 ? `<span class="bar-val-lbl">${count}</span>` : '<span class="bar-val-lbl" style="opacity:0">0</span>'}
        <div class="bar-col" style="height:${Math.max(heightPct, 4)}px;">
          <div class="bar-col-fill" style="height:${count > 0 ? 100 : 0}%;"></div>
        </div>
        <span class="bar-month-lbl">${label}</span>
      </div>
    `;
  }).join('');
}

function renderRecent() {
  const container = $('recentList');
  const recent = [...activities]
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 5);

  if (recent.length === 0) {
    container.innerHTML = '<p class="stats-empty">尚無資料</p>';
    return;
  }

  container.innerHTML = recent.map(a => `
    <div class="recent-item">
      <div class="recent-dot" style="background:${(TYPE_CONFIG[a.type] || TYPE_CONFIG['其他']).barColor};"></div>
      <span class="recent-name">${escHtml(a.title)}</span>
      <span class="recent-date">${a.date ? formatDateShort(a.date) : '—'}</span>
    </div>
  `).join('');
}

// ════════════════════════════════════════════════
// SETTINGS
// ════════════════════════════════════════════════
function initSettings() {
  $('clearBtn').addEventListener('click', () => {
    showDialog(
      '清除所有資料',
      '這將刪除所有活動記錄，此操作無法復原。',
      [
        { label: '取消', cls: '' },
        { label: '清除', cls: 'destructive', action: () => {
          activities = [];
          saveData();
          renderHome();
          showToast('資料已清除');
        }}
      ]
    );
  });

  $('exportBtn').addEventListener('click', () => {
    const json = JSON.stringify(activities, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `藝文紀錄_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('已匯出 JSON 檔案');
  });
}

// ════════════════════════════════════════════════
// iOS DIALOG
// ════════════════════════════════════════════════
function showDialog(title, msg, buttons) {
  $('dialogTitle').textContent = title;
  $('dialogMsg').textContent   = msg;

  const actionsEl = $('dialogActions');
  actionsEl.innerHTML = '';

  buttons.forEach(btn => {
    const el = document.createElement('button');
    el.className = `dialog-btn ${btn.cls || ''}`;
    el.textContent = btn.label;
    el.addEventListener('click', () => {
      closeDialog();
      if (btn.action) btn.action();
    });
    actionsEl.appendChild(el);
  });

  dialogBackdrop.classList.add('open');
}

function closeDialog() {
  dialogBackdrop.classList.remove('open');
}

dialogBackdrop.addEventListener('click', e => {
  if (e.target === dialogBackdrop) closeDialog();
});

// ════════════════════════════════════════════════
// TOAST
// ════════════════════════════════════════════════
let toastTimer = null;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

// ════════════════════════════════════════════════
// UTILS
// ════════════════════════════════════════════════
function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${y}/${parseInt(m)}/${parseInt(d)}`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}