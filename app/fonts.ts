import { Barlow, Barlow_Condensed } from 'next/font/google';

// Polices du design system, partagées par les pages refondues.
export const barlow = Barlow({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-barlow',
});

export const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  style: ['normal', 'italic'],
  variable: '--font-barlow-condensed',
});

export const fontVariables = `${barlow.variable} ${barlowCondensed.variable}`;
