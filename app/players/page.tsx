import { fontVariables } from '../fonts';
import ds from '../components/ds/ds.module.css';
import PlayersView from './PlayersView';

export default function PlayersPage() {
  return (
    <main className={`${ds.page} ${fontVariables}`}>
      <PlayersView />
    </main>
  );
}
