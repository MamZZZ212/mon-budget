/* Patrimoine et revenus exceptionnels : épargne salariale (PEE/PEI + abondement) et bonus annuel. */
(function (root) {
  const DEFAULT_WEALTH = {
    peeBalance: 0,             // épargne inter-entreprises actuelle
    peeAbondement: 0,          // abondement employeur attendu
    peeAbondementMonth: '',
    bonusGrossMin: 0,
    bonusGrossMax: 0,
    bonusNetRate: 77,          // % brut → net avant impôt (cotisations salariales ≈ 23 %)
    bonusTaxRate: 0,           // % taux de prélèvement à la source (fiche de paie)
    bonusMonth: '',
    bonusSavePct: 80,          // part du bonus mise de côté
    notes: [],                 // éléments ajoutés via l'assistant
    ...((root.ProfileRegistry.isMain() && root.PERSONAL_DEFAULTS) || {}).wealth,  // valeurs perso : fichier local data/personal-defaults.js
  };

  const pct = (v) => (Number(v) || 0) / 100;

  /* Bonus net après cotisations et prélèvement à la source. */
  function bonusNet(w) {
    const k = pct(w.bonusNetRate) * (1 - pct(w.bonusTaxRate));
    const min = w.bonusGrossMin * k, max = w.bonusGrossMax * k;
    return { min, max, mid: (min + max) / 2, saved: ((min + max) / 2) * pct(w.bonusSavePct) };
  }

  /* Nombre de mois entre le mois courant et "AAAA-MM" (0 = ce mois-ci). */
  function monthsFromNow(ym, now = new Date()) {
    if (!/^\d{4}-\d{2}$/.test(ym || '')) return -1;
    const [y, m] = ym.split('-').map(Number);
    return (y - now.getFullYear()) * 12 + (m - 1 - now.getMonth());
  }

  /* Versements ponctuels sur l'épargne disponible, par mois de projection (index 1 = mois prochain).
     L'abondement va sur le PEE (bloqué) : il n'y figure pas. */
  function lumpSums(w, horizon) {
    const lumps = new Array(horizon + 1).fill(0);
    const offset = monthsFromNow(w.bonusMonth);
    const i = Math.max(1, offset);
    if (offset >= 0 && i <= horizon) lumps[i] += bonusNet(w).saved;
    return lumps;
  }

  function peeTotal(w) {
    return (Number(w.peeBalance) || 0) + (Number(w.peeAbondement) || 0);
  }

  root.WealthProfile = { DEFAULT_WEALTH, bonusNet, lumpSums, peeTotal, monthsFromNow };
})(window);
