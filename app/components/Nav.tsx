
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { supabase } from '@/lib/supabase';
import { getMyDivision } from '@/app/components/ds/myDivision';

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

  return (
    <nav className="nav">
      {/* ÉCLAIRS — CHAOS MAÎTRISÉ */}
      <div
        className="navChaos"
        aria-hidden="true"
      >
        <img
          src="/assets/eclairs/eclair_czf_01.png"
          alt=""
          className="navBolt navBolt1"
        />

        <img
          src="/assets/eclairs/eclair_czf_02.png"
          alt=""
          className="navBolt navBolt2"
        />

        <img
          src="/assets/eclairs/eclair_czf_01.png"
          alt=""
          className="navBolt navBolt3"
        />

        <img
          src="/assets/eclairs/eclair_czf_02.png"
          alt=""
          className="navBolt navBolt4"
        />
      </div>

      {/* LOGO CZF */}
      <Link
        href="/"
        className="navLogo"
      >
        <img
          src="/assets/czf-logo.png"
          alt="CZF"
        />
      </Link>

      {/* NAVIGATION */}
      <div className="navLinks">
        <Link
          href="/"
          className={
            isActive('/')
              ? 'active'
              : ''
          }
        >
          Accueil
        </Link>

        <Link
          href="/profile"
          className={
            isActive('/profile')
              ? 'active'
              : ''
          }
        >
          Mon profil
        </Link>

        {isCaptain && (
          <Link
            href="/my-team"
            className={
              isActive('/my-team')
                ? 'active'
                : ''
            }
          >
            Mon équipe
          </Link>
        )}

        <Link
          href="/players"
          className={
            isActive('/players')
              ? 'active'
              : ''
          }
        >
          Joueurs
        </Link>

        <Link
          href="/teams"
          className={
            isActive('/teams')
              ? 'active'
              : ''
          }
        >
          Équipes
        </Link>

        {/* Planning masqué pour le moment.
        <Link
          href="/planning"
          className={
            isActive('/planning')
              ? 'active'
              : ''
          }
        >
          Planning
        </Link>
        */}

        <Link
          href="/results"
          className={
            isActive('/results')
              ? 'active'
              : ''
          }
        >
          Résultats
        </Link>

        <Link
          href="/stats"
          className={
            isActive('/stats')
              ? 'active'
              : ''
          }
        >
          Stats
        </Link>

        <Link
          href="/head-to-head"
          className={
            isActive('/head-to-head')
              ? 'active'
              : ''
          }
        >
          Head to Head
        </Link>

        {/* Hall of Fame masqué pour le moment (page encore vide).
        <Link
          href="/hall-of-fame"
          className={
            isActive('/hall-of-fame')
              ? 'active'
              : ''
          }
        >
          Hall of Fame
        </Link>
        */}

        {/* ADMIN visible uniquement pour les admins */}
        {isAdmin && (
          <Link
            href="/admin"
            className={
              isActive('/admin')
                ? 'active'
                : ''
            }
          >
            Admin
          </Link>
        )}
      </div>
    </nav>
  );
}
