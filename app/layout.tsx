import './globals.css';
import type { Metadata } from 'next';
import { Anton } from 'next/font/google';

const anton = Anton({
  subsets: ['latin'],
  weight: '400',
});

export const metadata: Metadata = {
  title: 'CZF - Clash des Zéros de la Faille',
  description: 'Tournoi League of Legends amateur',
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