/* Pistes d'économies calculées à partir des moyennes réelles du compte. */
(function (root) {
  const M = root.Money;
  const NAVIGO_NET = 45;      // pass Navigo ≈ 90 €/mois, remboursé à 50 % par l'employeur
  const TELECOM_TARGET = 40;  // ordre de grandeur box fibre + forfait mobile « low cost »
  const MICRO_MOBILITY = /\bVOI\b|LIME|DOTT|BOLT|UBR\*|UBER \*TRIP|UBER RIDES|^DU \d{6} UBER/;

  function monthlyOf(model, predicate) {
    return -root.BudgetAnalytics.sum(model.ops.filter(predicate), (o) => o.amount) / model.n;
  }

  /* Basé sur l'épargne nette (transferts internes exclus), cohérent avec les KPI. */
  function trendInsight(model) {
    const total = model.avg.net * model.n;
    const balance = model.firstBalance != null ? ` Solde BNP : ${M.eur(model.firstBalance)} → ${M.eur(model.balance)}.` : '';
    if (total >= 0) return { icon: 'trend', title: `Tu as épargné ${M.eur(total)} en ${model.n} mois`, text: `Soit ${M.signed(model.avg.net)} par mois.${balance} Continue en automatisant un virement d'épargne le jour de la paie.`, gain: 0 };
    return {
      icon: 'alert', alert: true, title: `Tu as dépensé ${M.eur(-total)} de plus que tes rentrées en ${model.n} mois`,
      text: `En moyenne ${M.eur(model.avg.expense)} de dépenses pour ${M.eur(model.avg.income)} de rentrées, soit ${M.signed(model.avg.net)} par mois.${balance} Aujourd'hui, tu n'épargnes pas : tu puises dans ta réserve.`, gain: 0,
    };
  }

  function revolutInsight(model) {
    const vals = model.cycles.map((c) => c.groups.revolut);
    const min = Math.min(...vals), max = Math.max(...vals);
    return {
      icon: 'card', title: 'Fixe un virement Revolut unique et régulier',
      text: `Tes virements vers Revolut varient de ${M.eur(min)} à ${M.eur(max)} selon les mois (moyenne ${M.eur(model.avg.groups.revolut)}). Un montant fixe le jour de la paie (ex. 800 €) en fait un vrai budget plafonné.`,
      gain: Math.max(0, model.avg.groups.revolut - 800),
    };
  }

  function transportInsight(model) {
    const micro = monthlyOf(model, (o) => o.cat === 'transport' && MICRO_MOBILITY.test(o.label.toUpperCase()));
    const n = model.ops.filter((o) => o.cat === 'transport' && /\bVOI\b|LIME|DOTT/.test(o.label.toUpperCase())).length;
    if (micro <= NAVIGO_NET) return null;
    return {
      icon: 'bike', title: 'Trottinettes & VTC : passe au Navigo',
      text: `${n} trajets Voi / Lime / Dott et VTC, soit ${M.eur(micro)}/mois. Un pass Navigo (≈ 90 €, remboursé à 50 % par ton employeur) te reviendrait à ≈ ${NAVIGO_NET} €.`,
      gain: micro - NAVIGO_NET,
    };
  }

  function foodInsights(model) {
    const a = model.avg.cat;
    const out = [];
    if (a.livraison > 30) out.push({ icon: 'bag', title: 'Livraison de repas (Uber Eats, Deliveroo)', text: `${M.eur(a.livraison)}/mois en moyenne. Diviser par deux = cuisiner 1 à 2 soirs de plus par semaine.`, gain: a.livraison * 0.5 });
    if (a.restos > 100) out.push({ icon: 'cup', title: 'Restaurants, cafés & bars', text: `${M.eur(a.restos)}/mois réglés à la carte BNP (sans compter ce qui passe par Revolut). Un objectif −30 % reste confortable.`, gain: a.restos * 0.3 });
    return out;
  }

  function subscriptionInsights(model) {
    const out = [];
    const find = (name) => model.recurring.find((r) => r.name === name && r.active);
    const travel = find('BNP – option Travel');
    const bnpFees = root.BudgetAnalytics.sum(model.recurring.filter((r) => r.active && r.name.startsWith('BNP')), (r) => r.monthly);
    if (travel) out.push({ icon: 'bank', title: "Option Travel BNP : doublon avec Revolut", text: `${M.eurCents(travel.monthly)}/mois pour payer à l'étranger sans frais, alors que Revolut le fait déjà. Au total (Esprit Libre, Travel, assurance Nomade), la BNP te coûte ${M.eur(bnpFees * 12)}/an.`, gain: travel.monthly });
    const extras = ['Opodo Prime', 'Uber One'].map(find).filter(Boolean);
    if (extras.length) out.push({ icon: 'repeat', title: 'Abonnements peu rentables', text: `${extras.map((e) => `${e.name} (${M.eurCents(e.monthly)}/mois)`).join(', ')} : utiles seulement si tu réserves des vols / commandes très souvent.`, gain: root.BudgetAnalytics.sum(extras, (e) => e.monthly) });
    const tel = model.avg.last3Cat.telecom;
    if (tel > TELECOM_TARGET + 10) out.push({ icon: 'phone', title: 'Box + mobile Bouygues', text: `${M.eur(tel)}/mois pour deux lignes. Des offres box fibre + forfait mobile existent autour de ${TELECOM_TARGET} €/mois : renégocie ou change d'opérateur.`, gain: tel - TELECOM_TARGET });
    return out;
  }

  function otherInsights(model) {
    const a = model.avg.cat, out = [];
    if (a.shopping > 100) out.push({ icon: 'bag', title: 'Shopping (Amazon, vêtements…)', text: `${M.eur(a.shopping)}/mois en moyenne. Règle des 48 h avant tout achat non essentiel : objectif −40 %.`, gain: a.shopping * 0.4 });
    if (a.especes > 40) out.push({ icon: 'cash', title: "Retraits d'espèces", text: `${M.eur(a.especes)}/mois retirés en liquide : c'est de la dépense invisible. Passe par Revolut pour garder la trace.`, gain: 0 });
    return out;
  }

  function buildInsights(model) {
    if (!model.n) return [];
    const list = [trendInsight(model), revolutInsight(model), transportInsight(model), ...foodInsights(model), ...subscriptionInsights(model), ...otherInsights(model)].filter(Boolean);
    return list.sort((x, y) => (y.alert ? 1 : 0) - (x.alert ? 1 : 0) || y.gain - x.gain);
  }

  root.SavingsInsights = { buildInsights, NAVIGO_NET };
})(window);
