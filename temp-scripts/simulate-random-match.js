/**
 * One-off test-data generator: builds a full, internally-consistent random
 * cricket match (toss, two realistic ball-by-ball innings of 6-15 overs
 * with 6-11 players/team, fall of wickets, partnerships, extras, a match
 * result) and writes it to "Test_MatchData" - then fully recomputes
 * "Test_PlayerData" exactly the way a real completed match does (stats +
 * MVP rollup + delete-all/reinsert-all), so you don't have to manually
 * score a throwaway match through the UI just to get realistic test data
 * for new features (e.g. Fall of Wickets / Partnerships).
 *
 * This is a from-scratch simulation engine (not a port of any single
 * existing file), but it deliberately mirrors the exact data shapes and
 * bookkeeping rules of the real app so the generated match is fully
 * compatible with every screen that reads it:
 *   - src/app/services/live-match.service.ts - ball-by-ball state rules
 *     (over completion, extras bookkeeping quirks, partnership reset,
 *     bowler stats/maidens, strike-swap rules).
 *   - src/app/services/match.service.ts - dismissal status string formats
 *     (updateBatsmenStatus), second-innings target/required-run-rate calc.
 *   - src/app/services/save-match.service.ts - exact match-document field
 *     shape, and critically: oversPlayedData is saved as an array of
 *     INDEX-KEYED OBJECTS ({0: ball, 1: ball, ...}), never a nested array,
 *     because Firestore does not support arrays-of-arrays.
 *   - src/app/components/dailogs/match-complete.dialog.ts - MatchResult
 *     string format ("X wins by N wicket(s)" / "X wins by N runs" /
 *     "Match Tied").
 *   - MVP scoring + PlayerData recompute logic is duplicated from
 *     temp-scripts/backfill-mvp-player-data.js (already a faithful port of
 *     src/app/services/mvp-calculator.service.ts + player.service.ts),
 *     rather than re-derived here, per this repo's existing convention of
 *     duplicating that logic per standalone script.
 *
 * IMPORTANT quirk this deliberately replicates: on the ball a wicket falls,
 * the ball's own striker/nonStriker snapshot must show the REPLACEMENT
 * batsman's pairing, not the outgoing one - this matches what the real app
 * always produces (see LiveMatchService.checkForExtras_And_AddRun's double
 * updatePlayerData() call), and PartnershipService's Fall-of-Wickets/
 * Partnerships derivation is specifically built around that quirk.
 * Generating "clean" data here would silently break that feature's
 * dismissal-attribution logic for these fake matches.
 *
 * Usage (from repo root, no flags/args):
 *   node temp-scripts/simulate-random-match.js
 *
 * Always writes to Test_MatchData / Test_PlayerData - never touches prod
 * data. Run it as many times as you like; each run is one new match.
 */

const { initializeApp } = require('firebase/app');
const {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
} = require('firebase/firestore');

// Same public client config already committed in src/app/app.config.ts -
// the app itself writes to Firestore unauthenticated with this config, so
// this standalone script can safely reuse it the same way (see the other
// temp-scripts/*.js files).
const firebaseConfig = {
  apiKey: 'AIzaSyBLq32SteEldvV8zUCe2nD7rGUPEmfC_tA',
  authDomain: 'cricker-3b37d.firebaseapp.com',
  projectId: 'cricker-3b37d',
  storageBucket: 'cricker-3b37d.firebasestorage.app',
  messagingSenderId: '776618583257',
  appId: '1:776618583257:web:d38d5bc8ebf3f79dadcac8',
  measurementId: 'G-C1P4VYZWKD',
};

const MATCH_COLLECTION = 'Test_MatchData';
const PLAYER_COLLECTION = 'Test_PlayerData';
const MVP_CONFIG_COLLECTION = 'MvpConfig';

// ---------------------------------------------------------------------------
// RNG helpers
// ---------------------------------------------------------------------------

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** options: [{ value, weight }, ...] - picks one value with probability proportional to its weight. */
function weightedPick(options) {
  const total = options.reduce((sum, o) => sum + o.weight, 0);
  let r = Math.random() * total;
  for (const o of options) {
    r -= o.weight;
    if (r <= 0) return o.value;
  }
  return options[options.length - 1].value;
}

// ---------------------------------------------------------------------------
// Static data pools
// ---------------------------------------------------------------------------

const TEAM_NAMES = [
  'Thunder Strikers',
  'Royal Challengers',
  'Super Kings',
  'Titans',
  'Desert Warriors',
  'Coastal Giants',
  'Falcons',
  'Night Panthers',
  'Knight Riders',
  'Sunrisers',
  'Blazing Bulls',
  'Mountain Monarchs',
];

const FIRST_NAMES = [
  'Aarav', 'Vihaan', 'Kabir', 'Rohan', 'Aditya', 'Ishaan', 'Arjun', 'Dev',
  'Liam', 'Noah', 'Ethan', 'Mason', 'Lucas', 'Oliver', 'James', 'Henry',
  'Ben', 'Sam', 'Josh', 'Tom', 'Jack', 'Ryan', 'Marcus', 'Andre',
  'Kwame', 'Junaid', 'Zaid', 'Farhan', 'Imran', 'Rizwan',
];

const LAST_NAMES = [
  'Sharma', 'Verma', 'Patel', 'Khan', 'Singh', 'Iyer', 'Nair', 'Gupta',
  'Carter', 'Bennett', 'Walker', 'Foster', 'Hayes', 'Cole', 'Mitchell',
  'Reid', 'Douglas', 'Brooks', 'Sinclair', 'Whitfield', 'Rahman', 'Ahmed',
  'Okafor', 'Mensah', 'Botha', 'Klein', 'Rossi', 'Dubois',
];

function generateFictitiousName(usedNames) {
  let name;
  do {
    name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
  } while (usedNames.has(name));
  usedNames.add(name);
  return name;
}

const RUN_OUTCOME_WEIGHTS = [
  { value: 'dot', weight: 32 },
  { value: 'run1', weight: 24 },
  { value: 'run2', weight: 8 },
  { value: 'run3', weight: 1 },
  { value: 'four', weight: 9 },
  { value: 'six', weight: 4 },
  { value: 'wide', weight: 7 },
  { value: 'noball', weight: 3 },
  { value: 'legbye', weight: 3 },
  { value: 'bye', weight: 2 },
  { value: 'wicket', weight: 6 },
];

const WICKET_TYPE_WEIGHTS = [
  { value: 'Bowled', weight: 28 },
  { value: 'Caught', weight: 42 },
  { value: 'LBW', weight: 12 },
  { value: 'Run-out', weight: 10 },
  { value: 'Stumped', weight: 6 },
  { value: 'Hit-Wicket', weight: 2 },
];

const WIDE_EXTRA_RUN_WEIGHTS = [
  { value: 0, weight: 80 },
  { value: 1, weight: 15 },
  { value: 2, weight: 5 },
];

const NOBALL_BAT_RUN_WEIGHTS = [
  { value: 0, weight: 55 },
  { value: 1, weight: 25 },
  { value: 2, weight: 5 },
  { value: 4, weight: 10 },
  { value: 6, weight: 5 },
];

