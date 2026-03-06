const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'allowed-emails.json');

function ensureDataFile() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]');
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
