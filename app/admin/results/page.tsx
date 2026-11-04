import Nav from '../../components/Nav';
import Footer from '../../components/Footer';
import { fontVariables } from '../../fonts';
import ds from '../../components/ds/ds.module.css';
import AdminResultsView from './AdminResultsView';
import styles from './results.module.css';

export default function AdminResultsPage() {
  return (
    <main className={`${ds.page} ${styles.page} ${fontVariables}`}>
      <Nav />
      <AdminResultsView />
      <Footer />
    </main>
  );
}
