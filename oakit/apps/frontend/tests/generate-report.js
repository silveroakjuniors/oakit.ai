#!/usr/bin/env node
/**
 * OAKIT TEST SUMMARY REPORT GENERATOR
 * Reads playwright-report/results.json and generates
 * playwright-report/summary.html — a single-page report with:
 *  - Overall pass/fail banner
 *  - Stats: total, passed, failed, skipped, duration
 *  - Per-suite accordion (click heading to expand)
 *  - Per-test row: pass/fail badge, test name, duration, error message
 *  - Link to Playwright's full HTML report for screenshots/traces
 */

const fs   = require('fs');
const path = require('path');

const REPORT_DIR = path.join(__dirname, '..', 'playwright-report');
const JSON_FILE  = path.join(REPORT_DIR, 'results.json');
const OUT_FILE   = path.join(REPORT_DIR, 'summary.html');

if (!fs.existsSync(JSON_FILE)) {
  console.error('results.json not found — run tests first');
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));

// ── Parse results ─────────────────────────────────────────────
const suites = [];
let totalPass = 0, totalFail = 0, totalSkip = 0, totalDuration = 0;

function walkSuite(suite, projectName) {
  const suiteName = suite.title || projectName || 'Tests';

  // Collect specs (leaf tests)
  const tests = [];
  for (const spec of (suite.specs || [])) {
    for (const test of (spec.tests || [])) {
      const result = test.results?.[0] || {};
      const status = result.status === 'passed' ? 'pass'
                   : result.status === 'skipped' ? 'skip'
                   : 'fail';
      const dur = result.duration || 0;
      const err = result.error?.message || result.error?.value || '';
      totalDuration += dur;
      if (status === 'pass') totalPass++;
      else if (status === 'fail') totalFail++;
      else totalSkip++;
      tests.push({
        name: spec.title,
        status,
        duration: dur,
        error: err.replace(/</g, '&lt;').replace(/>/g, '&gt;').slice(0, 400),
        retry: test.results?.length > 1,
      });
    }
  }

  // Recurse into child suites
  const children = [];
  for (const child of (suite.suites || [])) {
    children.push(...walkSuite(child, projectName));
  }

  if (tests.length > 0) {
    const pass = tests.filter(t => t.status === 'pass').length;
    const fail = tests.filter(t => t.status === 'fail').length;
    suites.push({ name: suiteName, project: projectName, tests, pass, fail });
  }
  return children;
}

for (const project of (raw.suites || [])) {
  const projectName = project.title;
  for (const suite of (project.suites || [])) {
    walkSuite(suite, projectName);
  }
}

const runDate = new Date().toLocaleString('en-IN', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
});
const totalTests = totalPass + totalFail + totalSkip;
const allPassed  = totalFail === 0;
const durSec     = (totalDuration / 1000).toFixed(1);
const durMin     = Math.floor(totalDuration / 60000);
const durRemSec  = ((totalDuration % 60000) / 1000).toFixed(0);
const durLabel   = durMin > 0 ? `${durMin}m ${durRemSec}s` : `${durSec}s`;

