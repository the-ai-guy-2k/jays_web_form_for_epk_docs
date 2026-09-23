import { createApp } from './index.js';
import { assertConfig, PORT, INTAKE_TOKEN } from './config.js';
import { dbPath, getDb } from './db.js';

assertConfig();
getDb();

const app = createApp();

app.listen(PORT, () => {
  console.log(`Jay Garrett EPK Intake listening on http://localhost:${PORT}`);
  console.log(`Jay intake URL: http://localhost:${PORT}/i/${INTAKE_TOKEN}`);
  console.log(`SQLite: ${dbPath()}`);
  console.log(
    `TAIG review: http://localhost:${PORT}/taig/review?token=<TAIG_REVIEW_TOKEN>`
  );
});
