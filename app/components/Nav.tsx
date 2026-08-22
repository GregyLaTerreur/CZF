'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function Nav() {
  const [isAdmin, setIsAdmin] = useState(false);

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

  return (
    <nav className="nav">
      <Link href="/">
        <img src="/assets/czf-logo.png" alt="CZF" />
      </Link>

      <div>
        <Link href="/">Accueil</Link>
        <Link href="/profile">Mon profil</Link>
        <Link href="/my-team">Mon équipe</Link>
        <Link href="/players">Joueurs</Link>
        <Link href="/teams">Équipes</Link>
        <Link href="/divisions">Divisions</Link>
        <Link href="/results">Résultats</Link>
        <Link href="/hall-of-fame">Hall of Fame</Link>

        {isAdmin && (
          <Link href="/admin">Admin</Link>
        )}
      </div>
    </nav>
  );
}