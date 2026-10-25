/* Catégories budgétaires et règles de classement automatique des opérations BNP. */
(function (root) {
  /* kind : depense | revenu | neutre — group : fixe | abonnement | variable | revolut */
  const CATEGORIES = [
    { id: 'loyer', label: 'Loyer', kind: 'depense', group: 'fixe' },
    { id: 'energie', label: 'Énergie (EDF)', kind: 'depense', group: 'fixe' },
    { id: 'telecom', label: 'Téléphone & Internet', kind: 'depense', group: 'fixe' },
    { id: 'banque', label: 'Banque & assurances', kind: 'depense', group: 'fixe' },
    { id: 'impots', label: 'Impôts', kind: 'depense', group: 'fixe' },
    { id: 'abonnements', label: 'Abonnements numériques', kind: 'depense', group: 'abonnement' },
    { id: 'sport', label: 'Sport & bien-être', kind: 'depense', group: 'abonnement' },
    { id: 'revolut', label: 'Revolut (dépenses courantes)', kind: 'depense', group: 'revolut' },
    { id: 'courses', label: 'Courses alimentaires', kind: 'depense', group: 'variable', food: true },
    { id: 'restos', label: 'Restaurants, cafés & bars', kind: 'depense', group: 'variable', food: true },
    { id: 'livraison', label: 'Livraison de repas', kind: 'depense', group: 'variable', food: true },
    { id: 'dejeuner', label: 'Déjeuners au travail', kind: 'depense', group: 'variable', food: true },
    { id: 'transport', label: 'Transport & trottinettes', kind: 'depense', group: 'variable' },
    { id: 'shopping', label: 'Shopping & beauté', kind: 'depense', group: 'variable' },
    { id: 'loisirs', label: 'Loisirs & sorties', kind: 'depense', group: 'variable' },
    { id: 'voyages', label: 'Voyages', kind: 'depense', group: 'variable' },
    { id: 'sante', label: 'Santé', kind: 'depense', group: 'variable' },
    { id: 'cadeaux', label: 'Cadeaux & virements à des proches', kind: 'depense', group: 'variable' },
    { id: 'especes', label: "Retraits d'espèces", kind: 'depense', group: 'variable' },
    { id: 'autres', label: 'Autres / à classer', kind: 'depense', group: 'variable' },
    { id: 'salaire', label: 'Salaire', kind: 'revenu' },
    { id: 'frais_pro', label: 'Remboursements de frais pro', kind: 'revenu' },
    { id: 'remb_sante', label: 'Remboursements santé', kind: 'revenu' },
    { id: 'entrees', label: 'Virements reçus (proches, amis)', kind: 'revenu' },
    { id: 'autres_revenus', label: 'Autres entrées (dépôts…)', kind: 'revenu' },
    { id: 'interne', label: 'Transferts internes (exclus)', kind: 'neutre' },
  ];

  /* Règles fortes : testées avant la détection « paiement à l'étranger ». */
  const STRONG_RULES = [
    ['interne', /BOURSORAMA|BOURSOBANK/],
    ['revolut', /REVOLUT/],
    ['salaire', /SALAIRE DE \d{4}/],
    ['frais_pro', /RECU \/DE KPMG/],
    ['remb_sante', /CPAM|\/DE GENERATION|MUTUELLE|AMELI/],
    ['loyer', /\bBAIL\b|LOYER|\/BEN GEC/],
    ['energie', /\bEDF\b|ENGIE|TOTALENERGIES/],
    ['telecom', /BOUYGUES|FREE MOBILE|FREE TELECOM|\bSFR\b|\bSOSH\b|ORANGE SA/],
    ['banque', /COMMISSIONS|ASSURANCE NOMADE|MATMUT|AXA|MAIF|MACIF/],
    ['impots', /DGFIP|IMPOT/],
    ['abonnements', /SPOTIFY|NETFLIX|APPLE\.COM|CLAUDE\.AI|ANTHROPIC|MICROSOFT|UBER \*ONE|OPODO PRIME|MONDE DIPLO|DISNEY|CANAL\+|YOUTUBE|OPENAI|CHATGPT|DEEZER|PRIME VIDEO|AMAZON PRIME/],
    ['sport', /WELLNESS TRAINING|WELLPASS|NEONESS|BASIC.?FIT|FITNESS PARK|HOMEFITNESS|PLAYTOMIC|PADEL|ON AIR/],
    ['especes', /^RETRAIT DAB/],
    ['cadeaux', /POT COMMUN|LEETCHI|FLEURS/],
    ['autres_revenus', /^VRST/],
    ['cadeaux', /^VIR .*EMIS/],
    ['entrees', /^VIR .*RECU/],
    ['shopping', /AMAZON|\bCOS\b|ZARA|GYMSHARK|ON SPORTSWEAR|RITUALS|AROMA-ZONE|COSMETICS|BEAUGRENELLE|DECO AFFAIRE|UNIQLO|DECATHLON|FNAC|SEPHORA|H&M|NIKE|ADIDAS/],
  ];

  /* Règles de détail : appliquées après la détection des paiements à l'étranger. */
  const DETAIL_RULES = [
    ['livraison', /UBER ?\* ?EATS|DELIVEROO|JUST ?EAT/],
    ['transport', /DU \d{6} UBER\s*(\||$)|\bVOI\b|LIME\*|DOTT|BOLT\.|UBR\*|UBER \*TRIP|UBER RIDES|NAVIGO|RATP|SNCF|G7|HEETCH/],
    ['voyages', /TRANSAVIA|EASYJET|RYANAIR|AIR FRANCE|VUELING|VOLOTEA|OPODO|BOOKING|AIRBNB|HOSTEL|AIRALO|RENT A CAR|HOTEL|SEZAME|AMBASSADE|TRAINLINE/],
    ['courses', /CARREFOUR|MONOPRIX|MONOP|FRANPRIX|LIDL|INTERMARCHE|AUCHAN|PICARD|LECLERC|\bDIA\b|EXPRESS MARKET|EPICERIE|KANDIS|\bTANG\b|\bG20\b|NATURALIA|BIOCOOP|BOULANGER|LORETTE|FREVA|PRIMEUR/],
    ['dejeuner', /SODEXO|TAKE? EAT|HOUSE FOOD|MISTER GARDEN|WWW\.MISTER|SELECTA|IVS FRANCE|HORETO|MYCHEF|COURBEVOIE|PUTEAUX/],
    ['sante', /PHARMACIE|PHRCIE|\bDR |DOCTEUR|MEDECIN|HEALTH CENTER|DOCTOLIB|DENTISTE|OPTIC|LABORATOIRE/],
    ['loisirs', /PARC AST|BOWLING|WEEZEVENT|LIBRAIRIE|CINEMA|\bUGC\b|PATHE|\bMK2\b|BILLIONAIRE|JUNK|MUSEE|THEATRE|CONCERT|FNAC SPECTACLE/],
    ['restos', /RESTAU|SUSHI|PIZZ|BURGER|KEBAB|CHAWARMA|RAMEN|BRUNCH|CAFE|COFFEE|\bTEA\b|BUBBLE|BAGE|GARRISON|\bZINC\b|THYM ET OLIVE|EXOTICA|HOLYBELLY|ENTREC|MOROCCO|\bMAZA\b|CHAN ET KIM|CHOUKRAN|MANAL|HANDO|SENSO|\bKOI\b|QUICK|AMORINO|MILKI|SWEETEA|CHEZ |SUNSHIN|JCA MAP|SFAXFOODY|AGATA|ROASTY|GARDEN|BELLEVILLE|\bCDR\b|PANTHEON|BRAVO|MAISON SAUVAGE|BON APPART|GRIBOUILLE|MISTRAL|MADELEINE|\bSOV\b|KOD 56|HTL|ALCAZAR|BRASSERIE|BISTRO|\bBAR\b|SC-|SC\./],
  ];

  /* Pays de facturation des services en ligne : ne signalent pas un voyage. */
  const HOME_COUNTRIES = new Set(['FRA', 'NLD', 'IRL', 'LUX', 'GBR', 'EST', 'USA', 'DEU', 'SWE', 'CHE']);

  /* Noms lisibles pour les marchands récurrents (abonnements, charges). */
  const KNOWN_MERCHANTS = [
    [/SPOTIFY/, 'Spotify'], [/NETFLIX/, 'Netflix'], [/APPLE\.COM/, 'Apple (iCloud / App Store)'],
    [/CLAUDE\.AI|ANTHROPIC/, 'Claude.ai'], [/MICROSOFT/, 'Microsoft 365'], [/UBER \*ONE/, 'Uber One'],
    [/OPODO PRIME/, 'Opodo Prime'], [/MONDE DIPLO/, 'Le Monde diplomatique'],
    [/WELLNESS TRAINING/, 'Wellness Training (salle)'], [/WELLPASS/, 'Wellpass (eGym)'],
    [/BOUYGUES.*LIB\/0[67]/, 'Bouygues – forfait mobile'], [/BOUYGUES.*LIB\/09/, 'Bouygues – box internet'],
    [/BOUYGUES/, 'Bouygues Telecom'], [/ESPRIT LIBRE/, 'BNP – offre Esprit Libre'],
    [/OPTION TRAVEL/, 'BNP – option Travel'], [/ASSURANCE NOMADE/, 'BNP – assurance Nomade'],
    [/\bEDF\b/, 'EDF'], [/\bBAIL\b|LOYER/, 'Loyer'], [/REVOLUT/, 'Virement vers Revolut'],
    [/SALAIRE DE/, 'Salaire KPMG'], [/RECU \/DE KPMG/, 'KPMG – notes de frais'], [/DGFIP/, 'Impôts (DGFiP)'],
    [/UBER ?\* ?EATS/, 'Uber Eats'], [/\bVOI\b/, 'Voi (trottinette)'], [/LIME\*/, 'Lime'], [/DOTT/, 'Dott'],
    [/AMAZON/, 'Amazon'], [/^RETRAIT DAB/, "Retrait d'espèces"], [/^VRST/, "Dépôt d'espèces"],
  ];

  const api = { CATEGORIES, STRONG_RULES, DETAIL_RULES, HOME_COUNTRIES, KNOWN_MERCHANTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CategoryRules = api;
})(typeof window !== 'undefined' ? window : globalThis);
