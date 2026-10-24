import Nav from '../components/Nav';
import { fontVariables } from '../fonts';
import styles from './players.module.css';
import PlayersView from './PlayersView';

export default function PlayersPage() {
  return (
    <main className={`${styles.page} ${fontVariables}`}>
      <Nav />
      <PlayersView />
    </main>
  );
}
