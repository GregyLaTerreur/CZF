'use client';

import { useEffect, useState } from 'react';
import Nav from '../components/Nav';
import { supabase } from '@/lib/supabase';

export default function OnboardingPage() {
  const [discordName, setDiscordName] = useState('');

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = '/login';
        return;
      }

      setDiscordName(
        user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.user_metadata?.preferred_username ||
          'Joueur'
      );
    }

    loadUser();
  }, []);

  return (
    <>
      <Nav />

      <main className="pageContainer">
        <div className="card">

          <h1>🎉 Bienvenue {discordName}</h1>

          <br />

          <p>
            Ton compte Discord est maintenant connecté à CZF.
          </p>

          <br />

          <div
            style={{
              background: '#f1e2c0',
              padding: 20,
              borderRadius: 12,
            }}
          >
            <p>✅ Étape 1 : Connexion Discord</p>
            <p>⏳ Étape 2 : Rejoindre le serveur Discord CZF</p>
            <p>⏳ Étape 3 : Créer ton profil joueur</p>
          </div>

          <br />

          <p>
            Pour participer au tournoi, tu dois obligatoirement rejoindre le
            serveur Discord.
          </p>

          <br />

          <a
            href="https://discord.gg/ZWSmEGrv2s"
            target="_blank"
            className="joinTeamBtn"
          >
            🚀 Rejoindre le Discord CZF
          </a>

          <br />
          <br />

          <p>
            Une fois que tu as rejoint le serveur, clique ci-dessous.
          </p>

          <br />

          <a href="/players" className="rulebookButton">
            Continuer → Créer mon profil joueur
          </a>

        </div>
      </main>
    </>
  );
}