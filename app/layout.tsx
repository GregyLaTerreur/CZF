import './globals.css';
import type { Metadata } from 'next';
import { Anton } from 'next/font/google';

const anton = Anton({
  subsets: ['latin'],
  weight: '400',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://czf-lol.vercel.app'),

  title: 'Clash des Zéros de la Faille (CZF) - Ligue League of Legends',
  description:
    'Ligue communautaire League of Legends avec divisions, équipes, joueurs, classement CZF et Hall of Fame.',

  openGraph: {
    title: 'Clash des Zéros de la Faille',
    description:
      'Ligue communautaire League of Legends avec divisions, équipes et classement CZF.',
    url: 'https://czf-lol.vercel.app',
    siteName: 'CZF',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Clash des Zéros de la Faille',
      },
    ],
    type: 'website',
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