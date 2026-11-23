// Pure Stickerwall prototype data: no photos, network, or persistence.
export type Creature = 'axolotl' | 'dragon' | 'penguin';

export const CREATURES: ReadonlyArray<{ id: Creature; label: string; character: string }> = [
  { id: 'axolotl', label: 'Axolotl', character: 'De stille verbinder' },
  { id: 'dragon', label: 'Draak', character: 'De enthousiaste aanjager' },
  { id: 'penguin', label: 'Pinguïn', character: 'De slimme dwarsdenker' },
];

export const QUALITIES = [
  'Zorgzaam',
  'Creatief',
  'Nieuwsgierig',
  'Humor',
  'Daadkrachtig',
  'Rustig',
  'Verbindend',
  'Vindingrijk',
] as const;

export type Quality = (typeof QUALITIES)[number];

const DEFAULT_NAMES: Record<Creature, string> = {
  axolotl: 'De Zachtmoedige Zeedenker',
  dragon: 'De Draak van Daad en Droom',
  penguin: 'De Pinguïn met Plan B',
};

export function creatureName(creature: Creature, qualities: readonly Quality[]): string {
  if (creature === 'axolotl' && qualities.includes('Verbindend')) return 'De Diplomatieke Diepzeeduiker';
  if (creature === 'axolotl' && qualities.includes('Nieuwsgierig')) return 'De Nieuwsgierige Nachtaxolotl';
  if (creature === 'dragon' && qualities.includes('Creatief')) return 'De Draak met Duizend Ideeën';
  if (creature === 'dragon' && qualities.includes('Rustig')) return 'De Bedachtzame Vuurmeester';
  if (creature === 'penguin' && qualities.includes('Humor')) return 'De Pinguïn van de Prettige Chaos';
  if (creature === 'penguin' && qualities.includes('Zorgzaam')) return 'De Warme Winterwachter';
  return DEFAULT_NAMES[creature];
}

export function toggleQuality(selected: readonly Quality[], quality: Quality): Quality[] {
  if (selected.includes(quality)) return selected.filter((item) => item !== quality);
  if (selected.length >= 3) return [...selected];
  return [...selected, quality];
}
