import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { CharSelectScene } from './scenes/CharSelectScene';
import { LocalGameScene } from './scenes/LocalGameScene';
import { OnlineGameScene } from './scenes/OnlineGameScene';
import { OnlineHubScene } from './scenes/OnlineHubScene';
import { OnlineLobbyScene } from './scenes/OnlineLobbyScene';
import { ResultScene } from './scenes/ResultScene';
import { CpuGameScene } from './scenes/CpuGameScene';
import { CharacterCreatorScene } from './scenes/CharacterCreatorScene';
import { CommunityGalleryScene } from './scenes/CommunityGalleryScene';
import { VsScreen } from './scenes/VsScreen';
import { HowToPlayScene } from './scenes/HowToPlayScene';
import { CreditsScene } from './scenes/CreditsScene';
import { GAME_WIDTH, GAME_HEIGHT } from '@pyrgo/shared';

// ─── Global error handlers ─────────────────────────
window.onerror = (_msg, _src, _line, _col, _err) => {
  showErrorOverlay();
};

window.addEventListener('unhandledrejection', () => {
  showErrorOverlay();
});

function showErrorOverlay(): void {
  if (document.getElementById('error-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'error-overlay';
  overlay.style.cssText =
    'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);' +
    'color:white;display:flex;align-items:center;justify-content:center;z-index:99999;' +
    'font-family:Arial,sans-serif;font-size:16px;cursor:pointer;text-align:center;padding:2rem;';
  overlay.textContent = 'Something went wrong. Tap to reload.';
  overlay.addEventListener('click', () => window.location.reload());
  document.body.appendChild(overlay);
}

// ─── Install banner logic ──────────────────────────
let deferredPrompt: Event & { prompt?: () => void; userChoice?: Promise<{ outcome: string }> } | null = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e as typeof deferredPrompt;

  if (sessionStorage.getItem('pyrgo-install-dismissed')) return;

  const banner = document.getElementById('install-banner');
  if (banner) banner.style.display = 'flex';
});

document.getElementById('install-btn')?.addEventListener('click', () => {
  if (deferredPrompt?.prompt) {
    deferredPrompt.prompt();
    deferredPrompt = null;
  }
  const banner = document.getElementById('install-banner');
  if (banner) banner.style.display = 'none';
});

document.getElementById('dismiss-btn')?.addEventListener('click', () => {
  const banner = document.getElementById('install-banner');
  if (banner) banner.style.display = 'none';
  sessionStorage.setItem('pyrgo-install-dismissed', '1');
});

// ─── SERVER_SHUTDOWN listener ──────────────────────
import { SocketManager } from './network/SocketManager';
SocketManager.getInstance().on('SERVER_SHUTDOWN', () => {
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);' +
    'color:white;display:flex;align-items:center;justify-content:center;z-index:99998;' +
    'font-family:Arial,sans-serif;font-size:18px;text-align:center;padding:2rem;';
  overlay.textContent = 'Server is restarting... Please wait.';
  document.body.appendChild(overlay);
});

// ─── Phaser game ───────────────────────────────────
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  backgroundColor: '#000008',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    expandParent: true,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 1200 },
      debug: false,
    },
  },
  scene: [
    BootScene,
    MainMenuScene,
    CharSelectScene,
    LocalGameScene,
    CpuGameScene,
    OnlineGameScene,
    OnlineHubScene,
    OnlineLobbyScene,
    ResultScene,
    CharacterCreatorScene,
    CommunityGalleryScene,
    VsScreen,
    HowToPlayScene,
    CreditsScene,
  ],
};

new Phaser.Game(config);
