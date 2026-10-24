'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import ds from '@/app/components/ds/ds.module.css';
import { DIVISION_COLORS } from '@/app/components/home/divisions';
import { ChampionPool, RolePicker, useDdragonVersion } from '@/app/components/ds/LolUi';
import {
  formatRank,
  normalizeRiotId,
  roleInfo,
  soloqGames,
  splitRiotId,
  teamDivision,
  TIERS,
  winRate,
} from '@/app/components/ds/lol';
import styles from './profile.module.css';

const APEX_TIERS = ['MASTER', 'GRANDMASTER', 'CHALLENGER'];
const DIVISIONS = ['IV', 'III', 'II', 'I'];

type Feedback = { text: string; error: boolean } | null;

function discordNameOf(user: any) {
  return (
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.user_metadata?.preferred_username ||
    'Joueur'
  );
}

export default function ProfileView() {
  const [user, setUser] = useState<any>(null);
  const [player, setPlayer] = useState<any>(null);
  const [team, setTeam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const [editing, setEditing] = useState(false);
  const [mainRole, setMainRole] = useState('');
  const [secondaryRole, setSecondaryRole] = useState('');
  const [description, setDescription] = useState('');
  const [peakTier, setPeakTier] = useState('');
  const [peakRank, setPeakRank] = useState('');
  const [peakLp, setPeakLp] = useState('0');

  const ddragonVersion = useDdragonVersion();

  useEffect(() => {
    void loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      setUser(currentUser);
      if (!currentUser) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (!profile) {
        await supabase
          .from('profiles')
          .insert([{ id: currentUser.id, discord_name: discordNameOf(currentUser) }]);
      }

      const { data: linkedPlayer } = await supabase
        .from('players')
        .select('*')
        .eq('profile_id', currentUser.id)
        .maybeSingle();

      setPlayer(linkedPlayer || null);
      if (!linkedPlayer) return;

      const [{ data: members }, { data: teams }] = await Promise.all([
        supabase.from('team_members').select('*'),
        supabase.from('teams').select('*'),
      ]);

      // Membre par player_id, sinon par Riot ID (anciennes lignes).
      const riotId = normalizeRiotId(linkedPlayer.riot_id);
      const memberLine = members?.find((m: any) =>
        m.player_id !== null && m.player_id !== undefined
          ? Number(m.player_id) === Number(linkedPlayer.id)
          : normalizeRiotId(m.riot_id) === riotId
      );

      setTeam(
        teams?.find((t: any) => Number(t.captain_player_id) === Number(linkedPlayer.id)) ||
          teams?.find((t: any) => Number(t.id) === Number(memberLine?.team_id)) ||
          null
      );
    } catch (error) {
      console.error('[PROFILE]', error);
    } finally {
      setLoading(false);
    }
  }

  async function patchPlayer(body: Record<string, unknown>) {
    const res = await fetch('/api/players', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: player.id, ...body }),
    });

    return res.json();
  }

  // Recharge le rang et les points CZF depuis Riot.
  async function refreshRiot() {
    const res = await fetch('/api/players/riot-refresh', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: player.id }),
    });
    const data = await res.json();

    if (!data.success) throw new Error(data.message || 'Erreur Riot.');
    await loadProfile();
  }

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    setFeedback(null);

    try {
      await action();
      setFeedback({ text: success, error: false });
    } catch (error: any) {
      setFeedback({ text: error?.message || 'Une erreur est survenue.', error: true });
    } finally {
      setBusy(false);
    }
  }

  function toggleLft() {
    run(async () => {
      const data = await patchPlayer({ lft: !player.lft });
      if (!data.success) throw new Error('Impossible de modifier le statut LFT.');
      setPlayer({ ...player, lft: !player.lft });
    }, player.lft ? 'Tu n’es plus marqué LFT.' : 'Tu es maintenant marqué LFT.');
  }

  function refreshChampions() {
    run(async () => {
      const res = await fetch('/api/players/champions-refresh', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: player.id }),
      });
      const data = await res.json();

      if (!data.success) throw new Error(data.message || 'Impossible d’actualiser les champions.');
      await loadProfile();
    }, 'Champion pool actualisé.');
  }

  function startEditing() {
    setMainRole(player.main_role || '');
    setSecondaryRole(player.secondary_role || '');
    setDescription(player.description || '');
    setPeakTier(player.peak_tier || '');
    setPeakRank(player.peak_rank || '');
    setPeakLp(String(player.peak_lp || 0));
    setFeedback(null);
    setEditing(true);
  }

  function saveProfile(event: React.FormEvent) {
    event.preventDefault();

    run(async () => {
      if (!mainRole) throw new Error('Choisis un rôle principal.');

      const data = await patchPlayer({
        main_role: mainRole,
        secondary_role: secondaryRole || null,
        description: description || null,
        peak_tier: peakTier || null,
        peak_rank: APEX_TIERS.includes(peakTier) ? null : peakRank || null,
        peak_lp: Number(peakLp) || 0,
      });

      if (!data.success) throw new Error('Impossible d’enregistrer le profil.');

      // Le peak compte dans les points CZF : on recalcule.
      await refreshRiot();
      setEditing(false);
    }, 'Profil enregistré, points CZF recalculés.');
  }

  if (loading) {
    return (
      <header className={ds.header}>
        <div className={ds.container}>
          <div className={`${ds.card} ${ds.empty}`}>Chargement…</div>
        </div>
      </header>
    );
  }

  if (!user || !player) {
    return (
      <header className={ds.header}>
        <div className={`${ds.container} ${ds.headerGrid}`}>
          <div>
            <div className={ds.sectionLabel}>Saison 1 · Mon profil</div>
            <h1 className={ds.h1}>Mon profil</h1>
            <p className={ds.body}>
              Ton profil joueur CZF : rang, points, rôles et champion pool.
            </p>
          </div>

          <div className={`${ds.card} ${ds.sideCard}`}>
            {!user ? (
              <>
                <div className={ds.cardTitle}>Non connecté</div>
                <p className={styles.text}>Connecte-toi avec Discord pour accéder à ton profil.</p>
                <Link href="/login" className={ds.btnPrimary}>
                  Se connecter
                </Link>
              </>
            ) : (
              <>
                <div className={ds.cardTitle}>Pas encore de profil</div>
                <p className={styles.text}>
                  Crée ton profil joueur avec ton Riot ID pour apparaître dans la liste et
                  rejoindre une équipe.
                </p>
                <Link href="/players" className={ds.btnPrimary}>
                  Créer mon profil
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
    );
  }

  const { name, tag } = splitRiotId(player.riot_id);
  const rank = formatRank(player.soloq_tier, player.soloq_rank, player.soloq_lp);
  const peak = formatRank(player.peak_tier, player.peak_rank, player.peak_lp);
  const games = soloqGames(player);
  const winrate = winRate(player);
  const roles = [roleInfo(player.main_role), roleInfo(player.secondary_role)].filter(Boolean);
  const division = teamDivision(team);
  const avatar = user.user_metadata?.avatar_url;

  return (
    <>
      <header className={ds.header}>
        <div className={`${ds.container} ${ds.headerGrid}`}>
          <div>
            <div className={ds.sectionLabel}>Saison 1 · Mon profil</div>

            <div className={styles.identity}>
              {avatar && <img src={avatar} alt="" className={styles.avatar} />}
              <div className={styles.identityText}>
                <h1 className={`${ds.h1} ${styles.name}`}>
                  {name}
                  {tag && <small>#{tag}</small>}
                </h1>
                <span className={styles.discord}>Discord · {discordNameOf(user)}</span>
              </div>
            </div>

            <div className={styles.chips}>
              {roles.map((role, index) => (
                <span key={role!.name} className={styles.roleChip}>
                  <img src={role!.image} alt="" />
                  {role!.label}
                  <small>{index === 0 ? 'Principal' : 'Secondaire'}</small>
                </span>
              ))}
              {player.lft && <span className={ds.chip}>Cherche une équipe</span>}
            </div>
          </div>

          <div className={`${ds.card} ${ds.sideCard}`}>
            <div className={styles.points}>
              <strong>{player.czf_points ?? '—'}</strong>
              <span>Points CZF</span>
            </div>

            <div className={styles.rank}>
              {rank ? (
                <>
                  <img src={TIERS[player.soloq_tier]?.icon} alt="" className={styles.rankIcon} />
                  <span>
                    <strong>{rank}</strong>
                    <small>SoloQ</small>
                  </span>
                </>
              ) : (
                <span>
                  <strong>Non classé</strong>
                  <small>SoloQ</small>
                </span>
              )}
            </div>

            <div className={styles.stats}>
              <div>
                <span>Winrate</span>
                <strong>{winrate === null ? '—' : `${winrate} %`}</strong>
              </div>
              <div>
                <span>Games</span>
                <strong>{games}</strong>
              </div>
              <div>
                <span>Peak</span>
                <strong>{peak || '—'}</strong>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className={styles.section}>
        <div className={ds.container}>
          {feedback && (
            <p className={`${feedback.error ? ds.formError : ds.formInfo} ${styles.feedback}`} role="status">
              {feedback.text}
            </p>
          )}

          {editing ? (
            <form className={`${ds.card} ${styles.editCard}`} onSubmit={saveProfile}>
              <div className={ds.cardTitle}>Modifier mon profil</div>

              <div className={ds.field}>
                <span>Rôle principal</span>
                <RolePicker value={mainRole} onChange={setMainRole} />
              </div>

              <div className={ds.field}>
                <span>Rôle secondaire (optionnel)</span>
                <RolePicker value={secondaryRole} onChange={setSecondaryRole} optional />
              </div>

              <label className={ds.field}>
                <span>Description (optionnel)</span>
                <textarea
                  className={ds.input}
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>

              <div className={ds.field}>
                <span>Peak SoloQ déclaré</span>
                <div className={styles.peakFields}>
                  <select
                    className={ds.input}
                    value={peakTier}
                    onChange={(e) => {
                      setPeakTier(e.target.value);
                      setPeakRank('');
                    }}
                  >
                    <option value="">Aucun</option>
                    {Object.entries(TIERS).map(([tier, info]) => (
                      <option key={tier} value={tier}>
                        {info.label}
                      </option>
                    ))}
                  </select>

                  {peakTier && !APEX_TIERS.includes(peakTier) && (
                    <select
                      className={ds.input}
                      value={peakRank}
                      onChange={(e) => setPeakRank(e.target.value)}
                    >
                      <option value="">Division</option>
                      {DIVISIONS.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  )}

                  {peakTier && (
                    <input
                      className={ds.input}
                      type="number"
                      min={0}
                      value={peakLp}
                      onChange={(e) => setPeakLp(e.target.value)}
                      placeholder="LP"
                      aria-label="LP"
                    />
                  )}
                </div>
              </div>

              <div className={ds.formActions}>
                <button type="submit" className={ds.btnPrimary} disabled={busy}>
                  {busy ? 'Enregistrement…' : 'Enregistrer'}
                </button>
                <button
                  type="button"
                  className={ds.btnOutline}
                  disabled={busy}
                  onClick={() => setEditing(false)}
                >
                  Annuler
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className={styles.actions}>
                <button type="button" className={ds.btnPrimary} onClick={startEditing} disabled={busy}>
                  Modifier mon profil
                </button>
                <button
                  type="button"
                  className={ds.btnOutline}
                  disabled={busy}
                  onClick={() => run(refreshRiot, 'Données Riot actualisées.')}
                >
                  Actualiser Riot
                </button>
                <button type="button" className={ds.btnOutline} disabled={busy} onClick={refreshChampions}>
                  Actualiser champions
                </button>
                <button type="button" className={ds.btnOutline} disabled={busy} onClick={toggleLft}>
                  {player.lft ? 'Ne plus être LFT' : 'Me mettre LFT'}
                </button>
              </div>

              <div className={styles.grid}>
                <div className={`${ds.card} ${styles.block}`}>
                  <div className={styles.blockLabel}>Équipe</div>
                  {team ? (
                    <>
                      <div className={styles.team}>
                        {team.logo_url && <img src={team.logo_url} alt="" className={styles.teamLogo} />}
                        <div>
                          <div className={styles.teamName}>{team.name}</div>
                          <div className={styles.teamMeta}>
                            {division ? (
                              <>
                                <span className={ds.teamDot} style={{ background: DIVISION_COLORS[division] }} />
                                {division}
                              </>
                            ) : (
                              'En attente de validation'
                            )}
                          </div>
                        </div>
                      </div>
                      <Link href="/my-team" className={ds.btnOutline}>
                        Voir mon équipe
                      </Link>
                    </>
                  ) : (
                    <>
                      <p className={styles.text}>Tu n’as pas encore d’équipe.</p>
                      <Link href="/teams" className={ds.btnOutline}>
                        Trouver une équipe
                      </Link>
                    </>
                  )}
                </div>

                <div className={`${ds.card} ${styles.block}`}>
                  <div className={styles.blockLabel}>Champion pool</div>
                  <ChampionPool player={player} ddragonVersion={ddragonVersion} size="large" />
                </div>
              </div>

              {player.description && (
                <div className={`${ds.card} ${styles.block} ${styles.description}`}>
                  <div className={styles.blockLabel}>Description</div>
                  <p className={styles.text}>{player.description}</p>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}
