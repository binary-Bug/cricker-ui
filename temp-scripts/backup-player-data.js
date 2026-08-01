/**
 * One-off safety-net script: dumps every doc in the target mode's
 * PlayerData collection to a local timestamped JSON file, so there's a
 * restorable snapshot before running any destructive rewrite (e.g.
 * backfill-mvp-player-data.js, which deletes and rebuilds this collection
 * from scratch).
 *
 * Usage (from repo root, required --mode flag):
 *   node temp-scripts/backup-player-data.js --mode=test
 *   node temp-scripts/backup-player-data.js --mode=prod
 */

const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

// Same public client config already committed in src/app/app.config.ts.
const firebaseConfig = {
  apiKey: 'AIzaSyBLq32SteEldvV8zUCe2nD7rGUPEmfC_tA',
  authDomain: 'cricker-3b37d.firebaseapp.com',
  projectId: 'cricker-3b37d',
  storageBucket: 'cricker-3b37d.firebasestorage.app',
  messagingSenderId: '776618583257',
  appId: '1:776618583257:web:d38d5bc8ebf3f79dadcac8',
  measurementId: 'G-C1P4VYZWKD',
};

function parseMode() {
  const arg = process.argv.find((a) => a.startsWith('--mode='));
  const mode = arg ? arg.split('=')[1] : undefined;
  if (mode !== 'test' && mode !== 'prod') {
    console.error(
      'Missing/invalid --mode flag. Usage: node temp-scripts/backup-player-data.js --mode=test|prod'
    );
    process.exit(1);
  }
  return mode;
}

async function main() {
  const mode = parseMode();
  const playerCollectionName = mode === 'prod' ? 'PlayerData' : 'Test_PlayerData';

  const app = initializeApp(firebaseConfig);
  const firestore = getFirestore(app);

  console.log(`Backing up "${playerCollectionName}"...`);
  const snapshot = await getDocs(collection(firestore, playerCollectionName));

  const docsOut = snapshot.docs.map((d) => ({ id: d.id, data: d.data() }));

  const outDir = path.join(__dirname, 'backups');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outFile = path.join(outDir, `${playerCollectionName}-${stamp}.json`);
  fs.writeFileSync(outFile, JSON.stringify(docsOut, null, 2));

  console.log(`Backed up ${docsOut.length} doc(s) to ${outFile}`);
}

main().catch((err) => {
  console.error('Backup failed:', err);
  process.exit(1);
});
