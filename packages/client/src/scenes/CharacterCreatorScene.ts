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

// ─── Constants ─────────────────────────────────────────
const TOTAL_STAT_POINTS = 15;
const MIN_STAT = 2;
const MAX_STAT = 8;

const TABS = ['LOOK', 'JERSEY', 'STATS', 'SUPER', 'NAME'] as const;
type TabName = typeof TABS[number];

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
  private tabButtons: Map<TabName, { bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }> = new Map();

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
    this.add.rectangle(L.cx, L.cy, L.w, L.h, 0x0d0d1a);

    // Title
    this.add.text(L.cx, L.y(0.03), this.editIndex !== null ? 'EDIT CHARACTER' : 'CREATE CHARACTER', {
      fontSize: L.fontSize('body'), fontFamily: 'Arial Black, Arial', color: '#00ccff',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);

    // ── Live Preview (left) ────────────────────────
    const previewBoxW = L.w * 0.18;
    const previewBoxH = L.h * 0.55;
    this.add.rectangle(L.x(0.13), L.y(0.45), previewBoxW, previewBoxH, 0x1a1a2e).setStrokeStyle(2, 0x333355);
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
    const tabH = L.unit(0.06);
    const gap = L.unit(0.015);
    const startX = L.x(0.27);
    const y = L.y(0.09);

    TABS.forEach((tab, i) => {
      const x = startX + i * (tabW + gap);
      const bg = this.add.rectangle(x, y, tabW, tabH, 0x2a2a4e);
      bg.setStrokeStyle(1, 0x444466);
      bg.setInteractive({ useHandCursor: true });

      const label = this.add.text(x, y, tab, {
        fontSize: L.fontSize('tiny'), fontFamily: 'Arial', color: '#aaaacc',
      }).setOrigin(0.5);

      bg.on('pointerdown', () => this.showTab(tab));
      bg.on('pointerover', () => { if (this.activeTab !== tab) bg.setFillStyle(0x3a3a6e); });
      bg.on('pointerout', () => { if (this.activeTab !== tab) bg.setFillStyle(0x2a2a4e); });

      this.tabButtons.set(tab, { bg, label });
    });
  }

  private showTab(tab: TabName): void {
    this.activeTab = tab;

    if (this.input.keyboard) {
      this.input.keyboard.removeAllListeners('keydown');
    }

    this.tabButtons.forEach((btn, key) => {
      if (key === tab) {
        btn.bg.setFillStyle(0x00ccff);
        btn.label.setColor('#000000');
      } else {
        btn.bg.setFillStyle(0x2a2a4e);
        btn.label.setColor('#aaaacc');
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
      fontSize: L.fontSize('small'), fontFamily: 'Arial', color: '#ffaa00',
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
        fontSize: L.fontSize('tiny'), fontFamily: 'Arial', color: '#666688',
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

    const barBg = this.add.rectangle(cx, cy, barW, barH, 0x222244);
    barBg.setStrokeStyle(1, 0x444466);
    this.panelContainer.add(barBg);

    const fillW = ((value - MIN_STAT) / (MAX_STAT - MIN_STAT)) * barW;
    const fillBar = this.add.rectangle(cx - barW / 2 + fillW / 2, cy, fillW, barH - 2, 0x00ccff);
    this.panelContainer.add(fillBar);

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
    const cardH = L.h * 0.09;
    const gap = L.pad(0.5);
    const panelCx = L.x(0.55);
    const startX = panelCx - (cardW + gap) / 2;
    const startY = L.y(0.16);

    SUPER_MOVES.forEach((move, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = startX + col * (cardW + gap);
      const y = startY + row * (cardH + gap);

      const isSelected = this.superMove === move.id;
      const bg = this.add.rectangle(x, y, cardW, cardH, isSelected ? 0x1a3a5e : 0x1a1a2e);
      bg.setStrokeStyle(2, isSelected ? move.color : 0x333355);
      bg.setInteractive({ useHandCursor: true });
      this.panelContainer.add(bg);

      const dotR = L.unit(0.012);
      const dot = this.add.arc(x - cardW / 2 + L.pad(1), y - cardH * 0.15, dotR, 0, 360, false, move.color);
      this.panelContainer.add(dot);

      const nameText = this.add.text(x - cardW / 2 + L.pad(1.5) + dotR, y - cardH * 0.3, move.displayName, {
        fontSize: L.fontSize('tiny'), fontFamily: 'Arial Black, Arial', color: isSelected ? '#ffffff' : '#aaaacc',
      });
      this.panelContainer.add(nameText);

      const descText = this.add.text(x - cardW / 2 + L.pad(0.8), y + cardH * 0.05, move.description, {
        fontSize: L.fontSize('tiny'), fontFamily: 'Arial', color: '#888899',
        wordWrap: { width: cardW - L.pad(1.5) },
      });
      this.panelContainer.add(descText);

      if (isSelected) {
        const check = this.add.text(x + cardW / 2 - L.pad(1), y - cardH * 0.28, '\u2713', {
          fontSize: L.fontSize('body'), fontFamily: 'Arial', color: '#00ff88',
        }).setOrigin(0.5);
        this.panelContainer.add(check);
      }

      bg.on('pointerdown', () => {
        this.superMove = move.id;
        this.showTab('SUPER');
      });
      bg.on('pointerover', () => { if (!isSelected) bg.setFillStyle(0x2a2a4e); });
      bg.on('pointerout', () => { if (!isSelected) bg.setFillStyle(0x1a1a2e); });
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
    const nameBg = this.add.rectangle(px, y, nameBoxW, nameBoxH, 0x111122);
    nameBg.setStrokeStyle(2, 0x444466);
    this.panelContainer.add(nameBg);

    const nameText = this.add.text(px, y, this.charName, {
      fontSize: L.fontSize('body'), fontFamily: 'Arial Black, Arial', color: '#ffffff',
    }).setOrigin(0.5);
    this.panelContainer.add(nameText);

    // Virtual keyboard
    y += L.h * 0.055;
    const keys = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const keysPerRow = 10;
    const keySize = L.unit(0.07);
    const keyGap = L.unit(0.008);
    const totalRowW = keysPerRow * (keySize + keyGap) - keyGap;
    const kbStartX = px - totalRowW / 2 + keySize / 2;

    for (let i = 0; i < keys.length; i++) {
      const row = Math.floor(i / keysPerRow);
      const col = i % keysPerRow;
      const kx = kbStartX + col * (keySize + keyGap);
      const ky = y + row * (keySize + keyGap);
      const char = keys[i];

      const keyBg = this.add.rectangle(kx, ky, keySize, keySize, 0x2a2a4e);
      keyBg.setStrokeStyle(1, 0x444466);
      keyBg.setInteractive({ useHandCursor: true });
      this.panelContainer.add(keyBg);

      const keyLabel = this.add.text(kx, ky, char, {
        fontSize: L.fontSize('tiny'), fontFamily: 'Arial', color: '#ffffff',
      }).setOrigin(0.5);
      this.panelContainer.add(keyLabel);

      keyBg.on('pointerdown', () => {
        if (this.charName.length < 10) {
          this.charName += char;
          nameText.setText(this.charName);
          this.refreshPreview();
        }
      });
      keyBg.on('pointerover', () => keyBg.setFillStyle(0x3a3a6e));
      keyBg.on('pointerout', () => keyBg.setFillStyle(0x2a2a4e));
    }

    // DEL button
    const delY = y + Math.ceil(keys.length / keysPerRow) * (keySize + keyGap);
    const actionBtnW = L.w * 0.06;
    const actionBtnH = L.h * 0.045;
    const delBg = this.add.rectangle(px - L.w * 0.055, delY, actionBtnW, actionBtnH, 0x664444);
    delBg.setStrokeStyle(1, 0x884444);
    delBg.setInteractive({ useHandCursor: true });
    this.panelContainer.add(delBg);
    const delLabel = this.add.text(px - L.w * 0.055, delY, 'DEL', {
      fontSize: L.fontSize('tiny'), fontFamily: 'Arial', color: '#ffffff',
    }).setOrigin(0.5);
    this.panelContainer.add(delLabel);
    delBg.on('pointerdown', () => {
      if (this.charName.length > 0) {
        this.charName = this.charName.slice(0, -1);
        nameText.setText(this.charName || '');
        this.refreshPreview();
      }
    });

    // CLR button
    const clrBg = this.add.rectangle(px + L.w * 0.055, delY, actionBtnW, actionBtnH, 0x664444);
    clrBg.setStrokeStyle(1, 0x884444);
    clrBg.setInteractive({ useHandCursor: true });
    this.panelContainer.add(clrBg);
    const clrLabel = this.add.text(px + L.w * 0.055, delY, 'CLR', {
      fontSize: L.fontSize('tiny'), fontFamily: 'Arial', color: '#ffffff',
    }).setOrigin(0.5);
    this.panelContainer.add(clrLabel);
    clrBg.on('pointerdown', () => {
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
    const toggleBg = this.add.rectangle(px, toggleY + L.h * 0.025, toggleW, toggleH, this.isPublic ? 0x226644 : 0x442266);
    toggleBg.setStrokeStyle(2, this.isPublic ? 0x44cc88 : 0x8844cc);
    toggleBg.setInteractive({ useHandCursor: true });
    this.panelContainer.add(toggleBg);

    const toggleText = this.add.text(px, toggleY + L.h * 0.025, this.isPublic ? 'PUBLIC' : 'PRIVATE', {
      fontSize: L.fontSize('small'), fontFamily: 'Arial Black, Arial', color: '#ffffff',
    }).setOrigin(0.5);
    this.panelContainer.add(toggleText);

    toggleBg.on('pointerdown', () => {
      this.isPublic = !this.isPublic;
      toggleBg.setFillStyle(this.isPublic ? 0x226644 : 0x442266);
      toggleBg.setStrokeStyle(2, this.isPublic ? 0x44cc88 : 0x8844cc);
      toggleText.setText(this.isPublic ? 'PUBLIC' : 'PRIVATE');
    });
  }

  // ════════════════════════════════════════════════════
  // BOTTOM BUTTONS
  // ════════════════════════════════════════════════════
  private createBottomButtons(): void {
    const L = this.L;
    const btnSmall = L.button('small');
    const btnNormal = L.button('normal');

    createButton(this, L.x(0.08), L.y(0.96), '\u2190 BACK', () => transitionTo(this, this.returnTo), {
      width: btnSmall.width, height: btnSmall.height, fontSize: L.fontSize('tiny'), strokeColor: 0x666666,
    });

    createButton(this, L.x(0.92), L.y(0.96), 'SAVE', () => this.saveCharacter(), {
      width: btnNormal.width, height: btnNormal.height, fillColor: 0x00aa44, strokeColor: 0x00ff66, fontSize: L.fontSize('body'),
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
      fontSize: L.fontSize('small'), fontFamily: 'Arial', color: '#00ccff',
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
    const container = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, btnW, btnH, 0x333355);
    bg.setStrokeStyle(1, 0x555577);
    bg.setInteractive({ useHandCursor: true });
    container.add(bg);

    const text = this.add.text(0, 0, label, {
      fontSize: L.fontSize('small'), fontFamily: 'Arial Black, Arial', color: '#ffffff',
    }).setOrigin(0.5);
    container.add(text);

    bg.on('pointerdown', () => { SoundManager.getInstance().creatorClick(); onClick(); });
    bg.on('pointerover', () => bg.setFillStyle(0x4a4a7e));
    bg.on('pointerout', () => bg.setFillStyle(0x333355));

    return container;
  }
}
