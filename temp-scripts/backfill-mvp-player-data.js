/**
 * One-off backfill script: fully replays every match in the target mode's
 * MatchData collection and rebuilds every player's aggregate stats doc
 * (batting/bowling/fielding totals AND lifetime mvpPoints/momCount) from
 * scratch in the matching PlayerData collection.
 *
 * This is needed because PlayerService.applyMvpPointsToPlayers() had a bug
 * (now fixed in src/app/services/player.service.ts) where any player whose
 * doc predated the MVP feature would have mvpPoints/momCount go straight to
 * NaN (undefined + number = NaN) on their very next match, and that NaN
 * would then persist in Firestore forever. The code fix stops any FURTHER
 * corruption, but doesn't repair data that's already NaN - hence this
 * one-off full replay.
 *
 * The calculation logic here is a deliberate, careful port of:
 *   - src/app/services/mvp-calculator.service.ts (calculateBattingPoints /
 *     calculateBowlingPoints / calculateFieldingPoints / calculateMatchMvp /
 *     loadWeights)
 *   - src/app/services/player.service.ts (updatePlayerStats / updateStats /
 *     updateBatsmenStats / updateBowlerStats / updateFielderStats /
 *     initializePlayerSaveObject / applyMvpPointsToPlayers, with the NaN fix
 *     already applied)
 *   - src/app/services/load-match.service.ts (UpdateProdPlayerData /
 *     getWinningTeamKeyForLoadedMatch)
 * If the scoring rules or player-stats logic change in those files again
 * later, this script needs to be manually re-synced - it does not import
 * the TypeScript services directly.
 *
 * Usage (from repo root, required --mode flag):
 *   node temp-scripts/backfill-mvp-player-data.js --mode=test
 *   node temp-scripts/backfill-mvp-player-data.js --mode=prod
 */

const { initializeApp } = require('firebase/app');
const {
  getFirestore,
  collection,
  doc,
  getDocs,
  deleteDoc,
  addDoc,
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
      'Missing/invalid --mode flag. Usage: node temp-scripts/backfill-mvp-player-data.js --mode=test|prod'
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
// Utility conversions - mirrors UtilityService.ballplayed/convertToOvers
// ---------------------------------------------------------------------------

function ballplayed(oversPlayed) {
  if (oversPlayed === 0) return 0;
  const ballsInOver =
    +parseFloat(oversPlayed - Math.trunc(oversPlayed) + '').toFixed(1) * 10;
  const completedOversBalls = Math.trunc(oversPlayed) * 6;
  return completedOversBalls + ballsInOver;
}

function convertToOvers(balls) {
  if (balls === 0) return 0;
  const completedOvers = Math.trunc(balls / 6);
  const ballsLeftInOver = balls - completedOvers * 6;
  return +(completedOvers + '.' + ballsLeftInOver);
}

// ---------------------------------------------------------------------------
// MVP calculation - mirrors MvpCalculatorService
// ---------------------------------------------------------------------------

function teamRunRateAsStrikeRate(teamRunRate) {
  return (teamRunRate / 6) * 100;
}

function calculateBattingPoints(batsman, weights, totalOvers, battingTeamRunRate) {
  let points = 0;
  points += batsman.runs * weights.pointsPerRun;
  points += batsman.fours * weights.pointsPerFour + batsman.six * weights.pointsPerSix;

  const scaledMilestoneThreshold = Math.round(totalOvers * weights.milestoneRunsPerOverFactor);
  const milestoneThreshold = Math.max(weights.minimumMilestoneRuns, scaledMilestoneThreshold);
  if (milestoneThreshold > 0 && batsman.runs >= milestoneThreshold) {
    points += weights.milestoneBonusPoints;
  }

  if (
    batsman.runs === 0 &&
    batsman.status !== 'Not Out' &&
    batsman.balls >= weights.minBallsFacedForDuckPenalty
  ) {
    points -= weights.duckPenaltyPoints;
  }

  if (batsman.balls >= weights.minBallsFacedForStrikeRateAdjustment) {
    const strikeRate = (batsman.runs / batsman.balls) * 100;
    const benchmarkStrikeRate = teamRunRateAsStrikeRate(battingTeamRunRate);
    if (strikeRate >= benchmarkStrikeRate * weights.strikeRateBonusMultiplier) {
      points += weights.strikeRateBonusPoints;
    } else if (strikeRate <= benchmarkStrikeRate * weights.strikeRatePenaltyMultiplier) {
      points -= weights.strikeRatePenaltyPoints;
    }
  }

  return points;
}

function calculateBowlingPoints(bowler, weights, totalOvers, opposingBattingTeamRunRate) {
  let points = 0;
  points += bowler.wickets * weights.pointsPerWicket;
  points += bowler.maidens * weights.pointsPerMaiden;

  const scaledHaulThreshold = Math.ceil(totalOvers / weights.wicketHaulOversPerWicketFactor);
  const haulThreshold = Math.max(weights.minimumWicketHaulCount, scaledHaulThreshold);
  if (bowler.wickets >= haulThreshold) {
    points += weights.wicketHaulBonusPoints;
  }

  if (bowler.overs >= weights.minOversBowledForEconomyAdjustment) {
    const economy = (bowler.runs / ballplayed(bowler.overs)) * 6;
    if (economy <= opposingBattingTeamRunRate * weights.economyBonusMultiplier) {
      points += weights.economyBonusPoints;
    } else if (economy >= opposingBattingTeamRunRate * weights.economyPenaltyMultiplier) {
      points -= weights.economyPenaltyPoints;
    }
  }

  return points;
}

function calculateFieldingPoints(fielder, weights) {
  let points = 0;
  points += fielder.catches * weights.pointsPerCatch;
  points += fielder.runOuts * weights.pointsPerRunOut;
  points += fielder.stumpOuts * weights.pointsPerStumping;
  return points;
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
      entry.battingPoints += calculateBattingPoints(
        batsman,
        weights.batting,
        totalOvers,
        team.runRate
      );
      entry.runsScored += batsman.runs;
    });

    (team.Bowlers || []).forEach((bowler) => {
      const entry = getOrCreate(bowler.name, isOnWinningTeam, key);
      entry.bowlingPoints += calculateBowlingPoints(
        bowler,
        weights.bowling,
        totalOvers,
        opponent.runRate
      );
      entry.wicketsTaken += bowler.wickets;
    });

    (team.Fielders || []).forEach((fielder) => {
      const entry = getOrCreate(fielder.name, isOnWinningTeam, key);
      entry.fieldingPoints += calculateFieldingPoints(fielder, weights.fielding);
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
    } else if (disciplineCount >= weights.bonuses.allRounderMinDisciplines) {
      entry.bonusPoints = weights.bonuses.allRounderBonusPoints;
    } else {
      entry.bonusPoints = 0;
    }

    // Captaincy/toss bonuses - flat, stack additively on top of any
    // all-rounder/triple-threat bonus above.
    const teamForEntry = entry.teamKey === 'team1' ? team1 : team2;
    const captainName = teamForEntry.captain && teamForEntry.captain.trim();
    if (captainName && entry.name.trim() === captainName) {
      entry.bonusPoints += weights.bonuses.captainBonusPoints;
      if (tossWinnerKey && entry.teamKey === tossWinnerKey) {
        entry.bonusPoints += weights.bonuses.tossWinCaptainBonusPoints;
      }
    }

    entry.totalPoints =
      entry.battingPoints + entry.bowlingPoints + entry.fieldingPoints + entry.bonusPoints;
    return entry;
  });

  allPlayers.sort(comparePlayers);
  const manOfTheMatch = allPlayers.length > 0 ? allPlayers[0].name : '';
  return { manOfTheMatch, allPlayers };
}

