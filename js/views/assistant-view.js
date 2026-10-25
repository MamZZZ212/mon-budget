/* Onglet Assistant : chat avec Claude + ce que l'assistant prend en compte (patrimoine, bonus, notes). */
(function (root) {
  const M = root.Money;
  const W = root.WealthProfile;

  function contextCard(w) {
    const b = W.bonusNet(w);
    const notes = w.notes.map((n, i) => `<li class="note-item"><span>${M.escape(n.text)}</span><button class="btn ghost" data-del-note="${i}" aria-label="Oublier cette note">✕</button></li>`).join('');
    return `<div class="card"><h2>Ce que l'assistant prend en compte</h2>
      <div class="ctx-line"><span>Épargne salariale (PEE/PEI)</span><b class="num">${M.eur(W.peeTotal(w))}</b></div>
      <p class="small" style="margin:0">${M.eur(w.peeBalance)} + abondement ${M.eur(w.peeAbondement)}</p>
      <div class="ctx-line"><span>Bonus attendu (${M.escape(w.bonusMonth)})</span><b class="num">${M.eur(b.min)} – ${M.eur(b.max)} net</b></div>
      <p class="small" style="margin:0">${M.eur(w.bonusGrossMin)} – ${M.eur(w.bonusGrossMax)} brut · ${w.bonusSavePct} % épargné ≈ ${M.eur(b.saved)}</p>
      <a class="btn mt" href="#simulateur" style="width:100%;justify-content:center">Modifier ces montants</a>
      <h3 class="mt">Autres éléments retenus</h3>
      ${notes ? `<ul class="note-list">${notes}</ul>` : '<p class="small">Rien pour l\'instant. Dis-le simplement dans le chat (ex. « j\'ai 3 000 € sur un livret A ») et clique sur « Retenir ».</p>'}
      <form id="note-form" class="row mt"><input type="text" id="note-input" placeholder="Ajouter un élément…" style="flex:1;min-width:0"><button class="btn">Ajouter</button></form>
    </div>`;
  }

  function render(el, model) {
    const state = root.Store.get();
    el.innerHTML = `<div class="page-head"><div><h1>Assistant budget</h1><p>Discute avec Claude de ton budget et de ton épargne</p></div>
      <div class="row"><span class="badge" id="engine-badge">Connexion…</span><button class="btn" id="chat-clear">Nouvelle conversation</button></div></div>
      <div class="assistant-grid">
        <div class="card chat-card">
          <div id="chat-thread" class="chat-thread" aria-live="polite"></div>
          <form id="chat-form" class="chat-form"><textarea id="chat-input" rows="2" placeholder="Écris ton message… (Entrée pour envoyer, Maj+Entrée pour aller à la ligne)"></textarea>
          <button class="btn primary" id="chat-send" type="submit">Envoyer</button></form>
        </div>
        <div class="stack">${contextCard(state.wealth)}
          <div class="notice info small">🔒 À chaque message, un <b>résumé</b> de ton budget (moyennes, catégories, abonnements, simulateur, épargne) est envoyé à Claude. Le détail de tes opérations et ton IBAN ne le sont pas.</div></div>
      </div>`;
    root.ChatPanel.mount(el, () => root.BudgetAnalytics.buildModel(root.Store.get()));
    bind(el);
    checkEngine(el);
  }

  async function checkEngine(el) {
    const badge = el.querySelector('#engine-badge');
    if (location.hostname.endsWith('github.io')) {
      badge.textContent = '⚠ Version PC uniquement';
      badge.className = 'badge bad';
      el.querySelector('#chat-thread').insertAdjacentHTML('afterbegin', `<div class="notice">L’assistant n’est disponible que sur la version PC (Ouvrir-Mon-Budget.bat) : il passe par Claude installé sur ton ordinateur.</div>`);
      return;
    }
    try {
      const s = await (await fetch('/api/chat/status')).json();
      badge.textContent = s.mode === 'none' ? `⚠ ${s.label}` : `● ${s.label}`;
      badge.className = s.mode === 'none' ? 'badge bad' : 'badge good';
      if (s.help) badge.title = s.help;
      if (s.mode === 'none') el.querySelector('#chat-thread').insertAdjacentHTML('afterbegin', `<div class="notice">${M.escape(s.help || s.label)}</div>`);
    } catch (e) {
      badge.textContent = '⚠ Serveur local arrêté';
      badge.className = 'badge bad';
    }
  }

  function bind(el) {
    el.querySelector('#chat-clear').addEventListener('click', () => { root.Store.setChat([]); root.ChatPanel.refresh(el); });
    el.querySelector('#note-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const text = el.querySelector('#note-input').value.trim();
      if (!text) return;
      root.Store.updateWealth({ notes: [...root.Store.get().wealth.notes, { text, at: new Date().toISOString().slice(0, 10) }] });
    });
    el.querySelectorAll('[data-del-note]').forEach((b) => b.addEventListener('click', () => {
      root.Store.updateWealth({ notes: root.Store.get().wealth.notes.filter((_, i) => i !== +b.dataset.delNote) });
    }));
  }

  root.AssistantView = { render };
})(window);
