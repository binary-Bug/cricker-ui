/**
 * One-off backfill script: recomputes the MVP top-5 + Man of the Match for
 * every match in the target mode's MatchData collection, and patches each
 * match document's "mvp" field ({ topFive, manOfTheMatch }) with the result.
 *
 * This is the companion to backfill-mvp-player-data.js: that script fixes
 * every PLAYER's lifetime mvpPoints/momCount totals, while THIS script
 * fixes the per-MATCH "mvp" field that match-details/match-complete read to
 * show the Man of the Match spotlight + top-5 list for a specific match.
 * Matches saved before the MVP feature existed have no "mvp" field at all
 * (LoadMatchService.loadMatch() falls back to `undefined` and the UI simply
 * hides the MoM banner for those) - this script backfills it in for all of
 * them.
 *
 * Only the "mvp" field is patched via updateDoc() - every other field on
 * the match document (teamData, MatchResult, timestamps, etc.) is left
 * untouched.
 *
 * The calculation logic here is a deliberate, careful port of
 * src/app/services/mvp-calculator.service.ts (calculateBattingPoints /
 * calculateBowlingPoints / calculateFieldingPoints / calculateMatchMvp /
 * loadWeights), including the full per-line-item breakdown (battingBreakdown/
 * bowlingBreakdown/fieldingBreakdown/bonusBreakdown) so persisted match docs
 * carry the exact same shape the app itself would save, and the click-through
 * MVP breakdown dialog keeps working for historical matches too. If the
 * scoring rules in that file change again later, this script needs to be
 * manually re-synced - it does not import the TypeScript service directly.
 *
 * Usage (from repo root, required --mode flag):
 *   node temp-scripts/backfill-match-mvp-data.js --mode=test
 *   node temp-scripts/backfill-match-mvp-data.js --mode=prod
 */

const { initializeApp } = require('firebase/app');
const {
  getFirestore,
  collection,
  doc,
  getDocs,
  updateDoc,
} = require('firebase/firestore');

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

const MVP_CONFIG_COLLECTION = 'MvpConfig';

// ---------------------------------------------------------------------------
// CLI flag parsing
// ---------------------------------------------------------------------------

function parseMode() {
  const arg = process.argv.find((a) => a.startsWith('--mode='));
  const mode = arg ? arg.split('=')[1] : undefined;
  if (mode !== 'test' && mode !== 'prod') {
    console.error(
      'Missing/invalid --mode flag. Usage: node temp-scripts/backfill-match-mvp-data.js --mode=test|prod'
    );
    process.exit(1);
  }
  return mode;
}

// ---------------------------------------------------------------------------
// Default MVP weights - mirrors DEFAULT_*_WEIGHTS in mvp-calculator.service.ts
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

// ---------------------------------------------------------------------------
// Utility conversions - mirrors UtilityService.ballplayed
// ---------------------------------------------------------------------------

function ballplayed(oversPlayed) {
  if (oversPlayed === 0) return 0;
  const ballsInOver =
    +parseFloat(oversPlayed - Math.trunc(oversPlayed) + '').toFixed(1) * 10;
  const completedOversBalls = Math.trunc(oversPlayed) * 6;
  return completedOversBalls + ballsInOver;
}

// ---------------------------------------------------------------------------
// MVP calculation with full per-line-item breakdown - mirrors
// MvpCalculatorService.calculateBattingPoints/calculateBowlingPoints/
// calculateFieldingPoints/calculateMatchMvp
// ---------------------------------------------------------------------------

function teamRunRateAsStrikeRate(teamRunRate) {
  return (teamRunRate / 6) * 100;
}

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

  const boundaryPoints =
    batsman.fours * weights.pointsPerFour + batsman.six * weights.pointsPerSix;
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

/** Full port of MvpCalculatorService.calculateMatchMvp, including per-line-item breakdowns and the captain/toss-winner bonuses. */
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

    // Captaincy/toss bonuses - flat, stack additively on top of any
    // all-rounder/triple-threat bonus above. Older matches with an empty
    // team.captain simply never match any player name, safely no-oping.
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

    entry.totalPoints =
      entry.battingPoints + entry.bowlingPoints + entry.fieldingPoints + entry.bonusPoints;
    return entry;
  });

  allPlayers.sort(comparePlayers);
  const topFive = allPlayers.slice(0, 5);
  const manOfTheMatch = topFive.length > 0 ? topFive[0].name : '';
  return { topFive, manOfTheMatch };
}

function getWinningTeamKeyForMvp(team1, team2) {
  if (team1.runsScored === team2.runsScored) return undefined;
  return team1.runsScored > team2.runsScored ? 'team1' : 'team2';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const mode = parseMode();
  const matchCollectionName = mode === 'prod' ? 'MatchData' : 'Test_MatchData';

  console.log(`Backfilling per-match MVP/MoM data for mode="${mode}"`);
  console.log(`Reading + patching matches in "${matchCollectionName}"`);

  const app = initializeApp(firebaseConfig);
  const firestore = getFirestore(app);

  const weights = await loadWeights(firestore);

  const matchesSnapshot = await getDocs(collection(firestore, matchCollectionName));
  console.log(`Found ${matchesSnapshot.docs.length} match(es) to process.`);

  let updatedCount = 0;
  let skippedCount = 0;

  for (const matchDoc of matchesSnapshot.docs) {
    const data = matchDoc.data();
    const team1 = data.teamData && data.teamData.team1;
    const team2 = data.teamData && data.teamData.team2;
    if (!team1 || !team2) {
      console.warn(`Skipping ${matchDoc.id} - missing teamData.`);
      skippedCount++;
      continue;
    }

    const totalOvers = data.totalOvers ?? 0;
    const winningTeamKeyForMvp = getWinningTeamKeyForMvp(team1, team2);
    const tossWinnerKey =
      data.tossWinner === 'team1' || data.tossWinner === 'team2' ? data.tossWinner : undefined;

    const mvpSummary = calculateMatchMvp(
      team1,
      team2,
      winningTeamKeyForMvp,
      tossWinnerKey,
      weights,
      totalOvers
    );

    await updateDoc(doc(firestore, matchCollectionName, matchDoc.id), {
      mvp: {
        topFive: mvpSummary.topFive,
        manOfTheMatch: mvpSummary.manOfTheMatch,
      },
    });
    console.log(`Updated ${matchDoc.id} - MoM: ${mvpSummary.manOfTheMatch || '(none)'}`);
    updatedCount++;
  }

  console.log(`Done. Updated ${updatedCount} match(es), skipped ${skippedCount}.`);
}

main().catch((err) => {
  console.error('Match MVP backfill failed:', err);
  process.exit(1);
});
