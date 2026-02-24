import type { Appearance } from './appearance.js';
import { defaultAppearanceForPreset } from './appearance.js';

export interface CharacterStats {
  speed: number;   // 1-10
  power: number;   // 1-10
  defense: number; // 1-10
}

export type SuperMoveId =
  | 'flameDash'
  | 'thunderKick'
  | 'ghostPhase'
  | 'ironWall'
  | 'poisonShot'
  | 'iceField'
  | 'fireCapriole';

export interface SuperMoveInfo {
  id: SuperMoveId;
  displayName: string;
  description: string;
  color: number;
}

export const SUPER_MOVES: SuperMoveInfo[] = [
  { id: 'flameDash', displayName: 'Fireball', description: '2s dash at 2x speed & power, fire trail', color: 0xff4400 },
  { id: 'thunderKick', displayName: 'Thunder', description: 'Next kick at 3x power, ball ignores gravity', color: 0xffee00 },
  { id: 'ghostPhase', displayName: 'Teleport Kick', description: '2s intangibility, then teleport kick', color: 0xaa44ff },
  { id: 'ironWall', displayName: 'Shield Blast', description: '3s energy wall blocks everything', color: 0x00ccff },
  { id: 'poisonShot', displayName: 'Tornado', description: 'Ball turns green, next goal counts double', color: 0x88ff00 },
  { id: 'iceField', displayName: 'Meteor', description: '3s icy field, opponent slides', color: 0x88ddff },
  { id: 'fireCapriole', displayName: 'A Mi', description: 'Fire capriole — 3x kick toward goal, fire trail', color: 0xff4400 },
];

export interface CharacterDef {
  id: number;
  name: string;
  stats: CharacterStats;
  superMove: SuperMoveId;
  superDescription: string;
  color: number;      // Primary body color
  headColor: number;  // Head color
  accentColor: number; // Accent / effect color
  appearance?: Appearance;
}

export interface CustomCharacterDef extends CharacterDef {
  appearance: Appearance;
  creatorDeviceId: string;
  serverId?: string;     // assigned by server on publish
  isPublic: boolean;
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 1,
    name: 'COTOLETTA',
    stats: { speed: 7, power: 5, defense: 5 },
    superMove: 'flameDash',
    superDescription: 'Flame Dash — 2s dash at 2x speed, kick at 2x power, fire trail',
    color: 0xcc2222,
    headColor: 0xe0a877,
    accentColor: 0xff8800,
    appearance: {
      faceShape: 'oval', hairStyle: 'short', hairColor: 0x4a2912,
      skinTone: 0xe0a877, eyeStyle: 'angry', beard: 'stubble',
      jerseyColor1: 0xcc2222, jerseyColor2: 0xffffff, jerseyNumber: 7,
    },
  },
  {
    id: 2,
    name: 'ER MANCINO',
    stats: { speed: 6, power: 6, defense: 5 },
    superMove: 'fireCapriole',
    superDescription: 'A MI — fire capriole, 3x kick toward goal, fire trail',
    color: 0x1a5276,
    headColor: 0xd4a574,
    accentColor: 0xff4400,
    appearance: {
      faceShape: 'square', hairStyle: 'short', hairColor: 0x1a1a1a,
      skinTone: 0xd4a574, eyeStyle: 'cool', beard: 'stubble',
      jerseyColor1: 0x1a5276, jerseyColor2: 0xffffff, jerseyNumber: 10,
    },
  },
];

export function getCharacter(id: number): CharacterDef {
  const char = CHARACTERS.find(c => c.id === id);
  if (!char) throw new Error(`Character ${id} not found`);
  return char;
}

// ─── CharacterRef: unified preset / custom reference ─────────
export type CharacterRef =
  | { type: 'preset'; id: number }
  | { type: 'custom'; data: CustomCharacterDef };

export function resolveCharacter(ref: CharacterRef): CharacterDef {
  if (ref.type === 'preset') {
    return getCharacter(ref.id);
  }
  return ref.data;
}

export function resolveAppearance(ref: CharacterRef): Appearance {
  if (ref.type === 'preset') {
    const char = getCharacter(ref.id);
    return char.appearance ?? defaultAppearanceForPreset(ref.id);
  }
  return ref.data.appearance;
}
