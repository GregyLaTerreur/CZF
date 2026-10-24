'use client';

import { useEffect, useState } from 'react';
import ds from './ds.module.css';
import { DDRAGON_FALLBACK, ROLES } from './lol';

// Une seule requête par visite, partagée entre les pages.
let ddragonVersion: string | null = null;
let ddragonRequest: Promise<string> | null = null;

function loadDdragonVersion() {
  ddragonRequest ??= fetch('https://ddragon.leagueoflegends.com/api/versions.json')
    .then((res) => res.json())
    .then((versions) => {
      ddragonVersion = versions?.[0] || DDRAGON_FALLBACK;
      return ddragonVersion as string;
    })
    .catch(() => {
      // Réessai possible à la prochaine page.
      ddragonRequest = null;
      return DDRAGON_FALLBACK;
    });

  return ddragonRequest;
}

// Dernière version Data Dragon, pour les icônes des champions récents.
export function useDdragonVersion() {
  const [version, setVersion] = useState(ddragonVersion ?? DDRAGON_FALLBACK);

  useEffect(() => {
    if (ddragonVersion) return;

    let active = true;
    loadDdragonVersion().then((value) => active && setVersion(value));

    return () => {
      active = false;
    };
  }, []);

  return version;
}

export function ChampionPool({
  player,
  ddragonVersion,
  size = 'small',
}: {
  player: any;
  ddragonVersion: string;
  size?: 'small' | 'large';
}) {
  const champions = player?.top_champions || [];

  if (!champions.length) return <span className={ds.muted}>—</span>;

  return (
    <div className={size === 'large' ? ds.poolLarge : ds.pool}>
      {champions.map((champion: any) => (
        <img
          key={champion.champion_id}
          src={`https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${champion.champion_name}.png`}
          alt={champion.champion_name}
          title={champion.champion_name}
          loading="lazy"
          // Nom de champion inconnu de Data Dragon : on masque l'image cassée.
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
      ))}
    </div>
  );
}

export function RolePicker({
  value,
  onChange,
  optional,
}: {
  value: string;
  onChange: (role: string) => void;
  optional?: boolean;
}) {
  return (
    <div className={ds.rolePicker}>
      {ROLES.map((role) => (
        <button
          key={role.name}
          type="button"
          className={value === role.name ? ds.rolePickActive : ds.rolePick}
          // Un rôle optionnel peut être retiré en recliquant dessus.
          onClick={() => onChange(optional && value === role.name ? '' : role.name)}
          title={role.name}
        >
          <img src={role.image} alt="" />
          {role.label}
        </button>
      ))}
    </div>
  );
}

export function ChevronIcon({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 12 12"
      className={className}
      style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }}
      aria-hidden="true"
      width="12"
      height="12"
    >
      <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
