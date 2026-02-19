import fs from "fs";
import path from "path";

type DB = {
  nonces: Record<string, string>;
};

const DB_FILE = path.join(process.cwd(), "src", "p2p", "_db.json");

function ensureFile() {
  try {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ nonces: {} }));
  } catch (e) {
    // ignore
  }
}

export function readDB(): DB {
  try {
    ensureFile();
    const raw = fs.readFileSync(DB_FILE, "utf8");
    return JSON.parse(raw) as DB;
  } catch (e) {
    return { nonces: {} };
  }
}

export function writeDB(db: DB) {
  try {
    ensureFile();
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  } catch (e) {
    // ignore write errors on serverless environments
  }
}

export default { readDB, writeDB };
