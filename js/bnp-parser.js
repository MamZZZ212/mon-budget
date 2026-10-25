/* Parseur de relevés de compte BNP Paribas (PDF) à partir des éléments texte de pdf.js.
   Débit / crédit sont déterminés par la position horizontale du montant
   (colonne "Débit" ou "Crédit"), puis contrôlés avec la ligne "TOTAL DES OPERATIONS". */
(function (root) {
  const MONTHS = { janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7,
    aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12 };
  const AMT_RE = /\d{1,3}(?:[  ]?\d{3})*,\d{2}/g;
  const DATE_RE = /^\d{2}\.\d{2}$/;
  const STOP_RE = /BNP PARIBAS SA au capital|^\* ?Commissions sur services|Montant de votre autorisation/;

  const num = (s) => parseFloat(s.replace(/[  ]/g, '').replace(',', '.'));
  const round2 = (n) => Math.round(n * 100) / 100;
  const pad = (n) => String(n).padStart(2, '0');
  const deaccent = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  /* Regroupe les items pdf.js en lignes, et les fragments contigus en mots. */
  function groupLines(items) {
    const sorted = items
      .filter((it) => it.str && it.str.trim())
      .map((it) => ({ str: it.str.trim(), x: it.transform[4], y: it.transform[5], r: it.transform[4] + (it.width || 0) }))
      .sort((a, b) => b.y - a.y);
    const lines = [];
    for (const it of sorted) {
      const last = lines[lines.length - 1];
      if (last && Math.abs(last.y - it.y) < 2.5) last.items.push(it);
      else lines.push({ y: it.y, items: [it] });
    }
    return lines.map((l) => {
      const words = [];
      l.items.sort((a, b) => a.x - b.x).forEach((it) => {
        const w = words[words.length - 1];
        if (w && it.x - w.r < 0.8) { w.str += it.str; w.r = it.r; } else words.push({ ...it });
      });
      return { items: words, text: words.map((w) => w.str).join(' ') };
    });
  }

  function parsePeriod(text) {
    const m = text.match(/du (\d{1,2}) (\S+) (\d{4}) au (\d{1,2}) (\S+) (\d{4})/i);
    if (!m) return null;
    const mo = (s) => pad(MONTHS[deaccent(s)]);
    return { from: `${m[3]}-${mo(m[2])}-${pad(m[1])}`, to: `${m[6]}-${mo(m[5])}-${pad(m[4])}` };
  }

  function findColumns(line) {
    const find = (re) => line.items.find((i) => re.test(i.str));
    const deb = find(/^D.bit$/), cre = find(/^Cr.dit$/), val = find(/^Valeur$/), nat = find(/^Nature$/);
    if (!deb || !cre || !val) return null;
    return { debR: deb.r, creR: cre.r, valX: val.x, natX: nat ? nat.x : val.x - 240 };
  }

  /* Dernier montant situé à droite de minX, avec son bord droit (pour la colonne). */
  function amountOf(line, minX) {
    const its = line.items.filter((i) => i.x >= minX);
    const all = its.map((i) => i.str).join(' ').match(AMT_RE);
    if (!all) return null;
    return { value: num(all[all.length - 1]), right: Math.max(...its.map((i) => i.r)) };
  }

  function amountsByColumn(line, cols) {
    const res = { debit: 0, credit: 0 };
    const its = line.items.filter((i) => i.x >= cols.valX);
    let buf = null;
    const flush = () => { if (buf && AMT_RE.test(buf.str)) res[isCredit(buf.r, cols) ? 'credit' : 'debit'] = num(buf.str.match(AMT_RE)[0]); AMT_RE.lastIndex = 0; };
    for (const i of its) {
      if (buf && /^\d{1,3}$/.test(buf.str.split(' ').pop()) && i.x - buf.r < 12) { buf.str += ' ' + i.str; buf.r = i.r; continue; }
      flush(); buf = { str: i.str, r: i.r };
    }
    flush();
    return res;
  }

  const isCredit = (right, cols) => Math.abs(right - cols.creR) < Math.abs(right - cols.debR);
  const labelOf = (line, cols) => line.items.filter((i) => i.x >= cols.natX - 4 && i.x < cols.valX - 4).map((i) => i.str).join(' ');

  /* Analyse une page : ajoute soldes, totaux et opérations dans l'accumulateur. */
  function parsePage(lines, acc) {
    let cols = null, cur = null;
    for (const line of lines) {
      const t = line.text;
      if (!cols) { cols = findColumns(line); continue; }
      if (STOP_RE.test(t)) break;
      if (/SOLDE (CREDITEUR|DEBITEUR) AU/.test(t)) {
        const a = amountOf(line, cols.valX + 20);
        if (a) acc.balances.push(/DEBITEUR/.test(t) ? -a.value : a.value);
        cur = null; continue;
      }
      if (/TOTAL DES OPERATIONS/.test(t)) { acc.totals = amountsByColumn(line, cols); cur = null; continue; }
      const first = line.items[0];
      if (DATE_RE.test(first.str) && first.x < cols.natX - 2) {
        const a = amountOf(line, cols.valX + 25);
        if (!a) continue;
        cur = { d: first.str, amount: isCredit(a.right, cols) ? a.value : -a.value, lines: [labelOf(line, cols)] };
        acc.raw.push(cur);
      } else if (cur) {
        cur.lines.push(labelOf(line, cols));
      }
    }
  }

  function buildOps(raw, period) {
    const endY = +period.to.slice(0, 4), endM = +period.to.slice(5, 7), id = period.to.slice(0, 7);
    return raw.map((o, i) => {
      const [dd, mm] = o.d.split('.').map(Number);
      const y = mm > endM ? endY - 1 : endY;
      return { id: `${id}-${pad(i)}`, date: `${y}-${pad(mm)}-${pad(dd)}`, label: o.lines.filter(Boolean).join(' | '), amount: round2(o.amount) };
    });
  }

  function checkStatement(ops, open, close, totals) {
    const debit = round2(-ops.filter((o) => o.amount < 0).reduce((s, o) => s + o.amount, 0));
    const credit = round2(ops.filter((o) => o.amount > 0).reduce((s, o) => s + o.amount, 0));
    return {
      debit, credit, totals,
      totalsOk: !!totals && Math.abs(totals.debit - debit) < 0.01 && Math.abs(totals.credit - credit) < 0.01,
      balanceOk: open != null && close != null && Math.abs(open + credit - debit - close) < 0.01,
    };
  }

  /** pages : un tableau d'items pdf.js { str, transform, width } par page */
  function parseBNPStatement(pages) {
    const acc = { balances: [], totals: null, raw: [] };
    let period = null;
    for (const items of pages) {
      const lines = groupLines(items);
      period = period || parsePeriod(lines.map((l) => l.text).join(' '));
      parsePage(lines, acc);
    }
    if (!period) throw new Error('Période du relevé introuvable : est-ce bien un relevé de compte BNP Paribas ?');
    const ops = buildOps(acc.raw, period);
    const [open = null, close = null] = acc.balances;
    return { id: period.to.slice(0, 7), period, open, close, ops, check: checkStatement(ops, open, close, acc.totals) };
  }

  async function parseBNPPdf(pdfjsLib, data) {
    const doc = await pdfjsLib.getDocument({ data }).promise;
    const pages = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      pages.push((await page.getTextContent()).items);
    }
    return parseBNPStatement(pages);
  }

  const api = { parseBNPStatement, parseBNPPdf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BNPParser = api;
})(typeof window !== 'undefined' ? window : globalThis);
