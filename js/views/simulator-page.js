/* Page Simulateur : assemblage des cartes et écoute des réglages. */
(function (root) {
  const V = root.SimulatorView;

  function render(el, model) {
    if (!model.n) { el.innerHTML = '<div class="card empty">Importe au moins un relevé pour simuler ton épargne.</div>'; return; }
    const s = root.Store.get().settings;
    const plan = root.SavingsSimulator.planBudget(model, s);
    el.innerHTML = `<div class="page-head"><div><h1>Simulateur d'épargne</h1><p>Teste ton budget idéal avec ton nouveau salaire</p></div>
      <div class="row"><button class="btn primary" id="sim-suggest">${root.icon('target')} Appliquer le plan suggéré</button><button class="btn" id="sim-reset">Revenir à mes moyennes</button></div></div>
      <div class="sim-grid">
        <div class="stack">${V.incomeCard(model, s)}${V.wealthCard(root.Store.get().wealth)}${V.budgetCard(model, s, plan)}${V.subsCard(plan, s)}</div>
        <div class="sim-results" id="sim-results"></div>
      </div>`;
    V.renderResults(el, model);
    bind(el, model);
  }

  function bind(el, model) {
    const store = root.Store;
    el.querySelectorAll('[data-set]').forEach((inp) => inp.addEventListener(inp.type === 'checkbox' ? 'change' : 'input', () => {
      const v = inp.type === 'checkbox' ? inp.checked : parseFloat(inp.value) || 0;
      store.updateSettings({ [inp.dataset.set]: v }, true);
      V.renderResults(el, model);
    }));
    el.querySelectorAll('[data-wealth]').forEach((inp) => inp.addEventListener('input', () => {
      const v = inp.type === 'month' ? inp.value : parseFloat(inp.value) || 0;
      store.updateWealth({ [inp.dataset.wealth]: v }, true);
      const b = root.WealthProfile.bonusNet(store.get().wealth);
      el.querySelector('[data-bonus-net]').textContent = `${root.Money.eur(b.min)} – ${root.Money.eur(b.max)}`;
      el.querySelector('[data-bonus-saved]').textContent = root.Money.eur(b.saved);
      V.renderResults(el, model);
    }));
    el.querySelectorAll('[data-target]').forEach((r) => r.addEventListener('input', () => {
      const id = r.dataset.target, v = +r.value;
      el.querySelector(`[data-val="${id}"]`).textContent = root.Money.eur(v);
      if (id === 'revolut') store.updateSettings({ revolut: v }, true);
      else store.updateSettings({ targets: { ...store.get().settings.targets, [id]: v } }, true);
      V.renderResults(el, model);
    }));
    el.querySelectorAll('[data-cancel]').forEach((cb) => cb.addEventListener('change', () => {
      const list = store.get().settings.cancelled.filter((n) => n !== cb.dataset.cancel);
      if (cb.checked) list.push(cb.dataset.cancel);
      store.updateSettings({ cancelled: list }, true);
      V.renderResults(el, model);
    }));
    el.querySelector('#sim-suggest').addEventListener('click', () => {
      store.updateSettings(root.SavingsSimulator.suggestedSettings(model));
      root.App.toast('Plan suggéré appliqué : ajuste les curseurs à ta convenance');
    });
    el.querySelector('#sim-reset').addEventListener('click', () => store.resetSimulator());
  }

  root.SimulatorPage = { render };
})(window);
