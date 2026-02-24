import Phaser from 'phaser';
import {
  GAME_WIDTH, GAME_HEIGHT, CHARACTERS,
  SUPER_MOVES,
  defaultAppearanceForPreset,
} from '@pyrgo/shared';
import type { CharacterDef, CharacterRef, CustomCharacterDef, Appearance } from '@pyrgo/shared';
import { CharacterRenderer } from '../rendering/CharacterRenderer';
import { CharacterStorage } from '../storage/CharacterStorage';
import { CharacterApi, type PublishedCharacter } from '../api/CharacterApi';
import { transitionTo, fadeIn } from '../utils/SceneTransition';
import { createButton } from '../ui/ButtonFactory';
import { setupResponsiveCamera, getViewEdges } from '../utils/responsive';

type SelectTab = 'mine' | 'preset' | 'community';

export class CharSelectScene extends Phaser.Scene {
  private mode: 'local' | 'online' | 'cpu' = 'local';
  private activePlayer = 1; // which player is choosing (1 or 2)
  private activeTab: SelectTab = 'preset';
  private communityChars: PublishedCharacter[] = [];

  // Selections stored as CharacterRef
  private selection1: CharacterRef = { type: 'preset', id: 1 };
  private selection2: CharacterRef = { type: 'preset', id: 2 };

  // UI containers
  private gridContainer!: Phaser.GameObjects.Container;
  private previewContainer!: Phaser.GameObjects.Container;
  private tabButtons: Map<SelectTab, { bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }> = new Map();
  private selectionIndicator!: Phaser.GameObjects.Text;
  private nameText!: Phaser.GameObjects.Text;
  private statsTexts!: { speed: Phaser.GameObjects.Text; power: Phaser.GameObjects.Text; defense: Phaser.GameObjects.Text };
  private superText!: Phaser.GameObjects.Text;

  constructor() {
    super('CharSelect');
  }

  init(data: { mode?: 'local' | 'online' | 'cpu' }): void {
    this.mode = data.mode ?? 'local';
    this.activePlayer = 1;
    this.selection1 = { type: 'preset', id: 1 };
    this.selection2 = { type: 'preset', id: 2 };
    // Default to "mine" tab if user has custom characters, else "preset"
    this.activeTab = CharacterStorage.count() > 0 ? 'mine' : 'preset';
  }

  create(): void {
    setupResponsiveCamera(this);
    fadeIn(this);
    const edges = getViewEdges(this);

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x1a1a2e);

