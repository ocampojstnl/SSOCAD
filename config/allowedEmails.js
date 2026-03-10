const fs = require('fs');
const path = require('path');
const DATA_DIR = require('./dataDir');

const DATA_FILE = path.join(DATA_DIR, 'allowed-emails.json');

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    // Seed from env var on first access (handles Vercel cold starts)
    const seed = (process.env.ALLOWED_EMAILS || '')
      .split(',')
      .map(e => e.toLowerCase().trim())
      .filter(Boolean);
    fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
  }
}

function loadEmails() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveEmails(emails) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(emails, null, 2));
}

function isEmailAllowed(email) {
  return loadEmails().includes(email.toLowerCase().trim());
}

function addEmail(email) {
  const emails = loadEmails();
  const lower = email.toLowerCase().trim();
  if (!emails.includes(lower)) {
    emails.push(lower);
    saveEmails(emails);
  }
}

function removeEmail(email) {
  const emails = loadEmails();
  saveEmails(emails.filter(e => e !== email.toLowerCase().trim()));
}

module.exports = { loadEmails, isEmailAllowed, addEmail, removeEmail };
