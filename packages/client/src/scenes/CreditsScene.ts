import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H } from '../utils/responsive';
import { transitionTo, fadeIn } from '../utils/SceneTransition';
import { createButton } from '../ui/ButtonFactory';

declare const __APP_VERSION__: string;

export class CreditsScene extends Phaser.Scene {
  constructor() {
    super('Credits');
  }

  create(): void {
    fadeIn(this);
    const cx = CANVAS_W / 2;

    this.add.rectangle(cx, CANVAS_H / 2, CANVAS_W, CANVAS_H, 0x0d0d1a);

    this.add.text(cx, 160, 'PYRGO SOCCER', {
      fontSize: '40px', fontFamily: 'Arial Black, Arial', color: '#00ccff',
      stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5);

    this.add.text(cx, 240, 'Made by Pyrgo Games', {
      fontSize: '22px', fontFamily: 'Arial', color: '#ffffff',
    }).setOrigin(0.5);

    const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '2.0';
    this.add.text(cx, 300, `Version ${version}`, {
      fontSize: '16px', fontFamily: 'Arial', color: '#888899',
    }).setOrigin(0.5);

    this.add.text(cx, 370, 'Built with Phaser 3 + Socket.io', {
      fontSize: '16px', fontFamily: 'Arial', color: '#666677',
    }).setOrigin(0.5);

    this.add.text(cx, 410, 'All sounds are procedurally generated', {
      fontSize: '16px', fontFamily: 'Arial', color: '#666677',
    }).setOrigin(0.5);

    createButton(this, cx, CANVAS_H - 50, '\u2190 BACK', () => {
      transitionTo(this, 'MainMenu');
    }, { width: 160, height: 42 });
  }
}
