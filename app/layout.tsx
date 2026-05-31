import './globals.css';
import type { Metadata } from 'next';
import { Anton } from 'next/font/google';

const anton = Anton({
  subsets: ['latin'],
  weight: '400',
});

export const metadata: Metadata = {
  title: 'Clash des Zéros de la Faille (CZF) - Ligue League of Legends',
  description:
    'Ligue communautaire League of Legends avec divisions, équipes, joueurs, classement CZF et Hall of Fame.',

  openGraph: {
    title: 'Clash des Zéros de la Faille',
    description:
      'Ligue communautaire League of Legends avec divisions, équipes et classement CZF.',
    images: ['/assets/czf-logo.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className={anton.className}>
        {children}
      </body>
    </html>
  );
}