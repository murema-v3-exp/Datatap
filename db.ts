// db.ts
import fs from "fs";
const DB_PATH = "./db.json";

interface DB {
  quotes: Record<string, any>;
  pendingGrants: Record<string, any>;
}

function loadDB(): DB {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ quotes: {}, pendingGrants: {} }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}

function saveDB(db: DB) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

export { loadDB, saveDB };
