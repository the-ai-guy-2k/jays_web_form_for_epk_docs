import { createApp } from './index.js';
import { assertConfig, PORT } from './config.js';
import { dbPath, initStore, storageKind } from './db.js';

assertConfig();
await initStore();

const app = createApp();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Jay Garrett Web EPK listening on http://0.0.0.0:${PORT}`);
  console.log(`Storage: ${storageKind()} (${dbPath()})`);
  console.log('Public EPK path: /');
  console.log('Intake path (preserved): /intake');
  console.log(`TAIG review path: /taig/review?token=<TAIG_REVIEW_TOKEN>`);
});
