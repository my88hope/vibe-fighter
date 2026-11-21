import * as Phaser from 'phaser';

import { AUDIO_KEYS, playAudioCue } from '../game/core/audio';
import { GAME_TAGLINE, GAME_TITLE } from '../game/constants';
import { createTextButton, type TextButton } from '../game/ui';
import { SCENE_KEYS } from '../game/types';
import { BaseScene } from './BaseScene';

interface MenuOption {
  label: string;
  action: () => void;
}

export class MainMenuScene extends BaseScene {
  private selectedIndex = 0;

  private buttons: TextButton[] = [];

  private dividers: Phaser.GameObjects.Text[] = [];

  private options: MenuOption[] = [];

  constructor() {
    super(SCENE_KEYS.MainMenu);
  }

  create(): void {
    this.buttons = [];
    this.dividers = [];
    this.selectedIndex = 0;
    this.options = [];

    this.markActiveScene(SCENE_KEYS.MainMenu);
    const camera = this.cameras.main;
    const isPortrait = camera.height > camera.width;
    camera.setBackgroundColor(0x020617);

    const buttonHeight = isPortrait ? 66 : 58;
    const buttonGap = isPortrait ? 22 : 18;
    const taglineHeight = GAME_TAGLINE ? (isPortrait ? 44 : 40) : 0;
    const titleToButtonsGap = isPortrait ? 62 : 54;
    const totalBlockHeight = 64 + taglineHeight + titleToButtonsGap + buttonHeight * 2 + buttonGap;
    const blockTopY = Math.round(camera.centerY - totalBlockHeight / 2 - 12);

    const titleY = blockTopY + 32;
    this.add
      .text(camera.centerX, titleY, GAME_TITLE.toUpperCase(), {
        color: '#f8fafc',
        fontFamily: 'monospace',
        fontStyle: 'bold',
        fontSize: isPortrait ? '50px' : '64px',
        stroke: '#0f172a',
        strokeThickness: 8,
        align: 'center',
        wordWrap: { width: camera.width - 48 }
      })
      .setOrigin(0.5);

    if (GAME_TAGLINE) {
      this.add
        .text(camera.centerX, titleY + (isPortrait ? 46 : 42), GAME_TAGLINE, {
          color: '#94a3b8',
          fontFamily: 'monospace',
          fontSize: isPortrait ? '16px' : '18px',
          align: 'center',
          wordWrap: { width: camera.width - 64 }
        })
        .setOrigin(0.5);
    }

    const firstButtonY = blockTopY + 64 + taglineHeight + titleToButtonsGap + buttonHeight / 2;
    this.renderMenu(firstButtonY, buttonHeight, buttonHeight + buttonGap);

    const keyUp = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    const keyDown = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    const keyW = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    const keyS = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    const keyEnter = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    const keySpace = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    keyUp?.on('down', () => this.moveSelection(-1));
    keyW?.on('down', () => this.moveSelection(-1));
    keyDown?.on('down', () => this.moveSelection(1));
    keyS?.on('down', () => this.moveSelection(1));
    keyEnter?.on('down', () => this.confirmOption(this.options[this.selectedIndex]));
    keySpace?.on('down', () => this.confirmOption(this.options[this.selectedIndex]));

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.clearButtons();
      this.selectedIndex = 0;
      this.options = [];
    });

    this.createFooterHint('Arrow keys / WASD to navigate • Enter / Space to confirm');
  }

  private moveSelection(direction: number): void {
    const next = Phaser.Math.Wrap(this.selectedIndex + direction, 0, this.buttons.length);
    this.setSelection(next);
  }

  private setSelection(index: number): void {
    this.selectedIndex = index;
    this.buttons.forEach((button, buttonIndex) => {
      button.setSelected(buttonIndex === index);
    });
  }

  private renderMenu(startY: number, buttonHeight: number, spacing: number): void {
    this.clearButtons();

    const playOption: MenuOption = { label: 'Play', action: () => this.scene.start(SCENE_KEYS.ModeSelect) };
    const settingsOption: MenuOption = { label: 'Settings', action: () => this.scene.start(SCENE_KEYS.Settings) };
    this.options = [playOption, settingsOption];

    const buttonWidth = Math.min(360, this.cameras.main.width - 80);
    let row = 0;

    const layoutButton = (option: MenuOption, optionIndex: number): void => {
      const button = createTextButton(this, {
        x: this.cameras.main.centerX,
        y: startY + row * spacing,
        width: buttonWidth,
        height: buttonHeight,
        label: option.label,
        onClick: () => this.confirmOption(option),
        onHover: () => this.setSelection(optionIndex)
      });

      this.buttons.push(button);
      row += 1;
    };

    layoutButton(playOption, 0);
    layoutButton(settingsOption, 1);

    this.setSelection(0);
  }


  private clearButtons(): void {
    this.buttons.forEach((button) => {
      button.destroy();
    });
    this.buttons = [];
    this.dividers.forEach((divider) => {
      divider.destroy();
    });
    this.dividers = [];
  }

  private confirmOption(option?: MenuOption): void {
    if (!option) {
      return;
    }

    playAudioCue(this, AUDIO_KEYS.uiConfirm, this.app.settingsStore.getState());
    option.action();
  }
}
