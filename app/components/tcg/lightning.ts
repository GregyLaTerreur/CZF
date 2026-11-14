// Tracés d'éclairs pour les effets électriques du TCG (sachet, cartes). Coordonnées libres (repère du SVG appelant).

const rand = (min: number, max: number) => min + Math.random() * (max - min);

// Éclair en zigzag entre deux points (rough = amplitude des écarts, en proportion de la longueur).
export function zigzag(x1: number, y1: number, x2: number, y2: number, rough = 0.3, steps = 5): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  let d = `M${x1.toFixed(1)} ${y1.toFixed(1)}`;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const off = (Math.random() - 0.5) * len * rough;
    d += ` L${(x1 + dx * t + nx * off).toFixed(1)} ${(y1 + dy * t + ny * off).toFixed(1)}`;
  }
  return `${d} L${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

// Éclair ramifié qui part d'un point : chaque segment se divise en une ou deux branches plus courtes.
export function branching(x: number, y: number, angle: number, length: number, depth: number, out: string[] = []): string[] {
  const x2 = x + Math.cos(angle) * length;
  const y2 = y + Math.sin(angle) * length;
  out.push(zigzag(x, y, x2, y2));
  if (depth > 0) {
    branching(x2, y2, angle + rand(-0.7, -0.2), length * 0.7, depth - 1, out);
    if (Math.random() < 0.7) branching(x2, y2, angle + rand(0.2, 0.7), length * 0.65, depth - 1, out);
  }
  return out;
}

export { rand };
