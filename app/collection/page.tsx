import { notFound } from 'next/navigation';
import Nav from '../components/Nav';
import { fontVariables } from '../fonts';
import ds from '../components/ds/ds.module.css';
import PlayerCard, { type PlayerCardData } from '../components/tcg/PlayerCard';
import { RARITIES, RARITY_LABELS } from '@/lib/tcg/cards';
import styles from './collection.module.css';

// Collection de cartes (test) : cadres provisoires (_dev), jamais servie en production.
export default function CollectionPage() {
  if (process.env.VERCEL_ENV === 'production') notFound();

  return (
    <main className={`${ds.page} ${fontVariables}`}>
      <Nav />
      <div className={`${ds.container} ${styles.wrap}`}>
        <div className={ds.sectionLabel}>Collection · Test dev</div>
        <h1 className={styles.title}>Collection</h1>
        <p className={styles.sub}>Plus la carte est rare, plus le champion prend de place. Joueurs et stats fictifs.</p>

        <div className={styles.grid}>
          {RARITIES.map((rarity) => (
            <figure key={rarity} className={styles.item}>
              <PlayerCard rarity={rarity} player={SAMPLE} />
              <figcaption>{RARITY_LABELS[rarity]}</figcaption>
            </figure>
          ))}
        </div>

        <div className={styles.grid}>
          {RARITIES.map((rarity, index) => (
            <figure key={rarity} className={styles.item}>
              <PlayerCard rarity={rarity} player={OTHERS[index]} />
              <figcaption>{RARITY_LABELS[rarity]}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </main>
  );
}

const stats = (kda: number, kp: number, dpm: number, vis: number, wr: number) => [
  { label: 'KDA', value: kda },
  { label: 'KP%', value: kp },
  { label: 'DPM', value: dpm },
  { label: 'VIS/M', value: vis },
  { label: 'WR%', value: wr },
];

const SAMPLE: PlayerCardData = {
  name: 'Mousstiiic', teamName: 'Master Poillos', teamLogo: 'https://i.imgur.com/EsNLFRl.png',
  role: 'Mid', division: 'Yordle', champion: 'Ahri', note: 74, stats: stats(6.1, 68, 512, 1.4, 54),
};

const OTHERS: PlayerCardData[] = [
  { name: 'Lemorenthis', teamName: 'MG Rising', teamLogo: 'https://i.imgur.com/NVeMmQy.png', role: 'Top', division: 'Ixtal', champion: 'Garen', note: 68, stats: stats(3.8, 61, 587, 1.1, 58) },
  { name: 'Biflette', teamName: 'BFL Biflette', teamLogo: 'https://i.imgur.com/XWYpGEZ.png', role: 'Jungle', division: 'Targon', champion: 'LeeSin', note: 79, stats: stats(4.9, 74, 421, 1.9, 63) },
  { name: 'Gunpix', teamName: 'Les bras cassés', teamLogo: 'https://i.imgur.com/nMwWqdX.jpeg', role: 'ADC', division: 'Ixtal', champion: 'Jinx', note: 86, stats: stats(7.2, 71, 702, 1.2, 66) },
  { name: 'Poillos', teamName: 'Master Poillos', teamLogo: 'https://i.imgur.com/EsNLFRl.png', role: 'Support', division: 'Targon', champion: 'Thresh', note: 93, stats: stats(5.5, 78, 210, 3.1, 61) },
];
