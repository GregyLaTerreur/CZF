'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import ds from '@/app/components/ds/ds.module.css';
import CheckIcon from '@/app/components/icons/CheckIcon';
import { DISCORD_URL } from '@/app/components/links';
import styles from './onboarding.module.css';

type Step = {
  title: string;
  text: string;
  done: boolean;
  action: ReactNode;
};

export default function OnboardingView() {
  const [loading, setLoading] = useState(true);
  const [discordName, setDiscordName] = useState('');
  const [hasPlayer, setHasPlayer] = useState(false);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = '/login';
        return;
      }

      const name =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.user_metadata?.preferred_username ||
        'Joueur';

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      // Premier passage après la connexion Discord.
      if (!profile) {
        await supabase.from('profiles').insert([{ id: user.id, discord_name: name }]);
      }

      const { data: player } = await supabase
        .from('players')
        .select('id')
        .eq('profile_id', user.id)
        .maybeSingle();

      setDiscordName(name);
      setHasPlayer(Boolean(player));
      setLoading(false);
    }

    load();
  }, []);

  // Avoir un profil joueur prouve le passage sur le serveur (vérifié à la création).
  const steps: Step[] = [
    {
      title: 'Connexion Discord',
      text: `Ton compte Discord ${discordName} est relié à la CZF.`,
      done: true,
      action: null,
    },
    {
      title: 'Serveur Discord CZF',
      text: 'Obligatoire pour participer : annonces, planning des matchs et contact avec les capitaines.',
      done: hasPlayer,
      action: (
        <a
          href={DISCORD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={`${ds.btnOutline} ${styles.action}`}
        >
          <img src="/assets/discord.svg" alt="" className={styles.discordIcon} />
          Rejoindre le Discord
        </a>
      ),
    },
    {
      title: 'Profil joueur',
      text: 'Renseigne ton Riot ID et tes rôles : ton rang et tes points CZF sont calculés automatiquement.',
      done: hasPlayer,
      action: (
        <Link href="/players" className={`${ds.btnPrimary} ${styles.action}`}>
          Créer mon profil
        </Link>
      ),
    },
  ];

  const current = steps.findIndex((step) => !step.done);
  const complete = current === -1;

  return (
    <>
      <header className={ds.header}>
        <div className={ds.container}>
          <div className={ds.sectionLabel}>Saison 1 · Inscription</div>
          <h1 className={`${ds.h1} ${styles.title}`}>
            Bienvenue{discordName && <em> {discordName}</em>}
          </h1>
          <p className={ds.body}>
            {complete
              ? 'Ton inscription est complète. Rejoins une équipe ou crée la tienne pour jouer la saison.'
              : 'Trois étapes pour jouer en CZF. Une fois ton profil créé, tu pourras rejoindre ou créer une équipe.'}
          </p>
        </div>
      </header>

      <section className={styles.section}>
        <div className={ds.container}>
          {loading ? (
            <div className={`${ds.card} ${ds.empty}`}>Chargement…</div>
          ) : (
            <ol className={styles.steps}>
              {steps.map((step, index) => (
                <li
                  key={step.title}
                  className={`${ds.card} ${styles.step} ${
                    index === current ? styles.stepCurrent : ''
                  }`}
                >
                  <div className={styles.stepHead}>
                    <span className={styles.stepNumber}>0{index + 1}</span>
                    {step.done ? (
                      <span className={styles.statusDone}>
                        <CheckIcon />
                        Fait
                      </span>
                    ) : (
                      <span className={styles.statusTodo}>À faire</span>
                    )}
                  </div>

                  <h2 className={ds.cardTitle}>{step.title}</h2>
                  <p className={styles.text}>{step.text}</p>

                  {!step.done && step.action}
                </li>
              ))}
            </ol>
          )}

          {complete && (
            <div className={styles.next}>
              <Link href="/teams" className={ds.btnPrimary}>
                Créer mon équipe
              </Link>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
