import Nav from '../components/Nav';
import Footer from '../components/Footer';
import { fontVariables } from '../fonts';
import ds from '../components/ds/ds.module.css';
import OnboardingView from './OnboardingView';
import styles from './onboarding.module.css';

export default function OnboardingPage() {
  return (
    <main className={`${ds.page} ${styles.page} ${fontVariables}`}>
      <Nav />
      <OnboardingView />
      <Footer />
    </main>
  );
}
