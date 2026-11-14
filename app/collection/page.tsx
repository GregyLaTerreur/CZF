import { notFound } from 'next/navigation';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import { fontVariables } from '../fonts';
import ds from '../components/ds/ds.module.css';
import CollectionView from './CollectionView';

// Collection de cartes (test) : cadres provisoires (_dev), jamais servie en production.
// ?profil=<uuid> : collection d'un autre joueur (depuis son profil ou le classement).
export default async function CollectionPage({ searchParams }: { searchParams: Promise<{ profil?: string }> }) {
  if (process.env.VERCEL_ENV === 'production') notFound();

  const { profil } = await searchParams;

  return (
    <main className={`${ds.page} ${fontVariables}`}>
      <Nav />
      <CollectionView key={profil ?? 'moi'} viewProfileId={profil} />
      <Footer />
    </main>
  );
}
