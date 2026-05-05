const path = require('path');
const { app } = require('electron');
const sqlite3 = require('sqlite3').verbose();

const DB_FILE = path.join(app.getPath('userData'), 'spotify_tokens.db');
let db;

function init() {
  if (db) return;
  db = new sqlite3.Database(DB_FILE);
  db.serialize(() => {
    db.run(
      `CREATE TABLE IF NOT EXISTS spotify_tokens (
        user TEXT PRIMARY KEY,
        refresh_token TEXT,
        updated_at INTEGER
      )`
    );
  });
}

function saveToken(user, refreshToken) {
  init();
  return new Promise((resolve, reject) => {
    const now = Date.now();
    db.run(
      `INSERT OR REPLACE INTO spotify_tokens (user, refresh_token, updated_at) VALUES (?,?,?)`,
      [user, refreshToken, now],
      function (err) {
        if (err) return reject(err);
        resolve();
      }
    );
  });
}

module.exports = {
  init,
  saveToken,
};
