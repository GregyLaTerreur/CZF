import Footer from '../../components/Footer';
import { fontVariables } from '../../fonts';
import ds from '../../components/ds/ds.module.css';
import TcgAdminView from './TcgAdminView';

export default function TcgAdminPage() {
  return (
    <main className={`${ds.page} ${fontVariables}`}>
      <TcgAdminView />
      <Footer />
    </main>
  );
}
