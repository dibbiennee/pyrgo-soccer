import Phaser from 'phaser';
import { SUPER_MOVES, defaultAppearanceForPreset } from '@pyrgo/shared';
import type { Appearance } from '@pyrgo/shared';
import { CharacterRenderer } from '../rendering/CharacterRenderer';
import { CharacterApi, type PublishedCharacter } from '../api/CharacterApi';
import { getDeviceId } from '../storage/DeviceId';
import { transitionTo, fadeIn } from '../utils/SceneTransition';
import { createButton } from '../ui/ButtonFactory';
import { CANVAS_W, CANVAS_H } from '../utils/responsive';

const CARDS_PER_PAGE = 6;

export class CommunityGalleryScene extends Phaser.Scene {
  private characters: PublishedCharacter[] = [];
  private page = 0;
  private loading = true;
  private gridContainer!: Phaser.GameObjects.Container;
  private detailContainer!: Phaser.GameObjects.Container;
  private pageText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private selectedChar: PublishedCharacter | null = null;

  constructor() {
    super('CommunityGallery');
  }

  create(): void {
    fadeIn(this);
    const W = CANVAS_W;
    const H = CANVAS_H;
    const cx = W / 2;
    this.page = 0;
    this.selectedChar = null;

    this.add.rectangle(cx, H / 2, W, H, 0x0d0d1a);

    // Title
    this.add.text(cx, 25, 'COMMUNITY PLAYERS', {
      fontSize: '28px', fontFamily: 'Arial Black, Arial', color: '#00ccff',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);

    // Status text (loading / error)
    this.statusText = this.add.text(cx, 280, 'Loading...', {
      fontSize: '18px', fontFamily: 'Arial', color: '#888899',
    }).setOrigin(0.5);

    // Grid container
    this.gridContainer = this.add.container(0, 0);

    // Detail container
    this.detailContainer = this.add.container(0, 0);

    // Page navigation
    const pageY = H - 65;
    this.pageText = this.add.text(cx, pageY, '', {
      fontSize: '14px', fontFamily: 'Arial', color: '#888899',
    }).setOrigin(0.5);

    const prevBg = this.add.rectangle(cx - 80, pageY, 50, 30, 0x333355);
    prevBg.setInteractive({ useHandCursor: true });
    this.add.text(cx - 80, pageY, '<', {
      fontSize: '16px', fontFamily: 'Arial', color: '#ffffff',
    }).setOrigin(0.5);
    prevBg.on('pointerdown', () => {
      if (this.page > 0) { this.page--; this.showGrid(); }
    });

    const nextBg = this.add.rectangle(cx + 80, pageY, 50, 30, 0x333355);
    nextBg.setInteractive({ useHandCursor: true });
    this.add.text(cx + 80, pageY, '>', {
      fontSize: '16px', fontFamily: 'Arial', color: '#ffffff',
    }).setOrigin(0.5);
    nextBg.on('pointerdown', () => {
      const maxPage = Math.max(0, Math.ceil(this.characters.length / CARDS_PER_PAGE) - 1);
      if (this.page < maxPage) { this.page++; this.showGrid(); }
    });

    // Back button
    createButton(this, 80, H - 30, '\u2190 BACK', () => transitionTo(this, 'MainMenu'), {
      width: 110, height: 36, fontSize: '14px', strokeColor: 0x666666,
    });

    // Fetch characters
    this.fetchCharacters();
  }

  private showSkeletonLoading(): void {
    this.gridContainer.removeAll(true);
    const spacing = 180;
    const totalW = 5 * spacing;
    const startX = CANVAS_W / 2 - totalW / 2;
    const y = 180;

    for (let i = 0; i < 6; i++) {
      const x = startX + i * spacing;
      const container = this.add.container(x, y);
      this.gridContainer.add(container);

      const bg = this.add.rectangle(0, 0, 120, 110, 0x222244, 0.6);
      bg.setStrokeStyle(1, 0x333355);
      container.add(bg);

      const shimmer = this.add.rectangle(0, 0, 120, 110, 0x333366, 0);
      container.add(shimmer);
      this.tweens.add({
        targets: shimmer,
        alpha: { from: 0, to: 0.3 },
        duration: 800, yoyo: true, repeat: -1,
        ease: 'Sine.easeInOut', delay: i * 100,
      });

      const head = this.add.arc(0, -18, 12, 0, 360, false, 0x333355, 0.5);
      container.add(head);
      const body = this.add.rectangle(0, 6, 24, 30, 0x333355, 0.5);
      container.add(body);
      const nameBar = this.add.rectangle(0, 40, 60, 10, 0x333355, 0.5);
      container.add(nameBar);
    }
  }

  private async fetchCharacters(): Promise<void> {
    this.loading = true;
    this.statusText.setVisible(false);
    this.showSkeletonLoading();

    this.characters = await CharacterApi.getPublic();
    this.loading = false;

    if (this.characters.length === 0) {
      this.gridContainer.removeAll(true);
      this.statusText.setVisible(true);
      this.statusText.setText('No community characters yet.\nBe the first to share one!');
    } else {
      this.statusText.setVisible(false);
      this.showGrid();
    }
  }

  private showGrid(): void {
    this.gridContainer.removeAll(true);
    this.detailContainer.removeAll(true);
    this.selectedChar = null;

    const startIdx = this.page * CARDS_PER_PAGE;
    const pageChars = this.characters.slice(startIdx, startIdx + CARDS_PER_PAGE);
    const totalPages = Math.max(1, Math.ceil(this.characters.length / CARDS_PER_PAGE));
    this.pageText.setText(`Page ${this.page + 1} / ${totalPages}`);

    const spacing = 180;
    const totalW = (Math.min(pageChars.length, 6) - 1) * spacing;
    const startX = CANVAS_W / 2 - totalW / 2;
    const y = 180;

    pageChars.forEach((char, i) => {
      const x = startX + (i % 6) * spacing;
      this.createCharCard(x, y, char);
    });
  }

  private createCharCard(x: number, y: number, char: PublishedCharacter): void {
    const container = this.add.container(x, y);
    this.gridContainer.add(container);

    const bg = this.add.rectangle(0, 0, 120, 110, 0x2a2a4e);
    bg.setStrokeStyle(2, 0x444466);
    bg.setInteractive({ useHandCursor: true });
    container.add(bg);

    const appearance: Appearance = char.appearance ?? defaultAppearanceForPreset(char.id);
    const preview = CharacterRenderer.renderMiniPreview(this, appearance, 0, -12, 0.6);
    container.add(preview);

    const name = this.add.text(0, 40, char.name, {
      fontSize: '12px', fontFamily: 'Arial', color: '#cccccc',
    }).setOrigin(0.5);
    container.add(name);

    bg.on('pointerdown', () => this.showDetail(char));
    bg.on('pointerover', () => bg.setFillStyle(0x3a3a6e));
    bg.on('pointerout', () => bg.setFillStyle(0x2a2a4e));
  }

  private showDetail(char: PublishedCharacter): void {
    this.detailContainer.removeAll(true);
    this.selectedChar = char;
    const cx = CANVAS_W / 2;
    const startY = 340;

    const nameText = this.add.text(cx, startY, char.name, {
      fontSize: '24px', fontFamily: 'Arial Black, Arial', color: '#ffffff',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);
    this.detailContainer.add(nameText);

    const bar = (val: number) => '\u2588'.repeat(val) + '\u2591'.repeat(10 - val);
    const statsY = startY + 35;
    const statsX = cx - 160;
    const stats = [
      `SPD ${bar(char.stats.speed)} ${char.stats.speed}`,
      `PWR ${bar(char.stats.power)} ${char.stats.power}`,
      `DEF ${bar(char.stats.defense)} ${char.stats.defense}`,
    ];
    stats.forEach((s, i) => {
      const t = this.add.text(statsX, statsY + i * 22, s, {
        fontSize: '14px', fontFamily: 'Arial', color: '#aaaacc',
      });
      this.detailContainer.add(t);
    });

    const superInfo = SUPER_MOVES.find(m => m.id === char.superMove);
    if (superInfo) {
      const superText = this.add.text(cx, statsY + 80, `Super: ${superInfo.displayName} \u2014 ${superInfo.description}`, {
        fontSize: '14px', fontFamily: 'Arial', color: '#888899',
        wordWrap: { width: 500 },
      }).setOrigin(0.5);
      this.detailContainer.add(superText);
    }

    const isOwner = char.creatorDeviceId === getDeviceId();
    if (isOwner) {
      const toggleBg = this.add.rectangle(cx - 80, statsY + 120, 130, 32, 0x442266);
      toggleBg.setStrokeStyle(1, 0x8844cc);
      toggleBg.setInteractive({ useHandCursor: true });
      const toggleText = this.add.text(cx - 80, statsY + 120, 'MAKE PRIVATE', {
        fontSize: '12px', fontFamily: 'Arial', color: '#ffffff',
      }).setOrigin(0.5);
      this.detailContainer.add(toggleBg);
      this.detailContainer.add(toggleText);

      toggleBg.on('pointerdown', async () => {
        await CharacterApi.toggleVisibility(char.serverId, false);
        this.fetchCharacters();
      });

      const delBg = this.add.rectangle(cx + 80, statsY + 120, 100, 32, 0x664444);
      delBg.setStrokeStyle(1, 0x884444);
      delBg.setInteractive({ useHandCursor: true });
      const delText = this.add.text(cx + 80, statsY + 120, 'DELETE', {
        fontSize: '12px', fontFamily: 'Arial', color: '#ff4444',
      }).setOrigin(0.5);
      this.detailContainer.add(delBg);
      this.detailContainer.add(delText);

      delBg.on('pointerdown', async () => {
        await CharacterApi.remove(char.serverId);
        this.fetchCharacters();
      });
    }
  }
}
