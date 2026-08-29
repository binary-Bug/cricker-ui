/**
 * One-off, TARGETED repair script for match TH8yxZlKHOXKqc2NTmMn.
 *
 * Root cause: in the 2nd innings, over 10 (overIndex 9), three real events
 * were never scored:
 *   - ball 10.3 (ballIndex 2): Santosh (non-striker) retired; Pranay came in
 *     as the new non-striker.
 *   - ball 10.4 (ballIndex 3): Harsh (striker) was actually out Caught
 *     (fielder Bharath, bowler Punit) - recorded in prod as a plain dot ball.
 *   - balls 10.5/10.6 (ballIndex 4-5): Santosh (re-entering, reusing his own
 *     existing Batsmens entry - not a new one) faced both deliveries and
 *     scored a double on each (4 runs total) - prod currently credits all of
 *     this to Harsh, who should have been long gone by then.
 *
 * These values were derived from a manual, code-verified reconstruction
 * (see /memories/session/plan.md) and cross-checked against the actual live
 * prod document (temp-scripts/inspect-match.js + a supplementary read-only
 * query) before writing this script - not assumed.
 *
 * Verified-current-state guard: re-fetches the doc and refuses to write
 * unless every value below still matches exactly what was verified.
 * Idempotency guard: skips (no-op) if ball 10.4 already has class 'wicket'.
 *
 * Usage (from repo root):
 *   node temp-scripts/fix-TH8yxZlKHOXKqc2NTmMn-wicket-ball.js --mode=test
 *   node temp-scripts/fix-TH8yxZlKHOXKqc2NTmMn-wicket-ball.js --mode=prod
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, updateDoc } = require('firebase/firestore');

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
      'Missing/invalid --mode flag. Usage: node temp-scripts/fix-TH8yxZlKHOXKqc2NTmMn-wicket-ball.js --mode=test|prod'
    );
    process.exit(1);
  }
  return mode;
}

const MATCH_ID = 'TH8yxZlKHOXKqc2NTmMn';

async function main() {
  const mode = parseMode();
  const collectionName = mode === 'prod' ? 'MatchData' : 'Test_MatchData';

  const app = initializeApp(firebaseConfig);
  const firestore = getFirestore(app);
  const ref = doc(firestore, collectionName, MATCH_ID);

  const snap = await getDoc(ref);
  if (!snap.exists()) {
    console.error(`No such doc: ${collectionName}/${MATCH_ID}`);
    process.exit(1);
  }
  const data = snap.data();
  const team1 = data.teamData.team1;
  // oversPlayedData itself is a real Firestore array (10 overs); each
  // individual over is a plain map keyed by ball index (Firestore doesn't
  // support nested arrays). Never dot-path into the array - always mutate
  // a full clone and write the whole `oversPlayedData` field back at once.
  const over9Map = team1.oversPlayedData[9];
  const over9 = Object.values(over9Map || {});
  const ball3 = over9[3]; // 10.4

  // Idempotency guard.
  if (ball3.class === 'wicket') {
    console.log('Already fixed (ball 10.4 is already class "wicket") - skipping.');
    return;
  }

  // Drift guard: refuse to write unless the doc still matches exactly what
  // was verified before this script was written.
  const santosh = team1.Batsmens[3];
  const harsh = team1.Batsmens[4];
  const bowlersTeam2 = data.teamData.team2.Bowlers;
  const punitBowler = bowlersTeam2.find((b) => b.name === 'Punit');
  const fieldersTeam2 = data.teamData.team2.Fielders;

  const expectations = [
    team1.wicketsLost === 3,
    team1.strikerIndex === 3,
    team1.nonStrikerIndex === 4,
    team1.Batsmens.length === 5,
    santosh.name === 'Santosh' && santosh.runs === 14 && santosh.balls === 22 && santosh.status === 'Not Out',
    harsh.name === 'Harsh' && harsh.runs === 13 && harsh.balls === 13 && harsh.status === 'Not Out',
    over9.length === 6,
    over9[2].class === 'run' && over9[2].label === '2' && over9[2].nonStriker.name === 'Santosh',
    ball3.class === 'dot' && ball3.label === '0' && ball3.wicketsLost === 3 && ball3.striker.name === 'Harsh' && ball3.striker.runs === 9 && ball3.striker.balls === 11,
    over9[4].striker.name === 'Harsh' && over9[4].striker.runs === 11 && over9[4].striker.balls === 12 && over9[4].label === '2',
    over9[5].striker.name === 'Harsh' && over9[5].striker.runs === 13 && over9[5].striker.balls === 13 && over9[5].label === '2',
    punitBowler && punitBowler.wickets === 1,
    fieldersTeam2.every((f) => f.name !== 'Bharath'),
    data.MatchResult === 'Sahil 11 wins by 2 wicket(s)',
  ];
  if (expectations.some((ok) => !ok)) {
    console.error('Current doc state does not match verified expectations - refusing to write. Re-inspect before retrying.');
    process.exit(1);
  }

  // --- Build the patch ---
  const pranay = { name: 'Pranay', runs: 0, balls: 0, fours: 0, six: 0, status: 'Not Out', strikeRate: NaN };
  const santoshAtReentry = { name: 'Santosh', runs: 14, balls: 22, fours: 3, six: 0, status: 'Not Out', strikeRate: santosh.strikeRate };
  const santoshAfterBall5 = { name: 'Santosh', runs: 16, balls: 23, fours: 3, six: 0, status: 'Not Out', strikeRate: (16 / 23) * 100 };
  const santoshAfterBall6 = { name: 'Santosh', runs: 18, balls: 24, fours: 3, six: 0, status: 'Not Out', strikeRate: (18 / 24) * 100 };

  const newBatsmens = team1.Batsmens.map((b) => ({ ...b }));
  newBatsmens[3] = { name: 'Santosh', runs: 18, balls: 24, fours: 3, six: 0, status: 'Not Out', strikeRate: (18 / 24) * 100 };
  newBatsmens[4] = { name: 'Harsh', runs: 9, balls: 11, fours: harsh.fours, six: harsh.six, status: 'c Bharath b Punit', strikeRate: (9 / 11) * 100 };
  newBatsmens.push(pranay);

  const newBowlers = bowlersTeam2.map((b) => ({ ...b }));
  const punitIdx = newBowlers.findIndex((b) => b.name === 'Punit');
  newBowlers[punitIdx] = { ...newBowlers[punitIdx], wickets: newBowlers[punitIdx].wickets + 1 };

  const newFielders = fieldersTeam2.map((f) => ({ ...f }));
  newFielders.push({ name: 'Bharath', catches: 1, stumpOuts: 0, runOuts: 0 });

  // Clone the full oversPlayedData array and only replace over index 9's
  // map (balls 2-5); balls 0-1 and overs 0-8 are carried over unchanged.
  const newOver9 = { ...over9Map };
  newOver9['2'] = { ...newOver9['2'], nonStriker: pranay };
  newOver9['3'] = {
    ...newOver9['3'],
    class: 'wicket',
    label: 'W',
    wicketsLost: 4,
    striker: santoshAtReentry,
    nonStriker: pranay,
  };
  newOver9['4'] = { ...newOver9['4'], wicketsLost: 4, striker: santoshAfterBall5, nonStriker: pranay };
  newOver9['5'] = { ...newOver9['5'], wicketsLost: 4, striker: santoshAfterBall6, nonStriker: pranay };

  const newOversPlayedData = [...team1.oversPlayedData];
  newOversPlayedData[9] = newOver9;

  const patch = {
    'teamData.team1.wicketsLost': 4,
    'teamData.team1.nonStrikerIndex': 5,
    'teamData.team1.Batsmens': newBatsmens,
    'teamData.team2.Bowlers': newBowlers,
    'teamData.team2.Fielders': newFielders,
    'teamData.team1.oversPlayedData': newOversPlayedData,
    MatchResult: 'Sahil 11 wins by 1 wicket(s)',
  };

  console.log('All guards passed. Writing patch...');
  await updateDoc(ref, patch);
  console.log('Done.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fix failed:', err);
    process.exit(1);
  });
