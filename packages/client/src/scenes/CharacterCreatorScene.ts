import Phaser from 'phaser';
import {
  FACE_SHAPES, HAIR_STYLES, EYE_STYLES, BEARD_STYLES,
  SKIN_TONES, HAIR_COLORS, JERSEY_COLORS,
  SUPER_MOVES,
} from '@pyrgo/shared';
import type {
  Appearance, FaceShape, HairStyle, EyeStyle, BeardStyle,
  SuperMoveId, CustomCharacterDef,
} from '@pyrgo/shared';
import { CharacterRenderer } from '../rendering/CharacterRenderer';
import { CharacterStorage } from '../storage/CharacterStorage';
import { CharacterApi } from '../api/CharacterApi';
import { getDeviceId } from '../storage/DeviceId';
import { transitionTo, fadeIn } from '../utils/SceneTransition';
import { createButton } from '../ui/ButtonFactory';
import { showToast } from '../ui/ToastNotification';
import { SoundManager } from '../audio/SoundManager';
import { LayoutManager } from '../utils/LayoutManager';
import { THEME, drawGradientBackground } from '../ui/UITheme';

// ─── Constants ─────────────────────────────────────────
const TOTAL_STAT_POINTS = 15;
const MIN_STAT = 2;
const MAX_STAT = 8;

const TABS = ['LOOK', 'JERSEY', 'STATS', 'SUPER', 'NAME'] as const;
type TabName = typeof TABS[number];

interface TabEntry {
  gfx: Phaser.GameObjects.Graphics;
  hitArea: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  x: number;
  y: number;
  w: number;
  h: number;
}

export class CharacterCreatorScene extends Phaser.Scene {
  private L!: LayoutManager;

  private appearance!: Appearance;
  private charName = 'PLAYER';
  private stats = { speed: 5, power: 5, defense: 5 };
  private superMove: SuperMoveId = 'flameDash';
  private isPublic = false;

  private editIndex: number | null = null;
  private returnTo = 'CharSelect';

  private previewContainer!: Phaser.GameObjects.Container;
  private panelContainer!: Phaser.GameObjects.Container;
  private activeTab: TabName = 'LOOK';
  private tabButtons: Map<TabName, TabEntry> = new Map();

  constructor() {
    super('CharacterCreator');
  }

  init(data: { editIndex?: number; returnTo?: string }): void {
    this.editIndex = data.editIndex ?? null;
    this.returnTo = data.returnTo ?? 'CharSelect';

    if (this.editIndex !== null) {
      const existing = CharacterStorage.get(this.editIndex);
      if (existing) {
        this.appearance = { ...existing.appearance };
        this.charName = existing.name;
        this.stats = { ...existing.stats };
        this.superMove = existing.superMove;
        this.isPublic = existing.isPublic;
        return;
      }
    }

    this.appearance = {
      faceShape: 'round',
      hairStyle: 'short',
      hairColor: HAIR_COLORS[0],
      skinTone: SKIN_TONES[0],
      eyeStyle: 'normal',
      beard: 'none',
      jerseyColor1: JERSEY_COLORS[0],
      jerseyColor2: JERSEY_COLORS[1],
      jerseyNumber: 10,
    };
    this.charName = 'PLAYER';
    this.stats = { speed: 5, power: 5, defense: 5 };
    this.superMove = 'flameDash';
    this.isPublic = false;
  }

  create(): void {
    fadeIn(this);
    this.L = new LayoutManager(this);
    const L = this.L;

    // Background
    drawGradientBackground(this);

    // ── Live Preview (left) ────────────────────────
    const previewBoxW = L.w * 0.18;
    const previewBoxH = L.h * 0.55;
    const previewGfx = this.add.graphics();
    const pbx = L.x(0.13);
    const pby = L.y(0.45);
    previewGfx.fillStyle(THEME.cardBg, 1);
    previewGfx.fillRoundedRect(pbx - previewBoxW / 2, pby - previewBoxH / 2, previewBoxW, previewBoxH, 12);
    previewGfx.lineStyle(2, THEME.cardBorder, 1);
    previewGfx.strokeRoundedRect(pbx - previewBoxW / 2, pby - previewBoxH / 2, previewBoxW, previewBoxH, 12);

    this.previewContainer = this.add.container(L.x(0.13), L.y(0.42));
    this.refreshPreview();

    // ── Tab bar ────────────────────────────────────
    this.createTabs();

    // ── Panel area (right) ─────────────────────────
    this.panelContainer = this.add.container(0, 0);
    this.showTab('LOOK');

    // ── Bottom buttons ─────────────────────────────
    this.createBottomButtons();
  }

