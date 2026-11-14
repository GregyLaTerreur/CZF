'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { Rarity } from '@/lib/tcg/cards';
import { rand, zigzag } from './lightning';
import styles from './cardElectric.module.css';

// Effet électrique d'une carte : un courant lent fait le tour (maquette « E2 »). En épique et légendaire,
// des veines entrent dans la carte par les bords (« V5 ») : quasi invisibles au repos, tout le réseau
// s'allume d'un coup de temps en temps (battement), puis le courant parcourt une veine qui s'allume.
// Rien en commune. À poser dans un parent en position relative, de la taille de la carte.

// Unités du SVG : carte de 100 x 140, marge de 30 autour (les veines peuvent dépasser un peu).
const CW = 100;
const CH = 140;
const M = 30;

type Veins = { count: number; every: number } | null;

const VEINS: Record<Rarity, Veins> = {
  commune: null,
  rare: null,
  epique: { count: 4, every: 3200 },
  legendaire: { count: 6, every: 2000 },
};

const X0 = M;
const Y0 = M;
const X1 = M + CW;
const Y1 = M + CH;

// Veine : tronc en zigzag qui part d'un bord vers l'intérieur, plus deux petites branches.
// Le tronc est le premier sous-chemin (« M… ») : c'est lui que parcourt le courant.
function makeVein(): { full: string; trunk: string } {
  const side = Math.floor(rand(0, 4));
  const [x, y, a] = (
    [
      [rand(X0 + 9, X1 - 9), Y0 - 4, Math.PI / 2],
      [X1 + 4, rand(Y0 + 12, Y1 - 12), Math.PI],
      [rand(X0 + 9, X1 - 9), Y1 + 4, -Math.PI / 2],
      [X0 - 4, rand(Y0 + 12, Y1 - 12), 0],
    ] as const
  )[side];
  const angle = a + rand(-0.4, 0.4);
  const len = rand(32, 50);
  const x2 = x + Math.cos(angle) * len;
  const y2 = y + Math.sin(angle) * len;
  const trunk = zigzag(x, y, x2, y2, 0.28, 7);
  let full = trunk;
  for (let b = 0; b < 2; b++) {
    const t = rand(0.3, 0.75);
    const bx = x + (x2 - x) * t;
    const by = y + (y2 - y) * t;
    const ba = angle + (Math.random() < 0.5 ? -1 : 1) * rand(0.4, 0.9);
    const bl = len * rand(0.25, 0.4);
    full += ` ${zigzag(bx, by, bx + Math.cos(ba) * bl, by + Math.sin(ba) * bl, 0.3, 4)}`;
  }
  return { full, trunk };
}

export default function CardElectric({ rarity }: { rarity: Rarity }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const veinsRef = useRef<SVGGElement>(null);
  const pulseRef = useRef<SVGGElement>(null);
  const config = VEINS[rarity];
  const veins = useMemo(() => (config ? Array.from({ length: config.count }, makeVein) : []), [config]);

  // Battement (tout le réseau s'allume), puis le courant parcourt une veine qui s'allume à son passage.
  useEffect(() => {
    if (!config || !veins.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timers: number[] = [];
    const restart = (el: Element | null | undefined, cls: string) => {
      if (!el) return;
      el.classList.remove(cls);
      void (el as SVGElement).getBoundingClientRect();
      el.classList.add(cls);
    };

    const loop = () => {
      restart(svgRef.current, styles.beat);
      timers.push(
        window.setTimeout(() => {
          const k = Math.floor(Math.random() * veins.length);
          if (pulseRef.current) pulseRef.current.innerHTML = `<path pathLength="1" d="${veins[k].trunk}"/>`;
          restart(veinsRef.current?.children[k], styles.lit);
        }, 450)
      );
      timers.push(window.setTimeout(loop, config.every * rand(0.75, 1.25)));
    };
    timers.push(window.setTimeout(loop, rand(200, 1200)));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [config, veins]);

  if (rarity === 'commune') return null;

  return (
    <div className={`${styles.electric} ${styles[rarity]}`} aria-hidden="true">
      <div className={styles.glow} />
      {rarity === 'legendaire' && <div className={styles.base} />}
      <div className={styles.current} />
      {config && (
        <svg ref={svgRef} className={styles.arcs} viewBox={`0 0 ${CW + 2 * M} ${CH + 2 * M}`}>
          <g ref={veinsRef} className={styles.veins}>
            {veins.map((vein, i) => <path key={i} d={vein.full} />)}
          </g>
          <g ref={pulseRef} className={styles.pulse} />
        </svg>
      )}
    </div>
  );
}
