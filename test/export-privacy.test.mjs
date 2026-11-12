import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../public/js/engine.js';
import { drawSchedule } from '../public/js/export.js';
import { buildXlsx } from '../public/js/xlsx.js';

function fixture() {
  const cfg = E.defaultConfig(), ym = '2026-12', s = E.emptySchedule(ym);
  s.status = 'final';
  cfg.people.find(p => p.id === 'p_mehmet').name = 'İZİNLİ_GİZLİ_AD';
  cfg.leaves = [{ id: 'l1', personId: 'p_mehmet', type: 'yillik', from: ym + '-01', to: ym + '-31' }];
  cfg.holidays.push({ date: ym + '-01', name: 'ÖRNEK TATİL' });
  E.setDayList(s, 'enf', 0, ['p_kutay']);
  return { cfg, ym, schedules: { [ym]: s } };
}

test('shared PNG/PDF/print artwork keeps assignments and holidays without leave annotations', async () => {
  const { cfg, ym, schedules } = fixture(), text = [];
  const context = { scale() {}, fillRect() {}, beginPath() {}, roundRect() {}, fill() {}, measureText: s => ({ width: String(s).length * 7 }), fillText: s => text.push(String(s)) };
  const original = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => context }) };
  try {
    await drawSchedule(cfg, schedules, ym, 1);
    const drawn = text.join('\n');
    assert.match(drawn, /Kutay ZENGİN/);
    assert.match(drawn, /ÖRNEK TATİL/);
    assert.doesNotMatch(drawn, /İZİNLİ_GİZLİ_AD|İzinli:|Yıllık izin|Onaylı/);
  } finally { globalThis.document = original; }
});

test('Excel includes working staff without leave names or leave-day columns', async () => {
  const { cfg, ym, schedules } = fixture();
  const workbook = await buildXlsx(cfg, schedules, ym).text();
  assert.match(workbook, /Kutay ZENGİN/);
  assert.match(workbook, /ÖRNEK TATİL/);
  assert.doesNotMatch(workbook, /İZİNLİ_GİZLİ_AD|İzin günü|Yıllık izin|Onaylı/);
});
