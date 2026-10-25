/* Mise en forme des montants, dates et pourcentages (fr-FR). */
(function (root) {
  const eur0 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const eur2 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
  const SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  const Money = {
    eur: (n) => eur0.format(Math.round(n || 0)),
    eurCents: (n) => eur2.format(n || 0),
    signed: (n) => {
      const r = Math.round(n || 0);
      return (r > 0 ? '+' : r < 0 ? '−' : '') + eur0.format(Math.abs(r));
    },
    pct: (n) => (isFinite(n) ? `${Math.round(n * 100)} %` : '—'),
    date: (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`,
    monthName: (iso) => MONTHS[+iso.slice(5, 7) - 1],
    monthShort: (iso) => SHORT[+iso.slice(5, 7) - 1],
    monthLabel: (iso) => {
      const m = MONTHS[+iso.slice(5, 7) - 1];
      return m.charAt(0).toUpperCase() + m.slice(1) + ' ' + iso.slice(0, 4);
    },
    escape: (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
  };

  root.Money = Money;
})(window);