const BYE_RUN_WEIGHTS = [
  { value: 1, weight: 70 },
  { value: 2, weight: 20 },
  { value: 4, weight: 10 },
];

// ---------------------------------------------------------------------------
// Utility conversions - mirrors UtilityService.ballplayed/convertToOvers
// ---------------------------------------------------------------------------

function ballplayed(oversPlayed) {
  if (!oversPlayed) return 0;
  const ballsInOver =
    +parseFloat(oversPlayed - Math.trunc(oversPlayed) + '').toFixed(1) * 10;
  const completedOversBalls = Math.trunc(oversPlayed) * 6;
  return completedOversBalls + ballsInOver;
}

function convertToOvers(balls) {
  if (!balls) return 0;
  const completedOvers = Math.trunc(balls / 6);
  const ballsLeftInOver = balls - completedOvers * 6;
  return +(completedOvers + '.' + ballsLeftInOver);
}

// ---------------------------------------------------------------------------
// Data factories - mirror src/app/models/*.interface.ts + ball_data.class.ts
// ---------------------------------------------------------------------------

function newBatsman(name) {
  return { name, runs: 0, balls: 0, fours: 0, six: 0, status: 'Not Out' };
}

function newBowler(name) {
  return {
    name,
    runs: 0,
    overs: 0,
    maidens: 0,
    wickets: 0,
    extras: { w: 0, nb: 0, lb: 0 },
  };
}

function newBall() {
  return {
    class: 'none',
    label: '-',
    hasBeenBowled: false,
    isExtra: false,
    currentRuns: 0,
    wicketsLost: 0,
    extras: { w: 0, nb: 0, lb: 0, b: 0 },
    currentPatnership: { runs: 0, balls: 0 },
    striker: newBatsman(''),
    nonStriker: newBatsman(''),
    currentBowler: newBowler(''),
    // NOTE: no `timestamp` field - it is transient/never persisted (see
    // BALL_DATA.timestamp doc comment / SaveMatchService.prepareOversPlayedObj).
  };
}

function newTeam(name, captain) {
  return {
    name,
    captain,
    runsScored: 0,
    oversPlayed: 0,
    wicketsLost: 0,
    runRate: 0,
    oversPlayedData: [[]],
    extras: { w: 0, nb: 0, lb: 0, b: 0 },
    Batsmens: [],
    Bowlers: [],
    Fielders: [],
    strikerIndex: 0,
    nonStrikerIndex: 1,
    currBowlerIndex: 0,
  };
}

// ---------------------------------------------------------------------------
// Ball-by-ball innings simulation engine
// ---------------------------------------------------------------------------

function currentBall(ctx) {
  const over = ctx.battingTeam.oversPlayedData[ctx.currentOverNumber];
  return over[over.length - 1];
}

function swapStriker(ctx) {
  const temp = ctx.striker;
  ctx.striker = ctx.nonStriker;
  ctx.nonStriker = temp;
}

function updateCurrentPatnership(ctx, runs, updateBalls) {
  ctx.currentPatnership.runs += runs;
  if (updateBalls) ctx.currentPatnership.balls += 1;
}

function resetCurrentPatnership(ctx) {
  ctx.currentPatnership.runs = 0;
  ctx.currentPatnership.balls = 0;
}

/** Mirrors LiveMatchService.addExtra - team.extras.nb is a COUNT of no-balls
 * while team.extras.w/lb/b are RUN totals; bowler.extras always accrues the
 * full run amount (except byes, which never touch the bowler's figures) -
 * this mismatch is a real, existing quirk of the live app, replicated here
 * for consistency with how "Extras (W:x, NB:y, LB:z, B:w)" is displayed. */
function addExtra(ctx, type, run) {
  if (type !== 'nb') ctx.battingTeam.extras[type] += run;
  else ctx.battingTeam.extras[type] += 1;
  if (type !== 'b') ctx.currentBowler.extras[type] += run;
}

function finalizeBall(ctx, opts) {
  const ball = currentBall(ctx);
  ball.hasBeenBowled = true;
  ball.class = opts.cssClass;
  ball.label = opts.label;

  updateCurrentPatnership(ctx, opts.partnershipRuns, opts.partnershipCountsBall);

  ball.currentRuns = ctx.battingTeam.runsScored + opts.run;
  ctx.battingTeam.runsScored += opts.run;
  if (opts.isWicketBall) ctx.battingTeam.wicketsLost += 1;
  ball.wicketsLost = ctx.battingTeam.wicketsLost;
  ball.isExtra = opts.isExtra;
  ball.extras = { ...ctx.battingTeam.extras };
  ball.currentPatnership = { ...ctx.currentPatnership };
}

/** Snapshots current striker/non-striker/bowler onto the ball. Must be
 * called AFTER any wicket replacement has already been decided, so a
 * wicket ball's snapshot shows the new pairing - see file header. */
function snapshotPlayers(ctx) {
  const ball = currentBall(ctx);
  ball.striker = { ...ctx.striker };
  ball.nonStriker = { ...ctx.nonStriker };
  ball.currentBowler = { ...ctx.currentBowler, extras: { ...ctx.currentBowler.extras } };
}

function creditStrikerRuns(ctx, creditedRuns, countsAsBallFaced) {
  if (countsAsBallFaced) ctx.striker.balls += 1;
  ctx.striker.runs += creditedRuns;
  if (creditedRuns === 4) ctx.striker.fours += 1;
  if (creditedRuns === 6) ctx.striker.six += 1;
  ctx.striker.strikeRate = ctx.striker.balls > 0 ? (ctx.striker.runs / ctx.striker.balls) * 100 : 0;
}

function creditBowlerRunsAndWickets(ctx, run, isByes, isWicketBall, wicketType) {
  if (!isByes) ctx.currentBowler.runs += run;
  if (isWicketBall && wicketType !== 'Run-out' && wicketType !== 'Hit-Wicket') {
    ctx.currentBowler.wickets += 1;
  }
}

function creditFielder(ctx, fielderName, field) {
  let fielder = ctx.bowlingTeam.Fielders.find((f) => f.name === fielderName);
  if (!fielder) {
    fielder = { name: fielderName, catches: 0, runOuts: 0, stumpOuts: 0 };
    ctx.bowlingTeam.Fielders.push(fielder);
  }
  fielder[field] += 1;
}

function processNormalRun(ctx, runs) {
  const label = String(runs);
  const cssClass = runs === 0 ? 'dot' : runs === 4 ? 'four' : runs === 6 ? 'six' : 'run';
  finalizeBall(ctx, {
    label,
    cssClass,
    run: runs,
    isExtra: false,
    isWicketBall: false,
    partnershipRuns: runs,
    partnershipCountsBall: true,
  });
  creditBowlerRunsAndWickets(ctx, runs, false, false, null);
  creditStrikerRuns(ctx, runs, true);
  if (runs % 2 === 1) swapStriker(ctx);
  snapshotPlayers(ctx);
  return { isLegal: true };
}

