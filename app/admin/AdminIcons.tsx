// Icônes du menu admin (SVG, jamais d'emoji).
const base = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, 'aria-hidden': true } as const;

export const HomeIcon = () => (<svg {...base}><path d="M4 11 12 4l8 7v9h-5v-6H9v6H4v-9Z" /></svg>);
export const TeamIcon = () => (<svg {...base}><path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7 0a2.5 2.5 0 1 0 0-5M3 19c0-3 3-5 6-5s6 2 6 5m2-5c2 0 4 1.5 4 4" /></svg>);
export const PlayerIcon = () => (<svg {...base}><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8c0-4 3-6 7-6s7 2 7 6" /></svg>);
export const TrophyIcon = () => (<svg {...base}><path d="M7 4h10v5a5 5 0 0 1-10 0V4Zm0 2H4a3 3 0 0 0 3 4m10-4h3a3 3 0 0 1-3 4M9 20h6m-3-6v6" /></svg>);
export const RiotIcon = () => (<svg {...base}><path d="M4 18 6 6l12-2-2 14H4Zm4-4h6" /></svg>);
export const CardIcon = () => (<svg {...base}><path d="M7 3h10v18H7zM10 7h4m-4 10h4" /></svg>);
export const KeyIcon = () => (<svg {...base}><path d="M8 15a4 4 0 1 1 3-6.5L21 8v3h-2v2h-2v2h-3l-2.5-2.5A4 4 0 0 1 8 15Z" /></svg>);
