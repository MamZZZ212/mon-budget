/* Opérations : recherche, filtres et correction de catégorie (mémorisée par marchand). */
(function (root) {
  const M = root.Money;
  const PAGE = 100;
  const filters = { cycle: '', cat: '', q: '', type: '', limit: PAGE };

  function catOptions(model, selected) {
    const groups = [['depense', 'Dépenses'], ['revenu', 'Rentrées'], ['neutre', 'Exclus']];
    return groups.map(([k, l]) => `<optgroup label="${l}">${model.CATEGORIES.filter((c) => c.kind === k)
      .map((c) => `<option value="${c.id}" ${c.id === selected ? 'selected' : ''}>${c.label}</option>`).join('')}</optgroup>`).join('');
  }

  function filtered(model) {
    const q = filters.q.trim().toUpperCase();
    return model.ops.filter((o) => (!filters.cycle || o.stmt === filters.cycle)
      && (!filters.cat || o.cat === filters.cat)
      && (!filters.type || (filters.type === 'debit' ? o.amount < 0 : o.amount > 0))
      && (!q || o.label.toUpperCase().includes(q) || o.merchant.toUpperCase().includes(q)))
      .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  }

  function toolbar(model, s) {
    return `<div class="card"><div class="row">
      <input type="search" id="op-q" placeholder="Rechercher (Uber, Monoprix…)" value="${M.escape(filters.q)}" style="flex:1;min-width:200px">
      <select id="op-cycle"><option value="">Tous les mois</option>${model.cycles.map((c) => `<option value="${M.escape(c.id)}" ${c.id === filters.cycle ? 'selected' : ''}>${c.label}</option>`).join('')}</select>
      <select id="op-cat"><option value="">Toutes catégories</option>${catOptions(model, filters.cat)}</select>
      <select id="op-type"><option value="">Débits et crédits</option><option value="debit" ${filters.type === 'debit' ? 'selected' : ''}>Débits</option><option value="credit" ${filters.type === 'credit' ? 'selected' : ''}>Crédits</option></select>
    </div><label class="row small mt" style="margin-top:12px"><input type="checkbox" id="op-similar" ${s.applySimilar ? 'checked' : ''}> Quand je change une catégorie, l'appliquer à toutes les opérations du même marchand (et aux futurs relevés)</label></div>`;
  }

  function table(model, list) {
    const total = root.BudgetAnalytics.sum(list, (o) => o.amount);
    const rows = list.slice(0, filters.limit).map((o) => `<tr>
      <td class="num">${M.date(o.date)}</td>
      <td><div>${M.escape(o.merchant)}</div><div class="raw-label" title="${M.escape(o.label)}">${M.escape(o.label)}</div></td>
      <td><select class="cat-select" data-op="${M.escape(o.id)}" aria-label="Catégorie">${catOptions(model, o.cat)}</select></td>
      <td class="amt ${o.amount > 0 ? 'pos' : ''}">${M.eurCents(o.amount)}</td></tr>`).join('');
    const more = list.length > filters.limit ? `<div class="row mt" style="justify-content:center"><button class="btn" id="op-more">Afficher ${Math.min(PAGE, list.length - filters.limit)} de plus (${list.length - filters.limit} restantes)</button></div>` : '';
    return `<div class="card mt"><div class="card-head"><div><h2>${list.length} opérations</h2><p>Solde des opérations filtrées : <b class="num">${M.signed(total)}</b></p></div></div>
      <div class="table-wrap"><table><thead><tr><th>Date</th><th>Libellé</th><th>Catégorie</th><th class="amt">Montant</th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="empty">Aucune opération</td></tr>'}</tbody></table></div>${more}</div>`;
  }

  function render(el, model) {
    const s = root.Store.get().settings;
    if (filters.cycle && !model.cycles.some((c) => c.id === filters.cycle)) filters.cycle = '';
    const list = filtered(model);
    el.innerHTML = `<div class="page-head"><div><h1>Opérations</h1><p>Corrige une catégorie : l'appli s'en souvient pour les prochains relevés</p></div></div>
      ${toolbar(model, s)}<div id="op-table">${table(model, list)}</div>`;
    bind(el, model);
  }

  function refreshTable(el, model) {
    el.querySelector('#op-table').innerHTML = table(model, filtered(model));
    bindTable(el, model);
  }

  function bind(el, model) {
    const on = (id, ev, fn) => el.querySelector(id).addEventListener(ev, fn);
    on('#op-q', 'input', (e) => { filters.q = e.target.value; filters.limit = PAGE; refreshTable(el, model); });
    on('#op-cycle', 'change', (e) => { filters.cycle = e.target.value; filters.limit = PAGE; refreshTable(el, model); });
    on('#op-cat', 'change', (e) => { filters.cat = e.target.value; filters.limit = PAGE; refreshTable(el, model); });
    on('#op-type', 'change', (e) => { filters.type = e.target.value; filters.limit = PAGE; refreshTable(el, model); });
    on('#op-similar', 'change', (e) => root.Store.updateSettings({ applySimilar: e.target.checked }, true));
    bindTable(el, model);
  }

  function bindTable(el, model) {
    const more = el.querySelector('#op-more');
    if (more) more.addEventListener('click', () => { filters.limit += PAGE; refreshTable(el, model); });
    el.querySelectorAll('select[data-op]').forEach((sel) => sel.addEventListener('change', () => {
      const op = model.ops.find((o) => o.id === sel.dataset.op);
      const similar = root.Store.get().settings.applySimilar;
      const n = similar ? model.ops.filter((o) => o.key === op.key).length : 1;
      root.Store.setCategory(op, sel.value, similar);
      root.App.toast(`« ${op.merchant} » → ${model.CAT[sel.value].label}${n > 1 ? ` (${n} opérations)` : ''}`);
    }));
  }

  root.OperationsView = { render };
})(window);