function processWide(ctx) {
  const extraRuns = weightedPick(WIDE_EXTRA_RUN_WEIGHTS);
  const totalRun = extraRuns + 1;
  finalizeBall(ctx, {
    label: totalRun + 'wd',
    cssClass: 'extra',
    run: totalRun,
    isExtra: true,
    isWicketBall: false,
    partnershipRuns: totalRun,
    partnershipCountsBall: false,
  });
  addExtra(ctx, 'w', totalRun);
  creditBowlerRunsAndWickets(ctx, totalRun, false, false, null);
  if ((totalRun - 1) % 2 !== 0) swapStriker(ctx);
  snapshotPlayers(ctx);
  return { isLegal: false };
}

function processNoBall(ctx) {
  const batRuns = weightedPick(NOBALL_BAT_RUN_WEIGHTS);
  const totalRun = batRuns + 1;
  finalizeBall(ctx, {
    label: totalRun + 'nb',
    cssClass: 'extra',
    run: totalRun,
    isExtra: true,
    isWicketBall: false,
    partnershipRuns: totalRun,
    partnershipCountsBall: true,
  });
  addExtra(ctx, 'nb', totalRun);
  creditBowlerRunsAndWickets(ctx, totalRun, false, false, null);
  // Runs off the bat (mandatory +1 excluded) are credited to the striker,
  // but a no-ball never counts as a "ball faced" - mirrors
  // LiveMatchService.addRunToStriker(run, isNBChecked=true, ..., countsAsBallFaced=false).
  creditStrikerRuns(ctx, batRuns, false);
  if (batRuns % 2 === 1) swapStriker(ctx);
  snapshotPlayers(ctx);
  return { isLegal: false };
}

function processExtraRun(ctx, type) {
  // type: 'lb' (leg bye) or 'b' (bye) - both are legal, counted deliveries.
  const runs = weightedPick(BYE_RUN_WEIGHTS);
  finalizeBall(ctx, {
    label: runs + (type === 'lb' ? ' LB' : ' B'),
    cssClass: 'run',
    run: runs,
    isExtra: false,
    isWicketBall: false,
    partnershipRuns: runs,
    partnershipCountsBall: true,
  });
  addExtra(ctx, type, runs);
  creditBowlerRunsAndWickets(ctx, runs, type === 'b', false, null);
  creditStrikerRuns(ctx, 0, true);
  if (runs % 2 === 1) swapStriker(ctx);
  snapshotPlayers(ctx);
  return { isLegal: true };
}

function processWicket(ctx, battingQueue) {
  const wicketType = weightedPick(WICKET_TYPE_WEIGHTS);
  finalizeBall(ctx, {
    label: 'W',
    cssClass: 'wicket',
    run: 0,
    isExtra: false,
    isWicketBall: true,
    partnershipRuns: 0,
    partnershipCountsBall: true,
  });
  creditBowlerRunsAndWickets(ctx, 0, false, true, wicketType);

  // Run-out can dismiss either batsman; every other dismissal type is
  // always the one currently on strike.
  const strikerIsOut = wicketType !== 'Run-out' || Math.random() < 0.7;
  const outBatsman = strikerIsOut ? ctx.striker : ctx.nonStriker;
  const bowlerName = ctx.currentBowler.name;

  switch (wicketType) {
    case 'Hit-Wicket':
      outBatsman.status = 'Hit-Wicket';
      break;
    case 'Bowled':
      outBatsman.status = 'b ' + bowlerName;
      break;
    case 'LBW':
      outBatsman.status = 'lbw ' + bowlerName;
      break;
    case 'Caught': {
      const fielderName = pick(ctx.bowlingRoster);
      outBatsman.status = 'c ' + fielderName + ' b ' + bowlerName;
      creditFielder(ctx, fielderName, 'catches');
      break;
    }
    case 'Stumped':
      outBatsman.status = 'st \u2713' + ctx.wicketKeeperName + ' b ' + bowlerName;
      creditFielder(ctx, ctx.wicketKeeperName, 'stumpOuts');
      break;
    case 'Run-out': {
      const fielderName = pick(ctx.bowlingRoster);
      outBatsman.status = 'runout (' + fielderName + ')';
      creditFielder(ctx, fielderName, 'runOuts');
      break;
    }
  }

  if (battingQueue.length > 0) {
    const incomingName = battingQueue.shift();
    const incoming = newBatsman(incomingName);
    ctx.battingTeam.Batsmens.push(incoming);
    if (strikerIsOut) {
      ctx.striker = incoming;
      ctx.battingTeam.strikerIndex = ctx.battingTeam.Batsmens.length - 1;
    } else {
      ctx.nonStriker = incoming;
      ctx.battingTeam.nonStrikerIndex = ctx.battingTeam.Batsmens.length - 1;
    }
  }

  // Snapshot AFTER the replacement is decided, so this ball's striker/
  // nonStriker fields show the NEW pairing (see file header quirk note).
  snapshotPlayers(ctx);
  resetCurrentPatnership(ctx);
  return { isLegal: true };
}

function applyOutcome(ctx, outcome, battingQueue) {
  switch (outcome) {
    case 'dot':
      return processNormalRun(ctx, 0);
    case 'run1':
      return processNormalRun(ctx, 1);
    case 'run2':
      return processNormalRun(ctx, 2);
    case 'run3':
      return processNormalRun(ctx, 3);
    case 'four':
      return processNormalRun(ctx, 4);
    case 'six':
      return processNormalRun(ctx, 6);
    case 'wide':
      return processWide(ctx);
    case 'noball':
      return processNoBall(ctx);
    case 'legbye':
      return processExtraRun(ctx, 'lb');
    case 'bye':
      return processExtraRun(ctx, 'b');
    case 'wicket':
      return processWicket(ctx, battingQueue);
    default:
      return processNormalRun(ctx, 0);
  }
}

function getOrCreateBowler(bowlingTeam, name) {
  let bowler = bowlingTeam.Bowlers.find((b) => b.name === name);
  if (!bowler) {
    bowler = newBowler(name);
    bowlingTeam.Bowlers.push(bowler);
  }
  return bowler;
}

function pickNextBowler(bowlerPool, lastOverBowlerName, bowlerOversCount, maxOversPerBowler) {
  let candidates = bowlerPool.filter(
    (name) => name !== lastOverBowlerName && (bowlerOversCount[name] || 0) < maxOversPerBowler
  );
  if (candidates.length === 0) {
    candidates = bowlerPool.filter((name) => name !== lastOverBowlerName);
  }
  if (candidates.length === 0) {
    candidates = bowlerPool.slice();
  }
  return pick(candidates);
}

/**
 * Simulates one full innings, mutating `battingTeam`/`bowlingTeam` in
 * place (Batsmens/Bowlers/Fielders/oversPlayedData/runsScored/wicketsLost/
 * extras/oversPlayed/runRate) until all-out, overs completed, or (2nd
 * innings only) the target is chased.
 */
