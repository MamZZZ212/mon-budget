/* Agrégats budgétaires : cycles (relevé du 21 au 21), moyennes par catégorie, récurrences. */
(function (root) {
  const { CATEGORIES } = root.CategoryRules;
  const C = root.Categorizer;
  const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
  const EXPENSE_CATS = CATEGORIES.filter((c) => c.kind === 'depense').map((c) => c.id);
  const RECURRING_CATS = ['loyer', 'energie', 'telecom', 'banque', 'abonnements', 'sport'];

  const sum = (arr, f = (x) => x) => arr.reduce((s, x) => s + f(x), 0);
  const mean = (arr) => (arr.length ? sum(arr) / arr.length : 0);
  const median = (arr) => {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b), m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };

  function enrich(st, prefs) {
    return st.ops.map((o) => ({ ...o, stmt: st.id, cat: C.categorize(o, prefs), merchant: C.merchantName(o.label), key: C.merchantKey(o.label) }));
  }

  function buildCycle(st, ops) {
    const byCat = {};
    ops.forEach((o) => { byCat[o.cat] = (byCat[o.cat] || 0) + o.amount; });
    const spend = (id) => -(byCat[id] || 0);
    const expense = sum(EXPENSE_CATS, spend);
    const income = sum(CATEGORIES.filter((c) => c.kind === 'revenu'), (c) => byCat[c.id] || 0);
    const groupSpend = (g) => sum(CATEGORIES.filter((c) => c.group === g), (c) => spend(c.id));
    return {
      id: st.id, period: st.period, open: st.open, close: st.close, ops, byCat, spend,
      label: root.Money.monthLabel(st.period.from), short: root.Money.monthShort(st.period.from),
      chartLabel: `${root.Money.monthShort(st.period.from)} ${st.period.from.slice(2, 4)}`,
      income, expense, net: income - expense, salary: byCat.salaire || 0,
      groups: { fixe: groupSpend('fixe'), abonnement: groupSpend('abonnement'), revolut: groupSpend('revolut'), variable: groupSpend('variable') },
      food: sum(CATEGORIES.filter((c) => c.food), (c) => spend(c.id)),
    };
  }

  function averages(cycles) {
    const avgCat = {};
    CATEGORIES.forEach((c) => {
      const vals = cycles.map((cy) => (c.kind === 'depense' ? cy.spend(c.id) : cy.byCat[c.id] || 0));
      avgCat[c.id] = mean(vals);
    });
    const last3 = cycles.slice(-3);
    return {
      cat: avgCat,
      income: mean(cycles.map((c) => c.income)),
      salary: mean(cycles.map((c) => c.salary)),
      salaryMedian: median(cycles.map((c) => c.salary)),
      extraIncome: mean(cycles.map((c) => c.income - c.salary)),
      expense: mean(cycles.map((c) => c.expense)),
      expenseMedian: median(cycles.map((c) => c.expense)),
      net: mean(cycles.map((c) => c.net)),
      food: mean(cycles.map((c) => c.food)),
      groups: Object.fromEntries(['fixe', 'abonnement', 'revolut', 'variable'].map((g) => [g, mean(cycles.map((c) => c.groups[g]))])),
      last3Cat: Object.fromEntries(CATEGORIES.map((c) => [c.id, mean(last3.map((cy) => cy.spend(c.id)))])),
    };
  }

  const DAY = 86400000;
  const daysBetween = (a, b) => (new Date(b) - new Date(a)) / DAY;

  /* Périodicité en mois, déduite de l'écart médian entre deux prélèvements (1 = mensuel). */
  function intervalMonths(debits) {
    const dates = [...new Set(debits.map((o) => o.date))].sort();
    if (dates.length < 2) return 1;
    const gaps = dates.slice(1).map((d, i) => daysBetween(dates[i], d)).filter((g) => g > 20);
    return gaps.length ? Math.max(1, Math.round(median(gaps) / 30.4)) : 1;
  }

  /* Coût mensuel et statut d'une charge : mensuelle = moyenne des 3 derniers relevés (remboursements déduits),
     sinon dernier montant ÷ périodicité. */
  function recurringCost(g, recent, lastEnd) {
    const debits = g.ops.filter((o) => o.amount < 0);
    const last = debits[debits.length - 1];
    const every = intervalMonths(debits);
    const recentTotal = -sum(g.ops.filter((o) => recent.includes(o.stmt)), (o) => o.amount);
    const monthly = every === 1 ? Math.max(0, recentTotal / Math.max(1, recent.length)) : -last.amount / every;
    const active = every === 1 ? recentTotal > 0 : daysBetween(last.date, lastEnd) <= every * 30.4 * 1.5;
    return { monthly, annual: monthly * 12, every, active, lastAmount: -last.amount, lastDate: last.date };
  }

  /* Charges récurrentes et abonnements, regroupés par marchand. */
  function recurring(model) {
    const recent = model.cycles.slice(-3).map((c) => c.id);
    const lastEnd = model.cycles[model.n - 1].period.to;
    const groups = {};
    model.ops.filter((o) => RECURRING_CATS.includes(o.cat)).forEach((o) => {
      const g = groups[o.merchant] || (groups[o.merchant] = { name: o.merchant, cat: o.cat, ops: [], cycles: new Set() });
      g.ops.push(o);
      if (o.amount < 0) g.cycles.add(o.stmt);
    });
    const known = new Set(root.CategoryRules.KNOWN_MERCHANTS.map(([, name]) => name));
    return Object.values(groups)
      .filter((g) => g.cycles.size && (g.cycles.size >= 2 || known.has(g.name)))
      .map((g) => ({ ...g, count: g.ops.filter((o) => o.amount < 0).length, nCycles: g.cycles.size, ...recurringCost(g, recent, lastEnd) }))
      .sort((a, b) => b.monthly - a.monthly);
  }

  function buildModel(state) {
    const statements = [...state.statements].sort((a, b) => a.id.localeCompare(b.id));
    const cycles = statements.map((st) => buildCycle(st, enrich(st, state.prefs)));
    const ops = cycles.flatMap((c) => c.ops);
    const model = { cycles, ops, n: cycles.length, avg: cycles.length ? averages(cycles) : null, CAT, CATEGORIES };
    model.recurring = cycles.length ? recurring(model) : [];
    model.balance = cycles.length ? cycles[cycles.length - 1].close : 0;
    model.firstBalance = cycles.length ? cycles[0].open : null;
    return model;
  }

  root.BudgetAnalytics = { buildModel, sum, mean, median, EXPENSE_CATS, RECURRING_CATS, CAT };
})(window);
