'use client';

import { Fragment, type CSSProperties, type PointerEvent } from 'react';
import { roleInfo } from '@/app/components/ds/lol';
import {
  ART_DEFAULT,
  CARD_BORDER,
  CARD_RADIUS,
  CARD_SIZE,
  LAYOUTS,
  NAME_MAX_WIDTH,
  RARITY_ACCENTS,
  DEFAULT_NOTE,
  STAT_CIRCLE_ORDER,
  TYPE_FIELDS,
  championArt,
  cardFrame,
  divisionIcon,
  cardEffect,
  pctX,
  pctY,
  type TcgCard,
} from '@/lib/tcg/cards';
import styles from './playerCard.module.css';

// Arrondi des coins sur les cadres de la graphiste : ~3 mm sur une carte de 63 mm, comme une vraie carte.
const FRAME_RADIUS = 70;

const at = (cx: number, cy: number): CSSProperties => ({ left: pctX(cx), top: pctY(cy) });

// Onglet en haut à gauche : note + rôle (MVP) ou rôle seul (joueur).
const TAB = { w: 270, withNote: 330, roleOnly: 200 };

// large : carte affichée en grand (cadre chargé en pleine définition).
export default function PlayerCard({ card, large = false }: { card: TcgCard; large?: boolean }) {
  const layout = LAYOUTS[card.rarity];
  const fields = TYPE_FIELDS[card.card_type];
  const role = fields.team ? roleInfo(card.role) : null;
  // Épique (rond de rôle à part) : la note est toujours affichée, 99 tant qu'elle n'est pas remplie.
  const note = layout.roleCircle && fields.note ? card.note ?? DEFAULT_NOTE : card.note;
  const showNote = fields.note && note !== null;
  const isStaff = card.card_type === 'staff';
  // Cadre propre au type (ex. épique « événement ») : pas de rond de rôle ni de stats.
  const typeFrame = Boolean(layout.frameByType?.[card.card_type]);
  const stats = fields.stats ? card.stats.filter((stat) => stat.value) : [];
  const { logos } = layout;
  // Pseudo long : la taille baisse pour tenir dans la largeur (≈ 0,5 em par lettre en Barlow Condensed italique).
  const nameSize = Math.min(layout.nameSize, ((NAME_MAX_WIDTH / CARD_SIZE.w) * 100) / (Math.max(card.name.length, 1) * 0.5));

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
      className={`${styles.card} ${styles[card.rarity]} ${layout.ink === 'dark' ? styles.inkDark : ''}`}
      style={{
        aspectRatio: `${CARD_SIZE.w} / ${CARD_SIZE.h}`,
        // Cadre de la graphiste : arrondi d'une vraie carte. Cadres provisoires : arrondi d'origine.
        borderRadius: (() => {
          const r = layout.frame ? FRAME_RADIUS : CARD_RADIUS;
          return `${(r / CARD_SIZE.w) * 100}% / ${(r / CARD_SIZE.h) * 100}%`;
        })(),
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
      <img className={styles.frame} src={cardFrame(card.rarity, large ? 1500 : 750, card.card_type)} alt="" />

      {/* Vernis de la rareté (texture de la graphiste), sous les textes : toutes les cartes de la rareté. */}
      {layout.varnish && (
        <div
          className={styles.varnish}
          style={{ ['--varnish-mask' as string]: `url(${cardEffect(layout.varnish, large ? 1500 : 750)})` }}
        />
      )}

      {/* Cadre de la graphiste, rond du haut : note, sinon « STAFF » (type staff), sinon rôle. */}
      {layout.topCircle && !typeFrame && (showNote || isStaff || (role && !layout.roleCircle)) && (
        <div
          className={`${styles.c} ${styles.circle}`}
          style={{ ...at(layout.topCircle.x, layout.topCircle.y), width: pctX(layout.topCircle.d) }}
        >
          {showNote ? (
            <span className={styles.note}>{note}</span>
          ) : isStaff ? (
            <span className={styles.staff}>Staff</span>
          ) : (
            role && <img className={styles.roleBig} src={role.image} alt={role.label} />
          )}
        </div>
      )}

      {/* Épique : rôle dans le petit rond collé au grand. */}
      {layout.roleCircle && !typeFrame && role && (
        <div
          className={`${styles.c} ${styles.circle}`}
          style={{ ...at(layout.roleCircle.x, layout.roleCircle.y), width: pctX(layout.roleCircle.d) }}
        >
          <img className={styles.roleBig} src={role.image} alt={role.label} />
        </div>
      )}

      {!layout.topCircle && (showNote || role) && (
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
      <div className={`${styles.c} ${styles.name}`} style={{ ...at(750, layout.name), fontSize: `${nameSize}cqw` }}>
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
      {stats.length > 0 && !typeFrame && layout.stats === 'circles' && layout.statCircles && STAT_CIRCLE_ORDER.map((label, index) => {
        const slot = layout.statCircles!.items[index];
        const stat = stats.find((s) => s.label === label);
        if (!slot || !stat) return null;
        // Valeur dans le rond, libellé dessous (tous les libellés sur la même ligne).
        return (
          <Fragment key={label}>
            <div
              className={`${styles.c} ${styles.circle} ${styles.statCircle} ${index === 2 ? styles.statCircleBig : ''}`}
              style={{ ...at(slot.x, slot.y ?? layout.statCircles!.y), width: pctX(slot.d) }}
            >
              <b>{stat.value}</b>
            </div>
            <span className={`${styles.c} ${styles.statLabel}`} style={at(slot.x, slot.labelY ?? layout.statCircles!.labelY)}>
              {label}
            </span>
          </Fragment>
        );
      })}
      {statItems.length > 0 && layout.stats === 'line' && (
        <div className={`${styles.c} ${styles.stats} ${styles.statsLine}`} style={at(750, layout.statsY ?? 0)}>{statItems}</div>
      )}
      {statItems.length > 0 && layout.stats === 'hover' && (
        <div className={`${styles.stats} ${styles.statsHover}`}>{statItems}</div>
      )}

      {fields.team && card.team_logo && (
        // Cadres de la graphiste : logo d'équipe en bas à gauche (en face du numéro).
        <img
          className={`${styles.logo} ${styles.team} ${layout.badges ? styles.teamCorner : styles.c}`}
          style={layout.badges ? undefined : { ...at(logos.left, logos.y), width: pctX(logos.size) }}
          src={card.team_logo}
          alt={card.team_name || ''}
        />
      )}
      {fields.team && card.division && (layout.badges ? (
        // Cadres de la graphiste : fanion dark à bande orange, accroché en haut à droite.
        <div className={styles.pennant}>
          <img src={divisionIcon(card.division)} alt={card.division} />
        </div>
      ) : (
        <img className={`${styles.c} ${styles.logo}`} style={{ ...at(logos.right, logos.y), width: pctX(logos.size) }} src={divisionIcon(card.division)} alt={card.division} />
      ))}

      {card.number && card.season_total && (
        <div className={styles.number}>
          {card.number}<span>/{card.season_total}</span>
        </div>
      )}

      <div className={styles.fx} />
    </div>
  );
}
