/**
 * One-off script: seeds the "MvpConfig" Firestore collection with the
 * initial MVP scoring rulebook (batting/bowling/fielding/bonuses weights).
 *
 * This collection is shared by both prod and test mode - it's a ruleset,
 * not match data - so there's no --mode flag here, unlike
 * backfill-mvp-player-data.js.
 *
 * Safe to re-run: uses setDoc() with fixed document IDs, so re-running
 * simply overwrites the same 4 documents with these same values (it will
 * NOT reset any values you've since tuned manually in the Firestore
 * console - re-running this script after manual tuning WILL overwrite
 * your manual changes back to these defaults, so only re-run intentionally).
 *
 * Usage (from repo root):
 *   node temp-scripts/seed-mvp-config.js
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

// Same public client config already committed in src/app/app.config.ts -
// the app itself writes to Firestore unauthenticated with this config, so
// this standalone script can safely reuse it the same way.
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

// Mirrors DEFAULT_BATTING_WEIGHTS / DEFAULT_BOWLING_WEIGHTS /
// DEFAULT_FIELDING_WEIGHTS / DEFAULT_BONUS_WEIGHTS in
// src/app/services/mvp-calculator.service.ts as of the MVP feature launch.
const seedDocs = {
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

async function main() {
  const app = initializeApp(firebaseConfig);
  const firestore = getFirestore(app);

  for (const [docId, data] of Object.entries(seedDocs)) {
    await setDoc(doc(firestore, MVP_CONFIG_COLLECTION, docId), data);
    console.log(`Seeded ${MVP_CONFIG_COLLECTION}/${docId}`);
  }

  console.log('Done. MvpConfig collection seeded successfully.');
}

main().catch((err) => {
  console.error('Failed to seed MvpConfig:', err);
  process.exit(1);
});
