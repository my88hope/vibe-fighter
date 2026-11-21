import { AUDIO_KEYS, playAudioCue } from '../game/core/audio';
import { GAME_TAGLINE, GAME_TITLE } from '../game/constants';
import { isTouchCapableDevice } from '../game/touchControls';
import { SCENE_KEYS } from '../game/types';
import { BaseScene } from './BaseScene';

export class SplashScene extends BaseScene {
  private hasAdvanced = false;

  constructor() {
    super(SCENE_KEYS.Splash);
  }

  create(): void {
    this.markActiveScene(SCENE_KEYS.Splash);

    const camera = this.cameras.main;
    const isPortrait = camera.height > camera.width;
    camera.setBackgroundColor(0x020617);

    this.add
      .text(camera.centerX, camera.centerY - (GAME_TAGLINE ? 26 : 0), GAME_TITLE.toUpperCase(), {
        color: '#f8fafc',
        fontFamily: 'monospace',
        fontStyle: 'bold',
        fontSize: isPortrait ? '52px' : '68px',
        stroke: '#0f172a',
        strokeThickness: 8,
        align: 'center',
        wordWrap: { width: camera.width - 48 }
      })
      .setOrigin(0.5)
      .setDepth(2);

    if (GAME_TAGLINE) {
      this.add
        .text(camera.centerX, camera.centerY + 34, GAME_TAGLINE, {
          color: '#cbd5e1',
          fontFamily: 'monospace',
          fontSize: isPortrait ? '17px' : '20px',
          stroke: '#0f172a',
          strokeThickness: 5,
          align: 'center',
          wordWrap: { width: camera.width - 64 }
        })
        .setOrigin(0.5)
        .setDepth(2);
    }

    this.createFooterHint(
      this.app.isMobileShell || isTouchCapableDevice() ? 'Tap screen to begin' : 'Press any key to begin'
    );

    const advanceToMenu = (): void => {
      if (this.hasAdvanced) {
        return;
      }

      this.hasAdvanced = true;
      playAudioCue(this, AUDIO_KEYS.uiConfirm, this.app.settingsStore.getState());
      this.scene.start(SCENE_KEYS.MainMenu);
    };

    this.input.once('pointerup', advanceToMenu);
    this.input.keyboard?.once('keydown', advanceToMenu);
  }
}
