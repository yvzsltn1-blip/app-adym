/* Veri ve oturum katmanı.
   - Firebase modu: Firebase Authentication (e-posta/şifre) + Cloud Firestore.
     Kullanıcı adı, "kullaniciadi@KULLANICI_ALANI" biçiminde bir e-postaya çevrilir; kayıt ekranı yoktur.
     Yönetici yeni kullanıcıları ikincil bir Firebase örneğiyle oluşturur, böylece kendi oturumu kapanmaz.
     Firebase istemci tarafında başka bir kullanıcının şifresini doğrudan değiştiremediğinden, yöneticinin
     belirlediği şifreler yalnızca yöneticinin okuyabildiği "secrets" koleksiyonunda saklanır; şifre
     değiştirme ve silme bu şifreyle ikincil örnekte oturum açılarak yapılır.
   - Deneme modu (?demo): tüm veri bu tarayıcının localStorage'ında tutulur. Kurulum yapmadan denemek içindir. */

import * as E from './engine.js';

const FB = 'https://www.gstatic.com/firebasejs/10.14.1/';
export const firebaseConfig = {
  apiKey: 'AIzaSyC3uTXlfvf8KWl5bsJK6WFkPhw47Ezqthc',
  authDomain: 'afetlere.firebaseapp.com',
  projectId: 'afetlere',
  storageBucket: 'afetlere.firebasestorage.app',
  messagingSenderId: '95516870693',
  appId: '1:95516870693:web:e88d2b944c07490a3997cc'
};
const USER_DOMAIN = 'nobet.afetlere.app';

export function normalizeUsername(u) {
  const map = { ç: 'c', ğ: 'g', ı: 'i', i: 'i', ö: 'o', ş: 's', ü: 'u' };
  return String(u || '').trim().toLocaleLowerCase('tr').replace(/[çğıöşü]/g, c => map[c]).replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, '');
}
/* Yönetici gerçek e-postasıyla, diğer kullanıcılar yöneticinin verdiği isimle girer. Firebase yalnızca
   e-posta kabul ettiğinden isim, kullanıcının hiç görmediği iç bir adrese çevrilir. */
export const isEmail = u => String(u || '').includes('@');
const loginKey = u => isEmail(u) ? String(u).trim().toLowerCase() : normalizeUsername(u);
const emailOf = u => isEmail(u) ? String(u).trim().toLowerCase() : normalizeUsername(u) + '@' + USER_DOMAIN;
const clean = o => JSON.parse(JSON.stringify(o));

function friendly(err) {
  const code = (err && err.code) || '';
  const m = {
    'auth/invalid-credential': 'Kullanıcı adı veya şifre hatalı.',
    'auth/wrong-password': 'Kullanıcı adı veya şifre hatalı.',
    'auth/user-not-found': 'Kullanıcı adı veya şifre hatalı.',
    'auth/invalid-email': 'Kullanıcı adı geçersiz.',
    'auth/too-many-requests': 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar deneyin.',
    'auth/weak-password': 'Şifre en az 6 karakter olmalı.',
    'auth/email-already-in-use': 'Bu kullanıcı adı zaten kullanılıyor.',
    'auth/network-request-failed': 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.',
    'auth/operation-not-allowed': 'Firebase konsolunda E-posta/Şifre girişi etkin değil (Authentication → Sign-in method).',
    'auth/configuration-not-found': 'Firebase Authentication bu projede henüz etkinleştirilmemiş (Authentication → Get started).',
    'auth/requires-recent-login': 'Güvenlik için yeniden giriş yapmanız gerekiyor.',
    'permission-denied': 'Bu işlem için yetkiniz yok (Firestore güvenlik kuralları).',
    'unavailable': 'Veritabanına ulaşılamadı. İnternet bağlantınızı kontrol edin.',
    'not-found': 'Firestore veritabanı bulunamadı. Firebase konsolunda Firestore Database oluşturun.'
  };
  const e = new Error(m[code] || (err && err.message) || 'Bilinmeyen hata');
  e.code = code;
  return e;
}

