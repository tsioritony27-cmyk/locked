import app from './app.js';
import { env } from './config/env.js';

app.listen(env.port, () => {
  console.log(`Locked API écoute sur le port ${env.port} (${env.nodeEnv})`);
});
