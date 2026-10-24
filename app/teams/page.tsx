import Nav from '../components/Nav';
import { fontVariables } from '../fonts';
import ds from '../components/ds/ds.module.css';
import TeamsView from './TeamsView';

export default function TeamsPage() {
  return (
    <main className={`${ds.page} ${fontVariables}`}>
      <Nav />
      <TeamsView />
    </main>
  );
}
