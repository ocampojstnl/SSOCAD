const fs   = require('fs');
const path = require('path');

const WHITELIST_FILE = path.join(__dirname, '..', 'data', 'ip-whitelist.json');
const BLACKLIST_FILE = path.join(__dirname, '..', 'data', 'ip-blacklist.json');

function ensureFile(file) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir))  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, '[]');
}

function loadList(file) {
  ensureFile(file);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveList(file, list) {
  ensureFile(file);
  fs.writeFileSync(file, JSON.stringify(list, null, 2));
}

function loadWhitelist()  { return loadList(WHITELIST_FILE); }
function loadBlacklist()  { return loadList(BLACKLIST_FILE); }
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
