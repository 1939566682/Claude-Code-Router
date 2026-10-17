const fs=require('fs');
const src='D:/Github/claude-code-router';
const db='C:/Users/AppData/Roaming/claude-code-router';
const paths=[
  'D:/Github/claude-code-router/packages/core/src/observability/raw-trace-sync.ts',
  'D:/Github/claude-code-router/packages/core/src/observability/request-log-store.ts',
  'D:/Github/claude-code-router/packages/core/src/gateway/gateway-service.ts',
  'D:/Github/claude-code-router/packages/core/src/observability/usage-store.ts',
];
for(const p of paths){
  console.log('=== '+(p.split('/').slice(-2).join('/'))+' ===');
  const t=fs.readFileSync(p,'utf8');
  console.log('lines:', t.split('\n').length, 'size:', t.length);
}
