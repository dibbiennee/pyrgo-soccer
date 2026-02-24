import Phaser from 'phaser';
import {
  CHARACTERS,
  SUPER_MOVES,
  defaultAppearanceForPreset,
} from '@pyrgo/shared';
import type { CharacterDef, CharacterRef, CustomCharacterDef, Appearance } from '@pyrgo/shared';
import { CharacterRenderer } from '../rendering/CharacterRenderer';
import { CharacterStorage } from '../storage/CharacterStorage';
import { CharacterApi, type PublishedCharacter } from '../api/CharacterApi';
import { transitionTo, fadeIn } from '../utils/SceneTransition';
import { createButton } from '../ui/ButtonFactory';
import { LayoutManager } from '../utils/LayoutManager';
import { THEME, drawGradientBackground } from '../ui/UITheme';

type SelectTab = 'mine' | 'community';

interface TabEntry {
  gfx: Phaser.GameObjects.Graphics;
  hitArea: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  x: number;
  y: number;
  w: number;
  h: number;
}

export class CharSelectScene extends Phaser.Scene {
  private L!: LayoutManager;

  private mode: 'online' | 'cpu' = 'cpu';
  private activePlayer = 1;
  private activeTab: SelectTab = 'community';
  private communityChars: PublishedCharacter[] = [];

  private selection1: CharacterRef = { type: 'preset', id: 1 };
  private selection2: CharacterRef = { type: 'preset', id: 2 };

  private gridContainer!: Phaser.GameObjects.Container;
  private previewContainer!: Phaser.GameObjects.Container;
  private tabButtons: Map<SelectTab, TabEntry> = new Map();
  private selectionIndicator!: Phaser.GameObjects.Text;
  private nameText!: Phaser.GameObjects.Text;
  private statsTexts!: { speed: Phaser.GameObjects.Text; power: Phaser.GameObjects.Text; defense: Phaser.GameObjects.Text };
  private superText!: Phaser.GameObjects.Text;

  constructor() {
    super('CharSelect');
  }

  init(data: { mode?: 'online' | 'cpu' }): void {
    this.mode = data.mode ?? 'cpu';
    this.activePlayer = 1;
    this.selection1 = { type: 'preset', id: CHARACTERS[0].id };
    this.selection2 = { type: 'preset', id: CHARACTERS[1]?.id ?? CHARACTERS[0].id };
    this.activeTab = CharacterStorage.count() > 0 ? 'mine' : 'community';
  }

