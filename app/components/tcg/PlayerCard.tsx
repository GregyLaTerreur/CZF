'use client';

import type { CSSProperties, PointerEvent } from 'react';
import type { DivisionName } from '@/app/components/home/divisions';
import { roleInfo } from '@/app/components/ds/lol';
import {
  CARD_RADIUS,
  CARD_SIZE,
  LAYOUTS,
  NOTE_POS,
  ROLE_POS,
  championArt,
  cardFrame,
  divisionIcon,
  pctX,
  pctY,
  type Rarity,
} from '@/lib/tcg/cards';
import styles from './playerCard.module.css';

export type CardStat = { label: string; value: string | number };

export type PlayerCardData = {
  name: string;
  teamName: string;
  teamLogo?: string | null;
  role: string;
  division: DivisionName;
  champion: string; // id Data Dragon
  note: number;
  stats: CardStat[];
};

const at = (cx: number, cy: number): CSSProperties => ({ left: pctX(cx), top: pctY(cy) });

export default function PlayerCard({ player, rarity }: { player: PlayerCardData; rarity: Rarity }) {
  const layout = LAYOUTS[rarity];
  const role = roleInfo(player.role);
  const { logos } = layout;

  // Lumière et inclinaison qui suivent la souris (sauf commune).
  function onMove(event: PointerEvent<HTMLDivElement>) {
    const card = event.currentTarget;
    const box = card.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width;
    const y = (event.clientY - box.top) / box.height;
    card.style.setProperty('--mx', `${x * 100}%`);
    card.style.setProperty('--my', `${y * 100}%`);
    if (rarity !== 'commune') {
      card.style.transform = `perspective(900px) rotateY(${(x - 0.5) * 12}deg) rotateX(${(0.5 - y) * 12}deg)`;
    }
  }

  const stats = player.stats.map((stat) => (
    <div key={stat.label}>
      {stat.label}
      <b>{stat.value}</b>
    </div>
  ));

  return (
    <div
      className={`${styles.card} ${styles[rarity]}`}
      style={{ aspectRatio: `${CARD_SIZE.w} / ${CARD_SIZE.h}`, borderRadius: `${(CARD_RADIUS / CARD_SIZE.w) * 100}% / ${(CARD_RADIUS / CARD_SIZE.h) * 100}%` }}
      onPointerMove={onMove}
      onPointerLeave={(event) => { event.currentTarget.style.transform = ''; }}
    >
      <img className={styles.art} style={{ height: pctY(layout.art) }} src={championArt(player.champion)} alt="" />
      <img className={styles.frame} src={cardFrame(rarity)} alt="" />

      <div className={`${styles.c} ${styles.note}`} style={at(NOTE_POS.cx, NOTE_POS.cy)}>{player.note}</div>
      {role && (
        <img className={`${styles.c} ${styles.role}`} style={{ ...at(ROLE_POS.cx, ROLE_POS.cy), width: pctX(ROLE_POS.size) }} src={role.image} alt={role.label} />
      )}

      {layout.tag !== null && (
        <div className={`${styles.c} ${styles.tag}`} style={at(750, layout.tag)}>{player.teamName}</div>
      )}
      <div className={`${styles.c} ${styles.name}`} style={{ ...at(750, layout.name), fontSize: `${layout.nameSize}cqw` }}>
        {player.name}
      </div>

      {layout.stats === 'pill' && layout.pill && (
        <div
          className={styles.stats}
          style={{ left: pctX(layout.pill.x), top: pctY(layout.pill.y), width: pctX(layout.pill.w), height: pctY(layout.pill.h) }}
        >
          {stats}
        </div>
      )}
      {layout.stats === 'line' && (
        <div className={`${styles.c} ${styles.stats} ${styles.statsLine}`} style={at(750, layout.statsY ?? 0)}>{stats}</div>
      )}
      {layout.stats === 'hover' && <div className={`${styles.stats} ${styles.statsHover}`}>{stats}</div>}

      {player.teamLogo && (
        <img className={`${styles.c} ${styles.logo} ${styles.team}`} style={{ ...at(logos.left, logos.y), width: pctX(logos.size) }} src={player.teamLogo} alt={player.teamName} />
      )}
      <img className={`${styles.c} ${styles.logo}`} style={{ ...at(logos.right, logos.y), width: pctX(logos.size) }} src={divisionIcon(player.division)} alt={player.division} />

      <div className={styles.fx} />
    </div>
  );
}
