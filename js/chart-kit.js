/* Graphiques Chart.js aux couleurs du thème (clair / sombre), avec infobulles. */
(function (root) {
  const charts = {};
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const eurTick = (v) => root.Money.eur(v);
  /* Axe des valeurs formaté en euros ; l'axe des libellés garde le formatage par défaut. */
  const ticks = (color, isValueAxis) => (isValueAxis ? { color, font: { size: 12 }, callback: eurTick } : { color, font: { size: 12 } });

  function baseOptions(extra = {}) {
    const grid = css('--grid'), muted = css('--muted');
    return {
      responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: extra.legend !== false, position: 'top', align: 'end', labels: { color: css('--ink-2'), boxWidth: 10, boxHeight: 10, useBorderRadius: true, borderRadius: 3, font: { size: 12 } } },
        tooltip: {
          backgroundColor: css('--surface'), titleColor: css('--ink'), bodyColor: css('--ink-2'), borderColor: css('--border'), borderWidth: 1,
          padding: 10, boxPadding: 4, usePointStyle: true,
          callbacks: { label: (c) => ` ${c.dataset.label ? c.dataset.label + ' : ' : ''}${root.Money.eur(c.parsed[extra.horizontal ? 'x' : 'y'])}` },
        },
      },
      scales: {
        x: { grid: { display: !!extra.horizontal, color: grid }, border: { color: css('--axis') }, ticks: ticks(muted, extra.horizontal) },
        y: { grid: { display: !extra.horizontal, color: grid }, border: { display: false }, ticks: ticks(muted, !extra.horizontal), stacked: !!extra.stacked },
      },
    };
  }

  function render(id, config) {
    const canvas = document.getElementById(id);
    if (!canvas || !root.Chart) return;
    if (charts[id]) charts[id].destroy();
    charts[id] = new root.Chart(canvas, config);
  }

  const bar = (color) => ({ backgroundColor: color, borderRadius: 4, borderSkipped: 'start', maxBarThickness: 34, borderColor: css('--surface'), borderWidth: 0 });

  const ChartKit = {
    css,

    groupedBars(id, labels, series) {
      render(id, { type: 'bar', data: { labels, datasets: series.map((s) => ({ ...bar(s.color), label: s.label, data: s.data })) }, options: baseOptions() });
    },

    stackedBars(id, labels, series) {
      const opts = baseOptions({ stacked: true });
      opts.scales.x.stacked = true;
      render(id, { type: 'bar', data: { labels, datasets: series.map((s) => ({ ...bar(s.color), label: s.label, data: s.data, borderWidth: { top: 2 }, borderRadius: 3 })) }, options: opts });
    },

    signedBars(id, labels, data, label) {
      const opts = baseOptions({ legend: false });
      const colors = data.map((v) => (v >= 0 ? css('--series-1') : css('--bad')));
      render(id, { type: 'bar', data: { labels, datasets: [{ ...bar(colors), label, data, borderSkipped: false }] }, options: opts });
    },

    horizontalBars(id, labels, data, label) {
      const opts = baseOptions({ legend: false, horizontal: true });
      opts.indexAxis = 'y';
      opts.interaction = { mode: 'nearest', axis: 'y', intersect: false };
      render(id, { type: 'bar', data: { labels, datasets: [{ ...bar(css('--series-1')), label, data, maxBarThickness: 18 }] }, options: opts });
    },

    lines(id, labels, series, extra = {}) {
      const opts = baseOptions({ legend: series.length > 1 });
      opts.scales.y.beginAtZero = extra.beginAtZero !== false;
      render(id, {
        type: 'line',
        data: { labels, datasets: series.map((s) => ({ label: s.label, data: s.data, borderColor: s.color, backgroundColor: s.color, borderWidth: 2, pointRadius: s.points ? 4 : 0, pointHoverRadius: 5, pointBorderColor: css('--surface'), pointBorderWidth: 2, tension: 0.25, borderDash: s.dash || [] })) },
        options: opts,
      });
    },

    refreshAll() { Object.values(charts).forEach((c) => c.destroy()); Object.keys(charts).forEach((k) => delete charts[k]); },
  };

  root.ChartKit = ChartKit;
})(window);
