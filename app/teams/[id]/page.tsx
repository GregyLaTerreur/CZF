import { notFound } from 'next/navigation';
import Nav from '../../components/Nav';
import Footer from '../../components/Footer';
import { fontVariables } from '../../fonts';
import ds from '../../components/ds/ds.module.css';
import MyTeamView from '../../my-team/MyTeamView';
import styles from '../../my-team/my-team.module.css';

// Page publique d'une équipe : même vue que Mon équipe, en lecture seule si ce n'est pas la sienne.
export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const teamId = Number((await params).id);

  if (!Number.isInteger(teamId) || teamId <= 0) notFound();

  return (
    <main className={`${ds.page} ${styles.page} ${fontVariables}`}>
      <Nav />
      <MyTeamView teamId={teamId} />
      <Footer />
    </main>
  );
}
