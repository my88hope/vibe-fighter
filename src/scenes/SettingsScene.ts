import * as Phaser from 'phaser';

import { AUDIO_KEYS, playAudioCue } from '../game/core/audio';
import { createTextButton, type TextButton } from '../game/ui';
import { DEFAULT_SETTINGS } from '../game/settings';
import { SCENE_KEYS } from '../game/types';
import { BaseScene } from './BaseScene';

export class SettingsScene extends BaseScene {
  private sfxValue!: Phaser.GameObjects.Text;

  private musicValue!: Phaser.GameObjects.Text;

  private muteValue!: Phaser.GameObjects.Text;

  private sfxDownButton!: TextButton;

  private sfxUpButton!: TextButton;

  private musicDownButton!: TextButton;

  private musicUpButton!: TextButton;

  private muteButton!: TextButton;

  private resetButton!: TextButton;

  private backButton!: TextButton;

  private selectedRow = 0;

  constructor() {
    super(SCENE_KEYS.Settings);
  }

  create(): void {
    this.markActiveScene(SCENE_KEYS.Settings);
    this.cameras.main.setBackgroundColor(0x020617);
    this.createHeading('Settings', '');

    const camera = this.cameras.main;
    const { centerX, centerY, width, height } = camera;
    const isPortrait = height > width;
    const panelWidth = Math.min(560, width - 48);
    const panelHeight = Math.min(500, height - (isPortrait ? 220 : 168));
    const panelCenterY = centerY + 12;
    const panelTop = panelCenterY - panelHeight / 2;

    const panel = this.add.image(centerX, panelCenterY, 'ui-panel');
    panel.setDisplaySize(panelWidth, panelHeight);

    const valueStyle = {
      color: '#cbd5e1',
      fontFamily: 'monospace',
      fontSize: isPortrait ? '22px' : '23px'
    };

    this.sfxValue = this.add.text(centerX, panelTop + 44, '', valueStyle).setOrigin(0.5);
    this.musicValue = this.add.text(centerX, panelTop + 76, '', valueStyle).setOrigin(0.5);
    this.muteValue = this.add.text(centerX, panelTop + 108, '', valueStyle).setOrigin(0.5);

    const wideButtonWidth = Math.min(340, panelWidth - 64);
    const halfGap = 16;
    const halfButtonWidth = Math.floor((wideButtonWidth - halfGap) / 2);
    const halfOffset = (halfButtonWidth + halfGap) / 2;
    const buttonHeight = Math.min(56, Math.floor((panelHeight - 178) / 5));
    const rowStep = buttonHeight + 8;
    const firstButtonY = panelTop + 168;
    const buttonY = Array.from({ length: 5 }, (_, index) => firstButtonY + index * rowStep);

    this.sfxDownButton = createTextButton(this, {
      x: centerX - halfOffset,
      y: buttonY[0],
      width: halfButtonWidth,
      height: buttonHeight,
      label: 'SFX -',
      onClick: () => this.changeVolume('sfx', -0.1),
      onHover: () => this.setSelection(0)
    });

    this.sfxUpButton = createTextButton(this, {
      x: centerX + halfOffset,
      y: buttonY[0],
      width: halfButtonWidth,
      height: buttonHeight,
      label: 'SFX +',
      onClick: () => this.changeVolume('sfx', 0.1),
      onHover: () => this.setSelection(0)
    });

    this.musicDownButton = createTextButton(this, {
      x: centerX - halfOffset,
      y: buttonY[1],
      width: halfButtonWidth,
      height: buttonHeight,
      label: 'Music -',
      onClick: () => this.changeVolume('music', -0.1),
      onHover: () => this.setSelection(1)
    });

    this.musicUpButton = createTextButton(this, {
      x: centerX + halfOffset,
      y: buttonY[1],
      width: halfButtonWidth,
      height: buttonHeight,
      label: 'Music +',
      onClick: () => this.changeVolume('music', 0.1),
      onHover: () => this.setSelection(1)
    });

    this.muteButton = createTextButton(this, {
      x: centerX,
      y: buttonY[2],
      width: wideButtonWidth,
      height: buttonHeight,
      label: 'Toggle mute',
      onClick: () => this.toggleMute(),
      onHover: () => this.setSelection(2)
    });

    this.resetButton = createTextButton(this, {
      x: centerX,
      y: buttonY[3],
      width: wideButtonWidth,
      height: buttonHeight,
      label: 'Reset defaults',
      onClick: () => this.app.settingsStore.setState(DEFAULT_SETTINGS),
      onHover: () => this.setSelection(3)
    });

    this.backButton = createTextButton(this, {
      x: centerX,
      y: buttonY[4],
      width: wideButtonWidth,
      height: buttonHeight,
      label: 'Back to menu',
      onClick: () => this.goToMenu(),
      onHover: () => this.setSelection(4)
    });

    this.setSelection(0);

    this.input.keyboard?.on('keydown-UP', () => this.moveSelection(-1));
    this.input.keyboard?.on('keydown-W', () => this.moveSelection(-1));
    this.input.keyboard?.on('keydown-DOWN', () => this.moveSelection(1));
    this.input.keyboard?.on('keydown-S', () => this.moveSelection(1));
    this.input.keyboard?.on('keydown-LEFT', () => this.handleLeft());
    this.input.keyboard?.on('keydown-RIGHT', () => this.handleRight());
    this.input.keyboard?.on('keydown-ESC', () => this.goToMenu());
    this.input.keyboard?.on('keydown-ENTER', () => this.activateSelection());
    this.input.keyboard?.on('keydown-SPACE', () => this.activateSelection());

    const unsubscribe = this.app.settingsStore.subscribe((settings) => {
      this.sfxValue.setText(`SFX: ${Math.round(settings.sfxVolume * 100)}%`);
      this.musicValue.setText(`Music: ${Math.round(settings.musicVolume * 100)}%`);
      this.muteValue.setText(`Mute: ${settings.muted ? 'On' : 'Off'}`);
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);

    this.createFooterHint('Up/Down select • Left/Right adjust • Enter/Space select • Esc back');
  }

  private changeVolume(kind: 'sfx' | 'music', delta: number): void {
    const current = this.app.settingsStore.getState();
    const key = kind === 'sfx' ? 'sfxVolume' : 'musicVolume';
    const nextVolume = Math.max(0, Math.min(1, current[key] + delta));

    this.app.settingsStore.patchState({ [key]: Number(nextVolume.toFixed(2)) });
    playAudioCue(this, AUDIO_KEYS.uiConfirm, this.app.settingsStore.getState());
  }

  private toggleMute(): void {
    const settings = this.app.settingsStore.getState();
    this.app.settingsStore.patchState({ muted: !settings.muted });
    playAudioCue(this, AUDIO_KEYS.uiConfirm, this.app.settingsStore.getState());
  }

  private moveSelection(direction: number): void {
    const nextIndex = Phaser.Math.Wrap(this.selectedRow + direction, 0, 5);
    this.setSelection(nextIndex);
  }

  private setSelection(index: number): void {
    this.selectedRow = index;
    this.sfxDownButton.setSelected(index === 0);
    this.sfxUpButton.setSelected(index === 0);
    this.musicDownButton.setSelected(index === 1);
    this.musicUpButton.setSelected(index === 1);
    this.muteButton.setSelected(index === 2);
    this.resetButton.setSelected(index === 3);
    this.backButton.setSelected(index === 4);
  }

  private activateSelection(): void {
    if (this.selectedRow === 2) {
      this.toggleMute();
      return;
    }

    if (this.selectedRow === 3) {
      this.app.settingsStore.setState(DEFAULT_SETTINGS);
      return;
    }

    if (this.selectedRow === 4) {
      this.goToMenu();
    }
  }

  private handleLeft(): void {
    if (this.selectedRow === 0) {
      this.changeVolume('sfx', -0.1);
      return;
    }

    if (this.selectedRow === 1) {
      this.changeVolume('music', -0.1);
      return;
    }

    if (this.selectedRow === 2) {
      this.toggleMute();
    }
  }

  private handleRight(): void {
    if (this.selectedRow === 0) {
      this.changeVolume('sfx', 0.1);
      return;
    }

    if (this.selectedRow === 1) {
      this.changeVolume('music', 0.1);
      return;
    }

    if (this.selectedRow === 2) {
      this.toggleMute();
    }
  }
}
