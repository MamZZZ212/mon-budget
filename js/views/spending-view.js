/* Dépenses : répartition fixes / abonnements / Revolut / variables, tableau catégorie × mois. */
(function (root) {
  const M = root.Money;
  const K = root.ChartKit;
  let selectedCat = null;

  function heatCell(v, max) {
    const alpha = max > 0 ? Math.min(1, v / max) * 0.55 : 0;
    const bg = v > 0.5 ? `background:color-mix(in srgb, var(--series-1) ${Math.round(alpha * 100)}%, transparent)` : '';
    return `<td class="amt" style="${bg}">${v > 0.5 ? M.eur(v) : '<span class="small">—</span>'}</td>`;
  }

  function categoryTable(model, kind) {
    const cats = model.CATEGORIES.filter((c) => c.kind === kind);
    const val = (cy, c) => (kind === 'depense' ? cy.spend(c.id) : cy.byCat[c.id] || 0);
    const total = kind === 'depense' ? model.avg.expense : model.avg.income;
    const rows = cats.map((c) => ({ c, vals: model.cycles.map((cy) => val(cy, c)), avg: model.avg.cat[c.id] }))
      .filter((r) => r.vals.some((v) => Math.abs(v) > 0.5)).sort((a, b) => b.avg - a.avg);
    const max = Math.max(...rows.flatMap((r) => r.vals), 1);
    const head = model.cycles.map((cy) => `<th class="amt">${cy.short}</th>`).join('');
    const body = rows.map((r) => `<tr class="clickable" data-cat="${r.c.id}"><td>${r.c.label}</td>${r.vals.map((v) => heatCell(v, max)).join('')}
      <td class="amt"><b>${M.eur(r.avg)}</b></td><td class="amt small">${M.pct(r.avg / total)}</td></tr>`).join('');
    const tot = model.cycles.map((cy) => `<td class="amt">${M.eur(kind === 'depense' ? cy.expense : cy.income)}</td>`).join('');
    return `<div class="table-wrap"><table class="heat"><thead><tr><th>Catégorie</th>${head}<th class="amt">Moy./mois</th><th class="amt">Part</th></tr></thead>
      <tbody>${body}</tbody><tfoot><tr><td>Total</td>${tot}<td class="amt">${M.eur(total)}</td><td></td></tr></tfoot></table></div>`;
  }

  function detailCard(model) {
    if (!selectedCat) return '<div class="card empty">Clique sur une catégorie du tableau pour voir le détail de ses opérations.</div>';
    const ops = model.ops.filter((o) => o.cat === selectedCat).sort((a, b) => b.date.localeCompare(a.date));
    const byMerchant = {};
    ops.forEach((o) => { byMerchant[o.merchant] = (byMerchant[o.merchant] || 0) - o.amount; });
    const top = Object.entries(byMerchant).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 8);
    const rows = ops.slice(0, 60).map((o) => `<tr><td class="num">${M.date(o.date)}</td><td>${M.escape(o.merchant)}</td><td class="amt ${o.amount > 0 ? 'pos' : ''}">${M.eurCents(o.amount)}</td></tr>`).join('');
    return `<div class="card"><div class="card-head"><div><h2>${model.CAT[selectedCat].label}</h2><p>${ops.length} opérations · principaux marchands</p></div>
      <button class="btn ghost" data-close>Fermer</button></div>
      <div class="row" style="gap:6px;margin-bottom:12px">${top.map(([n, v]) => `<span class="badge">${M.escape(n)} · ${M.eur(Math.abs(v))}</span>`).join('')}</div>
      <div class="table-wrap"><table><thead><tr><th>Date</th><th>Marchand</th><th class="amt">Montant</th></tr></thead><tbody>${rows}</tbody></table></div>
      ${ops.length > 60 ? '<p class="small">60 dernières opérations affichées — l\'onglet Opérations montre tout.</p>' : ''}</div>`;
  }

  function render(el, model) {
    if (!model.n) { el.innerHTML = '<div class="card empty">Aucun relevé importé.</div>'; return; }
    const g = model.avg.groups;
    el.innerHTML = `<div class="page-head"><div><h1>Dépenses</h1><p>Le virement Revolut est compté comme dépensé à 100 %</p></div></div>
      <div class="grid kpis">
        <div class="card kpi"><div class="label">Charges fixes</div><div class="value num">${M.eur(g.fixe)}</div><div class="sub">${M.pct(g.fixe / model.avg.expense)} des dépenses</div></div>
        <div class="card kpi"><div class="label">Abonnements & sport</div><div class="value num">${M.eur(g.abonnement)}</div><div class="sub">${M.pct(g.abonnement / model.avg.expense)} des dépenses</div></div>
        <div class="card kpi"><div class="label">Revolut</div><div class="value num">${M.eur(g.revolut)}</div><div class="sub">${M.pct(g.revolut / model.avg.expense)} des dépenses</div></div>
        <div class="card kpi"><div class="label">Dépenses variables (BNP)</div><div class="value num">${M.eur(g.variable)}</div><div class="sub">${M.pct(g.variable / model.avg.expense)} des dépenses</div></div>
      </div>
      <div class="card mt"><div class="card-head"><div><h2>Composition des dépenses par mois</h2><p>Empilé : fixes, abonnements, Revolut, variables</p></div></div><div class="chart-box tall"><canvas id="ch-stack"></canvas></div></div>
      <div class="card mt"><div class="card-head"><div><h2>Dépenses par catégorie</h2><p>Plus la case est foncée, plus le montant est élevé · clic = détail</p></div></div>${categoryTable(model, 'depense')}</div>
      <div class="mt" id="cat-detail">${detailCard(model)}</div>
      <div class="card mt"><div class="card-head"><div><h2>Rentrées par type</h2><p>Salaire, notes de frais, remboursements…</p></div></div>${categoryTable(model, 'revenu')}</div>`;
    const labels = model.cycles.map((c) => c.chartLabel);
    K.stackedBars('ch-stack', labels, [
      { label: 'Fixes', data: model.cycles.map((c) => c.groups.fixe), color: K.css('--series-1') },
      { label: 'Abonnements', data: model.cycles.map((c) => c.groups.abonnement), color: K.css('--series-2') },
      { label: 'Revolut', data: model.cycles.map((c) => c.groups.revolut), color: K.css('--series-3') },
      { label: 'Variables', data: model.cycles.map((c) => c.groups.variable), color: K.css('--series-4') },
    ]);
    el.querySelectorAll('tr[data-cat]').forEach((tr) => tr.addEventListener('click', () => {
      selectedCat = tr.dataset.cat; renderDetail(el, model);
      el.querySelector('#cat-detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
    renderDetail(el, model);
  }

  function renderDetail(el, model) {
    const box = el.querySelector('#cat-detail');
    box.innerHTML = detailCard(model);
    const close = box.querySelector('[data-close]');
    if (close) close.addEventListener('click', () => { selectedCat = null; renderDetail(el, model); });
  }

  root.SpendingView = { render };
})(window);
