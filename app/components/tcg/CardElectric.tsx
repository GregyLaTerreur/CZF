'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { Rarity } from '@/lib/tcg/cards';
import { branching, rand } from './lightning';
import styles from './cardElectric.module.css';

// Effet électrique autour d'une carte : un courant lent fait le tour (maquette « E2 »), et en épique /
// légendaire des veines électriques partent des bords, parcourues de temps en temps par une lumière (« L5 »).
// Rien en commune. À poser dans un parent en position relative, de la taille de la carte.

// Unités du SVG : carte de 100 x 140, marge de 30 autour pour que les veines débordent.
const CW = 100;
const CH = 140;
const M = 30;

type Veins = { count: number; every: number } | null;

const VEINS: Record<Rarity, Veins> = {
  commune: null,
  rare: null,
  epique: { count: 5, every: 3000 },
  legendaire: { count: 8, every: 1900 },
};

// Point du bord de la carte à un angle donné (0 = haut, sens horaire) et direction vers l'extérieur.
function edgeAt(deg: number): [number, number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const k = Math.min(Math.abs(CW / 2 / (dx || 1e-9)), Math.abs(CH / 2 / (dy || 1e-9)));
  return [M + CW / 2 + dx * k, M + CH / 2 + dy * k, Math.atan2(dy, dx)];
}

// Veines : petits éclairs ramifiés qui partent du bord, vers l'intérieur ou l'extérieur.
function makeVeins(count: number): string[] {
  return Array.from({ length: count }, () => {
    const [x, y, out] = edgeAt(rand(0, 360));
    const angle = (Math.random() < 0.5 ? out : out + Math.PI) + rand(-0.5, 0.5);
    return branching(x, y, angle, rand(14, 22), 1).join(' ');
  });
}

export default function CardElectric({ rarity }: { rarity: Rarity }) {
  const pulseRef = useRef<SVGGElement>(null);
  const config = VEINS[rarity];
  const veins = useMemo(() => (config ? makeVeins(config.count) : []), [config]);

  // Une lumière parcourt une veine au hasard, à intervalle un peu irrégulier.
  useEffect(() => {
    if (!config || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let timer = 0;
    const loop = () => {
      const g = pulseRef.current;
      if (g && veins.length) {
        g.innerHTML = `<path pathLength="1" d="${veins[Math.floor(Math.random() * veins.length)]}"/>`;
      }
      timer = window.setTimeout(loop, config.every * rand(0.7, 1.3));
    };
    timer = window.setTimeout(loop, rand(200, config.every));
    return () => window.clearTimeout(timer);
  }, [config, veins]);

  if (rarity === 'commune') return null;

  return (
    <div className={`${styles.electric} ${styles[rarity]}`} aria-hidden="true">
      <div className={styles.glow} />
      {rarity === 'legendaire' && <div className={styles.base} />}
      <div className={styles.current} />
      {config && (
        <svg className={styles.arcs} viewBox={`0 0 ${CW + 2 * M} ${CH + 2 * M}`}>
          <g className={styles.veins}>
            {veins.map((d, i) => <path key={i} d={d} />)}
          </g>
          <g ref={pulseRef} className={styles.pulse} />
        </svg>
      )}
    </div>
  );
}
