import Phaser from 'phaser';
import { LayoutManager } from '../utils/LayoutManager';
import { transitionTo, fadeIn } from '../utils/SceneTransition';
import { createButton } from '../ui/ButtonFactory';
import { THEME, drawGradientBackground } from '../ui/UITheme';

declare const __APP_VERSION__: string;

export class CreditsScene extends Phaser.Scene {
  constructor() {
    super('Credits');
  }

  create(): void {
    fadeIn(this);
    const L = new LayoutManager(this);

    drawGradientBackground(this);

    this.add.text(L.cx, L.y(0.22), 'PYRGO SOCCER', {
      fontSize: L.fontSize('title'), fontFamily: 'Arial Black, Arial', color: THEME.primaryHex,
      stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5);

    this.add.text(L.cx, L.y(0.34), 'Made by Pyrgo Games', {
      fontSize: L.fontSize('body'), fontFamily: 'Arial', color: '#ffffff',
    }).setOrigin(0.5);

    const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '2.0';
    this.add.text(L.cx, L.y(0.44), `Version ${version}`, {
      fontSize: L.fontSize('small'), fontFamily: 'Arial', color: THEME.textSecondary,
    }).setOrigin(0.5);

    this.add.text(L.cx, L.y(0.54), 'Built with Phaser 3 + Socket.io', {
      fontSize: L.fontSize('small'), fontFamily: 'Arial', color: THEME.textSecondary,
    }).setOrigin(0.5);

    this.add.text(L.cx, L.y(0.60), 'All sounds are procedurally generated', {
      fontSize: L.fontSize('small'), fontFamily: 'Arial', color: THEME.textSecondary,
    }).setOrigin(0.5);

    const btn = L.button('small');
    createButton(this, L.cx, L.y(0.78), '\u2190 BACK', () => {
      transitionTo(this, 'MainMenu');
    }, { width: btn.width, height: btn.height, style: 'ghost' });
  }
}
