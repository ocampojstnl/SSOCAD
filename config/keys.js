const fs = require('fs');
const path = require('path');

const KEYS_DIR = path.join(__dirname, '..', 'keys');

function loadPrivateKey() {
  const keyPath = path.join(KEYS_DIR, 'private.pem');
  if (!fs.existsSync(keyPath)) {
    throw new Error('RSA private key not found. Run: npm run generate-keys');
  }
  return fs.readFileSync(keyPath, 'utf8');
}

function loadPublicKey() {
  const keyPath = path.join(KEYS_DIR, 'public.pem');
  if (!fs.existsSync(keyPath)) {
    throw new Error('RSA public key not found. Run: npm run generate-keys');
  }
  return fs.readFileSync(keyPath, 'utf8');
}

module.exports = { loadPrivateKey, loadPublicKey };
