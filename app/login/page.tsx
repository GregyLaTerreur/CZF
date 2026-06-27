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

      console.log('USER', user);

      setUser(user);

      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      console.log('PROFILE FOUND', profile);

      if (!profile) {
        const result = await supabase
          .from('profiles')
          .insert([
            {
              id: user.id,
              discord_name:
                user.user_metadata?.full_name ||
                user.user_metadata?.name ||
                'Unknown',
            },
          ]);

        console.log('INSERT RESULT', result);
console.log('INSERT ERROR', result.error);
      }
    }

    loadUser();
  }, []);

  async function loginDiscord() {
    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: 'http://localhost:3000/login',
      },
    });
  }

  if (user) {
    return (
      <main className="pageContainer">
        <div className="card">
          <h1>Bienvenue</h1>

          <p>
            {user.user_metadata?.full_name ||
              user.user_metadata?.name}
          </p>
        </div>
      </main>
    );
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