import { notFound } from 'next/navigation';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import { fontVariables } from '../fonts';
import ds from '../components/ds/ds.module.css';
import CollectionView from './CollectionView';

// Collection de cartes (test) : cadres provisoires (_dev), jamais servie en production.
export default function CollectionPage() {
  if (process.env.VERCEL_ENV === 'production') notFound();

  return (
    <main className={`${ds.page} ${fontVariables}`}>
      <Nav />
      <CollectionView />
      <Footer />
    </main>
  );
}
