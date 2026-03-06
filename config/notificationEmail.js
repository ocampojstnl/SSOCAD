const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'notification-email.json');

function ensureDataDir() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadNotificationEmail() {
  ensureDataDir();
  // Check data file first, fall back to env var
  if (fs.existsSync(DATA_FILE)) {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (data.email) return data.email;
  }
  return process.env.NOTIFICATION_EMAIL || '';
}

function saveNotificationEmail(email) {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify({ email }, null, 2));
}

module.exports = { loadNotificationEmail, saveNotificationEmail };
