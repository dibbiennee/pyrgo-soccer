import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@pyrgo/shared';
import { transitionTo, fadeIn } from '../utils/SceneTransition';
import { createButton } from '../ui/ButtonFactory';
import { setupResponsiveCamera } from '../utils/responsive';

declare const __APP_VERSION__: string;

export class CreditsScene extends Phaser.Scene {
  constructor() {
    super('Credits');
  }

  create(): void {
    setupResponsiveCamera(this);
    fadeIn(this);

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0d0d1a);

    this.add.text(GAME_WIDTH / 2, 80, 'PYRGO SOCCER', {
      fontSize: '40px', fontFamily: 'Arial Black, Arial', color: '#00ccff',
      stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 140, 'Made by Pyrgo Games', {
      fontSize: '18px', fontFamily: 'Arial', color: '#ffffff',
    }).setOrigin(0.5);

    const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '2.0';
    this.add.text(GAME_WIDTH / 2, 180, `Version ${version}`, {
      fontSize: '14px', fontFamily: 'Arial', color: '#888899',
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 230, 'Built with Phaser 3 + Socket.io', {
      fontSize: '12px', fontFamily: 'Arial', color: '#666677',
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 260, 'All sounds are procedurally generated', {
      fontSize: '12px', fontFamily: 'Arial', color: '#666677',
    }).setOrigin(0.5);

    createButton(this, GAME_WIDTH / 2, GAME_HEIGHT - 50, '\u2190 BACK', () => {
      transitionTo(this, 'MainMenu');
    }, { width: 120, height: 36 });
  }
}
