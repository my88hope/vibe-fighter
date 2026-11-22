import { defineConfig } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { writeGameMeta } from './scripts/gameMeta';

const PROJECT_ROOT = import.meta.dirname;
const PUBLIC_ROOT = resolve(PROJECT_ROOT, 'public');
const GAME_META_SOURCES = new Set([
  resolve(PROJECT_ROOT, 'metadata.json'),
  resolve(PROJECT_ROOT, 'src/scenes/ModeSelectScene.ts'),
  resolve(PROJECT_ROOT, 'src/scenes/CharacterSelectScene.ts'),
  resolve(PROJECT_ROOT, 'src/game/myFighters.ts'),
  resolve(PROJECT_ROOT, 'src/game/stageConfig.ts')
]);
const SAVE_TARGETS = new Set([
  'assets/config/game-config.json',
  'assets/config/input-map.json',
  'assets/config/actor-bounds.json',
  'assets/config/object-metadata.json',
  'assets/config/background-layer-offsets.json',
  'assets/levels/index.json',
  'assets/levels/level-1.json',
  'assets/levels/level-2.json',
  'assets/levels/level-3.json',
  'assets/levels/editor-playground.json',
  'configs/character-gym.json',
  'configs/background-gym.json',
  'configs/tile-gym.json',
  'configs/fighter-playground.json'
]);

function readRequestBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolveBody, reject) => {
    let body = '';

    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => resolveBody(body));
    request.on('error', reject);
  });
}

function sendJson(response: ServerResponse, statusCode: number, payload: object): void {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
}

function resolveSaveTarget(target: unknown): string | null {
  if (typeof target !== 'string' || !SAVE_TARGETS.has(target)) {
    return null;
  }

  const outputPath = resolve(PUBLIC_ROOT, target);

  return outputPath.startsWith(PUBLIC_ROOT) ? outputPath : null;
}

export default defineConfig({
  plugins: [
    {
      name: 'generate-game-meta',
      async buildStart() {
        await writeGameMeta(PROJECT_ROOT);
      },
      configureServer(server) {
        void writeGameMeta(PROJECT_ROOT);

        server.watcher.on('change', (filePath) => {
          if (GAME_META_SOURCES.has(resolve(filePath))) {
            void writeGameMeta(PROJECT_ROOT);
          }
        });
      }
    },
    {
      name: 'starter-debug-json-writer',
      configureServer(server) {
        server.middlewares.use('/__debug/save-json', async (request, response, next) => {
          if (request.method !== 'PUT' && request.method !== 'POST') {
            next();
            return;
          }

          try {
            const body = await readRequestBody(request);
            const parsed = JSON.parse(body) as { target?: unknown; payload?: unknown };
            const outputPath = resolveSaveTarget(parsed.target);

            if (!outputPath) {
              sendJson(response, 400, { ok: false, error: 'Target is not allowlisted' });
              return;
            }

            if (!parsed.payload || typeof parsed.payload !== 'object') {
              sendJson(response, 400, { ok: false, error: 'Expected object payload' });
              return;
            }

            await mkdir(dirname(outputPath), { recursive: true });
            await writeFile(outputPath, `${JSON.stringify(parsed.payload, null, 2)}\n`);
            sendJson(response, 200, { ok: true, path: outputPath });
          } catch (error) {
            sendJson(response, 500, {
              ok: false,
              error: error instanceof Error ? error.message : 'Unknown save error'
            });
          }
        });
      }
    }
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true
  }
});
