import * as E from './engine.js';
import { buildDocument, documentDefaults, documentCSS, readBlocks, wordBlob, signatureXlsx, applyDocumentLayout } from './documents.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels = { signature: 'İmza ve devir teslim çizelgesi', leave: 'Fazla çalışma izin formu', approval: 'Fazla çalışma izin olur yazısı' };
const fields = { org:'Kurum', unit:'Birim (çizelgeler)', branch:'Şube (izin formu)', chief:'Şube müdürü / onaylayan', chiefTitle:'Şube müdürü unvanı', deputy:'Müdür yardımcısı', director:'İl müdürü', directorTitle:'İl müdürü unvanı', time:'Devir saati', divisor:'Bir izin günü karşılığı saat', year:'İznin ait olduğu yıl', number:'Yazı sayısı', service:'Hizmet süresi', registry:'Sicil no', phone:'İletişim', totalDays:'Toplam izin hakkı (gün)', days:'Kullanılacak izin (gün)', remaining:'Kalan izin (gün)', from:'İzine ayrılış tarihi', returnDate:'Göreve başlama tarihi', approvalDate:'Olur tarihi', footer:'Adres / iletişim alt bilgisi' };
const commonFields = ['org','unit','branch','chief','chiefTitle','deputy','director','directorTitle','time','divisor','number','footer'];
export const documentDraftKey = ({ kind, month, personId }) => kind + '_' + month + (kind === 'leave' ? '_' + encodeURIComponent(personId) : '');

// Shared drafts contain text and a small set of document elements, never executable HTML.
export function cleanDocumentHTML(html, doc = document) {
  const source = doc.createElement('template'); source.innerHTML = html;
  const allowed = new Set(['SECTION','H2','P','TABLE','THEAD','TBODY','TR','TH','TD','DIV','BR','B','STRONG','EM','I','SPAN','U']);
  const copy = node => {
    if (node.nodeType === 3) return doc.createTextNode(node.textContent);
    if (node.nodeType !== 1 || ['SCRIPT','STYLE','IFRAME','OBJECT','SVG'].includes(node.tagName)) return doc.createTextNode('');
    const el = doc.createElement(allowed.has(node.tagName) ? node.tagName.toLowerCase() : 'span');
    const cls = [...node.classList].filter(c => ['doc-page','doc-sign','doc-sign-right','doc-sign-left','doc-sign-center','doc-footer','doc-signature'].includes(c));
    if (cls.length) el.className = cls.join(' ');
    if (node.tagName === 'TR' && node.hasAttribute('data-person-id')) el.dataset.personId = node.dataset.personId;
    if (['TD','TH'].includes(node.tagName) && /^\d+(\.\d+)?%$/.test(node.style.width)) el.style.width = node.style.width;
    node.childNodes.forEach(n => el.appendChild(copy(n))); return el;
  };
  const result = doc.createElement('div'); source.content.childNodes.forEach(n => result.appendChild(copy(n)));
  return result.innerHTML;
}

