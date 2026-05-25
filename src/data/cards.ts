import cardsJson from './cards.json';

export interface Card {
  clan: string;
  form: number; // 1..8
  name: string;
  description: string;
  strengths: string[];
  weaknesses: string[];
  attack: number | string;
  defence: number | string;
  speed: number | string;
  health: number | string;
  overallScore: number | string;
}

export const CARDS: Card[] = cardsJson as Card[];

export function cardsForClan(clan: string): Card[] {
  return CARDS.filter((c) => c.clan === clan).sort((a, b) => a.form - b.form);
}

export function cardFor(clan: string, form: number): Card | undefined {
  return CARDS.find((c) => c.clan === clan && c.form === form);
}
