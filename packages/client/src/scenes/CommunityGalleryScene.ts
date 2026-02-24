import Phaser from 'phaser';
import { SUPER_MOVES, defaultAppearanceForPreset } from '@pyrgo/shared';
import type { Appearance } from '@pyrgo/shared';
import { CharacterRenderer } from '../rendering/CharacterRenderer';
import { CharacterApi, type PublishedCharacter } from '../api/CharacterApi';
import { getDeviceId } from '../storage/DeviceId';
import { transitionTo, fadeIn } from '../utils/SceneTransition';
import { createButton } from '../ui/ButtonFactory';
import { LayoutManager } from '../utils/LayoutManager';
import { THEME, drawGradientBackground } from '../ui/UITheme';

const CARDS_PER_PAGE = 6;

export class CommunityGalleryScene extends Phaser.Scene {
  private L!: LayoutManager;
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
    const L = new LayoutManager(this);
    this.L = L;
    this.page = 0;
    this.selectedChar = null;

    drawGradientBackground(this);

    // Title
    this.add.text(L.cx, L.y(0.06), 'COMMUNITY', {
      fontSize: L.fontSize('heading'), fontFamily: 'Arial Black, Arial', color: THEME.primaryHex,
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);

    // Status text (loading / error)
    this.statusText = this.add.text(L.cx, L.cy, 'Loading...', {
      fontSize: L.fontSize('body'), fontFamily: 'Arial', color: THEME.textSecondary,
    }).setOrigin(0.5);

    // Grid container
    this.gridContainer = this.add.container(0, 0);

    // Detail container
    this.detailContainer = this.add.container(0, 0);

    // Page navigation
    const pageY = L.y(0.70);
    this.pageText = this.add.text(L.cx, pageY, '', {
      fontSize: L.fontSize('small'), fontFamily: 'Arial', color: THEME.textSecondary,
    }).setOrigin(0.5);

    const navBtnW = L.unit(0.06);
    const navBtnH = L.unit(0.04);
    const navRadius = 8;

    const prevGfx = this.add.graphics();
    prevGfx.fillStyle(THEME.cardBg, 1);
    prevGfx.fillRoundedRect(L.cx - L.unit(0.10) - navBtnW / 2, pageY - navBtnH / 2, navBtnW, navBtnH, navRadius);
    prevGfx.lineStyle(1, THEME.cardBorder, 1);
    prevGfx.strokeRoundedRect(L.cx - L.unit(0.10) - navBtnW / 2, pageY - navBtnH / 2, navBtnW, navBtnH, navRadius);
    const prevHit = this.add.rectangle(L.cx - L.unit(0.10), pageY, navBtnW, navBtnH, 0x000000, 0);
    prevHit.setInteractive({ useHandCursor: true });
    this.add.text(L.cx - L.unit(0.10), pageY, '<', {
      fontSize: L.fontSize('body'), fontFamily: 'Arial', color: '#ffffff',
    }).setOrigin(0.5);
    prevHit.on('pointerdown', () => {
      if (this.page > 0) { this.page--; this.showGrid(); }
    });

    const nextGfx = this.add.graphics();
    nextGfx.fillStyle(THEME.cardBg, 1);
    nextGfx.fillRoundedRect(L.cx + L.unit(0.10) - navBtnW / 2, pageY - navBtnH / 2, navBtnW, navBtnH, navRadius);
    nextGfx.lineStyle(1, THEME.cardBorder, 1);
    nextGfx.strokeRoundedRect(L.cx + L.unit(0.10) - navBtnW / 2, pageY - navBtnH / 2, navBtnW, navBtnH, navRadius);
    const nextHit = this.add.rectangle(L.cx + L.unit(0.10), pageY, navBtnW, navBtnH, 0x000000, 0);
    nextHit.setInteractive({ useHandCursor: true });
    this.add.text(L.cx + L.unit(0.10), pageY, '>', {
      fontSize: L.fontSize('body'), fontFamily: 'Arial', color: '#ffffff',
    }).setOrigin(0.5);
    nextHit.on('pointerdown', () => {
      const maxPage = Math.max(0, Math.ceil(this.characters.length / CARDS_PER_PAGE) - 1);
      if (this.page < maxPage) { this.page++; this.showGrid(); }
    });

    // Back button
    const btnSmall = L.button('small');
    createButton(this, L.x(0.08), L.y(0.78), '\u2190 BACK', () => transitionTo(this, 'MainMenu'), {
      width: btnSmall.width, height: btnSmall.height, fontSize: L.fontSize('small'), style: 'ghost',
    });

    // Fetch characters
    this.fetchCharacters();
  }

