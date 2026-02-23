import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, SUPER_MOVES, defaultAppearanceForPreset } from '@pyrgo/shared';
import type { Appearance } from '@pyrgo/shared';
import { CharacterRenderer } from '../rendering/CharacterRenderer';
import { CharacterApi, type PublishedCharacter } from '../api/CharacterApi';
import { getDeviceId } from '../storage/DeviceId';
import { transitionTo, fadeIn } from '../utils/SceneTransition';
import { createButton } from '../ui/ButtonFactory';
import { showToast } from '../ui/ToastNotification';

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
    this.page = 0;
    this.selectedChar = null;

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0d0d1a);

    // Title
    this.add.text(GAME_WIDTH / 2, 18, 'COMMUNITY PLAYERS', {
      fontSize: '22px', fontFamily: 'Arial Black, Arial', color: '#00ccff',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);

    // Status text (loading / error)
    this.statusText = this.add.text(GAME_WIDTH / 2, 200, 'Loading...', {
      fontSize: '16px', fontFamily: 'Arial', color: '#888899',
    }).setOrigin(0.5);

    // Grid container
    this.gridContainer = this.add.container(0, 0);

    // Detail container (right side when character selected)
    this.detailContainer = this.add.container(0, 0);

    // Page navigation
    this.pageText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 55, '', {
      fontSize: '12px', fontFamily: 'Arial', color: '#888899',
    }).setOrigin(0.5);

    const prevBg = this.add.rectangle(GAME_WIDTH / 2 - 60, GAME_HEIGHT - 55, 40, 24, 0x333355);
    prevBg.setInteractive({ useHandCursor: true });
    this.add.text(GAME_WIDTH / 2 - 60, GAME_HEIGHT - 55, '<', {
      fontSize: '14px', fontFamily: 'Arial', color: '#ffffff',
    }).setOrigin(0.5);
    prevBg.on('pointerdown', () => {
      if (this.page > 0) { this.page--; this.showGrid(); }
    });

    const nextBg = this.add.rectangle(GAME_WIDTH / 2 + 60, GAME_HEIGHT - 55, 40, 24, 0x333355);
    nextBg.setInteractive({ useHandCursor: true });
    this.add.text(GAME_WIDTH / 2 + 60, GAME_HEIGHT - 55, '>', {
      fontSize: '14px', fontFamily: 'Arial', color: '#ffffff',
    }).setOrigin(0.5);
    nextBg.on('pointerdown', () => {
      const maxPage = Math.max(0, Math.ceil(this.characters.length / CARDS_PER_PAGE) - 1);
      if (this.page < maxPage) { this.page++; this.showGrid(); }
    });

    // Back button
    createButton(this, 55, GAME_HEIGHT - 25, '\u2190 BACK', () => transitionTo(this, 'MainMenu'), {
      width: 80, height: 30, fontSize: '12px', strokeColor: 0x666666,
    });

    // Fetch characters
    this.fetchCharacters();
  }

  private showSkeletonLoading(): void {
    this.gridContainer.removeAll(true);
    const spacing = 120;
    const startX = 90;
    const y = 130;

    for (let i = 0; i < 6; i++) {
      const x = startX + i * spacing;
      const container = this.add.container(x, y);
      this.gridContainer.add(container);

      const bg = this.add.rectangle(0, 0, 105, 90, 0x222244, 0.6);
      bg.setStrokeStyle(1, 0x333355);
      container.add(bg);

      // Shimmer animation
      const shimmer = this.add.rectangle(0, 0, 105, 90, 0x333366, 0);
      container.add(shimmer);
      this.tweens.add({
        targets: shimmer,
        alpha: { from: 0, to: 0.3 },
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: i * 100,
      });

      // Skeleton head circle
      const head = this.add.arc(0, -15, 10, 0, 360, false, 0x333355, 0.5);
      container.add(head);

      // Skeleton body
      const body = this.add.rectangle(0, 5, 20, 25, 0x333355, 0.5);
      container.add(body);

      // Skeleton name bar
      const nameBar = this.add.rectangle(0, 35, 50, 8, 0x333355, 0.5);
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

    const spacing = 120;
    const startX = 90;
    const y = 130;

    pageChars.forEach((char, i) => {
      const x = startX + (i % 6) * spacing;
      this.createCharCard(x, y, char);
    });
  }

  private createCharCard(x: number, y: number, char: PublishedCharacter): void {
    const container = this.add.container(x, y);
    this.gridContainer.add(container);

    const bg = this.add.rectangle(0, 0, 105, 90, 0x2a2a4e);
    bg.setStrokeStyle(2, 0x444466);
    bg.setInteractive({ useHandCursor: true });
    container.add(bg);

    // Mini preview
    const appearance: Appearance = char.appearance ?? defaultAppearanceForPreset(char.id);
    const preview = CharacterRenderer.renderMiniPreview(this, appearance, 0, -10, 0.5);
    container.add(preview);

    // Name
    const name = this.add.text(0, 32, char.name, {
      fontSize: '10px', fontFamily: 'Arial', color: '#cccccc',
    }).setOrigin(0.5);
    container.add(name);

    bg.on('pointerdown', () => this.showDetail(char));
    bg.on('pointerover', () => bg.setFillStyle(0x3a3a6e));
    bg.on('pointerout', () => bg.setFillStyle(0x2a2a4e));
  }

  private showDetail(char: PublishedCharacter): void {
    this.detailContainer.removeAll(true);
    this.selectedChar = char;

    const px = GAME_WIDTH / 2;
    const startY = 220;

    // Name
    const nameText = this.add.text(px, startY, char.name, {
      fontSize: '20px', fontFamily: 'Arial Black, Arial', color: '#ffffff',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);
    this.detailContainer.add(nameText);

    // Stats
    const bar = (val: number) => '\u2588'.repeat(val) + '\u2591'.repeat(10 - val);
    const statsY = startY + 28;
    const statsX = px - 120;
    const stats = [
      `SPD ${bar(char.stats.speed)} ${char.stats.speed}`,
      `PWR ${bar(char.stats.power)} ${char.stats.power}`,
      `DEF ${bar(char.stats.defense)} ${char.stats.defense}`,
    ];
    stats.forEach((s, i) => {
      const t = this.add.text(statsX, statsY + i * 18, s, {
        fontSize: '12px', fontFamily: 'Arial', color: '#aaaacc',
      });
      this.detailContainer.add(t);
    });

    // Super move
    const superInfo = SUPER_MOVES.find(m => m.id === char.superMove);
    if (superInfo) {
      const superText = this.add.text(px, statsY + 60, `Super: ${superInfo.displayName} \u2014 ${superInfo.description}`, {
        fontSize: '10px', fontFamily: 'Arial', color: '#888899',
        wordWrap: { width: 350 },
      }).setOrigin(0.5);
      this.detailContainer.add(superText);
    }

    // If this is the user's character, show delete/make private buttons
    const isOwner = char.creatorDeviceId === getDeviceId();
    if (isOwner) {
      const toggleBg = this.add.rectangle(px - 60, statsY + 90, 100, 26, 0x442266);
      toggleBg.setStrokeStyle(1, 0x8844cc);
      toggleBg.setInteractive({ useHandCursor: true });
      const toggleText = this.add.text(px - 60, statsY + 90, 'MAKE PRIVATE', {
        fontSize: '10px', fontFamily: 'Arial', color: '#ffffff',
      }).setOrigin(0.5);
      this.detailContainer.add(toggleBg);
      this.detailContainer.add(toggleText);

      toggleBg.on('pointerdown', async () => {
        await CharacterApi.toggleVisibility(char.serverId, false);
        this.fetchCharacters();
      });

      const delBg = this.add.rectangle(px + 60, statsY + 90, 80, 26, 0x664444);
      delBg.setStrokeStyle(1, 0x884444);
      delBg.setInteractive({ useHandCursor: true });
      const delText = this.add.text(px + 60, statsY + 90, 'DELETE', {
        fontSize: '10px', fontFamily: 'Arial', color: '#ff4444',
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
