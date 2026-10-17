const fs=require('fs'),path=require('path');
const sessionsDir='C:/Users/AQvir/.codex/sessions';
function walk(d){ let r=[]; for(const e of fs.readdirSync(d,{withFileTypes:true})){ const p=path.join(d,e.name); if(e.isDirectory()) r=r.concat(walk(p)); else if(p.endsWith('.jsonl')) r.push(p);} return r; }
const files=walk(sessionsDir);
let totalTokenEvents=0, totalResponseItems=0, totalTurnContexts=0;
let byType={};
let tokenByDate={};
for(const f of files){
  const txt=fs.readFileSync(f,'utf8');
  const lines=txt.split('\n').filter(Boolean);
  for(const l of lines){
    try{
      const o=JSON.parse(l);
      byType[o.type]=(byType[o.type]||0)+1;
      if(o.type==='response_item'){
        totalResponseItems++;
        // look for token_count
        const p=o.payload||{};
        // payload has? Check known structure
      }
      if(o.type==='event_msg'){
        const pt=o.payload && o.payload.type;
        if(pt) byType['event_msg:'+pt]=(byType['event_msg:'+pt]||0)+1;
        if(pt==='token_count'){
          totalTokenEvents++;
          const ts=o.timestamp? o.timestamp.slice(0,10): 'unknown';
          tokenByDate[ts]=(tokenByDate[ts]||0)+1;
        }
        if(pt==='turn_context') totalTurnContexts++;
      }
    }catch(e){}
  }
}
console.log('byType', JSON.stringify(byType,null,2));
console.log('tokenByDate', JSON.stringify(tokenByDate,null,2));
console.log('totals', {totalTokenEvents, totalResponseItems, totalTurnContexts, files:files.length});
