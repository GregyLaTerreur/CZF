'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import ds from '@/app/components/ds/ds.module.css';
import styles from './login.module.css';

export default function LoginView() {
  const [checking, setChecking] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState('');

  // Déjà connecté : l'onboarding crée le profil si besoin.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        window.location.href = '/onboarding';
        return;
      }
      setChecking(false);
    });
  }, []);

  async function loginDiscord() {
    setError('');
    setRedirecting(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: `${window.location.origin}/onboarding` },
    });

    if (error) {
      setError('Connexion impossible pour le moment, réessaie dans un instant.');
      setRedirecting(false);
    }
  }

  return (
    <header className={ds.header}>
      <div className={`${ds.container} ${ds.headerGrid}`}>
        <div>
          <div className={ds.sectionLabel}>Saison 1 · Espace joueur</div>
          <h1 className={ds.h1}>Connexion</h1>
          <p className={ds.body}>
            Connecte-toi pour créer ton profil joueur, lier ton compte Riot et rejoindre ou
            créer une équipe.
          </p>
        </div>

        <div className={`${ds.card} ${ds.sideCard}`}>
          <div className={ds.cardTitle}>Se connecter</div>
          <p className={styles.text}>
            La connexion se fait uniquement avec Discord. Il faut être membre du serveur CZF
            pour créer son profil.
          </p>

          <button
            type="button"
            className={`${ds.btnOutline} ${styles.discordButton}`}
            onClick={loginDiscord}
            disabled={checking || redirecting}
          >
            <img src="/assets/discord.svg" alt="" className={styles.discordIcon} />
            {redirecting ? 'Redirection…' : 'Se connecter avec Discord'}
          </button>

          {error && <p className={ds.formError}>{error}</p>}
        </div>
      </div>
    </header>
  );
}
