import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const distPath = path.join(__dirname, 'dist');
const dataPath = path.join(__dirname, 'data');
const port = Number(process.env.PORT || 4173);

app.use('/data', express.static(dataPath));
app.use(express.static(distPath));

app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Hermes Skill Corpus Explorer listening on http://0.0.0.0:${port}`);
});
