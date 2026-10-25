/* État de l'application : relevés, préférences de catégorie, réglages du simulateur.
   Persisté dans le navigateur (localStorage), une entrée par profil (ProfileRegistry) — rien ne quitte l'ordinateur. */
(function (root) {
  const storeKey = () => root.ProfileRegistry.storeKey('budget-bnp.v1');
  const DEFAULT_SETTINGS = {
    newSalary: 0, includeExtraIncome: true, planInitialized: false, revolut: 0, goal: 10000, startAmount: 0,
    rate: 0, targets: {}, cancelled: [], applySimilar: true, horizon: 24,
    ...((root.ProfileRegistry.isMain() && root.PERSONAL_DEFAULTS) || {}).settings,  // valeurs perso : fichier local data/personal-defaults.js
  };

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const isValidStatement = (s) => s && typeof s.id === 'string' && s.period && typeof s.period.from === 'string' && Array.isArray(s.ops);
  const listeners = [];
  let state = null;

  function freshState() {
    // relevés de départ (fichier local) : seulement pour le profil principal
    return { statements: clone(root.ProfileRegistry.isMain() ? root.SEED_STATEMENTS || [] : []), prefs: { opOverrides: {}, merchantRules: {} }, settings: clone(DEFAULT_SETTINGS), wealth: clone(root.WealthProfile.DEFAULT_WEALTH), chat: [] };
  }

  /* Complète un état chargé avec les champs ajoutés depuis (patrimoine, chat…). */
  function normalize(data) {
    return {
      ...freshState(), ...data,
      prefs: { opOverrides: {}, merchantRules: {}, ...data.prefs },
      settings: { ...clone(DEFAULT_SETTINGS), ...data.settings },
      wealth: { ...clone(root.WealthProfile.DEFAULT_WEALTH), ...data.wealth },
      chat: Array.isArray(data.chat) ? data.chat : [],
    };
  }

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(storeKey()));
      if (saved && Array.isArray(saved.statements) && saved.statements.every(isValidStatement)) {
        state = normalize(saved);
        return state;
      }
    } catch (e) { /* stockage indisponible : on repart des données initiales */ }
    state = freshState();
    return state;
  }

  function save() {
    try { localStorage.setItem(storeKey(), JSON.stringify(state)); } catch (e) { /* mode privé */ }
    listeners.forEach((fn) => fn(state));
  }

  const Store = {
    load,
    get: () => state,
    subscribe: (fn) => listeners.push(fn),

    upsertStatement(st) {
      const clean = { id: st.id, period: st.period, open: st.open, close: st.close, ops: st.ops, check: { totalsOk: st.check.totalsOk, balanceOk: st.check.balanceOk } };
      const i = state.statements.findIndex((s) => s.id === st.id);
      if (i >= 0) state.statements[i] = clean; else state.statements.push(clean);
      state.statements.sort((a, b) => a.id.localeCompare(b.id));
      save();
      return i >= 0 ? 'remplacé' : 'ajouté';
    },

    removeStatement(id) {
      state.statements = state.statements.filter((s) => s.id !== id);
      save();
    },

    /* Change la catégorie d'une opération, et optionnellement de tout le marchand. */
    setCategory(op, cat, similar) {
      if (similar) {
        state.prefs.merchantRules[root.Categorizer.merchantKey(op.label)] = cat;
        Object.keys(state.prefs.opOverrides).forEach((id) => {
          const same = state.statements.some((s) => s.ops.some((o) => o.id === id && root.Categorizer.merchantKey(o.label) === root.Categorizer.merchantKey(op.label)));
          if (same) delete state.prefs.opOverrides[id];
        });
      } else {
        state.prefs.opOverrides[op.id] = cat;
      }
      save();
    },

    updateSettings(patch, silent) {
      Object.assign(state.settings, patch);
      if (silent) { try { localStorage.setItem(storeKey(), JSON.stringify(state)); } catch (e) { /* ignore */ } return; }
      save();
    },

    updateWealth(patch, silent) {
      Object.assign(state.wealth, patch);
      if (silent) { try { localStorage.setItem(storeKey(), JSON.stringify(state)); } catch (e) { /* ignore */ } return; }
      save();
    },

    /* Historique du chat : persisté sans re-rendre toute l'appli. */
    setChat(messages) {
      state.chat = messages.slice(-40);
      try { localStorage.setItem(storeKey(), JSON.stringify(state)); } catch (e) { /* ignore */ }
    },

    exportJSON: () => JSON.stringify(state, null, 1),

    importJSON(text) {
      const data = JSON.parse(text);
      if (!Array.isArray(data.statements)) throw new Error('Fichier de sauvegarde invalide');
      if (!data.statements.every(isValidStatement)) throw new Error('Sauvegarde corrompue : relevés illisibles');
      state = normalize(data);
      save();
    },

    reset() { state = freshState(); save(); },
    resetSimulator() { state.settings = { ...state.settings, targets: {}, cancelled: [], revolut: DEFAULT_SETTINGS.revolut, planInitialized: true }; save(); },
  };

  root.Store = Store;
})(window);
