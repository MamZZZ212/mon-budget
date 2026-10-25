/* Prompt système de l'assistant : rôle, règles et résumé chiffré du budget (pas les opérations brutes). */
(function (root) {
  const M = root.Money;
  const NOTE_RE = /\[\[NOTE:\s*([^\]]+?)\s*\]\]/g;

  const ROLE = `Tu es l'assistant budget personnel intégré à l'appli « Mon Budget » de l'utilisateur. Tu le tutoies, en français.
Ton objectif : l'aider à épargner le plus possible, avec des conseils concrets et chiffrés à partir de SES données ci-dessous.

Règles :
- Appuie-toi sur les chiffres fournis ; montre tes calculs simplement. Si une donnée manque, dis-le et pose une question précise.
- Le virement vers Revolut est considéré comme dépensé à 100 % : tu ne vois pas le détail des dépenses Revolut.
- Les montants brut → net du bonus sont des estimations (cotisations et taux de prélèvement à la source réglables dans l'appli) : signale-le.
- Tu peux expliquer les mécanismes généraux (épargne de précaution, PEE/PEI et abondement, blocage 5 ans et cas de déblocage anticipé, fiscalité générale), mais ne recommande pas de produit financier ou de placement précis : pour ces choix, renvoie vers un conseiller financier agréé.
- Réponses courtes et structurées (listes, gras pour les montants clés). Pas de tableaux larges.
- Quand l'utilisateur te donne une information durable qui n'est pas encore dans ses données (patrimoine, revenu, projet, contrainte, échéance), termine ta réponse par une ligne par information au format exact : [[NOTE: fait concis avec montant et date]]. L'appli lui proposera de l'enregistrer.`;

  function list(items) { return items.map((s) => `- ${s}`).join('\n'); }

  function budgetSection(model, s) {
    const a = model.avg;
    const cats = model.CATEGORIES.filter((c) => c.kind === 'depense' && a.cat[c.id] > 1)
      .sort((x, y) => a.cat[y.id] - a.cat[x.id]).map((c) => `${c.label} : ${M.eur(a.cat[c.id])}/mois`);
    const months = model.cycles.map((c) => `${c.label} : rentrées ${M.eur(c.income)}, dépenses ${M.eur(c.expense)}, solde fin ${M.eur(c.close)}`);
    const subs = model.recurring.filter((r) => r.active).map((r) => `${r.name} : ${M.eurCents(r.monthly)}/mois`);
    return `## Budget (relevés BNP, ${model.n} mois ; un mois = relevé du 21 au 21)
${list([
    `Solde BNP actuel : ${M.eur(model.balance)}`,
    `Rentrées moyennes : ${M.eur(a.income)}/mois (salaire net moyen ${M.eur(a.salary)}, autres ${M.eur(a.extraIncome)})`,
    `Dépenses moyennes : ${M.eur(a.expense)}/mois (médiane ${M.eur(a.expenseMedian)}) ; épargne nette moyenne ${M.signed(a.net)}/mois`,
    `Nouveau salaire net prévu : ${M.eur(s.newSalary)}/mois`,
  ])}
### Dépenses moyennes par catégorie
${list(cats)}
### Par mois
${list(months)}
### Prélèvements récurrents actifs
${list(subs)}`;
  }

  function planSection(model, s) {
    const { plan, list: sc } = root.SavingsSimulator.scenarios(model, s);
    return `## Simulateur (réglages actuels de l'utilisateur)
${list(sc.map((x) => `${x.label} : ${M.eur(x.income)} − ${M.eur(x.expense)} = ${M.signed(x.saving)}/mois (taux ${M.pct(x.rate)})`))}
- Plan : fixes ${M.eur(plan.lines.fixe)}, abonnements ${M.eur(plan.lines.abonnements)}, Revolut ${M.eur(plan.lines.revolut)}, variables ${M.eur(plan.lines.variable)}
- Abonnements que l'utilisateur prévoit de résilier : ${s.cancelled.join(', ') || 'aucun'}
- Objectif d'épargne : ${M.eur(s.goal)}`;
  }

  function wealthSection(w) {
    const b = root.WealthProfile.bonusNet(w);
    const notes = w.notes.length ? list(w.notes.map((n) => n.text)) : '- (aucune)';
    return `## Patrimoine et revenus exceptionnels
${list([
    `Épargne salariale (PEE/PEI inter-entreprises) : ${M.eur(w.peeBalance)} + abondement attendu ${M.eur(w.peeAbondement)} (${w.peeAbondementMonth}) = ${M.eur(root.WealthProfile.peeTotal(w))}`,
    `Bonus annuel attendu : ${M.eur(w.bonusGrossMin)} à ${M.eur(w.bonusGrossMax)} brut, versement prévu ${w.bonusMonth}`,
    `Estimation nette (×${w.bonusNetRate} % puis prélèvement à la source ${w.bonusTaxRate} %) : ${M.eur(b.min)} à ${M.eur(b.max)} ; part prévue en épargne ${w.bonusSavePct} % ≈ ${M.eur(b.saved)}`,
  ])}
### Autres éléments donnés par l'utilisateur
${notes}`;
  }

  function buildSystemPrompt(model, state) {
    const today = new Date().toISOString().slice(0, 10);
    if (!model.n) return `${ROLE}\n\nDate du jour : ${today}. Aucun relevé importé pour l'instant.\n\n${wealthSection(state.wealth)}`;
    return `${ROLE}\n\nDate du jour : ${today}.\n\n${budgetSection(model, state.settings)}\n\n${planSection(model, state.settings)}\n\n${wealthSection(state.wealth)}`;
  }

  /* Sépare le texte affiché des notes proposées par l'assistant. */
  function extractNotes(reply) {
    const notes = [...reply.matchAll(NOTE_RE)].map((m) => m[1]);
    return { text: reply.replace(NOTE_RE, '').trim(), notes };
  }

  root.ChatContext = { buildSystemPrompt, extractNotes };
})(window);
