import Nav from '../../components/Nav';
import Footer from '../../components/Footer';
import { fontVariables } from '../../fonts';
import ds from '../../components/ds/ds.module.css';
import DroitsView from './DroitsView';

// Gestion des droits d'admin (table admin_grants) : réservée aux superadmins.
export default function DroitsPage() {
  return (
    <main className={`${ds.page} ${fontVariables}`}>
      <Nav />
      <DroitsView />
      <Footer />
    </main>
  );
}
