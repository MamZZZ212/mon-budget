/* Import de relevés BNP (PDF, traités localement), rangement des PDF dans les documents du profil,
   et sauvegarde / restauration des données. */
(function (root) {
  const M = root.Money;
  let log = [];

  /* Lit un relevé PDF (fichier déposé ou document du profil) et l'ajoute au budget. */
  async function importPdf(name, bytes) {
    const st = await root.BNPParser.parseBNPPdf(root.pdfjsLib, bytes);
    const verified = st.check.totalsOk && st.check.balanceOk;
    const action = root.Store.upsertStatement(st);
    log.unshift({ name, ok: verified, msg: `${M.monthLabel(st.period.from)} : ${st.ops.length} opérations, relevé ${action}${verified ? ' · totaux et soldes vérifiés ✓' : ' · ⚠ totaux non concordants, vérifie les opérations'}` });
  }

  async function importFiles(files) {
    if (!root.pdfjsLib) { root.App.toast('Lecteur PDF non chargé : vérifie ta connexion internet puis recharge la page'); return; }
    for (const f of files) {
      if (!/\.pdf$/i.test(f.name)) { log.unshift({ name: f.name, ok: false, msg: 'Pas un PDF' }); continue; }
      try {
        await importPdf(f.name, new Uint8Array(await f.arrayBuffer()));
        // rangé dans les documents du profil : plus besoin de le redéposer
        if (!(await root.DocumentVault.has(f))) await root.DocumentVault.upload(f);
      } catch (e) {
        log.unshift({ name: f.name, ok: false, msg: e.message || 'Lecture impossible' });
      }
    }
    root.App.rerender();
  }

  /* Réimporte tous les relevés PDF rangés dans les documents du profil. */
  async function reimportVault() {
    if (!root.pdfjsLib) { root.App.toast('Lecteur PDF non chargé : vérifie ta connexion internet puis recharge la page'); return; }
    const pdfs = (await root.DocumentVault.list()).filter((d) => /\.pdf$/i.test(d.label));
    for (const d of pdfs) {
      try { await importPdf(d.label, await root.DocumentVault.readBytes(d.name)); } catch (e) { log.unshift({ name: d.label, ok: false, msg: e.message || 'Lecture impossible' }); }
    }
    root.App.rerender();
  }

  async function paintVault(el) {
    const box = el.querySelector('#vault');
    const pdfs = (await root.DocumentVault.list().catch(() => [])).filter((d) => /\.pdf$/i.test(d.label));
    if (!box.isConnected) return;
    box.innerHTML = pdfs.length
      ? `<div class="vault-list">${pdfs.map((d) => `<div class="row"><span>📄 ${M.escape(d.label)}</span><span class="small">${new Date(d.at).toLocaleDateString('fr-FR')}</span></div>`).join('')}</div>
         <div class="row mt"><button class="btn" id="reimport">${root.icon('upload')} Réimporter ces relevés</button></div>`
      : '<p class="small">Aucun relevé rangé pour l’instant : ceux que tu déposes ci-dessus y sont ajoutés automatiquement.</p>';
    box.querySelector('#reimport')?.addEventListener('click', reimportVault);
  }

  function statementsTable(model) {
    const rows = model.cycles.map((c) => {
      const st = root.Store.get().statements.find((s) => s.id === c.id);
      const ok = st.check && st.check.totalsOk && st.check.balanceOk;
      return `<tr><td>${c.label}</td><td class="small num">${M.date(c.period.from)} → ${M.date(c.period.to)}</td><td class="amt">${c.ops.length}</td>
        <td class="amt">${M.eur(c.close)}</td><td>${ok ? '<span class="badge good">✓ vérifié</span>' : '<span class="badge bad">⚠ à vérifier</span>'}</td>
        <td style="text-align:right"><button class="btn ghost danger" data-del="${M.escape(c.id)}" aria-label="Supprimer ${M.escape(c.label)}">Supprimer</button></td></tr>`;
    }).join('');
    return `<div class="table-wrap"><table><thead><tr><th>Mois</th><th>Période</th><th class="amt">Opérations</th><th class="amt">Solde fin</th><th>Contrôle</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function render(el, model) {
    el.innerHTML = `<div class="page-head"><div><h1>Importer des relevés</h1><p>Relevés de compte chèques BNP Paribas au format PDF</p></div></div>
      <label class="dropzone" id="drop">${root.icon('upload')}<h2 style="margin-top:10px">Glisse tes relevés PDF ici</h2>
        <p class="small">ou clique pour les choisir · plusieurs fichiers à la fois · un relevé déjà importé est remplacé</p>
        <input type="file" id="file" accept="application/pdf,.pdf" multiple hidden></label>
      <div class="notice info mt">🔒 Les PDF sont lus <b>directement dans ton navigateur</b> : aucune donnée n'est envoyée sur internet. Chaque relevé est contrôlé avec les totaux et soldes imprimés par la BNP.</div>
      ${log.length ? `<div class="card mt"><h2>Résultat de l'import</h2>${log.map((l) => `<p class="${l.ok ? '' : 'neg'}" style="margin:8px 0 0">${l.ok ? '✓' : '⚠'} <b>${M.escape(l.name)}</b> — ${M.escape(l.msg)}</p>`).join('')}</div>` : ''}
      <div class="card mt"><div class="card-head"><div><h2>Relevés rangés dans ton profil</h2><p>Gardés dans ce navigateur pour le profil « ${M.escape(root.ProfileRegistry.active().name)} » : tu n'as pas à les redéposer.</p></div></div><div id="vault"><p class="small">Chargement…</p></div></div>
      <div class="card mt"><div class="card-head"><div><h2>Relevés chargés</h2><p>${model.n} mois</p></div></div>${model.n ? statementsTable(model) : '<div class="empty">Aucun relevé</div>'}</div>
      <div class="card mt"><div class="card-head"><div><h2>Sauvegarde</h2><p>Les données restent dans ce navigateur. Exporte-les pour les garder ou changer d'ordinateur.</p></div></div>
        <div class="row"><button class="btn" id="exp">${root.icon('file')} Exporter (JSON)</button>
        <label class="btn" style="cursor:pointer">${root.icon('upload')} Restaurer une sauvegarde<input type="file" id="imp" accept=".json,application/json" hidden></label>
        <span class="spacer"></span><button class="btn danger" id="reset">Réinitialiser l'appli</button></div></div>
      <div class="notice mt"><b>Revolut :</b> l'appli considère que chaque virement vers Revolut est dépensé à 100 %. Les recharges apparaissent dans tes relevés sous « REVOLUT**XXXX ».</div>`;
    bind(el);
    paintVault(el);
  }

  function bind(el) {
    const drop = el.querySelector('#drop'), file = el.querySelector('#file');
    file.addEventListener('change', () => importFiles([...file.files]));
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', (e) => importFiles([...e.dataTransfer.files]));
    el.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
      if (confirm('Supprimer ce relevé de l\'appli ?')) root.Store.removeStatement(b.dataset.del);
    }));
    el.querySelector('#exp').addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([root.Store.exportJSON()], { type: 'application/json' }));
      a.download = `budget-bnp-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
    el.querySelector('#imp').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try { root.Store.importJSON(await f.text()); root.App.toast('Sauvegarde restaurée'); } catch (err) { root.App.toast(`Restauration impossible : ${err.message}`); }
    });
    el.querySelector('#reset').addEventListener('click', () => {
      if (confirm('Revenir aux relevés initiaux et effacer tes réglages et corrections ?')) { log = []; root.Store.reset(); }
    });
  }

  root.ImportView = { render };
})(window);
