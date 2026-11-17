'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { isRealSkin, skinArt } from '@/lib/tcg/cards';
import ds from '@/app/components/ds/ds.module.css';
import styles from './tcgChoice.module.css';

type Choice = { champion: string; skin_num: number; is_default: boolean };
type Champion = { id: string; name: string };
type Skin = { num: number; name: string; parentSkin?: number };

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Reconnecte-toi avec Discord.');
  return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' };
}

// Champion + skin de ma carte TCG pour la saison, modifiable jusqu'au lancement de la collection.
export default function TcgCardChoice({ ddragonVersion }: { ddragonVersion: string }) {
  const [state, setState] = useState<{ season: { id: number; name: string }; launched: boolean; choice: Choice | null } | null>(null);
  const [champions, setChampions] = useState<Champion[]>([]);
  const [skins, setSkins] = useState<Skin[]>([]);
  const [champion, setChampion] = useState('');
  const [skinNum, setSkinNum] = useState(0);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; error?: boolean } | null>(null);

  useEffect(() => {
    (async () => {
      const response = await fetch('/api/tcg/my-choice', { cache: 'no-store', headers: await authHeaders() });
      const json = await response.json();
      if (!json.success) return; // pas de Riot lié, pas bêta-testeur… : le bloc ne s'affiche pas
      setState(json);
      setChampion(json.choice?.champion ?? 'Ahri');
      setSkinNum(json.choice?.skin_num ?? 0);
    })().catch(() => {});
  }, []);

  useEffect(() => {
    if (!state || state.launched) return;
    fetch(`https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/data/fr_FR/champion.json`)
      .then((res) => res.json())
      .then((json) => {
        const list = Object.values(json.data as Record<string, Champion>).map(({ id, name }) => ({ id, name }));
        setChampions(list.sort((a, b) => a.name.localeCompare(b.name, 'fr')));
      })
      .catch(() => {});
  }, [state, ddragonVersion]);

  useEffect(() => {
    if (!champion) return;
    let alive = true;
    fetch(`https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/data/fr_FR/champion/${champion}.json`)
      .then((res) => res.json())
      .then((json) => {
        const list: Skin[] = (json?.data?.[champion]?.skins ?? []).filter(isRealSkin).map((sk: Skin) => ({ num: sk.num, name: sk.name === 'default' ? 'Skin de base' : sk.name }));
        if (alive) setSkins(list);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [champion, ddragonVersion]);

  const dirty = Boolean(state?.choice) && (champion !== state?.choice?.champion || skinNum !== state?.choice?.skin_num || state?.choice?.is_default);
  const skinName = useMemo(() => skins.find((sk) => sk.num === skinNum)?.name ?? 'Skin de base', [skins, skinNum]);

  if (!state) return null;

  async function save() {
    if (saving || !state) return;
    setSaving(true);
    setFeedback(null);
    try {
      const response = await fetch('/api/tcg/my-choice', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ season_id: state.season.id, champion, skin_num: skinNum }),
      });
      const json = await response.json();
      if (!json.success) throw new Error(json.message);
      setState({ ...state, choice: { champion, skin_num: skinNum, is_default: false } });
      setFeedback({ text: 'Choix enregistré.' });
    } catch (err) {
      setFeedback({ text: err instanceof Error ? err.message : 'Erreur.', error: true });
    } finally {
      setSaving(false);
    }
  }

  const championName = champions.find((c) => c.id === champion)?.name ?? champion;

  return (
    <div className={`${ds.card} ${styles.block}`}>
      <div className={styles.label}>Ma carte TCG · {state.season.name}</div>

      <div className={styles.layout}>
        <img className={styles.preview} src={skinArt(champion, skinNum)} alt={`${championName}, ${skinName}`} />

        <div className={styles.side}>
          {state.launched ? (
            <>
              <div className={styles.name}>{championName}</div>
              <div className={styles.skinName}>{skinName}</div>
              <p className={styles.note}>Collection {state.season.name} lancée : ton choix est verrouillé pour cette saison.</p>
            </>
          ) : (
            <>
              <p className={styles.note}>
                Choisis le champion et le skin de ta carte. Tu peux changer jusqu’au lancement de la collection {state.season.name}.
                {state.choice?.is_default && ' Pour l’instant, on a mis ton champion le plus joué.'}
              </p>
              <label className={ds.field}>
                <span>Champion</span>
                <select
                  className={ds.input}
                  value={champion}
                  onChange={(e) => {
                    setChampion(e.target.value);
                    setSkinNum(0);
                  }}
                >
                  {!champions.length && <option value={champion}>{champion}</option>}
                  {champions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>

              <div className={styles.skinsLabel}>Skin · {skinName}</div>
              <div className={styles.skins}>
                {skins.map((sk) => (
                  <button
                    key={sk.num}
                    type="button"
                    className={sk.num === skinNum ? styles.skinOn : styles.skin}
                    onClick={() => setSkinNum(sk.num)}
                    title={sk.name}
                    aria-label={sk.name}
                    aria-pressed={sk.num === skinNum}
                  >
                    <img src={skinArt(champion, sk.num)} alt="" loading="lazy" />
                  </button>
                ))}
              </div>

              <div className={styles.actions}>
                <button type="button" className={ds.btnPrimary} disabled={saving || !dirty} onClick={save}>
                  {saving ? 'Enregistrement…' : 'Enregistrer mon choix'}
                </button>
                {feedback && <span className={feedback.error ? ds.formError : ds.formInfo}>{feedback.text}</span>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