/* ================= Firebase ================= */
async function firebaseStore() {
  const [{ initializeApp, deleteApp }, A, F] = await Promise.all([
    import(FB + 'firebase-app.js'), import(FB + 'firebase-auth.js'), import(FB + 'firebase-firestore.js')
  ]);
  const app = initializeApp(firebaseConfig);
  const auth = A.getAuth(app);
  const db = F.getFirestore(app);
  const ref = (...p) => F.doc(db, ...p);
  let me = null, setupPromise = null;

  async function doSetup({ username, password, displayName, seed }) {
    try {
      if (!isEmail(username)) throw new Error('Yönetici için geçerli bir e-posta adresi girin.');
      if (await store.isSetup()) throw new Error('Kurulum zaten yapılmış.');
      let cred;
      try { cred = await A.createUserWithEmailAndPassword(auth, emailOf(username), password); } catch (e) {
        /* Önceki yarım kalmış kurulumdan kalan hesap: aynı şifreyle devam et. */
        if (e.code !== 'auth/email-already-in-use') throw e;
        cred = await A.signInWithEmailAndPassword(auth, emailOf(username), password);
      }
      const uid = cred.user.uid;
      await F.setDoc(ref('meta', 'setup'), { adminUid: uid, createdAt: Date.now() });
      await F.setDoc(ref('users', uid), { username: loginKey(username), email: loginKey(username), displayName, role: 'super', active: true, personId: '', createdAt: Date.now() });
      const cfg = E.defaultConfig();
      if (!seed) { cfg.people = []; cfg.settings.startMonth = ''; }
      await F.setDoc(ref('app', 'config'), clean(cfg));
      if (seed) { const s = E.sampleNovember(); await F.setDoc(ref('schedules', s.ym), clean(s)); }
    } catch (e) {
      try { await A.signOut(auth); } catch (x) { /* yok say */ }
      throw e.code ? friendly(e) : e;
    }
  }

  /* Diğer kullanıcılar için ikincil, oturumu kalıcı olmayan Firebase örneği. */
  async function withSecondary(fn) {
    const sec = initializeApp(firebaseConfig, 'yonetim-' + Date.now() + Math.random());
    const sa = A.getAuth(sec);
    await A.setPersistence(sa, A.inMemoryPersistence);
    try { return await fn(sa); } finally { try { await A.signOut(sa); } catch (e) { /* yok say */ } await deleteApp(sec); }
  }

  const store = {
    mode: 'firebase',
    async isSetup() {
      try { return (await F.getDoc(ref('meta', 'setup'))).exists(); } catch (e) { throw friendly(e); }
    },
    async setup(args) {
      /* Hesap oluşturulunca Firebase hemen oturum açar; kullanıcı kaydı yazılana kadar
         oturum dinleyicisi bu işi bekler. */
      setupPromise = doSetup(args);
      try { await setupPromise; } finally { setupPromise = null; }
    },
    async login(username, password) {
      try { await A.signInWithEmailAndPassword(auth, emailOf(username), password); } catch (e) { throw friendly(e); }
    },
    async logout() { await A.signOut(auth); },
    async resetPassword(email) {
      if (!isEmail(email)) throw new Error('Şifre sıfırlama yalnızca yönetici e-postası için yapılabilir. Kullanıcılar şifrelerini yöneticiden ister.');
      try { await A.sendPasswordResetEmail(auth, emailOf(email)); } catch (e) { throw friendly(e); }
    },
    onAuth(cb) {
      return A.onAuthStateChanged(auth, async u => {
        if (setupPromise) { try { await setupPromise; } catch (e) { return; } }
        if (!u || !auth.currentUser) { me = null; cb(null); return; }
        try {
          const [snap, setup] = await Promise.all([F.getDoc(ref('users', u.uid)), F.getDoc(ref('meta', 'setup'))]);
          let d = snap.exists() ? snap.data() : null;
          /* Yarım kalmış kurulumu tamamla: baş yöneticinin kullanıcı kaydı ya da ayarlar eksikse yaz. */
          if (setup.exists() && setup.data().adminUid === u.uid) {
            if (!d) {
              const mail = String(u.email || '').toLowerCase();
              d = { username: mail, email: mail, displayName: mail.split('@')[0], role: 'super', active: true, personId: '', createdAt: Date.now() };
              await F.setDoc(ref('users', u.uid), d);
            }
            if (!(await F.getDoc(ref('app', 'config'))).exists()) {
              await F.setDoc(ref('app', 'config'), clean(E.defaultConfig()));
              const s = E.sampleNovember();
              if (!(await F.getDoc(ref('schedules', s.ym))).exists()) await F.setDoc(ref('schedules', s.ym), clean(s));
            }
          }
          if (!d || d.active === false) { await A.signOut(auth); cb(null, new Error('Bu hesap devre dışı bırakılmış veya silinmiş.')); return; }
          me = { uid: u.uid, ...d, role: setup.exists() && setup.data().adminUid === u.uid ? 'super' : d.role === 'admin' ? 'admin' : 'user' };
          cb(me);
        } catch (e) { cb(null, friendly(e)); }
      });
    },
    subscribe(cb, onError) {
      let config = null, schedules = null, requests = null;
      const admin = me && (me.role === 'super' || me.role === 'admin');
      const emit = () => { if (config && schedules && requests) cb({ config, schedules, requests }); };
      const u1 = F.onSnapshot(ref('app', 'config'), s => { config = s.exists() ? s.data() : E.defaultConfig(); emit(); }, e => onError && onError(friendly(e)));
      const col = F.collection(db, 'schedules');
      const q = admin ? col : F.query(col, F.where('status', '==', 'final'));
      const u2 = F.onSnapshot(q, qs => {
        schedules = {}; qs.forEach(d => { schedules[d.id] = d.data(); }); emit();
      }, e => onError && onError(friendly(e)));
      const rcol = F.collection(db, 'requests');
      const u3 = F.onSnapshot(admin ? rcol : F.query(rcol, F.where('uid', '==', me ? me.uid : '-')), qs => {
        requests = []; qs.forEach(d => requests.push({ id: d.id, ...d.data() }));
        requests.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); emit();
      }, e => onError && onError(friendly(e)));
      return () => { u1(); u2(); u3(); };
    },
    async saveConfig(cfg) { try { await F.setDoc(ref('app', 'config'), clean({ ...cfg, updatedAt: Date.now() })); } catch (e) { throw friendly(e); } },
    async saveDayPlan(cfg, s) {
      try {
        const b = F.writeBatch(db), updatedAt = Date.now();
        b.set(ref('app', 'config'), clean({ ...cfg, updatedAt }));
        b.set(ref('schedules', s.ym), clean({ ...s, updatedAt, updatedBy: me ? me.displayName : '' }));
        await b.commit();
      } catch (e) { throw friendly(e); }
    },
    async saveSchedule(s) { try { await F.setDoc(ref('schedules', s.ym), clean({ ...s, updatedAt: Date.now(), updatedBy: me ? me.displayName : '' })); } catch (e) { throw friendly(e); } },
    async deleteSchedule(ym) { try { await F.deleteDoc(ref('schedules', ym)); } catch (e) { throw friendly(e); } },
    async replaceAll({ config, schedules }) {
      try {
        const b = F.writeBatch(db);
        b.set(ref('app', 'config'), clean(config));
        const cur = await F.getDocs(F.collection(db, 'schedules'));
        cur.forEach(d => { if (!schedules[d.id]) b.delete(d.ref); });
        Object.keys(schedules).forEach(k => b.set(ref('schedules', k), clean(schedules[k])));
        await b.commit();
      } catch (e) { throw friendly(e); }
    },

    /* ---- Kullanıcı yönetimi (yalnız yönetici) ---- */
    async listUsers() {
      try {
        const us = await F.getDocs(F.collection(db, 'users'));
        const list = []; us.forEach(d => list.push({ uid: d.id, ...d.data() }));
        const sec = {};
        /* Baş yönetici tüm şifre kayıtlarını, yönetici yalnızca personel hesaplarınınkini okuyabilir. */
        if (me.role === 'super') (await F.getDocs(F.collection(db, 'secrets'))).forEach(d => { sec[d.id] = d.data().password; });
        else await Promise.all(list.filter(u => u.role === 'user').map(async u => { const x = await F.getDoc(ref('secrets', u.uid)); if (x.exists()) sec[u.uid] = x.data().password; }));
        const rank = r => r === 'super' ? 0 : r === 'admin' ? 1 : 2;
        return list.map(u => ({ ...u, password: sec[u.uid] || '' })).sort((a, b) => rank(a.role) - rank(b.role) || a.username.localeCompare(b.username));
      } catch (e) { throw friendly(e); }
    },
    async createUser({ username, password, displayName, personId, role }) {
      try {
        role = role === 'admin' ? 'admin' : 'user';
        if (role === 'admin' && me.role !== 'super') throw Object.assign(new Error('Yönetici hesabını yalnızca baş yönetici açabilir.'), { code: 'x' });
        if (role === 'admin' && !isEmail(username)) throw Object.assign(new Error('Yönetici hesabı e-posta adresiyle açılır.'), { code: 'x' });
        if (role === 'user' && isEmail(username)) throw Object.assign(new Error('Kullanıcı adı e-posta biçiminde olamaz; isim yazın (ör. gulden.genc).'), { code: 'x' });
        const uid = await withSecondary(async sa => (await A.createUserWithEmailAndPassword(sa, emailOf(username), password)).user.uid);
        await F.setDoc(ref('users', uid), { username: loginKey(username), ...(role === 'admin' ? { email: loginKey(username) } : {}), displayName, role, active: true, personId: personId || '', createdAt: Date.now() });
        await F.setDoc(ref('secrets', uid), { password });
      } catch (e) { throw e.code === 'x' ? e : friendly(e); }
    },
    async updateUser(uid, fields) { try { await F.updateDoc(ref('users', uid), clean(fields)); } catch (e) { throw friendly(e); } },
    async setUserPassword(user, newPass) {
      try {
        if (!user.password) throw Object.assign(new Error('Bu kullanıcının kayıtlı şifresi yok; kullanıcıyı silip yeniden oluşturun.'), { code: 'x' });
        await withSecondary(async sa => {
          const c = await A.signInWithEmailAndPassword(sa, emailOf(user.username), user.password);
          await A.updatePassword(c.user, newPass);
        });
        await F.setDoc(ref('secrets', user.uid), { password: newPass });
      } catch (e) { throw e.code === 'x' ? e : friendly(e); }
    },
    async deleteUser(user) {
      try {
        if (user.password) {
          try {
            await withSecondary(async sa => { const c = await A.signInWithEmailAndPassword(sa, emailOf(user.username), user.password); await A.deleteUser(c.user); });
          } catch (e) { /* Hesap zaten silinmiş veya şifre değişmiş olabilir; Firestore kaydı yine de silinir ve erişim kapanır. */ }
        }
        await F.deleteDoc(ref('users', user.uid));
        await F.deleteDoc(ref('secrets', user.uid));
      } catch (e) { throw friendly(e); }
    },
    async changeOwnPassword(oldPass, newPass) {
      try {
        const u = auth.currentUser;
        await A.reauthenticateWithCredential(u, A.EmailAuthProvider.credential(u.email, oldPass));
        await A.updatePassword(u, newPass);
      } catch (e) { throw friendly(e); }
    },

    /* ---- İzin talepleri ---- */
    async createRequest(r) { try { await F.addDoc(F.collection(db, 'requests'), clean({ ...r, uid: me.uid, status: 'pending', createdAt: Date.now() })); } catch (e) { throw friendly(e); } },
    async updateRequest(id, f) { try { await F.updateDoc(ref('requests', id), clean(f)); } catch (e) { throw friendly(e); } },
    async deleteRequest(id) { try { await F.deleteDoc(ref('requests', id)); } catch (e) { throw friendly(e); } }
  };
  return store;
}

