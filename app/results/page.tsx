import Nav from '../components/Nav';
import Footer from '../components/Footer';
import { fontVariables } from '../fonts';
import ds from '../components/ds/ds.module.css';
import ResultsView from './ResultsView';

export default function ResultsPage() {
  return (
    <main className={`${ds.page} ${fontVariables}`}>
      <Nav />
      <ResultsView />
      <Footer />
    </main>
  );
}
