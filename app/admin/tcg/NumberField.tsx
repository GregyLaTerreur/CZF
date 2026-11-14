'use client';

import { useEffect, useState, type InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number;
  onChange: (value: number) => void;
};

// Champ nombre qui garde le texte tapé : on peut le vider sans qu'un 0 réapparaisse (« 015 »).
export default function NumberField({ value, onChange, ...props }: Props) {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText((current) => (current === '' || Number(current) !== value ? String(value) : current));
    // Seulement quand la valeur change de l'extérieur (édition d'un autre booster, remise à zéro).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      {...props}
      type="number"
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        if (e.target.value !== '') onChange(Number(e.target.value));
      }}
      onBlur={() => text === '' && setText(String(value))}
    />
  );
}
