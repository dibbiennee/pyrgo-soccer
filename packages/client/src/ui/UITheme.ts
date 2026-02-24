import Phaser from 'phaser';

// ─── Color Palette ─────────────────────────────────────
export const THEME = {
  // Backgrounds (stadium night — blue sky to green pitch)
  bgTop: 0x1a3d6e,
  bgBottom: 0x145a3c,
  bgTopHex: '#1a3d6e',

  // Primary (gold — trophies, accents)
  primary: 0xffd700,
  primaryHex: '#ffd700',

  // Secondary (accents, CTA)
  secondary: 0xff6b35,
  secondaryHex: '#ff6b35',

  // Success
  success: 0x00e676,
  successHex: '#00e676',

  // Danger
  danger: 0xff4444,
  dangerHex: '#ff4444',

  // Text
  textPrimary: '#ffffff',
  textSecondary: '#b0ccdd',

  // Buttons
  buttonTop: 0x2a5080,
  buttonBottom: 0x1e3a60,

  // Card / Panel
  cardBg: 0x1a3555,
  cardBorder: 0x2a6a8a,

  // HUD
  hudBg: 0x0e2a40,

  // Stat bars
  statBarEmpty: 0x1a3050,
  statBarFillStart: 0xffd700,
  statBarFillEnd: 0xcc9900,

  // Particles
  particleCyan: 0xffd700,
  particleOrange: 0xff6b35,

  // Touch controls
  touchDpad: 0x2a5070,
  touchJump: 0x2255aa,
  touchKick: 0xaa2222,
  touchSuper: 0xaa6600,
  touchDpadPressed: 0x4a80bb,
  touchJumpPressed: 0x4488dd,
  touchKickPressed: 0xdd4444,
  touchSuperPressed: 0xddaa00,

  // Shadow
  shadowColor: 0x050a15,
  shadowAlpha: 0.35,
};

// ─── Style presets for buttons ─────────────────────────
export interface ButtonStyleDef {
  fillTop: number;
  fillBottom: number;
  stroke: number;
  glowColor: number;
  textColor: string;
}

export const BUTTON_STYLES: Record<string, ButtonStyleDef> = {
  primary: {
    fillTop: 0x1a5a3a,
    fillBottom: 0x0e3a24,
    stroke: THEME.primary,
    glowColor: THEME.primary,
    textColor: '#ffffff',
  },
  secondary: {
    fillTop: THEME.buttonTop,
    fillBottom: THEME.buttonBottom,
    stroke: THEME.cardBorder,
    glowColor: 0x000000,
    textColor: '#ffffff',
  },
  success: {
    fillTop: 0x1a6a3e,
    fillBottom: 0x0e4a28,
    stroke: THEME.success,
    glowColor: THEME.success,
    textColor: '#ffffff',
  },
  danger: {
    fillTop: 0x6a1a1a,
    fillBottom: 0x4a1010,
    stroke: THEME.danger,
    glowColor: THEME.danger,
    textColor: '#ffffff',
  },
  ghost: {
    fillTop: 0x1a3050,
    fillBottom: 0x142540,
    stroke: 0x3a6080,
    glowColor: 0x000000,
    textColor: '#b0ccdd',
  },
};

// ─── Draw gradient background ──────────────────────────
export function drawGradientBackground(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  const { width, height } = scene.scale;
  const gfx = scene.add.graphics();
  gfx.fillGradientStyle(THEME.bgTop, THEME.bgTop, THEME.bgBottom, THEME.bgBottom);
  gfx.fillRect(0, 0, width, height);
  return gfx;
}

// ─── Draw rounded panel ────────────────────────────────
export interface PanelOptions {
  fillColor?: number;
  fillAlpha?: number;
  strokeColor?: number;
  strokeThickness?: number;
  radius?: number;
  shadow?: boolean;
  glow?: boolean;
  glowColor?: number;
  gradient?: boolean;
  gradientTop?: number;
  gradientBottom?: number;
}

export function drawRoundedPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  options?: PanelOptions,
): Phaser.GameObjects.Graphics {
  const fill = options?.fillColor ?? THEME.cardBg;
  const fillAlpha = options?.fillAlpha ?? 1;
  const stroke = options?.strokeColor ?? THEME.cardBorder;
  const strokeThickness = options?.strokeThickness ?? 2;
  const radius = options?.radius ?? 12;
  const shadow = options?.shadow ?? false;
  const glow = options?.glow ?? false;
  const glowColor = options?.glowColor ?? THEME.primary;

  const gfx = scene.add.graphics();

  // Shadow
  if (shadow) {
    gfx.fillStyle(THEME.shadowColor, THEME.shadowAlpha);
    gfx.fillRoundedRect(x - w / 2 + 2, y - h / 2 + 4, w, h, radius);
  }

  // Glow
  if (glow) {
    gfx.fillStyle(glowColor, 0.12);
    gfx.fillRoundedRect(x - w / 2 - 3, y - h / 2 - 3, w + 6, h + 6, radius + 2);
  }

  // Fill
  if (options?.gradient) {
    const top = options.gradientTop ?? THEME.buttonTop;
    const bot = options.gradientBottom ?? THEME.buttonBottom;
    gfx.fillGradientStyle(top, top, bot, bot, fillAlpha);
  } else {
    gfx.fillStyle(fill, fillAlpha);
  }
  gfx.fillRoundedRect(x - w / 2, y - h / 2, w, h, radius);

  // Stroke
  if (strokeThickness > 0) {
    gfx.lineStyle(strokeThickness, stroke, 1);
    gfx.strokeRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  }

  return gfx;
}