function getWinningTeamKeyForMvp(team1, team2) {
  if (team1.runsScored === team2.runsScored) return undefined;
  return team1.runsScored > team2.runsScored ? 'team1' : 'team2';
}

// ---------------------------------------------------------------------------
// Player stats accumulation - mirrors PlayerService.updatePlayerStats/
// updateStats/updateBatsmenStats/updateBowlerStats/updateFielderStats/
// initializePlayerSaveObject/applyMvpPointsToPlayers
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

function normalizeMvpFields(player) {
  if (player.mvpPoints === undefined || isNaN(player.mvpPoints)) player.mvpPoints = 0;
  if (player.momCount === undefined || isNaN(player.momCount)) player.momCount = 0;
  if (player.bestMvpPoints === undefined || isNaN(player.bestMvpPoints)) player.bestMvpPoints = 0;
  if (player.bestMvpMatchId === undefined || player.bestMvpMatchId === null) player.bestMvpMatchId = '';
  if (!player.mvpPointsHistory) player.mvpPointsHistory = [];
}

function updateBatsmenStats(playerSaveObj, playerData) {
  playerSaveObj.runsScored += playerData.runs;
  playerSaveObj.ballsPlayed += playerData.balls;
  playerSaveObj.fours += playerData.fours;
  playerSaveObj.sixes += playerData.six;

  if (playerSaveObj.highestScore !== undefined && playerSaveObj.highestScore !== null) {
    if (playerData.runs > playerSaveObj.highestScore) {
      playerSaveObj.highestScore = playerData.runs;
      playerSaveObj.isNotOutHS = playerData.status === 'Not Out';
    } else if (playerSaveObj.highestScore === playerData.runs) {
      if (playerData.status === 'Not Out') {
        playerSaveObj.highestScore = playerData.runs;
        playerSaveObj.isNotOutHS = true;
      }
    }
  } else {
    playerSaveObj.highestScore = playerData.runs;
    playerSaveObj.isNotOutHS = playerData.status === 'Not Out';
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
  playerSaveObj.overs = convertToOvers(
    ballplayed(playerData.overs) + ballplayed(playerSaveObj.overs)
  );
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
  if (player.fours !== undefined && player.fours !== null) {
    updateBatsmenStats(playerSaveObj, player);
  } else if (player.wickets !== undefined && player.wickets !== null) {
    updateBowlerStats(playerSaveObj, player);
  } else {
    updateFielderStats(playerSaveObj, player);
  }
}

/**
 * Folds one match's contributions (batting/bowling/fielding stats AND MVP
 * points/MoM count) into the running `playersByName` map. Mirrors
 * PlayerService.updatePlayerStats()'s "6 lists" traversal + its
 * playersPlayedList de-dup (so an all-rounder's matchesPlayed/won/lost/
 * matchIds only increment once per match, even though updateStats() is
 * called once per discipline they contributed in), followed by
 * PlayerService.applyMvpPointsToPlayers() (already NaN-safe).
 */
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

  // MVP points/MoM count - mirrors applyMvpPointsToPlayers, NaN-safe.
  // Also tracks bestMvpPoints/bestMvpMatchId/mvpPointsHistory (Phase 1
  // additions), one history entry appended per match played, in the order
  // matches are replayed - callers of foldMatchIntoPlayers() must replay
  // matches sorted oldest-first (see sortedMatchDocs in main()) so this
  // history stays chronological, matching what the player-details MVP trend
  // sparkline assumes.
  mvpSummary.allPlayers.forEach((breakdown) => {
    const playerObj = playersByName.get(breakdown.name.trim());
    if (playerObj) {
      normalizeMvpFields(playerObj);
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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const mode = parseMode();
  const matchCollectionName = mode === 'prod' ? 'MatchData' : 'Test_MatchData';
  const playerCollectionName = mode === 'prod' ? 'PlayerData' : 'Test_PlayerData';

  console.log(`Backfilling MVP + player stats for mode="${mode}"`);
  console.log(`Reading matches from "${matchCollectionName}", rewriting "${playerCollectionName}"`);

  const app = initializeApp(firebaseConfig);
  const firestore = getFirestore(app);

  const weights = await loadWeights(firestore);

  const matchesSnapshot = await getDocs(collection(firestore, matchCollectionName));
  console.log(`Found ${matchesSnapshot.docs.length} match(es) to replay.`);

  // getDocs() with no orderBy returns Firestore's default (arbitrary,
  // doc-ID-based) order, which for auto-generated addDoc() IDs is NOT
  // chronological. foldMatchIntoPlayers() appends one entry per match onto
  // Player.mvpPointsHistory in whatever order matches are replayed here, and
  // the player-details MVP trend sparkline assumes that array is in match
  // order - so sort oldest-first by FireBaseDate (the same field
  // LoadMatchService.getAllMatches() sorts match-browsing by) before
  // replaying, rather than trusting doc order.
  const sortedMatchDocs = [...matchesSnapshot.docs].sort((a, b) => {
    const aMillis = a.data().FireBaseDate?.toMillis?.() ?? 0;
    const bMillis = b.data().FireBaseDate?.toMillis?.() ?? 0;
    return aMillis - bMillis;
  });

  const playersByName = new Map();
  let processedCount = 0;

  sortedMatchDocs.forEach((matchDoc) => {
    const data = matchDoc.data();
    const team1 = data.teamData && data.teamData.team1;
    const team2 = data.teamData && data.teamData.team2;
    if (!team1 || !team2) {
      console.warn(`Skipping ${matchDoc.id} - missing teamData.`);
      return;
    }

    const totalOvers = data.totalOvers ?? 0;
    const matchResult = data.MatchResult || '';
    // Mirrors PlayerService.savePlayerData()'s won/lost determination.
    const winningTeamKey = matchResult.includes(team1.name) ? 'team1' : 'team2';
    // Mirrors LoadMatchService.getWinningTeamKeyForLoadedMatch()'s
    // separate runsScored-based determination, used only for the MVP
    // winning-team tie-break rule (undefined for a tie).
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

    foldMatchIntoPlayers(playersByName, matchDoc.id, winningTeamKey, team1, team2, mvpSummary);
    processedCount++;
  });

  console.log(`Replayed ${processedCount} match(es). Computed ${playersByName.size} player(s).`);

  console.log(`Deleting existing docs in "${playerCollectionName}"...`);
  const existingPlayers = await getDocs(collection(firestore, playerCollectionName));
  for (const existingDoc of existingPlayers.docs) {
    await deleteDoc(doc(firestore, playerCollectionName, existingDoc.id));
  }
  console.log(`Deleted ${existingPlayers.docs.length} existing doc(s).`);

  console.log(`Writing ${playersByName.size} player doc(s) to "${playerCollectionName}"...`);
  for (const player of playersByName.values()) {
    await addDoc(collection(firestore, playerCollectionName), { ...player });
  }

  console.log('Done. Backfill completed successfully.');
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
