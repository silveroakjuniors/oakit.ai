'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';

interface RowResult {
  rowIndex: number;
  rowData: Record<string, string>;
  txnValue: string;
  amtValue: string;
  txnFound: boolean;
  amtFound: boolean;
  bothFound: boolean;
  matchLine?: string;
}

// ── PDF extraction ────────────────────────────────────────────────────────────
async function extractPdfText(file: File, onPage?: (cur: number, total: number) => void): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it: any) => it.str).join(' ') + '\n';
    onPage?.(i, pdf.numPages);
  }
  return text;
}

// ── Matching logic (your improved version) ────────────────────────────────────
function normalize(val: string) {
  return val.replace(/[,₹\s]/g, '').toLowerCase();
}

function findMatchInSameLine(pdfText: string, txn: string, amt: string): string | null {
  const lines = pdfText.split('\n');
  const t = normalize(txn);
  const a = normalize(amt);
  for (const line of lines) {
    const l = normalize(line);
    if (t && a && l.includes(t) && l.includes(a)) return line;
  }
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ReconcilePage() {
  const [pdfFile, setPdfFile]   = useState<File | null>(null);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [pdfText, setPdfText]   = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfProgress, setPdfProgress] = useState('');   // e.g. "Page 3 / 12"
  const [excelLoading, setExcelLoading] = useState(false);

  const [rows, setRows]       = useState<Record<string, string>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [txnCol, setTxnCol]   = useState('');
  const [amtCol, setAmtCol]   = useState('');

  const [results, setResults] = useState<RowResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState<'all' | 'matched' | 'missing'>('all');
  const [expanded, setExpanded] = useState<number | null>(null);

  // ── Load PDF ────────────────────────────────────────────────────────────
  async function handlePdf(file: File) {
    setPdfFile(file);
    setPdfText('');
    setPdfLoading(true);
    setPdfProgress('Starting…');
    try {
      const text = await extractPdfText(file, (cur, total) => {
        setPdfProgress(`Page ${cur} of ${total}`);
      });
      setPdfText(text);
      setPdfProgress('');
    } catch {
      alert('PDF failed — make sure it is not a scanned image.');
      setPdfFile(null);
    } finally {
      setPdfLoading(false);
    }
  }

  // ── Load Excel ──────────────────────────────────────────────────────────
  function handleExcel(file: File) {
    setExcelFile(file);
    setColumns([]);
    setRows([]);
    setResults(null);
    setExcelLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target!.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        const headers: string[] = json[0].map((h: any) => String(h ?? '').trim()).filter(Boolean);
        const data = json.slice(1).map(row =>
          Object.fromEntries(headers.map((h, i) => [h, String(row[i] ?? '').trim()]))
        );
        setColumns(headers);
        setRows(data);
        setTxnCol(headers.find(h => /txn|transaction|ref|utr|narr/i.test(h)) ?? headers[0] ?? '');
        setAmtCol(headers.find(h => /amount|amt|debit|credit|withdrawal|deposit/i.test(h)) ?? headers[1] ?? '');
      } catch {
        alert('Could not read the Excel/CSV file.');
        setExcelFile(null);
      } finally {
        setExcelLoading(false);
      }
    };
    reader.onerror = () => { alert('File read error.'); setExcelLoading(false); };
    reader.readAsArrayBuffer(file);
  }

  // ── Run — chunked so progress bar updates ──────────────────────────────
  function run() {
    if (!pdfText || !rows.length || !txnCol || !amtCol) return;
    setRunning(true);
    setProgress(0);
    setResults(null);

    const CHUNK = 30;
    const out: RowResult[] = [];
    let i = 0;

    function processChunk() {
      const end = Math.min(i + CHUNK, rows.length);
      for (; i < end; i++) {
        const row = rows[i];
        const txn = row[txnCol] ?? '';
        const amt = row[amtCol] ?? '';
        const matchLine = findMatchInSameLine(pdfText, txn, amt);
        const txnFound = normalize(txn) !== '' && normalize(pdfText).includes(normalize(txn));
        const amtFound = normalize(amt) !== '' && normalize(pdfText).includes(normalize(amt));
        out.push({
          rowIndex: i + 2,
          rowData: row,
          txnValue: txn,
          amtValue: amt,
          txnFound,
          amtFound,
          bothFound: !!matchLine,
          matchLine: matchLine ?? undefined,
        });
      }
      setProgress(Math.round((Math.min(i, rows.length) / rows.length) * 100));
      if (i < rows.length) {
        setTimeout(processChunk, 0);
      } else {
        setResults(out);
        setRunning(false);
        setProgress(100);
      }
    }
    setTimeout(processChunk, 0);
  }

  // ── Export ──────────────────────────────────────────────────────────────
  function exportXlsx(type: 'all' | 'missing') {
    if (!results) return;
    const data = (type === 'missing' ? results.filter(r => !r.bothFound) : results).map(r => ({
      Row: r.rowIndex,
      Status: r.bothFound ? 'Matched' : 'Not Matched',
      [txnCol]: r.txnValue,
      [`${txnCol} in PDF`]: r.txnFound ? 'Yes' : 'No',
      [amtCol]: r.amtValue,
      [`${amtCol} in PDF`]: r.amtFound ? 'Yes' : 'No',
      'Matched Line': r.matchLine ?? '',
      ...r.rowData,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, type === 'missing' ? 'Not Matched' : 'All');
    XLSX.writeFile(wb, `reconcile_${type}.xlsx`);
  }

  // ── Derived stats ────────────────────────────────────────────────────────
  const total   = results?.length ?? 0;
  const matched = results?.filter(r => r.bothFound).length ?? 0;
  const missing = total - matched;

  const filtered = (results ?? []).filter(r => {
    if (filter === 'matched' && !r.bothFound) return false;
    if (filter === 'missing' && r.bothFound) return false;
    if (search) {
      const s = search.toLowerCase();
      return r.txnValue.toLowerCase().includes(s) || r.amtValue.toLowerCase().includes(s);
    }
    return true;
  });

  const pdfReady   = !!pdfText && !pdfLoading;
  const excelReady = rows.length > 0;
  const canRun     = pdfReady && excelReady && !!txnCol && !!amtCol && !running;

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', padding: '2rem', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#111827', margin: 0 }}>Bank Statement Reconciler</h1>
          <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>
            Upload PDF + Excel, map columns, then compare transaction numbers &amp; amounts
          </p>
        </div>

        {/* ── Upload row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <FileZone
            label="PDF Bank Statement"
            accept=".pdf"
            file={pdfFile}
            loading={pdfLoading}
            ready={pdfReady}
            hint={pdfReady ? `${pdfText.length.toLocaleString()} chars extracted` : pdfLoading ? pdfProgress : ''}
            onFile={handlePdf}
          />
          <FileZone
            label="Excel / CSV"
            accept=".xlsx,.xls,.csv"
            file={excelFile}
            loading={excelLoading}
            ready={excelReady}
            hint={excelReady ? `${rows.length} rows, ${columns.length} columns` : excelLoading ? 'Parsing rows…' : ''}
            onFile={handleExcel}
          />
        </div>

        {/* ── Column mapping + Run ── */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 20, marginBottom: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>
            Map Columns &amp; Run
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Transaction No. / Reference
              </label>
              <select value={txnCol} onChange={e => { setTxnCol(e.target.value); setResults(null); }}
                disabled={!excelReady}
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 10, padding: '8px 12px', fontSize: 13, color: '#111827', background: excelReady ? '#fff' : '#f9fafb' }}>
                {columns.length === 0
                  ? <option>— upload Excel first —</option>
                  : columns.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Amount
              </label>
              <select value={amtCol} onChange={e => { setAmtCol(e.target.value); setResults(null); }}
                disabled={!excelReady}
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 10, padding: '8px 12px', fontSize: 13, color: '#111827', background: excelReady ? '#fff' : '#f9fafb' }}>
                {columns.length === 0
                  ? <option>— upload Excel first —</option>
                  : columns.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Checklist */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {[
              { ok: pdfReady,   label: 'PDF loaded' },
              { ok: excelReady, label: 'Excel loaded' },
              { ok: !!txnCol,   label: 'Txn column' },
              { ok: !!amtCol,   label: 'Amount column' },
            ].map(({ ok, label }) => (
              <span key={label} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                background: ok ? '#dcfce7' : '#f3f4f6',
                color: ok ? '#065f46' : '#6b7280',
                border: `1px solid ${ok ? '#86efac' : '#e5e7eb'}`,
              }}>
                {ok ? '✓' : '○'} {label}
              </span>
            ))}
          </div>

          {/* Run button */}
          <button
            onClick={run}
            disabled={!canRun}
            style={{
              width: '100%', padding: '12px 0', borderRadius: 12, border: 'none',
              fontSize: 14, fontWeight: 700, cursor: canRun ? 'pointer' : 'not-allowed',
              background: canRun ? '#111827' : '#e5e7eb',
              color: canRun ? '#fff' : '#9ca3af',
              transition: 'all 0.15s',
            }}
          >
            {running ? `Comparing… ${progress}%` : results ? '↺ Re-run' : '▶ Compare Now'}
          </button>

          {/* Progress bar */}
          {(running || (results && progress === 100)) && (
            <div style={{ marginTop: 10, height: 6, background: '#f3f4f6', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 999,
                background: running ? '#111827' : '#22c55e',
                width: `${progress}%`,
                transition: 'width 0.2s ease',
              }} />
            </div>
          )}
          {results && !running && (
            <p style={{ fontSize: 12, color: '#6b7280', marginTop: 6, textAlign: 'center' }}>
              Done — {total} rows checked
            </p>
          )}
        </div>

        {/* ── Summary cards ── */}
        {results && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total Rows',  value: total,   bg: '#f3f4f6', color: '#111827', f: 'all'     },
              { label: '✓ Matched',   value: matched, bg: '#dcfce7', color: '#065f46', f: 'matched' },
              { label: '✗ Not Found', value: missing, bg: '#fee2e2', color: '#991b1b', f: 'missing' },
            ].map(s => (
              <button key={s.label} onClick={() => setFilter(s.f as any)}
                style={{
                  background: s.bg, border: filter === s.f ? `2px solid ${s.color}` : '2px solid transparent',
                  borderRadius: 14, padding: '16px 12px', cursor: 'pointer', textAlign: 'center',
                  transition: 'all 0.15s',
                }}>
                <div style={{ fontSize: 32, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: s.color, opacity: 0.7, marginTop: 4 }}>{s.label}</div>
              </button>
            ))}
          </div>
        )}

        {/* ── Results table ── */}
        {results && (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, overflow: 'hidden' }}>

            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid #f3f4f6', flexWrap: 'wrap' }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search transaction or amount…"
                style={{ flex: 1, minWidth: 180, border: '1px solid #e5e7eb', borderRadius: 10, padding: '7px 12px', fontSize: 13, outline: 'none' }}
              />
              <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                {(['all', 'matched', 'missing'] as const).map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    style={{
                      padding: '6px 14px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                      background: filter === f ? '#111827' : '#fff',
                      color: filter === f ? '#fff' : '#6b7280',
                      textTransform: 'capitalize',
                    }}>
                    {f}
                  </button>
                ))}
              </div>
              <button onClick={() => exportXlsx('missing')}
                style={{ padding: '6px 12px', fontSize: 12, fontWeight: 700, background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 8, cursor: 'pointer' }}>
                Export Missing
              </button>
              <button onClick={() => exportXlsx('all')}
                style={{ padding: '6px 12px', fontSize: 12, fontWeight: 700, background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer' }}>
                Export All
              </button>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>{filtered.length} rows</span>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
                    {['#', 'Status', txnCol, amtCol, 'Matched Line'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={5} style={{ padding: '40px 14px', textAlign: 'center', color: '#d1d5db', fontSize: 13 }}>No rows match</td></tr>
                  )}
                  {filtered.map(r => (
                    <>
                      <tr
                        key={r.rowIndex}
                        onClick={() => setExpanded(expanded === r.rowIndex ? null : r.rowIndex)}
                        style={{
                          background: r.bothFound ? '#f0fdf4' : '#fff5f5',
                          borderBottom: '1px solid #f3f4f6',
                          cursor: 'pointer',
                        }}
                      >
                        <td style={{ padding: '10px 14px', color: '#9ca3af', fontSize: 12 }}>{r.rowIndex}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{
                            display: 'inline-block', padding: '2px 10px', borderRadius: 999,
                            fontSize: 11, fontWeight: 700,
                            background: r.bothFound ? '#dcfce7' : '#fee2e2',
                            color: r.bothFound ? '#065f46' : '#991b1b',
                          }}>
                            {r.bothFound ? '✓ Matched' : '✗ Not Found'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.txnFound ? '#22c55e' : '#f87171', flexShrink: 0 }} />
                            <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.txnValue || '—'}</span>
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.amtFound ? '#22c55e' : '#f87171', flexShrink: 0 }} />
                            <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.amtValue || '—'}</span>
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 11, color: '#6b7280', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.matchLine ?? <span style={{ color: '#d1d5db' }}>—</span>}
                        </td>
                      </tr>

                      {/* Expanded detail */}
                      {expanded === r.rowIndex && (
                        <tr key={`${r.rowIndex}-exp`} style={{ background: r.bothFound ? '#f0fdf4' : '#fff5f5' }}>
                          <td colSpan={5} style={{ padding: '8px 20px 16px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                              <DetailBox label={`${txnCol} in PDF`} found={r.txnFound} value={r.txnValue} />
                              <DetailBox label={`${amtCol} in PDF`} found={r.amtFound} value={r.amtValue} />
                            </div>
                            {r.matchLine && (
                              <div style={{ marginTop: 10, padding: '8px 12px', background: '#fefce8', border: '1px solid #fde047', borderRadius: 8, fontSize: 11, fontFamily: 'monospace', color: '#713f12', wordBreak: 'break-all' }}>
                                <strong>Matched line:</strong> {r.matchLine}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── FileZone ──────────────────────────────────────────────────────────────────
function FileZone({ label, accept, file, loading, ready, hint, onFile }: {
  label: string; accept: string; file: File | null;
  loading?: boolean; ready?: boolean; hint?: string; onFile: (f: File) => void;
}) {
  const [drag, setDrag] = useState(false);
  const id = `fz-${label.replace(/\W+/g, '')}`;

  const borderColor = drag ? '#6b7280' : ready ? '#4ade80' : file && loading ? '#f59e0b' : '#d1d5db';
  const bgColor     = drag ? '#f9fafb' : ready ? '#f0fdf4' : file && loading ? '#fffbeb' : '#fff';

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
      style={{
        borderRadius: 16, border: `2px dashed ${borderColor}`,
        background: bgColor, transition: 'all 0.2s', minHeight: 160,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 10, padding: '28px 20px',
        textAlign: 'center', userSelect: 'none', position: 'relative',
      }}
    >
      {/* Actual clickable label sits on top but doesn't cover content */}
      <label htmlFor={id} style={{
        position: 'absolute', inset: 0, cursor: 'pointer', borderRadius: 14,
      }} />
      <input
        id={id} type="file" accept={accept}
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) { onFile(f); e.target.value = ''; } }}
      />

      {/* State: loading */}
      {loading && (
        <>
          <Spinner />
          <p style={{ fontSize: 13, fontWeight: 700, color: '#92400e', margin: 0 }}>
            {accept.includes('pdf') ? '📄 Reading PDF pages…' : '📊 Parsing Excel…'}
          </p>
          <p style={{ fontSize: 11, color: '#b45309', margin: 0 }}>{file?.name}</p>
        </>
      )}

      {/* State: ready */}
      {!loading && ready && (
        <>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>✓</div>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0 }}>{label}</p>
          <p style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, margin: 0, wordBreak: 'break-all', maxWidth: '100%' }}>{file?.name}</p>
          {hint && <p style={{ fontSize: 11, color: '#4ade80', margin: 0 }}>{hint}</p>}
          <p style={{ fontSize: 11, color: '#86efac', margin: 0 }}>Click to replace</p>
        </>
      )}

      {/* State: idle */}
      {!loading && !ready && (
        <>
          <div style={{ fontSize: 32 }}>{accept.includes('pdf') ? '📄' : '📊'}</div>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0 }}>{label}</p>
          <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>Click to browse or drag &amp; drop</p>
          <p style={{ fontSize: 11, color: '#d1d5db', margin: 0 }}>{accept}</p>
        </>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ width: 28, height: 28, border: '3px solid #e5e7eb', borderTopColor: '#111827', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function DetailBox({ label, found, value }: { label: string; found: boolean; value: string }) {
  return (
    <div style={{ padding: 10, borderRadius: 8, border: `1px solid ${found ? '#86efac' : '#fca5a5'}`, background: found ? '#f0fdf4' : '#fff5f5' }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: found ? '#065f46' : '#991b1b', margin: '0 0 4px' }}>
        {found ? '✓' : '✗'} {label}
      </p>
      <p style={{ fontSize: 12, fontFamily: 'monospace', color: '#374151', margin: 0 }}>{value || '—'}</p>
    </div>
  );
}
