// Calendar colours are stored as palette ids. The actual shades come from CSS
// (.cat-chip / .cat-dot / .cat-bar in index.css), which tune saturation,
// lightness and hue per colour scheme, light/dark and softness — so the same
// "Sky" looks at home in Paper, Midnight or Lavender.

export const CATEGORY_COLORS = [
  { id: 'rose', label: 'Rose', hue: 350 },
  { id: 'clay', label: 'Clay', hue: 16 },
  { id: 'honey', label: 'Honey', hue: 40 },
  { id: 'olive', label: 'Olive', hue: 70 },
  { id: 'moss', label: 'Moss', hue: 135 },
  { id: 'teal', label: 'Teal', hue: 176 },
  { id: 'sky', label: 'Sky', hue: 205 },
  { id: 'indigo', label: 'Indigo', hue: 232 },
  { id: 'iris', label: 'Iris', hue: 262 },
  { id: 'plum', label: 'Plum', hue: 300 },
  { id: 'stone', label: 'Stone', hue: 30, chroma: 0.12 },
];

const BY_ID = Object.fromEntries(CATEGORY_COLORS.map((c) => [c.id, c]));

// Colour names used by events created before categories existed
const LEGACY_COLORS = { neutral: 'stone', sky: 'sky', violet: 'iris', emerald: 'moss', rose: 'rose', orange: 'clay' };

export function resolveColorId(colorId) {
  if (BY_ID[colorId]) return colorId;
  return LEGACY_COLORS[colorId] || 'sky';
}

// Inline CSS variables consumed by the .cat-* classes
export function colorVars(colorId) {
  const color = BY_ID[resolveColorId(colorId)];
  return { '--cat-h': color.hue, '--cat-chroma': color.chroma ?? 1 };
}

export const SUGGESTED_CATEGORIES = [
  { name: 'Supervision', color: 'iris' },
  { name: 'Writing', color: 'sky' },
  { name: 'Reading', color: 'moss' },
  { name: 'Teaching', color: 'honey' },
  { name: 'Conferences', color: 'clay' },
  { name: 'Personal', color: 'rose' },
];
