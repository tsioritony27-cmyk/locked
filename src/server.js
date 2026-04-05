import path from 'node:path';
import { fileURLToPath } from 'node:url';
import app from './app.js';
import { env } from './config/env.js';

export function startLockedApi() {
  return app.listen(env.port, () => {
    console.log(`Locked API écoute sur le port ${env.port} (${env.nodeEnv})`);
  });
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const modulePath = path.resolve(fileURLToPath(import.meta.url));
const isMainModule = entryPath !== '' && entryPath === modulePath;

if (isMainModule) {
  startLockedApi();
}
