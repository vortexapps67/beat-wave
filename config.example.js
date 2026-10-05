/**
 * config.example.js
 * Template configuration for BeatWave.
 * In production/local development, config.js is automatically generated from .env
 * using `node build-config.js` or via GitHub Actions Secrets.
 */
const firebaseConfigs = {
  "adminConfig": {
    "apiKey": "YOUR_ADMIN_FIREBASE_API_KEY",
    "authDomain": "beatwave-c8c83.firebaseapp.com",
    "databaseURL": "https://beatwave-c8c83-default-rtdb.firebaseio.com",
    "projectId": "beatwave-c8c83",
    "storageBucket": "beatwave-c8c83.firebasestorage.app",
    "messagingSenderId": "YOUR_MESSAGING_SENDER_ID",
    "appId": "YOUR_ADMIN_APP_ID",
    "measurementId": "YOUR_MEASUREMENT_ID"
  },
  "playerConfig": {
    "apiKey": "YOUR_PLAYER_FIREBASE_API_KEY",
    "authDomain": "waveweb-4e8b0.firebaseapp.com",
    "databaseURL": "https://waveweb-4e8b0-default-rtdb.firebaseio.com",
    "projectId": "waveweb-4e8b0",
    "storageBucket": "waveweb-4e8b0.firebasestorage.app",
    "messagingSenderId": "YOUR_MESSAGING_SENDER_ID",
    "appId": "YOUR_PLAYER_APP_ID"
  }
};
