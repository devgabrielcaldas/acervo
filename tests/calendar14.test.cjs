const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const sql = read('supabase/03-calendario-atividades.sql');
const app = read('src/App.tsx');
const layout = read('src/components/layout/AppLayout.tsx');
const calendar = read('src/pages/CalendarPage.tsx');
const repository = read('src/services/activityRepository.ts');
const metricsCode = read('src/utils/activityMetrics.ts');
const css = read('src/styles/calendar14.css');

function runtime() {
  const transpiled = ts.transpileModule(metricsCode, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(transpiled, { module, exports: module.exports, Date, Intl, Set, Math, Number, String, JSON, Array, Map }, { timeout: 3000 });
  return module.exports;
}
const m = runtime();
const event = (day, extra = {}) => ({
  id: `${day}-${extra.metric || 'pages'}`, media_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  media_title: 'Uma história', media_kind: 'book', event_kind: 'progress',
  metric: 'pages', previous_value: 0, current_value: 10, delta_value: 10,
  activity_day: day, occurred_at: `${day}T17:00:00Z`, ...extra,
});

test('as três unidades de TS/TSX compilam sintaticamente sem diagnóstico', () => {
  for (const file of ['src/pages/CalendarPage.tsx','src/services/activityRepository.ts','src/utils/activityMetrics.ts']) {
    const result = ts.transpileModule(read(file), { fileName: file, reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } });
    const errors = (result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
    assert.equal(errors.length, 0, `${file}: ${errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n')}`);
  }
});
test('a nova rota está protegida pelo layout autenticado', () => {
  assert.match(app, /CalendarPage/); assert.match(app, /path="calendario" element={<CalendarPage \/>}/);
  assert.match(layout, /to: '\/calendario'/); assert.match(layout, /icon: CalendarDays/);
});
test('navegação inferior mantém os seis atalhos anteriores', () => {
  assert.match(layout, /navigation\.filter\(\(\{ to \}\) => to !== '\/calendario'\)\.slice\(0, 6\)/);
});
test('gatilho usa UPDATE, RLS de leitura e impede gravação direta no navegador', () => {
  assert.match(sql, /after update of data on public\.acervo_media/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /user_id = \(select auth\.uid\(\)\)/);
  assert.match(sql, /revoke all on public\.acervo_activity_events from public, anon, authenticated/i);
  assert.match(sql, /grant select on public\.acervo_activity_events to authenticated/i);
  assert.doesNotMatch(sql, /grant\s+(insert|update|delete|all)\s+on public\.acervo_activity_events to authenticated/i);
});
test('SQL não altera dados históricos nem objetos críticos', () => {
  assert.doesNotMatch(sql, /\b(truncate|drop table|delete from|update public\.acervo_media|alter table public\.acervo_media|insert into public\.acervo_media)\b/i);
  assert.match(sql, /security definer/i);
  assert.match(sql, /set search_path = ''/i);
  assert.match(sql, /not v_completed then return NEW/);
});
test('snapshot convencional usa delete + insert e não acionará gatilho de UPDATE', () => {
  const backupSql = read('supabase/01-estrutura.sql');
  assert.match(backupSql, /delete from public\.acervo_media where user_id=uid/i);
  assert.match(backupSql, /insert into public\.acervo_media/);
  assert.match(sql, /after update of data/i);
});
test('o serviço só consulta eventos do usuário e pagina todas as linhas', () => {
  assert.match(repository, /authenticatedUserId\(\)/);
  assert.match(repository, /\.eq\('user_id', uid\)/);
  assert.match(repository, /\.range\(from, from \+ batchSize - 1\)/);
  assert.doesNotMatch(repository, /\.insert\(|\.upsert\(|\.delete\(/);
});
test('apenas eventos reais alimentam o calendário e não se usa updatedAt', () => {
  assert.match(calendar, /listActivityEvents\(/);
  assert.match(calendar, /event\.activity_day/);
  assert.doesNotMatch(calendar, /updatedAt|createdAt|completedOn/);
});
test('datas e começo das semanas em ano bissexto', () => {
  assert.equal(m.daysInMonth(2028,1),29);
  assert.equal(m.daysInMonth(2027,1),28);
  assert.equal(m.leadingDays(2026,10),6); // 01/11/2026 caiu em domingo
});
test('data no horário de Brasília não muda conforme o local do browser', () => {
  assert.equal(m.brasiliaDate(new Date('2026-11-27T01:00:00.000Z')), '2026-11-26');
  assert.equal(m.brasiliaDate(new Date('2026-11-27T03:00:00.000Z')), '2026-11-27');
});
test('várias atualizações do mesmo dia contam um único dia ativo', () => {
  const summary = m.summarizeActivities([event('2026-11-26'),event('2026-11-26',{id:'other'})], '2026-11-26');
  assert.equal(summary.activeDays,1);
  assert.equal(summary.sessions,2);
});
test('sequências atuais aceitam atividade hoje ou ontem; sequências quebradas zeram', () => {
  const events=[event('2026-11-22'),event('2026-11-23'),event('2026-11-24'),event('2026-11-26')];
  assert.equal(m.summarizeActivities(events, '2026-11-26').currentStreak,1);
  assert.equal(m.summarizeActivities(events, '2026-11-26').longestStreak,3);
  assert.equal(m.summarizeActivities([event('2026-11-25')], '2026-11-26').currentStreak,1);
  assert.equal(m.summarizeActivities([event('2026-11-22')], '2026-11-26').currentStreak,0);
});
test('filtro por tipo de obra e métricas nunca misturam unidades', () => {
  const events=[event('2026-11-26'), event('2026-11-26',{id:'book2',metric:'percent',previous_value:20,current_value:30,delta_value:10}),
    event('2026-11-26',{id:'series',media_kind:'series',metric:'episodes',previous_value:2,current_value:4,delta_value:2}),
    event('2026-11-26',{id:'movie',media_kind:'movie',metric:'seconds',previous_value:600,current_value:1200,delta_value:600})];
  assert.equal(m.activityEventsFor(events,'book').length,2);
  const v=m.summarizeActivities(events,'2026-11-26');
  assert.equal(v.pages,10);assert.equal(v.ebookPoints,10);assert.equal(v.episodes,2);assert.equal(v.playbackSeconds,600);
});
test('formatação de avanços e conclusões em português', () => {
  assert.match(m.describeActivity(event('2026-11-26')), /\+10 páginas/);
  assert.match(m.describeActivity(event('2026-11-26',{metric:'percent',previous_value:12,current_value:19,delta_value:7})),/\+7 p\.p\./);
  assert.match(m.describeActivity(event('2026-11-26',{event_kind:'completed'})),/Concluído/);
  assert.equal(m.formatDuration(3675),'01:01:15');
});
test('backup das atividades não modifica o formato JSON v1 dos títulos', () => {
  const payload = JSON.parse(m.exportActivitiesJson([event('2026-11-26')]));
  assert.equal(payload.format,'acervo-activity'); assert.equal(payload.version,1);
  assert.equal(payload.events.length,1); assert.equal(payload.timezone,'America/Sao_Paulo');
  assert.doesNotMatch(read('src/services/backupService.ts'),/acervo-activity/);
});
test('CSS escopado e acessibilidade básica no calendário', () => {
  assert.match(css,/\.acervo-calendar-page/); assert.match(css,/@media \(max-width:520px\)/);
  assert.match(calendar,/aria-pressed/);assert.match(calendar,/aria-label/);assert.match(calendar,/role="alert"/);
  assert.match(css, /prefers-reduced-motion/);
});

test('sequência cruza dezembro e janeiro sem depender de timezone', () => {
  const entries=[event('2026-12-30'),event('2026-12-31'),event('2027-01-01')];
  const summary=m.summarizeActivities(entries, '2027-01-01');
  assert.equal(summary.currentStreak,3);
  assert.equal(summary.longestStreak,3);
});
