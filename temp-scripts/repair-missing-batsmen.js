/**
 * One-off, TARGETED repair script for the "missing not-out batsman" bug.
 *
 * Root cause: SaveMatchService.filterIncorrectBatsmenData() strips any
 * Batsmens entry with runs===0 && balls===0 at save time, without adjusting
 * strikerIndex/nonStrikerIndex afterward. This correctly guards against
 * accidental mis-tap "new batsman" adds, but has a false-positive: a
 * genuine not-out survivor who never faced a ball (0 runs/0 balls) looks
 * identical to a bogus entry and gets stripped too, leaving
 * strikerIndex/nonStrikerIndex pointing out of bounds and the batsman
 * missing from the rendered scorecard.
 *
 * This script was NOT built by blindly re-adding every out-of-bounds case
 * found by scan-missing-batsmen.js. Each of the 5 cases below was manually
 * verified via inspect-match.js's per-ball striker/nonStriker snapshot data
 * (which proved the missing player's runs/balls stayed frozen at 0/0 across
 * every ball they appeared in - a real not-out survivor, not a mistake).
 * A 6th flagged case (hQBoYLK8aipdW6UJOT0m / "Saleel 11", missing name
 * "Null") was investigated and EXCLUDED on purpose: that team's Batsmens
 * array already contains all 6 real players for a 6-a-side team (with the
 * true not-out survivor "Pingu" already present) - "Null" was a bogus
 * extra entry that was correctly filtered, so nothing needs repairing there.
 *
 * For each of the 5 real cases, this script:
 *   1. Reads the match doc and re-validates the expected current state
 *      (Batsmens.length, the OOB index value, and that the missing name is
 *      NOT already present) before touching anything - refuses to act if
 *      reality has drifted from what was verified.
 *   2. Pushes { name, runs: 0, balls: 0, fours: 0, six: 0, status: 'Not Out' }
 *      onto that team's Batsmens array.
 *   3. Points whichever of strikerIndex/nonStrikerIndex was out-of-bounds at
 *      the new entry's index (Batsmens.length - 1). The other index (already
 *      in-bounds, just stale/unused for a completed match) is left untouched.
 *   4. Writes back via updateDoc, patching only `teamData.<team>.Batsmens`
 *      and `teamData.<team>.<strikerIndex|nonStrikerIndex>`.
 *
 * Usage (from repo root, required --mode flag):
 *   node temp-scripts/repair-missing-batsmen.js --mode=test
 *   node temp-scripts/repair-missing-batsmen.js --mode=prod
 *
 * Safe to re-run: each case is skipped (not re-applied) if the missing name
 * is already present in Batsmens.
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
      'Missing/invalid --mode flag. Usage: node temp-scripts/repair-missing-batsmen.js --mode=test|prod'
    );
    process.exit(1);
  }
  return mode;
}

// The 5 verified, targeted repairs. See file header for how these were
// derived - each `expected*` field is a guard, not an instruction: the
// script refuses to touch a doc whose live state no longer matches.
const REPAIRS = [
  {
    matchId: 'ZifObi45VGcaDILMPCYZ',
    teamKey: 'team2',
    teamLabel: 'Indra 11',
    missingName: 'Harsh',
    oobField: 'strikerIndex',
    expectedBatsmenLength: 6,
    expectedOobValue: 6,
  },
  {
    matchId: 'hQBoYLK8aipdW6UJOT0m',
    teamKey: 'team2',
    teamLabel: 'Shyam 11',
    missingName: 'Kunal',
    oobField: 'nonStrikerIndex',
    expectedBatsmenLength: 1,
    expectedOobValue: 1,
  },
  {
    matchId: 'qJxc4vndKZLQBmjhbN8T',
    teamKey: 'team2',
    teamLabel: 'Pingu 11',
    missingName: 'Bhavan',
    oobField: 'nonStrikerIndex',
    expectedBatsmenLength: 7,
    expectedOobValue: 7,
  },
  {
    matchId: 'y89evE7t5faPSwO1nebV',
    teamKey: 'team1',
    teamLabel: 'Punit 11',
    missingName: 'Punit',
    oobField: 'nonStrikerIndex',
    expectedBatsmenLength: 8,
    expectedOobValue: 8,
  },
  {
    matchId: 'y89evE7t5faPSwO1nebV',
    teamKey: 'team2',
    teamLabel: 'Jai 11',
    missingName: 'Gaurav',
    oobField: 'nonStrikerIndex',
    expectedBatsmenLength: 8,
    expectedOobValue: 8,
  },
];

async function main() {
  const mode = parseMode();
  const collectionName = mode === 'prod' ? 'MatchData' : 'Test_MatchData';

  const app = initializeApp(firebaseConfig);
  const firestore = getFirestore(app);

  console.log(`Running missing-batsmen repair in ${mode} mode against "${collectionName}"...\n`);

  let repaired = 0;
  let skipped = 0;

  for (const repair of REPAIRS) {
    const { matchId, teamKey, teamLabel, missingName, oobField, expectedBatsmenLength, expectedOobValue } = repair;
    const label = `${matchId} / ${teamKey} (${teamLabel})`;

    const docRef = doc(firestore, collectionName, matchId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      console.log(`  SKIP  ${label}: no such doc in ${collectionName}`);
      skipped++;
      continue;
    }

    const data = snap.data();
    const team = data.teamData?.[teamKey];
    if (!team) {
      console.log(`  SKIP  ${label}: teamData.${teamKey} missing`);
      skipped++;
      continue;
    }

    const batsmens = team.Batsmens || [];

    // Idempotency guard: already repaired (or never actually broken).
    if (batsmens.some((b) => b.name === missingName)) {
      console.log(`  SKIP  ${label}: "${missingName}" already present in Batsmens - nothing to do`);
      skipped++;
      continue;
    }

    // Drift guard: refuse to act if live state no longer matches what was
    // manually verified before writing this script.
    if (batsmens.length !== expectedBatsmenLength || team[oobField] !== expectedOobValue) {
      console.log(
        `  SKIP  ${label}: state drifted from expected (Batsmens.length=${batsmens.length}, ${oobField}=${team[oobField]}; expected ${expectedBatsmenLength}/${expectedOobValue}) - refusing to touch, investigate manually`
      );
      skipped++;
      continue;
    }

    const newBatsmen = { name: missingName, runs: 0, balls: 0, fours: 0, six: 0, status: 'Not Out' };
    const updatedBatsmens = [...batsmens, newBatsmen];
    const newIndex = updatedBatsmens.length - 1;

    console.log(`  FIX   ${label}: adding "${missingName}" (Not Out, 0/0) at index ${newIndex}, ${oobField}: ${team[oobField]} -> ${newIndex}`);

    await updateDoc(docRef, {
      [`teamData.${teamKey}.Batsmens`]: updatedBatsmens,
      [`teamData.${teamKey}.${oobField}`]: newIndex,
    });

    repaired++;
  }

  console.log(`\nDone. Repaired: ${repaired}, Skipped: ${skipped}, Total: ${REPAIRS.length}`);
}

main().catch((err) => {
  console.error('Repair failed:', err);
  process.exit(1);
});
