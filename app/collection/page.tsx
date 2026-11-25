import Footer from '../components/Footer';
import { fontVariables } from '../fonts';
import ds from '../components/ds/ds.module.css';
import CollectionView from './CollectionView';
import styles from './collection.module.css';

// Collection de cartes (TCG, en bêta) : réservée aux bêta-testeurs, vérifié par les routes /api/tcg.
// ?profil=<uuid> : collection d'un autre joueur (depuis son profil ou le classement).
export default async function CollectionPage({ searchParams }: { searchParams: Promise<{ profil?: string }> }) {
  const { profil } = await searchParams;

  return (
    <main className={`${ds.page} ${styles.page} ${fontVariables}`}>
      <CollectionView key={profil ?? 'moi'} viewProfileId={profil} />
      <Footer />
    </main>
  );
}
