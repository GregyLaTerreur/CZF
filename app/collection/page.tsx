import { notFound } from 'next/navigation';
import Nav from '../components/Nav';
import { fontVariables } from '../fonts';
import ds from '../components/ds/ds.module.css';
import PlayerCard from '../components/tcg/PlayerCard';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { RARITIES, type TcgCard } from '@/lib/tcg/cards';
import styles from './collection.module.css';

export const dynamic = 'force-dynamic';

// Collection de cartes (test) : cadres provisoires (_dev), jamais servie en production.
export default async function CollectionPage() {
  if (process.env.VERCEL_ENV === 'production') notFound();

  const { data, error } = await supabaseAdmin
    .from('czf_tcg_cards')
    .select('*')
    .order('created_at', { ascending: false });

  // Des plus rares aux plus communes, puis des plus récentes aux plus anciennes.
  const cards = ((data || []) as TcgCard[]).sort((a, b) => RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity));

  return (
    <main className={`${ds.page} ${fontVariables}`}>
      <Nav />
      <div className={`${ds.container} ${styles.wrap}`}>
        <div className={ds.sectionLabel}>Collection · Test dev</div>
        <h1 className={styles.title}>Collection</h1>
        <p className={styles.sub}>Les cartes se créent depuis l’admin (Gérer le TCG). Plus la carte est rare, plus le personnage prend de place.</p>

        {error && <p className={ds.empty}>Impossible de charger les cartes.</p>}
        {!error && !cards.length && <p className={ds.empty}>Aucune carte pour l’instant.</p>}

        <div className={styles.grid}>
          {cards.map((card) => (
            <PlayerCard key={card.id} card={card} />
          ))}
        </div>
      </div>
    </main>
  );
}
