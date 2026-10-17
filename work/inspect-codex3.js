const fs=require('fs'),path=require('path');
const sessionsDir='C:/Users/AQvir/.codex/sessions';
function walk(d){ let r=[]; for(const e of fs.readdirSync(d,{withFileTypes:true})){ const p=path.join(d,e.name); if(e.isDirectory()) r=r.concat(walk(p)); else if(p.endsWith('.jsonl')) r.push(p);} return r; }
const files=walk(sessionsDir);
let tokenCountLines=0, infoByDate={}, sampleToken=null, sampleTurn=null, sampleResp=null;
for(const f of files){
  const lines=fs.readFileSync(f,'utf8').split('\n').filter(Boolean);
  for(const l of lines){
    try{
      const o=JSON.parse(l);
      if(o.type==='event_msg' && o.payload && o.payload.type==='token_count'){
        tokenCountLines++;
        if(!sampleToken) sampleToken=l.slice(0,3000);
      }
      if(o.type==='turn_context' && !sampleTurn) sampleTurn=l.slice(0,3000);
      if(o.type==='response_item' && !sampleResp) sampleResp=l.slice(0,3000);
    }catch(e){}
  }
}
console.log('sample token_count:', sampleToken);
console.log('\n---\n');
console.log('sample turn_context:', sampleTurn);
console.log('\n---\n');
console.log('sample response_item:', sampleResp);
// also check one token_count in detail
const anyFile=files.find(f=> f.includes('2026-10-12'));
if(anyFile){
  const lines2=fs.readFileSync(anyFile,'utf8').split('\n').filter(Boolean);
  for(const l of lines2){
    try{
      const o=JSON.parse(l);
      if(o.type==='event_msg' && o.payload && o.payload.type==='token_count'){
        console.log('\n=== detailed token_count example ===');
        console.log(JSON.stringify(o,null,2).slice(0,4000));
        break;
      }
    }catch(e){}
  }
}
