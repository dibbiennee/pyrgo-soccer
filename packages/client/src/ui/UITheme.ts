import Phaser from 'phaser';

// ─── Color Palette ─────────────────────────────────────
export const THEME = {
  // Backgrounds
  bgTop: 0x0f0f23,
  bgBottom: 0x1a1a3e,
  bgTopHex: '#0f0f23',

  // Primary (titles, active)
  primary: 0x00d4ff,
  primaryHex: '#00d4ff',

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
  textSecondary: '#8892b0',

  // Buttons
  buttonTop: 0x2a2a5a,
  buttonBottom: 0x1e1e4a,

  // Card / Panel
  cardBg: 0x1e1e4a,
  cardBorder: 0x2a2a6a,

  // HUD
  hudBg: 0x0a0a2a,

  // Stat bars
  statBarEmpty: 0x222244,
  statBarFillStart: 0x00d4ff,
  statBarFillEnd: 0x0088cc,

  // Particles
  particleCyan: 0x00d4ff,
  particleOrange: 0xff6b35,

  // Touch controls
  touchDpad: 0x3a3a6a,
  touchJump: 0x2255aa,
  touchKick: 0xaa2222,
  touchSuper: 0xaa6600,
  touchDpadPressed: 0x6666bb,
  touchJumpPressed: 0x4488dd,
  touchKickPressed: 0xdd4444,
  touchSuperPressed: 0xddaa00,

  // Shadow
  shadowColor: 0x050510,
  shadowAlpha: 0.4,
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
    fillTop: 0x0a4466,
    fillBottom: 0x062a44,
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
    fillTop: 0x0a5a2e,
    fillBottom: 0x063a1e,
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
    fillTop: 0x1a1a3a,
    fillBottom: 0x14142e,
    stroke: 0x444466,
    glowColor: 0x000000,
    textColor: '#8892b0',
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
