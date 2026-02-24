// ─── Appearance Types ─────────────────────────────────────────
export interface Appearance {
  faceShape: FaceShape;
  hairStyle: HairStyle;
  hairColor: number;
  skinTone: number;
  eyeStyle: EyeStyle;
  beard: BeardStyle;
  jerseyColor1: number;
  jerseyColor2: number;
  jerseyNumber: number;
}

// ─── Enums / Literal Unions ──────────────────────────────────
export type FaceShape = 'round' | 'square' | 'oval' | 'diamond' | 'triangle';
export type HairStyle = 'none' | 'short' | 'spiky' | 'mohawk' | 'long' | 'afro' | 'buzz' | 'side' | 'curly' | 'ponytail';
export type EyeStyle = 'normal' | 'angry' | 'happy' | 'cool' | 'sleepy';
export type BeardStyle = 'none' | 'stubble' | 'goatee' | 'full' | 'mustache';

export const FACE_SHAPES: FaceShape[] = ['round', 'square', 'oval', 'diamond', 'triangle'];
export const HAIR_STYLES: HairStyle[] = ['none', 'short', 'spiky', 'mohawk', 'long', 'afro', 'buzz', 'side', 'curly', 'ponytail'];
export const EYE_STYLES: EyeStyle[] = ['normal', 'angry', 'happy', 'cool', 'sleepy'];
export const BEARD_STYLES: BeardStyle[] = ['none', 'stubble', 'goatee', 'full', 'mustache'];

// ─── Color Palettes ──────────────────────────────────────────
export const SKIN_TONES: number[] = [
  0xffe0bd, // light
  0xf5c4a1, // fair
  0xe0a877, // medium
  0xc68642, // tan
  0x8d5524, // brown
  0x5c3317, // dark
];

export const HAIR_COLORS: number[] = [
  0x2c1b18, // black
  0x4a2912, // dark brown
  0x8b4513, // brown
  0xd4a540, // blonde
  0xc0392b, // red
  0xffffff, // white
  0x3498db, // blue
  0xe74c3c, // bright red
  0x9b59b6, // purple
  0x2ecc71, // green
];

export const JERSEY_COLORS: number[] = [
  0xff4422, 0x4466cc, 0x442266, 0x888888, 0x22aa44, 0x44bbdd,
  0xff8800, 0xffdd00, 0x000000, 0xffffff, 0x880044, 0x006644,
];

// ─── Default Appearance for Preset Characters ────────────────
export function defaultAppearanceForPreset(presetId: number): Appearance {
  const defaults: Record<number, Appearance> = {
    1: { // COTOLETTA
      faceShape: 'oval', hairStyle: 'short', hairColor: 0x4a2912,
      skinTone: 0xe0a877, eyeStyle: 'angry', beard: 'stubble',
      jerseyColor1: 0xcc2222, jerseyColor2: 0xffffff, jerseyNumber: 7,
    },
    2: { // ER MANCINO
      faceShape: 'square', hairStyle: 'short', hairColor: 0x1a1a1a,
      skinTone: 0xd4a574, eyeStyle: 'cool', beard: 'stubble',
      jerseyColor1: 0x1a5276, jerseyColor2: 0xffffff, jerseyNumber: 10,
    },
    3: { // GIORGITO
      faceShape: 'round', hairStyle: 'curly', hairColor: 0x2c1b18,
      skinTone: 0xf5c4a1, eyeStyle: 'happy', beard: 'goatee',
      jerseyColor1: 0x8b4513, jerseyColor2: 0xdaa520, jerseyNumber: 5,
    },
  };
  return defaults[presetId] ?? defaults[1];
}
