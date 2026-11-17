import Footer from '../components/Footer';
import { fontVariables } from '../fonts';
import ds from '../components/ds/ds.module.css';
import AdminShell from './AdminShell';
import styles from './admin.module.css';

// Toutes les pages /admin/* : menu admin à gauche, page à droite, footer en bas.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className={`${ds.page} ${styles.page} ${fontVariables}`}>
      <AdminShell>{children}</AdminShell>
      <Footer />
    </main>
  );
}
