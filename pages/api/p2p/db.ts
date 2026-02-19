import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'p2p-db.json');

function readDB() {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return { ads: [], orders: [], reports: [], nonces: {}, ratings: {} };
  }
}

function writeDB(data: any) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export { readDB, writeDB };