// ── Build HTML ─────────────────────────────────────────────────
const suiteBlocks = suites.map((s, si) => {
  const statusDot = s.fail > 0 ? '🔴' : '🟢';
  const rows = s.tests.map((t, ti) => {
    const badge = t.status === 'pass'
      ? '<span class="badge pass">PASS</span>'
      : t.status === 'skip'
      ? '<span class="badge skip">SKIP</span>'
      : '<span class="badge fail">FAIL</span>';
    const dur = t.duration >= 1000
      ? `${(t.duration / 1000).toFixed(1)}s`
      : `${t.duration}ms`;
    const retryBadge = t.retry ? '<span class="retry">retried</span>' : '';
    const errBlock = t.error
      ? `<div class="error-block"><pre>${t.error}</pre></div>`
      : '';
    return `
      <tr class="test-row ${t.status}" id="t-${si}-${ti}">
        <td class="td-badge">${badge}${retryBadge}</td>
        <td class="td-name">${t.name}</td>
        <td class="td-dur">${dur}</td>
      </tr>
      ${errBlock ? `<tr class="err-row"><td colspan="3">${errBlock}</td></tr>` : ''}`;
  }).join('');

  const suitePass = s.tests.filter(t => t.status === 'pass').length;
  const suiteFail = s.tests.filter(t => t.status === 'fail').length;
  const suiteSkip = s.tests.filter(t => t.status === 'skip').length;
  const suiteTotal = s.tests.length;
  const suiteDur = s.tests.reduce((a, t) => a + t.duration, 0);
  const suiteDurLabel = suiteDur >= 60000
    ? `${Math.floor(suiteDur/60000)}m ${((suiteDur%60000)/1000).toFixed(0)}s`
    : `${(suiteDur/1000).toFixed(1)}s`;

  return `
  <div class="suite ${s.fail > 0 ? 'suite-fail' : 'suite-pass'}" id="suite-${si}">
    <button class="suite-header" onclick="toggle(${si})">
      <span class="suite-dot">${statusDot}</span>
      <span class="suite-title">${s.project} › ${s.name}</span>
      <span class="suite-stats">
        <span class="stat-pass">${suitePass} passed</span>
        ${suiteFail > 0 ? `<span class="stat-fail">${suiteFail} failed</span>` : ''}
        ${suiteSkip > 0 ? `<span class="stat-skip">${suiteSkip} skipped</span>` : ''}
        <span class="stat-total">${suiteTotal} total</span>
        <span class="stat-dur">⏱ ${suiteDurLabel}</span>
      </span>
      <span class="chevron" id="chev-${si}">▼</span>
    </button>
    <div class="suite-body" id="body-${si}" style="display:none">
      <table class="test-table">
        <thead><tr><th>Status</th><th>Test</th><th>Duration</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}).join('');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Oakit Test Report — ${runDate}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         background: #f8fafc; color: #1e293b; }

  /* ── Header ── */
  .header { padding: 28px 32px 20px;
    background: ${allPassed ? 'linear-gradient(135deg,#064e3b,#065f46)' : 'linear-gradient(135deg,#7f1d1d,#991b1b)'};
    color: #fff; }
  .header h1 { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
  .header .sub { font-size: 13px; opacity: .75; margin-top: 4px; }
  .header .verdict { font-size: 28px; font-weight: 900; margin-top: 12px;
    display: flex; align-items: center; gap: 10px; }

  /* ── Stats bar ── */
  .stats-bar { display: flex; gap: 16px; flex-wrap: wrap;
    padding: 16px 32px; background: #fff;
    border-bottom: 1px solid #e2e8f0; }
  .stat-pill { display: flex; flex-direction: column; align-items: center;
    padding: 10px 20px; border-radius: 12px; min-width: 90px; }
  .stat-pill .num { font-size: 26px; font-weight: 900; line-height: 1; }
  .stat-pill .lbl { font-size: 11px; font-weight: 600; text-transform: uppercase;
    letter-spacing: .05em; margin-top: 3px; opacity: .7; }
  .sp-total  { background: #f1f5f9; }
  .sp-pass   { background: #d1fae5; color: #065f46; }
  .sp-fail   { background: #fee2e2; color: #991b1b; }
  .sp-skip   { background: #fef9c3; color: #854d0e; }
  .sp-dur    { background: #ede9fe; color: #4c1d95; }

  /* ── Links bar ── */
  .links-bar { padding: 12px 32px; background: #fff;
    border-bottom: 1px solid #e2e8f0; display: flex; gap: 12px; align-items: center; }
  .links-bar a { font-size: 13px; font-weight: 600; color: #2563eb;
    text-decoration: none; padding: 6px 14px; border-radius: 8px;
    border: 1.5px solid #bfdbfe; background: #eff6ff; }
  .links-bar a:hover { background: #dbeafe; }
  .links-bar .note { font-size: 12px; color: #64748b; }

  /* ── Suites ── */
  .suites { padding: 20px 32px; display: flex; flex-direction: column; gap: 10px; }
  .suite { border-radius: 14px; overflow: hidden; border: 1.5px solid #e2e8f0;
    box-shadow: 0 1px 4px rgba(0,0,0,.06); }
  .suite-pass { border-color: #a7f3d0; }
  .suite-fail { border-color: #fca5a5; }

  .suite-header { width: 100%; display: flex; align-items: center; gap: 10px;
    padding: 14px 18px; background: #fff; cursor: pointer; border: none;
    text-align: left; font-size: 14px; font-weight: 700; color: #1e293b;
    transition: background .15s; }
  .suite-pass .suite-header:hover { background: #f0fdf4; }
  .suite-fail .suite-header:hover { background: #fff1f2; }

  .suite-dot { font-size: 16px; flex-shrink: 0; }
  .suite-title { flex: 1; min-width: 0; }
  .suite-stats { display: flex; gap: 8px; flex-wrap: wrap; flex-shrink: 0; }
  .suite-stats span { font-size: 11px; font-weight: 700; padding: 2px 8px;
    border-radius: 20px; }
  .stat-pass  { background: #d1fae5; color: #065f46; }
  .stat-fail  { background: #fee2e2; color: #991b1b; }
  .stat-skip  { background: #fef9c3; color: #854d0e; }
  .stat-total { background: #f1f5f9; color: #475569; }
  .stat-dur   { background: #ede9fe; color: #4c1d95; }
  .chevron { font-size: 12px; color: #94a3b8; flex-shrink: 0; transition: transform .2s; }

  /* ── Test table ── */
  .suite-body { border-top: 1px solid #f1f5f9; }
  .test-table { width: 100%; border-collapse: collapse; }
  .test-table thead th { padding: 8px 16px; font-size: 11px; font-weight: 700;
    text-transform: uppercase; letter-spacing: .05em; color: #94a3b8;
    background: #f8fafc; text-align: left; }
  .test-row td { padding: 10px 16px; font-size: 13px; border-top: 1px solid #f1f5f9; }
  .test-row.pass { background: #fff; }
  .test-row.fail { background: #fff8f8; }
  .test-row.skip { background: #fffbeb; }
  .test-row:hover { background: #f8fafc; }
  .td-badge { width: 110px; }
  .td-name  { font-weight: 500; }
  .td-dur   { width: 80px; text-align: right; color: #64748b; font-size: 12px; }

  .badge { display: inline-block; padding: 2px 10px; border-radius: 20px;
    font-size: 11px; font-weight: 800; letter-spacing: .05em; }
  .badge.pass { background: #d1fae5; color: #065f46; }
  .badge.fail { background: #fee2e2; color: #991b1b; }
  .badge.skip { background: #fef9c3; color: #854d0e; }
  .retry { margin-left: 6px; font-size: 10px; color: #f59e0b;
    background: #fef3c7; padding: 1px 6px; border-radius: 10px; font-weight: 700; }

  .err-row td { padding: 0 16px 10px; }
  .error-block { background: #1e293b; border-radius: 8px; padding: 10px 14px;
    overflow-x: auto; }
  .error-block pre { color: #f87171; font-size: 11px; font-family: 'Courier New', monospace;
    white-space: pre-wrap; word-break: break-all; }

  /* ── Footer ── */
  .footer { padding: 20px 32px; text-align: center; font-size: 12px; color: #94a3b8; }
</style>
</head>
<body>

<div class="header">
  <h1>Oakit — Test Report</h1>
  <div class="sub">${runDate}</div>
  <div class="verdict">
    ${allPassed ? '✅ All Tests Passed' : `❌ ${totalFail} Test${totalFail !== 1 ? 's' : ''} Failed`}
  </div>
</div>

<div class="stats-bar">
  <div class="stat-pill sp-total">
    <span class="num">${totalTests}</span>
    <span class="lbl">Total</span>
  </div>
  <div class="stat-pill sp-pass">
    <span class="num">${totalPass}</span>
    <span class="lbl">Passed</span>
  </div>
  <div class="stat-pill sp-fail">
    <span class="num">${totalFail}</span>
    <span class="lbl">Failed</span>
  </div>
  <div class="stat-pill sp-skip">
    <span class="num">${totalSkip}</span>
    <span class="lbl">Skipped</span>
  </div>
  <div class="stat-pill sp-dur">
    <span class="num">${durLabel}</span>
    <span class="lbl">Duration</span>
  </div>
</div>

<div class="links-bar">
  <a href="index.html" target="_blank">📊 Full Playwright Report (screenshots &amp; traces)</a>
  <span class="note">Click any suite heading below to expand test details</span>
</div>

<div class="suites">
  ${suiteBlocks}
</div>

<div class="footer">
  Generated by Oakit Test Runner · ${runDate} · ${totalTests} tests across ${suites.length} suites
</div>

<script>
function toggle(i) {
  const body = document.getElementById('body-' + i);
  const chev = document.getElementById('chev-' + i);
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  chev.style.transform = open ? '' : 'rotate(180deg)';
}
// Auto-expand failed suites
document.querySelectorAll('.suite-fail').forEach((el, i) => {
  const idx = el.id.replace('suite-', '');
  const body = document.getElementById('body-' + idx);
  const chev = document.getElementById('chev-' + idx);
  if (body) { body.style.display = 'block'; chev.style.transform = 'rotate(180deg)'; }
});
</script>
</body>
</html>`;

fs.writeFileSync(OUT_FILE, html, 'utf8');
console.log(`\n✓ Summary report written to: ${OUT_FILE}`);
console.log(`  Total: ${totalTests} | Passed: ${totalPass} | Failed: ${totalFail} | Skipped: ${totalSkip} | Duration: ${durLabel}\n`);
