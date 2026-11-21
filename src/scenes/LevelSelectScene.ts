import * as Phaser from 'phaser';

import { AUDIO_KEYS, playAudioCue } from '../game/core/audio';
import { STAGE_DEFINITIONS } from '../game/stageConfig';
import { createSelectionCard, type SelectionCard } from '../game/ui';
import { SCENE_KEYS, type MatchMode } from '../game/types';
import { BaseScene } from './BaseScene';

interface LevelSelectData {
  mode: MatchMode;
}

const ACCENT = 0xfacc15;

/**
 * Second step of the Play flow: pick the stage for the match. Displays all
 * stages in a responsive grid of pixel-art preview cards and forwards the
 * selection to character select.
 */
export class LevelSelectScene extends BaseScene {
  private mode: MatchMode = '1v1';
  private cards: SelectionCard[] = [];
  private selectedIndex = 0;
  private gridCols = 5;

  constructor() {
    super(SCENE_KEYS.LevelSelect);
  }

  init(data: LevelSelectData): void {
    this.mode = data?.mode ?? '1v1';
  }

  create(): void {
    this.cards = [];
    this.selectedIndex = 0;

    this.markActiveScene(SCENE_KEYS.LevelSelect);
    this.cameras.main.setBackgroundColor(0x020617);
    this.createHeading('Select Stage', this.mode === '1v1' ? '1 vs 1' : '1 vs CPU');

    this.buildCards();
    this.registerInput();
    this.setSelection(0);

    this.createFooterHint('Arrow keys / WASD to choose • Enter / Space to confirm • Esc to go back');

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cards.forEach((card) => card.destroy());
      this.cards = [];
    });
  }

  private buildCards(): void {
    const { centerX, width, height } = this.cameras.main;
    const isPortrait = height > width;
    const count = STAGE_DEFINITIONS.length;

    this.gridCols = isPortrait ? 2 : Math.min(5, Math.max(1, Math.ceil(count / 2)));
    const gridRows = Math.max(1, Math.ceil(count / this.gridCols));

    const topSafe = isPortrait ? 132 : 114;
    const bottomSafe = isPortrait ? 60 : 52;
    const colGap = isPortrait ? 20 : 20;
    const rowGap = isPortrait ? 20 : 24;
    const availWidth = Math.max(240, width - (isPortrait ? 56 : 80));
    const availHeight = Math.max(240, height - topSafe - bottomSafe);

    const maxCardWidth = Math.floor((availWidth - colGap * (this.gridCols - 1)) / this.gridCols);
    const maxCardHeight = Math.floor((availHeight - rowGap * (gridRows - 1) - 12) / gridRows);

    const cardWidth = Math.min(isPortrait ? 310 : 230, maxCardWidth);
    const cardHeight = Math.min(isPortrait ? 190 : 196, maxCardHeight);
    const totalHeight = cardHeight * gridRows + rowGap * (gridRows - 1);
    const areaCenterY = topSafe + availHeight / 2;
    const startY = areaCenterY - totalHeight / 2 + cardHeight / 2;

    const maxImgW = cardWidth - 20;
    const maxImgH = Math.max(60, cardHeight - 58);
    const imageMaxSize = Math.min(maxImgW, Math.round(maxImgH * 1.78));

    STAGE_DEFINITIONS.forEach((stage, index) => {
      const row = Math.floor(index / this.gridCols);
      const col = index % this.gridCols;
      const colsInRow = row === gridRows - 1 ? count - row * this.gridCols : this.gridCols;
      const rowWidth = cardWidth * colsInRow + colGap * (colsInRow - 1);
      const rowStartX = centerX - rowWidth / 2 + cardWidth / 2;
      const x = rowStartX + col * (cardWidth + colGap);
      const y = startY + row * (cardHeight + rowGap);

      const card = createSelectionCard(this, {
        x,
        y,
        width: cardWidth,
        height: cardHeight,
        title: stage.label,
        texture: this.textures.exists(stage.key) ? stage.key : undefined,
        imageMaxSize,
        imageOffsetY: -18,
        onHover: () => this.setSelection(index),
        onClick: () => this.confirm(index)
      });

      this.cards.push(card);
    });
  }

  private registerInput(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      return;
    }

    keyboard.on('keydown-LEFT', () => this.moveSelection(-1));
    keyboard.on('keydown-A', () => this.moveSelection(-1));
    keyboard.on('keydown-RIGHT', () => this.moveSelection(1));
    keyboard.on('keydown-D', () => this.moveSelection(1));
    keyboard.on('keydown-UP', () => this.moveSelection(-this.gridCols));
    keyboard.on('keydown-W', () => this.moveSelection(-this.gridCols));
    keyboard.on('keydown-DOWN', () => this.moveSelection(this.gridCols));
    keyboard.on('keydown-S', () => this.moveSelection(this.gridCols));
    keyboard.on('keydown-ENTER', () => this.confirm(this.selectedIndex));
    keyboard.on('keydown-SPACE', () => this.confirm(this.selectedIndex));
    keyboard.on('keydown-ESC', () => this.scene.start(SCENE_KEYS.ModeSelect));
    keyboard.on('keydown-BACKSPACE', () => this.scene.start(SCENE_KEYS.ModeSelect));
  }

  private moveSelection(direction: number): void {
    const next = Phaser.Math.Wrap(this.selectedIndex + direction, 0, this.cards.length);
    this.setSelection(next);
  }

  private setSelection(index: number): void {
    this.selectedIndex = index;
    this.cards.forEach((card, cardIndex) => card.setSelected(cardIndex === index, ACCENT));
  }

  private confirm(index: number): void {
    this.setSelection(index);
    playAudioCue(this, AUDIO_KEYS.uiConfirm, this.app.settingsStore.getState());
    this.scene.start(SCENE_KEYS.CharacterSelect, {
      mode: this.mode,
      stageId: STAGE_DEFINITIONS[index].id
    });
  }
}
