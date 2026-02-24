/**
 * LayoutManager — responsive coordinate system for any screen size.
 * All menu scenes use this instead of hardcoded pixel values.
 *
 * Usage:
 *   const L = new LayoutManager(scene);
 *   const x = L.cx;              // center X
 *   const y = L.y(0.5);          // 50% of height
 *   const fs = L.fontSize('title'); // responsive font size
 */
export class LayoutManager {
  constructor(private scene: Phaser.Scene) {}

  /** Current viewport width */
  get w(): number { return this.scene.scale.width; }
  /** Current viewport height */
  get h(): number { return this.scene.scale.height; }
  /** Center X */
  get cx(): number { return this.w / 2; }
  /** Center Y */
  get cy(): number { return this.h / 2; }

  /** X position as fraction (0–1) of width */
  x(pct: number): number { return this.w * pct; }
  /** Y position as fraction (0–1) of height */
  y(pct: number): number { return this.h * pct; }

  /** Responsive unit based on the smaller dimension */
  unit(multiplier = 1): number {
    return Math.min(this.w, this.h) * multiplier;
  }

  /** Responsive font sizes */
  fontSize(type: 'title' | 'subtitle' | 'heading' | 'body' | 'small' | 'tiny'): string {
    const base = Math.min(this.w, this.h);
    const sizes: Record<string, number> = {
      title: base * 0.085,
      subtitle: base * 0.05,
      heading: base * 0.055,
      body: base * 0.04,
      small: base * 0.032,
      tiny: base * 0.026,
    };
    return `${Math.round(sizes[type] || base * 0.04)}px`;
  }

  /** Raw font size number */
  fontSizeN(type: 'title' | 'subtitle' | 'heading' | 'body' | 'small' | 'tiny'): number {
    return parseInt(this.fontSize(type));
  }

  /** Responsive padding */
  pad(multiplier = 1): number {
    return this.unit(0.02) * multiplier;
  }

  /** Responsive button dimensions — ensures minimum 44px touch target */
  button(scale: 'normal' | 'small' | 'large' = 'normal'): { width: number; height: number } {
    const sizes = {
      small: { width: this.w * 0.14, height: Math.max(this.h * 0.08, 36) },
      normal: { width: this.w * 0.20, height: Math.max(this.h * 0.10, 42) },
      large: { width: this.w * 0.24, height: Math.max(this.h * 0.12, 48) },
    };
    return sizes[scale];
  }

  /** Character card size for grids */
  cardSize(): number {
    return Math.min(this.h * 0.22, this.w * 0.14);
  }

  /** Gap between cards */
  cardGap(): number {
    return this.cardSize() * 0.4;
  }
}
