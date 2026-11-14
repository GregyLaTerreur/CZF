'use client';

import { useEffect, useMemo, useState } from 'react';
import ds from '@/app/components/ds/ds.module.css';
import { DIVISIONS } from '@/app/components/home/divisions';
import { RARITIES, RARITY_LABELS, type Rarity, type TcgCard } from '@/lib/tcg/cards';
import styles from './cardFilters.module.css';

type Filters = { season: number | null; rarity: Rarity | null; division: string | null; team: string | null; player: string | null };

export type SeasonOption = { id: number; name: string };

const NONE: Filters = { season: null, rarity: null, division: null, team: null, player: null };
const PAGE = 24;

const uniqueSorted = (values: (string | null)[]) =>
  [...new Set(values.filter((v): v is string => Boolean(v)))].sort((a, b) => a.localeCompare(b, 'fr'));

// Filtres en cascade (saison, rareté, puis division -> équipe -> joueur) + affichage par pages de 24.
// Les choix proposés viennent des cartes elles-mêmes : seulement ce qui existe.
export function useCardFilters<T>(items: T[], getCard: (item: T) => TcgCard, seasons: SeasonOption[] = []) {
  const [filters, setFilters] = useState<Filters>(NONE);
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => setLimit(PAGE), [filters]);

  const options = useMemo(() => {
    const cards = items.map(getCard);
    const inDivision = cards.filter((c) => c.division === filters.division);
    const inTeam = inDivision.filter((c) => c.team_name === filters.team);
    const seasonIds = new Set(cards.map((c) => c.season_id));
    return {
      seasons: seasons.filter((s) => seasonIds.has(s.id)),
      divisions: DIVISIONS.filter((d) => cards.some((c) => c.division === d)),
      teams: filters.division ? uniqueSorted(inDivision.map((c) => c.team_name)) : [],
      players: filters.team ? uniqueSorted(inTeam.map((c) => c.name)) : [],
    };
  }, [items, getCard, seasons, filters.division, filters.team]);

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        const card = getCard(item);
        if (filters.season && card.season_id !== filters.season) return false;
        if (filters.rarity && card.rarity !== filters.rarity) return false;
        if (filters.division && card.division !== filters.division) return false;
        if (filters.team && card.team_name !== filters.team) return false;
        if (filters.player && card.name !== filters.player) return false;
        return true;
      }),
    [items, getCard, filters]
  );

  return {
    filters,
    options,
    filtered,
    visible: filtered.slice(0, limit),
    hasMore: filtered.length > limit,
    showMore: () => setLimit((current) => current + PAGE),
    setSeason: (season: number | null) => setFilters((f) => ({ ...f, season })),
    setRarity: (rarity: Rarity | null) => setFilters((f) => ({ ...f, rarity })),
    // Changer un niveau remet à zéro les niveaux en dessous.
    setDivision: (division: string | null) => setFilters((f) => ({ ...f, division, team: null, player: null })),
    setTeam: (team: string | null) => setFilters((f) => ({ ...f, team, player: null })),
    setPlayer: (player: string | null) => setFilters((f) => ({ ...f, player })),
    reset: () => setFilters(NONE),
  };
}

type Props = ReturnType<typeof useCardFilters<any>> & { total: number };

function Row({ label, all, items, value, onPick }: { label: string; all: string; items: { key: string; label: string }[]; value: string | null; onPick: (v: string | null) => void }) {
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <div className={ds.tabs}>
        <button type="button" className={value === null ? ds.tabActive : ds.tab} onClick={() => onPick(null)}>{all}</button>
        {items.map((item) => (
          <button key={item.key} type="button" className={value === item.key ? ds.tabActive : ds.tab} onClick={() => onPick(item.key)}>
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function CardFilters({ filters, options, filtered, total, setSeason, setRarity, setDivision, setTeam, setPlayer, reset }: Props) {
  const active = Object.values(filters).some(Boolean);

  return (
    <div className={styles.filters}>
      {options.seasons.length > 1 && (
        <Row label="Saison" all="Toutes" value={filters.season === null ? null : String(filters.season)} onPick={(v) => setSeason(v === null ? null : Number(v))}
          items={options.seasons.map((s) => ({ key: String(s.id), label: s.name }))} />
      )}
      <Row label="Rareté" all="Toutes" value={filters.rarity} onPick={(v) => setRarity(v as Rarity | null)}
        items={RARITIES.map((r) => ({ key: r, label: RARITY_LABELS[r] }))} />
      {options.divisions.length > 0 && (
        <Row label="Division" all="Toutes" value={filters.division} onPick={setDivision}
          items={options.divisions.map((d) => ({ key: d, label: d }))} />
      )}
      {filters.division && options.teams.length > 0 && (
        <Row label="Équipe" all="Toute la division" value={filters.team} onPick={setTeam}
          items={options.teams.map((t) => ({ key: t, label: t }))} />
      )}
      {filters.team && options.players.length > 0 && (
        <Row label="Joueur" all="Toute l’équipe" value={filters.player} onPick={setPlayer}
          items={options.players.map((p) => ({ key: p, label: p }))} />
      )}
      <div className={styles.summary}>
        {filtered.length} carte{filtered.length > 1 ? 's' : ''}{active ? ` sur ${total}` : ''}
        {active && <button type="button" className={styles.reset} onClick={reset}>Retirer les filtres</button>}
      </div>
    </div>
  );
}

export function ShowMore({ hasMore, showMore, shown, total }: { hasMore: boolean; showMore: () => void; shown: number; total: number }) {
  if (!hasMore) return null;
  return (
    <div className={styles.more}>
      <button type="button" className={ds.btnOutline} onClick={showMore}>Voir plus ({shown} / {total})</button>
    </div>
  );
}
