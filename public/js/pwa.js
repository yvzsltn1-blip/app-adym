(() => {
  const install = document.getElementById('install-app');
  const help = document.getElementById('install-help');
  const banner = document.getElementById('app-update');
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  let prompt;
  install.hidden = standalone();
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    prompt = event;
    install.hidden = standalone();
  });
  window.addEventListener('appinstalled', () => { prompt = null; install.hidden = true; help.hidden = true; });
  install.addEventListener('click', async () => {
    if (prompt) {
      const current = prompt;
      prompt = null;
      await current.prompt();
      await current.userChoice;
    } else {
      help.querySelector('span').textContent = /iPad|iPhone|iPod/.test(navigator.userAgent)
        ? 'Safari’de Paylaş → Ana Ekrana Ekle seçeneğini kullanın.'
        : 'Tarayıcı menüsünden “Uygulama olarak yükle” veya “Ana ekrana ekle” seçeneğini kullanın. Seçenek görünmüyorsa Chrome veya Edge ile açın.';
      help.hidden = false;
    }
  });
  help.querySelector('button').onclick = () => { help.hidden = true; };
  if (!('serviceWorker' in navigator)) return;
  let deadline = 0, reloading = false;
  let controlled = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (controlled && !reloading) { reloading = true; location.reload(); }
    controlled = true;
  });
  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(reg => {
    const apply = () => {
      // Finish an in-progress save before reloading.
      const saving = document.getElementById('busy');
      if (saving && !saving.hidden) {
        banner.textContent = 'Güncelleme hazır. Kaydetme tamamlanınca güncellenecek.';
        return;
      }
      if (!navigator.onLine) { banner.textContent = 'Güncelleme hazır. Bağlantı gelince güncellenecek.'; return; }
      if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    };
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      banner.textContent = seconds + ' sn sonra otomatik güncellenecek, hemen güncellemek için tıkla';
      if (!seconds) apply();
    };
    const notify = () => {
      if (!reg.waiting || !navigator.serviceWorker.controller || deadline) return;
      deadline = Date.now() + 30000;
      banner.hidden = false;
      tick();
      setInterval(tick, 1000);
    };
    banner.onclick = () => { deadline = Date.now(); apply(); };
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      worker?.addEventListener('statechange', () => { if (worker.state === 'installed') notify(); });
    });
    notify();
    const check = () => { if (navigator.onLine) reg.update().catch(() => {}); };
    setInterval(check, 60000);
    window.addEventListener('online', check);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) { if (deadline) tick(); check(); }
    });
  }).catch(error => console.warn('Uygulama güncelleme denetimi:', error));
})();