    // Title
    this.add.text(GAME_WIDTH / 2, edges.top + 8, 'SELECT YOUR FIGHTER', {
      fontSize: '22px', fontFamily: 'Arial Black, Arial', color: '#00ccff',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5);

    // Selection indicator
    this.selectionIndicator = this.add.text(GAME_WIDTH / 2, edges.top + 28, 'Player 1 \u2014 Choose!', {
      fontSize: '14px', fontFamily: 'Arial', color: '#ffaa00',
    }).setOrigin(0.5);

    // ── Tabs ─────────────────────────────────────
    this.createTabs();

    // ── Character grid ───────────────────────────
    this.gridContainer = this.add.container(0, 0);
    this.showGrid();

    // ── Preview area ─────────────────────────────
    this.previewContainer = this.add.container(GAME_WIDTH / 2, 340);

    this.nameText = this.add.text(0, -55, '', {
      fontSize: '22px', fontFamily: 'Arial Black, Arial', color: '#ffffff',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);
    this.previewContainer.add(this.nameText);

    const statsX = -180;
    this.statsTexts = {
      speed: this.add.text(statsX, -25, '', { fontSize: '14px', fontFamily: 'Arial', color: '#ffffff' }),
      power: this.add.text(statsX, -3, '', { fontSize: '14px', fontFamily: 'Arial', color: '#ffffff' }),
      defense: this.add.text(statsX, 19, '', { fontSize: '14px', fontFamily: 'Arial', color: '#ffffff' }),
    };
    this.previewContainer.add(this.statsTexts.speed);
    this.previewContainer.add(this.statsTexts.power);
    this.previewContainer.add(this.statsTexts.defense);

    this.superText = this.add.text(0, 45, '', {
      fontSize: '11px', fontFamily: 'Arial', color: '#aaaacc', wordWrap: { width: 380 },
    }).setOrigin(0.5);
    this.previewContainer.add(this.superText);

    this.updatePreview();

    // ── Bottom buttons ───────────────────────────
    createButton(this, GAME_WIDTH / 2, edges.bottom - 18, 'CONFIRM', () => this.confirmSelection(), {
      width: 160, height: 36, fillColor: 0x00aa44, strokeColor: 0x00ff66,
    });

    createButton(this, edges.left + 55, edges.bottom - 18, '\u2190 BACK', () => transitionTo(this, 'MainMenu'), {
      width: 80, height: 30, fontSize: '12px', strokeColor: 0x666666,
    });

    createButton(this, edges.right - 70, edges.bottom - 18, '+ CREATE', () => {
      transitionTo(this, 'CharacterCreator', { returnTo: 'CharSelect' });
    }, {
      width: 110, height: 30, fontSize: '12px', fillColor: 0x225588, strokeColor: 0x44aaff,
    });
  }

  // ════════════════════════════════════════════════════
  // TABS
  // ════════════════════════════════════════════════════
  private createTabs(): void {
    const tabs: { key: SelectTab; label: string }[] = [
      { key: 'mine', label: 'I MIEI' },
      { key: 'preset', label: 'PRESET' },
      { key: 'community', label: 'COMMUNITY' },
    ];

    const tabW = 110;
    const startX = GAME_WIDTH / 2 - (tabs.length * (tabW + 6)) / 2 + tabW / 2;
    const tabEdges = getViewEdges(this);
    const y = tabEdges.top + 42;

    tabs.forEach((tab, i) => {
      const x = startX + i * (tabW + 6);
      const bg = this.add.rectangle(x, y, tabW, 24, 0x2a2a4e);
      bg.setStrokeStyle(1, 0x444466);
      bg.setInteractive({ useHandCursor: true });

      const label = this.add.text(x, y, tab.label, {
        fontSize: '11px', fontFamily: 'Arial', color: '#aaaacc',
      }).setOrigin(0.5);

      bg.on('pointerdown', () => {
        this.activeTab = tab.key;
        this.updateTabVisuals();
        this.showGrid();
      });
      bg.on('pointerover', () => { if (this.activeTab !== tab.key) bg.setFillStyle(0x3a3a6e); });
      bg.on('pointerout', () => { if (this.activeTab !== tab.key) bg.setFillStyle(0x2a2a4e); });

      this.tabButtons.set(tab.key, { bg, label });
    });

    this.updateTabVisuals();
  }

  private updateTabVisuals(): void {
    this.tabButtons.forEach((btn, key) => {
      if (key === this.activeTab) {
        btn.bg.setFillStyle(0x00ccff);
        btn.label.setColor('#000000');
      } else {
        btn.bg.setFillStyle(0x2a2a4e);
        btn.label.setColor('#aaaacc');
      }
    });
  }

  // ════════════════════════════════════════════════════
  // CHARACTER GRID
  // ════════════════════════════════════════════════════
  private showGrid(): void {
    this.gridContainer.removeAll(true);

    switch (this.activeTab) {
      case 'preset':
        this.buildPresetGrid();
        break;
      case 'mine':
        this.buildMyCharsGrid();
        break;
      case 'community':
        this.buildCommunityGrid();
        break;
    }
  }

  private buildPresetGrid(): void {
    const spacing = 120;
    const startX = 90;
    const y = 150;

    CHARACTERS.forEach((char, i) => {
      const x = startX + i * spacing;
      this.createCharCard(x, y, char.name, char, { type: 'preset', id: char.id });
    });
  }

  private buildMyCharsGrid(): void {
    const customs = CharacterStorage.getAll();
    const spacing = 120;
    const startX = 90;
    const y = 150;

    if (customs.length === 0) {
      const emptyText = this.add.text(GAME_WIDTH / 2, y, 'No custom characters yet.\nTap "+ CREATE" to make one!', {
        fontSize: '14px', fontFamily: 'Arial', color: '#666688',
        align: 'center',
      }).setOrigin(0.5);
      this.gridContainer.add(emptyText);
      return;
    }

    customs.forEach((char, i) => {
      const x = startX + i * spacing;
      this.createCharCard(x, y, char.name, char, { type: 'custom', data: char });
    });
  }

  private buildCommunityGrid(): void {
    if (this.communityChars.length === 0) {
      const loadingText = this.add.text(GAME_WIDTH / 2, 150, 'Loading community...', {
        fontSize: '14px', fontFamily: 'Arial', color: '#666688',
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

    const spacing = 120;
    const startX = 90;
    const y = 150;

    if (this.communityChars.length === 0) {
      const text = this.add.text(GAME_WIDTH / 2, y, 'No community characters yet.', {
        fontSize: '14px', fontFamily: 'Arial', color: '#666688',
      }).setOrigin(0.5);
      this.gridContainer.add(text);
      return;
    }

    this.communityChars.slice(0, 6).forEach((char, i) => {
      const x = startX + i * spacing;
      this.createCharCard(x, y, char.name, char as unknown as CharacterDef, { type: 'custom', data: char as unknown as CustomCharacterDef });
    });
  }

  private createCharCard(x: number, y: number, name: string, charDef: CharacterDef, ref: CharacterRef): void {
    const container = this.add.container(x, y);
    this.gridContainer.add(container);

    const isSelected = this.isRefSelected(ref);

    const bg = this.add.rectangle(0, 0, 105, 90, 0x2a2a4e);
    bg.setStrokeStyle(2, isSelected ? (this.activePlayer === 1 ? 0x00ccff : 0xff4444) : 0x444466);
    bg.setInteractive({ useHandCursor: true });
    container.add(bg);

    const appearance: Appearance = charDef.appearance ?? defaultAppearanceForPreset(charDef.id);
    const preview = CharacterRenderer.renderMiniPreview(this, appearance, 0, -10, 0.5);
    container.add(preview);

    const nameLabel = this.add.text(0, 35, name, {
      fontSize: '10px', fontFamily: 'Arial', color: '#cccccc',
    }).setOrigin(0.5);
    container.add(nameLabel);

    bg.on('pointerdown', () => {
      if (this.activePlayer === 1) {
        this.selection1 = ref;
      } else {
        this.selection2 = ref;
      }
      this.showGrid();
      this.updatePreview();
    });

    bg.on('pointerover', () => { if (!isSelected) bg.setFillStyle(0x3a3a6e); });
    bg.on('pointerout', () => { if (!isSelected) bg.setFillStyle(0x2a2a4e); });
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
    if (this.mode === 'local') {
      if (this.activePlayer === 1) {
        this.activePlayer = 2;
        this.selectionIndicator.setText('Player 2 \u2014 Choose!');
        this.selectionIndicator.setColor('#ff4444');
        this.showGrid();
        this.updatePreview();
      } else {
        // Route through VS screen
        transitionTo(this, 'VsScreen', {
          charRef1: this.selection1,
          charRef2: this.selection2,
          targetScene: 'LocalGame',
        });
      }
    } else if (this.mode === 'cpu') {
      const cpuIndex = Math.floor(Math.random() * CHARACTERS.length);
      // Route through VS screen
      transitionTo(this, 'VsScreen', {
        charRef1: this.selection1,
        charRef2: { type: 'preset' as const, id: CHARACTERS[cpuIndex].id },
        targetScene: 'CpuGame',
      });
    } else {
      // Online — single selection, go to OnlineHub
      transitionTo(this, 'OnlineHub', { charRef: this.selection1 });
    }
  }
}
