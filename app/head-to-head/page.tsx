import Nav from '../components/Nav';
import Footer from '../components/Footer';
import { fontVariables } from '../fonts';
import ds from '../components/ds/ds.module.css';

import HeadToHeadView from './HeadToHeadView';
import styles from './head-to-head.module.css';

export default function HeadToHeadPage() {
  return (
    <main className={`${ds.page} ${styles.page} ${fontVariables}`}>
      <Nav />
      <HeadToHeadView />
      <div className={styles.footerSpacer} />
      <Footer />
    </main>
  );
}