  // ════════════════════════════════════════════════════
  // PREVIEW
  // ════════════════════════════════════════════════════
  private refreshPreview(): void {
    const L = this.L;
    this.previewContainer.removeAll(true);
    const previewScale = L.unit(0.004);
    const parts = CharacterRenderer.renderCharacter(this, this.appearance, { scale: previewScale, facingRight: true });
    for (const part of parts) {
      this.previewContainer.add(part);
    }
    const nameLabel = this.add.text(0, L.h * 0.12, this.charName, {
      fontSize: L.fontSize('small'), fontFamily: 'Arial Black, Arial', color: '#ffffff',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5);
    this.previewContainer.add(nameLabel);
  }

  // ════════════════════════════════════════════════════
  // TABS
  // ════════════════════════════════════════════════════
  private createTabs(): void {
    const L = this.L;
    const tabW = L.w * 0.09;
    const tabH = 28;
    const gap = L.unit(0.015);
    const startX = L.x(0.27);
    const y = L.y(0.06);
    const radius = 8;

    TABS.forEach((tab, i) => {
      const x = startX + i * (tabW + gap);
      const gfx = this.add.graphics();

      const hitArea = this.add.rectangle(x, y, tabW, tabH, 0x000000, 0);
      hitArea.setInteractive({ useHandCursor: true });

      const label = this.add.text(x, y, tab, {
        fontSize: L.fontSize('tiny'), fontFamily: 'Arial', color: THEME.textSecondary,
      }).setOrigin(0.5);

      hitArea.on('pointerdown', () => this.showTab(tab));
      hitArea.on('pointerover', () => {
        if (this.activeTab !== tab) {
          gfx.clear();
          gfx.fillStyle(0x2a2a6a, 1);
          gfx.fillRoundedRect(x - tabW / 2, y - tabH / 2, tabW, tabH, radius);
          gfx.lineStyle(1, THEME.cardBorder, 1);
          gfx.strokeRoundedRect(x - tabW / 2, y - tabH / 2, tabW, tabH, radius);
        }
      });
      hitArea.on('pointerout', () => {
        if (this.activeTab !== tab) {
          this.drawTabInactive(gfx, x, y, tabW, tabH, radius);
        }
      });

      this.tabButtons.set(tab, { gfx, hitArea, label, x, y, w: tabW, h: tabH });
    });
  }

  private drawTabActive(gfx: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, radius: number): void {
    gfx.clear();
    gfx.fillStyle(THEME.primary, 1);
    gfx.fillRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  }

  private drawTabInactive(gfx: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, radius: number): void {
    gfx.clear();
    gfx.fillStyle(THEME.cardBg, 1);
    gfx.fillRoundedRect(x - w / 2, y - h / 2, w, h, radius);
    gfx.lineStyle(1, THEME.cardBorder, 1);
    gfx.strokeRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  }

  private showTab(tab: TabName): void {
    this.activeTab = tab;
    const radius = 8;

    if (this.input.keyboard) {
      this.input.keyboard.removeAllListeners('keydown');
    }

    this.tabButtons.forEach((btn, key) => {
      if (key === tab) {
        this.drawTabActive(btn.gfx, btn.x, btn.y, btn.w, btn.h, radius);
        btn.label.setColor('#000000');
      } else {
        this.drawTabInactive(btn.gfx, btn.x, btn.y, btn.w, btn.h, radius);
        btn.label.setColor(THEME.textSecondary);
      }
    });

    this.panelContainer.removeAll(true);

    switch (tab) {
      case 'LOOK': this.buildLookPanel(); break;
      case 'JERSEY': this.buildJerseyPanel(); break;
      case 'STATS': this.buildStatsPanel(); break;
      case 'SUPER': this.buildSuperPanel(); break;
      case 'NAME': this.buildNamePanel(); break;
    }
  }

  // ════════════════════════════════════════════════════
  // LOOK PANEL
  // ════════════════════════════════════════════════════
  private buildLookPanel(): void {
    const L = this.L;
    const px = L.x(0.55);
    let y = L.y(0.16);
    const sectionGap = L.h * 0.065;
    const labelToControl = L.h * 0.035;
    const colorLabelToControl = L.h * 0.04;

    this.addSectionLabel(px, y, 'FACE');
    y += labelToControl;
    this.addCycler(px, y, FACE_SHAPES as unknown as string[], this.appearance.faceShape, (val) => {
      this.appearance.faceShape = val as FaceShape;
      this.refreshPreview();
    });

    y += sectionGap;
    this.addSectionLabel(px, y, 'HAIR STYLE');
    y += labelToControl;
    this.addCycler(px, y, HAIR_STYLES as unknown as string[], this.appearance.hairStyle, (val) => {
      this.appearance.hairStyle = val as HairStyle;
      this.refreshPreview();
    });

    y += sectionGap;
    this.addSectionLabel(px, y, 'HAIR COLOR');
    y += colorLabelToControl;
    this.addColorPicker(px, y, HAIR_COLORS, this.appearance.hairColor, (color) => {
      this.appearance.hairColor = color;
      this.refreshPreview();
    });

    y += sectionGap;
    this.addSectionLabel(px, y, 'SKIN');
    y += colorLabelToControl;
    this.addColorPicker(px, y, SKIN_TONES, this.appearance.skinTone, (color) => {
      this.appearance.skinTone = color;
      this.refreshPreview();
    });

    y += sectionGap;
    this.addSectionLabel(px, y, 'EYES');
    y += labelToControl;
    this.addCycler(px, y, EYE_STYLES as unknown as string[], this.appearance.eyeStyle, (val) => {
      this.appearance.eyeStyle = val as EyeStyle;
      this.refreshPreview();
    });

    y += sectionGap;
    this.addSectionLabel(px, y, 'BEARD');
    y += labelToControl;
    this.addCycler(px, y, BEARD_STYLES as unknown as string[], this.appearance.beard, (val) => {
      this.appearance.beard = val as BeardStyle;
      this.refreshPreview();
    });
  }

  // ════════════════════════════════════════════════════
  // JERSEY PANEL
  // ════════════════════════════════════════════════════
  private buildJerseyPanel(): void {
    const L = this.L;
    const px = L.x(0.55);
    let y = L.y(0.18);
    const sectionGap = L.h * 0.08;
    const labelToControl = L.h * 0.04;

    this.addSectionLabel(px, y, 'PRIMARY COLOR');
    y += labelToControl;
    this.addColorPicker(px, y, JERSEY_COLORS, this.appearance.jerseyColor1, (color) => {
      this.appearance.jerseyColor1 = color;
      this.refreshPreview();
    });

    y += sectionGap;
    this.addSectionLabel(px, y, 'ACCENT COLOR');
    y += labelToControl;
    this.addColorPicker(px, y, JERSEY_COLORS, this.appearance.jerseyColor2, (color) => {
      this.appearance.jerseyColor2 = color;
      this.refreshPreview();
    });

    y += sectionGap;
    this.addSectionLabel(px, y, 'JERSEY NUMBER');
    y += labelToControl;
    this.addNumberSelector(px, y, this.appearance.jerseyNumber, 1, 99, (val) => {
      this.appearance.jerseyNumber = val;
      this.refreshPreview();
    });
  }

  // ════════════════════════════════════════════════════
  // STATS PANEL
  // ════════════════════════════════════════════════════
  private buildStatsPanel(): void {
    const L = this.L;
    const px = L.x(0.55);
    let y = L.y(0.16);

    const remaining = TOTAL_STAT_POINTS - this.stats.speed - this.stats.power - this.stats.defense;
    const remainLabel = this.add.text(px, y, `Points remaining: ${remaining}`, {
      fontSize: L.fontSize('small'), fontFamily: 'Arial', color: THEME.secondaryHex,
    }).setOrigin(0.5);
    this.panelContainer.add(remainLabel);

    y += L.h * 0.06;
    const statDefs: { key: 'speed' | 'power' | 'defense'; label: string; desc: string }[] = [
      { key: 'speed', label: 'SPEED', desc: 'Movement + jump speed' },
      { key: 'power', label: 'POWER', desc: 'Kick force + header' },
      { key: 'defense', label: 'DEFENSE', desc: 'Ball slow on contact' },
    ];

    for (const def of statDefs) {
      this.addSectionLabel(px, y, def.label);
      y += L.h * 0.008;
      const descText = this.add.text(px, y + L.h * 0.02, def.desc, {
        fontSize: L.fontSize('tiny'), fontFamily: 'Arial', color: THEME.textSecondary,
      }).setOrigin(0.5);
      this.panelContainer.add(descText);

      y += L.h * 0.048;
      this.addStatSlider(px, y, def.key, remainLabel);
      y += L.h * 0.08;
    }
  }

  private addStatSlider(cx: number, cy: number, key: 'speed' | 'power' | 'defense', remainLabel: Phaser.GameObjects.Text): void {
    const L = this.L;
    const value = this.stats[key];
    const barW = L.w * 0.25;
    const barH = L.h * 0.03;
    const radius = 4;

    // Background bar (rounded rect)
    const barBgGfx = this.add.graphics();
    barBgGfx.fillStyle(THEME.statBarEmpty, 1);
    barBgGfx.fillRoundedRect(cx - barW / 2, cy - barH / 2, barW, barH, radius);
    barBgGfx.lineStyle(1, THEME.cardBorder, 1);
    barBgGfx.strokeRoundedRect(cx - barW / 2, cy - barH / 2, barW, barH, radius);
    this.panelContainer.add(barBgGfx);

    // Fill bar (gradient rounded rect)
    const fillW = ((value - MIN_STAT) / (MAX_STAT - MIN_STAT)) * barW;
    if (fillW > 0) {
      const fillGfx = this.add.graphics();
      fillGfx.fillGradientStyle(THEME.statBarFillStart, THEME.statBarFillStart, THEME.statBarFillEnd, THEME.statBarFillEnd);
      fillGfx.fillRoundedRect(cx - barW / 2, cy - barH / 2 + 1, fillW, barH - 2, 3);
      this.panelContainer.add(fillGfx);
    }

    const valText = this.add.text(cx, cy, String(value), {
      fontSize: L.fontSize('tiny'), fontFamily: 'Arial Black, Arial', color: '#ffffff',
    }).setOrigin(0.5);
    this.panelContainer.add(valText);

    const btnOffset = barW / 2 + L.unit(0.05);

    const minusBtn = this.createSmallButton(cx - btnOffset, cy, '-', () => {
      if (this.stats[key] > MIN_STAT) {
        this.stats[key]--;
        this.showTab('STATS');
      }
    });
    this.panelContainer.add(minusBtn);

    const plusBtn = this.createSmallButton(cx + btnOffset, cy, '+', () => {
      const remaining = TOTAL_STAT_POINTS - this.stats.speed - this.stats.power - this.stats.defense;
      if (this.stats[key] < MAX_STAT && remaining > 0) {
        this.stats[key]++;
        this.showTab('STATS');
      }
    });
    this.panelContainer.add(plusBtn);
  }

  // ════════════════════════════════════════════════════
  // SUPER PANEL
  // ════════════════════════════════════════════════════
  private buildSuperPanel(): void {
    const L = this.L;
    const cardW = L.w * 0.17;
    const cardH = L.h * 0.12;
    const gap = L.pad(0.5);
    const panelCx = L.x(0.55);
    const startX = panelCx - (cardW + gap) / 2;
    const startY = L.y(0.16);
    const radius = 10;

    SUPER_MOVES.forEach((move, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = startX + col * (cardW + gap);
      const y = startY + row * (cardH + gap);

      const isSelected = this.superMove === move.id;

      const gfx = this.add.graphics();
      if (isSelected) {
        gfx.fillStyle(move.color, 0.1);
        gfx.fillRoundedRect(x - cardW / 2 - 2, y - cardH / 2 - 2, cardW + 4, cardH + 4, radius + 1);
      }
      gfx.fillStyle(isSelected ? 0x1a3a5e : THEME.cardBg, 1);
      gfx.fillRoundedRect(x - cardW / 2, y - cardH / 2, cardW, cardH, radius);
      gfx.lineStyle(2, isSelected ? move.color : THEME.cardBorder, 1);
      gfx.strokeRoundedRect(x - cardW / 2, y - cardH / 2, cardW, cardH, radius);
      this.panelContainer.add(gfx);

      // Invisible hit area
      const hitArea = this.add.rectangle(x, y, cardW, cardH, 0x000000, 0);
      hitArea.setInteractive({ useHandCursor: true });
      this.panelContainer.add(hitArea);

      const dotR = L.unit(0.012);
      const dot = this.add.arc(x - cardW / 2 + L.pad(1), y - cardH * 0.15, dotR, 0, 360, false, move.color);
      this.panelContainer.add(dot);

      const nameText = this.add.text(x - cardW / 2 + L.pad(1.5) + dotR, y - cardH * 0.3, move.displayName, {
        fontSize: '15px', fontFamily: 'Arial Black, Arial', color: isSelected ? '#ffffff' : THEME.textSecondary,
      });
      this.panelContainer.add(nameText);

      const descText = this.add.text(x - cardW / 2 + L.pad(0.8), y + cardH * 0.05, move.description, {
        fontSize: '13px', fontFamily: 'Arial', color: THEME.textSecondary,
        wordWrap: { width: cardW - L.pad(1.5) },
      });
      this.panelContainer.add(descText);

      if (isSelected) {
        const check = this.add.text(x + cardW / 2 - L.pad(1), y - cardH * 0.28, '\u2713', {
          fontSize: L.fontSize('body'), fontFamily: 'Arial', color: THEME.successHex,
        }).setOrigin(0.5);
        this.panelContainer.add(check);
      }

      hitArea.on('pointerdown', () => {
        this.superMove = move.id;
        this.showTab('SUPER');
      });
      hitArea.on('pointerover', () => {
        if (!isSelected) {
          gfx.clear();
          gfx.fillStyle(0x2a2a5e, 1);
          gfx.fillRoundedRect(x - cardW / 2, y - cardH / 2, cardW, cardH, radius);
          gfx.lineStyle(2, THEME.cardBorder, 1);
          gfx.strokeRoundedRect(x - cardW / 2, y - cardH / 2, cardW, cardH, radius);
        }
      });
      hitArea.on('pointerout', () => {
        if (!isSelected) {
          gfx.clear();
          gfx.fillStyle(THEME.cardBg, 1);
          gfx.fillRoundedRect(x - cardW / 2, y - cardH / 2, cardW, cardH, radius);
          gfx.lineStyle(2, THEME.cardBorder, 1);
          gfx.strokeRoundedRect(x - cardW / 2, y - cardH / 2, cardW, cardH, radius);
        }
      });
    });
  }

  // ════════════════════════════════════════════════════
  // NAME PANEL
  // ════════════════════════════════════════════════════
  private buildNamePanel(): void {
    const L = this.L;
    const px = L.x(0.55);
    let y = L.y(0.16);

    this.addSectionLabel(px, y, 'CHARACTER NAME');
    y += L.h * 0.04;

    const nameBoxW = L.w * 0.22;
    const nameBoxH = L.h * 0.05;
    const nameGfx = this.add.graphics();
    nameGfx.fillStyle(0x111122, 1);
    nameGfx.fillRoundedRect(px - nameBoxW / 2, y - nameBoxH / 2, nameBoxW, nameBoxH, 8);
    nameGfx.lineStyle(2, THEME.cardBorder, 1);
    nameGfx.strokeRoundedRect(px - nameBoxW / 2, y - nameBoxH / 2, nameBoxW, nameBoxH, 8);
    this.panelContainer.add(nameGfx);

    const nameText = this.add.text(px, y, this.charName, {
      fontSize: L.fontSize('body'), fontFamily: 'Arial Black, Arial', color: '#ffffff',
    }).setOrigin(0.5);
    this.panelContainer.add(nameText);

    // Virtual keyboard (rounded keys)
    y += L.h * 0.055;
    const keys = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const keysPerRow = 10;
    const keySize = L.unit(0.07);
    const keyGap = L.unit(0.008);
    const totalRowW = keysPerRow * (keySize + keyGap) - keyGap;
    const kbStartX = px - totalRowW / 2 + keySize / 2;
    const keyRadius = 6;

    for (let i = 0; i < keys.length; i++) {
      const row = Math.floor(i / keysPerRow);
      const col = i % keysPerRow;
      const kx = kbStartX + col * (keySize + keyGap);
      const ky = y + row * (keySize + keyGap);
      const char = keys[i];

      const keyGfx = this.add.graphics();
      keyGfx.fillStyle(THEME.cardBg, 1);
      keyGfx.fillRoundedRect(kx - keySize / 2, ky - keySize / 2, keySize, keySize, keyRadius);
      keyGfx.lineStyle(1, THEME.cardBorder, 1);
      keyGfx.strokeRoundedRect(kx - keySize / 2, ky - keySize / 2, keySize, keySize, keyRadius);
      this.panelContainer.add(keyGfx);

      const keyLabel = this.add.text(kx, ky, char, {
        fontSize: L.fontSize('tiny'), fontFamily: 'Arial', color: '#ffffff',
      }).setOrigin(0.5);
      this.panelContainer.add(keyLabel);

      const keyHit = this.add.rectangle(kx, ky, keySize, keySize, 0x000000, 0);
      keyHit.setInteractive({ useHandCursor: true });
      this.panelContainer.add(keyHit);

      keyHit.on('pointerdown', () => {
        if (this.charName.length < 10) {
          this.charName += char;
          nameText.setText(this.charName);
          this.refreshPreview();
        }
      });
      keyHit.on('pointerover', () => {
        keyGfx.clear();
        keyGfx.fillStyle(0x2a2a6a, 1);
        keyGfx.fillRoundedRect(kx - keySize / 2, ky - keySize / 2, keySize, keySize, keyRadius);
        keyGfx.lineStyle(1, THEME.cardBorder, 1);
        keyGfx.strokeRoundedRect(kx - keySize / 2, ky - keySize / 2, keySize, keySize, keyRadius);
      });
      keyHit.on('pointerout', () => {
        keyGfx.clear();
        keyGfx.fillStyle(THEME.cardBg, 1);
        keyGfx.fillRoundedRect(kx - keySize / 2, ky - keySize / 2, keySize, keySize, keyRadius);
        keyGfx.lineStyle(1, THEME.cardBorder, 1);
        keyGfx.strokeRoundedRect(kx - keySize / 2, ky - keySize / 2, keySize, keySize, keyRadius);
      });
    }

    // DEL button
    const delY = y + Math.ceil(keys.length / keysPerRow) * (keySize + keyGap);
    const actionBtnW = L.w * 0.06;
    const actionBtnH = L.h * 0.045;
    const actionRadius = 6;

    const delGfx = this.add.graphics();
    const delX = px - L.w * 0.055;
    delGfx.fillStyle(0x664444, 1);
    delGfx.fillRoundedRect(delX - actionBtnW / 2, delY - actionBtnH / 2, actionBtnW, actionBtnH, actionRadius);
    delGfx.lineStyle(1, 0x884444, 1);
    delGfx.strokeRoundedRect(delX - actionBtnW / 2, delY - actionBtnH / 2, actionBtnW, actionBtnH, actionRadius);
    this.panelContainer.add(delGfx);
    const delLabel = this.add.text(delX, delY, 'DEL', {
      fontSize: L.fontSize('tiny'), fontFamily: 'Arial', color: '#ffffff',
    }).setOrigin(0.5);
    this.panelContainer.add(delLabel);
    const delHit = this.add.rectangle(delX, delY, actionBtnW, actionBtnH, 0x000000, 0);
    delHit.setInteractive({ useHandCursor: true });
    this.panelContainer.add(delHit);
    delHit.on('pointerdown', () => {
      if (this.charName.length > 0) {
        this.charName = this.charName.slice(0, -1);
        nameText.setText(this.charName || '');
        this.refreshPreview();
      }
    });

    // CLR button
    const clrGfx = this.add.graphics();
    const clrX = px + L.w * 0.055;
    clrGfx.fillStyle(0x664444, 1);
    clrGfx.fillRoundedRect(clrX - actionBtnW / 2, delY - actionBtnH / 2, actionBtnW, actionBtnH, actionRadius);
    clrGfx.lineStyle(1, 0x884444, 1);
    clrGfx.strokeRoundedRect(clrX - actionBtnW / 2, delY - actionBtnH / 2, actionBtnW, actionBtnH, actionRadius);
    this.panelContainer.add(clrGfx);
    const clrLabel = this.add.text(clrX, delY, 'CLR', {
      fontSize: L.fontSize('tiny'), fontFamily: 'Arial', color: '#ffffff',
    }).setOrigin(0.5);
    this.panelContainer.add(clrLabel);
    const clrHit = this.add.rectangle(clrX, delY, actionBtnW, actionBtnH, 0x000000, 0);
    clrHit.setInteractive({ useHandCursor: true });
    this.panelContainer.add(clrHit);
    clrHit.on('pointerdown', () => {
      this.charName = '';
      nameText.setText('');
      this.refreshPreview();
    });

    // ── Physical keyboard input + paste ─────────
    if (this.input.keyboard) {
      this.input.keyboard.on('keydown', (event: KeyboardEvent) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
          navigator.clipboard.readText().then((text) => {
            const clean = text.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 10 - this.charName.length);
            if (clean.length > 0) {
              this.charName += clean;
              this.charName = this.charName.slice(0, 10);
              nameText.setText(this.charName);
              this.refreshPreview();
            }
          }).catch(() => { /* clipboard not available */ });
          return;
        }

        const key = event.key.toUpperCase();
        if (key === 'BACKSPACE') {
          if (this.charName.length > 0) {
            this.charName = this.charName.slice(0, -1);
            nameText.setText(this.charName || '');
            this.refreshPreview();
          }
        } else if (key.length === 1 && /[A-Z0-9]/.test(key) && this.charName.length < 10) {
          this.charName += key;
          nameText.setText(this.charName);
          this.refreshPreview();
        }
      });
    }

    // ── Public/Private toggle ──────────────────
    const toggleY = delY + L.h * 0.07;
    this.addSectionLabel(px, toggleY - L.h * 0.015, 'VISIBILITY');

    const toggleW = L.w * 0.2;
    const toggleH = L.h * 0.048;
    const toggleGfx = this.add.graphics();
    const drawToggle = (isPublic: boolean) => {
      toggleGfx.clear();
      toggleGfx.fillStyle(isPublic ? 0x226644 : 0x442266, 1);
      toggleGfx.fillRoundedRect(px - toggleW / 2, toggleY + L.h * 0.025 - toggleH / 2, toggleW, toggleH, 8);
      toggleGfx.lineStyle(2, isPublic ? 0x44cc88 : 0x8844cc, 1);
      toggleGfx.strokeRoundedRect(px - toggleW / 2, toggleY + L.h * 0.025 - toggleH / 2, toggleW, toggleH, 8);
    };
    drawToggle(this.isPublic);
    this.panelContainer.add(toggleGfx);

    const toggleText = this.add.text(px, toggleY + L.h * 0.025, this.isPublic ? 'PUBLIC' : 'PRIVATE', {
      fontSize: L.fontSize('small'), fontFamily: 'Arial Black, Arial', color: '#ffffff',
    }).setOrigin(0.5);
    this.panelContainer.add(toggleText);

    const toggleHit = this.add.rectangle(px, toggleY + L.h * 0.025, toggleW, toggleH, 0x000000, 0);
    toggleHit.setInteractive({ useHandCursor: true });
    this.panelContainer.add(toggleHit);

    toggleHit.on('pointerdown', () => {
      this.isPublic = !this.isPublic;
      drawToggle(this.isPublic);
      toggleText.setText(this.isPublic ? 'PUBLIC' : 'PRIVATE');
    });
  }

  // ════════════════════════════════════════════════════
  // BOTTOM BUTTONS
  // ════════════════════════════════════════════════════
  private createBottomButtons(): void {
    const L = this.L;
    const btnSmall = L.button('small');

    createButton(this, L.x(0.08), L.y(0.78), '\u2190 BACK', () => transitionTo(this, this.returnTo), {
      width: btnSmall.width, height: btnSmall.height, fontSize: L.fontSize('tiny'), style: 'ghost',
    });

    createButton(this, L.x(0.88), L.y(0.78), 'SAVE', () => this.saveCharacter(), {
      width: 140, height: 36, fontSize: '16px', style: 'success',
    });
  }

  // ════════════════════════════════════════════════════
  // SAVE
  // ════════════════════════════════════════════════════
  private async saveCharacter(): Promise<void> {
    this.charName = this.charName.trim();
    if (this.charName.length === 0) {
      showToast(this, 'Enter a name first!', 'error');
      return;
    }

    const superInfo = SUPER_MOVES.find(m => m.id === this.superMove)!;

    const charDef: CustomCharacterDef = {
      id: Date.now(),
      name: this.charName,
      stats: { ...this.stats },
      superMove: this.superMove,
      superDescription: `${superInfo.displayName} \u2014 ${superInfo.description}`,
      color: this.appearance.jerseyColor1,
      headColor: this.appearance.skinTone,
      accentColor: superInfo.color,
      appearance: { ...this.appearance },
      creatorDeviceId: getDeviceId(),
      isPublic: this.isPublic,
    };

    const saved = CharacterStorage.save(charDef, this.editIndex ?? undefined);
    if (!saved) {
      showToast(this, 'Save failed! Storage full or unavailable.', 'error');
      return;
    }

    if (this.isPublic) {
      const published = await CharacterApi.publish(charDef);
      if (published) {
        charDef.serverId = published.serverId;
        CharacterStorage.save(charDef, this.editIndex ?? CharacterStorage.count() - 1);
      } else {
        showToast(this, 'Publish failed — saved locally only.', 'error');
        this.time.delayedCall(1500, () => transitionTo(this, this.returnTo));
        return;
      }
    }

    showToast(this, 'Character saved!', 'success');
    this.time.delayedCall(500, () => transitionTo(this, this.returnTo));
  }

  // ════════════════════════════════════════════════════
  // UI HELPERS
  // ════════════════════════════════════════════════════
  private addSectionLabel(x: number, y: number, text: string): void {
    const L = this.L;
    const label = this.add.text(x, y, text, {
      fontSize: L.fontSize('small'), fontFamily: 'Arial', color: THEME.primaryHex,
    }).setOrigin(0.5);
    this.panelContainer.add(label);
  }

  private addCycler(cx: number, cy: number, options: string[], current: string, onChange: (val: string) => void): void {
    const L = this.L;
    let index = options.indexOf(current);
    if (index < 0) index = 0;

    const display = this.add.text(cx, cy, options[index].toUpperCase(), {
      fontSize: L.fontSize('small'), fontFamily: 'Arial', color: '#ffffff',
    }).setOrigin(0.5);
    this.panelContainer.add(display);

    const spacing = L.unit(0.2);

    const leftBtn = this.createSmallButton(cx - spacing, cy, '<', () => {
      index = (index - 1 + options.length) % options.length;
      display.setText(options[index].toUpperCase());
      onChange(options[index]);
    });
    this.panelContainer.add(leftBtn);

    const rightBtn = this.createSmallButton(cx + spacing, cy, '>', () => {
      index = (index + 1) % options.length;
      display.setText(options[index].toUpperCase());
      onChange(options[index]);
    });
    this.panelContainer.add(rightBtn);
  }

  private addColorPicker(cx: number, cy: number, colors: number[], current: number, onChange: (color: number) => void): void {
    const L = this.L;
    const swatchSize = L.unit(0.06);
    const gap = L.pad(0.3);
    const totalW = colors.length * (swatchSize + gap) - gap;
    const startX = cx - totalW / 2 + swatchSize / 2;

    colors.forEach((color, i) => {
      const x = startX + i * (swatchSize + gap);
      const swatch = this.add.rectangle(x, cy, swatchSize, swatchSize, color);
      swatch.setStrokeStyle(color === current ? 3 : 1, color === current ? 0xffffff : 0x000000);
      swatch.setInteractive({ useHandCursor: true });
      this.panelContainer.add(swatch);

      swatch.on('pointerdown', () => {
        onChange(color);
        this.showTab(this.activeTab);
      });
    });
  }

  private addNumberSelector(cx: number, cy: number, current: number, min: number, max: number, onChange: (val: number) => void): void {
    const L = this.L;
    let value = current;

    const display = this.add.text(cx, cy, String(value), {
      fontSize: L.fontSize('body'), fontFamily: 'Arial Black, Arial', color: '#ffffff',
    }).setOrigin(0.5);
    this.panelContainer.add(display);

    const spacing = L.unit(0.1);

    const minus = this.createSmallButton(cx - spacing, cy, '-', () => {
      if (value > min) {
        value--;
        display.setText(String(value));
        onChange(value);
      }
    });
    this.panelContainer.add(minus);

    const plus = this.createSmallButton(cx + spacing, cy, '+', () => {
      if (value < max) {
        value++;
        display.setText(String(value));
        onChange(value);
      }
    });
    this.panelContainer.add(plus);
  }

  private createSmallButton(x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Container {
    const L = this.L;
    const btnW = L.unit(0.07);
    const btnH = L.unit(0.055);
    const radius = 6;
    const container = this.add.container(x, y);

    const gfx = this.add.graphics();
    gfx.fillStyle(THEME.cardBg, 1);
    gfx.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, radius);
    gfx.lineStyle(1, THEME.cardBorder, 1);
    gfx.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, radius);
    container.add(gfx);

    const hitArea = this.add.rectangle(0, 0, btnW, btnH, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });
    container.add(hitArea);

    const text = this.add.text(0, 0, label, {
      fontSize: L.fontSize('small'), fontFamily: 'Arial Black, Arial', color: '#ffffff',
    }).setOrigin(0.5);
    container.add(text);

    hitArea.on('pointerdown', () => { SoundManager.getInstance().creatorClick(); onClick(); });
    hitArea.on('pointerover', () => {
      gfx.clear();
      gfx.fillStyle(0x2a2a6a, 1);
      gfx.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, radius);
      gfx.lineStyle(1, THEME.cardBorder, 1);
      gfx.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, radius);
    });
    hitArea.on('pointerout', () => {
      gfx.clear();
      gfx.fillStyle(THEME.cardBg, 1);
      gfx.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, radius);
      gfx.lineStyle(1, THEME.cardBorder, 1);
      gfx.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, radius);
    });

    return container;
  }
}
