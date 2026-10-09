
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Nav() {
  const [isAdmin, setIsAdmin] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    setIsAdmin(profile?.is_admin === true);
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
      <div className="navChaos" aria-hidden="true">

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
      <Link href="/" className="navLogo">
        <img
          src="/assets/czf-logo.png"
          alt="CZF"
        />
      </Link>

      {/* NAVIGATION */}
      <div className="navLinks">

        <Link
          href="/"
          className={isActive('/') ? 'active' : ''}
        >
          Accueil
        </Link>

        <Link
          href="/profile"
          className={isActive('/profile') ? 'active' : ''}
        >
          Mon profil
        </Link>

        <Link
          href="/my-team"
          className={isActive('/my-team') ? 'active' : ''}
        >
          Mon équipe
        </Link>

        <Link
          href="/players"
          className={isActive('/players') ? 'active' : ''}
        >
          Joueurs
        </Link>

        <Link
          href="/teams"
          className={isActive('/teams') ? 'active' : ''}
        >
          Équipes
        </Link>

        <Link
          href="/divisions"
          className={isActive('/divisions') ? 'active' : ''}
        >
          Divisions
        </Link>

        {/* NOUVEAU : PLANNING */}
        <Link
          href="/planning"
          className={isActive('/planning') ? 'active' : ''}
        >
          Planning
        </Link>

        <Link
          href="/results"
          className={isActive('/results') ? 'active' : ''}
        >
          Résultats
        </Link>

        <Link
          href="/hall-of-fame"
          className={isActive('/hall-of-fame') ? 'active' : ''}
        >
          Hall of Fame
        </Link>

        {/* ADMIN visible uniquement pour les admins */}
        {isAdmin && (
          <Link
            href="/admin"
            className={isActive('/admin') ? 'active' : ''}
          >
            Admin
          </Link>
        )}

      </div>

    </nav>
  );
}
