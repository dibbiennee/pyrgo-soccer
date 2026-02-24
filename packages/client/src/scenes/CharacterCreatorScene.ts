import Phaser from 'phaser';
import {
  GAME_WIDTH, GAME_HEIGHT,
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
import { setupResponsiveCamera } from '../utils/responsive';

// ─── Constants ─────────────────────────────────────────
const TOTAL_STAT_POINTS = 15;
const MIN_STAT = 2;
const MAX_STAT = 8;

const TABS = ['LOOK', 'JERSEY', 'STATS', 'SUPER', 'NAME'] as const;
type TabName = typeof TABS[number];

export class CharacterCreatorScene extends Phaser.Scene {
  // Current appearance being edited
  private appearance!: Appearance;
  private charName = 'PLAYER';
  private stats = { speed: 5, power: 5, defense: 5 };
  private superMove: SuperMoveId = 'flameDash';
  private isPublic = false;

  // Edit mode: if set, we're editing an existing slot
  private editIndex: number | null = null;
  private returnTo = 'CharSelect';

  // UI references
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

    // Default appearance for a new character
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
    setupResponsiveCamera(this);
    fadeIn(this);

    // Background
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0d0d1a);

    // Title
    this.add.text(GAME_WIDTH / 2, 16, this.editIndex !== null ? 'EDIT CHARACTER' : 'CREATE CHARACTER', {
      fontSize: '20px', fontFamily: 'Arial Black, Arial', color: '#00ccff',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);

    // ── Live Preview (left) ────────────────────────
    this.add.rectangle(100, 240, 180, 300, 0x1a1a2e).setStrokeStyle(2, 0x333355);
    this.previewContainer = this.add.container(100, 220);
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
    this.previewContainer.removeAll(true);
    const parts = CharacterRenderer.renderCharacter(this, this.appearance, { scale: 1.6, facingRight: true });
    for (const part of parts) {
      this.previewContainer.add(part);
    }
    // Name below preview
    const nameLabel = this.add.text(0, 70, this.charName, {
      fontSize: '14px', fontFamily: 'Arial Black, Arial', color: '#ffffff',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5);
    this.previewContainer.add(nameLabel);
  }

  // ════════════════════════════════════════════════════
  // TABS
  // ════════════════════════════════════════════════════
  private createTabs(): void {
    const tabW = 80;
    const startX = 230;
    const y = 40;

    TABS.forEach((tab, i) => {
      const x = startX + i * (tabW + 6);
      const bg = this.add.rectangle(x, y, tabW, 26, 0x2a2a4e);
      bg.setStrokeStyle(1, 0x444466);
      bg.setInteractive({ useHandCursor: true });

      const label = this.add.text(x, y, tab, {
        fontSize: '11px', fontFamily: 'Arial', color: '#aaaacc',
      }).setOrigin(0.5);

      bg.on('pointerdown', () => this.showTab(tab));
      bg.on('pointerover', () => { if (this.activeTab !== tab) bg.setFillStyle(0x3a3a6e); });
      bg.on('pointerout', () => { if (this.activeTab !== tab) bg.setFillStyle(0x2a2a4e); });

      this.tabButtons.set(tab, { bg, label });
    });
  }

  private showTab(tab: TabName): void {
    this.activeTab = tab;

    // Remove keyboard listeners from previous NAME tab
    if (this.input.keyboard) {
      this.input.keyboard.removeAllListeners('keydown');
    }

    // Update tab visuals
    this.tabButtons.forEach((btn, key) => {
      if (key === tab) {
        btn.bg.setFillStyle(0x00ccff);
        btn.label.setColor('#000000');
      } else {
        btn.bg.setFillStyle(0x2a2a4e);
        btn.label.setColor('#aaaacc');
      }
    });

    // Clear panel
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
    const px = 420; // panel center x
    let y = 75;

    // Face Shape
    this.addSectionLabel(px, y, 'FACE');
    y += 20;
    this.addCycler(px, y, FACE_SHAPES as unknown as string[], this.appearance.faceShape, (val) => {
      this.appearance.faceShape = val as FaceShape;
      this.refreshPreview();
    });

    // Hair Style
    y += 40;
    this.addSectionLabel(px, y, 'HAIR STYLE');
    y += 20;
    this.addCycler(px, y, HAIR_STYLES as unknown as string[], this.appearance.hairStyle, (val) => {
      this.appearance.hairStyle = val as HairStyle;
      this.refreshPreview();
    });

    // Hair Color
    y += 40;
    this.addSectionLabel(px, y, 'HAIR COLOR');
    y += 22;
    this.addColorPicker(px, y, HAIR_COLORS, this.appearance.hairColor, (color) => {
      this.appearance.hairColor = color;
      this.refreshPreview();
    });

    // Skin Tone
    y += 40;
    this.addSectionLabel(px, y, 'SKIN');
    y += 22;
    this.addColorPicker(px, y, SKIN_TONES, this.appearance.skinTone, (color) => {
      this.appearance.skinTone = color;
      this.refreshPreview();
    });

    // Eye Style
    y += 40;
    this.addSectionLabel(px, y, 'EYES');
    y += 20;
    this.addCycler(px, y, EYE_STYLES as unknown as string[], this.appearance.eyeStyle, (val) => {
      this.appearance.eyeStyle = val as EyeStyle;
      this.refreshPreview();
    });

    // Beard
    y += 40;
    this.addSectionLabel(px, y, 'BEARD');
    y += 20;
    this.addCycler(px, y, BEARD_STYLES as unknown as string[], this.appearance.beard, (val) => {
      this.appearance.beard = val as BeardStyle;
      this.refreshPreview();
    });
  }

  // ════════════════════════════════════════════════════
  // JERSEY PANEL
  // ════════════════════════════════════════════════════
  private buildJerseyPanel(): void {
    const px = 420;
    let y = 80;

    this.addSectionLabel(px, y, 'PRIMARY COLOR');
    y += 22;
    this.addColorPicker(px, y, JERSEY_COLORS, this.appearance.jerseyColor1, (color) => {
      this.appearance.jerseyColor1 = color;
      this.refreshPreview();
    });

    y += 50;
    this.addSectionLabel(px, y, 'ACCENT COLOR');
    y += 22;
    this.addColorPicker(px, y, JERSEY_COLORS, this.appearance.jerseyColor2, (color) => {
      this.appearance.jerseyColor2 = color;
      this.refreshPreview();
    });

    y += 50;
    this.addSectionLabel(px, y, 'JERSEY NUMBER');
    y += 25;
    this.addNumberSelector(px, y, this.appearance.jerseyNumber, 1, 99, (val) => {
      this.appearance.jerseyNumber = val;
      this.refreshPreview();
    });
  }

  // ════════════════════════════════════════════════════
  // STATS PANEL
  // ════════════════════════════════════════════════════
  private buildStatsPanel(): void {
    const px = 420;
    let y = 80;

    const remaining = TOTAL_STAT_POINTS - this.stats.speed - this.stats.power - this.stats.defense;
    const remainLabel = this.add.text(px, y, `Points remaining: ${remaining}`, {
      fontSize: '14px', fontFamily: 'Arial', color: '#ffaa00',
    }).setOrigin(0.5);
    this.panelContainer.add(remainLabel);

    y += 35;
    const statDefs: { key: 'speed' | 'power' | 'defense'; label: string; desc: string }[] = [
      { key: 'speed', label: 'SPEED', desc: 'Movement + jump speed' },
      { key: 'power', label: 'POWER', desc: 'Kick force + header' },
      { key: 'defense', label: 'DEFENSE', desc: 'Ball slow on contact' },
    ];

    for (const def of statDefs) {
      this.addSectionLabel(px, y, def.label);
      y += 4;
      const descText = this.add.text(px, y + 12, def.desc, {
        fontSize: '10px', fontFamily: 'Arial', color: '#666688',
      }).setOrigin(0.5);
      this.panelContainer.add(descText);

      y += 28;
      this.addStatSlider(px, y, def.key, remainLabel);
      y += 50;
    }
  }

  private addStatSlider(cx: number, cy: number, key: 'speed' | 'power' | 'defense', remainLabel: Phaser.GameObjects.Text): void {
    const value = this.stats[key];
    const barW = 200;
    const barH = 16;

    // Background bar
    const barBg = this.add.rectangle(cx, cy, barW, barH, 0x222244);
    barBg.setStrokeStyle(1, 0x444466);
    this.panelContainer.add(barBg);

    // Filled bar
    const fillW = ((value - MIN_STAT) / (MAX_STAT - MIN_STAT)) * barW;
    const fillBar = this.add.rectangle(cx - barW / 2 + fillW / 2, cy, fillW, barH - 2, 0x00ccff);
    this.panelContainer.add(fillBar);

    // Value text
    const valText = this.add.text(cx, cy, String(value), {
      fontSize: '12px', fontFamily: 'Arial Black, Arial', color: '#ffffff',
    }).setOrigin(0.5);
    this.panelContainer.add(valText);

    // - button
    const minusBtn = this.createSmallButton(cx - barW / 2 - 20, cy, '-', () => {
      const remaining = TOTAL_STAT_POINTS - this.stats.speed - this.stats.power - this.stats.defense;
      if (this.stats[key] > MIN_STAT) {
        this.stats[key]--;
        this.showTab('STATS');
      }
    });
    this.panelContainer.add(minusBtn);

    // + button
    const plusBtn = this.createSmallButton(cx + barW / 2 + 20, cy, '+', () => {
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
    const startX = 260;
    const startY = 75;
    const cardW = 160;
    const cardH = 55;
    const gap = 6;

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

      // Color dot
      const dot = this.add.arc(x - cardW / 2 + 14, y - 8, 6, 0, 360, false, move.color);
      this.panelContainer.add(dot);

      const nameText = this.add.text(x - cardW / 2 + 26, y - 16, move.displayName, {
        fontSize: '12px', fontFamily: 'Arial Black, Arial', color: isSelected ? '#ffffff' : '#aaaacc',
      });
      this.panelContainer.add(nameText);

      const descText = this.add.text(x - cardW / 2 + 10, y + 2, move.description, {
        fontSize: '9px', fontFamily: 'Arial', color: '#888899',
        wordWrap: { width: cardW - 20 },
      });
      this.panelContainer.add(descText);

      if (isSelected) {
        const check = this.add.text(x + cardW / 2 - 14, y - 16, '\u2713', {
          fontSize: '16px', fontFamily: 'Arial', color: '#00ff88',
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
    const px = 420;
    let y = 85;

    this.addSectionLabel(px, y, 'CHARACTER NAME');
    y += 24;

    // Name display
    const nameBg = this.add.rectangle(px, y, 200, 30, 0x111122);
    nameBg.setStrokeStyle(2, 0x444466);
    this.panelContainer.add(nameBg);

    const nameText = this.add.text(px, y, this.charName, {
      fontSize: '16px', fontFamily: 'Arial Black, Arial', color: '#ffffff',
    }).setOrigin(0.5);
    this.panelContainer.add(nameText);

    // Virtual keyboard
    y += 35;
    const keys = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const keysPerRow = 10;
    const keySize = 28;
    const keyGap = 3;
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
        fontSize: '12px', fontFamily: 'Arial', color: '#ffffff',
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
    const delBg = this.add.rectangle(px - 50, delY, 60, 28, 0x664444);
    delBg.setStrokeStyle(1, 0x884444);
    delBg.setInteractive({ useHandCursor: true });
    this.panelContainer.add(delBg);
    const delLabel = this.add.text(px - 50, delY, 'DEL', {
      fontSize: '12px', fontFamily: 'Arial', color: '#ffffff',
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
    const clrBg = this.add.rectangle(px + 50, delY, 60, 28, 0x664444);
    clrBg.setStrokeStyle(1, 0x884444);
    clrBg.setInteractive({ useHandCursor: true });
    this.panelContainer.add(clrBg);
    const clrLabel = this.add.text(px + 50, delY, 'CLR', {
      fontSize: '12px', fontFamily: 'Arial', color: '#ffffff',
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
        // Paste support (Ctrl+V / Cmd+V)
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
    const toggleY = delY + 45;
    this.addSectionLabel(px, toggleY - 10, 'VISIBILITY');

    const toggleBg = this.add.rectangle(px, toggleY + 14, 200, 30, this.isPublic ? 0x226644 : 0x442266);
    toggleBg.setStrokeStyle(2, this.isPublic ? 0x44cc88 : 0x8844cc);
    toggleBg.setInteractive({ useHandCursor: true });
    this.panelContainer.add(toggleBg);

    const toggleText = this.add.text(px, toggleY + 14, this.isPublic ? 'PUBLIC' : 'PRIVATE', {
      fontSize: '14px', fontFamily: 'Arial Black, Arial', color: '#ffffff',
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
    createButton(this, 60, GAME_HEIGHT - 25, '\u2190 BACK', () => transitionTo(this, this.returnTo), {
      width: 80, height: 30, fontSize: '13px', strokeColor: 0x666666,
    });

    createButton(this, GAME_WIDTH - 80, GAME_HEIGHT - 25, 'SAVE', () => this.saveCharacter(), {
      width: 120, height: 34, fillColor: 0x00aa44, strokeColor: 0x00ff66, fontSize: '16px',
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
      id: Date.now(), // unique ID
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

    // Save locally
    const saved = CharacterStorage.save(charDef, this.editIndex ?? undefined);
    if (!saved) {
      showToast(this, 'Save failed! Storage full or unavailable.', 'error');
      return;
    }

    // If public, also publish to server
    if (this.isPublic) {
      const published = await CharacterApi.publish(charDef);
      if (published) {
        // Update local copy with serverId
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
    const label = this.add.text(x, y, text, {
      fontSize: '11px', fontFamily: 'Arial', color: '#00ccff',
    }).setOrigin(0.5);
    this.panelContainer.add(label);
  }

  private addCycler(cx: number, cy: number, options: string[], current: string, onChange: (val: string) => void): void {
    let index = options.indexOf(current);
    if (index < 0) index = 0;

    const display = this.add.text(cx, cy, options[index].toUpperCase(), {
      fontSize: '13px', fontFamily: 'Arial', color: '#ffffff',
    }).setOrigin(0.5);
    this.panelContainer.add(display);

    // Left arrow
    const leftBtn = this.createSmallButton(cx - 80, cy, '<', () => {
      index = (index - 1 + options.length) % options.length;
      display.setText(options[index].toUpperCase());
      onChange(options[index]);
    });
    this.panelContainer.add(leftBtn);

    // Right arrow
    const rightBtn = this.createSmallButton(cx + 80, cy, '>', () => {
      index = (index + 1) % options.length;
      display.setText(options[index].toUpperCase());
      onChange(options[index]);
    });
    this.panelContainer.add(rightBtn);
  }

  private addColorPicker(cx: number, cy: number, colors: number[], current: number, onChange: (color: number) => void): void {
    const swatchSize = 22;
    const gap = 4;
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
        this.showTab(this.activeTab); // refresh to update selection
      });
    });
  }

  private addNumberSelector(cx: number, cy: number, current: number, min: number, max: number, onChange: (val: number) => void): void {
    let value = current;

    const display = this.add.text(cx, cy, String(value), {
      fontSize: '18px', fontFamily: 'Arial Black, Arial', color: '#ffffff',
    }).setOrigin(0.5);
    this.panelContainer.add(display);

    const minus = this.createSmallButton(cx - 50, cy, '-', () => {
      if (value > min) {
        value--;
        display.setText(String(value));
        onChange(value);
      }
    });
    this.panelContainer.add(minus);

    const plus = this.createSmallButton(cx + 50, cy, '+', () => {
      if (value < max) {
        value++;
        display.setText(String(value));
        onChange(value);
      }
    });
    this.panelContainer.add(plus);
  }

  private createSmallButton(x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 28, 24, 0x333355);
    bg.setStrokeStyle(1, 0x555577);
    bg.setInteractive({ useHandCursor: true });
    container.add(bg);

    const text = this.add.text(0, 0, label, {
      fontSize: '14px', fontFamily: 'Arial Black, Arial', color: '#ffffff',
    }).setOrigin(0.5);
    container.add(text);

    bg.on('pointerdown', () => { SoundManager.getInstance().creatorClick(); onClick(); });
    bg.on('pointerover', () => bg.setFillStyle(0x4a4a7e));
    bg.on('pointerout', () => bg.setFillStyle(0x333355));

    return container;
  }
}
