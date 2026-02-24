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

type SelectTab = 'mine' | 'preset' | 'community';

export class CharSelectScene extends Phaser.Scene {
  private L!: LayoutManager;

  private mode: 'local' | 'online' | 'cpu' = 'local';
  private activePlayer = 1;
  private activeTab: SelectTab = 'preset';
  private communityChars: PublishedCharacter[] = [];

  private selection1: CharacterRef = { type: 'preset', id: 1 };
  private selection2: CharacterRef = { type: 'preset', id: 2 };

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
    this.activeTab = CharacterStorage.count() > 0 ? 'mine' : 'preset';
  }

  create(): void {
    fadeIn(this);
    this.L = new LayoutManager(this);
    const L = this.L;

    this.add.rectangle(L.cx, L.cy, L.w, L.h, 0x1a1a2e);

    // Title
    this.add.text(L.cx, L.y(0.06), 'SELECT YOUR FIGHTER', {
      fontSize: '24px', fontFamily: 'Arial Black, Arial', color: '#00ccff',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5);

    // Selection indicator
    this.selectionIndicator = this.add.text(L.cx, L.y(0.095), 'Player 1 \u2014 Choose!', {
      fontSize: L.fontSize('tiny'), fontFamily: 'Arial', color: '#ffaa00',
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
      fontSize: '15px', fontFamily: 'Arial', color: '#aaaacc', wordWrap: { width: 500 },
    }).setOrigin(0.5);
    this.previewContainer.add(this.superText);

    this.updatePreview();

    // ── Bottom buttons (compact) ──────────────────
    createButton(this, L.cx, L.y(0.82), 'CONFIRM', () => this.confirmSelection(), {
      width: 180, height: 36, fillColor: 0x00aa44, strokeColor: 0x00ff66,
      fontSize: '16px',
    });

    createButton(this, L.x(0.12), L.y(0.82), '\u2190 BACK', () => transitionTo(this, 'MainMenu'), {
      width: 120, height: 36, fontSize: '13px', strokeColor: 0x666666,
    });

    createButton(this, L.x(0.88), L.y(0.82), '+ CREATE', () => {
      transitionTo(this, 'CharacterCreator', { returnTo: 'CharSelect' });
    }, {
      width: 140, height: 36, fontSize: '13px', fillColor: 0x225588, strokeColor: 0x44aaff,
    });
  }

  // ════════════════════════════════════════════════════
  // TABS
  // ════════════════════════════════════════════════════
  private createTabs(): void {
    const L = this.L;
    const tabs: { key: SelectTab; label: string }[] = [
      { key: 'mine', label: 'I MIEI' },
      { key: 'preset', label: 'PRESET' },
      { key: 'community', label: 'COMMUNITY' },
    ];

    const tabW = L.w * 0.12;
    const tabH = 28;
    const gap = L.pad(0.5);
    const startX = L.cx - (tabs.length * (tabW + gap)) / 2 + tabW / 2;
    const y = L.y(0.13);

    tabs.forEach((tab, i) => {
      const x = startX + i * (tabW + gap);
      const bg = this.add.rectangle(x, y, tabW, tabH, 0x2a2a4e);
      bg.setStrokeStyle(1, 0x444466);
      bg.setInteractive({ useHandCursor: true });

      const label = this.add.text(x, y, tab.label, {
        fontSize: L.fontSize('tiny'), fontFamily: 'Arial', color: '#aaaacc',
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
    const L = this.L;
    const count = CHARACTERS.length;
    const cardS = 100;
    const gap = 15;
    const spacing = cardS + gap;
    const totalW = (count - 1) * spacing;
    const startX = L.cx - totalW / 2;
    const y = L.y(0.26);

    CHARACTERS.forEach((char, i) => {
      const x = startX + i * spacing;
      this.createCharCard(x, y, char.name, char, { type: 'preset', id: char.id });
    });
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
        fontSize: L.fontSize('small'), fontFamily: 'Arial', color: '#666688',
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
        fontSize: L.fontSize('small'), fontFamily: 'Arial', color: '#666688',
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
        fontSize: L.fontSize('small'), fontFamily: 'Arial', color: '#666688',
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
    const L = this.L;
    const cardS = 100;
    const container = this.add.container(x, y);
    this.gridContainer.add(container);

    const isSelected = this.isRefSelected(ref);

    const bg = this.add.rectangle(0, 0, cardS, cardS * 0.92, 0x2a2a4e);
    bg.setStrokeStyle(2, isSelected ? (this.activePlayer === 1 ? 0x00ccff : 0xff4444) : 0x444466);
    bg.setInteractive({ useHandCursor: true });
    container.add(bg);

    const appearance: Appearance = charDef.appearance ?? defaultAppearanceForPreset(charDef.id);
    const miniScale = cardS / 200;
    const preview = CharacterRenderer.renderMiniPreview(this, appearance, 0, -cardS * 0.1, miniScale);
    container.add(preview);

    const nameLabel = this.add.text(0, cardS * 0.35, name, {
      fontSize: L.fontSize('tiny'), fontFamily: 'Arial', color: '#cccccc',
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
        transitionTo(this, 'VsScreen', {
          charRef1: this.selection1,
          charRef2: this.selection2,
          targetScene: 'LocalGame',
        });
      }
    } else if (this.mode === 'cpu') {
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