/* ================= Deneme modu (localStorage) ================= */
function demoStore() {
  const KEY = 'nobet-demo-v1', SKEY = 'nobet-demo-session';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; } };
  let db = load();
  const listeners = new Set(), authCbs = new Set();
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* yok say */ } listeners.forEach(f => f()); };
  const sess = () => { try { return sessionStorage.getItem(SKEY); } catch (e) { return null; } };
  const setSess = v => { try { v ? sessionStorage.setItem(SKEY, v) : sessionStorage.removeItem(SKEY); } catch (e) { /* yok say */ } };
  const meOf = uid => { const u = db && db.users.find(x => x.uid === uid && x.active !== false); return u ? { uid: u.uid, username: u.username, displayName: u.displayName, role: u.role, personId: u.personId } : null; };
  const fireAuth = () => { const m = sess() ? meOf(sess()) : null; authCbs.forEach(cb => cb(m)); };
  const wait = v => new Promise(r => setTimeout(() => r(v), 120));
  const err = m => Promise.reject(new Error(m));

  return {
    mode: 'demo',
    async isSetup() { return !!db; },
    async setup({ username, password, displayName, seed }) {
      const cfg = E.defaultConfig();
      if (!seed) { cfg.people = []; cfg.settings.startMonth = ''; }
      if (!isEmail(username)) return err('Yönetici için geçerli bir e-posta adresi girin.');
      db = { config: cfg, schedules: seed ? { '2026-11': E.sampleNovember() } : {}, requests: [], users: [{ uid: 'u0', username: loginKey(username), email: loginKey(username), password, displayName, role: 'super', active: true, personId: '' }] };
      persist();
      await this.login(username, password);
    },
    async resetPassword() { return err('Deneme modunda e-posta gönderilmez.'); },
    async login(username, password) {
      const u = db && db.users.find(x => x.username === loginKey(username));
      if (!u || u.password !== password) return err('Kullanıcı adı veya şifre hatalı.');
      if (u.active === false) return err('Bu hesap devre dışı bırakılmış.');
      setSess(u.uid); await wait(); fireAuth();
    },
    async logout() { setSess(null); fireAuth(); },
    onAuth(cb) { authCbs.add(cb); setTimeout(() => cb(sess() ? meOf(sess()) : null), 0); return () => authCbs.delete(cb); },
    subscribe(cb) {
      const f = () => {
        const m = meOf(sess()), admin = m && m.role !== 'user';
        const schedules = {}; Object.keys(db.schedules).forEach(k => { if (admin || db.schedules[k].status === 'final') schedules[k] = db.schedules[k]; });
        const requests = (db.requests || []).filter(r => admin || (m && r.uid === m.uid)).sort((a, b) => b.createdAt - a.createdAt);
        cb(clean({ config: db.config, schedules, requests }));
      };
      listeners.add(f); setTimeout(f, 0);
      return () => listeners.delete(f);
    },
    async saveConfig(cfg) { db.config = clean(cfg); persist(); return wait(); },
    async saveDayPlan(cfg, s) { db.config = clean(cfg); db.schedules[s.ym] = clean({ ...s, updatedAt: Date.now() }); persist(); return wait(); },
    async saveSchedule(s) { db.schedules[s.ym] = clean({ ...s, updatedAt: Date.now() }); persist(); return wait(); },
    async deleteSchedule(ym) { delete db.schedules[ym]; persist(); return wait(); },
    async replaceAll({ config, schedules }) { db.config = clean(config); db.schedules = clean(schedules); persist(); return wait(); },
    async listUsers() {
      const m = meOf(sess()), rank = r => r === 'super' ? 0 : r === 'admin' ? 1 : 2;
      return clean(db.users).map(u => ({ ...u, password: m.role === 'super' || u.role === 'user' ? u.password : '' })).sort((a, b) => rank(a.role) - rank(b.role));
    },
    async createUser({ username, password, displayName, personId, role }) {
      role = role === 'admin' ? 'admin' : 'user';
      if (role === 'admin' && meOf(sess()).role !== 'super') return err('Yönetici hesabını yalnızca baş yönetici açabilir.');
      if (role === 'admin' && !isEmail(username)) return err('Yönetici hesabı e-posta adresiyle açılır.');
      if (role === 'user' && isEmail(username)) return err('Kullanıcı adı e-posta biçiminde olamaz; isim yazın (ör. gulden.genc).');
      const n = loginKey(username);
      if (db.users.some(u => u.username === n)) return err('Bu kullanıcı adı zaten kullanılıyor.');
      if (String(password).length < 6) return err('Şifre en az 6 karakter olmalı.');
      db.users.push({ uid: 'u' + Date.now(), username: n, password, displayName, role, active: true, personId: personId || '' });
      persist(); return wait();
    },
    async updateUser(uid, fields) { Object.assign(db.users.find(u => u.uid === uid), fields); persist(); return wait(); },
    async setUserPassword(user, p) {
      if (String(p).length < 6) return err('Şifre en az 6 karakter olmalı.');
      db.users.find(u => u.uid === user.uid).password = p; persist(); return wait();
    },
    async deleteUser(user) { db.users = db.users.filter(u => u.uid !== user.uid); persist(); return wait(); },
    async changeOwnPassword(o, n) {
      const u = db.users.find(x => x.uid === sess());
      if (u.password !== o) return err('Mevcut şifre hatalı.');
      if (String(n).length < 6) return err('Şifre en az 6 karakter olmalı.');
      u.password = n; persist(); return wait();
    },
    async createRequest(r) { (db.requests = db.requests || []).push({ ...clean(r), id: 'r' + Date.now(), uid: sess(), status: 'pending', createdAt: Date.now() }); persist(); return wait(); },
    async updateRequest(id, f) { Object.assign(db.requests.find(r => r.id === id), clean(f)); persist(); return wait(); },
    async deleteRequest(id) { db.requests = db.requests.filter(r => r.id !== id); persist(); return wait(); },
    resetDemo() { try { localStorage.removeItem(KEY); } catch (e) { /* yok say */ } setSess(null); db = null; }
  };
}

export async function createStore() {
  const demo = new URLSearchParams(location.search).has('demo');
  return demo ? demoStore() : firebaseStore();
}
