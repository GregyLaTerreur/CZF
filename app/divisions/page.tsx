import Nav from '../components/Nav';
import { fontVariables } from '../fonts';
import ds from '../components/ds/ds.module.css';
import DivisionsView from './DivisionsView';

export default function DivisionsPage() {
  return (
    <main className={`${ds.page} ${fontVariables}`}>
      <Nav />
      <DivisionsView />
    </main>
  );
}
