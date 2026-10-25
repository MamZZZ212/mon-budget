/* Profil actif (bas de la barre latérale) et sélecteur : changer, créer, renommer ou supprimer un profil.
   Les profils sont communs avec Mes Investissements (voir profile-registry.js). */
(function (root) {
  const esc = (s) => root.Money.escape(s);
  const initial = (name) => esc((name || '?').slice(0, 1).toUpperCase());

  function rows() {
    const current = root.ProfileRegistry.active().id;
    return root.ProfileRegistry.list().map((p) => `<div class="profile-row"><span class="avatar">${initial(p.name)}</span><b>${esc(p.name)}</b>
      ${p.id === current ? '<span class="badge good">Actif</span>' : ''}<span class="spacer"></span>
      ${p.id === current ? '' : `<button class="btn" data-switch="${p.id}">Ouvrir</button>`}
      <button class="btn ghost" data-rename="${p.id}">Renommer</button>
      ${p.id === current ? '' : `<button class="btn ghost danger" data-remove="${p.id}">Supprimer</button>`}</div>`).join('');
  }

  function bind(d) {
    d.querySelectorAll('[data-switch]').forEach((b) => b.addEventListener('click', () => root.ProfileRegistry.switchTo(b.dataset.switch)));
    d.querySelectorAll('[data-rename]').forEach((b) => b.addEventListener('click', () => {
      const p = root.ProfileRegistry.list().find((x) => x.id === b.dataset.rename);
      const name = prompt('Nouveau nom du profil :', p.name);
      if (!name) return;
      root.ProfileRegistry.rename(p.id, name);
      location.reload();
    }));
    d.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', async () => {
      const p = root.ProfileRegistry.list().find((x) => x.id === b.dataset.remove);
      if (!confirm(`Supprimer le profil « ${p.name} » : son budget, son portefeuille et ses documents ? C’est définitif.`)) return;
      try { await root.ProfileRegistry.remove(p.id); d.querySelector('#profile-list').innerHTML = rows(); bind(d); } catch (e) { root.App.toast(e.message); }
    }));
  }

  function open() {
    const d = document.createElement('dialog');
    d.className = 'profile-dialog';
    d.innerHTML = `<h2>Profils</h2>
      <p class="small">Chaque profil a son budget, ses relevés et ses documents, enregistrés dans ce navigateur. Les profils sont communs avec Mes Investissements.</p>
      <div id="profile-list">${rows()}</div>
      <form id="new-profile" class="row mt"><input type="text" name="name" placeholder="Nom du nouveau profil" maxlength="40" required style="flex:1"><button class="btn primary">Créer</button></form>
      <div class="row mt" style="justify-content:flex-end"><button type="button" class="btn" data-close>Fermer</button></div>`;
    document.body.appendChild(d);
    d.addEventListener('close', () => d.remove());
    d.querySelector('[data-close]').addEventListener('click', () => d.close());
    d.querySelector('#new-profile').addEventListener('submit', (e) => {
      e.preventDefault();
      root.ProfileRegistry.switchTo(root.ProfileRegistry.create(new FormData(e.target).get('name')).id);
    });
    bind(d);
    d.showModal();
  }

  function paint() {
    const box = document.getElementById('account');
    if (!box) return;
    const p = root.ProfileRegistry.active();
    box.innerHTML = `<button class="profile-chip" id="profile-btn" title="Changer de profil"><span class="avatar">${initial(p.name)}</span><span><b>${esc(p.name)}</b><small>Changer de profil</small></span></button>`;
    box.querySelector('#profile-btn').addEventListener('click', open);
  }

  document.addEventListener('DOMContentLoaded', paint);
  root.ProfilePicker = { open, paint };
})(window);
