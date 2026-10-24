import Nav from '../components/Nav';
import Footer from '../components/Footer';
import { fontVariables } from '../fonts';
import ds from '../components/ds/ds.module.css';
import MyTeamView from './MyTeamView';
import styles from './my-team.module.css';

export default function MyTeamPage() {
  return (
    <main className={`${ds.page} ${styles.page} ${fontVariables}`}>
      <Nav />
      <MyTeamView />
      <Footer />
    </main>
  );
}
