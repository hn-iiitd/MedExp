// Database initialization and access layer using SQLite
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// In production, use /data volume for persistence (Railway/Docker).
// Locally, store in the server/db directory.
const DATA_DIR = process.env.NODE_ENV === 'production' && fs.existsSync('/data')
  ? '/data'
  : __dirname;

const DB_PATH = path.join(DATA_DIR, 'med_expiry.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initTables();
  }
  return db;
}

function initTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      google_id TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      name TEXT,
      picture TEXT,
      access_token TEXT,
      refresh_token TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS medicines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      medicine_name TEXT NOT NULL,
      expiry_date TEXT,
      batch_no TEXT,
      bill_date TEXT,
      distributor_name TEXT,
      source TEXT DEFAULT 'upload',
      source_identifier TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS processed_emails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      message_id TEXT NOT NULL,
      subject TEXT,
      processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, message_id)
    );

    CREATE INDEX IF NOT EXISTS idx_medicines_user ON medicines(user_id);
    CREATE INDEX IF NOT EXISTS idx_medicines_expiry ON medicines(user_id, expiry_date);
    CREATE INDEX IF NOT EXISTS idx_processed_emails ON processed_emails(user_id, message_id);
  `);
}

module.exports = { getDb };