function simulateInnings({ battingTeam, bowlingTeam, battingRoster, bowlingRoster, totalOvers, totalPlayers, target }) {
  const ctx = {
    battingTeam,
    bowlingTeam,
    currentOverNumber: 0,
    currentPatnership: { runs: 0, balls: 0 },
    bowlingRoster,
    wicketKeeperName: bowlingRoster[bowlingRoster.length - 1],
  };

  const battingQueue = battingRoster.slice(2);
  ctx.striker = newBatsman(battingRoster[0]);
  ctx.nonStriker = newBatsman(battingRoster[1]);
  battingTeam.Batsmens.push(ctx.striker, ctx.nonStriker);
  battingTeam.strikerIndex = 0;
  battingTeam.nonStrikerIndex = 1;

  const poolSize = Math.min(bowlingRoster.length, randInt(5, 7));
  const bowlerPool = shuffle(bowlingRoster).slice(0, Math.max(2, poolSize));
  const maxOversPerBowler = Math.max(2, Math.ceil(totalOvers / 5));
  const bowlerOversCount = {};
  let lastOverBowlerName = null;

  ctx.currentBowler = getOrCreateBowler(bowlingTeam, pick(bowlerPool));
  let runsConcededThisOverByBowler = ctx.currentBowler.runs;

  const bowlerLegalBalls = {};
  let legalBallsThisOver = 0;
  let totalLegalBalls = 0;
  const targetOversLegalBalls = totalOvers * 6;

  while (true) {
    battingTeam.oversPlayedData[ctx.currentOverNumber].push(newBall());
    const outcome = weightedPick(RUN_OUTCOME_WEIGHTS);
    const result = applyOutcome(ctx, outcome, battingQueue);

    if (result.isLegal) {
      legalBallsThisOver += 1;
      totalLegalBalls += 1;
      bowlerLegalBalls[ctx.currentBowler.name] = (bowlerLegalBalls[ctx.currentBowler.name] || 0) + 1;
      ctx.currentBowler.overs = convertToOvers(bowlerLegalBalls[ctx.currentBowler.name]);
    }
    battingTeam.oversPlayed = convertToOvers(totalLegalBalls);

    const allOut = battingTeam.wicketsLost >= totalPlayers - 1;
    const targetChased = target !== undefined && battingTeam.runsScored >= target;
    if (allOut || targetChased) break;

    if (legalBallsThisOver === 6) {
      if (ctx.currentBowler.runs - runsConcededThisOverByBowler === 0) {
        ctx.currentBowler.maidens += 1;
      }
      bowlerOversCount[ctx.currentBowler.name] = (bowlerOversCount[ctx.currentBowler.name] || 0) + 1;
      lastOverBowlerName = ctx.currentBowler.name;

      if (totalLegalBalls >= targetOversLegalBalls) break;

      swapStriker(ctx);
      legalBallsThisOver = 0;
      ctx.currentOverNumber += 1;
      battingTeam.oversPlayedData.push([]);
      ctx.currentBowler = getOrCreateBowler(
        bowlingTeam,
        pickNextBowler(bowlerPool, lastOverBowlerName, bowlerOversCount, maxOversPerBowler)
      );
      runsConcededThisOverByBowler = ctx.currentBowler.runs;
    }
  }

  battingTeam.runRate = totalLegalBalls > 0 ? (battingTeam.runsScored / totalLegalBalls) * 6 : 0;
  bowlingTeam.Bowlers.forEach((bowler) => {
    bowler.economy = bowler.overs > 0 ? (bowler.runs / ballplayed(bowler.overs)) * 6 : 0;
  });

  return { totalLegalBalls };
}

// ---------------------------------------------------------------------------
// Roster assembly
// ---------------------------------------------------------------------------

