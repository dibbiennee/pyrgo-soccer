import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@pyrgo/shared';
import { transitionTo, fadeIn } from '../utils/SceneTransition';
import { createButton } from '../ui/ButtonFactory';
import { setupResponsiveCamera } from '../utils/responsive';

export class HowToPlayScene extends Phaser.Scene {
  constructor() {
    super('HowToPlay');
  }

  create(): void {
    setupResponsiveCamera(this);
    fadeIn(this);

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0d0d1a);

    this.add.text(GAME_WIDTH / 2, 30, 'HOW TO PLAY', {
      fontSize: '28px', fontFamily: 'Arial Black, Arial', color: '#00ccff',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5);

    const leftX = GAME_WIDTH / 4;
    const rightX = (GAME_WIDTH * 3) / 4;
    const sectionStyle = { fontSize: '16px', fontFamily: 'Arial Black, Arial', color: '#ff5500' };
    const bodyStyle = { fontSize: '12px', fontFamily: 'Arial', color: '#ccccdd', wordWrap: { width: 200 } };

    // ─── Controls ───────────────────────
    this.add.text(leftX, 70, 'CONTROLS', sectionStyle).setOrigin(0.5);

    // Touch controls
    this.add.text(leftX, 95, 'Touch / Mobile:', { fontSize: '13px', fontFamily: 'Arial', color: '#ffffff' }).setOrigin(0.5);
    this.add.text(leftX, 115, 'Left side: Move\nRight side: Jump', bodyStyle).setOrigin(0.5);

    // Draw touch areas
    const gfx = this.add.graphics();
    gfx.lineStyle(1, 0x00ccff, 0.4);
    gfx.strokeRect(leftX - 70, 140, 60, 35);
    gfx.strokeRect(leftX + 10, 140, 60, 35);
    this.add.text(leftX - 40, 157, 'MOVE', { fontSize: '10px', fontFamily: 'Arial', color: '#00ccff' }).setOrigin(0.5);
    this.add.text(leftX + 40, 157, 'JUMP', { fontSize: '10px', fontFamily: 'Arial', color: '#00ccff' }).setOrigin(0.5);

    // Keyboard controls
    this.add.text(leftX, 195, 'Keyboard:', { fontSize: '13px', fontFamily: 'Arial', color: '#ffffff' }).setOrigin(0.5);
    this.add.text(leftX, 225, 'Arrow keys: Move\nSpace: Jump\nZ: Kick\nX: Super move', bodyStyle).setOrigin(0.5);

    // ─── Super Moves ────────────────────
    this.add.text(rightX, 70, 'SUPER MOVES', sectionStyle).setOrigin(0.5);
    this.add.text(rightX, 110, 'Fill the super meter by kicking\nthe ball. When full, press the\nSuper button to unleash a\npowerful special move!', bodyStyle).setOrigin(0.5);

    // Draw super meter icon
    const meterGfx = this.add.graphics();
    meterGfx.fillStyle(0x333355, 1);
    meterGfx.fillRect(rightX - 40, 155, 80, 10);
    meterGfx.fillStyle(0xff5500, 1);
    meterGfx.fillRect(rightX - 40, 155, 60, 10);
    meterGfx.lineStyle(1, 0x666688, 1);
    meterGfx.strokeRect(rightX - 40, 155, 80, 10);
    this.add.text(rightX, 180, 'SUPER!', { fontSize: '11px', fontFamily: 'Arial', color: '#ff5500' }).setOrigin(0.5);

    // ─── Online ─────────────────────────
    this.add.text(rightX, 210, 'ONLINE PLAY', sectionStyle).setOrigin(0.5);
    this.add.text(rightX, 250, 'Create a room and share the\n4-letter code with a friend,\nor enter their code to join.\nBoth players ready up to start!', bodyStyle).setOrigin(0.5);

    // ─── Goal ───────────────────────────
    this.add.text(leftX, 290, 'OBJECTIVE', sectionStyle).setOrigin(0.5);
    this.add.text(leftX, 330, 'Score goals by kicking the ball\ninto the opponent\'s net.\nFirst to 5 goals or highest\nscore when time runs out wins!', bodyStyle).setOrigin(0.5);

    // Back button
    createButton(this, GAME_WIDTH / 2, GAME_HEIGHT - 35, '\u2190 BACK', () => {
      transitionTo(this, 'MainMenu');
    }, { width: 120, height: 36 });
  }
}
