import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';

export interface GameMeta {
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  modesCount: number;
  fightersCount: number;
  stagesCount: number;
  tagsLabel: string;
  previewImage: string;
}

const VALID_FIGHTER_ID = /^[a-z0-9][a-z0-9-]*$/;

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

function formatModeLabel(mode: string): string {
  if (mode.toLowerCase() === '1vcpu') {
    return '1vCPU';
  }

  return mode;
}

function formatChoiceList(items: string[]): string {
  if (items.length === 0) {
    return '';
  }

  if (items.length === 1) {
    return items[0];
  }

  if (items.length === 2) {
    return `${items[0]} or ${items[1]}`;
  }

  return `${items.slice(0, -1).join(', ')}, or ${items[items.length - 1]}`;
}

async function parseSourceFile(filePath: string): Promise<ts.SourceFile> {
  const content = await readFile(filePath, 'utf8');
  return ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function findArrayInitializer(sourceFile: ts.SourceFile, variableName: string): ts.ArrayLiteralExpression | null {
  let found: ts.ArrayLiteralExpression | null = null;

  function visit(node: ts.Node): void {
    if (found) {
      return;
    }

    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === variableName &&
      node.initializer &&
      ts.isArrayLiteralExpression(node.initializer)
    ) {
      found = node.initializer;
      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return found;
}

function getStringProperty(objectLiteral: ts.ObjectLiteralExpression, propertyName: string): string | null {
  for (const property of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(property)) {
      continue;
    }

    const name = ts.isIdentifier(property.name) || ts.isStringLiteral(property.name) ? property.name.text : null;

    if (name === propertyName && ts.isStringLiteralLike(property.initializer)) {
      return property.initializer.text;
    }
  }

  return null;
}

async function readModes(rootDir: string): Promise<string[]> {
  const sourceFile = await parseSourceFile(resolve(rootDir, 'src/scenes/ModeSelectScene.ts'));
  const arrayLiteral = findArrayInitializer(sourceFile, 'MODE_OPTIONS');

  if (!arrayLiteral) {
    throw new Error('Could not find MODE_OPTIONS array in src/scenes/ModeSelectScene.ts');
  }

  const modes: string[] = [];

  for (const element of arrayLiteral.elements) {
    if (ts.isObjectLiteralExpression(element)) {
      const mode = getStringProperty(element, 'mode');
      if (mode) {
        modes.push(formatModeLabel(mode));
      }
    }
  }

  return modes;
}

async function readMyFighterIds(rootDir: string): Promise<string[]> {
  const sourceFile = await parseSourceFile(resolve(rootDir, 'src/game/myFighters.ts'));
  const arrayLiteral = findArrayInitializer(sourceFile, 'MY_FIGHTERS');

  if (!arrayLiteral) {
    throw new Error('Could not find MY_FIGHTERS array in src/game/myFighters.ts');
  }

  const ids: string[] = [];

  for (const element of arrayLiteral.elements) {
    if (ts.isObjectLiteralExpression(element)) {
      const id = getStringProperty(element, 'id');
      if (id && VALID_FIGHTER_ID.test(id)) {
        ids.push(id);
      }
    }
  }

  return ids;
}

async function readSelectableFighterIds(rootDir: string): Promise<string[]> {
  const myFighterIds = await readMyFighterIds(rootDir);
  const sourceFile = await parseSourceFile(resolve(rootDir, 'src/scenes/CharacterSelectScene.ts'));
  const arrayLiteral = findArrayInitializer(sourceFile, 'SELECTABLE_FIGHTER_IDS');

  if (!arrayLiteral) {
    return myFighterIds;
  }

  const ids: string[] = [];

  for (const element of arrayLiteral.elements) {
    if (ts.isStringLiteralLike(element)) {
      ids.push(element.text);
    } else if (
      ts.isSpreadElement(element) &&
      ts.isIdentifier(element.expression) &&
      element.expression.text === 'MY_FIGHTER_IDS'
    ) {
      ids.push(...myFighterIds);
    }
  }

  return Array.from(new Set(ids));
}

async function readStagesCount(rootDir: string): Promise<number> {
  const sourceFile = await parseSourceFile(resolve(rootDir, 'src/game/stageConfig.ts'));
  const arrayLiteral = findArrayInitializer(sourceFile, 'STAGE_DEFINITIONS');

  if (!arrayLiteral) {
    throw new Error('Could not find STAGE_DEFINITIONS array in src/game/stageConfig.ts');
  }

  return arrayLiteral.elements.length;
}

async function readAppTitle(rootDir: string): Promise<string> {
  try {
    const raw = await readFile(resolve(rootDir, 'metadata.json'), 'utf8');
    const parsed = JSON.parse(raw) as { name?: unknown };
    if (typeof parsed.name === 'string' && parsed.name.trim().length > 0) {
      return parsed.name.trim();
    }
  } catch {
    // Fall back to default title if metadata.json cannot be read.
  }

  return 'Vibe Fighter';
}

export async function buildGameMeta(rootDir: string): Promise<GameMeta> {
  const [title, modes, fighterIds, stagesCount] = await Promise.all([
    readAppTitle(rootDir),
    readModes(rootDir),
    readSelectableFighterIds(rootDir),
    readStagesCount(rootDir)
  ]);

  const modesCount = modes.length;
  const fightersCount = fighterIds.length;
  const modeChoiceText = formatChoiceList(modes);

  return {
    title,
    subtitle: `${modesCount} ${pluralize(modesCount, 'Mode')} • ${fightersCount} ${pluralize(fightersCount, 'Fighter')} • ${stagesCount} ${pluralize(stagesCount, 'Stage')}`,
    description: `2D retro arcade fighter built with Phaser. Pick from ${fightersCount} ${pluralize(fightersCount, 'fighter')}, choose ${modeChoiceText}, and battle across ${stagesCount} pixel-art ${pluralize(stagesCount, 'arena')}!`,
    badge: `${modesCount} ${pluralize(modesCount, 'Mode')}`,
    modesCount,
    fightersCount,
    stagesCount,
    tagsLabel: [...modes, 'Phaser'].join(' • '),
    previewImage: '/preview.jpg'
  };
}

export async function writeGameMeta(rootDir: string): Promise<GameMeta> {
  const meta = await buildGameMeta(rootDir);
  const outputPath = resolve(rootDir, 'public/game-meta.json');
  const nextContent = `${JSON.stringify(meta, null, 2)}\n`;

  try {
    const currentContent = await readFile(outputPath, 'utf8');
    if (currentContent === nextContent) {
      return meta;
    }
  } catch {
    // File does not exist yet; create it below.
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, nextContent, 'utf8');
  return meta;
}
