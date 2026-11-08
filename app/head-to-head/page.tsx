import Nav from '../components/Nav';
import Footer from '../components/Footer';
import { fontVariables } from '../fonts';
import ds from '../components/ds/ds.module.css';

import HeadToHeadView from './HeadToHeadView';

export default function HeadToHeadPage() {
  return (
    <main className={`${ds.page} ${fontVariables}`}>
      <Nav />
      <HeadToHeadView />
      <Footer />
    </main>
  );
}