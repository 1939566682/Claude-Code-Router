import pathlib
p = pathlib.Path(r"D:\Github\claude-code-router\packages\core\src\observability\request-log-store.ts")
t = p.read_text(encoding="utf-8")
old = """function readDistinctValues(database: SqlDatabase, column: \"credential_id\" | \"model\" | \"provider\"): string[] {
  return queryRows(
    database,
      \"""
        SELECT DISTINCT \ AS value
        FROM request_logs
        WHERE source_usage_id IS NULL AND path NOT LIKE ? AND \ <> '''' AND \ <> ''unknown''
        ORDER BY \ COLLATE NOCASE ASC
        LIMIT 100
      \",
      [\"%/count_tokens%\"]
  )
    .map((row) => String(row.value ?? \"\"))
    .filter(Boolean);
}"""
new = """function readDistinctValues(database: SqlDatabase, column: \"credential_id\" | \"model\" | \"provider\"): string[] {
  if (column === \"provider\") {
    const rows = queryRows(
      database,
      \"""
        SELECT provider AS raw
        FROM request_logs
        WHERE source_usage_id IS NULL AND path NOT LIKE ? AND provider <> '''' AND provider <> ''unknown''
      \",
      [\"%/count_tokens%\"]
    );
    const seen = new Map<string, string>();
    for (const r of rows) {
      const raw = String((r as Record<string, unknown>).raw ?? \"\").trim();
      if (!raw) continue;
      const base = raw.split(\"::\")[0]?.trim() || raw;
      const key = base.toLowerCase();
      if (!seen.has(key)) seen.set(key, base);
    }
    return Array.from(seen.values()).sort((a,b)=> a.toLowerCase().localeCompare(b.toLowerCase())).slice(0,100);
  }
  return queryRows(
    database,
      \"""
        SELECT DISTINCT \ AS value
        FROM request_logs
        WHERE source_usage_id IS NULL AND path NOT LIKE ? AND \ <> '''' AND \ <> ''unknown''
        ORDER BY \ COLLATE NOCASE ASC
        LIMIT 100
      \",
      [\"%/count_tokens%\"]
  )
    .map((row) => String(row.value ?? \"\"))
    .filter(Boolean);
}"""
if old in t:
    t = t.replace(old, new)
    p.write_text(t, encoding="utf-8")
    print("patched")
else:
    print("not found old")
    # debug
    idx = t.find("function readDistinctValues")
    print(repr(t[idx:idx+800]))
