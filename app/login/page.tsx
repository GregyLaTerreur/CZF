import Nav from '../components/Nav';
import { fontVariables } from '../fonts';
import ds from '../components/ds/ds.module.css';
import LoginView from './LoginView';

export default function LoginPage() {
  return (
    <main className={`${ds.page} ${fontVariables}`}>
      <Nav />
      <LoginView />
    </main>
  );
}