export async function openDocuments({ cfg, schedules, ym, modal, download, toast, store, busy = () => {} }) {
  let savedSettings;
  try { savedSettings = await store.loadDocumentSettings(); }
  catch (e) { toast('Belge taslakları yüklenemedi: ' + e.message, 'err'); return; }
  const defaults = { ...documentDefaults(cfg, ym), ...savedSettings.defaults }, drafts = new Map();
  const selection = savedSettings.lastSelection || { kind:'signature', month:ym, personId:cfg.people?.[0]?.id || '' };
  if (!labels[selection.kind]) selection.kind = 'signature';
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(selection.month)) selection.month = ym;
  modal({ title:'Belgeler · düzenle ve çıktı al', wide:true,
    body:'<div class="document-controls form"><label>Belge<select name="kind">' + Object.entries(labels).map(([k,l])=>`<option value="${k}" ${k === selection.kind ? 'selected' : ''}>${l}</option>`).join('') + '</select></label><label>Ay<input name="month" type="month" value="' + esc(selection.month) + '"></label><label>Personel (bireysel izin formu)<select name="person">' + (cfg.people || []).map(p=>`<option value="${esc(p.id)}" ${p.id === selection.personId ? 'selected' : ''}>${esc(E.fullName(p))}</option>`).join('') + '</select></label></div><details open><summary>Kurum, imza ve izin bilgileri</summary><div class="document-controls form">' + Object.entries(fields).map(([k,l])=>`<label>${l}<input name="${k}" type="${['from','returnDate','approvalDate'].includes(k) ? 'date' : ['divisor','totalDays','days','remaining'].includes(k) ? 'number' : k === 'time' ? 'time' : 'text'}" value="${esc(defaults[k])}"></label>`).join('') + '</div></details><p class="muted small">Önce bilgileri girip önizlemeyi doldurun, ardından yazı ve hücreleri doğrudan düzenleyin. “Taslağı kaydet” bilgileri ve belgenin son halini saklar. Tekrar açıldığında son kaydedilen taslak gelir. Müdür ve kurum bilgileri yeni belgelere de uygulanır. Bu belgeler izin onayı veya bakiye değişikliği yapmaz.</p><p class="muted small" data-doc-note></p><p role="status" data-doc-status></p><button class="btn" data-doc-refresh>Bilgilerden yeniden doldur</button><div class="document-preview"><iframe sandbox="allow-same-origin allow-modals" title="Düzenlenebilir belge önizlemesi"></iframe></div>',
    foot:'<button class="btn" data-close>Kapat</button><button class="btn primary" data-doc-save>Taslağı kaydet</button><button class="btn" data-doc-download>Word indir</button><button class="btn" data-doc-print>Yazdır / PDF</button>',
    onMount(el) {
      const q = s => el.querySelector(s), frame = q('iframe');
      const picker = document.createElement('fieldset');
      picker.className = 'document-people';
      picker.innerHTML = '<legend>Çizelgede yer alacak personeller</legend><div><button type="button" class="btn sm" data-doc-all>Tümünü seç</button> <button type="button" class="btn sm" data-doc-none>Seçimi temizle</button></div><div class="document-people-list">' + (cfg.people || []).map(p => '<label class="check"><input type="checkbox" data-doc-person value="' + esc(p.id) + '" checked><span>' + esc(E.fullName(p)) + '</span></label>').join('') + '</div><p class="muted small">Yalnızca seçtiğiniz kişiler belgeye eklenir. Seçim taslakla birlikte saklanır.</p>';
      q('details').before(picker);
      let activeKey = '', generation = 0, loading = false, saving = false, renderedFields = {};
      const getSelection = () => ({ kind:q('[name=kind]').value, month:q('[name=month]').value, personId:q('[name=person]').value });
      const getFields = () => Object.fromEntries(Object.keys(fields).map(k => [k,q(`[name=${k}]`).value]));
      const personIds = () => [...picker.querySelectorAll('[data-doc-person]:checked')].map(c => c.value);
      const documentFields = () => ({...getFields(),personIds:personIds()});
      const status = text => { q('[data-doc-status]').textContent = text; };
      const controls = () => {
        el.querySelectorAll('input,select,[data-doc-save],[data-doc-download],[data-doc-print],[data-doc-refresh]').forEach(c => { c.disabled = loading || saving; });
        picker.querySelectorAll('button').forEach(c => { c.disabled = loading || saving; });
        q('[name=person]').disabled ||= getSelection().kind !== 'leave';
      };
      const write = html => {
        const doc = frame.contentDocument;
        doc.open(); doc.write('<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>' + esc(labels[getSelection().kind]) + '</title><style>' + documentCSS + '</style></head><body contenteditable="true" spellcheck="false">' + cleanDocumentHTML(html) + '</body></html>'); doc.close();
        applyDocumentLayout(doc.body,getSelection().kind);
        doc.body.addEventListener('input', () => status('Kaydedilmemiş değişiklikler'));
        doc.body.addEventListener('paste', e => { e.preventDefault(); doc.execCommand('insertText', false, e.clipboardData.getData('text/plain')); });
      };
      const cache = () => { if (activeKey && frame.contentDocument?.body) drafts.set(activeKey, { html:cleanDocumentHTML(frame.contentDocument.body.innerHTML), fields:getFields(), renderedFields, personIds:personIds() }); };
      const refill = () => {
        const s = getSelection(); renderedFields = getFields();
        write(buildDocument(s.kind,cfg,schedules,s.month,documentFields(),s.personId));
        status('Kaydedilmemiş değişiklikler');
      };
      const load = async () => {
        const s = getSelection();
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(s.month)) { toast('Geçerli bir ay seçin.', 'err'); return; }
        cache(); const key = documentDraftKey(s), seq = ++generation;
        loading = true; controls(); status('Taslak yükleniyor…');
        try {
          const draft = drafts.get(key) || await store.loadDocumentDraft(key);
          if (seq !== generation || !el.isConnected) return;
          activeKey = key;
          picker.hidden = s.kind !== 'approval';
          const picked = Array.isArray(draft?.personIds) ? draft.personIds : (cfg.people || []).map(p => p.id);
          picker.querySelectorAll('[data-doc-person]').forEach(c => { c.checked = picked.includes(c.value); });
          const person = E.person(cfg,s.personId);
          const values = draft?.fields || {...defaults, year:s.month.slice(0,4), registry:person?.code || '', phone:person?.phone || ''};
          Object.keys(fields).forEach(k => { q(`[name=${k}]`).value = values[k] ?? ''; });
          renderedFields = draft?.renderedFields || {...getFields()};
          write(draft?.html ?? buildDocument(s.kind,cfg,schedules,s.month,documentFields(),s.personId));
          q('[data-doc-download]').textContent = s.kind === 'signature' ? 'Excel indir' : 'Word indir';
          q('[data-doc-note]').textContent = s.kind === 'approval' ? 'Gün önerisi: nöbet saati − kişisel mesai hedefi; pozitif sonuç gün karşılığı saate bölünüp aşağı yuvarlanır. Süreleri kontrol edip düzenleyin.' : '';
          status(draft ? 'Taslak açıldı' : 'Yeni belge · henüz kaydedilmedi');
        } catch(e) {
          // Keep saving disabled: a failed cloud read must never overwrite an existing draft.
          activeKey = ''; status('Taslak yüklenemedi. Belgeyi kapatıp tekrar açın.'); toast(e.message,'err');
        } finally { if (seq === generation) { loading = false; controls(); q('[data-doc-save]').disabled ||= !activeKey; } }
      };
      ['kind','month','person'].forEach(k => q(`[name=${k}]`).onchange = load);
      const updatePeople = () => {
        if (getSelection().kind !== 'approval' || loading || saving) return;
        const doc = frame.contentDocument, current = doc.querySelector('table tbody');
        if (!current) { refill(); return; }
        const old = new Map([...current.rows].map(r => [r.dataset.personId || r.cells[1]?.textContent.trim(),r]));
        const source = doc.createElement('div'), s = getSelection();
        source.innerHTML = buildDocument(s.kind,cfg,schedules,s.month,documentFields(),s.personId);
        const rows = [...source.querySelector('tbody').rows].map(r => {
          const retained = old.get(r.dataset.personId) || old.get(r.cells[1]?.textContent.trim());
          if (!retained) return r;
          retained.dataset.personId = r.dataset.personId; retained.cells[0].textContent = r.cells[0].textContent; return retained;
        });
        current.replaceChildren(...rows); status('Personel seçimi değişti · henüz kaydedilmedi');
      };
      picker.onchange = updatePeople;
      q('[data-doc-all]').onclick = () => { picker.querySelectorAll('input').forEach(c => c.checked = true); updatePeople(); };
      q('[data-doc-none]').onclick = () => { picker.querySelectorAll('input').forEach(c => c.checked = false); updatePeople(); };
      Object.keys(fields).forEach(k => {
        q(`[name=${k}]`).oninput = () => status('Bilgiler değişti · önizleme yenilenecek');
        q(`[name=${k}]`).onchange = refill;
      });
      q('[data-doc-refresh]').onclick = () => { if (window.confirm('Önizlemedeki elle düzenlemeler girilen bilgilerle yenilensin mi?')) refill(); };
      q('[data-doc-save]').onclick = async () => {
        if (!activeKey || loading || saving) return;
        if (getSelection().kind === 'approval' && !personIds().length) { toast('En az bir personel seçin.','err'); return; }
        if (JSON.stringify(getFields()) !== JSON.stringify(renderedFields)) refill();
        cache(); const s = getSelection(), draft = drafts.get(activeKey), current = getFields();
        const common = Object.fromEntries(commonFields.map(k => [k,current[k]]));
        saving = true; controls(); frame.contentDocument.body.contentEditable = 'false'; status('Taslak kaydediliyor…'); busy(true, 'Taslak kaydediliyor…');
        try {
          await store.saveDocumentDraft(activeKey, { ...draft, selection:s }, { defaults:common, lastSelection:s });
          Object.assign(defaults,common); status('Taslak kaydedildi'); toast('Taslak kaydedildi');
        } catch(e) { status('Kaydedilemedi · değişiklikler bu pencerede duruyor'); toast('Taslak kaydedilemedi: '+e.message,'err'); }
        finally { saving = false; controls(); if (frame.contentDocument?.body) frame.contentDocument.body.contentEditable = 'true'; busy(false); }
      };
      q('[data-doc-download]').onclick = () => {
        if (getSelection().kind === 'approval' && !personIds().length) { toast('En az bir personel seçin.','err'); return; }
        try { const s=getSelection(), blocks=readBlocks(frame.contentDocument.body); download(s.kind==='signature'?signatureXlsx(blocks):wordBlob(blocks,s.kind),labels[s.kind]+'_'+s.month+(s.kind==='signature'?'.xlsx':'.docx')); }
        catch(e) { toast('Belge oluşturulamadı: '+e.message,'err'); }
      };
      q('[data-doc-print]').onclick = () => { if (getSelection().kind === 'approval' && !personIds().length) { toast('En az bir personel seçin.','err'); return; } frame.contentWindow.focus(); frame.contentWindow.print(); };
      load();
    }
  });
}
