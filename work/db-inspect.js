const Database=require('better-sqlite3');
const path=require('path');
const raw='C:/Users/AQvir/AppData/Roaming/claude-code-router';
function open(p){ try{ return new Database(path.join(raw,p),{readonly:true}); }catch(e){ console.log('open fail',p,e.message); return null;}}
let db=open('request-logs.sqlite');
if(db){
  console.log('request_logs count', db.prepare('SELECT count(*) as c FROM request_logs').get());
  console.log('by date', db.prepare("SELECT substr(created_at,1,10) as d, count(*) as c FROM request_logs GROUP BY d ORDER BY d").all());
  console.log('migrations', db.prepare('SELECT migration, completed, last_id FROM request_log_schema_migrations').all());
  console.log('raw_trace_events', db.prepare('SELECT count(*) as c FROM request_log_raw_trace_events').get());
  console.log('raw_trace by bundle<>request', db.prepare('SELECT count(*) as c FROM request_log_raw_trace_events WHERE bundle_id<>request_id').get());
  console.log('raw_trace sample', db.prepare('SELECT bundle_id, request_id, length(bundle_id) as bl, length(request_id) as rl, processed_at FROM request_log_raw_trace_events WHERE bundle_id<>request_id LIMIT 3').all());
  // check request_logs sample
  console.log('request_logs sample 3', db.prepare('SELECT id, request_id, substr(created_at,1,16) as ca, model, status_code FROM request_logs ORDER BY id DESC LIMIT 3').all());
  // usage
  db.close();
}
let db2=open('usage.sqlite');
if(db2){
  console.log('usage_events', db2.prepare('SELECT count(*) as c FROM usage_events').get());
  console.log('usage by date', db2.prepare("SELECT substr(created_at,1,10) as d, count(*) FROM usage_events GROUP BY d ORDER BY d").all());
  db2.close();
}
