const fs   = require('fs');
const path = require('path');

const SITES_FILE = path.join(__dirname, '..', 'data', 'sites.json');

function ensureFile() {
  const dir = path.dirname(SITES_FILE);
  if (!fs.existsSync(dir))       fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(SITES_FILE)) fs.writeFileSync(SITES_FILE, '[]');
}

function loadSites() {
  ensureFile();
  return JSON.parse(fs.readFileSync(SITES_FILE, 'utf8'));
}

function saveSites(sites) {
  ensureFile();
  fs.writeFileSync(SITES_FILE, JSON.stringify(sites, null, 2));
}

/**
 * Upsert a site registration by site_id.
 * Partial updates are supported — only provided fields are overwritten.
 */
function registerSite({ site_id, domain, owner_email, plugin_version }) {
  const sites = loadSites();
  const now   = new Date().toISOString();
  const idx   = sites.findIndex(s => s.site_id === site_id);

  if (idx >= 0) {
    sites[idx] = {
      ...sites[idx],
      domain,
      plugin_version,
      ...(owner_email ? { owner_email } : {}),
      last_seen: now,
    };
  } else {
    sites.push({
      site_id,
      domain,
      owner_email: owner_email || null,
      plugin_version,
      registered_at: now,
      last_seen: now,
    });
  }

  saveSites(sites);
}

function updateSitePing(site_id, domain) {
  const sites = loadSites();
  const site  = sites.find(s => s.site_id === site_id);
  if (site) {
    site.last_seen = new Date().toISOString();
    if (domain) site.domain = domain;
    saveSites(sites);
  }
  return site || null;
}

function getSite(site_id) {
  return loadSites().find(s => s.site_id === site_id) || null;
}

module.exports = { loadSites, registerSite, updateSitePing, getSite };
