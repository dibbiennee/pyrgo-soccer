import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H } from '../utils/responsive';
import { transitionTo, fadeIn } from '../utils/SceneTransition';
import { createButton } from '../ui/ButtonFactory';

export class HowToPlayScene extends Phaser.Scene {
  constructor() {
    super('HowToPlay');
  }

  create(): void {
    fadeIn(this);
    const cx = CANVAS_W / 2;

    this.add.rectangle(cx, CANVAS_H / 2, CANVAS_W, CANVAS_H, 0x0d0d1a);

    this.add.text(cx, 30, 'HOW TO PLAY', {
      fontSize: '32px', fontFamily: 'Arial Black, Arial', color: '#00ccff',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5);

    const leftX = CANVAS_W / 4;
    const rightX = (CANVAS_W * 3) / 4;
    const sectionStyle = { fontSize: '20px', fontFamily: 'Arial Black, Arial', color: '#ff5500' };
    const bodyStyle = { fontSize: '16px', fontFamily: 'Arial', color: '#ccccdd', wordWrap: { width: 320 } };

    // ─── Controls ───────────────────────
    this.add.text(leftX, 100, 'CONTROLS', sectionStyle).setOrigin(0.5);

    // Touch controls
    this.add.text(leftX, 140, 'Touch / Mobile:', { fontSize: '16px', fontFamily: 'Arial', color: '#ffffff' }).setOrigin(0.5);
    this.add.text(leftX, 175, 'Left side: Move\nRight side: Jump', bodyStyle).setOrigin(0.5);

    // Draw touch areas
    const gfx = this.add.graphics();
    gfx.lineStyle(1, 0x00ccff, 0.4);
    gfx.strokeRect(leftX - 100, 210, 90, 45);
    gfx.strokeRect(leftX + 10, 210, 90, 45);
    this.add.text(leftX - 55, 232, 'MOVE', { fontSize: '14px', fontFamily: 'Arial', color: '#00ccff' }).setOrigin(0.5);
    this.add.text(leftX + 55, 232, 'JUMP', { fontSize: '14px', fontFamily: 'Arial', color: '#00ccff' }).setOrigin(0.5);

    // Keyboard controls
    this.add.text(leftX, 290, 'Keyboard:', { fontSize: '16px', fontFamily: 'Arial', color: '#ffffff' }).setOrigin(0.5);
    this.add.text(leftX, 345, 'Arrow keys: Move\nSpace: Jump\nZ: Kick\nX: Super move', bodyStyle).setOrigin(0.5);

    // ─── Super Moves ────────────────────
    this.add.text(rightX, 100, 'SUPER MOVES', sectionStyle).setOrigin(0.5);
    this.add.text(rightX, 160, 'Fill the super meter by kicking\nthe ball. When full, press the\nSuper button to unleash a\npowerful special move!', bodyStyle).setOrigin(0.5);

    // Draw super meter icon
    const meterGfx = this.add.graphics();
    meterGfx.fillStyle(0x333355, 1);
    meterGfx.fillRect(rightX - 60, 230, 120, 14);
    meterGfx.fillStyle(0xff5500, 1);
    meterGfx.fillRect(rightX - 60, 230, 90, 14);
    meterGfx.lineStyle(1, 0x666688, 1);
    meterGfx.strokeRect(rightX - 60, 230, 120, 14);
    this.add.text(rightX, 260, 'SUPER!', { fontSize: '14px', fontFamily: 'Arial', color: '#ff5500' }).setOrigin(0.5);

    // ─── Online ─────────────────────────
    this.add.text(rightX, 310, 'ONLINE PLAY', sectionStyle).setOrigin(0.5);
    this.add.text(rightX, 370, 'Create a room and share the\n4-letter code with a friend,\nor enter their code to join.\nBoth players ready up to start!', bodyStyle).setOrigin(0.5);

    // ─── Goal ───────────────────────────
    this.add.text(leftX, 440, 'OBJECTIVE', sectionStyle).setOrigin(0.5);
    this.add.text(leftX, 510, 'Score goals by kicking the ball\ninto the opponent\'s net.\nFirst to 5 goals or highest\nscore when time runs out wins!', bodyStyle).setOrigin(0.5);

    // Back button
    createButton(this, cx, CANVAS_H - 40, '\u2190 BACK', () => {
      transitionTo(this, 'MainMenu');
    }, { width: 160, height: 42 });
  }
}
