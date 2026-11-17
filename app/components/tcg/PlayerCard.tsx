'use client';

import type { CSSProperties, PointerEvent } from 'react';
import { roleInfo } from '@/app/components/ds/lol';
import {
  ART_DEFAULT,
  CARD_BORDER,
  CARD_RADIUS,
  CARD_SIZE,
  LAYOUTS,
  RARITY_ACCENTS,
  TYPE_FIELDS,
  championArt,
  cardFrame,
  divisionIcon,
  pctX,
  pctY,
  type TcgCard,
} from '@/lib/tcg/cards';
import styles from './playerCard.module.css';

const at = (cx: number, cy: number): CSSProperties => ({ left: pctX(cx), top: pctY(cy) });

// Onglet en haut à gauche : note + rôle (MVP) ou rôle seul (joueur).
const TAB = { w: 270, withNote: 330, roleOnly: 200 };

export default function PlayerCard({ card }: { card: TcgCard }) {
  const layout = LAYOUTS[card.rarity];
  const fields = TYPE_FIELDS[card.card_type];
  const role = fields.team ? roleInfo(card.role) : null;
  const showNote = fields.note && card.note !== null;
  const stats = fields.stats ? card.stats.filter((stat) => stat.value) : [];
  const { logos } = layout;

  // Lumière et inclinaison qui suivent la souris (sauf commune).
  function onMove(event: PointerEvent<HTMLDivElement>) {
    const el = event.currentTarget;
    const box = el.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width;
    const y = (event.clientY - box.top) / box.height;
    el.style.setProperty('--mx', `${x * 100}%`);
    el.style.setProperty('--my', `${y * 100}%`);
    if (card.rarity !== 'commune') {
      el.style.transform = `perspective(900px) rotateY(${(x - 0.5) * 12}deg) rotateX(${(0.5 - y) * 12}deg)`;
    }
  }

  const tabHeight = showNote ? TAB.withNote : TAB.roleOnly;
  const statItems = stats.map((stat) => (
    <div key={stat.label}>
      {stat.label}
      <b>{stat.value}</b>
    </div>
  ));

  return (
    <div
      className={`${styles.card} ${styles[card.rarity]}`}
      style={{
        aspectRatio: `${CARD_SIZE.w} / ${CARD_SIZE.h}`,
        borderRadius: `${(CARD_RADIUS / CARD_SIZE.w) * 100}% / ${(CARD_RADIUS / CARD_SIZE.h) * 100}%`,
        ['--accent' as string]: RARITY_ACCENTS[card.rarity],
      }}
      onPointerMove={onMove}
      onPointerLeave={(event) => { event.currentTarget.style.transform = ''; }}
    >
      {/* Cadrage réglé dans l'admin : point gardé au centre + zoom autour de ce point. */}
      <img
        className={styles.art}
        style={{
          height: pctY(layout.art),
          objectPosition: `${card.art_x ?? ART_DEFAULT.x}% ${card.art_y ?? ART_DEFAULT.y}%`,
          transform: `scale(${card.art_zoom ?? ART_DEFAULT.zoom})`,
          transformOrigin: `${card.art_x ?? ART_DEFAULT.x}% ${card.art_y ?? ART_DEFAULT.y}%`,
        }}
        src={championArt(card)}
        alt=""
        draggable={false}
      />
      <img className={styles.frame} src={cardFrame(card.rarity)} alt="" />

      {(showNote || role) && (
        <div
          className={styles.tab}
          style={{
            left: pctX(CARD_BORDER), top: pctY(CARD_BORDER), width: pctX(TAB.w), height: pctY(tabHeight),
            background: `rgba(8, 20, 40, ${layout.tabOpacity})`,
          }}
        >
          {showNote && <span className={styles.note}>{card.note}</span>}
          {role && <img className={styles.role} src={role.image} alt={role.label} />}
        </div>
      )}

      {fields.team && layout.tag !== null && card.team_name && (
        <div className={`${styles.c} ${styles.tag}`} style={at(750, layout.tag)}>{card.team_name}</div>
      )}
      <div className={`${styles.c} ${styles.name}`} style={{ ...at(750, layout.name), fontSize: `${layout.nameSize}cqw` }}>
        {card.name}
      </div>

      {statItems.length > 0 && layout.stats === 'pill' && layout.pill && (
        <div
          className={`${styles.stats} ${styles.pill}`}
          style={{ left: pctX(layout.pill.x), top: pctY(layout.pill.y), width: pctX(layout.pill.w), height: pctY(layout.pill.h) }}
        >
          {statItems}
        </div>
      )}
      {statItems.length > 0 && layout.stats === 'line' && (
        <div className={`${styles.c} ${styles.stats} ${styles.statsLine}`} style={at(750, layout.statsY ?? 0)}>{statItems}</div>
      )}
      {statItems.length > 0 && layout.stats === 'hover' && (
        <div className={`${styles.stats} ${styles.statsHover}`}>{statItems}</div>
      )}

      {fields.team && card.team_logo && (
        <img className={`${styles.c} ${styles.logo} ${styles.team}`} style={{ ...at(logos.left, logos.y), width: pctX(logos.size) }} src={card.team_logo} alt={card.team_name || ''} />
      )}
      {fields.team && card.division && (
        <img className={`${styles.c} ${styles.logo}`} style={{ ...at(logos.right, logos.y), width: pctX(logos.size) }} src={divisionIcon(card.division)} alt={card.division} />
      )}

      {card.number && card.season_total && (
        <div className={styles.number}>
          {card.number}<span>/{card.season_total}</span>
        </div>
      )}

      <div className={styles.fx} />
    </div>
  );
}
