const fs=require('fs'),path=require('path');
const outDir='C:/Users/AQvir/.codex/sessions';
function walk(dir){ let res=[]; for(const e of fs.readdirSync(dir,{withFileTypes:true})){ const p=path.join(dir,e.name); if(e.isDirectory()) res=res.concat(walk(p)); else if(e.isFile()&&p.endsWith('.jsonl')) res.push(p);} return res; }
const files=walk(outDir);
console.log('total jsonl files:', files.length);
const byDate={};
for(const f of files){ const m=f.match(/sessions.(\d{4}.\d{2}.\d{2})/); const d=m?m[1]:'unknown'; byDate[d]=(byDate[d]||0)+1; }
console.log('byDate', JSON.stringify(byDate,null,2));
const sample=files.sort((a,b)=> fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
console.log('newest:', sample, fs.statSync(sample).size);
const lines=fs.readFileSync(sample,'utf8').split('\n').filter(Boolean);
console.log('lines in newest:', lines.length);
for(let i=0;i<Math.min(3,lines.length);i++){
  try{ const o=JSON.parse(lines[i]); console.log('--- line',i,'keys:',Object.keys(o).join(', ')); console.log(lines[i].slice(0,1500)); }catch(e){ console.log(lines[i].slice(0,800)); }
}
