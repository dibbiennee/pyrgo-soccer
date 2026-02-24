import Phaser from 'phaser';
import { LayoutManager } from '../utils/LayoutManager';
import { transitionTo, fadeIn } from '../utils/SceneTransition';
import { createButton } from '../ui/ButtonFactory';

export class HowToPlayScene extends Phaser.Scene {
  constructor() {
    super('HowToPlay');
  }

  create(): void {
    fadeIn(this);
    const L = new LayoutManager(this);

    this.add.rectangle(L.cx, L.cy, L.w, L.h, 0x0d0d1a);

    this.add.text(L.cx, L.y(0.06), 'HOW TO PLAY', {
      fontSize: L.fontSize('heading'), fontFamily: 'Arial Black, Arial', color: '#00ccff',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5);

    const leftX = L.x(0.25);
    const rightX = L.x(0.75);
    const sectionStyle = { fontSize: L.fontSize('body'), fontFamily: 'Arial Black, Arial', color: '#ff5500' };
    const bodyStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '20px', fontFamily: 'Arial', color: '#ccccdd',
      wordWrap: { width: L.w * 0.35 },
    };

    // ─── Controls ───────────────────────
    this.add.text(leftX, L.y(0.15), 'CONTROLS', sectionStyle).setOrigin(0.5);

    // Touch controls
    this.add.text(leftX, L.y(0.21), 'Touch / Mobile:', {
      fontSize: '20px', fontFamily: 'Arial', color: '#ffffff',
    }).setOrigin(0.5);
    this.add.text(leftX, L.y(0.26), 'Left side: Move\nRight side: Jump', bodyStyle).setOrigin(0.5);

    // Draw touch areas
    const boxW = L.unit(0.09);
    const boxH = L.unit(0.05);
    const boxGap = L.unit(0.012);
    const boxY = L.y(0.31);
    const gfx = this.add.graphics();
    gfx.lineStyle(1, 0x00ccff, 0.4);
    gfx.strokeRect(leftX - boxW - boxGap / 2, boxY, boxW, boxH);
    gfx.strokeRect(leftX + boxGap / 2, boxY, boxW, boxH);
    this.add.text(leftX - boxW / 2 - boxGap / 2, boxY + boxH / 2, 'MOVE', {
      fontSize: L.fontSize('tiny'), fontFamily: 'Arial', color: '#00ccff',
    }).setOrigin(0.5);
    this.add.text(leftX + boxW / 2 + boxGap / 2, boxY + boxH / 2, 'JUMP', {
      fontSize: L.fontSize('tiny'), fontFamily: 'Arial', color: '#00ccff',
    }).setOrigin(0.5);

    // Keyboard controls
    this.add.text(leftX, L.y(0.41), 'Keyboard:', {
      fontSize: '20px', fontFamily: 'Arial', color: '#ffffff',
    }).setOrigin(0.5);
    this.add.text(leftX, L.y(0.49), 'Arrow keys: Move\nSpace: Jump\nZ: Kick\nX: Super move', bodyStyle).setOrigin(0.5);

    // ─── Super Moves ────────────────────
    this.add.text(rightX, L.y(0.15), 'SUPER MOVES', sectionStyle).setOrigin(0.5);
    this.add.text(rightX, L.y(0.23), 'Fill the super meter by kicking\nthe ball. When full, press the\nSuper button to unleash a\npowerful special move!', bodyStyle).setOrigin(0.5);

    // Draw super meter icon
    const meterW = L.unit(0.12);
    const meterH = L.unit(0.018);
    const meterY = L.y(0.33);
    const meterGfx = this.add.graphics();
    meterGfx.fillStyle(0x333355, 1);
    meterGfx.fillRect(rightX - meterW / 2, meterY, meterW, meterH);
    meterGfx.fillStyle(0xff5500, 1);
    meterGfx.fillRect(rightX - meterW / 2, meterY, meterW * 0.75, meterH);
    meterGfx.lineStyle(1, 0x666688, 1);
    meterGfx.strokeRect(rightX - meterW / 2, meterY, meterW, meterH);
    this.add.text(rightX, meterY + meterH + L.pad(), 'SUPER!', {
      fontSize: L.fontSize('tiny'), fontFamily: 'Arial', color: '#ff5500',
    }).setOrigin(0.5);

    // ─── Online ─────────────────────────
    this.add.text(rightX, L.y(0.52), 'ONLINE PLAY', sectionStyle).setOrigin(0.5);
    this.add.text(rightX, L.y(0.60), 'Create a room and share the\n4-letter code with a friend,\nor enter their code to join.\nBoth players ready up to start!', bodyStyle).setOrigin(0.5);

    // ─── Goal ───────────────────────────
    this.add.text(leftX, L.y(0.58), 'OBJECTIVE', sectionStyle).setOrigin(0.5);
    this.add.text(leftX, L.y(0.66), 'Score goals by kicking the ball\ninto the opponent\'s net.\nFirst to 5 goals or highest\nscore when time runs out wins!', bodyStyle).setOrigin(0.5);

    // Back button
    const btn = L.button('small');
    createButton(this, L.cx, L.y(0.78), '\u2190 BACK', () => {
      transitionTo(this, 'MainMenu');
    }, { width: btn.width, height: btn.height });
  }
}
