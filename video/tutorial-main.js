(function () {
  const { lang, $, words, start, phone } = V;
  const LINES = window.__LINES;
  const STEPS = window.__STEPS;
  const CHAP = window.__CHAPTERS[lang];
  const LOGO = '../public/brand-visuals/logo-coin.webp';
  const NOTE = lang === 'fr' ? 'Données fictives' : 'Sample data';
  const COUNT = lang === 'fr' ? 'Étape' : 'Step';
  const H = 940; const W = Math.round((H * 390) / 844);
  const PX = 1270; const PY = 60;
  const real = STEPS.filter((s) => !s.end).length;

  const out = LINES.map((line, i) => {
    const s = STEPS[line.step];
    const end = i + 1 < LINES.length ? LINES[i + 1].t : line.t + line.duree + 2.4;
    const start = i === 0 ? 0 : line.t - 0.15;
    if (s.end) {
      return `<section class="scene bg-terra" data-start="${start}" data-end="${(end + 30).toFixed(3)}">
        <div class="abs center" style="inset:0 0 200px 0"><img src="${LOGO}" style="width:210px" data-a="pop" data-d="0.1" data-du=".5" data-ease="var(--back)"></div>
        <div class="abs big" style="left:0;right:0;top:560px;text-align:center;font-size:140px" data-a="slam" data-d="0.3" data-du=".5">eganyé</div>
        <div class="abs" style="left:0;right:0;top:730px;text-align:center;font-size:58px;font-weight:800;padding:0 200px" data-a="rise" data-d="0.5" data-du=".5">${s[lang]}</div>
        <div class="abs" style="left:0;right:0;top:850px;text-align:center;font-size:36px;font-weight:700" data-a="fade" data-d="1.2" data-du=".5">eganye.codorah.com</div>
      </section>`;
    }
    const prev = i > 0 ? STEPS[LINES[i - 1].step] : null;
    const sameScreen = prev && prev.screen === s.screen;
    const tapAt = Math.max(0.4, line.duree * 0.5);
    const tap = s.tap ? (() => {
      const x = PX + 10 + s.tap[0] * W; const y = PY + 10 + s.tap[1] * H;
      return `<div class="tap" style="left:${x}px;top:${y}px" data-a="tap" data-d="${tapAt}" data-du=".35"></div>
        <div class="tapr" style="left:${x}px;top:${y}px" data-a="tapRing" data-d="${tapAt + 0.1}" data-du=".9" data-ease="ease-out"></div>`;
    })() : '';
    const n = STEPS.slice(0, line.step + 1).filter((x) => !x.end).length;
    return `<section class="scene bg-paper" data-start="${start}" data-end="${end - 0.15}">
      <div class="num">${COUNT} ${n} / ${real}</div>
      <div class="chap">${CHAP[s.ch]}</div>
      <div class="say" data-a="rise" data-d="0.04" data-du=".32">${line.text}</div>
      <div class="track">${CHAP.slice(0, -1).map((_, c) => `<i class="${c <= s.ch ? 'on' : ''}"></i>`).join('')}</div>
      <div class="foot">${NOTE}</div>
      ${phone(s.screen, { x: PX, y: PY, h: H, a: sameScreen ? 'fade' : 'swap', d: 0, du: sameScreen ? 0.01 : 0.28 })}
      ${tap}
    </section>`;
  });
  $('#stage').innerHTML = out.join('');

  const last = LINES[LINES.length - 1];
  start(+(last.t + last.duree + 2.4).toFixed(3));
})();