async function fetchExistingPlayerNames(firestore) {
  try {
    const snap = await getDocs(collection(firestore, PLAYER_COLLECTION));
    return snap.docs.map((d) => (d.data().name || '').trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function buildRosters(existingPlayerNames, totalPlayers) {
  const used = new Set();
  const realNamesPool = shuffle(Array.from(new Set(existingPlayerNames)));

  const takeName = () => {
    while (realNamesPool.length > 0) {
      const candidate = realNamesPool.shift();
      if (!used.has(candidate)) {
        used.add(candidate);
        return candidate;
      }
    }
    return generateFictitiousName(used);
  };

  const team1Roster = Array.from({ length: totalPlayers }, takeName);
  const team2Roster = Array.from({ length: totalPlayers }, takeName);
  return { team1Roster, team2Roster };
}

// ---------------------------------------------------------------------------
// Match orchestration
// ---------------------------------------------------------------------------

function buildMatchResult(battingFirstTeam, battingSecondTeam, totalPlayers) {
  if (battingSecondTeam.runsScored > battingFirstTeam.runsScored) {
    const wicketsInHand = totalPlayers - 1 - battingSecondTeam.wicketsLost;
    return `${battingSecondTeam.name} wins by ${wicketsInHand} wicket(s)`;
  } else if (battingSecondTeam.runsScored < battingFirstTeam.runsScored) {
    const runMargin = battingFirstTeam.runsScored - battingSecondTeam.runsScored;
    return `${battingFirstTeam.name} wins by ${runMargin} runs`;
  }
  return 'Match Tied';
}

function toFirestoreOvers(oversPlayedData) {
  return oversPlayedData
    .filter((over) => over.length > 0)
    .map((over) => {
      const obj = {};
      over.forEach((ball, i) => {
        obj[i] = ball;
      });
      return obj;
    });
}

function filterIncorrectBatsmenData(team) {
  team.Batsmens = team.Batsmens.filter((b) => b.runs > 0 || b.balls > 0);
}

function filterIncorrectBowlersData(team) {
  team.Bowlers = team.Bowlers.filter((b) => b.runs > 0 || b.overs > 0);
}

async function buildRandomMatch(firestore) {
  const totalOvers = randInt(6, 15);
  const totalPlayers = randInt(6, 11);

  const [team1Name, team2Name] = shuffle(TEAM_NAMES).slice(0, 2);
  const existingPlayerNames = await fetchExistingPlayerNames(firestore);
  const { team1Roster, team2Roster } = buildRosters(existingPlayerNames, totalPlayers);

  const team1 = newTeam(team1Name, team1Roster[0]);
  const team2 = newTeam(team2Name, team2Roster[0]);

  const tossWinner = pick(['team1', 'team2']);
  const tossResult = pick(['bat', 'ball']);
  const battingFirstKey =
    tossWinner === 'team1'
      ? tossResult === 'bat'
        ? 'team1'
        : 'team2'
      : tossResult === 'bat'
      ? 'team2'
      : 'team1';
  const battingSecondKey = battingFirstKey === 'team1' ? 'team2' : 'team1';

  const teams = { team1, team2 };
  const rosters = { team1: team1Roster, team2: team2Roster };

  const now = new Date();
  const inningsOneFirstBallTime = new Date(now.getTime() - 100 * 60000);

  const inningsOne = simulateInnings({
    battingTeam: teams[battingFirstKey],
    bowlingTeam: teams[battingSecondKey],
    battingRoster: rosters[battingFirstKey],
    bowlingRoster: rosters[battingSecondKey],
    totalOvers,
    totalPlayers,
    target: undefined,
  });

  const inningsOneLastBallTime = new Date(
    inningsOneFirstBallTime.getTime() + inningsOne.totalLegalBalls * 25000
  );
  const inningsTwoFirstBallTime = new Date(inningsOneLastBallTime.getTime() + 15 * 60000);

  const target = teams[battingFirstKey].runsScored + 1;
  const inningsTwo = simulateInnings({
    battingTeam: teams[battingSecondKey],
    bowlingTeam: teams[battingFirstKey],
    battingRoster: rosters[battingSecondKey],
    bowlingRoster: rosters[battingFirstKey],
    totalOvers,
    totalPlayers,
    target,
  });

  const inningsTwoLastBallTime = new Date(
    inningsTwoFirstBallTime.getTime() + inningsTwo.totalLegalBalls * 25000
  );

  const battingSecondTeam = teams[battingSecondKey];
  const battingFirstTeam = teams[battingFirstKey];
  battingSecondTeam.targetRuns = target;
  battingSecondTeam.requiredRuns = Math.max(0, target - battingSecondTeam.runsScored);
  battingSecondTeam.ballsLeft = Math.max(0, totalOvers * 6 - inningsTwo.totalLegalBalls);
  battingSecondTeam.requiredRunRate =
    battingSecondTeam.ballsLeft > 0
      ? +((battingSecondTeam.requiredRuns / (battingSecondTeam.ballsLeft / 6)).toFixed(1))
      : 0;

  const matchResult = buildMatchResult(battingFirstTeam, battingSecondTeam, totalPlayers);
  const winningKey =
    battingSecondTeam.runsScored === battingFirstTeam.runsScored
      ? undefined
      : battingSecondTeam.runsScored > battingFirstTeam.runsScored
      ? battingSecondKey
      : battingFirstKey;

  [team1, team2].forEach((team) => {
    filterIncorrectBatsmenData(team);
    filterIncorrectBowlersData(team);
  });

  return {
    team1,
    team2,
    totalOvers,
    totalPlayers,
    tossWinner,
    tossResult,
    matchResult,
    winningTeamKey: winningKey,
    matchDate: now,
    inningsOneFirstBallTime,
    inningsOneLastBallTime,
    inningsTwoFirstBallTime,
    inningsTwoLastBallTime,
  };
}

// ---------------------------------------------------------------------------
// MVP scoring - duplicated from temp-scripts/backfill-mvp-player-data.js,
// which is itself a faithful port of mvp-calculator.service.ts. Extended
// here to also return `allPlayers` (needed to fold MVP points into every
// participant's PlayerData doc, not just the top 5).
// ---------------------------------------------------------------------------

const DEFAULT_MVP_WEIGHTS = {
  batting: {
    pointsPerRun: 1,
    pointsPerFour: 1,
    pointsPerSix: 2,
    milestoneRunsPerOverFactor: 2.5,
    minimumMilestoneRuns: 20,
    milestoneBonusPoints: 8,
    duckPenaltyPoints: 2,
    minBallsFacedForDuckPenalty: 1,
    strikeRateBonusMultiplier: 1.25,
    strikeRateBonusPoints: 4,
    strikeRatePenaltyMultiplier: 0.65,
    strikeRatePenaltyPoints: 2,
    minBallsFacedForStrikeRateAdjustment: 10,
  },
  bowling: {
    pointsPerWicket: 25,
    wicketHaulOversPerWicketFactor: 6.67,
    minimumWicketHaulCount: 2,
    wicketHaulBonusPoints: 8,
    pointsPerMaiden: 1,
    economyBonusMultiplier: 0.75,
    economyBonusPoints: 4,
    economyPenaltyMultiplier: 1.35,
    economyPenaltyPoints: 2,
    minOversBowledForEconomyAdjustment: 2,
  },
  fielding: {
    pointsPerCatch: 8,
    pointsPerRunOut: 10,
    pointsPerStumping: 10,
  },
  bonuses: {
    allRounderMinDisciplines: 2,
    allRounderBonusPoints: 6,
    tripleThreatMinDisciplines: 3,
    tripleThreatBonusPoints: 12,
    captainBonusPoints: 1,
    tossWinCaptainBonusPoints: 1,
  },
};

async function loadWeights(firestore) {
  const weights = JSON.parse(JSON.stringify(DEFAULT_MVP_WEIGHTS));
  try {
    const snapshot = await getDocs(collection(firestore, MVP_CONFIG_COLLECTION));
    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (weights[docSnap.id]) {
        Object.assign(weights[docSnap.id], data);
      }
    });
  } catch {
    // Keep hardcoded defaults if MvpConfig is unreachable/empty.
  }
  return weights;
}

function teamRunRateAsStrikeRate(teamRunRate) {
  return (teamRunRate / 6) * 100;
}

/** Ported from MvpCalculatorService.calculateBattingPoints - returns both
 * the points total AND the line-by-line breakdown (with thresholdExplanation
 * for the milestone bonus) that powers the match-details MVP dialog. */
function calculateBattingPoints(batsman, weights, totalOvers, battingTeamRunRate) {
  let points = 0;
  const items = [];

  const runPoints = batsman.runs * weights.pointsPerRun;
  points += runPoints;
  items.push({
    label: 'Runs Scored',
    points: runPoints,
    detail: `${batsman.runs} run(s) x ${weights.pointsPerRun} pt = ${runPoints} pts`,
  });

  const boundaryPoints = batsman.fours * weights.pointsPerFour + batsman.six * weights.pointsPerSix;
  if (boundaryPoints !== 0) {
    points += boundaryPoints;
    items.push({
      label: 'Boundary Bonus',
      points: boundaryPoints,
      detail: `${batsman.fours} four(s) x ${weights.pointsPerFour} + ${batsman.six} six(es) x ${weights.pointsPerSix} = ${boundaryPoints} pts`,
    });
  }

  const rawMilestoneThreshold = totalOvers * weights.milestoneRunsPerOverFactor;
  const scaledMilestoneThreshold = Math.round(rawMilestoneThreshold);
  const milestoneThreshold = Math.max(weights.minimumMilestoneRuns, scaledMilestoneThreshold);
  if (milestoneThreshold > 0 && batsman.runs >= milestoneThreshold) {
    points += weights.milestoneBonusPoints;
    const flooredNote =
      milestoneThreshold > scaledMilestoneThreshold
        ? `, floored at the ${weights.minimumMilestoneRuns}-run minimum`
        : '';
    items.push({
      label: 'Milestone Bonus',
      points: weights.milestoneBonusPoints,
      detail: `Reached the ${milestoneThreshold}-run milestone for this match (+${weights.milestoneBonusPoints} pts)`,
      thresholdExplanation: `Milestone target = ${totalOvers} over(s) x ${weights.milestoneRunsPerOverFactor} runs/over = ${rawMilestoneThreshold.toFixed(1)}, rounded to ${scaledMilestoneThreshold}${flooredNote} -> ${milestoneThreshold} run(s)`,
    });
  }

  if (
    batsman.runs === 0 &&
    batsman.status !== 'Not Out' &&
    batsman.balls >= weights.minBallsFacedForDuckPenalty
  ) {
    points -= weights.duckPenaltyPoints;
    items.push({
      label: 'Duck Penalty',
      points: -weights.duckPenaltyPoints,
      detail: `Out for a duck after facing ${batsman.balls} ball(s) (-${weights.duckPenaltyPoints} pts)`,
    });
  }

  if (batsman.balls >= weights.minBallsFacedForStrikeRateAdjustment) {
    const strikeRate = (batsman.runs / batsman.balls) * 100;
    const benchmarkStrikeRate = teamRunRateAsStrikeRate(battingTeamRunRate);
    if (strikeRate >= benchmarkStrikeRate * weights.strikeRateBonusMultiplier) {
      points += weights.strikeRateBonusPoints;
      items.push({
        label: 'Strike Rate Bonus',
        points: weights.strikeRateBonusPoints,
        detail: `Struck at ${strikeRate.toFixed(0)} vs team's ${benchmarkStrikeRate.toFixed(0)} (+${weights.strikeRateBonusPoints} pts)`,
      });
    } else if (strikeRate <= benchmarkStrikeRate * weights.strikeRatePenaltyMultiplier) {
      points -= weights.strikeRatePenaltyPoints;
      items.push({
        label: 'Strike Rate Penalty',
        points: -weights.strikeRatePenaltyPoints,
        detail: `Struck at only ${strikeRate.toFixed(0)} vs team's ${benchmarkStrikeRate.toFixed(0)} (-${weights.strikeRatePenaltyPoints} pts)`,
      });
    }
  }

  return { points, items };
}

/** Ported from MvpCalculatorService.calculateBowlingPoints. */
function calculateBowlingPoints(bowler, weights, totalOvers, opposingBattingTeamRunRate) {
  let points = 0;
  const items = [];

  const wicketPoints = bowler.wickets * weights.pointsPerWicket;
  if (wicketPoints !== 0) {
    points += wicketPoints;
    items.push({
      label: 'Wickets',
      points: wicketPoints,
      detail: `${bowler.wickets} wicket(s) x ${weights.pointsPerWicket} pts = ${wicketPoints} pts`,
    });
  }

  const maidenPoints = bowler.maidens * weights.pointsPerMaiden;
  if (maidenPoints !== 0) {
    points += maidenPoints;
    items.push({
      label: 'Maidens',
      points: maidenPoints,
      detail: `${bowler.maidens} maiden(s) x ${weights.pointsPerMaiden} pt = ${maidenPoints} pts`,
    });
  }

  const rawHaulThreshold = totalOvers / weights.wicketHaulOversPerWicketFactor;
  const scaledHaulThreshold = Math.ceil(rawHaulThreshold);
  const haulThreshold = Math.max(weights.minimumWicketHaulCount, scaledHaulThreshold);
  if (bowler.wickets >= haulThreshold) {
    points += weights.wicketHaulBonusPoints;
    const flooredNote =
      haulThreshold > scaledHaulThreshold
        ? `, floored at the ${weights.minimumWicketHaulCount}-wicket minimum`
        : '';
    items.push({
      label: 'Wicket Haul Bonus',
      points: weights.wicketHaulBonusPoints,
      detail: `Took ${haulThreshold}+ wickets for this match (+${weights.wicketHaulBonusPoints} pts)`,
      thresholdExplanation: `Haul target = ${totalOvers} over(s) / ${weights.wicketHaulOversPerWicketFactor} overs-per-wicket = ${rawHaulThreshold.toFixed(2)}, rounded up to ${scaledHaulThreshold}${flooredNote} -> ${haulThreshold} wicket(s)`,
    });
  }

  if (bowler.overs >= weights.minOversBowledForEconomyAdjustment) {
    const economy = (bowler.runs / ballplayed(bowler.overs)) * 6;
    if (economy <= opposingBattingTeamRunRate * weights.economyBonusMultiplier) {
      points += weights.economyBonusPoints;
      items.push({
        label: 'Economy Bonus',
        points: weights.economyBonusPoints,
        detail: `Economy of ${economy.toFixed(2)} vs opponent's ${opposingBattingTeamRunRate.toFixed(2)} (+${weights.economyBonusPoints} pts)`,
      });
    } else if (economy >= opposingBattingTeamRunRate * weights.economyPenaltyMultiplier) {
      points -= weights.economyPenaltyPoints;
      items.push({
        label: 'Economy Penalty',
        points: -weights.economyPenaltyPoints,
        detail: `Economy of ${economy.toFixed(2)} vs opponent's ${opposingBattingTeamRunRate.toFixed(2)} (-${weights.economyPenaltyPoints} pts)`,
      });
    }
  }

  return { points, items };
}

/** Ported from MvpCalculatorService.calculateFieldingPoints. */
function calculateFieldingPoints(fielder, weights) {
  let points = 0;
  const items = [];

  if (fielder.catches > 0) {
    const p = fielder.catches * weights.pointsPerCatch;
    points += p;
    items.push({
      label: 'Catches',
      points: p,
      detail: `${fielder.catches} catch(es) x ${weights.pointsPerCatch} pt = ${p} pts`,
    });
  }
  if (fielder.runOuts > 0) {
    const p = fielder.runOuts * weights.pointsPerRunOut;
    points += p;
    items.push({
      label: 'Run Outs',
      points: p,
      detail: `${fielder.runOuts} run out(s) x ${weights.pointsPerRunOut} pt = ${p} pts`,
    });
  }
  if (fielder.stumpOuts > 0) {
    const p = fielder.stumpOuts * weights.pointsPerStumping;
    points += p;
    items.push({
      label: 'Stumpings',
      points: p,
      detail: `${fielder.stumpOuts} stumping(s) x ${weights.pointsPerStumping} pt = ${p} pts`,
    });
  }

  return { points, items };
}

function comparePlayers(a, b) {
  if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
  if (a.isOnWinningTeam !== b.isOnWinningTeam) return a.isOnWinningTeam ? -1 : 1;
  if (b.disciplineCount !== a.disciplineCount) return b.disciplineCount - a.disciplineCount;
  if (b.runsScored !== a.runsScored) return b.runsScored - a.runsScored;
  if (b.wicketsTaken !== a.wicketsTaken) return b.wicketsTaken - a.wicketsTaken;
  return a.name.localeCompare(b.name);
}

function calculateMatchMvp(team1, team2, winningTeamKey, tossWinnerKey, weights, totalOvers) {
  const breakdownsByName = new Map();
  const getOrCreate = (name, isOnWinningTeam, teamKey) => {
    let entry = breakdownsByName.get(name);
    if (!entry) {
      entry = {
        name,
        battingPoints: 0,
        bowlingPoints: 0,
        fieldingPoints: 0,
        bonusPoints: 0,
        totalPoints: 0,
        disciplineCount: 0,
        isOnWinningTeam,
        teamKey,
        runsScored: 0,
        wicketsTaken: 0,
        battingBreakdown: [],
        bowlingBreakdown: [],
        fieldingBreakdown: [],
        bonusBreakdown: [],
      };
      breakdownsByName.set(name, entry);
    }
    return entry;
  };

  const teams = [
    { team: team1, key: 'team1', opponent: team2 },
    { team: team2, key: 'team2', opponent: team1 },
  ];

  teams.forEach(({ team, key, opponent }) => {
    const isOnWinningTeam = winningTeamKey === key;
    (team.Batsmens || []).forEach((batsman) => {
      const entry = getOrCreate(batsman.name, isOnWinningTeam, key);
      const result = calculateBattingPoints(batsman, weights.batting, totalOvers, team.runRate);
      entry.battingPoints += result.points;
      entry.battingBreakdown.push(...result.items);
      entry.runsScored += batsman.runs;
    });
    (team.Bowlers || []).forEach((bowler) => {
      const entry = getOrCreate(bowler.name, isOnWinningTeam, key);
      const result = calculateBowlingPoints(bowler, weights.bowling, totalOvers, opponent.runRate);
      entry.bowlingPoints += result.points;
      entry.bowlingBreakdown.push(...result.items);
      entry.wicketsTaken += bowler.wickets;
    });
    (team.Fielders || []).forEach((fielder) => {
      const entry = getOrCreate(fielder.name, isOnWinningTeam, key);
      const result = calculateFieldingPoints(fielder, weights.fielding);
      entry.fieldingPoints += result.points;
      entry.fieldingBreakdown.push(...result.items);
    });
  });

  const allPlayers = Array.from(breakdownsByName.values()).map((entry) => {
    let disciplineCount = 0;
    if (entry.battingPoints > 0) disciplineCount++;
    if (entry.bowlingPoints > 0) disciplineCount++;
    if (entry.fieldingPoints > 0) disciplineCount++;
    entry.disciplineCount = disciplineCount;

    if (disciplineCount >= weights.bonuses.tripleThreatMinDisciplines) {
      entry.bonusPoints = weights.bonuses.tripleThreatBonusPoints;
      entry.bonusBreakdown = [
        {
          label: 'Triple Threat Bonus',
          points: entry.bonusPoints,
          detail: `Contributed points in all 3 disciplines - batting, bowling and fielding (+${entry.bonusPoints} pts)`,
        },
      ];
    } else if (disciplineCount >= weights.bonuses.allRounderMinDisciplines) {
      entry.bonusPoints = weights.bonuses.allRounderBonusPoints;
      entry.bonusBreakdown = [
        {
          label: 'All-Rounder Bonus',
          points: entry.bonusPoints,
          detail: `Contributed points in ${disciplineCount} disciplines (+${entry.bonusPoints} pts)`,
        },
      ];
    } else {
      entry.bonusPoints = 0;
      entry.bonusBreakdown = [];
    }

    const teamForEntry = entry.teamKey === 'team1' ? team1 : team2;
    const captainName = teamForEntry.captain && teamForEntry.captain.trim();
    if (captainName && entry.name.trim() === captainName) {
      entry.bonusPoints += weights.bonuses.captainBonusPoints;
      entry.bonusBreakdown.push({
        label: 'Captaincy Bonus',
        points: weights.bonuses.captainBonusPoints,
        detail: `Captain of ${teamForEntry.name} (+${weights.bonuses.captainBonusPoints} pts)`,
      });

      if (tossWinnerKey && entry.teamKey === tossWinnerKey) {
        entry.bonusPoints += weights.bonuses.tossWinCaptainBonusPoints;
        entry.bonusBreakdown.push({
          label: 'Toss-Winning Captain Bonus',
          points: weights.bonuses.tossWinCaptainBonusPoints,
          detail: `Captain of the team that won the toss (+${weights.bonuses.tossWinCaptainBonusPoints} pts)`,
        });
      }
    }

    entry.totalPoints = entry.battingPoints + entry.bowlingPoints + entry.fieldingPoints + entry.bonusPoints;
    return entry;
  });

  allPlayers.sort(comparePlayers);
  const topFive = allPlayers.slice(0, 5);
  const manOfTheMatch = topFive.length > 0 ? topFive[0].name : '';
  return { topFive, manOfTheMatch, allPlayers };
}

// ---------------------------------------------------------------------------
// PlayerData full recompute - duplicated from PlayerService.savePlayerData's
// update-or-create + delete-all/reinsert-all flow (also mirrored in
// temp-scripts/backfill-mvp-player-data.js).
// ---------------------------------------------------------------------------

function initializePlayerSaveObject(playerName) {
  return {
    name: playerName,
    matchesPlayed: 1,
    won: 0,
    lost: 0,
    runsScored: 0,
    ballsPlayed: 0,
    fours: 0,
    sixes: 0,
    overs: 0,
    runsAgainst: 0,
    wickets: 0,
    maidens: 0,
    catches: 0,
    runOuts: 0,
    stumpOuts: 0,
    matchIds: [],
    bbi: { wickets: 0, runs: 0 },
    highestScore: 0,
    isNotOutHS: false,
    mvpPoints: 0,
    momCount: 0,
    bestMvpPoints: 0,
    bestMvpMatchId: '',
    mvpPointsHistory: [],
  };
}

function normalizePlayerNumericFields(player) {
  const numericFields = [
    'matchesPlayed', 'won', 'lost', 'runsScored', 'ballsPlayed', 'fours', 'sixes',
    'overs', 'runsAgainst', 'wickets', 'maidens', 'catches', 'runOuts', 'stumpOuts',
    'highestScore', 'mvpPoints', 'momCount', 'bestMvpPoints',
  ];
  numericFields.forEach((field) => {
    const value = player[field];
    if (value === undefined || value === null || (typeof value === 'number' && isNaN(value))) {
      player[field] = 0;
    }
  });
  if (!player.matchIds) player.matchIds = [];
  if (!player.mvpPointsHistory) player.mvpPointsHistory = [];
  if (player.bestMvpMatchId === undefined || player.bestMvpMatchId === null) player.bestMvpMatchId = '';
  if (!player.bbi) player.bbi = { wickets: 0, runs: 0 };
  if (player.bbi.wickets === undefined || player.bbi.wickets === null || isNaN(player.bbi.wickets)) player.bbi.wickets = 0;
  if (player.bbi.runs === undefined || player.bbi.runs === null || isNaN(player.bbi.runs)) player.bbi.runs = 0;
}

function updateBatsmenStats(playerSaveObj, playerData) {
  playerSaveObj.runsScored += playerData.runs;
  playerSaveObj.ballsPlayed += playerData.balls;
  playerSaveObj.fours += playerData.fours;
  playerSaveObj.sixes += playerData.six;

  if (playerData.runs > playerSaveObj.highestScore) {
    playerSaveObj.highestScore = playerData.runs;
    playerSaveObj.isNotOutHS = playerData.status === 'Not Out';
  } else if (playerSaveObj.highestScore === playerData.runs && playerData.status === 'Not Out') {
    playerSaveObj.isNotOutHS = true;
  }
}

function updateBowlerStats(playerSaveObj, playerData) {
  let bestBowlingData;
  if (playerSaveObj.bbi.wickets > playerData.wickets) {
    bestBowlingData = playerSaveObj.bbi;
  } else if (playerData.wickets > playerSaveObj.bbi.wickets) {
    bestBowlingData = { wickets: playerData.wickets, runs: playerData.runs };
  } else if (playerSaveObj.bbi.runs < playerData.runs) {
    bestBowlingData = playerSaveObj.bbi;
  } else {
    bestBowlingData = { wickets: playerData.wickets, runs: playerData.runs };
  }

  playerSaveObj.runsAgainst += playerData.runs;
  playerSaveObj.overs = convertToOvers(ballplayed(playerData.overs) + ballplayed(playerSaveObj.overs));
  playerSaveObj.wickets += playerData.wickets;
  playerSaveObj.maidens += playerData.maidens;
  playerSaveObj.bbi = bestBowlingData;
}

function updateFielderStats(playerSaveObj, playerData) {
  playerSaveObj.runOuts += playerData.runOuts;
  playerSaveObj.catches += playerData.catches;
  playerSaveObj.stumpOuts += playerData.stumpOuts;
}

function updateStats(playerSaveObj, player) {
  if (player.fours !== undefined && player.fours !== null) updateBatsmenStats(playerSaveObj, player);
  else if (player.wickets !== undefined && player.wickets !== null) updateBowlerStats(playerSaveObj, player);
  else updateFielderStats(playerSaveObj, player);
}

/** Folds this match's Batsmen/Bowlers/Fielders + MVP results into the
 * running `playersByName` map (loaded from existing Test_PlayerData docs). */
function foldMatchIntoPlayers(playersByName, matchId, winningTeamKey, team1, team2, mvpSummary) {
  const playersPlayedThisMatch = new Set();
  const lists = [
    [team1.Batsmens || [], 'team1'],
    [team1.Bowlers || [], 'team1'],
    [team1.Fielders || [], 'team1'],
    [team2.Batsmens || [], 'team2'],
    [team2.Bowlers || [], 'team2'],
    [team2.Fielders || [], 'team2'],
  ];

  lists.forEach(([list, teamKey]) => {
    list.forEach((player) => {
      const name = player.name.trim();
      let playerObj = playersByName.get(name);

      if (playerObj && playersPlayedThisMatch.has(name)) {
        updateStats(playerObj, player);
        return;
      }

      if (playerObj) {
        normalizePlayerNumericFields(playerObj);
        playerObj.matchesPlayed += 1;
        teamKey === winningTeamKey ? (playerObj.won += 1) : (playerObj.lost += 1);
        playerObj.matchIds.push(matchId);
        updateStats(playerObj, player);
      } else {
        playerObj = initializePlayerSaveObject(name);
        teamKey === winningTeamKey ? (playerObj.won += 1) : (playerObj.lost += 1);
        playerObj.matchIds.push(matchId);
        updateStats(playerObj, player);
        playersByName.set(name, playerObj);
      }
      playersPlayedThisMatch.add(name);
    });
  });

  mvpSummary.allPlayers.forEach((breakdown) => {
    const playerObj = playersByName.get(breakdown.name.trim());
    if (playerObj) {
      normalizePlayerNumericFields(playerObj);
      playerObj.mvpPoints += breakdown.totalPoints;
      if (breakdown.name === mvpSummary.manOfTheMatch) {
        playerObj.momCount += 1;
      }
      playerObj.mvpPointsHistory.push(breakdown.totalPoints);
      if (breakdown.totalPoints > playerObj.bestMvpPoints) {
        playerObj.bestMvpPoints = breakdown.totalPoints;
        playerObj.bestMvpMatchId = matchId;
      }
    }
  });
}

async function loadExistingPlayers(firestore) {
  const playersByName = new Map();
  const snapshot = await getDocs(collection(firestore, PLAYER_COLLECTION));
  snapshot.docs.forEach((docSnap) => {
    const player = docSnap.data();
    normalizePlayerNumericFields(player);
    playersByName.set(player.name.trim(), player);
  });
  return playersByName;
}

async function replacePlayerCollection(firestore, playersByName) {
  const existing = await getDocs(collection(firestore, PLAYER_COLLECTION));
  for (const existingDoc of existing.docs) {
    await deleteDoc(doc(firestore, PLAYER_COLLECTION, existingDoc.id));
  }
  for (const player of playersByName.values()) {
    await addDoc(collection(firestore, PLAYER_COLLECTION), { ...player });
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const app = initializeApp(firebaseConfig);
  const firestore = getFirestore(app);

  console.log('Generating a random match...');
  const match = await buildRandomMatch(firestore);

  console.log(
    `${match.team1.name} vs ${match.team2.name} - ${match.totalOvers} overs, ${match.totalPlayers} players/side`
  );
  console.log(
    `${match.team1.name}: ${match.team1.runsScored}/${match.team1.wicketsLost} (${match.team1.oversPlayed} ov)`
  );
  console.log(
    `${match.team2.name}: ${match.team2.runsScored}/${match.team2.wicketsLost} (${match.team2.oversPlayed} ov)`
  );
  console.log(`Result: ${match.matchResult}`);

  const weights = await loadWeights(firestore);
  const mvpSummary = calculateMatchMvp(
    match.team1,
    match.team2,
    match.winningTeamKey,
    match.tossWinner,
    weights,
    match.totalOvers
  );
  console.log(`Man of the Match: ${mvpSummary.manOfTheMatch}`);

  const teamDataForFirestore = {
    team1: { ...match.team1, oversPlayedData: toFirestoreOvers(match.team1.oversPlayedData) },
    team2: { ...match.team2, oversPlayedData: toFirestoreOvers(match.team2.oversPlayedData) },
  };

  const matchRef = await addDoc(collection(firestore, MATCH_COLLECTION), {
    tossWinner: match.tossWinner,
    tossResult: match.tossResult,
    totalOvers: match.totalOvers,
    totalPlayers: match.totalPlayers,
    MatchResult: match.matchResult,
    MatchDate: match.matchDate.toLocaleDateString(),
    FireBaseDate: match.matchDate,
    InningsOneFirstBallTime: match.inningsOneFirstBallTime,
    InningsOneLastBallTime: match.inningsOneLastBallTime,
    InningsTwoFirstBallTime: match.inningsTwoFirstBallTime,
    InningsTwoLastBallTime: match.inningsTwoLastBallTime,
    teamData: teamDataForFirestore,
    mvp: { topFive: mvpSummary.topFive, manOfTheMatch: mvpSummary.manOfTheMatch },
  });

  console.log(`Match saved to ${MATCH_COLLECTION}/${matchRef.id}`);

  console.log('Recomputing PlayerData...');
  const winningTeamKeyForStats = match.matchResult.includes(match.team1.name) ? 'team1' : 'team2';
  const playersByName = await loadExistingPlayers(firestore);
  foldMatchIntoPlayers(playersByName, matchRef.id, winningTeamKeyForStats, match.team1, match.team2, mvpSummary);
  await replacePlayerCollection(firestore, playersByName);

  console.log(`Done. ${playersByName.size} player doc(s) written to ${PLAYER_COLLECTION}.`);
}

main().catch((err) => {
  console.error('simulate-random-match failed:', err);
  process.exit(1);
});
