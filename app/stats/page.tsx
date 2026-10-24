import Nav from '../components/Nav';
import Footer from '../components/Footer';
import { fontVariables } from '../fonts';
import ds from '../components/ds/ds.module.css';
import StatsView from './StatsView';

export default function StatsPage() {
  return (
    <main className={`${ds.page} ${fontVariables}`}>
      <Nav />
      <StatsView />
      <Footer />
    </main>
  );
}
