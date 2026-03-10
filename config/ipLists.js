const fs   = require('fs');
const path = require('path');
const DATA_DIR = require('./dataDir');

const WHITELIST_FILE = path.join(DATA_DIR, 'ip-whitelist.json');
const BLACKLIST_FILE = path.join(DATA_DIR, 'ip-blacklist.json');

function ensureFile(file, envVar) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(file)) {
    // Seed from env var on first access (handles Vercel cold starts)
    const seed = (process.env[envVar] || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    fs.writeFileSync(file, JSON.stringify(seed, null, 2));
  }
}

function loadList(file, envVar) {
  ensureFile(file, envVar);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveList(file, list) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(list, null, 2));
}

function loadWhitelist()  { return loadList(WHITELIST_FILE, 'IP_WHITELIST'); }
function loadBlacklist()  { return loadList(BLACKLIST_FILE, 'IP_BLACKLIST'); }
function isWhitelisted(ip) { return loadWhitelist().includes(ip); }
function isBlacklisted(ip) { return loadBlacklist().includes(ip); }

function addToWhitelist(ip) {
  const list = loadWhitelist();
  if (!list.includes(ip)) { list.push(ip); saveList(WHITELIST_FILE, list); }
}
function removeFromWhitelist(ip) {
  saveList(WHITELIST_FILE, loadWhitelist().filter(i => i !== ip));
}

function addToBlacklist(ip) {
  const list = loadBlacklist();
  if (!list.includes(ip)) { list.push(ip); saveList(BLACKLIST_FILE, list); }
}
function removeFromBlacklist(ip) {
  saveList(BLACKLIST_FILE, loadBlacklist().filter(i => i !== ip));
}

module.exports = {
  loadWhitelist, loadBlacklist,
  isWhitelisted, isBlacklisted,
  addToWhitelist, removeFromWhitelist,
  addToBlacklist, removeFromBlacklist,
};
