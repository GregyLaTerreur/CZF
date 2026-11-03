import Nav from '../components/Nav';
import { fontVariables } from '../fonts';
import ds from '../components/ds/ds.module.css';
import TeamsView from './TeamsView';
import { loadTeamsDirectory } from '@/lib/teams/directory';

// Données lues à chaque requête (dans le cache serveur), pas figées au build.
export const dynamic = 'force-dynamic';

export default async function TeamsPage() {
  const directory = await loadTeamsDirectory().catch((error) => {
    console.error('[EQUIPES]', error);
    return null;
  });

  return (
    <main className={`${ds.page} ${fontVariables}`}>
      <Nav />
      <TeamsView directory={directory} />
    </main>
  );
}
