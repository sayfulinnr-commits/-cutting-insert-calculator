(() => {
  'use strict';
  const KEY='cutcalc_v5';
  const OLD_KEYS=['cutcalc_v4','cutcalc_v3'];
  const $=id=>document.getElementById(id);
  const n=v=>{if(v===null||v===undefined||String(v).trim()==='')return NaN;const x=Number(String(v).replace(',','.'));return Number.isFinite(x)?x:NaN};
  const positiveInt=v=>Number.isInteger(v)&&v>0;
  const esc=x=>String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const fmt=x=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:3}).format(x);
  function normalizeTool(t,i){
    const edges=n(t?.edges??t?.cuttingEdges??t?.edgeCount),moq=n(t?.moq??t?.minimumOrder??t?.minOrder),pack=n(t?.packSize??t?.packageMultiple??t?.orderMultiple);
    return {...t,id:t?.id||`legacy_tool_${i+1}`,article:String(t?.article??t?.sku??t?.code??'').trim(),nameRu:t?.nameRu||t?.name||t?.type||t?.article||t?.sku||'Инструмент',mfr:t?.mfr||t?.manufacturer||'',grade:t?.grade||t?.quality||'',material:t?.material||'',edges:positiveInt(edges)?edges:4,moq:positiveInt(moq)?moq:1,packSize:positiveInt(pack)?pack:1,price:Number.isFinite(n(t?.price))?n(t.price):0};
  }
  function read(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
  function migrate(){
    const current=read(KEY)||{};
    const legacy=OLD_KEYS.map(read).find(x=>x&&typeof x==='object');
    const currentTools=Array.isArray(current.tools)?current.tools:[];
    const legacyTools=Array.isArray(legacy?.tools)?legacy.tools:[];
    const byArticle=new Map();
    [...legacyTools,...currentTools].forEach((t,i)=>{const x=normalizeTool(t,i);const key=(x.article||x.id).toLowerCase();if(!byArticle.has(key)||!byArticle.get(key).article)byArticle.set(key,x)});
    current.tools=[...byArticle.values()];
    for(const k of ['history','details','machines','setupSheets','setupVersions'])current[k]=Array.isArray(current[k])?current[k]:(Array.isArray(legacy?.[k])?legacy[k]:[]);
    current.schemaVersion=5;
    localStorage.setItem(KEY,JSON.stringify(current));
    return current;
  }
  function db(){return read(KEY)||migrate()||{tools:[]}}
  function errors(rows){
    const out=[],qty=n($('qty')?.value),safety=n($('safety')?.value),seen=new Map();
    if(!positiveInt(qty))out.push('Серия: укажите целое число больше нуля.');
    if(!Number.isFinite(safety)||safety<0)out.push('Страховой запас: укажите число не меньше нуля.');
    rows.forEach(r=>{const w=`Операция ${r.operation}, проход ${r.pass}`;if(!r.tool){out.push(`${w}: выберите инструмент.`);return}if(!positiveInt(r.tool.edges))out.push(`${w}: некорректное число кромок.`);if(!positiveInt(r.activeInserts))out.push(`${w}: активных пластин должно быть целым числом > 0.`);if(!positiveInt(r.series))out.push(`${w}: серия должна быть целым числом > 0.`);if(r.mode==='edge'&&!(r.partsPerEdge>0))out.push(`${w}: деталей на одну кромку должно быть > 0.`);if(r.mode==='parts'&&!(r.edgesPerPart>0))out.push(`${w}: кромок на деталь должно быть > 0.`);const key=[r.tool.article,r.tool.mfr||'',r.tool.grade||''].map(x=>String(x).trim().toLowerCase()).join('|');const old=seen.get(key);if(old&&old.tool.edges!==r.tool.edges)out.push(`Артикул «${r.tool.article}»: конфликт количества кромок (${old.tool.edges} и ${r.tool.edges}).`);else if(!old)seen.set(key,r)});
    return out;
  }
  function collect(){const global=n($('qty')?.value),D=db(),rows=[];document.querySelectorAll('.operation').forEach((op,oi)=>{const name=op.querySelector('.op-name')?.value.trim()||`Операция ${oi+1}`;op.querySelectorAll('.pass').forEach((p,pi)=>{const raw=p.querySelector('.series')?.value??'',series=String(raw).trim()===''?global:n(raw),id=p.querySelector('.tool')?.value,tool=D.tools.find(t=>t.id===id);rows.push({operation:oi+1,operationName:name,pass:pi+1,tool,activeInserts:n(p.querySelector('.active-inserts')?.value),series,mode:p.querySelector('.consumption-mode')?.value||'edge',partsPerEdge:n(p.querySelector('.parts-edge')?.value),edgesPerPart:n(p.querySelector('.edges-part')?.value)})})});return rows}
  function calculate(){migrate();const rows=collect(),errs=errors(rows);$('calcErrors').innerHTML=errs.map(x=>`<div class="error">${esc(x)}</div>`).join('');if(errs.length){$('resultStatus').textContent='Ошибка ввода';window.__cutcalcLastPurchase=[];return null}const safety=n($('safety').value),groups=new Map();rows.forEach(r=>{const epp=r.mode==='edge'?1/r.partsPerEdge:r.edgesPerPart,use=r.series*epp*r.activeInserts,key=[r.tool.article,r.tool.mfr||'',r.tool.grade||''].map(x=>String(x).trim().toLowerCase()).join('|');if(!groups.has(key))groups.set(key,{tool:r.tool,edgeUse:0,passes:[]});const g=groups.get(key);g.edgeUse+=use;g.passes.push({...r,epp,use})});const purchase=[...groups.values()].map(g=>{const e=g.tool.edges,withSafety=g.edgeUse*(1+safety/100),base=Math.ceil(g.edgeUse/e),reserve=Math.ceil(withSafety/e),moq=g.tool.moq,pack=g.tool.packSize,min=Math.max(reserve,moq),buy=Math.ceil(min/pack)*pack;return {...g,needWithSafety:withSafety,base,reserve,moq,pack,buy,unusedEdges:buy*e-withSafety,price:n(g.tool.price)||0}});window.__cutcalcLastPurchase=purchase;render(purchase,safety);return purchase}
  function render(p,safety){const total=p.reduce((s,x)=>s+x.buy,0),cost=p.reduce((s,x)=>s+x.buy*x.price,0);$('resultStatus').textContent='Расчёт готов';$('summary').innerHTML=[['Закупочных позиций',p.length],['Пластин к закупке',total],['Страховой запас',`${fmt(safety)} %`],['Стоимость',cost?`${fmt(cost)} ₽`:'не задана']].map((x,i)=>`<div class="metric ${i===1?'highlight':''}">${x[0]}<b>${x[1]}</b></div>`).join('');$('resultDetails').innerHTML=p.length?p.map(g=>`<div class="purchase-row"><div class="purchase-grid"><div class="purchase-main"><b>${esc(g.tool.article)}</b><div class="small">${esc(g.tool.nameRu)} · ${esc(g.tool.mfr||'')} · ${esc(g.tool.grade||'')}</div></div><div><div class="small">Расход</div><b>${fmt(g.edgeUse)} кромок</b></div><div><div class="small">С запасом</div><b>${fmt(g.needWithSafety)}</b></div><div><div class="small">База / резерв</div><b>${g.base} / ${g.reserve} шт.</b></div><div><div class="small">MOQ / упаковка</div><b>${g.moq} / ${g.pack}</b></div><div><span class="badge">${g.buy} шт.</span></div></div><div class="small" style="margin-top:10px">Проходы: ${g.passes.map(x=>`№${x.operation}.${x.pass}`).join(', ')}</div></div>`).join(''):'<div class="empty">После расчёта здесь появится сводная закупка.</div>'}
  }
  function repairControls(){
    const addOp=$('addOperation');if(addOp&&typeof window.addOperation==='function')addOp.onclick=e=>{e.preventDefault();window.addOperation({})};
    document.querySelectorAll('.add-pass').forEach(btn=>{const op=btn.closest('.operation');if(op&&typeof window.addPass==='function')btn.onclick=e=>{e.preventDefault();window.addPass(op,{})}});
  }
  migrate();
  window.calculate=calculate;
  window.__cutcalcPatch={calculate,migrate,repairControls};
  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{repairControls();const calc=$('calculate');if(calc)calc.onclick=calculate;},100));
})();