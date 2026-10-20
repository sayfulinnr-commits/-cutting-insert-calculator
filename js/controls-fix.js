(() => {
  'use strict';

  const dbFromStorage = () => {
    try {
      return JSON.parse(localStorage.getItem('cutcalc_v5') || '{}');
    } catch (_) {
      return {};
    }
  };

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[m]));

  function toolOptions(selected = '') {
    const db = dbFromStorage();
    const tools = Array.isArray(db.tools) ? db.tools : [];
    return '<option value="">— выбрать инструмент —</option>' + tools.map(t =>
      `<option value="${esc(t.id)}" ${t.id === selected ? 'selected' : ''}>${esc(t.article)} — ${esc(t.nameRu || t.type || 'Инструмент')}</option>`
    ).join('');
  }

  function renumber() {
    document.querySelectorAll('.operation').forEach((op, oi) => {
      const n = op.querySelector('.op-no');
      if (n) n.textContent = oi + 1;
      op.querySelectorAll('.pass').forEach((pass, pi) => {
        const pn = pass.querySelector('.pass-no');
        if (pn) pn.textContent = pi + 1;
      });
    });
  }

  function safeAddPass(op, data = {}) {
    if (!op) return;

    const pass = document.createElement('div');
    pass.className = 'pass';
    pass.innerHTML = `
      <div class="pass-head">
        <div><span class="pass-label">ПРОХОД <span class="pass-no"></span></span></div>
        <button type="button" class="danger remove-pass">Удалить</button>
      </div>
      <div class="controls">
        <div><label>Инструмент</label><select class="tool">${toolOptions(data.toolId || '')}</select></div>
        <div><label>Активных пластин одновременно</label><input class="active-inserts" type="number" min="1" step="1" value="${data.activeInserts ?? 1}"></div>
        <div><label>Серия для прохода, шт.</label><input class="series" type="number" min="1" step="1" value="${data.series ?? ''}"></div>
        <div><label>Режим расхода</label><select class="consumption-mode"><option value="edge" ${data.mode !== 'parts' ? 'selected' : ''}>Деталей на одну кромку</option><option value="parts" ${data.mode === 'parts' ? 'selected' : ''}>Кромок на деталь</option></select></div>
        <div class="resource-field"><label>Деталей на одну кромку</label><input class="parts-edge" type="number" min="0.000001" step="0.000001" value="${data.partsPerEdge ?? ''}"></div>
        <div class="resource-field"><label>Кромок на деталь</label><input class="edges-part" type="number" min="0.000001" step="0.000001" value="${data.edgesPerPart ?? ''}"></div>
      </div>
      <div class="tool-meta">
        <div class="mini"><span>Артикул</span><b class="m-article">—</b></div>
        <div class="mini"><span>Кромок / пластину</span><b class="m-edges">—</b></div>
        <div class="mini"><span>MOQ</span><b class="m-moq">—</b></div>
        <div class="mini"><span>Упаковка</span><b class="m-pack">—</b></div>
      </div>`;

    const passes = op.querySelector('.passes');
    if (!passes) return;
    passes.appendChild(pass);

    const remove = pass.querySelector('.remove-pass');
    if (remove) remove.addEventListener('click', e => {
      e.preventDefault();
      pass.remove();
      renumber();
    });

    const mode = pass.querySelector('.consumption-mode');
    const partsEdge = pass.querySelector('.parts-edge');
    const edgesPart = pass.querySelector('.edges-part');
    const sync = () => {
      const edge = mode.value === 'edge';
      partsEdge.disabled = !edge;
      edgesPart.disabled = edge;
    };
    mode.addEventListener('change', sync);
    partsEdge.addEventListener('input', () => { if (mode.value === 'edge') edgesPart.value = ''; });
    edgesPart.addEventListener('input', () => { if (mode.value === 'parts') partsEdge.value = ''; });
    sync();

    const select = pass.querySelector('.tool');
    select.addEventListener('change', () => {
      const db = dbFromStorage();
      const tools = Array.isArray(db.tools) ? db.tools : [];
      const t = tools.find(x => x.id === select.value);
      if (!t) return;
      pass.querySelector('.m-article').textContent = t.article || '—';
      pass.querySelector('.m-edges').textContent = t.edges ?? '—';
      pass.querySelector('.m-moq').textContent = t.moq ?? '—';
      pass.querySelector('.m-pack').textContent = t.packSize ?? '—';
    });

    if (data.toolId) select.dispatchEvent(new Event('change'));
    renumber();
    return pass;
  }

  function safeAddOperation() {
    const operations = document.getElementById('operations');
    if (!operations) return;
    const op = document.createElement('div');
    op.className = 'operation';
    op.dataset.id = `op_fix_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
    op.innerHTML = `
      <div class="operation-head">
        <div><div class="eyebrow">ОПЕРАЦИЯ <span class="op-no"></span></div><div class="operation-title"><input class="op-name" value="Операция"></div></div>
        <button type="button" class="danger remove-op">Удалить операцию</button>
      </div>
      <div class="passes"></div>
      <button type="button" class="add-pass">+ Добавить проход</button>`;
    operations.appendChild(op);
    op.querySelector('.remove-op').addEventListener('click', e => {
      e.preventDefault();
      op.remove();
      renumber();
    });
    safeAddPass(op, {});
    renumber();
  }

  function bind() {
    const operations = document.getElementById('operations');
    const addOperation = document.getElementById('addOperation');
    if (!operations || !addOperation) return;

    window.addPass = safeAddPass;
    window.addOperation = safeAddOperation;

    addOperation.onclick = e => {
      e.preventDefault();
      safeAddOperation();
    };

    operations.onclick = e => {
      const button = e.target.closest('.add-pass');
      if (!button) return;
      e.preventDefault();
      e.stopPropagation();
      const operation = button.closest('.operation');
      if (operation) safeAddPass(operation, {});
    };

    operations.querySelectorAll('.operation').forEach(op => {
      if (!op.querySelector('.pass')) safeAddPass(op, {});
    });
    renumber();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind, { once: true });
  } else {
    bind();
  }
})();
