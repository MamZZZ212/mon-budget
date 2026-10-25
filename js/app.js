/* Point d'entrée : navigation par onglets (hash), thème, reconstruction du modèle à chaque changement. */
(function (root) {
  const VIEWS = [
    { id: 'apercu', label: "Vue d'ensemble", icon: 'home', view: () => root.OverviewView },
    { id: 'depenses', label: 'Dépenses', icon: 'pie', view: () => root.SpendingView },
    { id: 'abonnements', label: 'Abonnements', icon: 'repeat', view: () => root.SubscriptionsView },
    { id: 'operations', label: 'Opérations', icon: 'list', view: () => root.OperationsView },
    { id: 'simulateur', label: 'Simulateur', icon: 'target', view: () => root.SimulatorPage },
    { id: 'assistant', label: 'Assistant', icon: 'chat', view: () => root.AssistantView },
    { id: 'import', label: 'Importer', icon: 'upload', view: () => root.ImportView },
  ];
  let model = null;
  let toastTimer = null;

  const currentId = () => (VIEWS.find((v) => '#' + v.id === location.hash) || VIEWS[0]).id;

  function buildNav() {
    const nav = document.getElementById('nav');
    nav.innerHTML = VIEWS.map((v) => `<button class="nav-btn" data-view="${v.id}">${root.icon(v.icon)}<span>${v.label}</span></button>`).join('');
    nav.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => { location.hash = b.dataset.view; }));
  }

  function rerender() {
    const id = currentId();
    document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-current', b.dataset.view === id ? 'page' : 'false'));
    const el = document.getElementById('view');
    VIEWS.find((v) => v.id === id).view().render(el, model);
  }

  function rebuild() {
    model = root.BudgetAnalytics.buildModel(root.Store.get());
    const s = root.Store.get().settings;
    if (!s.planInitialized && model.n) {
      root.Store.updateSettings({ ...root.SavingsSimulator.suggestedSettings(model), planInitialized: true }, true);
    }
    rerender();
  }

  function initTheme() {
    let saved = null;
    try { saved = localStorage.getItem('budget-bnp.theme'); } catch (e) { /* ignore */ }
    if (saved) document.documentElement.dataset.theme = saved;
    document.getElementById('theme').addEventListener('click', () => {
      const dark = document.documentElement.dataset.theme
        ? document.documentElement.dataset.theme === 'dark'
        : matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.dataset.theme = dark ? 'light' : 'dark';
      try { localStorage.setItem('budget-bnp.theme', document.documentElement.dataset.theme); } catch (e) { /* ignore */ }
      rerender();
    });
  }

  root.App = {
    rerender,
    toast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
    },
  };

  document.addEventListener('DOMContentLoaded', () => {
    if (root.pdfjsLib) root.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    root.Store.load();
    root.Store.subscribe(rebuild);
    buildNav();
    initTheme();
    window.addEventListener('hashchange', () => { rerender(); window.scrollTo(0, 0); });
    rebuild();
  });
})(window);
