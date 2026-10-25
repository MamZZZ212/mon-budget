/* Fil de discussion : rendu des messages (markdown minimal), envoi au serveur local, notes proposées. */
(function (root) {
  const M = root.Money;
  const HISTORY_SENT = 20;
  let pending = false;

  const SUGGESTIONS = [
    'Combien je peux épargner par mois avec mon augmentation ?',
    'Que faire de mon bonus pour épargner au maximum ?',
    'Quelles dépenses couper en priorité ?',
    "Combien de temps pour me constituer 6 mois d'épargne de précaution ?",
  ];

  /* Markdown minimal et sûr : le texte est échappé avant toute mise en forme. */
  function renderMarkdown(text) {
    const inline = (s) => M.escape(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
    const out = [];
    let listOpen = false;
    text.split('\n').forEach((raw) => {
      const line = raw.trimEnd();
      const item = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
      if (item) { if (!listOpen) { out.push('<ul>'); listOpen = true; } out.push(`<li>${inline(item[1])}</li>`); return; }
      if (listOpen) { out.push('</ul>'); listOpen = false; }
      const head = line.match(/^#{1,4}\s+(.*)$/);
      if (head) out.push(`<h4>${inline(head[1])}</h4>`);
      else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
    });
    if (listOpen) out.push('</ul>');
    return out.join('');
  }

  function messageHtml(m, i) {
    if (m.role === 'user') return `<div class="msg user"><div class="bubble">${M.escape(m.content).replace(/\n/g, '<br>')}</div></div>`;
    const saved = root.Store.get().wealth.notes.map((n) => n.text);
    const notes = (m.notes || []).map((n, j) => saved.includes(n)
      ? `<span class="badge good">✓ Enregistré : ${M.escape(n)}</span>`
      : `<button class="btn note-btn" data-note="${i}-${j}">＋ Retenir : ${M.escape(n)}</button>`).join('');
    const cls = m.error ? 'msg assistant error' : 'msg assistant';
    return `<div class="${cls}"><div class="bubble">${renderMarkdown(m.content)}${notes ? `<div class="note-row">${notes}</div>` : ''}</div></div>`;
  }

  function threadHtml(chat) {
    if (!chat.length) {
      return `<div class="chat-empty"><h2>Pose-moi une question sur ton budget</h2>
        <p class="small">Je connais tes moyennes de dépenses, tes abonnements, ton simulateur, ton épargne salariale et ton bonus.</p>
        <div class="row" style="justify-content:center;margin-top:14px">${SUGGESTIONS.map((s) => `<button class="btn suggestion">${M.escape(s)}</button>`).join('')}</div></div>`;
    }
    return chat.map(messageHtml).join('') + (pending ? '<div class="msg assistant"><div class="bubble typing"><span></span><span></span><span></span></div></div>' : '');
  }

  function refresh(el) {
    const thread = el.querySelector('#chat-thread');
    if (!thread) return; // l'utilisateur a changé d'onglet pendant la réponse
    thread.innerHTML = threadHtml(root.Store.get().chat);
    thread.scrollTop = thread.scrollHeight;
    el.querySelector('#chat-send').disabled = pending;
    bindThread(el);
  }

  async function send(el, text, getModel) {
    const content = text.trim();
    if (!content || pending) return;
    const chat = [...root.Store.get().chat, { role: 'user', content }];
    root.Store.setChat(chat);
    pending = true;
    refresh(el);
    try {
      if (location.hostname.endsWith('github.io')) throw new Error('L’assistant n’est disponible que sur la version PC (Ouvrir-Mon-Budget.bat) : il passe par Claude installé sur ton ordinateur.');
      const system = root.ChatContext.buildSystemPrompt(getModel(), root.Store.get());
      const messages = chat.filter((m) => !m.error).slice(-HISTORY_SENT).map((m) => ({ role: m.role, content: m.content }));
      while (messages.length && messages[0].role !== 'user') messages.shift();
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ system, messages }) });
      const data = await res.json().catch(() => ({ error: `Réponse invalide du serveur (${res.status})` }));
      if (!res.ok) throw new Error(data.help ? `${data.error}. ${data.help}` : data.error);
      const { text: reply, notes } = root.ChatContext.extractNotes(data.reply || '');
      root.Store.setChat([...chat, { role: 'assistant', content: reply || '(réponse vide)', notes }]);
    } catch (e) {
      const msg = e instanceof TypeError ? "Serveur local injoignable : lance l'appli avec Ouvrir-Mon-Budget.bat." : e.message;
      root.Store.setChat([...chat, { role: 'assistant', content: `⚠ ${msg}`, error: true }]);
    } finally {
      pending = false;
      refresh(el);
    }
  }

  function bindThread(el) {
    el.querySelectorAll('.suggestion').forEach((b) => b.addEventListener('click', () => send(el, b.textContent, el._getModel)));
    el.querySelectorAll('[data-note]').forEach((b) => b.addEventListener('click', () => {
      const [i, j] = b.dataset.note.split('-').map(Number);
      const text = root.Store.get().chat[i].notes[j];
      root.Store.updateWealth({ notes: [...root.Store.get().wealth.notes, { text, at: new Date().toISOString().slice(0, 10) }] });
      root.App.toast("Retenu : l'assistant en tiendra compte");
    }));
  }

  function mount(el, getModel) {
    el._getModel = getModel;
    const input = el.querySelector('#chat-input');
    el.querySelector('#chat-form').addEventListener('submit', (e) => { e.preventDefault(); const v = input.value; input.value = ''; send(el, v, getModel); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); el.querySelector('#chat-form').requestSubmit(); } });
    refresh(el);
  }

  root.ChatPanel = { mount, refresh };
})(window);
