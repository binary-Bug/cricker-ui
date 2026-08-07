/**
 * One-off, READ-ONLY scan script: finds prod (or test) match documents
 * where a team's strikerIndex/nonStrikerIndex points past the end of its
 * own Batsmens array (i.e. >= Batsmens.length). That mismatch is the
 * telltale sign of a batsman who was at the crease (per the ball-by-ball
 * oversPlayedData) but was never actually pushed into the Batsmens array -
 * see the ZifObi45VGcaDILMPCYZ "Harsh" investigation.
 *
 * Does not write anything - only reads and reports.
 *
 * Usage (from repo root):
 *   node temp-scripts/scan-missing-batsmen.js --mode=prod
 *   node temp-scripts/scan-missing-batsmen.js --mode=test
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

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
      'Missing/invalid --mode flag. Usage: node temp-scripts/scan-missing-batsmen.js --mode=test|prod'
    );
    process.exit(1);
  }
  return mode;
}

/**
 * Finds the name of the batsman at the crease at the very last bowled ball
 * of this team's innings for the given index field ('striker' or
 * 'nonStriker'), by scanning oversPlayedData backwards. Used only to
 * report a human-readable "who's likely missing" hint - the actual repair
 * script will need to do a fuller reconstruction (runs/balls/dismissal).
 */
function findNameAtCreaseFromBallLog(team, field) {
  const overs = team.oversPlayedData || [];
  for (let oi = overs.length - 1; oi >= 0; oi--) {
    const over = overs[oi];
    const balls = Array.isArray(over) ? over : Object.values(over || {});
    for (let bi = balls.length - 1; bi >= 0; bi--) {
      const ball = balls[bi];
      if (ball && ball.hasBeenBowled && ball[field] && ball[field].name) {
        return ball[field].name;
      }
    }
  }
  return undefined;
}

async function main() {
  const mode = parseMode();
  const collectionName = mode === 'prod' ? 'MatchData' : 'Test_MatchData';

  console.log(`Scanning "${collectionName}" for strikerIndex/nonStrikerIndex out of bounds...`);

  const app = initializeApp(firebaseConfig);
  const firestore = getFirestore(app);

  const snapshot = await getDocs(collection(firestore, collectionName));
  console.log(`Found ${snapshot.docs.length} match(es).`);

  let affectedCount = 0;

  snapshot.docs.forEach((matchDoc) => {
    const data = matchDoc.data();
    ['team1', 'team2'].forEach((teamKey) => {
      const team = data.teamData && data.teamData[teamKey];
      if (!team) return;

      const batsmenLength = (team.Batsmens || []).length;
      const si = team.strikerIndex;
      const nsi = team.nonStrikerIndex;

      const strikerOOB = typeof si === 'number' && si >= batsmenLength;
      const nonStrikerOOB = typeof nsi === 'number' && nsi >= batsmenLength;

      if (strikerOOB || nonStrikerOOB) {
        affectedCount++;
        console.log(`\n=== ${matchDoc.id} - ${teamKey} (${team.name}) ===`);
        console.log(
          `  Batsmens.length: ${batsmenLength}, strikerIndex: ${si}, nonStrikerIndex: ${nsi}`
        );
        console.log(
          `  runsScored/wicketsLost: ${team.runsScored}/${team.wicketsLost}, oversPlayed: ${team.oversPlayed}`
        );
        if (strikerOOB) {
          const guess = findNameAtCreaseFromBallLog(team, 'striker');
          console.log(`  Likely missing striker (from ball log): ${guess}`);
        }
        if (nonStrikerOOB) {
          const guess = findNameAtCreaseFromBallLog(team, 'nonStriker');
          console.log(`  Likely missing non-striker (from ball log): ${guess}`);
        }
      }
    });
  });

  console.log(`\nDone. ${affectedCount} team-innings affected out of ${snapshot.docs.length} match(es) checked.`);
}

main().catch((err) => {
  console.error('Scan failed:', err);
  process.exit(1);
});
