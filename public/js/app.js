import * as E from './engine.js';
import { createStore, normalizeUsername } from './store.js';
import { buildXlsx } from './xlsx.js';
import { pngBlob, pdfBlob, drawSchedule } from './export.js';
import { openDocuments } from './documents.js';

/* ================= Yardımcılar ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const clone = o => JSON.parse(JSON.stringify(o));
const today = (() => { const t = new Date(); return t.getFullYear() + '-' + E.pad(t.getMonth() + 1) + '-' + E.pad(t.getDate()); })();
const trUpper = s => String(s || '').toLocaleUpperCase('tr');
const num = (x, d = 1) => (Math.round(x * 10 ** d) / 10 ** d).toLocaleString('tr-TR', { maximumFractionDigits: d });
function bal(x) {
  if (Math.abs(x) < 0.05) return '<span class="bal zero">0</span>';
  return '<span class="bal ' + (x > 0 ? 'plus' : 'minus') + '">' + (x > 0 ? '+' : '−') + num(Math.abs(x)) + '</span>';
}
const PALETTE = ['#2f6fd6', '#d2552e', '#1e8a5a', '#8a4fd1', '#c4426f', '#a87700', '#13808f', '#5b6472', '#6a8a1e', '#b8448f'];

const ICONS = {
  left: '<path d="M15 6l-6 6 6 6"/>', right: '<path d="M9 6l6 6-6 6"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', print: '<path d="M7 9V4h10v5M7 17H5a1 1 0 01-1-1v-6a1 1 0 011-1h14a1 1 0 011 1v6a1 1 0 01-1 1h-2M7 14h10v6H7z"/>',
  down: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', up: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>', trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', pin: '<path d="M9 4h6l-1 6 3 3H7l3-3zM12 13v7"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  out: '<path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
  alert: '<path d="M12 4l9 16H3zM12 10v4M12 17v.5"/>', cal: '<rect x="3.5" y="5" width="17" height="15" rx="1"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5M16 4.5a3.5 3.5 0 010 7M18 15c2 .7 3 2.300 3.5 5"/>',
  scale: '<path d="M12 4v16M5 20h14M4 9l3-5 3 5a3 3 0 01-6 0zM14 9l3-5 3 5a3 3 0 01-6 0zM7 4h10"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  leave: '<path d="M4 18h16M6 18l2-9 5 3 4-7 1 13"/>', key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l2 2M14 9l2 2"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.5"/>',
  undo: '<path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2.2M12 17v.3"/>',
  share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/>',
  org: '<path d="M5 20V5h9v15M14 10h5v10M3 20h18M8.5 9h2M8.5 13h2M8.5 17h2"/>',
  shield: '<path d="M12 3l8 3v6c0 4.500-3.200 7.700-8 9-4.800-1.300-8-4.500-8-9V6z"/><path d="M9 12l2.200 2.200L15 10"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  flag: '<path d="M6 21V4M6 5h12l-2.500 4 2.500 4H6"/>', box: '<path d="M4 8h16v12H4zM3 4h18v4H3zM10 12h4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.500V5M12 19v2.500M2.500 12H5M19 12h2.500M5.300 5.300l1.800 1.800M16.900 16.900l1.800 1.800M5.300 18.700l1.800-1.800M16.900 7.100l1.800-1.800"/>',
  rule: '<path d="M5 4h14v16H5zM9 9h6M9 13h6M9 17h3"/>', more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>'
};
const ic = (n, cls = '') => '<svg class="ic ' + cls + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[n] + '</svg>';

/* ================= Durum ================= */
let store, me = null, data = null, unsub = null;
const pref = (k, d) => { try { return localStorage.getItem('nobet-' + k) || d; } catch (e) { return d; } };
const setPref = (k, v) => { try { localStorage.setItem('nobet-' + k, v); } catch (e) { /* yok say */ } };
const ui = { route: 'cizelge', ym: today.slice(0, 7), focus: null, year: +today.slice(0, 4), leavePerson: '', users: null, showPw: {}, view: pref('view', 'cal'), theme: pref('theme', 'auto') };
function applyTheme() { if (ui.theme === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', ui.theme); }
applyTheme();
const isAdmin = () => !!me && (me.role === 'super' || me.role === 'admin');
const isSuper = () => !!me && me.role === 'super';
const ROLE_LABEL = { super: 'Baş yönetici', admin: 'Yönetici', user: 'Personel' };
const cfg = () => data.config;
const colorOf = pid => { const i = (cfg().people || []).findIndex(p => p.id === pid); return i < 0 ? '#888' : PALETTE[i % PALETTE.length]; };

/* ================= Bildirim, meşgul, modal ================= */
let toastTimer;
function toast(msg, kind = 'ok') {
  const t = $('#toast');
  t.className = 'toast ' + kind; t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, kind === 'err' ? 6000 : 3000);
}
function busy(on, label) { const b = $('#busy'); b.hidden = !on; if (label) $('span', b).textContent = label; }
async function run(fn, okMsg, label) {
  busy(true, label || 'Kaydediliyor…');
  try { const r = await fn(); if (okMsg) toast(okMsg); return r; } catch (e) { console.error(e); toast(e.message || String(e), 'err'); throw e; } finally { busy(false); }
}
function modal({ title, body, foot = '', wide = false, onMount }) {
  const root = $('#modal-root'), el = document.createElement('div');
  el.className = 'modal-wrap';
  el.innerHTML = '<div class="modal' + (wide ? ' wide' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">' +
    '<header><h2>' + esc(title) + '</h2><button class="icon-btn" data-close aria-label="Kapat">' + ic('x') + '</button></header>' +
    '<div class="modal-body">' + body + '</div>' + (foot ? '<footer>' + foot + '</footer>' : '') + '</div>';
  root.appendChild(el);
  document.body.classList.add('modal-open');
  const close = () => { el.remove(); document.body.classList.toggle('modal-open', !!root.children.length); };
  el.addEventListener('mousedown', e => { if (e.target === el) el.dataset.down = '1'; });
  el.addEventListener('click', e => { if ((e.target === el && el.dataset.down) || e.target.closest('[data-close]')) close(); el.dataset.down = ''; });
  if (onMount) onMount(el, close);
  const f = el.querySelector('input:not([type=hidden]):not([type=checkbox]), select, textarea');
  if (f && window.innerWidth > 700) setTimeout(() => f.focus(), 30);
  return { el, close };
}
function confirmBox(title, text, okLabel = 'Evet', danger = false) {
  return new Promise(res => {
    let done = false;
    const m = modal({
      title, body: '<p class="lead">' + text + '</p>',
      foot: '<button class="btn ghost" data-close>Vazgeç</button><button class="btn ' + (danger ? 'danger' : 'primary') + '" data-ok>' + esc(okLabel) + '</button>',
      onMount(el, close) { $('[data-ok]', el).onclick = () => { done = true; close(); res(true); }; }
    });
    new MutationObserver((_, o) => { if (!m.el.isConnected) { o.disconnect(); if (!done) res(false); } }).observe($('#modal-root'), { childList: true });
  });
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { const all = $$('#modal-root .modal-wrap'); if (all.length) { all[all.length - 1].remove(); document.body.classList.toggle('modal-open', !!$('#modal-root').children.length); } }
});
async function saveCfg(mut, msg) { const c = clone(cfg()); mut(c); await run(() => store.saveConfig(c), msg); }

/* ================= Giriş ve kurulum ================= */
function renderLogin(setupNeeded, errMsg) {
  const installTools = $('.pwa-tools');
  if (installTools) document.body.appendChild(installTools);
  $('#app').innerHTML = '';
  const nt = $('#notice'); if (nt) nt.remove();
  if (typeof ui !== 'undefined') { ui.knownReq = null; ui.noticeHidden = null; }
  document.title = 'Nöbet Çizelgesi';
  const demo = store.mode === 'demo';
  const box = document.createElement('div');
  box.className = 'auth';
  box.innerHTML = '<div class="auth-card">' +
    '<div class="auth-brand"><div class="logo">' + ic('cal') + '</div><div><b>Nöbet Çizelgesi</b><span>Hukuk Birimi</span></div></div>' +
    (setupNeeded ?
      '<h1>İlk kurulum</h1><p class="muted">Bu formla <b>baş yönetici</b> hesabı açılır. Kayıt ekranı yoktur; diğer yöneticileri ve personel hesaplarını baş yönetici ekler. Bu form yalnızca bir kez görünür.</p>' +
      '<form id="setup-form" class="form">' +
      field('Adınız soyadınız', '<input name="displayName" required autocomplete="name">') +
      field('Baş yönetici e-posta adresi','<input name="username" type="email" required autocomplete="email">', 'Firebase\'de bu e-postayla kayıtlı olur. Girişte ve şifre sıfırlamada kullanılır.') +
      field('Şifre', '<input name="password" type="password" required minlength="6" autocomplete="new-password">') +
      field('Şifre (tekrar)', '<input name="password2" type="password" required minlength="6" autocomplete="new-password">') +
      '<label class="check"><input type="checkbox" name="seed" checked> <span>Mevcut 6 personeli ve Kasım 2026 çizelgesini (PDF\'teki) başlangıç verisi olarak yükle</span></label>' +
      '<button class="btn primary block">Yönetici hesabını oluştur</button></form>'
      :
      '<h1>Giriş</h1>' +
      '<form id="login-form" class="form">' +
      field('Kullanıcı adı', '<input name="username" required autocomplete="username" autocapitalize="none">', 'Yönetici e-posta adresiyle giriş yapar.') +
      field('Şifre', '<input name="password" type="password" required autocomplete="current-password">') +
      '<button class="btn primary block">Giriş yap</button></form>' +
      '<p class="muted small">Hesabınız yoksa veya şifrenizi unuttuysanız yöneticinize başvurun. <button class="link" id="forgot">Yönetici şifremi unuttum</button></p>') +
    '<p class="err-msg" ' + (errMsg ? '' : 'hidden') + '>' + esc(errMsg || '') + '</p>' +
    (demo ? '<p class="demo-note">Deneme modu: veriler yalnızca bu tarayıcıda saklanır.' + (setupNeeded ? '' : ' <button class="link" id="demo-reset">Deneme verisini sıfırla</button>') + '</p>' : '') +
    '</div>';
  $('#app').appendChild(box);
  if (installTools) $('.auth-card', box).appendChild(installTools);
  const showErr = m => { const p = $('.err-msg', box); p.textContent = m; p.hidden = !m; if (m) p.scrollIntoView({ block: 'center', behavior: 'smooth' }); };
  const f = $('#login-form', box) || $('#setup-form', box);
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(f));
    showErr('');
    const btn = $('button.primary', f); btn.disabled = true;
    busy(true, setupNeeded ? 'Yönetici hesabı oluşturuluyor…' : 'Giriş yapılıyor…');
    try {
      if (setupNeeded) {
        if (v.password !== v.password2) throw new Error('Şifreler aynı değil.');
        await store.setup({ username: v.username, password: v.password, displayName: v.displayName.trim(), seed: !!v.seed });
      } else await store.login(v.username, v.password);
    } catch (err) { showErr(err.message); btn.disabled = false; }
    finally { busy(false); }
  });
  const fg = $('#forgot', box);
  if (fg) fg.onclick = async () => {
    const email = $('[name=username]', box).value.trim();
    if (!email.includes('@')) { showErr('Önce kullanıcı adı alanına yönetici e-posta adresini yazın.'); return; }
    try { await store.resetPassword(email); showErr(''); toast('Şifre sıfırlama bağlantısı ' + email + ' adresine gönderildi'); } catch (e) { showErr(e.message); }
  };
  const r = $('#demo-reset', box);
  if (r) r.onclick = () => { store.resetDemo(); renderLogin(true); };
}
function field(label, input, hint) {
  return '<label class="field"><span>' + label + '</span>' + input + (hint ? '<small>' + hint + '</small>' : '') + '</label>';
}

