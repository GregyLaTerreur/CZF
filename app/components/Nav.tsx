
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { supabase } from '@/lib/supabase';
import { getMyDivision } from '@/app/components/ds/myDivision';
import { DISCORD_URL, RULEBOOK_URL } from '@/app/components/links';
import { fontVariables } from '@/app/fonts';
import styles from './nav.module.css';

// Statut admin gardé pour la visite : la Nav est remontée à chaque page,
// on ne redemande pas is_admin à chaque navigation.
let adminCache: {
  userId: string;
  isAdmin: Promise<boolean>;
  value?: boolean;
} | null = null;

function loadIsAdmin(userId: string) {
  if (adminCache?.userId !== userId) {
    const entry: NonNullable<typeof adminCache> = {
      userId,

      isAdmin: Promise.resolve(
        supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', userId)
          .single()
      ).then(({ data, error }) => {
        // En cas d'erreur, on redemandera à la prochaine page.
        if (error && adminCache === entry) {
          adminCache = null;
        }

        entry.value = data?.is_admin === true;

        return entry.value;
      }),
    };

    adminCache = entry;
  }

  return adminCache.isAdmin;
}

// Même principe pour « Mon équipe » : le lien n'est montré qu'au capitaine d'une équipe.
let captainCache: {
  userId: string;
  isCaptain: Promise<boolean>;
  value?: boolean;
} | null = null;

function loadIsCaptain(userId: string) {
  if (captainCache?.userId !== userId) {
    const entry: NonNullable<typeof captainCache> = {
      userId,

      isCaptain: (async () => {
        const { data: player, error } = await supabase
          .from('players')
          .select('id')
          .eq('profile_id', userId)
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        if (!player) return false;

        const { data: team, error: teamError } = await supabase
          .from('teams')
          .select('id')
          .eq('captain_player_id', player.id)
          .limit(1)
          .maybeSingle();

        if (teamError) throw teamError;
        return Boolean(team);
      })().then(
        (value) => {
          entry.value = value;
          return value;
        },
        () => {
          // En cas d'erreur, on redemandera à la prochaine page.
          if (captainCache === entry) captainCache = null;
          return false;
        }
      ),
    };

    captainCache = entry;
  }

  return captainCache.isCaptain;
}

export default function Nav() {
  // Valeur déjà connue : pas de clignotement du lien Admin entre deux pages.
  const [isAdmin, setIsAdmin] = useState(
    adminCache?.value === true
  );

  const [isCaptain, setIsCaptain] = useState(
    captainCache?.value === true
  );

  const pathname = usePathname();

  useEffect(() => {
    checkAdmin();

    // Division du joueur calculée dès l'arrivée, quelle que soit la page :
    // prête pour les filtres.
    void getMyDivision();
  }, []);

  async function checkAdmin() {
    // Session locale : pas d'appel réseau
    // (l'affichage du lien Admin ne protège rien,
    // les routes admin vérifient le jeton).
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const user = session?.user;

    if (!user) {
      setIsAdmin(false);
      setIsCaptain(false);
      return;
    }

    const [admin, captain] = await Promise.all([
      loadIsAdmin(user.id),
      loadIsCaptain(user.id),
    ]);

    setIsAdmin(admin);
    setIsCaptain(captain);
  }

  function isActive(path: string) {
    if (path === '/') {
      return pathname === '/';
    }

    return pathname.startsWith(path);
  }

  // Pages publiques de la barre principale.
  // Planning et Hall of Fame masqués pour le moment (pages pas prêtes).
  const links = [
    { href: '/', label: 'Accueil' },
    { href: '/players', label: 'Joueurs' },
    { href: '/teams', label: 'Équipes' },
    { href: '/results', label: 'Résultats' },
    { href: '/stats', label: 'Stats' },
    { href: '/head-to-head', label: 'Head to Head' },
  ];

  const cls = (...names: (string | false)[]) => names.filter(Boolean).join(' ');

  return (
    <header className={cls(styles.header, fontVariables)}>
      {/* ÉTAGE DU HAUT : saison + liens secondaires */}
      <div className={styles.top}>
        <div className={cls(styles.inner, styles.topInner)}>
          <span className={styles.season}>
            <span className={styles.seasonDot} aria-hidden="true" />
            Saison 1 en cours
          </span>

          <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className={styles.topLink}>
            Discord
          </a>

          <a href={RULEBOOK_URL} target="_blank" rel="noopener noreferrer" className={styles.topLink}>
            Règlement
          </a>

          {/* ADMIN visible uniquement pour les admins */}
          {isAdmin && (
            <Link href="/admin" className={cls(styles.topLink, isActive('/admin') && styles.active)}>
              Admin
            </Link>
          )}
        </div>
      </div>

      {/* BARRE PRINCIPALE */}
      <nav className={cls(styles.inner, styles.bar)}>
        <Link href="/" className={styles.logo}>
          <img src="/assets/czf-logo.png" alt="CZF" />
        </Link>

        <div className={styles.links}>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cls(styles.link, isActive(link.href) && styles.active)}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className={styles.account}>
          {isCaptain && (
            <Link
              href="/my-team"
              className={cls(styles.btn, styles.btnCream, isActive('/my-team') && styles.active)}
            >
              Mon équipe
            </Link>
          )}

          <Link
            href="/profile"
            className={cls(styles.btn, styles.btnOrange, isActive('/profile') && styles.active)}
          >
            Mon profil
          </Link>
        </div>
      </nav>
    </header>
  );
}
