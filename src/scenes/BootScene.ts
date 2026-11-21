import * as Phaser from 'phaser';

import { BOOT_ASSETS, preloadStarterAssets } from '../game/assets';
import { GAME_TAGLINE, GAME_TITLE } from '../game/constants';
import { registerFightingUiAtlasFrames } from '../game/fightingUiAtlas';
import { registerGeneratedAssets } from '../game/generatedAssets';
import { prepareMyFighterPortraits } from '../game/myFighterLoader';
import { SCENE_KEYS } from '../game/types';
import { BaseScene } from './BaseScene';

const BAR_TRACK_COLOR = 0x0f172a;
const BAR_BORDER_COLOR = 0x38bdf8;
const BAR_FILL_COLOR = 0x38bdf8;
const BAR_READY_COLOR = 0xfacc15;

export class BootScene extends BaseScene {
  private fillBar?: Phaser.GameObjects.Rectangle;
  private percentText?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;
  private barWidth = 480;
  private barHeight = 26;
  private barLeft = 0;

  constructor() {
    super(SCENE_KEYS.Boot);
  }

  preload(): void {
    this.markActiveScene(SCENE_KEYS.Boot);
    this.buildLoadingScreen();

    this.load.maxParallelDownloads = 12;

    const handleProgress = (value: number): void => {
      this.updateLoadingProgress(value * 0.6, 'Loading arenas & UI...');
    };

    const handleFileProgress = (file: Phaser.Loader.File): void => {
      const label = file.key.replace(/-stage$/, '').replace(/-/g, ' ');
      const pct = this.load.progress;
      this.updateLoadingProgress(pct * 0.6, `Loading ${label}...`);
    };

    this.load.on(Phaser.Loader.Events.PROGRESS, handleProgress);
    this.load.on(Phaser.Loader.Events.FILE_PROGRESS, handleFileProgress);
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.load.off(Phaser.Loader.Events.PROGRESS, handleProgress);
      this.load.off(Phaser.Loader.Events.FILE_PROGRESS, handleFileProgress);
    });

    preloadStarterAssets(this, BOOT_ASSETS);
  }

  create(): void {
    this.markActiveScene(SCENE_KEYS.Boot);
    registerGeneratedAssets(this);
    registerFightingUiAtlasFrames(this);

    this.updateLoadingProgress(0.62, 'Preparing fighter portraits...');

    void prepareMyFighterPortraits(this, (fraction, label) => {
      this.updateLoadingProgress(0.62 + fraction * 0.38, label);
    })
      .catch((error) => console.error('[boot] could not prepare fighter portraits', error))
      .then(() => {
        this.updateLoadingProgress(1, 'Ready!');
        this.fillBar?.setFillStyle(BAR_READY_COLOR, 1);
        this.time.delayedCall(120, () => {
          this.scene.start(SCENE_KEYS.Splash);
        });
      });
  }

  private buildLoadingScreen(): void {
    const cam = this.cameras.main;
    const isPortrait = cam.height > cam.width;
    cam.setBackgroundColor(0x020617);

    // Subtle arcade grid backdrop centered symmetrically
    const grid = this.add.graphics();
    grid.lineStyle(1, 0x1e293b, 0.35);
    const gridStep = 48;
    const gridOffsetX = (cam.width % gridStep) / 2;
    const gridOffsetY = (cam.height % gridStep) / 2;
    for (let x = gridOffsetX; x <= cam.width; x += gridStep) {
      grid.lineBetween(x, 0, x, cam.height);
    }
    for (let y = gridOffsetY; y <= cam.height; y += gridStep) {
      grid.lineBetween(0, y, cam.width, y);
    }

    this.add
      .text(cam.centerX, cam.centerY - (isPortrait ? 110 : 96), GAME_TITLE.toUpperCase(), {
        color: '#f8fafc',
        fontFamily: 'monospace',
        fontStyle: 'bold',
        fontSize: isPortrait ? '44px' : '56px',
        stroke: '#0f172a',
        strokeThickness: 8,
        align: 'center',
        wordWrap: { width: cam.width - 48 }
      })
      .setOrigin(0.5);

    if (GAME_TAGLINE) {
      this.add
        .text(cam.centerX, cam.centerY - (isPortrait ? 58 : 44), GAME_TAGLINE, {
          color: '#94a3b8',
          fontFamily: 'monospace',
          fontSize: isPortrait ? '15px' : '17px',
          align: 'center'
        })
        .setOrigin(0.5);
    }

    this.barWidth = Math.min(isPortrait ? 460 : 520, cam.width - 80);
    this.barHeight = 24;
    const barY = cam.centerY + 26;
    this.barLeft = cam.centerX - this.barWidth / 2;

    this.add
      .rectangle(cam.centerX, barY, this.barWidth + 8, this.barHeight + 8, BAR_TRACK_COLOR, 0.95)
      .setStrokeStyle(2, BAR_BORDER_COLOR, 0.9);

    this.fillBar = this.add
      .rectangle(this.barLeft, barY, 4, this.barHeight, BAR_FILL_COLOR, 1)
      .setOrigin(0, 0.5);

    this.percentText = this.add
      .text(cam.centerX, barY + 34, '0%', {
        color: '#facc15',
        fontFamily: 'monospace',
        fontStyle: 'bold',
        fontSize: '18px'
      })
      .setOrigin(0.5);

    this.statusText = this.add
      .text(cam.centerX, barY + 64, 'Initializing...', {
        color: '#cbd5e1',
        fontFamily: 'monospace',
        fontSize: '14px',
        align: 'center',
        wordWrap: { width: cam.width - 64 }
      })
      .setOrigin(0.5);
  }

  private updateLoadingProgress(fraction: number, label: string): void {
    const clamped = Phaser.Math.Clamp(fraction, 0, 1);

    if (this.fillBar) {
      this.fillBar.width = Math.max(4, Math.round(this.barWidth * clamped));
    }

    if (this.percentText) {
      this.percentText.setText(`${Math.round(clamped * 100)}%`);
    }

    if (this.statusText && label) {
      this.statusText.setText(label);
    }
  }
}
