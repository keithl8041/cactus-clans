import { CARDS } from './cards';

export interface Clan {
  name: string;
  /** Theme colour used in the placeholder card art and clan tiles. */
  color: string;
  /** Short tagline shown under the clan name on the select screen. */
  tagline: string;
  /** Total number of evolution forms. Currently 8 for every clan. */
  formCount: number;
}

// Hand-picked palette per clan — picked to be visually distinct in placeholder
// SVGs and survive contrast on the dark UI. Replace with sampled colours when
// real art lands.
const CLAN_META: Record<string, { color: string; tagline: string }> = {
  'Camo Clan': { color: '#4a6b3a', tagline: 'Masters of disguise.' },
  'Duskerns': { color: '#5d3a8c', tagline: 'Born of shadow and silence.' },
  'Earth Clan': { color: '#7a5a3a', tagline: 'Unshakable. Unbreakable.' },
  'Hot Dog Clan': { color: '#c44a3a', tagline: 'Loyal, loud, and lethal.' },
  'Metal Clan': { color: '#8a8f99', tagline: 'Forged in fire and discipline.' },
  'Oasis Clan': { color: '#3a8caa', tagline: 'Where water flows, life grows.' },
  'Prickling Clan': { color: '#5a8a3a', tagline: 'Sharp from sprout to sovereign.' },
  'Tropica Clan': { color: '#3aaa6a', tagline: 'Wild, warm, and watchful.' },
  'Tumbleweed Clan': { color: '#b89a5a', tagline: 'Drifts with purpose.' },
  'Wildfire Clan': { color: '#e86a2a', tagline: 'Burns brightest in danger.' },
};

export const CLANS: Clan[] = [...new Set(CARDS.map((c) => c.clan))].map((name) => ({
  name,
  color: CLAN_META[name]?.color ?? '#888',
  tagline: CLAN_META[name]?.tagline ?? '',
  formCount: CARDS.filter((c) => c.clan === name).length,
}));

export function clanByName(name: string): Clan | undefined {
  return CLANS.find((c) => c.name === name);
}
