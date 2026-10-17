const fs=require('fs'),path=require('path');
const dir='C:/Users/AQvir/.codex/sessions';
function walk(d){let r=[];for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name); if(e.isDirectory()) r=r.concat(walk(p)); else if(p.endsWith('.jsonl')) r.push(p);}return r;}
const files=walk(dir);
// Count HTTP requests: How Codex tracks LLM calls?
// In new format, token_count is emitted per turn, not per HTTP request.
// Check for raw events, wire_api
let apiHits={};
for(const f of files.slice(0,3)){
  const lines=fs.readFileSync(f,'utf8').split('\n').filter(Boolean);
  for(const l of lines){
    const o=JSON.parse(l);
    const txt=l.slice(0,800);
    if(txt.includes('wire_api')||txt.includes('/v1/responses')||txt.includes('/v1/chat')){
      console.log(txt.slice(0,1000));
    }
  }
}
console.log('done scan first 3 files for wire_api');
// Let's look at session_meta payload for model_provider details
for(const f of files.slice(0,2)){
  const lines=fs.readFileSync(f,'utf8').split('\n').filter(Boolean);
  for(const l of lines){
    const o=JSON.parse(l);
    if(o.type==='session_meta'){
      console.log(JSON.stringify(o.payload,null,2).slice(0,2500));
      break;
    }
  }
}
