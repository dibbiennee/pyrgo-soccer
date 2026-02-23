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
  | 'iceField';

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
    name: 'BLAZE',
    stats: { speed: 8, power: 5, defense: 4 },
    superMove: 'flameDash',
    superDescription: 'Flame Dash — 2s dash at 2x speed, kick at 2x power, fire trail',
    color: 0xff4422,
    headColor: 0xff6644,
    accentColor: 0xff8800,
  },
  {
    id: 2,
    name: 'TITAN',
    stats: { speed: 4, power: 7, defense: 6 },
    superMove: 'thunderKick',
    superDescription: 'Thunder Kick — next kick at 3x power, ball ignores gravity for 0.5s',
    color: 0x4466cc,
    headColor: 0x5577dd,
    accentColor: 0xffee00,
  },
  {
    id: 3,
    name: 'SHADOW',
    stats: { speed: 9, power: 4, defense: 4 },
    superMove: 'ghostPhase',
    superDescription: 'Ghost Phase — 2s intangibility, pass through ball and opponent, then teleport kick',
    color: 0x442266,
    headColor: 0x553377,
    accentColor: 0xaa44ff,
  },
  {
    id: 4,
    name: 'GUARDIAN',
    stats: { speed: 3, power: 5, defense: 9 },
    superMove: 'ironWall',
    superDescription: 'Iron Wall — 3s energy wall in front of own goal, blocks everything',
    color: 0x888888,
    headColor: 0xaaaaaa,
    accentColor: 0x00ccff,
  },
  {
    id: 5,
    name: 'VIPER',
    stats: { speed: 7, power: 6, defense: 4 },
    superMove: 'poisonShot',
    superDescription: 'Poison Shot — ball turns green, next goal counts double',
    color: 0x22aa44,
    headColor: 0x33bb55,
    accentColor: 0x88ff00,
  },
  {
    id: 6,
    name: 'FROST',
    stats: { speed: 5, power: 6, defense: 6 },
    superMove: 'iceField',
    superDescription: 'Ice Field — 3s icy field, opponent slides with low friction',
    color: 0x44bbdd,
    headColor: 0x66ddff,
    accentColor: 0xffffff,
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
