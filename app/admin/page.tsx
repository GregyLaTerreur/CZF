import { Suspense } from 'react';
import AdminView from './AdminView';

// La vue (?vue=) est lue avec useSearchParams : Suspense requis.
export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <AdminView />
    </Suspense>
  );
}
