/**
 * build-config.js
 * Automatically generates config.js and config.json from .env or environment variables (e.g. GitHub Secrets).
 * Run: node build-config.js
 */
const fs = require('fs');
const path = require('path');

// 1. Parse .env file if present
const envPath = path.join(__dirname, '.env');
const env = { ...process.env };

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  });
}

// 2. Parse complete JSON object or assemble from individual variables
let configs = null;

if (env.FIREBASE_CONFIGS) {
  try {
    configs = JSON.parse(env.FIREBASE_CONFIGS);
  } catch (err) {
    console.warn('⚠️ Warning: Could not parse FIREBASE_CONFIGS as JSON, falling back to individual keys.');
  }
}

if (!configs) {
  configs = {
    adminConfig: {
      apiKey: env.FIREBASE_ADMIN_API_KEY || "YOUR_ADMIN_API_KEY",
      authDomain: env.FIREBASE_ADMIN_AUTH_DOMAIN || "beatwave-c8c83.firebaseapp.com",
      databaseURL: env.FIREBASE_ADMIN_DATABASE_URL || "https://beatwave-c8c83-default-rtdb.firebaseio.com",
      projectId: env.FIREBASE_ADMIN_PROJECT_ID || "beatwave-c8c83",
      storageBucket: env.FIREBASE_ADMIN_STORAGE_BUCKET || "beatwave-c8c83.firebasestorage.app",
      messagingSenderId: env.FIREBASE_ADMIN_MESSAGING_SENDER_ID || "688403604681",
      appId: env.FIREBASE_ADMIN_APP_ID || "1:688403604681:web:b287a9d06c74dceb081918",
      measurementId: env.FIREBASE_ADMIN_MEASUREMENT_ID || "G-HRPVTR86RF"
    },
    playerConfig: {
      apiKey: env.FIREBASE_PLAYER_API_KEY || "YOUR_PLAYER_API_KEY",
      authDomain: env.FIREBASE_PLAYER_AUTH_DOMAIN || "waveweb-4e8b0.firebaseapp.com",
      databaseURL: env.FIREBASE_PLAYER_DATABASE_URL || "https://waveweb-4e8b0-default-rtdb.firebaseio.com",
      projectId: env.FIREBASE_PLAYER_PROJECT_ID || "waveweb-4e8b0",
      storageBucket: env.FIREBASE_PLAYER_STORAGE_BUCKET || "waveweb-4e8b0.firebasestorage.app",
      messagingSenderId: env.FIREBASE_PLAYER_MESSAGING_SENDER_ID || "774049527208",
      appId: env.FIREBASE_PLAYER_APP_ID || "1:774049527208:web:3f93dbdf4984d58ad6599d"
    }
  };
}

// 3. Write config.js and config.json
const configJsContent = `const firebaseConfigs = ${JSON.stringify(configs, null, 2)};\n`;
fs.writeFileSync(path.join(__dirname, 'config.js'), configJsContent, 'utf8');
fs.writeFileSync(path.join(__dirname, 'config.json'), JSON.stringify(configs, null, 2) + '\n', 'utf8');

console.log('✅ Generated config.js and config.json successfully from environment variables.');