  create(): void {
    fadeIn(this);
    this.L = new LayoutManager(this);
    const L = this.L;

    drawGradientBackground(this);

    // Title
    this.add.text(L.cx, L.y(0.05), 'SELECT YOUR FIGHTER', {
      fontSize: '24px', fontFamily: 'Arial Black, Arial', color: THEME.primaryHex,
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5);

    // Selection indicator
    this.selectionIndicator = this.add.text(L.cx, L.y(0.09), 'Player 1 \u2014 Choose!', {
      fontSize: L.fontSize('tiny'), fontFamily: 'Arial', color: THEME.secondaryHex,
    }).setOrigin(0.5);

    // ── Tabs ─────────────────────────────────────
    this.createTabs();

    // ── Character grid ───────────────────────────
    this.gridContainer = this.add.container(0, 0);
    this.showGrid();

    // ── Preview area (compact) ──────────────────
    this.previewContainer = this.add.container(L.cx, L.y(0.41));

    this.nameText = this.add.text(0, 0, '', {
      fontSize: '25px', fontFamily: 'Arial Black, Arial', color: '#ffffff',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);
    this.previewContainer.add(this.nameText);

    const statsX = -180;
    const statY0 = 26;
    const statGap = 26;
    this.statsTexts = {
      speed: this.add.text(statsX, statY0, '', { fontSize: '17px', fontFamily: 'Arial', color: '#ffffff' }),
      power: this.add.text(statsX, statY0 + statGap, '', { fontSize: '17px', fontFamily: 'Arial', color: '#ffffff' }),
      defense: this.add.text(statsX, statY0 + statGap * 2, '', { fontSize: '17px', fontFamily: 'Arial', color: '#ffffff' }),
    };
    this.previewContainer.add(this.statsTexts.speed);
    this.previewContainer.add(this.statsTexts.power);
    this.previewContainer.add(this.statsTexts.defense);

    this.superText = this.add.text(0, statY0 + statGap * 3, '', {
      fontSize: '15px', fontFamily: 'Arial', color: THEME.textSecondary, wordWrap: { width: 500 },
    }).setOrigin(0.5);
    this.previewContainer.add(this.superText);

    this.updatePreview();

    // ── Bottom buttons (compact) ──────────────────
    createButton(this, L.cx, L.y(0.78), 'CONFIRM', () => this.confirmSelection(), {
      width: 180, height: 36,
      fontSize: '16px',
      style: 'success',
    });

    createButton(this, L.x(0.12), L.y(0.78), '\u2190 BACK', () => transitionTo(this, 'MainMenu'), {
      width: 120, height: 36, fontSize: '13px', style: 'ghost',
    });

    createButton(this, L.x(0.88), L.y(0.78), '+ CREATE', () => {
      transitionTo(this, 'CharacterCreator', { returnTo: 'CharSelect' });
    }, {
      width: 140, height: 36, fontSize: '13px', style: 'primary',
    });
  }

  // ════════════════════════════════════════════════════
  // TABS
  // ════════════════════════════════════════════════════
  private createTabs(): void {
    const L = this.L;
    const tabs: { key: SelectTab; label: string }[] = [
      { key: 'mine', label: 'I MIEI' },
      { key: 'community', label: 'COMMUNITY' },
    ];

    const tabW = L.w * 0.12;
    const tabH = 28;
    const gap = L.pad(0.5);
    const startX = L.cx - (tabs.length * (tabW + gap)) / 2 + tabW / 2;
    const y = L.y(0.14);
    const radius = 8;

    tabs.forEach((tab, i) => {
      const x = startX + i * (tabW + gap);
      const gfx = this.add.graphics();

      const hitArea = this.add.rectangle(x, y, tabW, tabH, 0x000000, 0);
      hitArea.setInteractive({ useHandCursor: true });

      const label = this.add.text(x, y, tab.label, {
        fontSize: L.fontSize('tiny'), fontFamily: 'Arial', color: THEME.textSecondary,
      }).setOrigin(0.5);

      hitArea.on('pointerdown', () => {
        this.activeTab = tab.key;
        this.updateTabVisuals();
        this.showGrid();
      });
      hitArea.on('pointerover', () => {
        if (this.activeTab !== tab.key) {
          gfx.clear();
          gfx.fillStyle(0x2a2a6a, 1);
          gfx.fillRoundedRect(x - tabW / 2, y - tabH / 2, tabW, tabH, radius);
          gfx.lineStyle(1, THEME.cardBorder, 1);
          gfx.strokeRoundedRect(x - tabW / 2, y - tabH / 2, tabW, tabH, radius);
        }
      });
      hitArea.on('pointerout', () => {
        if (this.activeTab !== tab.key) {
          this.drawTabInactive(gfx, x, y, tabW, tabH, radius);
        }
      });

      this.tabButtons.set(tab.key, { gfx, hitArea, label, x, y, w: tabW, h: tabH });
    });

    this.updateTabVisuals();
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

  private updateTabVisuals(): void {
    const radius = 8;
    this.tabButtons.forEach((btn, key) => {
      if (key === this.activeTab) {
        this.drawTabActive(btn.gfx, btn.x, btn.y, btn.w, btn.h, radius);
        btn.label.setColor('#000000');
      } else {
        this.drawTabInactive(btn.gfx, btn.x, btn.y, btn.w, btn.h, radius);
        btn.label.setColor(THEME.textSecondary);
      }
    });
  }

  // ════════════════════════════════════════════════════
  // CHARACTER GRID
  // ════════════════════════════════════════════════════
  private showGrid(): void {
    this.gridContainer.removeAll(true);

    switch (this.activeTab) {
      case 'mine':
        this.buildMyCharsGrid();
        break;
      case 'community':
        this.buildCommunityGrid();
        break;
    }
  }

  private buildMyCharsGrid(): void {
    const L = this.L;
    const customs = CharacterStorage.getAll();
    const cardS = 100;
    const gap = 15;
    const spacing = cardS + gap;
    const y = L.y(0.26);

    if (customs.length === 0) {
      const emptyText = this.add.text(L.cx, y, 'No custom characters yet.\nTap "+ CREATE" to make one!', {
        fontSize: L.fontSize('small'), fontFamily: 'Arial', color: THEME.textSecondary,
        align: 'center',
      }).setOrigin(0.5);
      this.gridContainer.add(emptyText);
      return;
    }

    const totalW = (customs.length - 1) * spacing;
    const startX = L.cx - totalW / 2;

    customs.forEach((char, i) => {
      const x = startX + i * spacing;
      this.createCharCard(x, y, char.name, char, { type: 'custom', data: char });
    });
  }

  private buildCommunityGrid(): void {
    const L = this.L;
    const cardS = 100;
    const gap = 15;
    const spacing = cardS + gap;
    const y = L.y(0.26);

    if (this.communityChars.length === 0) {
      const loadingText = this.add.text(L.cx, y, 'Loading community...', {
        fontSize: L.fontSize('small'), fontFamily: 'Arial', color: THEME.textSecondary,
      }).setOrigin(0.5);
      this.gridContainer.add(loadingText);

      CharacterApi.getPublic().then((chars) => {
        this.communityChars = chars;
        if (this.activeTab === 'community') {
          this.showGrid();
        }
      });
      return;
    }

    const visibleChars = this.communityChars.slice(0, 6);
    const totalW = (visibleChars.length - 1) * spacing;
    const startX = L.cx - totalW / 2;

    if (visibleChars.length === 0) {
      const text = this.add.text(L.cx, y, 'No community characters yet.', {
        fontSize: L.fontSize('small'), fontFamily: 'Arial', color: THEME.textSecondary,
      }).setOrigin(0.5);
      this.gridContainer.add(text);
      return;
    }

    visibleChars.forEach((char, i) => {
      const x = startX + i * spacing;
      this.createCharCard(x, y, char.name, char as unknown as CharacterDef, { type: 'custom', data: char as unknown as CustomCharacterDef });
    });
  }

  private createCharCard(x: number, y: number, name: string, charDef: CharacterDef, ref: CharacterRef): void {
    const cardS = 100;
    const cardH = cardS * 0.92;
    const radius = 12;
    const container = this.add.container(x, y);
    this.gridContainer.add(container);

    const isSelected = this.isRefSelected(ref);
    const borderColor = isSelected ? (this.activePlayer === 1 ? THEME.primary : 0xff4444) : THEME.cardBorder;

    const gfx = this.add.graphics();
    // Glow for selected
    if (isSelected) {
      gfx.fillStyle(borderColor, 0.15);
      gfx.fillRoundedRect(-cardS / 2 - 3, -cardH / 2 - 3, cardS + 6, cardH + 6, radius + 2);
    }
    gfx.fillStyle(THEME.cardBg, 1);
    gfx.fillRoundedRect(-cardS / 2, -cardH / 2, cardS, cardH, radius);
    gfx.lineStyle(isSelected ? 3 : 2, borderColor, 1);
    gfx.strokeRoundedRect(-cardS / 2, -cardH / 2, cardS, cardH, radius);
    container.add(gfx);

    // Invisible hit area
    const hitArea = this.add.rectangle(0, 0, cardS, cardH, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });
    container.add(hitArea);

    const appearance: Appearance = charDef.appearance ?? defaultAppearanceForPreset(charDef.id);
    const miniScale = cardS / 200;
    const preview = CharacterRenderer.renderMiniPreview(this, appearance, 0, -cardS * 0.1, miniScale);
    container.add(preview);

    const nameLabel = this.add.text(0, cardS * 0.35, name, {
      fontSize: this.L.fontSize('tiny'), fontFamily: 'Arial', color: '#cccccc',
    }).setOrigin(0.5);
    container.add(nameLabel);

    hitArea.on('pointerdown', () => {
      if (this.activePlayer === 1) {
        this.selection1 = ref;
      } else {
        this.selection2 = ref;
      }
      this.showGrid();
      this.updatePreview();
    });

    hitArea.on('pointerover', () => {
      if (!isSelected) {
        gfx.clear();
        gfx.fillStyle(0x2a2a6a, 1);
        gfx.fillRoundedRect(-cardS / 2, -cardH / 2, cardS, cardH, radius);
        gfx.lineStyle(2, THEME.cardBorder, 1);
        gfx.strokeRoundedRect(-cardS / 2, -cardH / 2, cardS, cardH, radius);
      }
    });
    hitArea.on('pointerout', () => {
      if (!isSelected) {
        gfx.clear();
        gfx.fillStyle(THEME.cardBg, 1);
        gfx.fillRoundedRect(-cardS / 2, -cardH / 2, cardS, cardH, radius);
        gfx.lineStyle(2, THEME.cardBorder, 1);
        gfx.strokeRoundedRect(-cardS / 2, -cardH / 2, cardS, cardH, radius);
      }
    });
  }

  private isRefSelected(ref: CharacterRef): boolean {
    const sel = this.activePlayer === 1 ? this.selection1 : this.selection2;
    if (sel.type !== ref.type) return false;
    if (sel.type === 'preset' && ref.type === 'preset') return sel.id === ref.id;
    if (sel.type === 'custom' && ref.type === 'custom') return sel.data.id === ref.data.id;
    return false;
  }

  // ════════════════════════════════════════════════════
  // PREVIEW
  // ════════════════════════════════════════════════════
  private updatePreview(): void {
    const ref = this.activePlayer === 1 ? this.selection1 : this.selection2;
    let char: CharacterDef;
    if (ref.type === 'preset') {
      char = CHARACTERS.find(c => c.id === ref.id) ?? CHARACTERS[0];
    } else {
      char = ref.data;
    }

    this.nameText.setText(char.name);
    const rgb = Phaser.Display.Color.IntegerToRGB(char.color);
    this.nameText.setColor(`rgb(${rgb.r},${rgb.g},${rgb.b})`);

    const bar = (val: number) => '\u2588'.repeat(val) + '\u2591'.repeat(10 - val);
    this.statsTexts.speed.setText(`SPD ${bar(char.stats.speed)} ${char.stats.speed}`);
    this.statsTexts.power.setText(`PWR ${bar(char.stats.power)} ${char.stats.power}`);
    this.statsTexts.defense.setText(`DEF ${bar(char.stats.defense)} ${char.stats.defense}`);

    const superInfo = SUPER_MOVES.find(m => m.id === char.superMove);
    this.superText.setText(`Super: ${char.superDescription || (superInfo ? `${superInfo.displayName} \u2014 ${superInfo.description}` : '')}`);
  }

  // ════════════════════════════════════════════════════
  // CONFIRM
  // ════════════════════════════════════════════════════
  private confirmSelection(): void {
    if (this.mode === 'cpu') {
      const cpuIndex = Math.floor(Math.random() * CHARACTERS.length);
      transitionTo(this, 'VsScreen', {
        charRef1: this.selection1,
        charRef2: { type: 'preset' as const, id: CHARACTERS[cpuIndex].id },
        targetScene: 'CpuGame',
      });
    } else {
      transitionTo(this, 'OnlineHub', { charRef: this.selection1 });
    }
  }
}
