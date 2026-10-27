import { notFound } from 'next/navigation';
import Nav from '../../components/Nav';
import Footer from '../../components/Footer';
import { fontVariables } from '../../fonts';
import ds from '../../components/ds/ds.module.css';
import ProfileView from '../../profile/ProfileView';
import styles from '../../profile/profile.module.css';

// Profil public d'un joueur (lien depuis le roster de Mon équipe).
export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const playerId = Number((await params).id);

  if (!Number.isInteger(playerId) || playerId <= 0) notFound();

  return (
    <main className={`${ds.page} ${styles.page} ${fontVariables}`}>
      <Nav />
      <ProfileView playerId={playerId} />
      <Footer />
    </main>
  );
}
