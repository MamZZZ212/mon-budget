/* Vue d'ensemble : KPI, évolution mensuelle, répartition, pistes d'économies. */
(function (root) {
  const M = root.Money;
  const K = root.ChartKit;

  function kpi(label, value, sub, cls = '') {
    return `<div class="card kpi ${cls}"><div class="label">${label}</div><div class="value num">${value}</div><div class="sub">${sub}</div></div>`;
  }

  function kpiRow(model, sc) {
    const a = model.avg, last = model.cycles[model.n - 1];
    const w = root.Store.get().wealth, bonus = root.WealthProfile.bonusNet(w);
    const delta = model.firstBalance != null ? model.balance - model.firstBalance : 0;
    const subs = model.recurring.filter((r) => ['abonnements', 'sport'].includes(r.cat) && r.active);
    const subsMonthly = root.BudgetAnalytics.sum(subs, (r) => r.monthly);
    return `<div class="grid kpis">
      ${kpi('Solde BNP actuel', M.eur(model.balance), `au ${M.date(last.period.to)} · ${M.signed(delta)} en ${model.n} mois`, 'hero')}
      ${kpi('Rentrées moyennes', M.eur(a.income), `dont salaire ${M.eur(a.salary)}`)}
      ${kpi('Dépenses moyennes', M.eur(a.expense), `médiane ${M.eur(a.expenseMedian)} · Revolut inclus`)}
      ${kpi('Épargne réelle / mois', `<span class="${a.net >= 0 ? 'pos' : 'neg'}">${M.signed(a.net)}</span>`, `taux d'épargne ${M.pct(a.net / a.income)}`)}
      ${kpi('Charges fixes / mois', M.eur(a.groups.fixe), 'loyer, énergie, télécom, banque, impôts')}
      ${kpi('Abonnements / mois', M.eur(subsMonthly), `${subs.length} actifs · ${M.eur(subsMonthly * 12)}/an`)}
      ${kpi('Épargne salariale', M.eur(root.WealthProfile.peeTotal(w)), `PEE/PEI ${M.eur(w.peeBalance)} + abondement ${M.eur(w.peeAbondement)}`)}
      ${kpi('Bonus attendu (net)', `${M.eur(bonus.min)} – ${M.eur(bonus.max)}`, `${M.eur(w.bonusGrossMin)}–${M.eur(w.bonusGrossMax)} brut · ${M.escape(w.bonusMonth)}`)}
    </div>`;
  }

  function projectionBanner(sc, s) {
    const hausse = sc.list[1], plan = sc.list[2];
    return `<div class="card mt"><div class="row">
      <div style="flex:1;min-width:260px"><h2>Avec ton augmentation à ${M.eur(s.newSalary)} net</h2>
      <p class="small" style="margin:4px 0 0">Dépenses inchangées : <b class="${hausse.saving >= 0 ? 'pos' : 'neg'}">${M.signed(hausse.saving)}/mois</b>. Avec le plan optimisé : <b class="pos">${M.signed(plan.saving)}/mois</b>, soit <b>${M.eur(plan.after12)}</b> épargnés en un an bonus inclus (taux ${M.pct(plan.rate)}).</p></div>
      <a class="btn primary" style="white-space:nowrap" href="#simulateur">${root.icon('target')} Ouvrir le simulateur</a></div></div>`;
  }

  function insightsCard(insights) {
    const total = root.BudgetAnalytics.sum(insights, (i) => i.gain);
    const items = insights.map((i) => `<div class="insight ${i.alert ? 'alert' : ''}"><div class="ico">${root.icon(i.icon)}</div>
      <div><h4>${i.title}</h4><p>${i.text}</p></div>
      <div class="gain num">${i.gain > 1 ? `+${M.eur(i.gain)}<small>par mois</small>` : ''}</div></div>`).join('');
    return `<div class="card"><div class="card-head"><div><h2>Pistes d'économies</h2><p>Calculées sur tes moyennes réelles</p></div>
      <span class="badge good">Potentiel ≈ ${M.eur(total)}/mois · ${M.eur(total * 12)}/an</span></div>${items}</div>`;
  }

  function foodCard(model) {
    const a = model.avg.cat;
    const parts = [['courses', 'Courses'], ['restos', 'Restos & cafés'], ['livraison', 'Livraison'], ['dejeuner', 'Déjeuners boulot']];
    const max = Math.max(...parts.map(([id]) => a[id]), 1);
    const rows = parts.map(([id, l]) => `<div style="margin:10px 0"><div class="row"><span>${l}</span><span class="spacer"></span><b class="num">${M.eur(a[id])}</b></div>
      <div class="bar-track mt" style="margin-top:6px"><div class="bar-fill" style="width:${(a[id] / max) * 100}%"></div></div></div>`).join('');
    return `<div class="card"><div class="card-head"><div><h2>Budget bouffe</h2><p>Moyenne mensuelle payée à la carte BNP</p></div>
      <span class="badge">${M.eur(model.avg.food)}/mois</span></div>${rows}
      <p class="small">Les dépenses faites avec Revolut ne sont pas détaillées ici (elles sont comptées dans « Revolut »).</p></div>`;
  }

  function render(el, model) {
    if (!model.n) { el.innerHTML = '<div class="card empty">Aucun relevé : importe un relevé BNP pour commencer.</div>'; return; }
    const s = root.Store.get().settings;
    const sc = root.SavingsSimulator.scenarios(model, s);
    el.innerHTML = `<div class="page-head"><div><h1>Vue d'ensemble</h1><p>${model.n} mois analysés, du ${M.date(model.cycles[0].period.from)} au ${M.date(model.cycles[model.n - 1].period.to)} · un « mois » = un relevé, du 21 au 21</p></div></div>
      ${kpiRow(model, sc)}${projectionBanner(sc, s)}
      <div class="grid two mt">
        <div class="card"><div class="card-head"><div><h2>Rentrées vs dépenses</h2><p>Par relevé mensuel</p></div></div><div class="chart-box"><canvas id="ch-inout"></canvas></div></div>
        <div class="card"><div class="card-head"><div><h2>Épargne nette par mois</h2><p>Rentrées − dépenses</p></div></div><div class="chart-box"><canvas id="ch-net"></canvas></div></div>
      </div>
      <div class="grid two mt">
        <div class="card"><div class="card-head"><div><h2>Où part ton argent</h2><p>Moyenne mensuelle par catégorie</p></div></div><div class="chart-box tall"><canvas id="ch-cats"></canvas></div></div>
        <div class="stack">${foodCard(model)}
          <div class="card"><div class="card-head"><div><h2>Solde du compte</h2><p>En fin de relevé</p></div></div><div class="chart-box short"><canvas id="ch-bal"></canvas></div></div></div>
      </div>
      <div class="mt">${insightsCard(root.SavingsInsights.buildInsights(model))}</div>`;
    drawCharts(model);
  }

  function drawCharts(model) {
    const labels = model.cycles.map((c) => c.chartLabel);
    K.groupedBars('ch-inout', labels, [
      { label: 'Rentrées', data: model.cycles.map((c) => c.income), color: K.css('--series-1') },
      { label: 'Dépenses', data: model.cycles.map((c) => c.expense), color: K.css('--series-2') },
    ]);
    K.signedBars('ch-net', labels, model.cycles.map((c) => c.net), 'Épargne nette');
    K.lines('ch-bal', labels, [{ label: 'Solde', data: model.cycles.map((c) => c.close), color: K.css('--series-1'), points: true }], { beginAtZero: true });
    const cats = model.CATEGORIES.filter((c) => c.kind === 'depense').map((c) => [c.label, model.avg.cat[c.id]]).filter(([, v]) => v > 1).sort((x, y) => y[1] - x[1]);
    K.horizontalBars('ch-cats', cats.map(([l]) => l), cats.map(([, v]) => v), 'Moyenne / mois');
  }

  root.OverviewView = { render };
})(window);
