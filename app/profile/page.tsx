import Nav from '../components/Nav';
import Footer from '../components/Footer';
import { fontVariables } from '../fonts';
import ds from '../components/ds/ds.module.css';
import ProfileView from './ProfileView';
import styles from './profile.module.css';

export default function ProfilePage() {
  return (
    <main className={`${ds.page} ${styles.page} ${fontVariables}`}>
      <Nav />
      <ProfileView />
      <Footer />
    </main>
  );
}
