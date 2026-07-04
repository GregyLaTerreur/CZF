'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUser(user);

      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!profile) {
        await supabase.from('profiles').insert([
          {
            id: user.id,
            discord_name:
              user.user_metadata?.full_name ||
              user.user_metadata?.name ||
              'Unknown',
          },
        ]);
      }
    }

    loadUser();
  }, []);

  useEffect(() => {
    if (user) {
      window.location.href = '/onboarding';
    }
  }, [user]);

  async function loginDiscord() {
    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: `${window.location.origin}/onboarding`,
      },
    });
  }

  return (
    <main className="pageContainer">
      <div className="card">
        <h1>Connexion CZF</h1>

        <button onClick={loginDiscord}>
          Connexion Discord
        </button>
      </div>
    </main>
  );
}