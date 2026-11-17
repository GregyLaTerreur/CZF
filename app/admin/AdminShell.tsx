'use client';

import { Suspense, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useIsAdmin } from '@/app/components/Nav';
import { useIsBetaTester, useIsSuperAdmin } from '@/app/components/beta';
import { CardIcon, HomeIcon, KeyIcon, PlayerIcon, RiotIcon, TeamIcon, TrophyIcon } from './AdminIcons';
import styles from './admin.module.css';

// Nombre d'équipes à valider, envoyé par la page Admin après chaque chargement.
export const ADMIN_TO_VALIDATE = 'czf:admin-to-validate';

// Menu admin pleine hauteur, gardé sur toutes les pages /admin/*. Affichage seulement :
// chaque page et chaque route API vérifient elles-mêmes les droits.
export default function AdminShell({ children }: { children: ReactNode }) {
  const isAdmin = useIsAdmin();
  if (!isAdmin) return <>{children}</>;

  return (
    <div className={styles.full}>
      <div className={styles.layout}>
        <aside className={styles.side}>
          <Suspense fallback={null}>
            <AdminMenu />
          </Suspense>
        </aside>
        <div className={styles.main}>{children}</div>
      </div>
    </div>
  );
}

function AdminMenu() {
  const pathname = usePathname();
  const vue = useSearchParams().get('vue');
  const isBetaTester = useIsBetaTester();
  const isSuperAdmin = useIsSuperAdmin();
  const [toValidate, setToValidate] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch('/api/teams')
      .then((res) => res.json())
      .then((json) => {
        if (alive && json.success) setToValidate((json.data || []).filter((t: any) => !t.validated_by_admin).length);
      })
      .catch(() => {});
    const onCount = (event: Event) => setToValidate(Number((event as CustomEvent).detail) || 0);
    window.addEventListener(ADMIN_TO_VALIDATE, onCount);
    return () => {
      alive = false;
      window.removeEventListener(ADMIN_TO_VALIDATE, onCount);
    };
  }, []);

  const onHome = pathname === '/admin';
  const cls = (active: boolean) => (active ? styles.sideOn : styles.sideLink);
  const under = (path: string) => pathname === path || pathname.startsWith(`${path}/`);

  return (
    <nav className={styles.sideInner} aria-label="Administration">
      <div className={styles.sideTitle}>Administration</div>
      <Link href="/admin" className={cls(onHome && vue !== 'equipes' && vue !== 'joueurs')}>
        <HomeIcon /> Tableau de bord
      </Link>

      <div className={styles.sideTitle}>Compétition</div>
      <Link href="/admin?vue=equipes" className={cls(onHome && vue === 'equipes')}>
        <TeamIcon /> Équipes
        {toValidate > 0 && <span className={styles.sideCount}>{toValidate}</span>}
      </Link>
      <Link href="/admin?vue=joueurs" className={cls(onHome && vue === 'joueurs')}>
        <PlayerIcon /> Joueurs
      </Link>
      <Link href="/admin/results" className={cls(under('/admin/results'))}>
        <TrophyIcon /> Résultats
      </Link>
      <Link href="/admin/riot" className={cls(under('/admin/riot'))}>
        <RiotIcon /> BO Riot
      </Link>

      {/* TCG en bêta : seulement pour les admins bêta-testeurs. */}
      {isBetaTester && (
        <>
          <div className={styles.sideTitle}>TCG</div>
          <Link href="/admin/tcg" className={cls(under('/admin/tcg'))}>
            <CardIcon /> Cartes et boosters
          </Link>
        </>
      )}

      {/* Droits d'admin (admin_grants) : seulement pour les superadmins. */}
      {isSuperAdmin && (
        <>
          <div className={styles.sideTitle}>Système</div>
          <Link href="/admin/droits" className={cls(under('/admin/droits'))}>
            <KeyIcon /> Droits
          </Link>
        </>
      )}
    </nav>
  );
}
