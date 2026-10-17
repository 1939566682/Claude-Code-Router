import fs from 'fs';
const p = 'D:/Github/claude-code-router/packages/core/src/observability/request-log-store.ts';
let t = fs.readFileSync(p, 'utf8');
const needle = 'function readDistinctValues(database: SqlDatabase, column: \ credential_id\ | \model\ | \provider\): string[] {';
const idx = t.indexOf(needle);
if (idx === -1) { console.log('needle not found'); process.exit(1); }
const end = t.indexOf('\n}\n', idx) + 2;
const oldFn = t.slice(idx, end);
console.log('oldFn preview', oldFn.slice(0,120).replace(/\n/g,'\\n'));
const newFn = unction readDistinctValues(database: SqlDatabase, column: \credential_id\ | \model\ | \provider\): string[] {
  if (column === \provider\) {
    const rows = queryRows(
      database,
      \
        SELECT provider AS raw
        FROM request_logs
        WHERE source_usage_id IS NULL AND path NOT LIKE ? AND provider <> '' AND provider <> 'unknown'
      \,
      [\%/count_tokens%\]
    );
    const seen = new Map<string, string>();
    for (const r of rows) {
      const raw = String((r as Record<string, unknown>).raw ?? \\).trim();
      if (!raw) continue;
      const base = raw.split(\::\)[0]?.trim() || raw;
      const key = base.toLowerCase();
      if (!seen.has(key)) seen.set(key, base);
    }
    return Array.from(seen.values()).sort((a,b)=> a.toLowerCase().localeCompare(b.toLowerCase())).slice(0,100);
  }
  return queryRows(
    database,
      \
        SELECT DISTINCT \ AS value
        FROM request_logs
        WHERE source_usage_id IS NULL AND path NOT LIKE ? AND \ <> '' AND \ <> 'unknown'
        ORDER BY \ COLLATE NOCASE ASC
        LIMIT 100
      \,
      [\%/count_tokens%\]
  )
    .map((row) => String(row.value ?? \\))
    .filter(Boolean);
};
if (t.includes(oldFn)) {
  t = t.replace(oldFn, newFn);
  fs.writeFileSync(p, t, 'utf8');
  console.log('patched provider distinct');
} else {
  console.log('oldFn not in t exact');
}
