import { useEffect, useId, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Le cercle en mouvement : six membres cotisent par Mobile Money, la
 * cagnotte se remplit, puis elle est reversée à l'un d'eux, à tour de rôle.
 * C'est la tontine expliquée en quinze secondes, sans un mot de texte à lire.
 *
 * Choix de conception :
 *  - la boucle s'arrête quand le composant sort de l'écran ou que l'onglet
 *    est caché (batterie, forfait mobile) et reprend en revenant ;
 *  - avec « réduire les animations », on affiche l'état final figé ;
 *  - légendes et libellés suivent la langue choisie ;
 *  - tout est nettoyé au démontage (React rejoue les effets en développement).
 */

const NS = 'http://www.w3.org/2000/svg';
const CX = 200;
const CY = 200;
const RADIUS = 135;
const NAMES = ['Ama', 'Kofi', 'Afi', 'Yao', 'Esi', 'Komla'];
const AMOUNT = 5000;
const CIRC = 439.82;
const CANCEL = Symbol('circle-motion-cancel');

const tf = (x: number, y: number, s = 1) => `translate(${x}px,${y}px) scale(${s})`;

function svgEl(name: string, attrs: Record<string, string | number> = {}): SVGElement {
  const node = document.createElementNS(NS, name);
  for (const key in attrs) node.setAttribute(key, String(attrs[key]));
  return node as SVGElement;
}

interface CircleMotionProps {
  className?: string;
  /** Légende sous le dessin. */
  showCaption?: boolean;
}

export function CircleMotion({ className = '', showCaption = true }: CircleMotionProps) {
  const { t, language } = useLanguage();
  const reduced = useReducedMotion();
  const uid = useId().replace(/:/g, '');

  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const membersRef = useRef<SVGGElement>(null);
  const fxRef = useRef<SVGGElement>(null);
  const potRef = useRef<SVGGElement>(null);
  const progRef = useRef<SVGCircleElement>(null);
  const glowRef = useRef<SVGCircleElement>(null);
  const amtRef = useRef<SVGTextElement>(null);
  const scoreRef = useRef<SVGGElement>(null);
  const capRef = useRef<HTMLParagraphElement>(null);

  // Le moteur d'animation vit hors de React : il relit la langue courante ici.
  const tRef = useRef(t);
  const langRef = useRef(language);
  tRef.current = t;
  langRef.current = language;

  useEffect(() => {
    const root = rootRef.current;
    const svg = svgRef.current;
    const membersLayer = membersRef.current;
    const fx = fxRef.current;
    const pot = potRef.current;
    const prog = progRef.current;
    const glow = glowRef.current;
    const amt = amtRef.current;
    const score = scoreRef.current;
    const cap = capRef.current;
    if (!root || !svg || !membersLayer || !fx || !pot || !prog || !glow || !amt || !score) return;

    const N = NAMES.length;
    const fmt = (n: number) => Math.round(n).toLocaleString(langRef.current === 'en' ? 'en-US' : 'fr-FR');
    const text = (key: string) => tRef.current(key);
    const setCaption = (value: string) => {
      if (cap) cap.textContent = value;
    };

    // État de départ (l'effet peut être rejoué : on repart toujours de zéro).
    membersLayer.replaceChildren();
    fx.replaceChildren();
    pot.style.transform = tf(CX, CY, reduced ? 1 : 0);
    score.style.transform = tf(CX, 16, reduced ? 1 : 0);
    prog.style.strokeDashoffset = String(reduced ? 0 : CIRC);
    glow.style.opacity = '0';
    amt.textContent = reduced ? fmt(AMOUNT * N) : '0';

    const members = NAMES.map((name, i) => {
      const angle = ((-90 + i * (360 / N)) * Math.PI) / 180;
      const x = CX + RADIUS * Math.cos(angle);
      const y = CY + RADIUS * Math.sin(angle);

      const g = svgEl('g');
      g.style.transform = tf(x, y, reduced ? 1 : 0);
      const halo = svgEl('circle', { r: 40, fill: '#E9B44C', opacity: 0, filter: `url(#${uid}glow)` });
      const body = svgEl('circle', { r: 26, fill: '#FFF6EC', stroke: '#C96F4A', 'stroke-width': 3 });
      const initial = svgEl('text', { y: 6, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 800, fill: '#3B2418' });
      initial.textContent = name[0];

      const check = svgEl('g');
      check.style.transform = tf(19, -19, reduced ? 1 : 0);
      check.appendChild(svgEl('circle', { r: 10, fill: '#4F8A5B', stroke: '#FFF6EC', 'stroke-width': 2 }));
      check.appendChild(svgEl('path', {
        d: 'M-4 0.5 L-1 3.5 L4.5 -3', fill: 'none', stroke: '#FFF6EC',
        'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      }));

      g.append(halo, body, initial, check);
      membersLayer.appendChild(g);
      return { name, x, y, g, halo, check };
    });

    // Version figée : la cagnotte est pleine, rien ne bouge.
    if (reduced) {
      setCaption(`${text('cm_cap_full')}`);
      return () => {
        membersLayer.replaceChildren();
      };
    }

    let alive = true;
    let visible = true;
    const check = () => {
      if (!alive) throw CANCEL;
    };
    const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)).then(check);
    const run = (node: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions) =>
      node.animate(keyframes, { fill: 'forwards', ...options }).finished.then(check);
    // Animations lancées sans être attendues : un démontage ne doit pas
    // laisser d'erreur non gérée dans la console.
    const go = (node: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions) => {
      run(node, keyframes, options).catch(() => {});
    };

    const POT = { x: CX, y: CY };

    let caption = Promise.resolve();
    const say = (value: string) => {
      caption = caption.then(async () => {
        if (!alive || !cap) return;
        cap.style.opacity = '0';
        cap.style.transform = 'translateY(6px)';
        await new Promise((r) => setTimeout(r, 220));
        if (!alive) return;
        cap.textContent = value;
        cap.style.opacity = '1';
        cap.style.transform = 'translateY(0)';
      });
    };

    let shown = 0;
    const countTo = (to: number, ms: number) => {
      const from = shown;
      const t0 = performance.now();
      const step = (now: number) => {
        if (!alive) return;
        const p = Math.min(1, (now - t0) / ms);
        const e = 1 - Math.pow(1 - p, 3);
        shown = from + (to - from) * e;
        amt.textContent = fmt(shown);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    const flyCoin = async (from: { x: number; y: number }, to: { x: number; y: number }, ms: number, delay = 0) => {
      const coin = svgEl('g');
      coin.style.transform = tf(from.x, from.y, 0.5);
      coin.style.opacity = '0';
      coin.appendChild(svgEl('circle', { r: 9, fill: '#E9B44C', stroke: '#B8862B', 'stroke-width': 1.5 }));
      coin.appendChild(svgEl('circle', { r: 5, fill: 'none', stroke: '#B8862B', 'stroke-width': 1, 'stroke-opacity': 0.7 }));
      fx.appendChild(coin);

      // Trajectoire légèrement courbe.
      const mx = (from.x + to.x) / 2;
      const my = (from.y + to.y) / 2;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      const px = mx + (-dy / len) * 26;
      const py = my + (dx / len) * 26;

      await run(coin, [
        { transform: tf(from.x, from.y, 0.5), opacity: 0 },
        { transform: tf(px, py, 1.15), opacity: 1, offset: 0.5 },
        { transform: tf(to.x, to.y, 0.6), opacity: 0.95 },
      ], { duration: ms, delay, easing: 'cubic-bezier(.45,.05,.3,1)' });
      coin.remove();
    };

    const confetti = (at: { x: number; y: number }) => {
      const colors = ['#E9B44C', '#C96F4A', '#4F8A5B', '#FFF6EC', '#3B2418'];
      for (let i = 0; i < 16; i++) {
        const piece = svgEl('circle', { r: 2 + Math.random() * 2.5, fill: colors[i % colors.length] });
        piece.style.transform = tf(at.x, at.y, 1);
        fx.appendChild(piece);
        const angle = Math.random() * Math.PI * 2;
        const dist = 38 + Math.random() * 46;
        run(piece, [
          { transform: tf(at.x, at.y, 1), opacity: 1 },
          { transform: tf(at.x + Math.cos(angle) * dist, at.y + Math.sin(angle) * dist + 10, 0.4), opacity: 0 },
        ], { duration: 900 + Math.random() * 300, easing: 'cubic-bezier(.15,.7,.3,1)' })
          .then(() => piece.remove())
          .catch(() => {});
      }
    };

    const popPot = () =>
      go(pot, [
        { transform: tf(CX, CY, 1) },
        { transform: tf(CX, CY, 1.08), offset: 0.4 },
        { transform: tf(CX, CY, 1) },
      ], { duration: 320, easing: 'ease-out' });

    const intro = async () => {
      await Promise.all([
        run(pot, [{ transform: tf(CX, CY, 0) }, { transform: tf(CX, CY, 1) }],
          { duration: 700, easing: 'cubic-bezier(.3,1.5,.5,1)' }),
        ...members.map((m, i) => run(m.g, [
          { transform: tf(m.x, m.y, 0) },
          { transform: tf(m.x, m.y, 1) },
        ], { duration: 550, delay: 120 + i * 90, easing: 'cubic-bezier(.3,1.6,.5,1)' })),
      ]);
      await run(score, [{ transform: tf(CX, 16, 0) }, { transform: tf(CX, 16, 1) }],
        { duration: 450, easing: 'cubic-bezier(.3,1.6,.5,1)' });
    };

    const cycle = async (round: number) => {
      // Hors écran ou onglet caché : on attend, on n'anime pas dans le vide.
      while (!visible) await wait(400);

      const recipient = members[round];
      go(recipient.halo, [{ opacity: 0 }, { opacity: 0.5 }], { duration: 400 });

      say(text('cm_cap_contribute'));
      await wait(500);

      let done = 0;
      await Promise.all(members.map(async (m, i) => {
        await wait(i * 280);
        await flyCoin(m, POT, 720);
        done += 1;
        countTo(done * AMOUNT, 260);
        popPot();
        go(prog, [
          { strokeDashoffset: CIRC * (1 - (done - 1) / N) },
          { strokeDashoffset: CIRC * (1 - done / N) },
        ], { duration: 300, easing: 'ease-out' });
        go(m.check, [{ transform: tf(19, -19, 0) }, { transform: tf(19, -19, 1) }],
          { duration: 380, easing: 'cubic-bezier(.3,1.8,.5,1)' });
      }));

      await wait(250);
      say(text('cm_cap_full'));
      go(glow, [{ opacity: 0 }, { opacity: 0.75 }, { opacity: 0.35 }], { duration: 700 });
      await wait(1000);

      say(`${recipient.name} ${text('cm_cap_receives_suffix')}`);
      const flights = members.map((_, i) => flyCoin(POT, recipient, 720, i * 90));
      countTo(0, 900);
      go(prog, [{ strokeDashoffset: 0 }, { strokeDashoffset: CIRC }], { duration: 900, easing: 'ease-in-out' });
      await Promise.all(flights);

      confetti(recipient);
      go(recipient.halo, [{ opacity: 0.5 }, { opacity: 1 }, { opacity: 0 }], { duration: 1300 });
      go(recipient.g, [
        { transform: tf(recipient.x, recipient.y, 1) },
        { transform: tf(recipient.x, recipient.y, 1.28), offset: 0.35 },
        { transform: tf(recipient.x, recipient.y, 1) },
      ], { duration: 600, easing: 'cubic-bezier(.3,1.4,.5,1)' });
      go(glow, [{ opacity: 0.35 }, { opacity: 0 }], { duration: 600 });
      go(score, [
        { transform: tf(CX, 16, 1) },
        { transform: tf(CX, 16, 1.18), offset: 0.4 },
        { transform: tf(CX, 16, 1) },
      ], { duration: 500, easing: 'ease-out' });

      await wait(1700);
      await Promise.all(members.map((m) =>
        run(m.check, [{ transform: tf(19, -19, 1) }, { transform: tf(19, -19, 0) }], { duration: 250 })));
    };

    const start = async () => {
      await intro();
      for (let round = 0; ; round = (round + 1) % N) {
        await cycle(round);
      }
    };

    // Pause hors écran / onglet caché.
    const updateVisibility = (inView: boolean) => {
      visible = inView && !document.hidden;
    };
    let inView = true;
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      updateVisibility(inView);
    });
    observer.observe(root);
    const onVisibility = () => updateVisibility(inView);
    document.addEventListener('visibilitychange', onVisibility);

    start().catch((err) => {
      if (err !== CANCEL) console.error('CircleMotion:', err);
    });

    return () => {
      alive = false;
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      svg.getAnimations?.({ subtree: true }).forEach((a) => a.cancel());
      membersLayer.replaceChildren();
      fx.replaceChildren();
    };
  }, [reduced, uid]);

  const potGradient = `${uid}pot`;
  const glowFilter = `${uid}glow`;

  return (
    <div ref={rootRef} className={className} role="img" aria-label={t('cm_aria')}>
      <svg ref={svgRef} viewBox="0 0 400 400" className="block h-auto w-full overflow-visible" aria-hidden="true">
        <defs>
          <radialGradient id={potGradient} cx="40%" cy="35%" r="75%">
            <stop offset="0" stopColor="#E08A62" />
            <stop offset="1" stopColor="#C96F4A" />
          </radialGradient>
          <filter id={glowFilter} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        <g className="cm-orbit">
          <circle cx="200" cy="200" r="135" fill="none" stroke="#C96F4A" strokeOpacity=".28" strokeWidth="2" strokeDasharray="3 9" strokeLinecap="round" />
        </g>

        <g ref={membersRef} />
        <g ref={fxRef} />

        <g ref={potRef} style={{ transform: tf(CX, CY, 0) }}>
          <circle ref={glowRef} r="64" fill="#E9B44C" opacity="0" filter={`url(#${glowFilter})`} />
          <circle r="70" fill="none" stroke="#C96F4A" strokeOpacity=".18" strokeWidth="8" />
          <circle
            ref={progRef}
            r="70"
            fill="none"
            stroke="#C96F4A"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC}
            style={{ transform: 'rotate(-90deg)' }}
          />
          <circle r="58" fill={`url(#${potGradient})`} />
          <text y="-17" textAnchor="middle" fontSize="11" fill="#FFF6EC" fillOpacity=".85" fontWeight="600" letterSpacing="1">eganyé</text>
          <text ref={amtRef} y="9" textAnchor="middle" fontSize="22" fontWeight="800" fill="#FFF6EC">0</text>
          <text y="25" textAnchor="middle" fontSize="11" fill="#FFF6EC" fillOpacity=".9" fontWeight="600">FCFA</text>
        </g>

        <g ref={scoreRef} style={{ transform: tf(CX, 16, 0) }}>
          <rect x="-62" y="-12" width="124" height="24" rx="12" fill="#3B2418" />
          <text y="4" textAnchor="middle" fontSize="11" fontWeight="700" fill="#FFF6EC">{`★ ${t('cm_reliability')} 98`}</text>
        </g>
      </svg>

      {showCaption && (
        <p
          ref={capRef}
          className="mt-2 min-h-[1.5em] text-center text-sm font-semibold text-foreground transition-[opacity,transform] duration-300"
          aria-hidden="true"
        >
          &nbsp;
        </p>
      )}
    </div>
  );
}