  private showSkeletonLoading(): void {
    this.gridContainer.removeAll(true);
    const L = this.L;
    const cardSize = L.cardSize();
    const cardGap = L.cardGap();
    const spacing = cardSize + cardGap;
    const totalW = 5 * spacing;
    const startX = L.cx - totalW / 2;
    const y = L.y(0.30);

    for (let i = 0; i < 6; i++) {
      const x = startX + i * spacing;
      const container = this.add.container(x, y);
      this.gridContainer.add(container);

      const cardH = cardSize * 0.92;
      const gfx = this.add.graphics();
      gfx.fillStyle(THEME.cardBg, 0.6);
      gfx.fillRoundedRect(-cardSize / 2, -cardH / 2, cardSize, cardH, 12);
      gfx.lineStyle(1, THEME.cardBorder, 1);
      gfx.strokeRoundedRect(-cardSize / 2, -cardH / 2, cardSize, cardH, 12);
      container.add(gfx);

      const shimmer = this.add.rectangle(0, 0, cardSize, cardH, 0x2a2a6a, 0);
      container.add(shimmer);
      this.tweens.add({
        targets: shimmer,
        alpha: { from: 0, to: 0.3 },
        duration: 800, yoyo: true, repeat: -1,
        ease: 'Sine.easeInOut', delay: i * 100,
      });

      const headR = cardSize * 0.1;
      const head = this.add.arc(0, -cardSize * 0.15, headR, 0, 360, false, THEME.cardBorder, 0.5);
      container.add(head);
      const body = this.add.rectangle(0, cardSize * 0.05, headR * 2, cardSize * 0.25, THEME.cardBorder, 0.5);
      container.add(body);
      const nameBar = this.add.rectangle(0, cardSize * 0.33, cardSize * 0.5, cardSize * 0.08, THEME.cardBorder, 0.5);
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

    const L = this.L;
    const startIdx = this.page * CARDS_PER_PAGE;
    const pageChars = this.characters.slice(startIdx, startIdx + CARDS_PER_PAGE);
    const totalPages = Math.max(1, Math.ceil(this.characters.length / CARDS_PER_PAGE));
    this.pageText.setText(`Page ${this.page + 1} / ${totalPages}`);

    const cardSize = L.cardSize();
    const cardGap = L.cardGap();
    const spacing = cardSize + cardGap;
    const totalW = (Math.min(pageChars.length, 6) - 1) * spacing;
    const startX = L.cx - totalW / 2;
    const y = L.y(0.30);

    pageChars.forEach((char, i) => {
      const x = startX + (i % 6) * spacing;
      this.createCharCard(x, y, char, cardSize);
    });
  }

  private createCharCard(x: number, y: number, char: PublishedCharacter, cardSize: number): void {
    const container = this.add.container(x, y);
    this.gridContainer.add(container);

    const cardH = cardSize * 0.92;
    const radius = 12;

    const gfx = this.add.graphics();
    gfx.fillStyle(THEME.cardBg, 1);
    gfx.fillRoundedRect(-cardSize / 2, -cardH / 2, cardSize, cardH, radius);
    gfx.lineStyle(2, THEME.cardBorder, 1);
    gfx.strokeRoundedRect(-cardSize / 2, -cardH / 2, cardSize, cardH, radius);
    container.add(gfx);

    // Invisible hit area
    const hitArea = this.add.rectangle(0, 0, cardSize, cardH, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });
    container.add(hitArea);

    const appearance: Appearance = char.appearance ?? defaultAppearanceForPreset(char.id);
    const previewScale = cardSize / 200;
    const preview = CharacterRenderer.renderMiniPreview(this, appearance, 0, -cardSize * 0.1, previewScale);
    container.add(preview);

    const name = this.add.text(0, cardSize * 0.33, char.name, {
      fontSize: this.L.fontSize('tiny'), fontFamily: 'Arial', color: '#cccccc',
    }).setOrigin(0.5);
    container.add(name);

    hitArea.on('pointerdown', () => this.showDetail(char));
    hitArea.on('pointerover', () => {
      gfx.clear();
      gfx.fillStyle(0x2a2a6a, 1);
      gfx.fillRoundedRect(-cardSize / 2, -cardH / 2, cardSize, cardH, radius);
      gfx.lineStyle(2, THEME.cardBorder, 1);
      gfx.strokeRoundedRect(-cardSize / 2, -cardH / 2, cardSize, cardH, radius);
    });
    hitArea.on('pointerout', () => {
      gfx.clear();
      gfx.fillStyle(THEME.cardBg, 1);
      gfx.fillRoundedRect(-cardSize / 2, -cardH / 2, cardSize, cardH, radius);
      gfx.lineStyle(2, THEME.cardBorder, 1);
      gfx.strokeRoundedRect(-cardSize / 2, -cardH / 2, cardSize, cardH, radius);
    });
  }

