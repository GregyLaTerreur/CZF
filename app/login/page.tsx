import Nav from '../components/Nav';
import Footer from '../components/Footer';
import { fontVariables } from '../fonts';
import ds from '../components/ds/ds.module.css';
import LoginView from './LoginView';
import styles from './login.module.css';

export default function LoginPage() {
  return (
    <main className={`${ds.page} ${styles.page} ${fontVariables}`}>
      <Nav />
      <LoginView />
      <Footer />
    </main>
  );
}
