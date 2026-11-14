'use client';

import ds from './ds.module.css';

// Interrupteur du design system : libellé puis case penchée (cream / dark, curseur dark puis orange).
export default function Switch({
  checked,
  onChange,
  label,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={`${ds.switch} ${checked ? ds.switchOn : ''} ${className ?? ''}`}
      onClick={() => onChange(!checked)}
    >
      {label}
      <span className={ds.switchBox} aria-hidden="true" />
    </button>
  );
}