  private showDetail(char: PublishedCharacter): void {
    this.detailContainer.removeAll(true);
    this.selectedChar = char;
    const L = this.L;
    const startY = L.y(0.57);

    const nameText = this.add.text(L.cx, startY, char.name, {
      fontSize: L.fontSize('body'), fontFamily: 'Arial Black, Arial', color: '#ffffff',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);
    this.detailContainer.add(nameText);

    const bar = (val: number) => '\u2588'.repeat(val) + '\u2591'.repeat(10 - val);
    const statsY = startY + L.unit(0.05);
    const statsX = L.cx - L.unit(0.20);
    const stats = [
      `SPD ${bar(char.stats.speed)} ${char.stats.speed}`,
      `PWR ${bar(char.stats.power)} ${char.stats.power}`,
      `DEF ${bar(char.stats.defense)} ${char.stats.defense}`,
    ];
    stats.forEach((s, i) => {
      const t = this.add.text(statsX, statsY + i * L.unit(0.03), s, {
        fontSize: L.fontSize('small'), fontFamily: 'Arial', color: THEME.textSecondary,
      });
      this.detailContainer.add(t);
    });

    const superInfo = SUPER_MOVES.find(m => m.id === char.superMove);
    if (superInfo) {
      const superText = this.add.text(L.cx, statsY + L.unit(0.11), `Super: ${superInfo.displayName} \u2014 ${superInfo.description}`, {
        fontSize: L.fontSize('small'), fontFamily: 'Arial', color: THEME.textSecondary,
        wordWrap: { width: L.w * 0.5 },
      }).setOrigin(0.5);
      this.detailContainer.add(superText);
    }

    const isOwner = char.creatorDeviceId === getDeviceId();
    if (isOwner) {
      const ownerBtnW = L.unit(0.16);
      const ownerBtnH = L.unit(0.04);
      const ownerBtnY = statsY + L.unit(0.16);

      const toggleBtn = createButton(this, L.cx - L.unit(0.10), ownerBtnY, 'MAKE PRIVATE', async () => {
        await CharacterApi.toggleVisibility(char.serverId, false);
        this.fetchCharacters();
      }, { width: ownerBtnW, height: ownerBtnH, fontSize: this.L.fontSize('tiny'), style: 'secondary' });
      this.detailContainer.add(toggleBtn.container);

      const delBtn = createButton(this, L.cx + L.unit(0.10), ownerBtnY, 'DELETE', async () => {
        await CharacterApi.remove(char.serverId);
        this.fetchCharacters();
      }, { width: ownerBtnW * 0.75, height: ownerBtnH, fontSize: this.L.fontSize('tiny'), style: 'danger' });
      this.detailContainer.add(delBtn.container);
    }
  }
}
