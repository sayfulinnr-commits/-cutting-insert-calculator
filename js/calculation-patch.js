(() => {
  'use strict';
  const KEY='cutcalc_v5';
  const $=id=>document.getElementById(id);
  const toNum=v=>{if(v===null||v===undefined||String(v).trim()==='')return NaN;const n=Number(String(v).replace(',','.'));return Number.isFinite(n)?n:NaN};
  const fmt=x=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:3}).format(x);
  const esc=x=>String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const integerPositive=(v)=>Number.isInteger(v)&&v>0;
  function readDB(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}}
  function normalizeTool(t,i){
    const article=String(t?.article??t?.sku??t?.code??'').trim();
    const edges=toNum(t?.edges??t?.cuttingEdges??t?.edgeCount);
    const moq=toNum(t?.moq??t?.minimumOrder??t?.minOrder);
    const pack=toNum(t?.packSize??t?.packageMultiple??t?.orderMultiple);
    return {...t,id:t?.id||`legacy_tool_${i+1}`,article,nameRu:t?.nameRu||t?.name||t?.type||article,mfr:t?.mfr||t?.manufacturer||'',grade:t?.grade||t?.quality||'',material:t?.material||'',edges:integerPositive(edges)?edges:4,moq:integerPositive(moq)?moq:1,packSize:integerPositive(pack)?pack:1,price:Number.isFinite(toNum(t?.price))?toNum(t.price):0};
  }
  function migrate(){
    const d=readDB();
    if(!d||typeof d!=='object')return;
    const tools=Array.isArray(d.tools)?d.tools.map(normalizeTool):[];
    d.tools=tools;d.history=Array.isArray(d.history)?d.history:[];d.details=Array.isArray(d.details)?d.details:[];d.machines=Array.isArray(d.machines)?d.machines:[];d.setupSheets=Array.isArray(d.setupSheets)?d.setupSheets:[];d.setupVersions=Array.isArray(d.setupVersions)?d.setupVersions:[];d.schemaVersion=5;
    localStorage.setItem(KEY,JSON.stringify(d));
  }
  function errorList(rows){
    const out=[];const qty=toNum($('qty')?.value), safety=toNum($('safety')?.value);
    if(!integerPositive(qty))out.push('Серия: укажите целое число больше нуля.');
    if(!Number.isFinite(safety)||safety<0)out.push('Страховой запас: укажите число не меньше нуля.');
    const keys=new Map();
    rows.forEach(r=>{
      const where=`Операция ${r.operation}, проход ${r.pass}`;
      if(!r.tool){out.push(`${where}: выберите инструмент.`);return;}
      if(!integerPositive(r.tool.edges))out.push(`${where}: у инструмента некорректное число кромок.`);
      if(!integerPositive(r.activeInserts))out.push(`${where}: активных пластин должно быть целым числом > 0.`);
      if(!integerPositive(r.series))out.push(`${where}: серия должна быть целым числом > 0.`);
      if(r.mode==='edge'&&!(r.partsPerEdge>0))out.push(`${where}: деталей на одну кромку должно быть > 0.`);
      if(r.mode==='parts'&&!(r.edgesPerPart>0))out.push(`${where}: кромок на деталь должно быть > 0.`);
      const key=[r.tool.article,r.tool.mfr||'',r.tool.grade||''].map(x=>String(x).trim().toLowerCase()).join('|');
      const old=keys.get(key);
      if(old&&old.tool.edges!==r.tool.edges)out.push(`Конфликт закупочной позиции «${r.tool.article}»: в разных проходах указано разное число кромок (${old.tool.edges} и ${r.tool.edges}). Расчёт остановлен.`);
      else if(!old)keys.set(key,r);
    });
    return out;
  }
  function collect(){
    const globalSeries=toNum($('qty')?.value),rows=[];
    document.querySelectorAll('.operation').forEach((op,oi)=>{
      const name=op.querySelector('.op-name')?.value.trim()||`Операция ${oi+1}`;
      op.querySelectorAll('.pass').forEach((pass,pi)=>{
        const rawSeries=pass.querySelector('.series')?.value??'';
        const series=String(rawSeries).trim()===''?globalSeries:toNum(rawSeries);
        const id=pass.querySelector('.tool')?.value;
        const db=readDB(),tool=(db.tools||[]).find(t=>t.id===id);
        rows.push({operation:oi+1,operationName:name,pass:pi+1,tool,activeInserts:toNum(pass.querySelector('.active-inserts')?.value),series,mode:pass.querySelector('.consumption-mode')?.value||'edge',partsPerEdge:toNum(pass.querySelector('.parts-edge')?.value),edgesPerPart:toNum(pass.querySelector('.edges-part')?.value)});
      });
    });
    return rows;
  }
  function patchedCalculate(){
    migrate();const db=readDB(),rows=collect(),errors=errorList(rows),box=$('calcErrors');
    if(box)box.innerHTML=errors.map(x=>`<div class="error">${esc(x)}</div>`).join('');
    if(errors.length){$('resultStatus').textContent='Ошибка ввода';window.__cutcalcLastPurchase=[];return null;}
    const safety=toNum($('safety').value),groups=new Map();
    rows.forEach(r=>{
      const edgesPerPart=r.mode==='edge'?1/r.partsPerEdge:r.edgesPerPart;
      const edgeUse=r.series*edgesPerPart*r.activeInserts;
      const key=[r.tool.article,r.tool.mfr||'',r.tool.grade||''].map(x=>String(x).trim().toLowerCase()).join('|');
      if(!groups.has(key))groups.set(key,{tool:r.tool,edgeUse:0,passes:[]});
      const g=groups.get(key);g.edgeUse+=edgeUse;g.passes.push({...r,edgesPerPart,edgeUse});
    });
    const purchase=[...groups.values()].map(g=>{
      const edges=g.tool.edges,withSafety=g.edgeUse*(1+safety/100),base=Math.ceil(g.edgeUse/edges),reserve=Math.ceil(withSafety/edges),moq=g.tool.moq,pack=g.tool.packSize,minOrder=Math.max(reserve,moq),buy=Math.ceil(minOrder/pack)*pack;
      return {...g,needWithSafety:withSafety,base,reserve,moq,pack,buy,unusedEdges:buy*edges-withSafety,price:toNum(g.tool.price)||0};
    });
    window.__cutcalcLastPurchase=purchase;window.__cutcalcRows=rows;
    render(purchase,safety);return purchase;
  }
  function render(purchase,safety){
    const total=purchase.reduce((s,x)=>s+x.buy,0),cost=purchase.reduce((s,x)=>s+x.buy*x.price,0);
    $('resultStatus').textContent='Расчёт готов';
    $('summary').innerHTML=[['Закупочных позиций',purchase.length],['Пластин к закупке',total],['Страховой запас',`${fmt(safety)} %`],['Стоимость',cost?`${fmt(cost)} ₽`:'не задана']].map((x,i)=>`<div class="metric ${i===1?'highlight':''}">${x[0]}<b>${x[1]}</b></div>`).join('');
    $('resultDetails').innerHTML=purchase.length?purchase.map(g=>`<div class="purchase-row"><div class="purchase-grid"><div class="purchase-main"><b>${esc(g.tool.article)}</b><div class="small">${esc(g.tool.nameRu)} · ${esc(g.tool.mfr||'')} · ${esc(g.tool.grade||'')}</div></div><div><div class="small">Расход</div><b>${fmt(g.edgeUse)} кромок</b></div><div><div class="small">С запасом</div><b>${fmt(g.needWithSafety)}</b></div><div><div class="small">База / резерв</div><b>${g.base} / ${g.reserve} шт.</b></div><div><div class="small">MOQ / упаковка</div><b>${g.moq} / ${g.pack}</b></div><div><span class="badge">${g.buy} шт.</span></div></div><div class="small" style="margin-top:10px">Проходы: ${g.passes.map(x=>`№${x.operation}.${x.pass}`).join(', ')} · остаток после запаса: ${fmt(g.unusedEdges)} кромок</div></div>`).join(''):'<div class="empty">После расчёта здесь появится сводная закупка.</div>';
  }
  function rowsForExport(){const p=window.__cutcalcLastPurchase?.length?window.__cutcalcLastPurchase:patchedCalculate();if(!p)return null;return p.map(g=>({Артикул:g.tool.article,Инструмент:g.tool.nameRu,Производитель:g.tool.mfr||'',Марка:g.tool.grade||'',Расход_кромок:g.edgeUse,Потребность_с_запасом:g.needWithSafety,Базово_шт:g.base,С_запасом_шт:g.reserve,MOQ:g.moq,Упаковка:g.pack,К_закупке:g.buy,Цена:g.price,Сумма:g.buy*g.price,Проходы:g.passes.map(x=>`${x.operation}.${x.pass}`).join(', ')}));}
  function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
  function csv(){const rows=rowsForExport();if(!rows)return;const h=Object.keys(rows[0]),q=v=>`"${String(v??'').replaceAll('"','""')}"`;download(new Blob(['\ufeff'+h.join(';')+'\n'+rows.map(r=>h.map(k=>q(r[k])).join(';')).join('\n')],{type:'text/csv;charset=utf-8'}),'cutcalc-zakupka.csv')}
  function copy(){const rows=rowsForExport();if(!rows)return;navigator.clipboard?.writeText(rows.map(r=>`${r.Артикул} — ${r.К_закупке} шт. | MOQ ${r.MOQ} | уп. ${r.Упаковка} | проходы ${r.Проходы}`).join('\n'));}
  window.calculate=patchedCalculate;window.__cutcalcPatch={calculate:patchedCalculate,migrate};
  window.addEventListener('DOMContentLoaded',()=>{migrate();setTimeout(()=>{const calc=$('calculate'),save=$('saveCalculation'),csvBtn=$('exportCsv'),copyBtn=$('copyRequest');if(calc)calc.onclick=patchedCalculate;if(csvBtn)csvBtn.onclick=csv;if(copyBtn)copyBtn.onclick=copy;if(save)save.onclick=()=>{const p=patchedCalculate();if(!p)return;const db=readDB();db.history.unshift({id:`calc_${Date.now()}`,date:new Date().toLocaleString('ru-RU'),part:$('part').value.trim(),material:$('material').value,qty:toNum($('qty').value),buy:p.reduce((s,x)=>s+x.buy,0),purchase:p.map(x=>({article:x.tool.article,buy:x.buy}))});db.history=db.history.slice(0,200);localStorage.setItem(KEY,JSON.stringify(db));alert('Расчёт сохранён');}},50)});
})();