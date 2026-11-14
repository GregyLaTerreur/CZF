'use client';

import { useEffect, useRef } from 'react';
import type { Rarity } from '@/lib/tcg/cards';
import styles from './cardElectric.module.css';

// Effet électrique autour d'une carte (maquette « E2 ») : un courant lent fait le tour,
// décharges seulement en épique et légendaire, contour allumé en légendaire. Rien en commune.
// À poser dans un parent en position relative, de la taille de la carte.

type Config = { every: number; chance: number; count: number; length: number } | null;

// Unités du SVG : carte de 100 x 140, marge de 30 autour pour que les décharges débordent.
const CW = 100;
const CH = 140;
const M = 30;

const DISCHARGES: Record<Rarity, Config> = {
  commune: null,
  rare: null,
  epique: { every: 520, chance: 0.22, count: 1, length: 11 },
  legendaire: { every: 520, chance: 0.4, count: 2, length: 14 },
};

// Point du bord de la carte à un angle donné (0 = haut, sens horaire) et sa normale vers l'extérieur.
function edgeAt(deg: number): [number, number, number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const k = Math.min(Math.abs(CW / 2 / (dx || 1e-9)), Math.abs(CH / 2 / (dy || 1e-9)));
  const x = M + CW / 2 + dx * k;
  const y = M + CH / 2 + dy * k;
  const onSide = Math.abs(Math.abs(x - M - CW / 2) - CW / 2) < 0.5;
  return [x, y, onSide ? Math.sign(dx) : 0, onSide ? 0 : Math.sign(dy)];
}

// Décharge en zigzag qui part du bord vers l'extérieur.
function bolt(length: number) {
  const [x, y, nx, ny] = edgeAt(Math.random() * 360);
  const len = length * (0.75 + Math.random() * 0.5);
  let d = `M${x.toFixed(1)} ${y.toFixed(1)}`;
  for (let i = 1; i <= 5; i++) {
    const k = (i / 5) * len;
    const j = (Math.random() - 0.5) * len * 0.4;
    d += ` L${(x + nx * k + ny * j).toFixed(1)} ${(y + ny * k + nx * j).toFixed(1)}`;
  }
  return d;
}

export default function CardElectric({ rarity }: { rarity: Rarity }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const config = DISCHARGES[rarity];

  useEffect(() => {
    if (!config || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => {
      const svg = svgRef.current;
      if (!svg || Math.random() >= config.chance) return;
      svg.innerHTML = Array.from({ length: config.count }, () => `<path d="${bolt(config.length)}"/>`).join('');
    }, config.every);
    return () => window.clearInterval(timer);
  }, [config]);

  if (rarity === 'commune') return null;

  return (
    <div className={`${styles.electric} ${styles[rarity]}`} aria-hidden="true">
      <div className={styles.glow} />
      {rarity === 'legendaire' && <div className={styles.base} />}
      <div className={styles.current} />
      {config && <svg ref={svgRef} className={styles.arcs} viewBox={`0 0 ${CW + 2 * M} ${CH + 2 * M}`} />}
    </div>
  );
}
