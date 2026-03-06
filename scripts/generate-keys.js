/**
 * Generates a 2048-bit RSA key pair for JWT signing.
 * Private key: keys/private.pem  (keep secret, never commit)
 * Public key:  keys/public.pem   (paste into WordPress plugin settings)
 */
const { generateKeyPairSync } = require('crypto');
const fs = require('fs');
const path = require('path');

const KEYS_DIR = path.join(__dirname, '..', 'keys');

if (!fs.existsSync(KEYS_DIR)) {
  fs.mkdirSync(KEYS_DIR, { recursive: true });
}

const privateKeyPath = path.join(KEYS_DIR, 'private.pem');
if (fs.existsSync(privateKeyPath)) {
  console.log('Keys already exist. Delete keys/private.pem and keys/public.pem to regenerate.');
  process.exit(0);
}

console.log('Generating 2048-bit RSA key pair...');

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

fs.writeFileSync(path.join(KEYS_DIR, 'private.pem'), privateKey, { mode: 0o600 });
fs.writeFileSync(path.join(KEYS_DIR, 'public.pem'), publicKey);

console.log('Done!');
console.log('  keys/private.pem — keep this secret, never commit to git');
console.log('  keys/public.pem  — paste into WordPress plugin settings\n');
console.log('=== PUBLIC KEY (copy to WordPress plugin) ===');
console.log(publicKey);
