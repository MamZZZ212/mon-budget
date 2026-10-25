/* Simulateur d'épargne : budget cible mensuel, scénarios et projection cumulée. */
(function (root) {
  const A = root.BudgetAnalytics;
  const SUB_CATS = ['telecom', 'banque', 'abonnements', 'sport'];
  const SUGGESTED_CANCEL = ((root.ProfileRegistry.isMain() && root.PERSONAL_DEFAULTS) || {}).suggestedCancel || [];
  const SUGGESTED_CUTS = { livraison: 0.5, restos: 0.7, shopping: 0.6, especes: 0, autres: 0.5, voyages: 0.8, loisirs: 0.9 };

  const variableCats = (model) => model.CATEGORIES.filter((c) => c.group === 'variable');
  const round5 = (n) => Math.round(n / 5) * 5;

  function fixedCosts(model) {
    const lastCycle = model.cycles[model.n - 1];
    return {
      loyer: lastCycle.spend('loyer') || model.avg.cat.loyer,
      energie: model.avg.last3Cat.energie,
      impots: model.avg.cat.impots,
    };
  }

  function planBudget(model, s) {
    const fixed = fixedCosts(model);
    const subs = model.recurring.filter((r) => SUB_CATS.includes(r.cat) && r.active);
    const keptSubs = subs.filter((r) => !s.cancelled.includes(r.name));
    const variable = Object.fromEntries(variableCats(model).map((c) => [c.id, s.targets[c.id] ?? round5(model.avg.cat[c.id])]));
    // dépenses ponctuelles des catégories d'abonnements (achat unique, frais exceptionnels) : gardées au plan
    const oneOff = A.sum(SUB_CATS, (c) => Math.max(0, model.avg.cat[c] - A.sum(subs.filter((r) => r.cat === c), (r) => r.monthly)));
    const lines = {
      fixe: fixed.loyer + fixed.energie + fixed.impots,
      abonnements: A.sum(keptSubs, (r) => r.monthly) + oneOff,
      revolut: s.revolut,
      variable: A.sum(Object.values(variable)),
    };
    return { fixed, subs, keptSubs, variable, lines, total: A.sum(Object.values(lines)) };
  }

  function incomeFor(model, s, salary) {
    return (salary || model.avg.salary) + (s.includeExtraIncome ? model.avg.extraIncome : 0);
  }

  /* w : patrimoine (bonus versé en une fois sur l'épargne disponible). */
  function scenarios(model, s, w = root.Store.get().wealth) {
    const plan = planBudget(model, s);
    const lumps = root.WealthProfile.lumpSums(w, 600);
    const list = [
      { id: 'actuel', label: 'Situation actuelle', income: incomeFor(model, s, model.avg.salary), expense: model.avg.expense },
      { id: 'hausse', label: 'Avec augmentation', income: incomeFor(model, s, s.newSalary), expense: model.avg.expense },
      { id: 'plan', label: 'Plan optimisé', income: incomeFor(model, s, s.newSalary), expense: plan.total },
    ];
    list.forEach((sc) => {
      sc.saving = sc.income - sc.expense;
      sc.rate = sc.income ? sc.saving / sc.income : 0;
      const full = project(sc.saving, 600, s.startAmount, s.rate, lumps);
      sc.projection = full.slice(0, s.horizon + 1);
      sc.after12 = full[12] - s.startAmount;
      const i = full.findIndex((v) => v >= s.goal);
      sc.monthsToGoal = i < 0 ? Infinity : i;
    });
    return { plan, list, bonus: root.WealthProfile.bonusNet(w), bonusIn12: lumps.slice(1, 13).reduce((a, b) => a + b, 0) };
  }

  /* Épargne cumulée mois par mois (intérêts mensualisés, taux annuel en %) + versements ponctuels. */
  function project(monthly, months, start, ratePct, lumps = []) {
    const r = (ratePct || 0) / 100 / 12;
    const out = [start];
    for (let m = 1; m <= months; m++) out.push(out[m - 1] * (1 + r) + monthly + (lumps[m] || 0));
    return out;
  }

  function suggestedSettings(model) {
    const targets = {};
    variableCats(model).forEach((c) => {
      const avg = model.avg.cat[c.id];
      targets[c.id] = round5(avg * (SUGGESTED_CUTS[c.id] ?? 1));
    });
    targets.transport = round5(Math.min(model.avg.cat.transport, root.SavingsInsights.NAVIGO_NET));
    const cancelled = SUGGESTED_CANCEL.filter((n) => model.recurring.some((r) => r.name === n && r.active));
    return { targets, cancelled, revolut: (((root.ProfileRegistry.isMain() && root.PERSONAL_DEFAULTS) || {}).settings || {}).revolut ?? Math.round(model.avg.groups.revolut / 50) * 50 };
  }

  root.SavingsSimulator = { planBudget, scenarios, project, suggestedSettings, variableCats, SUB_CATS };
})(window);
