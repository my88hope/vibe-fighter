import * as Phaser from 'phaser';

import { getAppContext } from '../game/context';
import type { AppContext } from '../game/context';
import { SCENE_KEYS, type SceneKey } from '../game/types';

export abstract class BaseScene extends Phaser.Scene {
  protected get app(): AppContext {
    return getAppContext();
  }

  protected markActiveScene(sceneKey: SceneKey): void {
    this.app.debugStore.patchState({ activeScene: sceneKey });
  }

  protected createHeading(title: string, subtitle: string): void {
    const { centerX, width, height } = this.cameras.main;
    const isPortrait = height > width;
    const titleY = isPortrait ? 68 : 50;
    const subtitleY = titleY + (isPortrait ? 40 : 36);

    this.add
      .text(centerX, titleY, title, {
        color: '#f8fafc',
        fontFamily: 'monospace',
        fontStyle: 'bold',
        fontSize: isPortrait ? '32px' : '36px',
        align: 'center',
        wordWrap: { width: width - 48 }
      })
      .setOrigin(0.5);

    if (subtitle) {
      this.add
        .text(centerX, subtitleY, subtitle, {
          color: '#94a3b8',
          fontFamily: 'monospace',
          fontSize: isPortrait ? '15px' : '16px',
          align: 'center',
          wordWrap: { width: width - 48 }
        })
        .setOrigin(0.5);
    }
  }

  protected createFooterHint(text: string): void {
    const { centerX, width, height } = this.cameras.main;
    const isPortrait = height > width;

    this.add
      .text(centerX, height - (isPortrait ? 34 : 26), text, {
        color: '#94a3b8',
        fontFamily: 'monospace',
        fontSize: isPortrait ? '13px' : '14px',
        align: 'center',
        wordWrap: { width: width - 40 }
      })
      .setOrigin(0.5)
      .setDepth(100);
  }

  protected goToMenu(): void {
    this.scene.start(SCENE_KEYS.MainMenu);
  }
}
