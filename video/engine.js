// Moteur commun des vidéos : une seule horloge. window.__seek(t) place chaque animation CSS à
// l'instant t et recalcule les éléments animés en JS. render.mjs l'appelle image par image, ce
// qui rend le résultat indépendant de la vitesse de la machine. Ouverte dans un navigateur
// (?lang=en&t=12), la page se joue en temps réel, sans le son.
(function () {
  const params = new URLSearchParams(location.search);
  const lang = params.get('lang') === 'en' ? 'en' : 'fr';
  const hooks = [];
  const scenes = [];
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const prog = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));
  const easeOut = (x) => 1 - Math.pow(1 - x, 4);
  const easeInOut = (x) => (x < 0.5 ? 8 * x ** 4 : 1 - Math.pow(-2 * x + 2, 4) / 2);
  const fmt = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, lang === 'fr' ? ' ' : ',');

  // Découpe un titre en mots, chacun avec sa propre entrée.
  const words = (text, { d = 0, step = 0.12, a = 'slam', du = 0.34 } = {}) => {
    let i = 0;
    return text.split(' ').map((w) => `<span class="w" data-a="${a}" data-d="${(d + i++ * step).toFixed(3)}" data-du="${du}">${w}</span>`).join(' ');
  };

  // Horloge : à appeler une fois la page construite.
  const start = (duration, onTick) => {
    $$('.scene').forEach((el) => {
      const s = { el, start: +el.dataset.start, end: +el.dataset.end };
      scenes.push(s);
      $$('[data-a]', el).forEach((n) => {
        const d = s.start + parseFloat(n.dataset.d || 0);
        const du = parseFloat(n.dataset.du || 0.5);
        const parts = [`${n.dataset.a} ${du}s ${n.dataset.ease || 'var(--snap)'} ${d}s both`];
        if (n.dataset.o) parts.push(`${n.dataset.oa || 'outFade'} .2s linear ${s.start + parseFloat(n.dataset.o)}s forwards`);
        n.style.animation = parts.join(', ');
      });
    });
    let all = null;
    window.__seek = (t) => {
      if (!all) all = document.getAnimations();
      for (const a of all) { a.pause(); a.currentTime = t * 1000; }
      for (const s of scenes) s.el.style.visibility = t >= s.start && t < s.end ? 'visible' : 'hidden';
      hooks.forEach((h) => h(t));
      if (onTick) onTick(t);
    };
    window.__duration = duration;

    const stage = $('#stage');
    const fit = () => { const k = Math.min(innerWidth / 1920, innerHeight / 1080); stage.style.transform = `scale(${k})`; };
    if (!params.has('render')) {
      fit(); addEventListener('resize', fit);
      const t0 = performance.now() - (parseFloat(params.get('t')) || 0) * 1000;
      document.fonts.ready.then(() => {
        const loop = () => { window.__seek(((performance.now() - t0) / 1000) % duration); requestAnimationFrame(loop); };
        loop();
      });
    } else {
      window.__seek(0);
    }
  };

  // Téléphone sobre autour d'une vraie capture. h = hauteur de l'écran.
  const phone = (name, { x, y, h = 860, a = 'phoneIn', d = 0, du = 0.42, note = '', o = '' }) => {
    const w = Math.round((h * 390) / 844);
    return `<div class="phone" data-a="${a}" data-d="${d}" data-du="${du}" ${o ? `data-o="${o}"` : ''} style="left:${x}px;top:${y}px;width:${w + 20}px;height:${h + 20}px">
      <img src="screens/${lang}/${name}.jpg" alt="" style="width:${w}px;height:${h}px">
      ${note ? `<div class="note">${note}</div>` : ''}
    </div>`;
  };

  window.V = { lang, hooks, $, $$, prog, easeOut, easeInOut, fmt, words, start, phone };
})();
