import './globals.css';
import './spacing.css';
import type { Metadata } from 'next';
import { Anton } from 'next/font/google';
import { asset, cssAssetVariables } from '@/lib/assets';

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
        url: asset('/assets/og-image.png', 'f_jpg,q_auto,w_1200'),
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
      <head>
        {/* Images de fond du CSS (globals.css) : URL du CDN ou de /public selon l'environnement. */}
        <style dangerouslySetInnerHTML={{ __html: cssAssetVariables() }} />
      </head>
      <body className={anton.className}>
        {children}
      </body>
    </html>
  );
}