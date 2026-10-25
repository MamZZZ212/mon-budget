/* Simulateur d'épargne : réglages (salaire, Revolut, budgets cibles, résiliations) et résultats. */
(function (root) {
  const M = root.Money;
  const S = root.SavingsSimulator;
  const K = root.ChartKit;

  function incomeCard(model, s) {
    return `<div class="card"><div class="card-head"><div><h2>Revenus</h2><p>Salaire net moyen actuel : ${M.eur(model.avg.salary)} (médiane ${M.eur(model.avg.salaryMedian)})</p></div></div>
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
        <label class="field">Nouveau salaire net / mois<input type="number" step="50" min="0" data-set="newSalary" value="${s.newSalary}"></label>
        <label class="field">Objectif d'épargne (€)<input type="number" step="500" min="0" data-set="goal" value="${s.goal}"></label>
        <label class="field">Épargne déjà mise de côté (€)<input type="number" step="100" min="0" data-set="startAmount" value="${s.startAmount}"></label>
        <label class="field">Rendement annuel supposé (%)<input type="number" step="0.1" min="0" max="15" data-set="rate" value="${s.rate}"></label>
      </div>
      <label class="row small mt"><input type="checkbox" data-set="includeExtraIncome" ${s.includeExtraIncome ? 'checked' : ''}> Compter aussi mes autres rentrées moyennes (${M.eur(model.avg.extraIncome)}/mois : notes de frais, remboursements…)</label></div>`;
  }

  function wealthCard(w) {
    const b = root.WealthProfile.bonusNet(w);
    const field = (key, label, type = 'number', step = 100) => `<label class="field">${label}<input type="${type}" ${type === 'number' ? `step="${step}" min="0"` : ''} data-wealth="${key}" value="${M.escape(w[key])}"></label>`;
    return `<div class="card"><div class="card-head"><div><h2>Bonus & épargne salariale</h2><p>Bonus net estimé : <b data-bonus-net>${M.eur(b.min)} – ${M.eur(b.max)}</b> · épargné ≈ <b data-bonus-saved>${M.eur(b.saved)}</b></p></div></div>
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
        ${field('bonusGrossMin', 'Bonus brut min (€)', 'number', 500)}${field('bonusGrossMax', 'Bonus brut max (€)', 'number', 500)}
        ${field('bonusMonth', 'Mois de versement', 'month')}${field('bonusSavePct', 'Part mise de côté (%)', 'number', 5)}
        ${field('bonusNetRate', 'Brut → net (%)', 'number', 1)}${field('bonusTaxRate', 'Prélèvement à la source (%)', 'number', 0.5)}
        ${field('peeBalance', 'PEE/PEI actuel (€)')}${field('peeAbondement', 'Abondement attendu (€)')}
      </div>
      <p class="small" style="margin:10px 0 0">Brut → net ≈ 77 % pour un salarié cadre (cotisations sociales). Ton taux de prélèvement à la source figure sur ta fiche de paie. Le PEE/PEI est bloqué 5 ans (sauf cas de déblocage anticipé) : il est compté à part de l'épargne disponible.</p></div>`;
  }

  function slider(id, name, sub, value, max, step) {
    return `<div class="slider-row"><div class="name">${name}<small>${sub}</small></div>
      <input type="range" min="0" max="${max}" step="${step}" value="${value}" data-target="${id}" aria-label="${name}">
      <div class="val num" data-val="${id}">${M.eur(value)}</div></div>`;
  }

  function budgetCard(model, s, plan) {
    const rows = S.variableCats(model).filter((c) => model.avg.cat[c.id] > 0.5).sort((a, b) => model.avg.cat[b.id] - model.avg.cat[a.id]).map((c) => {
      const avg = model.avg.cat[c.id];
      const max = Math.max(50, Math.ceil((avg * 2) / 10) * 10);
      return slider(c.id, c.label, `moyenne ${M.eur(avg)}`, plan.variable[c.id], max, 5);
    }).join('');
    return `<div class="card"><div class="card-head"><div><h2>Budget mensuel cible</h2><p>Déplace les curseurs : les résultats se mettent à jour en direct</p></div></div>
      ${slider('revolut', 'Virement Revolut', `moyenne réelle ${M.eur(model.avg.groups.revolut)} · consommé à 100 %`, s.revolut, 1500, 50)}
      ${rows}</div>`;
  }

  function subsCard(plan, s) {
    const rows = plan.subs.map((r) => `<label class="slider-row" style="grid-template-columns:24px 1fr auto;cursor:pointer">
      <input type="checkbox" data-cancel="${M.escape(r.name)}" ${s.cancelled.includes(r.name) ? 'checked' : ''}>
      <span class="name">${M.escape(r.name)}</span><span class="num">${M.eurCents(r.monthly)}</span></label>`).join('');
    return `<div class="card"><div class="card-head"><div><h2>Abonnements à résilier</h2><p>Coche pour retirer du budget</p></div></div>${rows}</div>`;
  }

  function scenarioCards(list, s) {
    return `<div class="grid three">${list.map((sc) => {
      const goal = sc.monthsToGoal === Infinity ? 'jamais à ce rythme' : sc.monthsToGoal === 0 ? 'déjà atteint' : `${sc.monthsToGoal} mois`;
      return `<div class="card kpi ${sc.id === 'plan' ? 'hero' : ''}"><div class="label">${sc.label}</div>
        <div class="value num">${M.signed(sc.saving)}<span style="font-size:14px;font-weight:500"> /mois</span></div>
        <div class="sub">${M.eur(sc.income)} − ${M.eur(sc.expense)} · taux ${M.pct(sc.rate)}<br>Sur 12 mois (bonus inclus) : ${M.signed(sc.after12)} · objectif ${M.eur(s.goal)} : ${goal}</div></div>`;
    }).join('')}</div>`;
  }

  function splitCard(planSc, plan) {
    const income = planSc.income;
    const parts = [
      ['Fixes (loyer, énergie, impôts)', plan.lines.fixe, '--series-1'], ['Abonnements & télécom', plan.lines.abonnements, '--series-2'],
      ['Revolut', plan.lines.revolut, '--series-3'], ['Variables BNP', plan.lines.variable, '--series-4'], ['Épargne', Math.max(0, planSc.saving), '--good'],
    ];
    const bar = parts.map(([l, v, c]) => `<div title="${l} : ${M.eur(v)}" style="width:${(v / Math.max(income, plan.total)) * 100}%;background:var(${c})"></div>`).join('');
    const legend = parts.map(([l, v, c]) => `<span><i style="background:var(${c})"></i>${l} <b class="num">${M.eur(v)}</b> · ${M.pct(v / income)}</span>`).join('');
    return `<div class="card"><div class="card-head"><div><h2>Répartition de ton salaire (plan)</h2><p>Repère classique : au moins 20 % d'épargne</p></div></div>
      <div class="split-bar">${bar}</div><div class="legend">${legend}</div></div>`;
  }

  function adviceCard(planSc, plan, bonus) {
    const safety = plan.total * 3;
    const transfer = Math.max(0, Math.floor(planSc.saving / 50) * 50);
    return `<div class="card"><h2>Mode d'emploi du plan</h2><ol style="margin:10px 0 0;padding-left:20px;color:var(--ink-2);font-size:14px">
      <li>Le jour de la paie, programme un <b>virement automatique de ${M.eur(transfer)}</b> vers ton épargne (« se payer en premier »).</li>
      <li>Programme aussi un <b>virement fixe de ${M.eur(plan.lines.revolut)}</b> vers Revolut : c'est ton budget du quotidien, à ne pas recharger en cours de mois.</li>
      <li>À l'arrivée du bonus, mets immédiatement <b>≈ ${M.eur(bonus.saved)}</b> de côté (estimation nette ${M.eur(bonus.min)} – ${M.eur(bonus.max)}) avant de toucher au reste.</li>
      <li>Constitue d'abord une <b>épargne de précaution de ${M.eur(safety)}</b> (3 mois de dépenses) sur un livret disponible à tout moment.</li>
      <li>Importe chaque nouveau relevé pour comparer le réel au plan.</li></ol></div>`;
  }

  function renderResults(el, model) {
    const s = root.Store.get().settings;
    const { plan, list, bonus } = S.scenarios(model, s);
    el.querySelector('#sim-results').innerHTML = `${scenarioCards(list, s)}
      <div class="card mt"><div class="card-head"><div><h2>Projection de l'épargne cumulée</h2><p>Sur ${s.horizon} mois${s.rate ? `, ${s.rate} % par an` : ''}</p></div>
      <div class="seg" role="group" aria-label="Horizon">${[12, 24, 36].map((h) => `<button data-h="${h}" aria-pressed="${s.horizon === h}">${h} mois</button>`).join('')}</div></div>
      <div class="chart-box"><canvas id="ch-proj"></canvas></div></div>
      <div class="mt">${splitCard(list[2], plan)}</div><div class="mt">${adviceCard(list[2], plan, bonus)}</div>`;
    const labels = list[0].projection.map((_, i) => (i === 0 ? 'Auj.' : `M${i}`));
    K.lines('ch-proj', labels, [
      { label: list[0].label, data: list[0].projection, color: K.css('--series-2'), dash: [5, 4] },
      { label: list[1].label, data: list[1].projection, color: K.css('--series-3') },
      { label: list[2].label, data: list[2].projection, color: K.css('--series-1') },
    ]);
    el.querySelectorAll('[data-h]').forEach((b) => b.addEventListener('click', () => { root.Store.updateSettings({ horizon: +b.dataset.h }, true); renderResults(el, model); }));
  }

  root.SimulatorView = { incomeCard, wealthCard, budgetCard, subsCard, renderResults };
})(window);