/* ================= İskelet ================= */
const TABS = [
  { id: 'cizelge', label: 'Çizelge', icon: 'cal' },
  { id: 'izinler', label: 'İzinler', icon: 'leave' },
  { id: 'denge', label: 'Fazla mesai', icon: 'scale', self: true },
  { id: 'personel', label: 'Personel', icon: 'users', admin: true },
  { id: 'ayarlar', label: 'Ayarlar', icon: 'gear', admin: true }
];
function shell() {
  const installTools = $('.pwa-tools');
  if (installTools) document.body.appendChild(installTools);
  $('#app').innerHTML =
    '<header class="top"><div class="top-in">' +
    '<a class="brand" href="#/cizelge"><span class="logo">' + ic('cal') + '</span><span><b>Nöbet</b><i>Hukuk Birimi</i></span></a>' +
    '<nav class="tabs" id="tabs"></nav>' +
    '<button class="me-btn" data-act="account">' + ic('user') + '<span>' + esc(me.displayName || me.username) + '</span>' + (isAdmin() ? '<em>' + ROLE_LABEL[me.role] + '</em>' : '') + '</button>' +
    '</div></header>' +
    (store.mode === 'demo' ? '<div class="demo-bar">Deneme modu — veriler yalnızca bu tarayıcıda. Gerçek kullanım için adresin sonundaki <code>?demo</code> kısmını kaldırın.</div>' : '') +
    '<main id="view"></main>';
  if (installTools) $('.top-in').insertBefore(installTools, $('.me-btn'));
}
/* Personel Denge sayfasında yalnızca kendi bakiyesini görür (hesabı bir personele bağlıysa). */
const tabAllowed = t => isAdmin() || (!t.admin && (!t.self || !!me.personId));
function renderTabs() {
  const pending = isAdmin() ? (data.requests || []).filter(r => r.status === 'pending').length : 0;
  $('#tabs').innerHTML = TABS.filter(tabAllowed).map(t =>
    '<a href="#/' + t.id + '" class="tab' + (ui.route === t.id ? ' on' : '') + '">' + ic(t.icon) + '<span>' + (t.id === 'denge' && !isAdmin() ? 'Bakiyem' : t.label) + '</span>' +
    (t.id === 'izinler' && pending ? '<b class="badge" title="Bekleyen izin talebi">' + pending + '</b>' : '') + '</a>').join('');
}
function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  const r = parts[0] || 'cizelge';
  ui.route = TABS.some(t => t.id === r && tabAllowed(t)) ? r : 'cizelge';
  if (ui.route === 'cizelge' && /^\d{4}-\d{2}$/.test(parts[1] || '')) ui.ym = parts[1];
}
function fitCalendar() {
  const cal = document.querySelector('.cal');
  if (!cal) return;
  const top = cal.getBoundingClientRect().top + window.scrollY;
  cal.style.setProperty('--calendar-height', Math.max(520, window.innerHeight - top - 12) + 'px');
}
window.addEventListener('resize', fitCalendar);
document.fonts.ready.then(fitCalendar);
/* Yönetici bildirimi: bekleyen izin talepleri her sayfada sağ altta; oradan onay / ret. */
function renderNotices() {
  let box = $('#notice');
  const pend = isAdmin() ? (data.requests || []).filter(r => r.status === 'pending').sort((a, b) => a.createdAt - b.createdAt) : [];
  document.title = (pend.length ? '(' + pend.length + ') ' : '') + 'Nöbet Çizelgesi';
  /* Oturum açıkken yeni talep gelirse kısa bildirim. */
  if (ui.knownReq) pend.filter(r => !ui.knownReq.has(r.id)).forEach(r => toast('Yeni izin talebi: ' + E.fullName(E.person(cfg(), r.personId)) + ', ' + E.fmtDate(r.from) + (r.to !== r.from ? ' – ' + E.fmtDate(r.to) : ''), 'warn'));
  ui.knownReq = new Set(pend.map(r => r.id));
  const hidden = ui.noticeHidden = ui.noticeHidden || new Set(), show = pend.filter(r => !hidden.has(r.id));
  if (!show.length) { if (box) box.remove(); return; }
  if (!box) { box = document.createElement('aside'); box.id = 'notice'; box.className = 'notice'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
  const c = cfg();
  box.innerHTML = '<header><b>' + ic('leave') + (show.length > 1 ? show.length + ' izin talebi bekliyor' : 'İzin talebi bekliyor') + '</b><button class="icon-btn" data-act="notice-hide" aria-label="Bildirimi gizle">' + ic('x') + '</button></header>' +
    show.slice(0, 3).map(r => {
      const p = E.person(c, r.personId), x = { from: r.from, to: r.to }, hits = shiftsBetween(r.personId, r.from, r.to);
      return '<div class="nt-item"><div class="nt-main">' + pname(p) + '<small>' + esc(E.leaveType(c, r.type).name) + ' · ' + E.fmtDate(r.from) + (r.to !== r.from ? ' – ' + E.fmtDate(r.to) : '') + ' · ' + E.leaveWorkdays(c, x, r.from, r.to) + ' iş günü' +
        (hits.length ? ' · <b>' + hits.length + ' nöbeti var</b>' : '') + '</small>' + (r.note ? '<small class="nt-note">“' + esc(r.note) + '”</small>' : '') + '</div>' +
        '<div class="nt-act"><button class="btn sm primary" data-act="req-approve" data-id="' + r.id + '">' + ic('check') + 'Onayla</button><button class="btn sm" data-act="req-reject" data-id="' + r.id + '">Reddet</button></div></div>';
    }).join('') + (show.length > 3 ? '<a class="nt-more" href="#/izinler">Tüm talepler (' + show.length + ')</a>' : '');
}
function render() {
  if (!data || !me) return;
  renderTabs();
  renderNotices();
  const v = $('#view');
  const y = window.scrollY;
  requestAnimationFrame(fitCalendar);
  v.innerHTML = ({ cizelge: viewSchedule, izinler: viewLeaves, denge: viewBalance, personel: viewPeople, ayarlar: viewSettings })[ui.route]();
  if (ui.route === 'ayarlar') loadUsers();
  window.scrollTo(0, y);
  settingsSpy();
}
window.addEventListener('hashchange', () => { const before = ui.route; parseRoute(); render(); if (before !== ui.route) window.scrollTo(0, 0); });

/* ================= Çizelge ================= */
function viewSchedule() {
  const c = cfg(), ym = ui.ym, sched = data.schedules[ym], D = E.daysIn(ym);
  const issues = sched ? E.validate(c, data.schedules, ym) : [];
  const errDays = {}; issues.forEach(i => { if (i.day != null && i.level === 'error') errDays[i.day] = (errDays[i.day] || 0) + 1; });
  const posts = E.monthPosts(c, sched);
  const status = !sched ? '<span class="chip">Oluşturulmadı</span>' : sched.status === 'final' ? '<span class="chip ok">' + ic('check') + 'Kesinleşti</span>' : '<span class="chip draft">Taslak</span>';
  const errCount = issues.filter(i => i.level === 'error').length;

  const thisYm = today.slice(0, 7);
  let h = '<section class="page-head sched-head">' +
    '<div class="month-nav"><button class="icon-btn" data-act="month" data-n="-1" aria-label="Önceki ay">' + ic('left') + '</button>' +
    '<h1>' + E.MONTHS[E.ymParts(ym).m - 1] + ' <span>' + E.ymParts(ym).y + '</span></h1>' +
    '<button class="icon-btn" data-act="month" data-n="1" aria-label="Sonraki ay">' + ic('right') + '</button>' + status +
    (ym !== thisYm ? '<button class="link back" data-act="this-month">Bu aya dön</button>' : '') + '</div>' +
    '<div class="actions">';
  if (isAdmin()) {
    h += '<button class="btn" data-act="documents">' + ic('rule') + 'Belgeler</button>';
    h += '<button class="btn primary" data-act="generate">' + ic('spark') + (sched ? 'Yeniden oluştur' : 'Çizelge oluştur') + '</button>';
    if (sched) h += '<button class="btn" data-act="finalize">' + ic(sched.status === 'final' ? 'undo' : 'check') + (sched.status === 'final' ? 'Taslağa al' : 'Kesinleştir') + '</button>';
  }
  if (sched) h += '<div class="btn-group" role="group" aria-label="Çıktı"><button class="btn" data-act="pdf" title="PDF olarak indir">' + ic('down') + 'PDF</button><button class="btn" data-act="png" title="Resim (PNG) olarak indir">' + ic('down') + 'PNG</button><button class="btn" data-act="xlsx" title="Excel olarak indir">' + ic('down') + 'Excel</button><button class="btn" data-act="print" title="Yazdır">' + ic('print') + 'Yazdır</button></div>';
  h += '<button class="btn" data-act="month-requests">Talepler ve çalışılamayan günler</button>';
  h += '<button class="icon-btn" data-act="more" title="Diğer işlemler" aria-label="Diğer işlemler">' + ic('more') + '</button>' +
    '<button class="icon-btn" data-act="help" title="Nasıl kullanılır?" aria-label="Nasıl kullanılır?">' + ic('help') + '</button>';
  h += '</div></section>';

  /* Bugün kimde? */
  const scheduleHeader = h; h = '';
  if (ym === thisYm && sched) {
    const td = +today.slice(8) - 1, tomorrow = E.addDays(today, 1);
    h += '<button class="todaycard" data-act="cell" data-d="' + td + '"><span class="tc-date"><small>Bugün</small><b>' + (td + 1) + ' ' + E.MONTHS[E.ymParts(ym).m - 1] + '</b><small>' + E.WEEKDAYS[E.weekdayOf(today)] + '</small></span>' +
      posts.map(pst => { const ids = E.dayList(sched, pst.id, td); return '<span class="tc-post"><small>' + (E.postLabel(pst) ? esc(pst.name) + ' · ' : '') + '08:00 → ' + E.fmtDate(tomorrow) + ' 08:00</small><b>' + (ids.length ? ids.map(id => esc(E.listName(E.person(c, id)))).join(', ') : '<em>—</em>') + '</b></span>'; }).join('') + '</button>';
  }

  /* Kullanıcıya kendi yaklaşan nöbetleri */
  if (me.personId && E.person(c, me.personId)) {
    const mine = [];
    Object.keys(data.schedules).sort().forEach(m => {
      const s = data.schedules[m];
      for (let d = 0; d < E.daysIn(m); d++) {
        const date = E.dateOf(m, d);
        if (date < today) continue;
        posts.forEach(p => { if (E.dayList(s, p.id, d).includes(me.personId)) mine.push({ date, post: p }); });
      }
    });
    h += '<section class="mine"><b>Sıradaki nöbetleriniz</b>' + (mine.length ? mine.slice(0, 4).map(x => '<span class="mine-item"><em>' + E.fmtDate(x.date) + '</em> ' + E.WEEKDAYS[E.weekdayOf(x.date)] + (posts.length > 1 && E.postLabel(x.post) ? ' · ' + esc(E.postLabel(x.post)) : '') + '</span>').join('') : '<span class="muted">Yayınlanmış yaklaşan nöbetiniz yok.</span>') + '</section>';
  }

  /* Görünüm seçimi ve kişi lejantı */
  const scheduleToday = h; h = '';
  h += '<div class="view-bar"><div class="seg-tabs" role="tablist">' + [['cal', 'Takvim'], ['list', 'Liste'], ['table', 'Tablo']].map(v =>
    '<button role="tab" aria-selected="' + (ui.view === v[0]) + '" class="' + (ui.view === v[0] ? 'on' : '') + '" data-act="view" data-view="' + v[0] + '">' + v[1] + '</button>').join('') + '</div></div>';
  const scheduleViews = h; h = '';
  const shown = (c.people || []).filter(p => p.active !== false || (sched && posts.some(pst => { for (let d = 0; d < D; d++) if (E.dayList(sched, pst.id, d).includes(p.id)) return true; return false; })));
  h += '<div class="legend">' + shown.map(p => {
    let n = 0; if (sched) for (let d = 0; d < D; d++) posts.forEach(pst => { if (E.dayList(sched, pst.id, d).includes(p.id)) n++; });
    return '<button class="person-chip' + (ui.focus === p.id ? ' on' : '') + '" data-act="focus" data-pid="' + p.id + '" style="--c:' + colorOf(p.id) + '"><i></i>' + esc(E.fullName(p)) + (sched ? '<b>' + n + '</b>' : '') + '</button>';
  }).join('') + (ui.focus ? '<button class="link" data-act="focus" data-pid="">Vurguyu kaldır</button>' : '') + '</div>';

  const schedulePeople = h;
  h = '<section class="schedule-studio">' + scheduleHeader + '<div class="studio-body"><aside class="studio-aside"><div class="studio-label">GÜNLÜK OPERASYON</div>' + (scheduleToday || '<p class="muted">Seçili ayın görev planı</p>') + '<div class="studio-label roster-label">PERSONEL / NÖBET SAYISI</div>' + schedulePeople + '<div class="studio-foot">24 / 72<span>Nöbet planlama merkezi</span></div></aside><div class="studio-main"><div class="studio-toolbar"><span class="studio-label">AYLIK GÖREV PLANI</span>' + (ui.view === 'cal' && posts.length ? '<span class="cal-legend">' + posts.map((pst, i) => i && !E.postLabel(pst) ? '' : '<span><i class="' + (i ? 'n' : 'd') + '"></i>' + esc(i ? E.postLabel(pst) : pst.name) + '</span>').join('') + '</span>' : '') + scheduleViews + '</div>';
  h += ui.view === 'list' ? renderList(ym, sched, errDays) : ui.view === 'table' ? renderTable(ym, sched, errDays) : renderCal(ym, sched, errDays);

  h += '</div></div></section>';
  if (!sched) h += '<p class="empty-note">' + (isAdmin() ? 'Günlere tıklayarak atamaları ve gün kısıtlarını seçin. Tüm talepleri yanıtladıktan sonra <b>Çizelge oluştur</b> düğmesine basın. Herkesin aylık hedefi 168 saattir; fazla mesai bakiyesi hedefi değiştirmez. İsterseniz <button class="link" data-act="manual">boş çizelge açın</button>.' : 'Gelecek günlere tıklayarak çalışamayacağınız günleri talep edebilirsiniz. Soluk renk bekleyen talebi, belirgin renk onaylanan günü gösterir.') + '</p>';
  else if (isAdmin() && sched.status !== 'final') h += '<p class="hint">Taslak çizelgeyi yalnızca yöneticiler görür. <b>Kesinleştir</b>\'e bastığınızda personel de görür. Bir güne tıklayarak nöbetçiyi elle değiştirebilirsiniz; elle değiştirilen günler sabitlenir (' + ic('pin', 'pin inline') + ').</p>';
  else if (isAdmin()) h += '<p class="hint">Bir güne tıklayarak nöbetçiyi elle değiştirebilirsiniz. Elle değiştirilen günler sabitlenir (' + ic('pin', 'pin inline') + ') ve yeniden oluşturmada korunur.</p>';

  /* Denetim ve özet */
  if (sched) {
    const tot = posts.reduce((a, pst) => { for (let d = 0; d < D; d++) a += E.dayList(sched, pst.id, d).length; return a; }, 0);
    const hrs = +(c.settings.shiftHours || 24);
    const wk = posts.reduce((a, pst) => { for (let d = 0; d < D; d++) { const k = E.dayCat(c, E.dateOf(ym, d)); if (k === 'sat' || k === 'sun' || k === 'hol') a += E.dayList(sched, pst.id, d).length; } return a; }, 0);
    h += '<div class="kpis"><div class="kpi"><b>' + tot + '</b><span>Toplam nöbet</span></div><div class="kpi"><b>' + (tot * hrs).toLocaleString('tr-TR') + '</b><span>Toplam saat</span></div>' +
      '<div class="kpi"><b>' + wk + '</b><span>Hafta sonu / tatil nöbeti</span></div><div class="kpi' + (errCount ? ' bad' : ' good') + '"><b>' + errCount + '</b><span>Kural ihlali</span></div></div>';
    h += '<div class="two-col">';
    h += '<section class="panel"><h2>Ay özeti</h2>' + summaryTables(ym) + '</section>';
    h += '<section class="panel issues"><h2>Denetim ' + (errCount ? '<span class="count err">' + errCount + '</span>' : '<span class="count ok">' + ic('check') + '</span>') + '</h2>' +
      (issues.length ? '<ul>' + issues.map(i => '<li class="' + i.level + '">' + (i.day != null ? '<button class="link" data-act="cell" data-d="' + i.day + '">' + (i.day + 1) + ' ' + E.MONTHS[E.ymParts(ym).m - 1] + '</button> ' : '') + esc(i.msg) + '</li>').join('') + '</ul>' : '<p class="muted">Kural ihlali yok. Herkes 24 saat nöbet + ' + (c.settings.restHours || 72) + ' saat dinlenme düzenine uyuyor, izinli günlere nöbet yazılmamış.</p>') +
      (isAdmin() ? '<button class="btn sm explain-btn" data-act="explain">' + ic('help') + 'Hedefler neden tam tutmuyor?</button>' : '') +
      '</section></div>';
  }
  return h;
}

/* ---- Görünümler ---- */
function dayInfo(ym, sched, d) {
  const c = cfg(), date = E.dateOf(ym, d), wd = E.weekdayOf(date), hol = E.holidayOn(c, date);
  const away = (c.people || []).filter(p => p.active !== false && (p.posts || []).length && E.leaveOn(c, p.id, date));
  const hit = !!ui.focus && ((c.posts || []).some(pst => sched && E.dayList(sched, pst.id, d).includes(ui.focus)) || away.some(p => p.id === ui.focus));
  return { date, wd, hol, away, hit };
}
function slotsHtml(ym, sched, d) {
  const c = cfg(), posts = E.monthPosts(c, sched);
  let s = '';
  posts.forEach(pst => {
    const ids = sched ? E.dayList(sched, pst.id, d) : [];
    const pinned = sched && E.isPinned(sched, pst.id, d);
    if (!ids.length) {
      if (sched && E.isActivePost(pst) && !E.isCyclePost(pst) && E.needOn(pst, E.dateOf(ym, d))) s += '<div class="slot empty">' + (posts.length > 1 ? '<small>' + esc(pst.short || pst.name) + '</small>' : '') + 'Boş</div>';
      return;
    }
    ids.forEach(id => {
      const p = E.person(c, id);
      s += '<div class="slot' + (pst !== posts[0] ? ' second' : '') + (id === ui.focus ? ' hit' : '') + '" style="--c:' + colorOf(id) + '">' +
        '<i></i><span>' + esc(p ? E.fullName(p) : '?') + '</span>' + (pinned ? ic('pin', 'pin') : '') + '</div>';
    });
  });
  return s + requestBadges(E.dateOf(ym, d));
}
function requestBadges(date) {
  const reqs = (data.requests || []).filter(r => r.status === 'pending' && r.from <= date && date <= r.to);
  const approved = (cfg().leaves || []).filter(l => l.from <= date && date <= l.to);
  const label = (r, pending) => {
    const p = E.person(cfg(), r.personId), t = E.leaveType(cfg(), r.type);
    const text = (p ? p.name : '?') + ' · ' + (t.unavailable ? 'Çalışamaz' : t.name) + (pending ? ' (talep)' : '');
    const title = E.fullName(p) + ' · ' + t.name + (pending ? ' · Onay bekliyor' : ' · Yönetici onaylı');
    return '<span class="request-day ' + (pending ? 'pending' : 'approved') + '" title="' + esc(title) + '"><span class="request-label">' + esc(text) + '</span>' + (pending ? '' : '<span class="request-check" role="img" aria-label="Yönetici onaylı">' + ic('check') + '</span>') + '</span>';
  };
  return reqs.map(r => label(r, true)).join('') + approved.map(l => label(l, false)).join('');
}
function monthRequestsModal() {
  const from = E.dateOf(ui.ym, 0), to = E.dateOf(ui.ym, E.daysIn(ui.ym) - 1);
  const reqs = (data.requests || []).filter(r => r.from <= to && r.to >= from);
  const leaves = (cfg().leaves || []).filter(l => l.from <= to && l.to >= from);
  modal({ title: E.monthLabel(ui.ym) + ' · Talepler ve günler', wide: true,
    body: '<p class="muted">Talepler ve onaylı günler çizelge silinse de korunur. Onaylanan günleri aşağıdaki Düzenle düğmesinden değiştirebilirsiniz.</p><div class="leave-list">' + (reqs.map(r => reqRow(r, isAdmin())).join('') || '<p>Bu ay talep yok.</p>') + '</div>' +
      '<h3>Onaylı günler / izinler</h3>' + leaves.map(l => '<p>' + pname(E.person(cfg(), l.personId)) + ' · ' + esc(E.leaveType(cfg(), l.type).name) + ' · ' + E.fmtDate(l.from) + ' – ' + E.fmtDate(l.to) + (isAdmin() ? ' <button class="btn sm" data-act="leave-edit" data-id="' + l.id + '">Düzenle</button><button class="btn sm" data-act="leave-del" data-id="' + l.id + '">Sil</button>' : '') + '</p>').join(''),
    foot: '<button class="btn" data-close>Kapat</button>' });
}
const WD3 = ['PAZ', 'PZT', 'SAL', 'ÇAR', 'PER', 'CUM', 'CMT'];
function avatarHtml(p, cls = '') {
  return '<span class="av ' + cls + '" style="--c:' + (p ? colorOf(p.id) : '#888') + '">' + esc(E.initials(p)) + '</span>';
}
/* Takvim hücresinde ad: geniş ekranda tam ad, dar ekranda yalnız ad. */
const nameSpans = p => '<span class="nm-l">' + esc(E.fullName(p)) + '</span><span class="nm-s">' + esc(p ? p.name : '?') + '</span>';
/* Takvim: sade ay ızgarası, renkli görev kartları ve güçlü bugün vurgusu. */
function renderCal(ym, sched, errDays) {
  const c = cfg(), D = E.daysIn(ym), lead = (E.weekdayOf(E.dateOf(ym, 0)) + 6) % 7, weeks = Math.ceil((lead + D) / 7);
  const posts = E.monthPosts(c, sched);
  const weekdays = [['Pazartesi', 'Pzt'], ['Salı', 'Sal'], ['Çarşamba', 'Çar'], ['Perşembe', 'Per'], ['Cuma', 'Cum'], ['Cumartesi', 'Cmt'], ['Pazar', 'Paz']];
  let h = '<div style="--weeks:' + weeks + '" class="cal' + (ui.focus ? ' focusing' : '') + '"><div class="cal-head">' + weekdays.map((w, i) => '<div class="cal-wd' + (i > 4 ? ' we' : '') + '"><span>' + w[0] + '</span><small>' + w[1] + '</small></div>').join('') + '</div><div class="cal-grid">';
  for (let pos = 0; pos < weeks * 7; pos++) {
    const d = pos - lead;
    if (d < 0 || d >= D) {
      h += '<div class="cal-day out" aria-hidden="true"><span class="cal-top"><span class="cal-num">' + +E.addDays(E.dateOf(ym, 0), d).slice(8) + '</span></span></div>';
      continue;
    }
    const x = dayInfo(ym, sched, d);
    const assign = sched ? posts.flatMap((pst, postIndex) => E.dayList(sched, pst.id, d).map(id => ({ id, pst, postIndex }))) : [];
    const lead1 = assign.filter(a => !a.postIndex), rest = assign.filter(a => a.postIndex);
    const pinned = sched && posts.some(pst => E.isPinned(sched, pst.id, d));
    const excludedNames = isAdmin() ? (c.people || []).filter(p => E.dateRuleOn(c, p.id, x.date, 'cannot')).map(p => E.fullName(p)) : [];
    const cls = ['cal-day', x.wd === 0 || x.wd === 6 ? 'we' : '', x.hol ? 'hol' : '', x.date === today ? 'today' : '', x.date < today ? 'past' : '', errDays[d] ? 'err' : '', x.hit ? 'hit' : '', sched && !lead1.length ? 'empty' : '', !sched ? 'none' : ''].join(' ').replace(/\s+/g, ' ').trim();
    h += '<button class="' + cls + '" data-act="cell" data-d="' + d + '" aria-label="' + esc(E.fmtDateLong(x.date)) + '">' +
      '<span class="cal-top"><span class="cal-num">' + (d + 1) + '</span><span class="cal-wd-m">' + WD3[x.wd] + '</span><span class="cal-flags">' +
      (x.date === today ? '<em class="cal-today">Bugün</em>' : '') + (errDays[d] ? '<span class="cal-err" title="Kural ihlali">' + ic('alert') + '</span>' : '') + (pinned ? '<span class="cal-pin" title="Elle sabitlendi">' + ic('pin') + '</span>' : '') + '</span></span>' +
      (x.hol ? '<span class="cal-hol" title="' + esc(x.hol.name) + '">' + esc(x.hol.name) + '</span>' : '') +
      (excludedNames.length ? '<span class="cal-away" title="Nöbet tutamaz: ' + esc(excludedNames.join(', ')) + '">' + ic('rule') + '<span>Tutamaz: ' + esc(excludedNames.join(', ')) + '</span></span>' : '') +
      '<span class="cal-body">' + (lead1.length ? lead1.map(({ id }) => {
        const p = E.person(c, id);
        return '<span class="cal-duty' + (id === ui.focus ? ' sel' : '') + '" title="' + esc(posts[0].name + ': ' + E.fullName(p)) + '">' + nameSpans(p) + '</span>';
      }).join('') : '') +
      rest.map(({ id, pst }) => {
        const p = E.person(c, id);
        return '<span class="cal-second' + (id === ui.focus ? ' sel' : '') + '" title="' + esc((E.postLabel(pst) ? E.postLabel(pst) + ': ' : '') + E.fullName(p)) + '">' + nameSpans(p) + '</span>';
      }).join('') + (!lead1.length ? (sched ? '<span class="cal-empty">Boş</span>' : '<span class="cal-none">—</span>') : '') + '</span>' +
      requestBadges(x.date) + '</button>';
  }
  return h + '</div></div>';
}
function renderList(ym, sched, errDays) {
  const c = cfg(), D = E.daysIn(ym);
  const mp = E.monthPosts(c, sched), main = mp.slice(0, 1), extra = mp.slice(1);
  let h = '<div class="dlist2' + (ui.focus ? ' focusing' : '') + '">';
  for (let d = 0; d < D; d++) {
    const x = dayInfo(ym, sched, d);
    const ids = sched ? main.flatMap(pst => E.dayList(sched, pst.id, d)) : [];
    const ex = sched ? extra.flatMap(pst => E.dayList(sched, pst.id, d).map(id => ({ id, pst }))) : [];
    const cls = ['dl2', x.wd === 0 || x.wd === 6 ? 'we' : '', x.hol ? 'hol' : '', x.date === today ? 'today' : '', errDays[d] ? 'err' : '', x.hit ? 'hit' : ''].join(' ');
    h += '<button class="' + cls + '" data-act="cell" data-d="' + d + '"' + (ids.length ? ' style="--c:' + colorOf(ids[0]) + '"' : '') + '>' +
      '<span class="dl2-date"><b>' + (d + 1) + '</b><small>' + E.WEEKDAYS[x.wd] + '</small></span>' +
      '<span class="dl2-main">' + (ids.length ? ids.map(id => { const p = E.person(c, id); return '<span class="c2-person">' + avatarHtml(p, 'sm') + '<b>' + esc(E.fullName(p)) + '</b>' + (p && p.code ? '<code>' + esc(p.code) + '</code>' : '') + '</span>'; }).join('') : sched ? '<span class="c2-empty">Boş</span>' : '<span class="faint">—</span>') + '</span>' +
      '<span class="dl2-side">' + ex.map(({ id, pst }) => { const p = E.person(c, id); return '<span class="c2-extra" style="--e:' + colorOf(id) + '"><i></i>' + (E.postLabel(pst) ? '<small>' + esc(E.postLabel(pst)) + '</small>' : '') + '<b>' + esc(p ? p.name : '?') + ' <strong>' + esc(p ? trUpper(p.surname) : '') + '</strong></b></span>'; }).join('') +
      (x.hol ? '<em>' + esc(x.hol.name) + '</em>' : '') + requestBadges(x.date) +
      (errDays[d] ? '<span class="err-dot">' + ic('alert') + '</span>' : '') + '</span></button>';
  }
  return h + '</div>';
}
/* Tablo: kişi × gün matrisi. Nöbet günü dolu renkli blok, ardından gelen dinlenme günleri açık tonla gösterilir. */
function renderTable(ym, sched, errDays) {
  const c = cfg(), D = E.daysIn(ym), posts = E.monthPosts(c, sched), cyc = E.cycleDays(c);
  const people = (c.people || []).filter(p => p.active !== false || (sched && posts.some(pst => { for (let d = 0; d < D; d++) if (E.dayList(sched, pst.id, d).includes(p.id)) return true; return false; })));
  let h = '<div class="mx-wrap"><table class="mx"><thead><tr><th class="mx-name">Personel</th>';
  for (let d = 0; d < D; d++) {
    const date = E.dateOf(ym, d), wd = E.weekdayOf(date), hol = E.holidayOn(c, date);
    h += '<th class="' + [wd === 0 || wd === 6 ? 'we' : '', hol ? 'hol' : '', date === today ? 'today' : '', errDays[d] ? 'err' : ''].join(' ') + '" title="' + esc(E.fmtDateLong(date) + (hol ? ' · ' + hol.name : '')) + '"><button data-act="cell" data-d="' + d + '"><b>' + (d + 1) + '</b><small>' + WD3[wd] + '</small></button></th>';
  }
  h += '<th class="mx-sum">Nöbet</th><th class="mx-sum">H.sonu</th></tr></thead><tbody>';
  people.forEach(p => {
    const on = new Array(D).fill(null);
    if (sched) for (let d = 0; d < D; d++) on[d] = posts.find(x => E.dayList(sched, x.id, d).includes(p.id)) || null;
    const rest = new Set();
    on.forEach((pst, d) => { if (pst) for (let k = 1; k < cyc; k++) rest.add(d + k); });
    let n = 0, wk = 0, row = '';
    for (let d = 0; d < D; d++) {
      const date = E.dateOf(ym, d), wd = E.weekdayOf(date), hol = E.holidayOn(c, date), lv = E.leaveOn(c, p.id, date), pst = on[d];
      if (pst) { n++; if (wd === 0 || wd === 6 || hol) wk++; }
      const cell = pst ? '<span class="blk' + (pst !== posts[0] ? ' second' : '') + '"' + (E.postLabel(pst) ? ' title="' + esc(pst.name) + '"' : '') + '>' + (pst !== posts[0] && E.postLabel(pst) ? '2' : '') + '</span>'
        : lv ? '<span class="blk leave" title="' + esc(E.leaveType(c, lv.type).name) + '">İ</span>'
          : rest.has(d) ? '<span class="blk rest" title="Dinlenme"></span>' : '';
      row += '<td class="' + [wd === 0 || wd === 6 ? 'we' : '', hol ? 'hol' : '', date === today ? 'today' : ''].join(' ') + '">' + cell + '</td>';
    }
    h += '<tr class="' + (ui.focus && ui.focus !== p.id ? 'dim' : '') + '" style="--c:' + colorOf(p.id) + '"><th class="mx-name"><span class="mx-person">' + avatarHtml(p, 'sm') + '<span><b>' + esc(E.fullName(p)) + '</b>' + (p.code ? '<small>' + esc(p.code) + '</small>' : '') + '</span></span></th>' + row +
      '<td class="mx-sum"><b>' + n + '</b></td><td class="mx-sum">' + wk + '</td></tr>';
  });
  return h + '</tbody></table></div><p class="legend-note"><span class="blk demo"></span>Nöbet <span class="blk rest demo"></span>Dinlenme ' + (posts[1] ? '<span class="blk second demo">' + (E.postLabel(posts[1]) ? '2' : '') + '</span>' + esc(E.postLabel(posts[1]) || 'Sabit döngü') + ' ' : '') + '<span class="blk leave demo">İ</span>İzinli · Gün numarasına tıklayarak o günü düzenleyebilirsiniz.</p>';
}

function hoursTable(ym) {
  const c = cfg(), sched = data.schedules[ym], H = E.monthlyHoursOf(c);
  if (!H || !sched) return '';
  const rows = E.monthHours(c, sched, ym).filter(r => r.target > 0 || r.shifts);
  if (!rows.length) return '';
  const extra = Object.values(sched.extra || {}).reduce((a, l) => a + l.length, 0);
  return '<h3>Aylık mesai</h3><div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Personel</th><th>Nöbet</th><th>Saat</th><th title="İzin ve nöbet payı düşülmüş hedef">Hedef</th><th>Durum</th></tr></thead><tbody>' +
    rows.map(r => { const diff = r.hours - r.target; return '<tr><td>' + pname(r.person) + '</td><td class="n">' + r.shifts + '</td><td class="n strong">' + r.hours + '</td><td class="n">' + Math.round(r.target) + '</td><td class="n">' +
      (r.target <= 0 ? '<span class="faint">–</span>' : diff < 0 ? '<span class="bal minus">' + Math.round(diff) + ' sa</span>' : '<span class="bal plus">tamam' + (diff > 0 ? ' +' + Math.round(diff) : '') + '</span>') + '</td></tr>'; }).join('') +
    '</tbody></table></div><p class="note">Hedef ayda ' + H + ' saat; izinli iş günleri mesaiden sayılır (gün başına ' + num(8) + ' saat düşülür).' + (extra ? ' Hedefi doldurmak için bu ay <b>' + extra + ' ek gün</b> açıldı; ek günler normal nöbet gibi sayılır.' : '') +
    ' Hedefin üstündeki saatler çizelge kesinleşince kişinin <a href="#/izinler">fazla mesai bakiyesine</a> yazılır ve izin olarak kullanılabilir.</p>';
}
function summaryTables(ym) { return hoursTable(ym); }
function legacySummaryTables(ym) {
  const c = cfg(), groups = E.monthSummaryAll(c, data.schedules, ym);
  return hoursTable(ym) + groups.map(g => {
    if (!g.rows.length) return '';
    const title = g.post.id === '*' ? (c.posts.length > 1 ? '<h3>Nöbet dengesi <small class="muted">tüm görevler birlikte</small></h3>' : '') : '<h3>' + esc(g.post.name) + '</h3>';
    if (E.isCyclePost(g.post)) {
      return title + '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Personel</th><th>Nöbet</th><th>İzin günü</th></tr></thead><tbody>' +
        g.rows.map(r => '<tr><td>' + pname(r.person) + '</td><td class="n">' + r.count + '</td><td class="n">' + (r.leaveDays || '–') + '</td></tr>').join('') + '</tbody></table></div>' +
        '<p class="note">' + esc(g.post.name) + ' kendi 24/72 döngüsünde tutulur; izin dönüşü döngü kaldığı yerden sürer.</p>';
    }
    const hrs = +(c.settings.shiftHours || 24);
    return title + '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Personel</th><th title="Önceki aylardan devreden bakiye">Devir</th><th title="Bu ayın adil payı">Hak</th><th title="Hak − devir">Hedef</th><th>Tuttu</th><th>Saat</th><th title="Ay sonundaki bakiye">Yeni bakiye</th>' +
      E.CATS.map(k => '<th class="cat">' + k.short + '</th>').join('') + '<th>İzin</th></tr></thead><tbody>' +
      g.rows.map(r => '<tr><td>' + pname(r.person) + '</td><td class="n">' + bal(r.prevBal) + '</td><td class="n">' + num(r.fair) + '</td><td class="n">' + num(r.target) + '</td><td class="n strong">' + r.count + '</td><td class="n">' + r.count * hrs + '</td><td class="n">' + bal(r.newBal) + '</td>' +
        E.CATS.map(k => '<td class="n cat" title="Hak: ' + num(r.catFair[k.key]) + '">' + (r.cats[k.key] || '<span class="faint">0</span>') + '</td>').join('') +
        '<td class="n">' + (r.leaveDays || '<span class="faint">–</span>') + '</td></tr>').join('') +
      '</tbody></table></div>' +
      '<p class="note">Görevler arasında fark yoktur; hangi görevde tutulursa tutulsun her nöbet aynı sayılır. <b>Devir</b>: önceki aylarda hakkından fazla (+) ya da eksik (−) tutulan nöbet. <b>Hedef</b> = bu ayın hakkı − devir; otomatik dağıtım herkesi hedefine yaklaştırır. Telafi gerektiren izinlerde (rapor, yıllık izin vb.) kişinin hakkı sürer, tutamadığı nöbet sonraki aylara eksi devreder.</p>';
  }).join('');
}
const pname = p => p ? '<span class="pn" style="--c:' + colorOf(p.id) + '"><i></i>' + esc(E.fullName(p)) + '</span>' : '?';

async function doGenerate() {
  const c = cfg(), ym = ui.ym, old = data.schedules[ym];
  if (E.pendingRequests(data.requests || [], ym).length) {
    toast('Bu ay için bekleyen talepler var. Önce her talebi onaylayın veya reddedin.', 'err');
    monthRequestsModal(); return;
  }
  for (const pst of (c.posts || []).filter(E.isActivePost)) {
    if (!E.postPeople(c, pst.id).some(p => p.active !== false)) { toast('"' + pst.name + '" görevine atanmış aktif personel yok. Personel sayfasından görev atayın.', 'err'); return; }
  }
  const pins = old ? Object.values(old.pins || {}).reduce((a, l) => a + l.length, 0) : 0;
  if (old) {
    const ok = await confirmBox('Çizelge yeniden oluşturulsun mu?',
      (old.status === 'final' ? '<b>Bu ay kesinleşmiş.</b> ' : '') + 'Mevcut atamalar silinip yeniden dağıtılacak.' + (pins ? ' Sabitlenmiş ' + pins + ' gün korunur.' : ''), 'Yeniden oluştur', old.status === 'final');
    if (!ok) return;
  }
  const prevYm = E.addMonths(ym, -1), start = c.settings.startMonth;
  if (start && prevYm >= start && !data.schedules[prevYm]) toast('Uyarı: ' + E.monthLabel(prevYm) + ' çizelgesi yok; bakiye hesabı eksik olabilir.', 'warn');
  busy(true, 'Çizelge oluşturuluyor…');
  await new Promise(r => setTimeout(r, 30));
  let sched;
  try { sched = E.generate(c, data.schedules, ym, { iters: 50000, tries: 4, requests: data.requests }); } catch (e) { busy(false); toast('Oluşturma hatası: ' + e.message, 'err'); return; }
  busy(false);
  if (E.pendingRequests(data.requests || [], ym).length) { toast('Yeni talep geldi. Önce talepleri yanıtlayın.', 'err'); return; }
  const errors = E.validate(c, { ...data.schedules, [ym]: sched }, ym).filter(i => i.level === 'error');
  if (errors.length) {
    modal({ title: 'Uygun çizelge oluşturulamadı', body: '<p class="lead">Sabitlemeler, izinler veya gün kısıtları birlikte karşılanamıyor. Seçimlerinizi ya da görev kadrosunu düzenleyip tekrar deneyin. Mevcut çizelgeniz korundu.</p><ul class="issue-list">' + errors.map(i => '<li class="error">' + (i.day != null ? (i.day + 1) + '. gün: ' : '') + esc(i.msg) + '</li>').join('') + '</ul>' });
    return;
  }
  await run(() => store.saveSchedule(sched), E.monthLabel(ym) + ' çizelgesi oluşturuldu');
}

function cellModal(d) {
  const cpPosts = () => E.monthPosts(cfg(), data.schedules[ui.ym]);
  const c = cfg(), ym = ui.ym, date = E.dateOf(ym, d), sched = data.schedules[ym], hol = E.holidayOn(c, date);
  const catLabel = E.CATS.find(k => k.key === E.dayCat(c, date)).label;
  const away = (c.people || []).filter(p => E.leaveOn(c, p.id, date));
  const dayIssues = sched ? E.validate(c, data.schedules, ym).filter(i => i.day === d) : [];
  let body = '<p class="lead">' + E.fmtDateLong(date) + ' 08:00 → ' + E.fmtDate(E.addDays(date, 1)) + ' 08:00 <span class="chip">' + catLabel + '</span></p>' +
    (hol ? '<p class="hol-line">' + esc(hol.name) + '</p>' : '') +
    (away.length ? '<p class="muted">İzinli: ' + away.map(p => esc(E.fullName(p)) + ' (' + esc(E.leaveType(c, E.leaveOn(c, p.id, date).type).name) + ')').join(', ') + '</p>' : '') +
    (dayIssues.length ? '<ul class="issue-list">' + dayIssues.map(i => '<li class="' + i.level + '">' + esc(i.msg) + '</li>').join('') + '</ul>' : '');

  if (!isAdmin()) {
    body += cpPosts().map((pst, pi) => {
      const ids = sched ? E.dayList(sched, pst.id, d) : [];
      return '<div class="ro-post">' + (E.postLabel(pst) || !pi ? '<h3>' + esc(pst.name) + '</h3>' : '') + (ids.length ? ids.map(id => { const p = E.person(c, id); return '<div class="ro-person">' + pname(p) + (p && p.phone ? ' <a href="tel:' + esc(p.phone) + '">' + esc(p.phone) + '</a>' : '') + '</div>'; }).join('') : '<p class="muted">—</p>') + '</div>';
    }).join('');
    if (isAdmin() && !sched) body += '<p class="muted">Elle düzenleme için önce bu ayın çizelgesini oluşturun.</p>';
    /* Personel: bu gün için izin talebi (bugün ve sonrası). */
    const canReq = !isAdmin() && me.personId && date >= today;
    let foot = '';
    if (canReq) {
      const mine = sched && cpPosts().some(pst => E.dayList(sched, pst.id, d).includes(me.personId));
      const pend = (data.requests || []).find(r => r.personId === me.personId && r.status === 'pending' && r.from <= date && date <= r.to);
      const onLeave = E.leaveOn(c, me.personId, date);
      if (mine) body += '<p class="cap-note ok">' + ic('cal') + '<span>Bu gün nöbetiniz var. İzin talebiniz onaylanırsa yönetici yerinize birini yazar.</span></p>';
      if (pend) body += '<p class="muted">Bu tarihi kapsayan bir talebiniz yöneticinin onayını bekliyor (' + E.fmtDate(pend.from) + ' – ' + E.fmtDate(pend.to) + ').</p>';
      else if (onLeave) body += '<p class="muted">Bu gün zaten izinlisiniz.</p>';
      else foot = '<button class="btn ghost" data-close>Kapat</button><button class="btn primary" data-req>' + ic('leave') + 'Bu gün için izin talebi</button>';
    }
    modal({
      title: (d + 1) + ' ' + E.MONTHS[E.ymParts(ym).m - 1], body, foot,
      onMount(el, close) { const b = $('[data-req]', el); if (b) b.onclick = () => { close(); reqModal(date); }; }
    });
    return;
  }

  const sel = {}, pin = {};
  const daySched = sched || E.emptySchedule(ym);
  const managed = r => r.type === 'date' && r.mode === 'cannot' && r.source === 'calendar' && r.from === date && r.to === date;
  const excluded = new Set((c.rules || []).filter(managed).map(r => r.personId));
  body += '<p class="hint">Nöbet tutacak kişiyi seçtiğinizde o görev sabitlenir ve otomatik oluşturmada korunur. Aşağıdan bu gün nöbet tutamayacak kişileri de işaretleyebilirsiniz.</p>';
  cpPosts().forEach(pst => { sel[pst.id] = E.dayList(daySched, pst.id, d); pin[pst.id] = E.isPinned(daySched, pst.id, d); });
  body += cpPosts().map((pst, pi) => {
    const cands = E.candidates(c, data.schedules, ym, pst.id, d);
    const multi = E.isCyclePost(pst) || (+pst.required || 1) > 1;
    return '<div class="pick" data-post="' + pst.id + '" data-multi="' + (multi ? 1 : 0) + '"><div class="pick-head"><h3>' + esc(pst.name) + '</h3>' +
      '<label class="check small"><input type="checkbox" data-pin ' + (pin[pst.id] ? 'checked' : '') + '> ' + ic('pin', 'pin inline') + 'Sabit</label></div>' +
      '<div class="cands">' + cands.filter(x => x.inPost || sel[pst.id].includes(x.person.id)).map(x =>
        '<button type="button" class="cand' + (sel[pst.id].includes(x.person.id) ? ' on' : '') + (x.ok ? '' : ' warn') + '" data-pid="' + x.person.id + '" style="--c:' + colorOf(x.person.id) + '">' +
        '<i></i><span><b>' + esc(E.fullName(x.person)) + '</b>' + (x.notes.length ? '<small>' + esc(x.notes.join(' · ')) + '</small>' : '<small class="okay">Uygun</small>') + '</span></button>').join('') +
      '<button type="button" class="cand none' + (!sel[pst.id].length ? ' on' : '') + '" data-pid="">' + '<span><b>Boş bırak</b></span></button>' +
      '</div>' +
      (cands.some(x => !x.inPost && !sel[pst.id].includes(x.person.id)) ? '<details class="others"><summary>Görev listesinde olmayan personel</summary><div class="cands">' +
        cands.filter(x => !x.inPost && !sel[pst.id].includes(x.person.id)).map(x => '<button type="button" class="cand' + (x.ok ? '' : ' warn') + '" data-pid="' + x.person.id + '" style="--c:' + colorOf(x.person.id) + '"><i></i><span><b>' + esc(E.fullName(x.person)) + '</b><small>' + esc(x.notes.join(' · ') || 'Uygun') + '</small></span></button>').join('') + '</div></details>' : '') +
      '</div>';
  }).join('');

  body += '<div class="pick"><h3>Bu gün nöbet tutamaz</h3><p class="muted">İşaretlenen kişiler bu tarihte hiçbir göreve atanmaz. İşareti kaldırarak kısıtı silebilirsiniz.</p><div class="pool-picks">' +
    (c.people || []).filter(p => p.active !== false || excluded.has(p.id)).map(p => {
      const other = (c.rules || []).some(r => !managed(r) && r.type === 'date' && r.mode === 'cannot' && r.personId === p.id && r.from <= date && date <= r.to);
      return '<label class="check pill"><input type="checkbox" data-exclude="' + esc(p.id) + '"' + (excluded.has(p.id) || other ? ' checked' : '') + (other ? ' disabled' : '') + '> ' + esc(E.fullName(p)) + (other ? ' <small>(Özel kurallardan tanımlı)</small>' : '') + '</label>';
    }).join('') + '</div></div>';

  modal({
    title: (d + 1) + ' ' + E.MONTHS[E.ymParts(ym).m - 1] + ' nöbeti', body, wide: true,
    foot: '<button class="btn ghost" data-close>Vazgeç</button><button class="btn primary" data-save>Kaydet</button>',
    onMount(el, close) {
      $$('.pick[data-post]', el).forEach(box => {
        const pid = box.dataset.post, multi = box.dataset.multi === '1';
        box.addEventListener('click', e => {
          const b = e.target.closest('.cand'); if (!b) return;
          const id = b.dataset.pid;
          if (!id) sel[pid] = [];
          else if (multi) sel[pid] = sel[pid].includes(id) ? sel[pid].filter(x => x !== id) : sel[pid].concat(id);
          else sel[pid] = [id];
          $$('.cand', box).forEach(x => x.classList.toggle('on', x.dataset.pid ? sel[pid].includes(x.dataset.pid) : !sel[pid].length));
          $('[data-pin]', box).checked = true;
        });
      });
      $('[data-save]', el).onclick = async () => {
        const s = clone(data.schedules[ym] || E.emptySchedule(ym));
        const blocked = $$('[data-exclude]:checked', el).map(x => x.dataset.exclude);
        if (Object.values(sel).some(ids => ids.some(id => blocked.includes(id)))) {
          toast('Aynı kişi hem nöbetçi hem de “Bu gün nöbet tutamaz” olarak seçilemez.', 'err'); return;
        }
        const nextCfg = clone(cfg());
        nextCfg.rules = (nextCfg.rules || []).filter(r => !managed(r));
        $$('[data-exclude]:checked:not(:disabled)', el).forEach(x => nextCfg.rules.push({ id: uid(), type: 'date', mode: 'cannot', personId: x.dataset.exclude, from: date, to: date, source: 'calendar', note: 'Takvimden gün kısıtı' }));
        s.pins = s.pins || {};
        cpPosts().forEach(pst => {
          E.setDayList(s, pst.id, d, sel[pst.id]);
          const on = $('.pick[data-post="' + pst.id + '"] [data-pin]', el).checked;
          const l = (s.pins[pst.id] || []).filter(x => x !== d);
          if (on) l.push(d);
          s.pins[pst.id] = l;
        });
        const overfull = cpPosts().find(pst => !E.isCyclePost(pst) && sel[pst.id].length > (+pst.required || 1));
        if (overfull) { toast(overfull.name + ' için en fazla ' + (+overfull.required || 1) + ' kişi seçebilirsiniz.', 'err'); return; }
        try { await run(() => store.saveDayPlan(nextCfg, s), 'Gün seçimleri kaydedildi; çizelge oluştururken uygulanacak'); close(); } catch (e) { /* bildirildi */ }
      };
    }
  });
}

/* ---- Yazdırma: PDF'teki çizelge düzeni (her satırda 7 gün, gün aralığı başlıkları) ---- */
async function printSchedule() {
  const ym = ui.ym, previousTitle = document.title;
  try {
    const canvas = await drawSchedule(cfg(), data.schedules, ym);
    canvas.className = 'pr-artwork';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', E.monthLabel(ym) + ' Nöbet Çizelgesi');
    $('#print').replaceChildren(canvas);
    document.title = E.monthLabel(ym) + ' Nöbet Çizelgesi';
    window.print();
  } catch (err) {
    toast('Çıktı hazırlanamadı: ' + err.message);
  } finally {
    document.title = previousTitle;
  }
}
const fileBase = () => E.monthLabel(ui.ym).replace(' ', '_') + '_Nobet_Cizelgesi';
async function exportFile(make, ext) {
  busy(true, 'Dosya hazırlanıyor…');
  await new Promise(r => setTimeout(r, 30));
  try { download(await make(), fileBase() + ext); } catch (e) { console.error(e); toast('Dosya oluşturulamadı: ' + e.message, 'err'); } finally { busy(false); }
}
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ================= İzinler ================= */
function viewLeaves() {
  const c = cfg(), y = ui.year;
  const own = !isAdmin();
  const leaves = (c.leaves || []).filter(l => l.to >= y + '-01-01' && l.from <= y + '-12-31' && (own ? l.personId === me.personId : (!ui.leavePerson || l.personId === ui.leavePerson)))
    .sort((a, b) => b.from.localeCompare(a.from));
  const people = own ? (c.people || []).filter(p => p.id === me.personId) : (c.people || []).filter(p => p.active !== false || (c.leaves || []).some(l => l.personId === p.id));
  let h = '<section class="page-head"><div><h1>' + (own ? 'İzinlerim' : 'İzinler') + ' <span>' + y + '</span></h1><p class="muted">' + (own ? 'İzin talebinizi buradan iletin; yönetici onayladığında izniniz çizelgeye işlenir ve o günlere nöbet yazılmaz.' : 'Yıllık izin, rapor ve diğer izinler. İzinli günlere nöbet yazılmaz; telafi gerektiren izinler bakiyeye yansır.') + '</p></div>' +
    '<div class="actions"><div class="seg"><button class="icon-btn" data-act="year" data-n="-1" aria-label="Önceki yıl">' + ic('left') + '</button><b>' + y + '</b><button class="icon-btn" data-act="year" data-n="1" aria-label="Sonraki yıl">' + ic('right') + '</button></div>' +
    (isAdmin() ? '<button class="btn primary" data-act="leave-add">' + ic('plus') + 'İzin ekle</button>' : me.personId ? '<button class="btn primary" data-act="req-add">' + ic('plus') + 'İzin talebi oluştur</button>' : '') + '</div></section>';
  if (own && !me.personId) h += '<p class="empty-note">Hesabınız bir personel kaydına bağlı değil. İzin talebi oluşturabilmek için yöneticinizden hesabınızı bağlamasını isteyin.</p>';
  h += requestsPanel();

  h += '<section class="panel"><h2>Yıllık izin durumu</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Personel</th><th>Hak (gün)</th><th>Kullanılan</th><th>Kalan</th>' +
    (c.leaveTypes || []).filter(t => !t.annual).map(t => '<th>' + esc(t.name) + '</th>').join('') + '</tr></thead><tbody>' +
    people.map(p => {
      const used = E.annualUsed(c, p.id, y), right = +p.annualLeave || 0;
      return '<tr><td>' + pname(p) + '</td><td class="n">' + (right || '–') + '</td><td class="n strong">' + used + '</td><td class="n">' + (right ? (right - used < 0 ? '<span class="bal minus">' + (right - used) + '</span>' : right - used) : '–') + '</td>' +
        (c.leaveTypes || []).filter(t => !t.annual).map(t => {
          const n = (c.leaves || []).filter(l => l.personId === p.id && l.type === t.id).reduce((a, l) => a + E.leaveWorkdays(c, l, y + '-01-01', y + '-12-31'), 0);
          return '<td class="n">' + (n || '<span class="faint">–</span>') + '</td>';
        }).join('') + '</tr>';
    }).join('') + '</tbody></table></div><p class="note">Sayılar iş günüdür (hafta sonu ve resmi tatiller sayılmaz). Yıllık izin hakkı personel kartından değiştirilir.</p></section>';
  h += overtimePanel(people);

  h += '<section class="panel"><div class="panel-head"><h2>' + (own ? 'Onaylanmış izinlerim' : 'İzin kayıtları') + '</h2>' + (own ? '' : '<select data-act="leave-filter" aria-label="Personel filtresi"><option value="">Tüm personel</option>' +
    people.map(p => '<option value="' + p.id + '"' + (ui.leavePerson === p.id ? ' selected' : '') + '>' + esc(E.fullName(p)) + '</option>').join('') + '</select>') + '</div>';
  if (!leaves.length) h += '<p class="muted">' + y + ' için kayıtlı izin yok.</p>';
  else h += '<div class="leave-list">' + leaves.map(l => {
    const t = E.leaveType(c, l.type), p = E.person(c, l.personId);
    return '<div class="leave-row" style="--t:' + (t.color || '#888') + '"><div class="lr-main">' + pname(p) + '<span class="ltype">' + esc(t.name) + '</span>' + (t.compensate === false ? '<span class="chip">Telafi yok</span>' : '') + '</div>' +
      '<div class="lr-dates">' + E.fmtDate(l.from) + ' – ' + E.fmtDate(l.to) + '<small>' + E.leaveCalendarDays(l) + ' takvim günü · ' + E.leaveWorkdays(c, l, l.from, l.to) + ' iş günü</small></div>' +
      (l.note ? '<div class="lr-note">' + esc(l.note) + '</div>' : '<div class="lr-note"></div>') +
      (isAdmin() ? '<div class="lr-act"><button class="icon-btn" data-act="leave-edit" data-id="' + l.id + '" aria-label="Düzenle">' + ic('edit') + '</button><button class="icon-btn danger-h" data-act="leave-del" data-id="' + l.id + '" aria-label="Sil">' + ic('trash') + '</button></div>' : '') + '</div>';
  }).join('') + '</div>';
  return h + '</section>';
}

/* ---- Fazla mesai bakiyesi ---- */
const hrsTxt = x => num(x, 0) + ' sa';
/* Fazla mesai izni girilirken: kalan bakiye ve bu iznin düşeceği saat (düzenlenen izin hariç tutulur). */
function overtimeUseNote(pid, x, editingId) {
  const c = cfg(), L = E.overtimeLedger(c, data.schedules, pid);
  if (!L) return '';
  const prev = editingId ? L.uses.filter(u => u.leave.id === editingId).reduce((a, u) => a + u.hours, 0) : 0;
  const left = L.balance + prev, cost = E.overtimeRelease(c, data.schedules, { ...x, personId: pid }).debitHours;
  return 'Fazla mesai bakiyesi ' + hrsTxt(left) + '; bu izin ' + hrsTxt(cost) + ' düşer, kalan ' + hrsTxt(left - cost) + '.' + (left - cost < 0 ? ' Bakiye yetmiyor.' : '');
}
function overtimePanel(people) {
  const c = cfg(), H = E.monthlyHoursOf(c);
  if (!H || !people.length) return '';
  const otTypes = (c.leaveTypes || []).filter(t => t.overtime);
  const rows = people.map(p => ({ p, L: E.overtimeLedger(c, data.schedules, p.id) })).filter(x => x.L);
  let h = '<section class="panel"><h2>Fazla mesai bakiyesi</h2>';
  if (!rows.length) return h + '<p class="muted">Henüz kesinleşmiş çizelge yok. Bakiye, kesinleşen aylardan hesaplanır.</p></section>';
  h += '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Personel</th><th title="Kesinleşmiş aylarda tutulan saat − aylık hedef">Biriken</th><th title="Fazla mesai izni olarak kullanılan">Kullanılan</th><th>Kalan</th><th title="Kalan saatin iş günü karşılığı">Kalan izin</th></tr></thead><tbody>' +
    rows.map(({ p, L }) => {
      const tip = L.months.map(m => E.monthLabel(m.ym) + ': ' + m.hours + ' / ' + Math.round(m.target) + ' sa (' + (m.diff >= 0 ? '+' : '') + Math.round(m.diff) + ')').join('\n');
      return '<tr><td>' + pname(p) + (isAdmin() ? '<button class="icon-btn adj-btn" data-act="ot-edit" data-pid="' + p.id + '" title="Bakiye gir" aria-label="' + esc(E.fullName(p)) + ' için bakiye gir">' + ic('plus') + '</button>' : '') + '</td><td class="n" title="' + esc(tip) + '">' + bal(L.earned) + '</td><td class="n">' + (L.used ? hrsTxt(L.used) + ' <small class="muted">(' + L.uses.reduce((a, u) => a + u.days, 0) + ' gün)</small>' : '<span class="faint">–</span>') + '</td>' +
        '<td class="n strong">' + (L.balance < 0 ? '<span class="bal minus">' + hrsTxt(L.balance) + '</span>' : hrsTxt(L.balance)) + '</td><td class="n">' + (L.balance > 0 ? num(L.balance / L.dayHours) + ' gün' : '<span class="faint">–</span>') + '</td></tr>';
    }).join('') + '</tbody></table></div>' +
    '<p class="note">Yönetici, isimlerin yanındaki + ikonuyla bakiye girebilir. Her nöbetlik fazla mesai izni 24 saat bakiyeden düşer.</p></section>';
  return h;
}
function overtimeBalanceModal(pid) {
  const p = E.person(cfg(), pid), ledger = E.overtimeLedger(cfg(), data.schedules, pid);
  modal({ title: E.fullName(p) + ' · Fazla mesai bakiyesi',
    body: '<p>Mevcut bakiye: <b>' + hrsTxt(ledger.balance) + '</b>. Toplam bakiyenin kaç saat olmasını istediğinizi girin. Önceki kayıtlar korunur; fark düzeltme olarak eklenir.</p><form class="form" id="ot-form">' + field('Toplam bakiye (saat)', '<input type="number" name="hours" required step="1" value="' + ledger.balance + '">') + field('Açıklama', '<input name="note" required placeholder="Ör. Sistem öncesinden kalan 10 nöbet">') + '</form>' + '<div class="det-list">' + ledger.manual.map(a => '<p>' + esc(a.note) + ' · ' + hrsTxt(a.hours) + '</p>').join('') + '</div>',
    foot: '<button class="btn ghost" data-close>Vazgeç</button><button class="btn primary" form="ot-form">Kaydet</button>',
    onMount(el, close) { $('#ot-form', el).onsubmit = async e => {
      e.preventDefault(); const f = new FormData(e.target), hours = +f.get('hours');
      if (!Number.isFinite(hours)) return;
      try { await saveCfg(c => { const current = E.overtimeLedger(c, data.schedules, pid).balance; (c.overtimeAdjustments = c.overtimeAdjustments || []).push({ id: uid(), personId: pid, hours: hours - current, note: f.get('note').trim(), by: me.displayName, at: Date.now() }); }, 'Fazla mesai bakiyesi kaydedildi'); close(); } catch (err) { /* bildirildi */ }
    }; }
  });
}

/* ---- İzin talepleri ---- */
const REQ_STATUS = { pending: ['Onay bekliyor', 'draft'], approved: ['Onaylandı', 'ok'], rejected: ['Reddedildi', 'rej'] };
function shiftsBetween(pid, from, to) {
  const c = cfg(), hits = [];
  Object.keys(data.schedules).forEach(m => { for (let d = 0; d < E.daysIn(m); d++) { const dt = E.dateOf(m, d); if (dt >= from && dt <= to && (c.posts || []).some(p => E.dayList(data.schedules[m], p.id, d).includes(pid))) hits.push(E.fmtDate(dt)); } });
  return hits;
}
function reqRow(r, admin) {
  const c = cfg(), t = E.leaveType(c, r.type), p = E.person(c, r.personId), st = REQ_STATUS[r.status] || REQ_STATUS.pending;
  const x = { from: r.from, to: r.to };
  return '<div class="leave-row req" style="--t:' + (t.color || '#888') + '"><div class="lr-main">' + pname(p) + '<span class="ltype">' + esc(t.name) + '</span><span class="chip ' + st[1] + '">' + st[0] + '</span></div>' +
    '<div class="lr-dates">' + E.fmtDate(r.from) + ' – ' + E.fmtDate(r.to) + '<small>' + E.leaveCalendarDays(x) + ' takvim günü · ' + E.leaveWorkdays(c, x, r.from, r.to) + ' iş günü</small></div>' +
    '<div class="lr-note">' + (r.note ? esc(r.note) : '') + (r.reply ? '<small class="reply">' + (r.status === 'rejected' ? 'Red gerekçesi: ' : 'Not: ') + esc(r.reply) + '</small>' : '') +
    (r.decidedBy ? '<small>' + esc(r.decidedBy) + ' · ' + new Date(r.decidedAt).toLocaleDateString('tr-TR') + '</small>' : '<small>Talep: ' + new Date(r.createdAt).toLocaleDateString('tr-TR') + '</small>') + '</div>' +
    '<div class="lr-act">' + (admin && r.status === 'pending' ? '<button class="btn sm primary" data-act="req-approve" data-id="' + r.id + '">' + ic('check') + 'Onayla</button><button class="btn sm" data-act="req-reject" data-id="' + r.id + '">Reddet</button>' :
      admin && ['approved', 'rejected'].includes(r.status) ? '<button class="btn sm danger" data-act="req-delete" data-id="' + r.id + '">' + ic('trash') + 'Sil</button>' :
      !admin && r.uid === me.uid && r.status === 'pending' ? '<button class="btn sm" data-act="req-cancel" data-id="' + r.id + '">Geri çek</button>' : '') + '</div></div>';
}
function requestsPanel() {
  const reqs = (data.requests || []).filter(r => (r.to || '') >= ui.year + '-01-01' && (r.from || '') <= ui.year + '-12-31' || r.status === 'pending');
  if (isAdmin()) {
    const pend = reqs.filter(r => r.status === 'pending'), done = reqs.filter(r => r.status !== 'pending');
    if (!pend.length && !done.length) return '';
    return '<section class="panel"><h2>İzin talepleri ' + (pend.length ? '<span class="count err">' + pend.length + '</span>' : '') + '</h2>' +
      (pend.length ? '<div class="leave-list">' + pend.map(r => reqRow(r, true)).join('') + '</div>' : '<p class="muted">Bekleyen talep yok.</p>') +
      (done.length ? '<details class="others"><summary>Sonuçlanan talepler (' + done.length + ')</summary><div class="leave-list">' + done.map(r => reqRow(r, true)).join('') + '</div></details>' : '') + '</section>';
  }
  if (!me.personId) return '';
  return '<section class="panel"><h2>Tüm talepler</h2>' + (reqs.length ? '<div class="leave-list">' + reqs.map(r => reqRow(r, false)).join('') + '</div>' : '<p class="muted">Henüz talep yok.</p>') + '</section>';
}
function reqModal(date) {
  const c = cfg(), day = typeof date === 'string' ? date : E.addDays(today, 1);
  modal({
    title: 'İzin talebi',
    body: '<form class="form" id="req-form">' +
      field('İzin türü', '<select name="type">' + (c.leaveTypes || []).map(t => '<option value="' + t.id + '">' + esc(t.name) + '</option>').join('') + '</select>') +
      '<div class="row2">' + field('Başlangıç', '<input type="date" name="from" required min="' + today + '" value="' + day + '">') + field('Bitiş (dahil)', '<input type="date" name="to" required min="' + today + '" value="' + day + '">') + '</div>' +
      '<p class="calc muted" id="req-calc"></p>' +
      field('Açıklama', '<input name="note" placeholder="İsteğe bağlı">') + '</form>',
    foot: '<button class="btn ghost" data-close>Vazgeç</button><button class="btn primary" form="req-form">Talebi gönder</button>',
    onMount(el, close) {
      const f = $('#req-form', el);
      const calc = () => {
        const v = Object.fromEntries(new FormData(f)), out = $('#req-calc', el);
        if (!v.from || !v.to) { out.textContent = ''; return; }
        if (v.to < v.from) { out.textContent = 'Bitiş tarihi başlangıçtan önce olamaz.'; return; }
        const x = { from: v.from, to: v.to }, hits = shiftsBetween(me.personId, v.from, v.to);
        out.textContent = E.leaveCalendarDays(x) + ' takvim günü, ' + E.leaveWorkdays(c, x, v.from, v.to) + ' iş günü.' + (hits.length ? ' Bu tarihlerde nöbetiniz var (' + hits.join(', ') + '); onaylanırsa yerinize başka biri yazılır.' : '') +
          (E.leaveType(c, v.type).overtime ? ' ' + overtimeUseNote(me.personId, x) : '');
      };
      f.addEventListener('input', calc); calc();
      f.addEventListener('submit', async e => {
        e.preventDefault();
        const v = Object.fromEntries(new FormData(f));
        if (v.to < v.from) { toast('Bitiş tarihi başlangıçtan önce olamaz.', 'err'); return; }
        if (!me.personId || (data.requests || []).some(r => r.personId === me.personId && r.status === 'pending' && r.from <= v.to && r.to >= v.from)) { toast('Personel bağlantınızı ve aynı tarihleri kapsayan bekleyen taleplerinizi kontrol edin.', 'err'); return; }
        try { await run(() => store.createRequest({ personId: me.personId, requester: me.displayName, type: v.type, from: v.from, to: v.to, note: v.note.trim() }), 'Talebiniz yöneticiye iletildi'); close(); } catch (err) { /* bildirildi */ }
      });
    }
  });
}
/* İzin kaydedilmeden önce: kişinin o tarihlerdeki nöbetlerine yerine atanacakları hesapla. */
const cfgWith = leave => { const c2 = clone(cfg()); c2.leaves = (c2.leaves || []).filter(x => x.id !== leave.id).concat(leave); return c2; };
function planCover(leave, picks) {
  return E.coverLeave(cfgWith(leave), data.schedules, leave.personId, leave.from, leave.to, { picks, leaveId: leave.id, type: leave.type });
}
const hrsOf = () => +(cfg().settings.shiftHours || 24);
const balH = x => bal(x * hrsOf()) + (Math.abs(x) < 0.05 ? '' : ' <small class="muted">sa</small>');
/* İzinle boşalan her nöbet için yerine tutacak kişiyi yöneticiye seçtirir.
   Adaylar en uygundan başlayarak sıralanır (kurallara uygun olanlar, bakiyesi en eksik olan önce).
   Döner: { picks } ya da vazgeçilirse null. Boşalan nöbet yoksa doğrudan onay kutusu. */
function pickCover(leave, title, intro, okLabel) {
  const c = cfg(), slots = E.coverOptions(cfgWith(leave), data.schedules, leave.personId, leave.from, leave.to);
  if (!slots.length) return confirmBox(title, intro, okLabel).then(ok => (ok ? { picks: {} } : null));
  const who = esc(E.fullName(E.person(c, leave.personId)));
  /* Adayın durumu: bakiye, bu ayki mesai, önceki ve sonraki nöbet. */
  const ago = (dt, n, word) => dt ? E.fmtDate(dt).slice(0, -5) + ' (' + n + ' gün ' + word + ')' : 'yok';
  const facts = (s, o) => [
    'Bakiye ' + balH(o.bal),
    o.monthTarget ? 'Bu ay ' + o.monthHours + ' / ' + Math.round(o.monthTarget) + ' sa' : 'Bu ay ' + o.monthHours + ' sa',
    'Son nöbet ' + ago(o.lastDate, o.gapPrev, 'önce'),
    'Sonraki ' + ago(o.nextDate, o.gapNext, 'sonra')
  ].join(' · ');
  /* Neden üstte: uygun adaylar arasında en eksik bakiye, mesaisi hedefin altında, en uzun dinlenmiş. */
  const why = (s, o, okList) => {
    const r = [], minBal = Math.min(...okList.map(x => x.bal)), maxRest = Math.max(...okList.map(x => Math.min(x.gapPrev, x.gapNext)));
    if (o.bal <= minBal + 1e-9) r.push('nöbet bakiyesi en eksik');
    if (o.monthTarget && o.monthHours < o.monthTarget) r.push('bu ay mesaisi ' + Math.round(o.monthTarget - o.monthHours) + ' saat eksik');
    if (Math.min(o.gapPrev, o.gapNext) >= maxRest && okList.length > 1) r.push('en uzun dinlenmiş');
    if (o.move) r.push('o gün zaten ek nöbette, saati değişmez');
    return r.length ? 'Neden: ' + r.join(', ') : '';
  };
  const optRow = (s, o, i, rec) => '<label class="cand' + (o.ok ? '' : ' bad') + '" style="--c:' + colorOf(o.person.id) + '"><input type="radio" name="' + s.key + '" value="' + o.person.id + '"' + (i === 0 && o.ok ? ' checked' : '') + '><i></i>' +
    '<span><b>' + esc(E.fullName(o.person)) + (rec ? ' <em class="rec">Önerilen</em>' : '') + '</b><small class="facts">' + facts(s, o) + '</small>' +
    (o.ok ? (rec && s.whyTop ? '<small class="okay">' + esc(s.whyTop) + '</small>' : '') + (o.move ? '<small class="okay">O gün ek ' + esc(o.move.map(id => (E.post(c, id) || {}).name || '').join(', ')) + ' nöbetinde; oradan alınır, dinlenmesi ve saati değişmez</small>' : '') : '<small>' + esc(o.notes.join(' · ')) + '</small>') + '</span></label>';
  const body = '<p class="lead">' + intro + '</p><p class="muted">' + who + ' izinliyken aşağıdaki nöbetler boşalıyor. Her biri için yerine kimin tutacağını seçin. Liste en uygundan başlar: önce dinlenme ve diğer kurallara uyanlar; aralarında nöbet bakiyesi en eksik olan, bu ay mesaisi hedefin altında kalan ve en uzun dinlenmiş olan üstte. ' +
    (E.leaveType(c, leave.type).overtime ? 'İzinlinin bakiyesinden toplam <b>' + leave.debitHours + ' saat</b> düşer. Yerine tutanın çalıştığı saatler kendi aylık hesabına eklenir. Kurala uymayan birini de seçebilirsiniz; ihlal uyarı olarak gösterilir.' : 'Yerine tutanın çalıştığı saatler aylık hesabına eklenir.') + '</p>' +
    '<form id="cover-form" class="cover-pick">' + slots.map(s => {
      const pst = E.post(c, s.postId), ok = s.options.filter(o => o.ok), bad = s.options.filter(o => !o.ok);
      s.whyTop = ok.length ? why(s, ok[0], ok) : '';
      return '<div class="pick" role="radiogroup" aria-label="' + esc(E.fmtDateLong(s.date)) + '"><h3 class="pick-title">' + E.fmtDateLong(s.date) + (c.posts.length > 1 ? ' · ' + esc(pst.name) : '') + '</h3>' +
        (ok.length ? '<div class="cands">' + ok.map((o, i) => optRow(s, o, i, i === 0)).join('') + '</div>' : '<p class="err-text">Bu gün için dinlenme ve diğer kurallara uyan kimse yok. Önerilen: ayın kalanını yeniden düzenlemek.</p>') +
        '<div class="cands"><label class="cand none"><input type="radio" name="' + s.key + '" value="*"' + (ok.length ? '' : ' checked') + '><span><b>Ayın kalanını yeniden düzenle' + (ok.length ? '' : ' <em class="rec">Önerilen</em>') + '</b><small>Bu günden ay sonuna kadar dağıtım yeniden yapılır; önceki günler, sabitlenenler ve diğer seçimleriniz korunur, 24/72 bozulmaz. Yerine yazılan kişi kayda geçer.</small></span></label></div>' +
        '<details class="others"><summary>Kurala uymayanlar ve boş bırakma (' + bad.length + ')</summary><div class="cands">' + bad.map((o, i) => optRow(s, o, i, false)).join('') +
        '<label class="cand none"><input type="radio" name="' + s.key + '" value=""><span><b>Boş bırak</b><small>Sonra elle doldurulur</small></span></label></div></details></div>';
    }).join('') + '</form><p class="note">Seçim sonrası Çizelge sayfasındaki denetim, kalan kural ihlallerini gösterir.</p>';
  return new Promise(resolve => {
    let done = false;
    modal({
      title, wide: true, body,
      foot: '<button class="btn ghost" data-close>Vazgeç</button><button class="btn primary" data-ok>' + okLabel + '</button>',
      onMount(el, close) {
        $('[data-ok]', el).onclick = () => {
          const picks = {};
          slots.forEach(s => { const r = $('input[name="' + s.key + '"]:checked', el); picks[s.key] = r ? r.value : ''; });
          if (E.leaveType(c, leave.type).overtime && Object.values(picks).some(v => !v || v === '*')) { toast('Fazla mesai izni için her nöbete yerine tutacak bir isim seçin. Kurala uymayanlar listesinden de seçim yapabilirsiniz.', 'err'); return; }
          done = true; close(); resolve({ picks });
        };
        const obs = new MutationObserver(() => { if (!el.isConnected) { obs.disconnect(); if (!done) resolve(null); } });
        obs.observe($('#modal-root'), { childList: true });
      }
    });
  });
}
async function saveCover(plan) {
  for (const ym of Object.keys(plan.schedules)) await store.saveSchedule(plan.schedules[ym]);
}
async function approveRequest(id) {
  const c = cfg(), r = data.requests.find(x => x.id === id);
  if (!r || r.status !== 'pending') return;
  const p = E.person(c, r.personId);
  if (!p) { toast('Talebin bağlı olduğu personel bulunamadı.', 'err'); return; }
  const leave = { id: uid(), personId: r.personId, type: r.type, from: r.from, to: r.to, note: r.note || '', requestId: r.id };
  if ((c.leaves || []).some(l => l.personId === r.personId && l.from <= r.to && l.to >= r.from)) { toast('Bu tarihlerde onaylı bir izin var. Önce onaylı günleri düzenleyin veya bu talebi reddedin.', 'err'); return; }
  if (E.leaveType(c, leave.type).overtime) {
    Object.assign(leave, E.overtimeRelease(c, data.schedules, leave));
    if (!leave.debitHours) { toast('Fazla mesai izni için mevcut nöbet günü seçilmeli.', 'err'); return; }
    if (E.overtimeLedger(c, data.schedules, p.id).balance < leave.debitHours) { toast('Fazla mesai bakiyesi bu izin için yetersiz.', 'err'); return; }
  }
  const sel = await pickCover(leave, 'İzin onaylansın mı?', '<b>' + esc(E.fullName(p)) + '</b> · ' + esc(E.leaveType(c, r.type).name) + ' · ' + E.fmtDate(r.from) + ' – ' + E.fmtDate(r.to), 'Onayla ve işle');
  if (!sel) return;
  if (E.leaveType(cfg(), leave.type).overtime) {
    const fresh = E.overtimeRelease(cfg(), data.schedules, leave);
    if (JSON.stringify(fresh.releasedDates) !== JSON.stringify(leave.releasedDates) || E.overtimeLedger(cfg(), data.schedules, leave.personId).balance < leave.debitHours) { toast('Çizelge veya bakiye değişti. Talebi güncel bilgilerle tekrar onaylayın.', 'err'); return; }
  }
  const plan = planCover(leave, sel.picks);
  try {
    const nextCfg = clone(cfg()); (nextCfg.leaves = nextCfg.leaves || []).push(leave);
    await run(() => store.resolveRequest(id, nextCfg, plan.schedules, { status: 'approved', decidedBy: me.displayName, decidedAt: Date.now() }),
      plan.changes.length ? 'İzin onaylandı, yerine atama çizelgeye işlendi' : 'İzin onaylandı ve kayda işlendi');
  } catch (e) { /* bildirildi */ }
}
function rejectRequest(id) {
  const c = cfg(), r = data.requests.find(x => x.id === id);
  if (!r || r.status !== 'pending') return;
  const p = E.person(c, r.personId);
  modal({
    title: 'Talebi reddet',
    body: '<p class="lead">' + esc(p ? E.fullName(p) : r.requester || '') + ' · ' + E.fmtDate(r.from) + ' – ' + E.fmtDate(r.to) + '</p><form class="form" id="rej-form">' + field('Gerekçe', '<input name="reply" placeholder="Personel bu notu görür (isteğe bağlı)">') + '</form>',
    foot: '<button class="btn ghost" data-close>Vazgeç</button><button class="btn danger" form="rej-form">Reddet</button>',
    onMount(el, close) {
      $('#rej-form', el).addEventListener('submit', async e => {
        e.preventDefault();
        const reply = new FormData(e.target).get('reply').trim();
        try { await run(() => store.updateRequest(id, { status: 'rejected', reply, decidedBy: me.displayName, decidedAt: Date.now() }), 'Talep reddedildi'); close(); } catch (err) { /* */ }
      });
    }
  });
}

function leaveModal(id) {
  let c = cfg();
  const l = id ? (c.leaves || []).find(x => x.id === id) : { personId: ui.leavePerson || '', type: (c.leaveTypes[0] || {}).id, from: today, to: today, note: '' };
  const people = (c.people || []).filter(p => p.active !== false || p.id === l.personId);
  modal({
    title: id ? 'İzni düzenle' : 'İzin ekle',
    body: '<form class="form" id="leave-form">' +
      field('Personel', '<select name="personId" required><option value="">Seçin</option>' + people.map(p => '<option value="' + p.id + '"' + (p.id === l.personId ? ' selected' : '') + '>' + esc(E.fullName(p)) + '</option>').join('') + '</select>') +
      field('İzin türü', '<select name="type" required data-original-type="' + esc(id ? l.type : '') + '">' + leaveTypeOptions(l.type) + '</select><button type="button" class="link" data-act="lt-manage">İzin türlerini yönet</button>') +
      '<div class="row2">' + field('Başlangıç', '<input type="date" name="from" required value="' + l.from + '">') + field('Bitiş (dahil)', '<input type="date" name="to" required value="' + l.to + '">') + '</div>' +
      '<p class="calc muted" id="leave-calc"></p>' +
      field('Not', '<input name="note" value="' + esc(l.note || '') + '" placeholder="İsteğe bağlı">') + '</form>',
    foot: '<button class="btn ghost" data-close>Vazgeç</button><button class="btn primary" form="leave-form">Kaydet</button>',
    onMount(el, close) {
      const f = $('#leave-form', el);
      const calc = () => {
        c = cfg();
        const v = Object.fromEntries(new FormData(f)), out = $('#leave-calc', el);
        if (!v.from || !v.to || v.to < v.from) { out.textContent = v.to < v.from ? 'Bitiş tarihi başlangıçtan önce olamaz.' : ''; return; }
        const x = { from: v.from, to: v.to };
        let txt = E.leaveCalendarDays(x) + ' takvim günü, ' + E.leaveWorkdays(c, x, v.from, v.to) + ' iş günü.';
        if (v.personId) {
          const hits = [];
          Object.keys(data.schedules).forEach(m => { for (let d = 0; d < E.daysIn(m); d++) { const dt = E.dateOf(m, d); if (dt >= v.from && dt <= v.to && (c.posts || []).some(p => E.dayList(data.schedules[m], p.id, d).includes(v.personId))) hits.push(E.fmtDate(dt)); } });
          if (hits.length) txt += ' Bu tarihlerde nöbeti var (' + hits.join(', ') + '); kaydederken yerine kimin yazılacağı gösterilir.';
          if (E.leaveType(c, v.type).overtime) txt += ' ' + overtimeUseNote(v.personId, x, id);
        }
        out.textContent = txt;
      };
      f.addEventListener('input', calc); calc();
      f.addEventListener('submit', async e => {
        e.preventDefault();
        c = cfg();
        const v = Object.fromEntries(new FormData(f));
        if (v.to < v.from) { toast('Bitiş tarihi başlangıçtan önce olamaz.', 'err'); return; }
        const overlap = (c.leaves || []).find(x => x.id !== id && x.personId === v.personId && x.from <= v.to && v.from <= x.to);
        if (overlap && !(await confirmBox('Çakışan izin', 'Bu kişinin ' + E.fmtDate(overlap.from) + ' – ' + E.fmtDate(overlap.to) + ' tarihli başka bir izni var. Yine de kaydedilsin mi?', 'Kaydet'))) return;
        const rec = { id: id || uid(), personId: v.personId, type: v.type, from: v.from, to: v.to, note: v.note.trim() };
        if (E.leaveType(c, rec.type).overtime) {
          const current = E.overtimeRelease(c, data.schedules, rec);
          const kept = l.personId === rec.personId ? (l.releasedDates || []).filter(dt => dt >= rec.from && dt <= rec.to) : [];
          rec.releasedDates = [...new Set(kept.concat(current.releasedDates))];
          rec.debitHours = rec.releasedDates.length * hrsOf();
          const ledger = E.overtimeLedger(c, data.schedules, rec.personId);
          const refund = ledger.uses.filter(u => u.leave.id === id).reduce((n, u) => n + u.hours, 0);
          if (!rec.debitHours || ledger.balance + refund < rec.debitHours) { toast('Mevcut nöbet günlerini seçin ve yeterli fazla mesai bakiyesi olduğundan emin olun.', 'err'); return; }
        }
        if (l.requestId) rec.requestId = l.requestId;
        let plan = planCover(rec, {});
        if (plan.changes.length) {
          const sel = await pickCover(rec, 'Yerine kim tutacak?', '<b>' + esc(E.fullName(E.person(c, v.personId))) + '</b> · ' + esc(E.leaveType(c, v.type).name) + ' · ' + E.fmtDate(v.from) + ' – ' + E.fmtDate(v.to), 'Kaydet ve ata');
          if (!sel) return;
          plan = planCover(rec, sel.picks);
        }
        try {
          await saveCfg(cc => {
            cc.leaves = cc.leaves || [];
            const i = cc.leaves.findIndex(x => x.id === id);
            if (i >= 0) cc.leaves[i] = rec; else cc.leaves.push(rec);
          });
          await run(() => saveCover(plan), plan.changes.length ? 'İzin kaydedildi, yerine atama çizelgeye işlendi' : 'İzin kaydedildi');
          close();
        } catch (err) { /* bildirildi */ }
      });
    }
  });
}

/* ================= Denge (birikimli bakiye) ================= */
function viewBalance() {
  const people = (cfg().people || []).filter(p => p.active !== false && (isAdmin() || p.id === me.personId));
  return '<section class="page-head"><div><h1>Fazla mesai bakiyesi</h1><p class="muted">Aylık hedef 168 saat. Bir nöbetlik izin 24 saat bakiyeden düşer. Biriken bakiye yeni çizelgenin hedefini değiştirmez.</p></div></section>' + overtimePanel(people);
}
function viewLegacyBalance() {
  const c = cfg(), months = Object.keys(data.schedules).filter(m => !c.settings.startMonth || m >= c.settings.startMonth).sort();
  const admin = isAdmin(), mine = r => admin || r.p.id === me.personId, H = hrsOf();
  const sa = x => num(x * H, 0) + ' <small class="muted">sa</small>';
  const detBtn = pid => ' <button class="icon-btn adj-btn" data-act="bal-detail" data-pid="' + pid + '" title="Ayrıntı" aria-label="Bakiye ayrıntısı">' + ic('eye') + '</button>';
  let h = '<section class="page-head"><div><h1>' + (admin ? 'Nöbet dengesi' : 'Nöbet bakiyem') + '</h1><p class="muted">' + (admin ? 'Başlangıçtan bu yana kim hakkından fazla ya da eksik saat nöbet tuttu? Hak, o günlerde nöbet beklenen herkes arasında eşit paydır; artı bakiyesi olana sonraki çizelgelerde daha az, eksi bakiyesi olana daha çok nöbet yazılır. Biri izinliyken yerine tutan +' + H + ', izinli olan (telafi gerektiren izinde) −' + H + ' saat alır. ' + ic('eye', 'inline') + ' ile ayrıntıya, <b>±</b> ile elle düzeltmeye ulaşırsınız.' : 'Başlangıçtan bu yana hakkınızdan fazla (+) ya da eksik (−) tuttuğunuz nöbet saati. Artı bakiyede sonraki çizelgelerde size daha az, eksi bakiyede daha çok nöbet yazılır. Yalnızca kesinleşmiş çizelgeler hesaba katılır. Ayrıntı için ' + ic('eye', 'inline') + ' düğmesine basın.') + '</p></div>' +
    (isAdmin() ? '<div class="actions"><button class="btn" data-act="adj-add">' + ic('plus') + 'Bakiyeye ekle / çıkar</button></div>' : '') + '</section>';
  if (!months.length) return h + '<p class="empty-note">Henüz çizelge yok.</p>';
  const last = months[months.length - 1], next = E.addMonths(last, 1);
  const cum = E.balancesBefore(c, data.schedules, next);
  /* Genel bakiye: tüm günlük görevler birlikte, saat cinsinden. */
  const ids = new Set(); Object.values(cum).forEach(o => Object.keys(o).forEach(id => ids.add(id)));
  const gen = [...ids].map(id => ({ p: E.person(c, id) })).filter(r => r.p && mine(r)).map(r => ({ ...r, det: E.balanceDetail(c, data.schedules, r.p.id) }))
    .sort((a, b) => E.fullName(a.p).localeCompare(E.fullName(b.p), 'tr'));
  if (gen.length) {
    h += '<section class="panel"><h2>Genel bakiye <small class="muted">' + E.monthLabel(months[0]) + ' – ' + E.monthLabel(last) + ' · saat</small></h2>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Personel</th><th title="Tutulan nöbetlerin toplam saati">Çalışılan</th><th title="Eşit paya göre çalışması gereken">Hak</th><th>Bakiye</th><th title="Başkasının yerine tutulan / yerine başkasının tuttuğu nöbet">Yerine tutma</th></tr></thead><tbody>' +
      gen.map(r => {
        const w = r.det.months.reduce((a, m) => a + m.count, 0), f = r.det.months.reduce((a, m) => a + m.fair, 0);
        const plus = r.det.covers.filter(x => x.sign > 0).length, minus = r.det.covers.filter(x => x.sign < 0 && x.to).length;
        return '<tr><td>' + pname(r.p) + '</td><td class="n">' + sa(w) + '</td><td class="n">' + sa(f) + '</td><td class="n strong">' + balH(r.det.balance) + detBtn(r.p.id) +
          (admin ? ' <button class="icon-btn adj-btn" data-act="adj-add" data-pid="' + r.p.id + '" title="Bakiyeye elle ekle / çıkar" aria-label="Bakiyeye elle ekle / çıkar">±</button>' : '') + '</td>' +
          '<td class="n">' + (plus || minus ? (plus ? '<span class="bal plus">+' + plus + '</span>' : '') + (plus && minus ? ' / ' : '') + (minus ? '<span class="bal minus">−' + minus + '</span>' : '') : '<span class="faint">–</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div><p class="note">Bakiye = çalışılan − hak (+ elle düzeltmeler). Örneğin aynı dönemde biri 144, diğeri 192 saat çalıştıysa ve hakları 168 saatse birine −24, diğerine +24 yazılır. <b>Yerine tutma</b>: başkasının yerine tuttuğu (+) ve yerine başkasının tuttuğu (−) nöbet sayısı.</p></section>';
  }
  if (!gen.length) return h;
  /* Gün türlerine göre (tüm görevler birlikte): çalışılan saat ve o türdeki bakiye. */
  const catOf = pid => {
    const t = { cats: {}, catBal: {} };
    E.CATS.forEach(k => { t.cats[k.key] = 0; t.catBal[k.key] = 0; });
    Object.values(cum).forEach(o => { const r = o[pid]; if (r) E.CATS.forEach(k => { t.cats[k.key] += r.cats[k.key] || 0; t.catBal[k.key] += r.catBal[k.key] || 0; }); });
    return t;
  };
  h += '<section class="panel"><h2>Gün türlerine göre <small class="muted">saat</small></h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Personel</th>' + E.CATS.map(k => '<th class="cat">' + k.label + '</th>').join('') + '</tr></thead><tbody>' +
    gen.map(r => { const t = catOf(r.p.id); return '<tr><td>' + pname(r.p) + '</td>' + E.CATS.map(k => '<td class="n cat">' + num(t.cats[k.key] * H, 0) + ' <small>' + bal(t.catBal[k.key] * H) + '</small></td>').join('') + '</tr>'; }).join('') +
    '</tbody></table></div><p class="note">Her sütunda o gün türünde çalışılan saat ve yanında o türdeki bakiye var. Hafta sonu, Cuma ve tatil nöbetleri ayrıca dengelenir; görevler arasında fark gözetilmez.</p>';
  /* Aylık seyir */
  h += '<h3>Aylık seyir</h3><div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Personel</th>' + months.map(m => '<th>' + E.MONTHS[E.ymParts(m).m - 1].slice(0, 3) + ' ' + String(E.ymParts(m).y).slice(2) + '</th>').join('') + '</tr></thead><tbody>' +
    gen.map(r => '<tr><td>' + pname(r.p) + '</td>' + months.map(m => {
      const x = r.det.months.find(z => z.ym === m), prevCum = r.det.months.filter(z => z.ym < m).reduce((a, z) => a + z.diff + z.adj, 0);
      return '<td class="n">' + num((x ? x.count : 0) * H, 0) + ' <small>' + bal((x ? x.cum : prevCum) * H) + '</small></td>';
    }).join('') + '</tr>').join('') + '</tbody></table></div><p class="note">Her ayda çalışılan saat ve ay sonundaki birikimli bakiye (saat).</p>';
  const adj = (c.adjustments || []).filter(a => admin || a.personId === me.personId);
  if (adj.length) {
    h += '<h3>Elle yapılan eklemeler / çıkarmalar</h3><div class="leave-list">' + adj.map(a => '<div class="leave-row"><div class="lr-main">' + pname(E.person(c, a.personId)) + '</div><div class="lr-dates">' + bal(+a.value * H) + ' saat<small>' + E.monthLabel(a.month) + ' sonu' + (a.by ? ' · ' + esc(a.by) : '') + '</small></div><div class="lr-note">' + esc(a.note || '') + '</div>' +
      (isAdmin() ? '<div class="lr-act"><button class="icon-btn danger-h" data-act="adj-del" data-id="' + a.id + '" aria-label="Sil">' + ic('trash') + '</button></div>' : '') + '</div>').join('') + '</div>';
  }
  h += '</section>';
  return h;
}
/* Bakiye ayrıntısı: ay ay çalışılan / hak / fark, yerine tutma kayıtları ve elle düzeltmeler (saat). */
function balDetailModal(pid) {
  const c = cfg(), p = E.person(c, pid), H = hrsOf(), det = E.balanceDetail(c, data.schedules, pid);
  if (!p) return;
  const sa = x => num(x * H, 0);
  const nm = id => id ? esc(E.fullName(E.person(c, id))) : '';
  const mo = m => E.MONTHS[E.ymParts(m).m - 1] + ' ' + E.ymParts(m).y;
  let body = '<p class="lead">' + pname(p) + ' · Bakiye <b>' + balH(det.balance) + '</b></p>';
  body += '<h3>Ay ay</h3>' + (det.months.length ? '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Ay</th><th>Çalışılan</th><th title="Eşit paya göre çalışması gereken">Hak</th><th>Fark</th><th>Elle</th><th>Ay sonu bakiye</th></tr></thead><tbody>' +
    det.months.map(m => '<tr><td>' + mo(m.ym) + '</td><td class="n">' + sa(m.count) + '</td><td class="n">' + sa(m.fair) + '</td><td class="n">' + bal(m.diff * H) + '</td><td class="n">' + (m.adj ? bal(m.adj * H) : '<span class="faint">–</span>') + '</td><td class="n strong">' + bal(m.cum * H) + '</td></tr>').join('') +
    '</tbody></table></div>' : '<p class="muted">Henüz kayıt yok.</p>');
  body += '<h3>Yerine tutma</h3>' + (det.covers.length ? '<div class="det-list">' + det.covers.map(x => {
    const t = x.type ? E.leaveType(c, x.type).name : 'izin', pst = E.post(c, x.postId);
    const txt = x.sign > 0 ? nm(x.other) + ' yerine tuttu' + (x.moved ? ' (o gün zaten ek nöbetteydi; saati değişmedi)' : '') : x.other ? 'Yerine ' + nm(x.other) + ' tuttu' : 'Nöbeti boş bırakıldı';
    const val = x.sign > 0 ? (x.moved ? '<span class="faint">0</span>' : bal(H)) : E.leaveType(c, x.type).compensate !== false ? bal(-H) : '<span class="faint">0</span>';
    return '<div><span class="dl-date">' + E.fmtDate(x.date) + ' ' + E.WEEKDAYS_SHORT[E.weekdayOf(x.date)] + '</span><span>' + txt + ' <small class="muted">(' + esc(t) + (c.posts.length > 1 && pst ? ' · ' + esc(pst.name) : '') + ')</small></span><b>' + val + '</b></div>';
  }).join('') + '</div>' : '<p class="muted">Yerine tutma kaydı yok.</p>');
  if (det.adjustments.length) body += '<h3>Elle düzeltmeler</h3><div class="det-list">' + det.adjustments.map(a => '<div><span class="dl-date">' + E.monthLabel(a.month) + '</span><span>' + esc(a.note || 'Açıklama yok') + (a.by ? ' <small class="muted">· ' + esc(a.by) + '</small>' : '') + '</span><b>' + bal(+a.value * H) + '</b></div>').join('') + '</div>';
  body += '<p class="note"><b>Hak</b>: o ay nöbet beklenen herkes arasında eşit pay (telafi gerektiren izindeyken de işler). <b>Fark</b> = çalışılan − hak. Yerine tutmalar zaten çalışılan saate yansıdığı için ayrıca eklenmez; liste bilgi içindir.' + (isAdmin() ? '' : ' Yalnızca kesinleşmiş çizelgeler hesaba katılır.') + '</p>';
  modal({ title: 'Bakiye ayrıntısı', wide: true, body, foot: '<button class="btn" data-close>Kapat</button>' });
}
function adjModal(pid, postId) {
  const c = cfg(), daily = (c.posts || []).filter(p => !E.isCyclePost(p) && E.isActivePost(p));
  /* Varsayılan ay: son çizelge ayı. Böylece düzeltme Denge sayfasında hemen görünür ve sonraki çizelgede dikkate alınır. */
  const lastYm = Object.keys(data.schedules).sort().pop() || today.slice(0, 7);
  modal({
    title: 'Bakiyeye elle ekle / çıkar',
    body: '<p class="muted">Sistem öncesinden kalan fazla/eksik nöbetleri ya da çizelgeye yansımamış değişimleri girmek için. Artı değer "fazla tuttu" (sonra daha az nöbet), eksi değer "eksik tuttu" demektir.</p><form class="form" id="adj-form">' +
      field('Personel', '<select name="personId" required>' + (c.people || []).filter(p => p.active !== false || p.id === pid).map(p => '<option value="' + p.id + '"' + (p.id === pid ? ' selected' : '') + '>' + esc(E.fullName(p)) + '</option>').join('') + '</select>') +
      /* Görevler arasında fark yok: düzeltme ilk günlük göreve yazılır, toplam bakiyeye yansır. */
      '<input type="hidden" name="postId" value="' + ((daily.find(p => p.id === postId) || daily[0]) || {}).id + '">' +
      field('İşlem', '<span class="seg"><label class="check"><input type="radio" name="sign" value="1" checked> <span><b>Ekle (+)</b> fazla tutmuş say</span></label><label class="check"><input type="radio" name="sign" value="-1"> <span><b>Çıkar (−)</b> eksik tutmuş say</span></label></span>') +
      '<div class="row2">' + field('Saat', '<input type="number" name="value" min="1" step="1" required value="' + hrsOf() + '">', 'Bir nöbet = ' + hrsOf() + ' saat') + field('Hangi ayın sonuna', '<input type="month" name="month" required value="' + lastYm + '">', 'Bu aydan sonraki çizelgelerde dikkate alınır.') + '</div>' +
      field('Açıklama', '<input name="note" placeholder="Ör. Ekim ayından devir">') + '</form>',
    foot: '<button class="btn ghost" data-close>Vazgeç</button><button class="btn primary" form="adj-form">Ekle</button>',
    onMount(el, close) {
      $('#adj-form', el).addEventListener('submit', async e => {
        e.preventDefault();
        const v = Object.fromEntries(new FormData(e.target));
        /* Bakiye nöbet cinsinden saklanır; girilen saat nöbete çevrilir. */
        const value = Math.abs(+v.value) / hrsOf() * (+v.sign || 1);
        if (!value) { toast('Saat girin.', 'err'); return; }
        try { await saveCfg(cc => { (cc.adjustments = cc.adjustments || []).push({ id: uid(), personId: v.personId, postId: v.postId, value, month: v.month, note: v.note.trim(), by: me.displayName || '', at: Date.now() }); }, 'Bakiye güncellendi'); close(); } catch (err) { /* bildirildi */ }
      });
    }
  });
}

/* ================= Personel ================= */
function viewPeople() {
  const c = cfg(), people = c.people || [];
  let h = '<section class="page-head"><div><h1>Personel</h1><p class="muted">' + people.filter(p => p.active !== false).length + ' aktif personel. Ayrılan personeli silmek yerine pasife alın; geçmiş çizelgeler bozulmaz.</p></div>' +
    '<div class="actions"><button class="btn primary" data-act="person-add">' + ic('plus') + 'Personel ekle</button></div></section><div class="people">';
  people.forEach(p => {
    h += '<article class="pcard' + (p.active === false ? ' off' : '') + '" style="--c:' + colorOf(p.id) + '">' +
      '<div class="avatar">' + esc(E.initials(p)) + '</div><div class="pc-main"><h3>' + esc(E.fullName(p)) + (p.code ? '<span class="code">' + esc(p.code) + '</span>' : '') + '</h3>' +
      (p.title ? '<p class="muted">' + esc(p.title) + '</p>' : '') +
      '<p>' + ((p.posts || []).map(id => esc((E.post(c, id) || {}).name || '?')).join(', ') || '<span class="bal minus">Görev atanmamış</span>') + '</p>' +
      '<p class="muted small">' + [p.active === false ? 'Pasif' : '', p.phone ? esc(p.phone) : '', (p.offWeekdays || []).length ? 'Tutmadığı günler: ' + p.offWeekdays.map(w => E.WEEKDAYS[w]).join(', ') : '', 'Yıllık izin hakkı: ' + (p.annualLeave || 0) + ' gün', E.shareOf(p) !== 1 ? 'Nöbet payı: %' + Math.round(E.shareOf(p) * 100) : ''].filter(Boolean).join(' · ') + '</p></div>' +
      '<div class="pc-act"><button class="icon-btn" data-act="person-edit" data-id="' + p.id + '" aria-label="Düzenle">' + ic('edit') + '</button></div></article>';
  });
  return h + '</div>' + (people.length ? '' : '<p class="empty-note">Henüz personel yok.</p>');
}
function personModal(id) {
  if (!isAdmin()) return;
  const c = cfg(), p = id ? E.person(c, id) : { name: '', surname: '', code: '', phone: '', posts: (c.posts[0] ? [c.posts[0].id] : []), active: true, offWeekdays: [], annualLeave: 20, startDate: '', endDate: '', note: '' };
  const used = id && Object.values(data.schedules).some(s => Object.values(s.assign || {}).some(a => a.some(x => x && x.split(',').includes(id))));
  modal({
    title: id ? E.fullName(p) : 'Yeni personel', wide: true,
    body: '<form class="form" id="person-form"><div class="row2">' + field('Ad', '<input name="name" required value="' + esc(p.name) + '">') + field('Soyad', '<input name="surname" required value="' + esc(p.surname) + '">') + '</div>' +
      '<div class="row2">' + field('Kod / sicil', '<input name="code" value="' + esc(p.code) + '" placeholder="ör. 7690">', 'Çizelgede adın yanında yazılır: Gülden GENÇ-7690') + field('Telefon', '<input name="phone" type="tel" value="' + esc(p.phone || '') + '">') + '</div>' +
      field('Unvan', '<input name="title" value="' + esc(p.title || '') + '" placeholder="ör. Enformasyon Memuru">') +
      '<fieldset><legend>Tuttuğu nöbet görevleri</legend>' + (c.posts || []).filter(pst => assignOf(pst) === 'people').map(pst => '<label class="check"><input type="checkbox" name="posts" value="' + pst.id + '"' + ((p.posts || []).includes(pst.id) ? ' checked' : '') + '> ' + esc(pst.name) + '</label>').join('') + ((c.posts || []).some(pst => assignOf(pst) !== 'people') ? '<small class="muted">' + (c.posts || []).filter(pst => assignOf(pst) !== 'people').map(pst => esc(pst.name)).join(', ') + ' için kimin tutacağı Ayarlar → Nöbet görevleri bölümünden seçilir.</small>' : '') + '</fieldset>' +
      '<fieldset><legend>Nöbet tutmadığı günler</legend><div class="wd-row">' + [1, 2, 3, 4, 5, 6, 0].map(w => '<label class="check pill"><input type="checkbox" name="off" value="' + w + '"' + ((p.offWeekdays || []).includes(w) ? ' checked' : '') + '> ' + E.WEEKDAYS_SHORT[w] + '</label>').join('') + '</div><small class="muted">Kalıcı kısıtlar için. Tek seferlik durumlar için izin girin.</small></fieldset>' +
      '<div class="row3">' + field('Yıllık izin hakkı (gün)', '<input type="number" name="annualLeave" min="0" max="60" value="' + (p.annualLeave || 0) + '">') + field('Göreve başlama', '<input type="date" name="startDate" value="' + (p.startDate || '') + '">', 'Boşsa sınır yok') + field('Ayrılış', '<input type="date" name="endDate" value="' + (p.endDate || '') + '">', 'Boşsa sınır yok') + '</div>' +
      '<div class="row2">' + field('Nöbet payı (%)', '<input type="number" name="share" min="0" max="200" step="5" value="' + (p.share != null && p.share !== '' ? p.share : 100) + '">', 'Herkes %100. Kısmi görevli için ör. %50: hakkı diğerlerinin yarısı olur.') +
      field('Not', '<input name="note" value="' + esc(p.note || '') + '">') + '</div>' +
      '<label class="check"><input type="checkbox" name="active"' + (p.active !== false ? ' checked' : '') + '> Aktif (nöbet listesine dahil)</label></form>',
    foot: (id ? '<button class="btn danger ghost" data-del>' + ic('trash') + (used ? 'Pasife al' : 'Sil') + '</button><span class="grow"></span>' : '') + '<button class="btn ghost" data-close>Vazgeç</button><button class="btn primary" form="person-form">Kaydet</button>',
    onMount(el, close) {
      $('#person-form', el).addEventListener('submit', async e => {
        e.preventDefault();
        const f = e.target, fd = new FormData(f);
        const rec = {
          ...(id ? p : {}), id: id || uid(), name: fd.get('name').trim(), surname: trUpper(fd.get('surname').trim()), code: fd.get('code').trim(), phone: fd.get('phone').trim(),
          title: fd.get('title').trim(), posts: fd.getAll('posts'), offWeekdays: fd.getAll('off').map(Number), annualLeave: +fd.get('annualLeave') || 0,
          startDate: fd.get('startDate'), endDate: fd.get('endDate'), note: fd.get('note').trim(), active: !!fd.get('active'),
          share: fd.get('share') === '' ? 100 : Math.max(0, +fd.get('share'))
        };
        try { await saveCfg(cc => { const i = cc.people.findIndex(x => x.id === rec.id); if (i >= 0) cc.people[i] = rec; else cc.people.push(rec); }, 'Personel kaydedildi'); close(); } catch (err) { /* bildirildi */ }
      });
      const del = $('[data-del]', el);
      if (del) del.onclick = async () => {
        if (used) {
          if (!(await confirmBox('Pasife alınsın mı?', esc(E.fullName(p)) + ' geçmiş çizelgelerde yer aldığı için silinmez, pasife alınır. Yeni çizelgelere yazılmaz.', 'Pasife al'))) return;
          try { await saveCfg(cc => { cc.people.find(x => x.id === id).active = false; }, 'Pasife alındı'); close(); } catch (err) { /* */ }
        } else {
          if (!(await confirmBox('Personel silinsin mi?', esc(E.fullName(p)) + ' ve izin kayıtları silinecek.', 'Sil', true))) return;
          try { await saveCfg(cc => { cc.people = cc.people.filter(x => x.id !== id); cc.leaves = (cc.leaves || []).filter(l => l.personId !== id); cc.adjustments = (cc.adjustments || []).filter(a => a.personId !== id); }, 'Silindi'); close(); } catch (err) { /* */ }
        }
      };
    }
  });
}

/* ================= Ayarlar ================= */
const SET_NAV = [
  ['Çizelge', [['genel', 'org', 'Kurum ve çizelge'], ['gorevler', 'shield', 'Nöbet görevleri'], ['dagitim', 'sliders', 'Dağıtım kuralları'], ['ozel', 'rule', 'Özel kurallar']]],
  ['Takvim', [['izin', 'leave', 'İzin türleri'], ['tatil', 'flag', 'Resmi tatiller']]],
  ['Sistem', [['kullanici', 'users', 'Kullanıcılar'], ['yedek', 'box', 'Yedek'], ['gorunum', 'sun', 'Görünüm']]]
];
function setCard(id, icon, title, desc, body, foot) {
  return '<section class="set-card" id="set-' + id + '"><header class="sc-head"><span class="sc-ic">' + ic(icon) + '</span><div><h2>' + title + '</h2>' + (desc ? '<p>' + desc + '</p>' : '') + '</div></header>' +
    '<div class="sc-body">' + body + '</div>' + (foot ? '<footer class="sc-foot">' + foot + '</footer>' : '') + '</section>';
}
const optRow = (title, desc, control, tag = 'div', cls = '') => '<' + tag + ' class="opt ' + cls + '"><span class="opt-txt"><b>' + title + '</b>' + (desc ? '<small>' + desc + '</small>' : '') + '</span><span class="opt-ctl">' + control + '</span></' + tag + '>';
const saveFoot = (note, btns) => '<span class="sc-note">' + (note || '') + '</span><span class="sc-dirty">Kaydedilmemiş değişiklik</span>' + btns;
function leaveTypeOptions(selected) {
  const types = [...(cfg().leaveTypes || [])];
  if (selected && !types.some(t => t.id === selected)) types.push(E.leaveType(cfg(), selected));
  return types.map(t => '<option value="' + esc(t.id) + '"' + (t.id === selected ? ' selected' : '') + '>' + esc(t.name) + '</option>').join('');
}
function leaveTypesModal() {
  if (!isAdmin()) return;
  modal({ title: 'İzin türlerini yönet', wide: true,
    body: '<p class="muted">Tür adını ve özelliklerini düzenleyin, yeni tür ekleyin veya çöp kutusuyla kaldırın. Değişiklikleri Kaydet ile uygulayın. Kaldırılan türlerin geçmiş izin ve bakiye kayıtları korunur.</p><section class="set-card"><div class="sc-body"><div class="posts">' + (cfg().leaveTypes || []).map(ltRow).join('') + '</div><div class="btn-row"><button class="btn" data-act="lt-add">' + ic('plus') + 'Tür ekle</button><button class="btn primary" data-act="lt-save">Kaydet</button></div></div></section>',
    foot: '<button class="btn" data-close>Kapat</button>' });
}
const ltRow = t => '<div class="post-row lt-row" data-id="' + t.id + '"><input type="color" name="color" value="' + (t.color || '#888888') + '" aria-label="Renk"><input name="name" value="' + esc(t.name) + '" aria-label="Tür adı">' +
  '<label class="check pill"><input type="checkbox" name="compensate"' + (t.compensate !== false ? ' checked' : '') + '> Telafi edilir</label><label class="check pill"><input type="checkbox" name="annual"' + (t.annual ? ' checked' : '') + '> Yıllık izinden düşer</label><label class="check pill"><input type="checkbox" name="overtime"' + (t.overtime ? ' checked' : '') + '> Fazla mesaiden düşer</label>' +
  '<label class="check pill"><input type="checkbox" name="unavailable"' + (t.unavailable ? ' checked' : '') + '> Çalışılamayan gün</label>' +
  '<button class="icon-btn danger-h" data-act="lt-del" data-id="' + t.id + '" aria-label="Türü sil">' + ic('trash') + '</button></div>';

function viewSettings() {
  const c = cfg(), s = c.settings || {};
  const holidays = c.holidays || [];
  const years = [...new Set(holidays.map(h => h.date.slice(0, 4)))].sort();
  const mid = E.ymParts(ui.ym).y + ' ' + trUpper(E.MONTHS[E.ymParts(ui.ym).m - 1]) + ' AYI';

  let h = '<section class="page-head"><div><h1>Ayarlar</h1><p class="muted">Çizelgenin nasıl hazırlanacağını, takvimi ve hesapları buradan yönetirsiniz. Her bölüm kendi <b>Kaydet</b> düğmesiyle kaydedilir.</p></div></section>' +
    '<div class="settings"><nav class="set-nav" aria-label="Ayar bölümleri">' +
    SET_NAV.map(([g, items]) => '<div><i>' + g + '</i>' + items.map(([id, icon, label]) => '<button data-act="set-go" data-id="set-' + id + '">' + ic(icon) + label + '</button>').join('') + '</div>').join('') +
    '</nav><div class="set-main">';

  /* --- Kurum ve çizelge --- */
  h += setCard('genel', 'org', 'Kurum ve çizelge', 'Çıktıların başlığı, nöbet süresi ve imza alanları.',
    '<form class="form" id="set-general">' +
    '<h3 class="sc-sub">Çıktı başlığı</h3>' +
    field('Kurum başlığı', '<input name="org" value="' + esc(s.org || '') + '">') +
    field('Çizelge başlığı', '<input name="title" value="' + esc(s.title || '') + '">') +
    '<div class="preview"><small>Çıktının üstünde böyle görünür</small><output id="title-prev" data-mid="' + mid + '">' + esc((s.org || '') + ' ' + mid + ' ' + (s.title || '')) + '</output></div>' +
    '<h3 class="sc-sub">Nöbet düzeni</h3>' +
    '<div class="row3">' + field('Nöbet süresi (saat)', '<input type="number" name="shiftHours" min="8" max="48" value="' + (s.shiftHours || 24) + '">') +
    field('Nöbet sonrası dinlenme (saat)', '<input type="number" name="restHours" min="0" max="168" value="' + (s.restHours ?? 72) + '">', '24/72 düzeninde aynı kişi en erken 4 gün sonra yeniden tutar.') +
    field('Bakiye başlangıç ayı', '<input type="month" name="startMonth" value="' + (s.startMonth || '') + '">', 'Bundan önceki aylar dengeye katılmaz.') + '</div>' +
    '<h3 class="sc-sub">İmza alanları</h3>' +
    field('Çıktının altında imza atacak kişiler', '<textarea name="signers" rows="3" placeholder="Ad SOYAD | Unvan">' + esc((s.signers || []).map(x => x.name + ' | ' + x.title).join('\n')) + '</textarea>', 'Her satıra bir kişi yazın, ad ile unvanı <code>|</code> ile ayırın. Örnek: <code>Recep ÇAPKIN | Şube Müdürü</code>') +
    '</form>',
    saveFoot('', '<button class="btn primary" form="set-general">Kaydet</button>'));

  /* --- Nöbet görevleri --- */
  h += postsSection(c);

  /* --- Dağıtım kuralları --- */
  h += setCard('dagitim', 'sliders', 'Dağıtım kuralları', 'Otomatik dağıtımın herkese uyguladığı genel kurallar.',
    '<form class="opts" id="set-rules">' +
    optRow('Aylık mesai hedefi (saat)', 'Herkes için sabit 168 saat, yani 7 nöbet. Fazla mesai bakiyesi hedefi değiştirmez.', '<input type="number" class="num" name="monthlyHours" readonly aria-label="Aylık mesai hedefi" value="168">', 'label') +
    optRow('Fazla mesai bakiyesi başlangıcı', 'Bu aydan itibaren kesinleşen çizelgelerde hedefin üstünde tutulan saatler kişinin fazla mesai bakiyesine yazılır ve izin olarak kullanılabilir. Bakiye İzinler sayfasında görünür.', '<input type="month" name="hoursStartMonth" aria-label="Fazla mesai bakiyesi başlangıcı" value="' + E.hoursStartOf(c) + '">', 'label') +
    optRow('Hafta sonu, Cuma ve tatilleri dengeli dağıt', 'Açıkken bu günler ayrı ayrı dengelenir; aynı kişiye hep aynı gün düşmez. Kapalıyken yalnızca toplam nöbet sayısı dengelenir.', '<input type="checkbox" class="sw" name="balanceWeekends"' + (s.balanceWeekends !== false ? ' checked' : '') + '>', 'label') +
    optRow('Art arda iki hafta sonu nöbet yazma', 'Bir hafta sonu nöbet tutan, sonraki hafta sonu boş kalır. Önceki ayın son hafta sonu da dikkate alınır. Sabit döngü görevleri (ör. 2. nöbetçi) bu kurala tabi değildir.', '<input type="checkbox" class="sw" name="noConsecutiveWeekends"' + (s.noConsecutiveWeekends ? ' checked' : '') + '>', 'label') +
    optRow('Ayda en fazla hafta sonu / tatil nöbeti', 'Kişi başı Cumartesi, Pazar ve resmi tatil nöbeti üst sınırı. Boş bırakırsanız sınır uygulanmaz.', '<input type="number" class="num" name="maxWeekend" min="0" max="15" placeholder="Yok" aria-label="Üst sınır" value="' + (s.maxWeekend ?? '') + '">', 'label') +
    '</form>',
    saveFoot('Yeni oluşturulan çizelgelerde uygulanır.', '<button class="btn primary" form="set-rules">Kaydet</button>'));

  /* --- Özel kurallar --- */
  const rules = (c.rules || []);
  const ruleRow = r => {
    let chip, text;
    if (r.type === 'apart') {
      chip = '<span class="chip">Birlikte tutamaz</span>';
      text = '<b>' + esc(E.fullName(E.person(c, r.a))) + '</b> ile <b>' + esc(E.fullName(E.person(c, r.b))) + '</b> aynı gün nöbet tutamaz';
    } else {
      const must = r.mode === 'must', range = r.from === r.to ? E.fmtDate(r.from) : E.fmtDate(r.from) + ' – ' + E.fmtDate(r.to);
      chip = must ? '<span class="chip ok">Mutlaka tutar</span>' : '<span class="chip rej">Tutamaz</span>';
      text = '<b>' + esc(E.fullName(E.person(c, r.personId))) + '</b> <span class="rl-date">' + range + '</span>' +
        (must && r.postId ? ' <small class="muted">· ' + esc((E.post(c, r.postId) || {}).name || '') + '</small>' : '') + (r.note ? ' <small class="muted">· ' + esc(r.note) + '</small>' : '');
    }
    return '<li>' + chip + '<span>' + text + '</span><button class="icon-btn danger-h" data-act="rule-del" data-id="' + r.id + '" aria-label="Kuralı sil">' + ic('trash') + '</button></li>';
  };
  h += setCard('ozel', 'rule', 'Özel kurallar', 'Belirli kişi ve tarihlere özel istisnalar. Kalıcı gün kısıtları (ör. hiç Pazar tutmaz) ve nöbet payı <a href="#/personel">personel kartından</a> ayarlanır.',
    (rules.length ? '<ul class="rule-list">' + rules.map(ruleRow).join('') + '</ul>' : '<p class="empty">Henüz özel kural yok.</p>') +
    '<div class="btn-row"><button class="btn" data-act="rule-date">' + ic('plus') + 'Tarih kuralı ekle</button><button class="btn" data-act="rule-apart">' + ic('plus') + 'Birlikte tutamaz kuralı ekle</button></div>');

  /* --- İzin türleri --- */
  h += setCard('izin', 'leave', 'İzin türleri', 'İzin girerken seçilen türler ve nöbet dengesine etkileri.',
    '<dl class="defs"><div><dt>Telafi edilir</dt><dd>Kişi izindeyken de nöbet hakkı işler. Tutamadığı nöbetler eksi bakiye olur, sonraki aylarda tamamlanır. İşaretli değilse (ör. görevlendirme) payı o ay diğerlerine geçer, borç doğmaz.</dd></div>' +
    '<div><dt>Yıllık izinden düşer</dt><dd>Bu türdeki izin günleri kişinin yıllık izin hakkından düşülür.</dd></div>' +
    '<div><dt>Fazla mesaiden düşer</dt><dd>Aylık mesai hedefinin üstünde biriken saatler izin olarak kullanılır; her nöbet günü ' + num(24) + ' saat bakiyeden düşer. Bakiye İzinler sayfasında görünür. Bu türü “Telafi edilir” işaretlemeyin: kişi zaten fazla çalıştığı için nöbet borcu doğmamalı.</dd></div></dl>' +
    '<div class="posts">' + (c.leaveTypes || []).map(ltRow).join('') + '</div>' +
    '<div class="btn-row"><button class="btn" data-act="lt-add">' + ic('plus') + 'Tür ekle</button>' +
    ((c.leaveTypes || []).some(t => t.overtime) ? '' : '<button class="btn" data-act="lt-add-ot">' + ic('plus') + 'Fazla mesai izni türünü ekle</button>') + '</div>',
    saveFoot('', '<button class="btn primary" data-act="lt-save">Kaydet</button>'));

  /* --- Resmi tatiller --- */
  h += setCard('tatil', 'flag', 'Resmi tatiller', 'Tatil günleri hafta sonu gibi ayrıca dengelenir. Dini bayram tarihlerini Diyanet takvimiyle kontrol edin.',
    '<form class="hol-add" id="hol-form"><input type="date" name="date" required aria-label="Tarih"><input name="name" required placeholder="Tatil adı" aria-label="Tatil adı"><button class="btn">' + ic('plus') + 'Tatil ekle</button></form>' +
    (years.length ? '<div class="hol-years">' + years.map(y => {
      const list = holidays.filter(h2 => h2.date.startsWith(y));
      return '<details class="hol-year"' + (y === String(ui.year) || y === today.slice(0, 4) ? ' open' : '') + '><summary><b>' + y + '</b><small class="muted">' + list.length + ' gün</small></summary><ul class="hol-list">' +
        list.map(h2 => '<li><span>' + E.fmtDate(h2.date) + ' <small class="muted">' + E.WEEKDAYS[E.weekdayOf(h2.date)] + '</small></span><span>' + esc(h2.name) + '</span><button class="icon-btn danger-h" data-act="hol-del" data-date="' + h2.date + '" aria-label="Tatili sil">' + ic('x') + '</button></li>').join('') + '</ul></details>';
    }).join('') + '</div>' : '<p class="empty">Henüz tatil girilmemiş.</p>') +
    '<div class="btn-row"><button class="btn" data-act="hol-year">' + ic('plus') + 'Bir sonraki yılın sabit tatillerini ekle</button></div>');

  /* --- Kullanıcılar --- */
  h += setCard('kullanici', 'users', 'Kullanıcılar', 'Kayıt ekranı yoktur; hesapları yöneticiler açar ve şifreleri belirler.', '<div id="users-box"><p class="muted">Yükleniyor…</p></div>');

  /* --- Yedek --- */
  h += setCard('yedek', 'box', 'Yedek', 'Ayarlar, personel, izinler ve çizelgeler tek dosyada saklanır. Kullanıcı hesapları yedeğe dahil değildir.',
    '<div class="opts">' +
    optRow('Yedeği indir', 'Tüm verileri bu cihaza bir JSON dosyası olarak kaydeder.', '<button class="btn" data-act="backup">' + ic('down') + 'İndir</button>') +
    optRow('Yedekten geri yükle', 'Mevcut verilerin tümü seçtiğiniz yedek dosyasındakilerle değiştirilir.', '<button class="btn" data-act="restore">' + ic('up') + 'Dosya seç</button>') +
    (isSuper() ? optRow('Tüm verileri sıfırla', 'Ayarlar, personel, izinler ve bütün çizelgeler silinir; başlangıç verisi yüklenir. Geri alınamaz, önce yedek indirin.', '<button class="btn danger" data-act="reset-all">' + ic('trash') + 'Sıfırla</button>', 'div', 'danger') : '') +
    '</div>');

  /* --- Görünüm --- */
  h += setCard('gorunum', 'sun', 'Görünüm', '',
    '<div class="opts">' + optRow('Tema', 'Yalnızca bu cihazda geçerlidir. Otomatik seçeneği cihazınızın ayarına uyar.',
      '<div class="seg-tabs">' + [['auto', 'Otomatik'], ['light', 'Açık'], ['dark', 'Koyu']].map(t => '<button class="' + (ui.theme === t[0] ? 'on' : '') + '" data-act="theme" data-theme="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>') + '</div>');

  return h + '</div></div>';
}
/* Ayarlar: gezinme menüsünde bulunulan bölümü işaretle */
function settingsSpy() {
  const nav = $('.set-nav'); if (!nav) return;
  const top = $('.top'), topH = top ? top.offsetHeight : 0, narrow = window.innerWidth <= 860;
  document.documentElement.style.setProperty('--top-h', topH + 'px');
  const line = topH + (narrow ? nav.offsetHeight : 0) + 40, cards = $$('.set-card');
  let cur = cards[0] && cards[0].id;
  cards.forEach(s => { if (s.getBoundingClientRect().top <= line) cur = s.id; });
  if (cards.length && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = cards[cards.length - 1].id;
  $$('button', nav).forEach(b => {
    const on = b.dataset.id === cur;
    if (on && !b.classList.contains('on') && narrow) nav.scrollTo({ left: b.offsetLeft - nav.clientWidth / 2 + b.offsetWidth / 2 });
    b.classList.toggle('on', on);
  });
}
window.addEventListener('scroll', settingsSpy, { passive: true });
window.addEventListener('resize', settingsSpy);

/* ---- Nöbet görevleri: kimler tutar, ne sıklıkla ---- */
const ASSIGN = [
  ['people', 'Personel kartında işaretlenenler'],
  ['fixed', 'Sabit tek kişi'],
  ['pool', 'Seçilen kişiler arasında dönüşümlü'],
  ['all', 'Tüm personel arasında karışık'],
  ['off', 'Kapalı (bu görev yok)']
];
const assignOf = p => p.assign || (p.mode === 'cycle' ? 'fixed' : 'people');
function postCard(c, p, isNew) {
  const as = assignOf(p), members = (c.people || []).filter(x => (x.posts || []).includes(p.id));
  const fixedId = p.fixedId || (as === 'fixed' && members[0] ? members[0].id : '');
  const active = (c.people || []).filter(x => x.active !== false);
  return '<div class="post-card" data-id="' + p.id + '" data-assign="' + as + '">' +
    '<div class="pc-row"><input name="name" value="' + esc(p.name) + '" aria-label="Görev adı"><button class="icon-btn danger-h" data-act="post-del" data-id="' + (isNew ? '' : p.id) + '" aria-label="Görevi sil">' + ic('trash') + '</button></div>' +
    '<label class="field"><span>Kimler tutar?</span><select name="assign">' + ASSIGN.map(([v, l]) => '<option value="' + v + '"' + (as === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label>' +
    '<div class="show-fixed">' + field('Sabit nöbetçi', '<select name="fixedId"><option value="">Seçin</option>' + active.map(x => '<option value="' + x.id + '"' + (x.id === fixedId ? ' selected' : '') + '>' + esc(E.fullName(x)) + '</option>').join('') + '</select>', 'İhtiyaca göre seçiliyken aylık hedefi tamamlamak için atanır. Diğer sıklıklarda kendi 24/72 döngüsünü sürdürür.') + '</div>' +
    '<div class="show-pool"><span class="lbl">Dönüşüme katılacak kişiler</span><div class="pool-picks">' + active.map(x => '<label class="check pill"><input type="checkbox" name="poolIds" value="' + x.id + '"' + ((p.poolIds || []).includes(x.id) ? ' checked' : '') + '> ' + esc(E.fullName(x)) + '</label>').join('') + '</div><small class="muted">Nöbetler bu kişiler arasında adil dağıtılır; fazla tutan sonraki aylarda daha az alır.</small></div>' +
    '<div class="show-people"><span class="lbl">Bu nöbeti tutan kişiler</span><div class="pool-picks">' + active.map(x => '<label class="check pill"><input type="checkbox" name="members" value="' + x.id + '"' + ((x.posts || []).includes(p.id) ? ' checked' : '') + '> ' + esc(E.fullName(x)) + ((c.posts || []).some(o => o.id !== p.id && o.assign === 'fixed' && o.fixedId === x.id && o.assign !== 'off') ? ' <small class="muted">(sabit ' + esc((c.posts.find(o => o.assign === 'fixed' && o.fixedId === x.id) || {}).name || '') + ', bu dağıtıma girmez)</small>' : '') + '</label>').join('') + '</div><small class="muted">Aynı seçim personel kartındaki "Tuttuğu nöbet görevleri" kısmında da görünür.</small></div>' +
    '<div class="row2 show-daily">' +
    field('Sıklık', '<select name="every">' + [['need', 'İhtiyaca göre'], [1, 'Her gün'], [2, '2 günde bir'], [3, '3 günde bir'], [4, '4 günde bir']].map(([v, l]) => '<option value="' + v + '"' + (String(p.every ?? (p.id === 'ek' ? 'need' : 1)) === String(v) ? ' selected' : '') + '>' + l + '</option>').join('') + '</select>', 'İhtiyaca göre: aylık mesai / nöbet hedefi eksik kalan personel için açılır; belirli günlerde zorunlu değildir. 24/72 dinlenme kuralı korunur.') +
    field('Günde kaç kişi', '<input type="number" name="required" min="1" max="5" value="' + (p.required || 1) + '">') + '</div>' +
    '</div>';
}
function capacityNote(c) {
  const cyc = E.cycleDays(c), active = (c.people || []).filter(p => p.active !== false).length;
  let perDay = 0;
  (c.posts || []).filter(E.isActivePost).forEach(p => { perDay += E.isOnDemandPost(p) ? 0 : E.isCyclePost(p) ? 1 / cyc : (+p.required || 1) / Math.max(1, +p.every || 1); });
  const needPeople = Math.ceil(perDay * cyc - 1e-9);
  /* Mesai hedefi: 30 günlük bir ayda herkesin hedefi doldurması için günde gereken ortalama nöbetçi. */
  const H = E.monthlyHoursOf(c), per = H ? Math.ceil(H / (+(c.settings.shiftHours) || 24) - 1e-9) : 0;
  const hoursPerDay = per * active / 30, canExtra = (c.posts || []).some(p => E.isActivePost(p) && !E.isCyclePost(p) && (E.isOnDemandPost(p) || (+p.every || 1) > 1));
  const hoursNote = per ? ' Aylık ' + H + ' saat mesai için kişi başı en az <b>' + per + ' nöbet</b>, yani günde ortalama <b>' + num(hoursPerDay) + ' nöbetçi</b> gerekir.' +
    (hoursPerDay > perDay + 1e-9 ? (canExtra ? ' Aradaki fark, her gün olmayan görevlere açılan ek günlerle otomatik kapatılır.' : ' Ek gün açılabilecek (her gün olmayan) bir görev yok; bu haliyle bazı kişilerin mesaisi eksik kalır.') : '') : '';
  return '<p class="cap-note ' + (needPeople > active ? 'bad' : 'ok') + '">' + ic(needPeople > active ? 'alert' : 'check') + '<span>Bu ayarlarla günde ortalama <b>' + num(perDay) + ' nöbetçi</b> gerekiyor. 24/72 düzeninde herkes en fazla 4 günde bir tutabildiği için en az <b>' + needPeople + ' kişi</b> lazım; şu an <b>' + active + ' aktif personel</b> var.' + (needPeople > active ? ' Bu haliyle bazı günler boş kalır ya da dinlenme kuralı ihlal edilir; sıklığı azaltın veya personel ekleyin.' : '') + hoursNote + '</span></p>';
}
function postsSection(c) {
  return setCard('gorevler', 'shield', 'Nöbet görevleri', 'Her gün doldurulacak nöbet görevleri ve bunları kimlerin tutacağı. İlk görev 1. Nöbetçi; diğerleri (ör. 2. Nöbetçi) sabit bir kişiye, seçtiğiniz kişilere ya da herkese verilebilir. Personel unvanları Personel bölümünden düzenlenir.',
    '<div class="post-cards">' + (c.posts || []).map(p => postCard(c, p)).join('') + '</div>' + capacityNote(c) +
    '<div class="btn-row"><button class="btn" data-act="post-add">' + ic('plus') + 'Görev ekle</button></div>',
    saveFoot('Yeni oluşturulan çizelgelerde uygulanır; mevcut ayı güncellemek için o ayı yeniden oluşturun.', '<button class="btn primary" data-act="posts-save">Görevleri kaydet</button>'));
}

async function loadUsers(force) {
  const box = $('#users-box'); if (!box) return;
  try {
    if (!ui.users || force) ui.users = await store.listUsers();
  } catch (e) { box.innerHTML = '<p class="bal minus">' + esc(e.message) + '</p>'; return; }
  const c = cfg();
  const canEdit = u => u.uid !== me.uid && (isSuper() ? u.role !== 'super' : u.role === 'user');
  box.innerHTML = '<div class="roles"><div><b>Baş yönetici</b>Her şeye yetkilidir; yönetici hesaplarını açar.</div><div><b>Yönetici</b>E-postayla girer. Çizelge, personel, izin ve personel hesaplarını yönetir.</div><div><b>Personel</b>İsim ve şifreyle girer. Kesinleşmiş çizelgeyi görür, çıktı alır, izin talebi gönderir.</div></div>' +
    '<div class="user-list">' + ui.users.map(u => {
      const p = u.personId && E.person(c, u.personId);
      return '<div class="user-row"><div class="avatar sm" style="--c:' + (p ? colorOf(p.id) : u.role === 'user' ? '#555' : 'var(--accent)') + '">' + esc((u.displayName || u.username).slice(0, 1).toLocaleUpperCase('tr')) + '</div>' +
        '<div class="ur-main"><b>' + esc(u.displayName || u.username) + '</b>' + (u.role !== 'user' ? '<span class="chip ok">' + ROLE_LABEL[u.role] + '</span>' : '') + (u.active === false ? '<span class="chip">Pasif</span>' : '') + (u.uid === me.uid ? '<span class="chip">Siz</span>' : '') +
        '<small>' + (u.role === 'user' ? 'Kullanıcı adı' : 'E-posta') + ': <code>' + esc(u.username) + '</code>' + (p ? ' · ' + esc(E.fullName(p)) : '') +
        (canEdit(u) && u.password ? ' · Şifre: <code>' + (ui.showPw[u.uid] ? esc(u.password) : '••••••') + '</code> <button class="link" data-act="pw-show" data-uid="' + u.uid + '">' + (ui.showPw[u.uid] ? 'gizle' : 'göster') + '</button>' : '') + '</small></div>' +
        (canEdit(u) ? '<div class="ur-act"><button class="btn sm" data-act="user-edit" data-uid="' + u.uid + '">' + ic('edit') + 'Düzenle</button></div>' : '') + '</div>';
    }).join('') + '</div><div class="btn-row"><button class="btn primary" data-act="user-add">' + ic('plus') + (isSuper() ? 'Kullanıcı / yönetici ekle' : 'Personel hesabı ekle') + '</button></div>';
  settingsSpy();
}
function userModal(u) {
  const c = cfg();
  const opts = '<option value="">Bağlı değil</option>' + (c.people || []).map(p => '<option value="' + p.id + '"' + (u && u.personId === p.id ? ' selected' : '') + '>' + esc(E.fullName(p)) + '</option>').join('');
  modal({
    title: u ? (u.displayName || u.username) : 'Yeni kullanıcı',
    body: '<form class="form" id="user-form">' +
      (!u && isSuper() ? field('Hesap türü', '<select name="role"><option value="user">Personel — isim ve şifreyle girer; çizelge, çıktı, izin talebi</option><option value="admin">Yönetici — e-postayla girer; çizelge, personel, izin yönetimi</option></select>') : '') +
      field('Ad soyad', '<input name="displayName" required value="' + esc(u ? u.displayName : '') + '">') +
      (u ? '<p class="muted">' + (u.role === 'user' ? 'Kullanıcı adı' : 'E-posta') + ': <code>' + esc(u.username) + '</code> · ' + ROLE_LABEL[u.role] + '</p>' : field('<span id="un-label">Kullanıcı adı</span>', '<input name="username" required autocapitalize="none" autocomplete="off">', '<span id="un-hint">E-posta değil, isim. Kullanıcı girişte "Gülden Genç" ya da "gulden.genc" yazabilir; ikisi de aynı hesaba gider.</span>')) +
      field(u ? 'Yeni şifre' : 'Şifre', '<input name="password" ' + (u ? '' : 'required ') + 'minlength="6" autocomplete="new-password" placeholder="' + (u ? 'Değiştirmeyecekseniz boş bırakın' : 'En az 6 karakter') + '">') +
      field('Bağlı personel', '<select name="personId">' + opts + '</select>', 'Mutlaka seçin: kullanıcı kendi nöbetlerini, bakiyesini (Bakiyem) ve izin talebi ekranını yalnızca bağlı personel seçiliyse görür.') +
      (u ? '<label class="check"><input type="checkbox" name="active"' + (u.active !== false ? ' checked' : '') + '> Aktif (giriş yapabilir)</label>' : '') + '</form>',
    foot: (u ? '<button class="btn danger ghost" data-del>' + ic('trash') + 'Kullanıcıyı sil</button><span class="grow"></span>' : '') + '<button class="btn ghost" data-close>Vazgeç</button><button class="btn primary" form="user-form">Kaydet</button>',
    onMount(el, close) {
      const roleSel = $('[name=role]', el);
      if (roleSel) roleSel.addEventListener('change', () => {
        const adm = roleSel.value === 'admin', inp = $('[name=username]', el);
        $('#un-label', el).textContent = adm ? 'E-posta adresi' : 'Kullanıcı adı';
        $('#un-hint', el).textContent = adm ? 'Yönetici bu e-posta ve şifreyle girer.' : 'E-posta değil, isim. Kullanıcı girişte "Gülden Genç" ya da "gulden.genc" yazabilir; ikisi de aynı hesaba gider.';
        inp.type = adm ? 'email' : 'text';
      });
      $('#user-form', el).addEventListener('submit', async e => {
        e.preventDefault();
        const v = Object.fromEntries(new FormData(e.target));
        try {
          await run(async () => {
            if (!u) {
              const role = v.role === 'admin' ? 'admin' : 'user';
              if (role === 'user' && v.username.includes('@')) throw new Error('Kullanıcı adı e-posta biçiminde olamaz; isim yazın (ör. gulden.genc).');
              if (role === 'admin' && !v.username.includes('@')) throw new Error('Yönetici hesabı için e-posta adresi girin.');
              if (role === 'user' && !normalizeUsername(v.username)) throw new Error('Kullanıcı adı geçersiz.');
              await store.createUser({ username: v.username, password: v.password, displayName: v.displayName.trim(), personId: v.personId, role });
            } else {
              await store.updateUser(u.uid, { displayName: v.displayName.trim(), personId: v.personId, active: !!v.active });
              if (v.password) await store.setUserPassword(u, v.password);
            }
          }, u ? 'Kullanıcı güncellendi' : 'Kullanıcı oluşturuldu: ' + (v.role === 'admin' ? v.username.trim().toLowerCase() : normalizeUsername(v.username || '')));
          close(); loadUsers(true);
        } catch (err) { /* bildirildi */ }
      });
      const del = $('[data-del]', el);
      if (del) del.onclick = async () => {
        if (!(await confirmBox('Kullanıcı silinsin mi?', esc(u.displayName || u.username) + ' artık giriş yapamaz.', 'Sil', true))) return;
        try { await run(() => store.deleteUser(u), 'Kullanıcı silindi'); close(); loadUsers(true); } catch (err) { /* */ }
      };
    }
  });
}
function accountModal() {
  modal({
    title: 'Hesabım',
    body: '<p class="lead">' + esc(me.displayName) + ' <span class="muted">(' + esc(me.username) + ')</span> <span class="chip ok">' + ROLE_LABEL[me.role] + '</span></p>' +
      '<form class="form" id="pw-form"><h3>Şifre değiştir</h3>' + field('Mevcut şifre', '<input type="password" name="old" required autocomplete="current-password">') +
      field('Yeni şifre', '<input type="password" name="n1" required minlength="6" autocomplete="new-password">') + field('Yeni şifre (tekrar)', '<input type="password" name="n2" required minlength="6" autocomplete="new-password">') +
      '<button class="btn">' + ic('key') + 'Şifreyi değiştir</button></form>' +
      '<div><h3>Tema</h3><div class="seg-tabs" style="margin-top:8px">' + [['auto', 'Otomatik'], ['light', 'Açık'], ['dark', 'Koyu']].map(t => '<button type="button" class="' + (ui.theme === t[0] ? 'on' : '') + '" data-theme="' + t[0] + '">' + t[1] + '</button>').join('') + '</div></div>',
    foot: '<button class="btn danger ghost" data-logout>' + ic('out') + 'Çıkış yap</button>',
    onMount(el, close) {
      $$('[data-theme]', el).forEach(b => { b.onclick = () => { ui.theme = b.dataset.theme; setPref('theme', ui.theme); applyTheme(); $$('[data-theme]', el).forEach(x => x.classList.toggle('on', x === b)); }; });
      $('#pw-form', el).addEventListener('submit', async e => {
        e.preventDefault();
        const v = Object.fromEntries(new FormData(e.target));
        if (v.n1 !== v.n2) { toast('Yeni şifreler aynı değil.', 'err'); return; }
        try { await run(() => store.changeOwnPassword(v.old, v.n1), 'Şifreniz değiştirildi'); close(); } catch (err) { /* */ }
      });
      $('[data-logout]', el).onclick = () => { close(); store.logout(); };
    }
  });
}

/* ================= Olaylar ================= */
const actions = {
  month(t) { ui.ym = E.addMonths(ui.ym, +t.dataset.n); location.hash = '#/cizelge/' + ui.ym; },
  year(t) { ui.year += +t.dataset.n; render(); },
  focus(t) { ui.focus = t.dataset.pid && ui.focus !== t.dataset.pid ? t.dataset.pid : null; render(); },
  cell(t) { cellModal(+t.dataset.d); },
  'month-requests'() { monthRequestsModal(); },
  'ot-edit'(t) { overtimeBalanceModal(t.dataset.pid); },
  generate: doGenerate,
  async finalize() {
    const s = clone(data.schedules[ui.ym]);
    s.status = s.status === 'final' ? 'draft' : 'final';
    if (s.status === 'final') {
      const errs = E.validate(cfg(), data.schedules, ui.ym).filter(i => i.level === 'error').length;
      if (errs && !(await confirmBox('Kural ihlali var', errs + ' ihlal bulunuyor. Yine de kesinleştirilsin mi?', 'Kesinleştir'))) return;
    }
    await run(() => store.saveSchedule(s), s.status === 'final' ? 'Çizelge kesinleştirildi' : 'Taslağa alındı').catch(() => { });
  },
  async 'delete-sched'() {
    if (!(await confirmBox('Çizelge silinsin mi?', E.monthLabel(ui.ym) + ' çizelgesi tamamen silinecek. Bu ayın nöbetleri bakiye hesabından da çıkar.', 'Sil', true))) return;
    await run(() => store.deleteSchedule(ui.ym), 'Silindi').catch(() => { });
  },
  print: printSchedule,
  documents() { if (isAdmin()) openDocuments({ cfg: cfg(), schedules: data.schedules, ym: ui.ym, modal, download, toast, store, busy }); },
  xlsx() { download(buildXlsx(cfg(), data.schedules, ui.ym), fileBase() + '.xlsx'); },
  async png() { await exportFile(() => pngBlob(cfg(), data.schedules, ui.ym), '.png'); },
  async pdf() { await exportFile(() => pdfBlob(cfg(), data.schedules, ui.ym), '.pdf'); },
  account: accountModal,
  theme(t) { ui.theme = t.dataset.theme; setPref('theme', ui.theme); applyTheme(); render(); },
  async 'rule-del'(t) { await saveCfg(c => { c.rules = (c.rules || []).filter(r => r.id !== t.dataset.id); }, 'Kural silindi').catch(() => { }); },
  'rule-date'() {
    const c = cfg(), people = (c.people || []).filter(p => p.active !== false);
    modal({
      title: 'Tarih kuralı',
      body: '<form class="form" id="rule-form">' + field('Personel', '<select name="personId" required>' + people.map(p => '<option value="' + p.id + '">' + esc(E.fullName(p)) + '</option>').join('') + '</select>') +
        field('Kural', '<select name="mode"><option value="cannot">Bu tarihlerde nöbet tutamaz</option><option value="must">Bu tarihlerde mutlaka nöbet tutar</option></select>', '"Mutlaka tutar" genelde tek gün için kullanılır; 24/72 nedeniyle art arda günler tutulamaz.') +
        '<div class="row2">' + field('Başlangıç', '<input type="date" name="from" required value="' + E.dateOf(E.addMonths(today.slice(0, 7), 1), 0) + '">') + field('Bitiş (dahil)', '<input type="date" name="to" required value="' + E.dateOf(E.addMonths(today.slice(0, 7), 1), 0) + '">') + '</div>' +
        ((c.posts || []).length > 1 ? field('Görev (mutlaka tutar için)', '<select name="postId"><option value="">Kişinin görevi</option>' + c.posts.map(p => '<option value="' + p.id + '">' + esc(p.name) + '</option>').join('') + '</select>') : '') +
        field('Açıklama', '<input name="note" placeholder="İsteğe bağlı, ör. eğitim, bayram talebi">') + '</form>',
      foot: '<button class="btn ghost" data-close>Vazgeç</button><button class="btn primary" form="rule-form">Ekle</button>',
      onMount(el, close) {
        $('#rule-form', el).addEventListener('submit', async e => {
          e.preventDefault();
          const v = Object.fromEntries(new FormData(e.target));
          if (v.to < v.from) { toast('Bitiş tarihi başlangıçtan önce olamaz.', 'err'); return; }
          try { await saveCfg(c2 => { (c2.rules = c2.rules || []).push({ id: uid(), type: 'date', personId: v.personId, mode: v.mode, from: v.from, to: v.to, postId: v.mode === 'must' ? (v.postId || '') : '', note: (v.note || '').trim() }); }, 'Kural eklendi; etkisi için çizelgeyi yeniden oluşturun'); close(); } catch (err) { /* */ }
        });
      }
    });
  },
  'rule-apart'() {
    const c = cfg(), people = (c.people || []).filter(p => p.active !== false);
    if (people.length < 2) { toast('En az iki aktif personel gerekli.', 'err'); return; }
    const opts = sel => people.map((p, i) => '<option value="' + p.id + '"' + (i === sel ? ' selected' : '') + '>' + esc(E.fullName(p)) + '</option>').join('');
    modal({
      title: 'Birlikte tutamaz',
      body: '<p class="muted">Seçilen iki kişi aynı gün (hangi görevde olursa olsun) nöbete yazılmaz.</p><form class="form" id="apart-form"><div class="row2">' + field('1. kişi', '<select name="a">' + opts(0) + '</select>') + field('2. kişi', '<select name="b">' + opts(1) + '</select>') + '</div></form>',
      foot: '<button class="btn ghost" data-close>Vazgeç</button><button class="btn primary" form="apart-form">Ekle</button>',
      onMount(el, close) {
        $('#apart-form', el).addEventListener('submit', async e => {
          e.preventDefault();
          const v = Object.fromEntries(new FormData(e.target));
          if (v.a === v.b) { toast('İki farklı kişi seçin.', 'err'); return; }
          try { await saveCfg(c2 => { (c2.rules = c2.rules || []).push({ id: uid(), type: 'apart', a: v.a, b: v.b }); }, 'Kural eklendi'); close(); } catch (err) { /* */ }
        });
      }
    });
  },
  async 'reset-all'() {
    if (!(await confirmBox('Tüm veriler sıfırlansın mı?', '<b>Tüm ayarlar, personel, izin kayıtları ve bütün çizelgeler silinir</b>; başlangıçtaki 6 personel ve Kasım 2026 çizelgesi yüklenir. Kullanıcı hesapları ve izin talepleri silinmez. Bu işlem geri alınamaz; önce yedek indirmeniz önerilir.', 'Sıfırla', true))) return;
    const s = E.sampleNovember();
    run(() => store.replaceAll({ config: E.defaultConfig(), schedules: { [s.ym]: s } }), 'Veriler sıfırlandı').catch(() => { });
  },
  'this-month'() { ui.ym = today.slice(0, 7); location.hash = '#/cizelge/' + ui.ym; },
  view(t) { ui.view = t.dataset.view; setPref('view', ui.view); render(); },
  more() {
    const sched = data.schedules[ui.ym];
    const items = [
      sched && ['share', 'share', 'Metin olarak paylaş', 'WhatsApp vb. için gün gün liste'],
      isAdmin() && sched && ['unpin-all', 'pin', 'Sabitlemeleri kaldır', 'Tüm günler yeniden dağıtılabilir olur'],
      isAdmin() && !sched && ['manual', 'edit', 'Elle doldurmaya başla', 'Boş bir çizelge açılır, günlere tıklayarak doldurursunuz'],
      isAdmin() && ui.ym === '2026-11' && ['restore-nov', 'undo', 'Kurumun Kasım çizelgesine geri dön', 'PDF’teki orijinal Kasım 2026 nöbetlerini geri yükler'],
      isAdmin() && sched && ['explain', 'help', 'Hedefler neden tam tutmuyor?', 'Kişi bazında gündelik dille açıklama'],
      isAdmin() && sched && ['delete-sched', 'trash', 'Çizelgeyi sil', E.monthLabel(ui.ym) + ' nöbetlerini siler', 'danger'],
      ['help', 'help', 'Nasıl kullanılır?', 'Kısa kullanım rehberi']
    ].filter(Boolean);
    modal({
      title: 'İşlemler', body: '<div class="menulist">' + items.map(x => '<button data-run="' + x[0] + '" class="' + (x[4] || '') + '">' + ic(x[1]) + '<span><b>' + x[2] + '</b><small>' + esc(x[3]) + '</small></span></button>').join('') + '</div>',
      onMount(el, close) { el.addEventListener('click', e => { const b = e.target.closest('[data-run]'); if (!b) return; close(); actions[b.dataset.run](b); }); }
    });
  },
  async share() {
    const txt = E.shareText(cfg(), data.schedules, ui.ym);
    if (navigator.share) { try { await navigator.share({ title: E.monthLabel(ui.ym) + ' Nöbet Çizelgesi', text: txt }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    modal({
      title: 'Metin olarak paylaş', body: '<textarea class="share-text" rows="14" readonly>' + esc(txt) + '</textarea>',
      foot: '<button class="btn ghost" data-close>Kapat</button><button class="btn primary" data-copy>' + ic('check') + 'Kopyala</button>',
      onMount(el) { $('[data-copy]', el).onclick = async () => { try { await navigator.clipboard.writeText(txt); toast('Kopyalandı; WhatsApp\'a yapıştırabilirsiniz'); } catch (e) { $('textarea', el).select(); document.execCommand('copy'); toast('Kopyalandı'); } }; }
    });
  },
  async 'unpin-all'() {
    if (!(await confirmBox('Sabitlemeler kaldırılsın mı?', 'Bu aydaki tüm sabitlemeler kaldırılır; yeniden oluşturmada bütün günler yeniden dağıtılır. Mevcut atamalar değişmez.', 'Kaldır'))) return;
    const s = clone(data.schedules[ui.ym]); s.pins = {};
    run(() => store.saveSchedule(s), 'Sabitlemeler kaldırıldı').catch(() => { });
  },
  async 'restore-nov'() {
    if (!(await confirmBox('Kasım 2026 geri yüklensin mi?', 'Bu ayın mevcut hali silinir ve kurumun PDF’teki orijinal Kasım 2026 çizelgesi kesinleşmiş olarak yüklenir. Sonraki ayların dengesi buna göre hesaplanır; Aralık ve sonrasını yeniden oluşturmanız önerilir.', 'Geri yükle'))) return;
    run(() => store.saveSchedule(E.sampleNovember()), 'Kasım 2026 orijinal haline döndü').catch(() => { });
  },
  manual() { run(() => store.saveSchedule(E.emptySchedule(ui.ym)), 'Boş çizelge açıldı; günlere tıklayarak doldurun').catch(() => { }); },
  explain() {
    const secs = E.explain(cfg(), data.schedules, ui.ym);
    const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    modal({ title: 'Hedefler neden tam tutmuyor?', wide: true, body: secs.length ? secs.map(x => '<div class="exp"><h3>' + esc(x.title) + '</h3>' + x.details.map(d => '<p>' + md(d) + '</p>').join('') + '</div>').join('') : '<p>Herkes hedefine uygun nöbet aldı.</p>' });
  },
  help() {
    const tips = isAdmin() ? [
      ['Personel ve görevler', 'Personel sayfasından kişileri ekleyin ve hangi nöbet görevini tuttuklarını işaretleyin. Kısmi çalışanlar için "nöbet payı"nı düşürebilirsiniz (ör. %50).'],
      ['İzinler', 'İzinleri önceden girin veya personelin gönderdiği talepleri İzinler sayfasından onaylayın. İzinli günlere nöbet yazılmaz.'],
      ['Çizelge oluştur', 'Kurallara (24/72, izinler, hafta sonu dengesi, özel kurallar) göre otomatik dağıtır. Önceki aylarda fazla tutanlara daha az, eksik tutanlara daha çok nöbet yazılır.'],
      ['Elle düzenleme', 'Bir güne tıklayıp nöbetçiyi değiştirin. Elle değiştirilen günler sabitlenir; yeniden oluşturmada korunur. Uygun olmayan kişiler kırmızı açıklamayla görünür.'],
      ['Kesinleştir', 'Taslak çizelgeyi yalnızca yöneticiler görür. Kesinleştirince personel görür ve çıktı alabilir.'],
      ['Çıktı', 'PDF, PNG, Excel veya yazdır. Düzen kurumun mevcut çizelgesiyle aynıdır. Metin olarak paylaşım İşlemler menüsündedir.'],
      ['Denge', 'Denge sayfası başlangıçtan bu yana kimin hakkından fazla/eksik nöbet tuttuğunu ve hafta sonu/tatil dağılımını gösterir.']
    ] : [
      ['Çizelge', 'Kesinleşmiş çizelgeleri görürsünüz. Adınıza tıklayarak kendi günlerinizi vurgulayabilirsiniz; sıradaki nöbetleriniz üstte listelenir.'],
      ['Çıktı', 'PDF, PNG, Excel olarak indirebilir ya da yazdırabilirsiniz.'],
      ['İzin talebi', 'İzinlerim sayfasından izin talebi gönderin. Yönetici onaylayınca izniniz işlenir; reddedilirse gerekçesini görürsünüz.']
    ];
    modal({ title: 'Nasıl kullanılır?', wide: true, body: tips.map((t, i) => '<div class="tip"><span>' + (i + 1) + '</span><div><b>' + t[0] + '</b><p>' + t[1] + '</p></div></div>').join('') });
  },
  'leave-add'() { leaveModal(null); },
  'req-add'() { reqModal(); },
  'notice-hide'() { (data.requests || []).filter(r => r.status === 'pending').forEach(r => ui.noticeHidden.add(r.id)); renderNotices(); },
  'req-approve'(t) { approveRequest(t.dataset.id); },
  'req-reject'(t) { rejectRequest(t.dataset.id); },
  async 'req-delete'(t) {
    const r = (data.requests || []).find(r => r.id === t.dataset.id);
    if (!isAdmin() || !r || !['approved', 'rejected'].includes(r.status)) return;
    if (!(await confirmBox('Sonuçlanan talep silinsin mi?', esc(E.fullName(E.person(cfg(), r.personId))) + ': ' + E.fmtDate(r.from) + ' – ' + E.fmtDate(r.to) + '<p>Talep kaydı kalıcı olarak silinecek. Onaylanmış izin kaydı ve çizelge korunur.</p>', 'Sil', true))) return;
    run(() => store.deleteRequest(r.id), 'Talep silindi').catch(() => { });
  },
  async 'req-cancel'(t) {
    if (!(await confirmBox('Talep geri çekilsin mi?', 'Bekleyen izin talebiniz silinecek.', 'Geri çek', true))) return;
    run(() => store.deleteRequest(t.dataset.id), 'Talep geri çekildi').catch(() => { });
  },
  'leave-edit'(t) { leaveModal(t.dataset.id); },
  async 'leave-del'(t) {
    const l = cfg().leaves.find(x => x.id === t.dataset.id);
    if (!(await confirmBox('İzin silinsin mi?', esc(E.fullName(E.person(cfg(), l.personId))) + ': ' + E.fmtDate(l.from) + ' – ' + E.fmtDate(l.to), 'Sil', true))) return;
    saveCfg(c => { c.leaves = c.leaves.filter(x => x.id !== l.id); }, 'İzin silindi').catch(() => { });
  },
  'adj-add'(t) { adjModal(t.dataset.pid, t.dataset.post); },
  'bal-detail'(t) { balDetailModal(t.dataset.pid); },
  async 'adj-del'(t) {
    if (!(await confirmBox('Devir silinsin mi?', 'Bu düzeltme bakiyeden çıkarılacak.', 'Sil', true))) return;
    saveCfg(c => { c.adjustments = c.adjustments.filter(a => a.id !== t.dataset.id); }, 'Silindi').catch(() => { });
  },
  'person-add'() { personModal(null); },
  'person-edit'(t) { personModal(t.dataset.id); },
  'post-add'() {
    const box = $('.post-cards'), tmp = document.createElement('div');
    tmp.innerHTML = postCard(cfg(), { id: uid(), name: 'Yeni görev', assign: 'pool', every: 1, required: 1, poolIds: [] }, true);
    const card = tmp.firstChild; box.appendChild(card); $('input', card).select();
    box.closest('.set-card').classList.add('dirty');
  },
  'set-go'(t) {
    const el = document.getElementById(t.dataset.id);
    if (el) el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  },
  'post-del'(t) {
    const id = t.dataset.id, used = id && Object.values(data.schedules).some(s => (s.assign || {})[id] && s.assign[id].some(Boolean));
    if (used) { toast('Bu görev geçmiş çizelgelerde kullanılıyor; silinemez. Adını değiştirebilirsiniz.', 'err'); return; }
    t.closest('.set-card').classList.add('dirty');
    t.closest('.post-card').remove();
  },
  async 'posts-save'() {
    const posts = $$('.post-card').map(r => {
      const assign = $('[name=assign]', r).value;
      return {
        id: r.dataset.id, name: $('[name=name]', r).value.trim() || 'Görev', assign,
        mode: assign === 'fixed' ? 'cycle' : assign === 'off' ? 'off' : 'daily',
        members: $$('[name=members]:checked', r).map(x => x.value),
        fixedId: $('[name=fixedId]', r).value, poolIds: $$('[name=poolIds]:checked', r).map(x => x.value),
        every: $('[name=every]', r).value === 'need' ? 'need' : (+$('[name=every]', r).value || 1), frequencyVersion: 1, required: Math.max(1, +$('[name=required]', r).value || 1)
      };
    });
    if (!posts.length) { toast('En az bir görev olmalı.', 'err'); return; }
    const bad = posts.find(p => (p.assign === 'fixed' && !p.fixedId) || (p.assign === 'pool' && !p.poolIds.length) || (p.assign === 'people' && !p.members.length));
    if (bad) { toast('"' + bad.name + '" için ' + (bad.assign === 'fixed' ? 'sabit nöbetçiyi seçin.' : 'en az bir kişi işaretleyin.'), 'err'); return; }
    await saveCfg(c => { c.posts = posts.map(p => ({ ...(c.posts.find(x => x.id === p.id) || {}), ...p, short: p.name })); c.people.forEach(pp => { pp.posts = (pp.posts || []).filter(id => posts.some(x => x.id === id)); posts.filter(x => x.assign === 'people').forEach(x => { const on = x.members.includes(pp.id), has = pp.posts.includes(x.id); if (on && !has) pp.posts.push(x.id); if (!on && has && pp.active !== false) pp.posts = pp.posts.filter(id => id !== x.id); }); }); c.posts.forEach(x => { delete x.members; }); }, 'Görevler kaydedildi').catch(() => { });
  },
  'lt-manage'() { leaveTypesModal(); },
  'lt-add'(t) {
    const box = $('.posts', t.closest('.set-card')), tmp = document.createElement('div');
    tmp.innerHTML = ltRow({ id: uid(), name: 'Yeni izin türü', color: '#6b6f7a' });
    const div = tmp.firstChild; box.appendChild(div); $('[name=name]', div).select();
    box.closest('.set-card').classList.add('dirty');
  },
  'lt-add-ot'(t) {
    const box = $('.posts', t.closest('.set-card')), tmp = document.createElement('div');
    tmp.innerHTML = ltRow({ id: (cfg().leaveTypes || []).some(x => x.id === 'mesai') ? uid() : 'mesai', name: 'Fazla mesai izni', color: '#7a4fd1', compensate: false, overtime: true });
    box.appendChild(tmp.firstChild); box.closest('.set-card').classList.add('dirty'); t.remove();
    toast('Tür eklendi; kaydetmek için Kaydet\'e basın.');
  },
  'lt-del'(t) {
    t.closest('.set-card').classList.add('dirty');
    t.closest('.post-row').remove();
  },
  async 'lt-save'(t) {
    if (!isAdmin()) return;
    const card = t.closest('.set-card');
    const types = $$('.lt-row', card).map(r => ({ ...E.leaveType(cfg(), r.dataset.id), id: r.dataset.id, name: $('[name=name]', r).value.trim(), color: $('[name=color]', r).value, compensate: $('[name=compensate]', r).checked, annual: $('[name=annual]', r).checked, overtime: $('[name=overtime]', r).checked, unavailable: $('[name=unavailable]', r).checked }));
    if (!types.length || types.some(x => !x.name)) { toast('En az bir izin türü bırakın ve her türe bir ad verin.', 'err'); return; }
    if (types.some(x => x.overtime && (x.annual || x.unavailable || x.compensate))) { toast('Fazla mesai izninde yalnızca Fazla mesaiden düşer seçeneğini işaretleyin.', 'err'); return; }
    try {
      await saveCfg(c => { E.setLeaveTypes(c, types); }, 'İzin türleri kaydedildi');
      card.classList.remove('dirty');
      $$('#leave-form select[name=type]').forEach(select => { const selected = select.value; select.innerHTML = leaveTypeOptions(types.some(x => x.id === selected) || selected === select.dataset.originalType ? selected : types[0].id); select.dispatchEvent(new Event('input', { bubbles: true })); });
    } catch (err) { /* bildirildi */ }
  },
  async 'hol-del'(t) { await saveCfg(c => { c.holidays = c.holidays.filter(h => h.date !== t.dataset.date); }, 'Tatil silindi').catch(() => { }); },
  async 'hol-year'() {
    const ys = (cfg().holidays || []).map(h => +h.date.slice(0, 4));
    const y = (ys.length ? Math.max(...ys) : +today.slice(0, 4) - 1) + 1;
    await saveCfg(c => { const add = E.defaultHolidays([y]).filter(h => !c.holidays.some(x => x.date === h.date)); c.holidays = c.holidays.concat(add).sort((a, b) => a.date.localeCompare(b.date)); }, y + ' sabit tatilleri eklendi; dini bayramları elle ekleyin').catch(() => { });
  },
  'user-add'() { userModal(null); },
  'user-edit'(t) { userModal(ui.users.find(u => u.uid === t.dataset.uid)); },
  'pw-show'(t) { ui.showPw[t.dataset.uid] = !ui.showPw[t.dataset.uid]; loadUsers(); },
  backup() {
    const blob = new Blob([JSON.stringify({ app: 'nobet', version: 1, exportedAt: new Date().toISOString(), config: cfg(), schedules: data.schedules }, null, 1)], { type: 'application/json' });
    download(blob, 'nobet-yedek-' + today + '.json');
  },
  restore() { $('#import-file').click(); }
};
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]');
  if (!t || t.tagName === 'SELECT' || !actions[t.dataset.act]) return;
  if (t.closest('.modal') && !['lt-manage', 'lt-add', 'lt-add-ot', 'lt-del', 'lt-save', 'req-approve', 'req-reject', 'req-delete', 'req-cancel', 'leave-edit', 'leave-del'].includes(t.dataset.act)) return;
  e.preventDefault();
  actions[t.dataset.act](t, e);
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset && t.dataset.act === 'leave-filter') { ui.leavePerson = t.value; render(); }
  if (t.name === 'assign' && t.closest('.post-card')) t.closest('.post-card').dataset.assign = t.value;
});
/* Ayarlar: kaydedilmemiş değişikliği işaretle, başlık önizlemesini güncelle */
document.addEventListener('input', e => {
  const t = e.target, card = t.closest && t.closest('.set-card');
  if (!card || t.closest('#hol-form')) return;
  if ($('.sc-dirty', card)) card.classList.add('dirty');
  if (t.form && t.form.id === 'set-general' && (t.name === 'org' || t.name === 'title')) {
    const out = $('#title-prev');
    out.textContent = (t.form.org.value.trim() + ' ' + out.dataset.mid + ' ' + t.form.title.value.trim()).trim();
  }
});
document.addEventListener('submit', async e => {
  const f = e.target;
  if (f.id === 'set-general') {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(f));
    const signers = v.signers.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const [name, ...rest] = l.split('|'); return { name: name.trim(), title: rest.join('|').trim() }; });
    await saveCfg(c => { Object.assign(c.settings, { org: v.org.trim(), title: v.title.trim(), shiftHours: +v.shiftHours || 24, restHours: +v.restHours, startMonth: v.startMonth, signers }); }, 'Ayarlar kaydedildi').catch(() => { });
  }
  if (f.id === 'set-rules') {
    e.preventDefault();
    const fd = new FormData(f);
    await saveCfg(c => { Object.assign(c.settings, { monthlyHours: fd.get('monthlyHours') === '' ? 0 : Math.max(0, +fd.get('monthlyHours') || 0), hoursStartMonth: fd.get('hoursStartMonth') || E.hoursStartOf(c), maxWeekend: fd.get('maxWeekend') === '' ? '' : +fd.get('maxWeekend'), noConsecutiveWeekends: !!fd.get('noConsecutiveWeekends'), balanceWeekends: !!fd.get('balanceWeekends') }); }, 'Kurallar kaydedildi; yeni çizelgelerde uygulanır').catch(() => { });
  }
  if (f.id === 'hol-form') {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(f));
    await saveCfg(c => { c.holidays = c.holidays.filter(h => h.date !== v.date).concat({ date: v.date, name: v.name.trim() }).sort((a, b) => a.date.localeCompare(b.date)); }, 'Tatil eklendi').catch(() => { });
  }
});
$('#import-file').addEventListener('change', async e => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  try {
    const j = JSON.parse(await file.text());
    if (j.app !== 'nobet' || !j.config || !j.schedules) throw new Error('Bu dosya bir nöbet yedeği değil.');
    if (!(await confirmBox('Yedek geri yüklensin mi?', 'Mevcut tüm ayarlar, personel, izinler ve çizelgeler yedekteki verilerle <b>değiştirilecek</b>. (' + Object.keys(j.schedules).length + ' aylık çizelge, ' + (j.config.people || []).length + ' personel)', 'Geri yükle', true))) return;
    await run(() => store.replaceAll({ config: j.config, schedules: j.schedules }), 'Yedek geri yüklendi');
  } catch (err) { toast(err.message, 'err'); }
});

/* ================= Başlangıç ================= */
function finishStartup() {
  document.body.classList.remove('app-loading');
  $('#startup').hidden = true;
}
(async function boot() {
  try { store = await createStore(); } catch (e) {
    $('#app').innerHTML = '<div class="auth"><div class="auth-card"><h1>Bağlantı kurulamadı</h1><p class="muted">Firebase kitaplıkları yüklenemedi. İnternet bağlantınızı kontrol edip sayfayı yenileyin.</p><p class="err-msg">' + esc(e.message) + '</p></div></div>';
    finishStartup();
    return;
  }
  store.onAuth(async (user, err) => {
    if (unsub) { unsub(); unsub = null; }
    me = user; data = null; ui.users = null;
    if (!user) {
      let setupNeeded = false, msg = err ? err.message : '';
      try { setupNeeded = !(await store.isSetup()); } catch (e) { msg = msg || e.message; }
      renderLogin(setupNeeded, msg);
      finishStartup();
      return;
    }
    shell();
    $('#view').innerHTML = '<p class="muted loading">Veriler yükleniyor…</p>';
    if (me.personId) ui.focus = me.personId;
    parseRoute();
    unsub = store.subscribe(d => {
      /* Personel yalnızca kesinleşmiş çizelgeleri görür; taslaklar yöneticiye özeldir. */
      if (!isAdmin()) Object.keys(d.schedules).forEach(k => { if (d.schedules[k].status !== 'final') delete d.schedules[k]; });
      data = d; render(); finishStartup();
    }, e => { $('#view').innerHTML = '<div class="panel"><h2>Veriler okunamadı</h2><p class="err-msg">' + esc(e.message) + '</p></div>'; finishStartup(); });
  });
})();
