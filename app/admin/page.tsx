import Nav from '../components/Nav';
import Footer from '../components/Footer';
import { fontVariables } from '../fonts';
import ds from '../components/ds/ds.module.css';
import AdminView from './AdminView';
import styles from './admin.module.css';

export default function AdminPage() {
  return (
    <main className={`${ds.page} ${styles.page} ${fontVariables}`}>
      <Nav />
      <AdminView />
      <Footer />
    </main>
  );
}
