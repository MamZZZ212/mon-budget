/* Classement d'une opération : marchand, pays, catégorie (règles utilisateur > règles intégrées). */
(function (root) {
  const R = typeof module !== 'undefined' && module.exports ? require('./category-rules.js') : root.CategoryRules;

  const titleCase = (s) => s.toLowerCase().replace(/(^|[\s\-/*.])([a-zà-ÿ])/g, (m, p, c) => p + c.toUpperCase());

  /* Clé stable du marchand, utilisée pour mémoriser les choix de catégorie. */
  function merchantKey(label) {
    const L = label.toUpperCase();
    const card = L.match(/DU \d{6} ([^|]+)/);
    if (card && !/^VIR|^PRLV/.test(L)) {
      return card[1]
        .replace(/PAYLI\d+\/?|PARIS\d+\/?|\*+\d+\*?|\s\d{2,}.*$/g, '')
        .replace(/\s+(PARIS|COURBEVOIE|PUTEAUX)(\s?\d+)?$/, '')
        .replace(/\s+/g, ' ').trim();
    }
    if (/^VIR .*EMIS/.test(L)) return 'VIR → ' + ((L.match(/\/BEN ([^/]+?) \/REF/) || [])[1] || 'Bénéficiaire').trim();
    if (/^VIR .*RECU/.test(L)) return 'VIR ← ' + ((L.match(/\/DE ([^/]+?) \//) || [])[1] || 'Émetteur').trim();
    const prlv = L.match(/^PRLV SEPA (.+?) ECH/);
    if (prlv) return 'PRLV ' + prlv[1].trim();
    if (/^RETRAIT DAB/.test(L)) return 'RETRAIT DAB';
    if (/^VRST/.test(L)) return 'VRST ESPECES';
    if (/COMMISSIONS/.test(L)) return /TRAVEL/.test(L) ? 'BNP OPTION TRAVEL' : 'BNP ESPRIT LIBRE';
    return L.split('|')[0].trim().slice(0, 40);
  }

  /* Code pays ISO de la 2e ligne d'un paiement carte, ex. « ESP 31,00EUR ». */
  function countryOf(label) {
    const m = label.match(/\| ([A-Z]{3}) [\d ,]+[A-Z]{3}\b/);
    return m ? m[1] : null;
  }

  function merchantName(label) {
    const L = label.toUpperCase();
    const known = R.KNOWN_MERCHANTS.find(([re]) => re.test(L));
    if (known) return known[1];
    const k = merchantKey(label);
    if (k.startsWith('VIR ')) return k.slice(0, 6) + titleCase(k.slice(6));
    return titleCase(k);
  }

  const match = (rules, L) => (rules.find(([, re]) => re.test(L)) || [])[0];

  const KIND = Object.fromEntries(R.CATEGORIES.map((c) => [c.id, c.kind]));

  /* Un débit ne peut pas être une rentrée (ex. cotisation mutuelle prélevée). */
  function signSafe(cat, op) {
    if (KIND[cat] !== 'revenu' || op.amount >= 0) return cat;
    return /MUTUELLE|GENERATION/.test(op.label.toUpperCase()) ? 'banque' : 'autres';
  }

  function builtinCategory(op) {
    const L = op.label.toUpperCase();
    const strong = match(R.STRONG_RULES, L);
    if (strong) return signSafe(strong, op);
    const country = countryOf(op.label);
    if (country && !R.HOME_COUNTRIES.has(country)) return 'voyages';
    const detail = match(R.DETAIL_RULES, L);
    if (detail) return detail;
    return op.amount > 0 ? 'autres_revenus' : 'autres';
  }

  /* prefs : { opOverrides: {opId: cat}, merchantRules: {merchantKey: cat} } */
  function categorize(op, prefs) {
    if (prefs && prefs.opOverrides && prefs.opOverrides[op.id]) return prefs.opOverrides[op.id];
    const key = merchantKey(op.label);
    if (prefs && prefs.merchantRules && prefs.merchantRules[key]) return prefs.merchantRules[key];
    return builtinCategory(op);
  }

  const api = { merchantKey, merchantName, countryOf, categorize, builtinCategory };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Categorizer = api;
})(typeof window !== 'undefined' ? window : globalThis);
