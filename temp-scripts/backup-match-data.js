/**
 * One-off safety-net script: dumps a single MatchData doc to a local
 * timestamped JSON file, so there's a restorable snapshot before running
 * any targeted repair script against that match's data.
 *
 * Usage (from repo root, required --mode and --id flags):
 *   node temp-scripts/backup-match-data.js --mode=test --id=<matchDocId>
 *   node temp-scripts/backup-match-data.js --mode=prod --id=<matchDocId>
 */

const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');

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

function parseArg(name) {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : undefined;
}

async function main() {
  const mode = parseArg('mode');
  const id = parseArg('id');
  if ((mode !== 'test' && mode !== 'prod') || !id) {
    console.error(
      'Usage: node temp-scripts/backup-match-data.js --mode=test|prod --id=<matchDocId>'
    );
    process.exit(1);
  }
  const collectionName = mode === 'prod' ? 'MatchData' : 'Test_MatchData';

  const app = initializeApp(firebaseConfig);
  const firestore = getFirestore(app);

  console.log(`Backing up "${collectionName}/${id}"...`);
  const snap = await getDoc(doc(firestore, collectionName, id));
  if (!snap.exists()) {
    console.error(`No such doc: ${collectionName}/${id}`);
    process.exit(1);
  }

  const outDir = path.join(__dirname, 'backups');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outFile = path.join(outDir, `${collectionName}-${id}-${stamp}.json`);
  fs.writeFileSync(outFile, JSON.stringify({ id: snap.id, data: snap.data() }, null, 2));

  console.log(`Backed up doc to ${outFile}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Backup failed:', err);
    process.exit(1);
  });
