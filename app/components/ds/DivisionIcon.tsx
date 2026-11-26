import { cdnImage } from '@/lib/assets';
import ds from './ds.module.css';

// Icône officielle d'une division (Cloudinary, la même que sur l'accueil et les cartes TCG).
// Dans les onglets / filtres, à la place de la pastille de couleur.
export default function DivisionIcon({ division }: { division: string }) {
  return (
    <img
      className={ds.divisionIcon}
      src={cdnImage(`cards/s1/divisions/${division.toLowerCase()}`, 'f_auto,q_auto,w_80')}
      alt=""
    />
  );
}
