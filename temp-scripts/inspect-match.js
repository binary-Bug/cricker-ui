/**
 * One-off, READ-ONLY inspection script: dumps a single match document's
 * teamData (Batsmens/Bowlers/Fielders/runsScored/wicketsLost/etc.) for
 * debugging a specific match's data. Does not write anything.
 *
 * Usage (from repo root):
 *   node temp-scripts/inspect-match.js --mode=prod --id=<matchDocId>
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');

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
      'Usage: node temp-scripts/inspect-match.js --mode=test|prod --id=<matchDocId>'
    );
    process.exit(1);
  }
  const collectionName = mode === 'prod' ? 'MatchData' : 'Test_MatchData';

  const app = initializeApp(firebaseConfig);
  const firestore = getFirestore(app);

  const snap = await getDoc(doc(firestore, collectionName, id));
  if (!snap.exists()) {
    console.error(`No such doc: ${collectionName}/${id}`);
    process.exit(1);
  }
  const data = snap.data();

  ['team1', 'team2'].forEach((teamKey) => {
    const team = data.teamData?.[teamKey];
    if (!team) {
      console.log(`${teamKey}: MISSING`);
      return;
    }
    console.log(`\n=== ${teamKey}: ${team.name} ===`);
    console.log(`runsScored/wicketsLost: ${team.runsScored}/${team.wicketsLost}, oversPlayed: ${team.oversPlayed}`);
    console.log(`Batsmens (${(team.Batsmens || []).length}):`);
    (team.Batsmens || []).forEach((b, i) => {
      console.log(`  [${i}] ${b.name} - runs:${b.runs} balls:${b.balls} status:"${b.status}"`);
    });
    console.log(`strikerIndex: ${team.strikerIndex}, nonStrikerIndex: ${team.nonStrikerIndex}`);

    // Dump the last few balls' striker/nonStriker names + wicketsLost from
    // the raw ball-by-ball data, to see exactly who was at the crease when
    // the innings ended (useful for spotting a batsman who never got
    // formally added to Batsmens).
    const overs = team.oversPlayedData || [];
    console.log(`oversPlayedData: ${overs.length} over(s), type of overs[0]: ${typeof overs[0]}, isArray: ${Array.isArray(overs[0])}`);
    const lastFewBalls = [];
    overs.forEach((over, oi) => {
      const ballsInOver = Array.isArray(over) ? over : Object.values(over || {});
      ballsInOver.forEach((ball, bi) => {
        if (ball && ball.hasBeenBowled) {
          lastFewBalls.push({
            over: oi,
            ball: bi,
            striker: ball.striker?.name,
            strikerRuns: ball.striker?.runs,
            strikerBalls: ball.striker?.balls,
            nonStriker: ball.nonStriker?.name,
            nonStrikerRuns: ball.nonStriker?.runs,
            nonStrikerBalls: ball.nonStriker?.balls,
            wicketsLost: ball.wicketsLost,
            label: ball.label,
          });
        }
      });
    });
    console.log('All bowled balls:');
    lastFewBalls.forEach((b) =>
      console.log(
        `  over ${b.over}.${b.ball} - striker:${b.striker}(${b.strikerRuns}/${b.strikerBalls}) nonStriker:${b.nonStriker}(${b.nonStrikerRuns}/${b.nonStrikerBalls}) wkts:${b.wicketsLost} label:${b.label}`
      )
    );
  });

  console.log(`\ntotalPlayers: ${data.totalPlayers}`);
  console.log(`totalOvers: ${data.totalOvers}`);
  console.log(`MatchResult: ${data.MatchResult}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Inspect failed:', err);
    process.exit(1);
  });
