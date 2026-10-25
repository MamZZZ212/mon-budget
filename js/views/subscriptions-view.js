/* Abonnements & charges récurrentes : coût mensuel / annuel, sélection « à résilier ». */
(function (root) {
  const M = root.Money;
  const GROUPS = [
    { title: 'Logement & énergie', cats: ['loyer', 'energie'], cancellable: false },
    { title: 'Téléphone, banque & assurances', cats: ['telecom', 'banque'], cancellable: true },
    { title: 'Abonnements numériques & sport', cats: ['abonnements', 'sport'], cancellable: true },
  ];

  function rowsFor(model, group, cancelled) {
    const items = model.recurring.filter((r) => group.cats.includes(r.cat));
    if (!items.length) return '';
    const sum = root.BudgetAnalytics.sum(items, (r) => r.monthly);
    const rows = items.map((r) => {
      const freq = `${r.nCycles}/${model.n} mois`;
      const status = r.active ? '' : ' <span class="badge">inactif</span>';
      const box = group.cancellable && r.active
        ? `<input type="checkbox" data-cancel="${M.escape(r.name)}" ${cancelled.includes(r.name) ? 'checked' : ''} aria-label="Résilier ${M.escape(r.name)}">` : '';
      return `<tr><td>${M.escape(r.name)}${status}</td><td class="small">${model.CAT[r.cat].label}</td><td class="small num">${freq}</td>
        <td class="amt">${M.eurCents(r.lastAmount)}</td><td class="amt"><b>${M.eurCents(r.monthly)}</b></td><td class="amt">${M.eur(r.annual)}</td><td style="text-align:center">${box}</td></tr>`;
    }).join('');
    return `<tr><td colspan="7" style="padding-top:18px"><h3>${group.title} · ${M.eur(sum)}/mois</h3></td></tr>${rows}`;
  }

  function render(el, model) {
    const s = root.Store.get().settings;
    const active = model.recurring.filter((r) => r.active);
    const subs = active.filter((r) => ['abonnements', 'sport'].includes(r.cat));
    const total = root.BudgetAnalytics.sum(active, (r) => r.monthly);
    const subsTotal = root.BudgetAnalytics.sum(subs, (r) => r.monthly);
    const saved = root.BudgetAnalytics.sum(active.filter((r) => s.cancelled.includes(r.name)), (r) => r.monthly);
    el.innerHTML = `<div class="page-head"><div><h1>Abonnements & prélèvements</h1><p>Coût mensuel = moyenne des 3 derniers relevés</p></div></div>
      <div class="grid kpis">
        <div class="card kpi"><div class="label">Toutes charges récurrentes</div><div class="value num">${M.eur(total)}</div><div class="sub">${M.eur(total * 12)} par an</div></div>
        <div class="card kpi"><div class="label">Abonnements & sport</div><div class="value num">${M.eur(subsTotal)}</div><div class="sub">${subs.length} actifs · ${M.eur(subsTotal * 12)}/an</div></div>
        <div class="card kpi"><div class="label">Sélection « à résilier »</div><div class="value num pos">${M.signed(saved)}</div><div class="sub">par mois · ${M.eur(saved * 12)}/an, repris dans le simulateur</div></div>
      </div>
      <div class="card mt"><div class="card-head"><div><h2>Détail</h2><p>Coche ce que tu veux résilier : l'économie est appliquée au plan optimisé</p></div></div>
      <div class="table-wrap"><table><thead><tr><th>Prélèvement</th><th>Catégorie</th><th>Fréquence</th><th class="amt">Dernier</th><th class="amt">/ mois</th><th class="amt">/ an</th><th style="text-align:center">Résilier</th></tr></thead>
      <tbody>${GROUPS.map((g) => rowsFor(model, g, s.cancelled)).join('')}</tbody></table></div></div>
      <div class="notice info mt">Astuce : Apple facture plusieurs petits abonnements séparés (iCloud, apps…). Vérifie-les dans Réglages → ton nom → Abonnements sur l'iPhone.</div>`;
    el.querySelectorAll('[data-cancel]').forEach((cb) => cb.addEventListener('change', () => {
      const name = cb.dataset.cancel;
      const list = s.cancelled.filter((n) => n !== name);
      if (cb.checked) list.push(name);
      root.Store.updateSettings({ cancelled: list });
    }));
  }

  root.SubscriptionsView = { render };
})(window);
