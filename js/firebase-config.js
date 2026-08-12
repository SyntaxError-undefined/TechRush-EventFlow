const runtimeEnv = window.__EVENTFLOW_ENV__ || {};
window.EVENTFLOW_FIREBASE_CONFIG = window.EVENTFLOW_FIREBASE_CONFIG || window.__EVENTFLOW_FIREBASE_CONFIG__ || {
  apiKey: runtimeEnv.FIREBASE_API_KEY || 'AIzaSyAZCSzuUUnZeotYmc6s8FzE3G3OSrKh6aE',
  authDomain: runtimeEnv.FIREBASE_AUTH_DOMAIN || 'new-project-2fcef.firebaseapp.com',
  databaseURL: runtimeEnv.FIREBASE_DATABASE_URL || 'https://new-project-2fcef-default-rtdb.firebaseio.com',
  projectId: runtimeEnv.FIREBASE_PROJECT_ID || 'new-project-2fcef',
  storageBucket: runtimeEnv.FIREBASE_STORAGE_BUCKET || 'new-project-2fcef.firebasestorage.app',
  messagingSenderId: runtimeEnv.FIREBASE_MESSAGING_SENDER_ID || '888327585363',
  appId: runtimeEnv.FIREBASE_APP_ID || '1:888327585363:web:efa3486a8b6841ae4710a6',
  measurementId: runtimeEnv.FIREBASE_MEASUREMENT_ID || 'G-0C4HY1S3ZV'
};
