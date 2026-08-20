import { inject, Injectable } from '@angular/core';
import { collection, Firestore, getDocs } from '@angular/fire/firestore';
import { Team } from '../models/team.interface';
import { Batsmen } from '../models/batsmen.interface';
import { Bowler } from '../models/bowler.interface';
import { Fielder } from '../models/fielder.interface';
import { UtilityService } from './utility.service';
import {
  BattingMvpWeights,
  BonusMvpWeights,
  BowlingMvpWeights,
  FieldingMvpWeights,
  MatchMvpSummary,
  MvpLineItem,
  MvpWeightsConfig,
  PlayerMvpBreakdown,
} from '../models/mvp.interface';

/**
 * Firestore collection that holds the MVP scoring rulebook. It's a real
 * collection (not one fixed document) with one document per section, the
 * same way MatchData/PlayerData are collections with many documents -
 * see the 4 document IDs below. Shared by both prod and test mode - the
 * points system is a ruleset, not match data, so there's no Test_ prefixed
 * duplicate of this collection.
 */
export const MVP_CONFIG_COLLECTION = 'MvpConfig';

/** Document IDs inside MVP_CONFIG_COLLECTION - one per weights section. */
export const MVP_CONFIG_DOC_IDS = {
  batting: 'batting',
  bowling: 'bowling',
  fielding: 'fielding',
  bonuses: 'bonuses',
} as const;

/**
 * Hardcoded fallback defaults for every single weight the points system
 * uses. These are applied on a PER-FIELD basis (not all-or-nothing) when
 * loadWeights() can't find a matching document, or a document is missing
 * some of its fields, in Firestore - so the feature always works (with
 * sensible numbers) even before an admin has configured MvpConfig at all.
 */
const DEFAULT_BATTING_WEIGHTS: BattingMvpWeights = {
  pointsPerRun: 1,
  pointsPerFour: 1,
  pointsPerSix: 2,
  // 2.5 runs/over -> a 50-run milestone for a 20-over match.
  milestoneRunsPerOverFactor: 2.5,
  // Floors the target at a genuine 20-run innings even in very short
  // matches, where 2.5 runs/over alone would round to a trivial number.
  minimumMilestoneRuns: 20,
  milestoneBonusPoints: 8,
  duckPenaltyPoints: 2,
  minBallsFacedForDuckPenalty: 1,
  strikeRateBonusMultiplier: 1.25,
  strikeRateBonusPoints: 4,
  strikeRatePenaltyMultiplier: 0.65,
  strikeRatePenaltyPoints: 2,
  minBallsFacedForStrikeRateAdjustment: 10,
};

const DEFAULT_BOWLING_WEIGHTS: BowlingMvpWeights = {
  pointsPerWicket: 25,
  // ~6.67 overs/wicket -> a 3-wicket haul target for a 20-over match.
  wicketHaulOversPerWicketFactor: 6.67,
  // Floors the target at 2 wickets even in very short matches - a single
  // wicket is never a "haul", regardless of how few overs are bowled.
  minimumWicketHaulCount: 2,
  wicketHaulBonusPoints: 8,
  pointsPerMaiden: 1,
  economyBonusMultiplier: 0.75,
  economyBonusPoints: 4,
  economyPenaltyMultiplier: 1.35,
  economyPenaltyPoints: 2,
  minOversBowledForEconomyAdjustment: 2,
};

const DEFAULT_FIELDING_WEIGHTS: FieldingMvpWeights = {
  pointsPerCatch: 8,
  pointsPerRunOut: 10,
  pointsPerStumping: 10,
};

const DEFAULT_BONUS_WEIGHTS: BonusMvpWeights = {
  allRounderMinDisciplines: 2,
  allRounderBonusPoints: 6,
  tripleThreatMinDisciplines: 3,
  tripleThreatBonusPoints: 12,
  captainBonusPoints: 1,
  tossWinCaptainBonusPoints: 1,
};

const DEFAULT_MVP_WEIGHTS: MvpWeightsConfig = {
  batting: DEFAULT_BATTING_WEIGHTS,
  bowling: DEFAULT_BOWLING_WEIGHTS,
  fielding: DEFAULT_FIELDING_WEIGHTS,
  bonuses: DEFAULT_BONUS_WEIGHTS,
};

/**
 * Computes MVP (Most Valuable Player) points for every player in a
 * finished match, ranks them, and picks the top 5 + Man of the Match.
 *
 * The scoring rulebook (MvpWeightsConfig) is loaded from Firestore so it
 * can be tuned without a redeploy - see loadWeights(). Everything here is
 * otherwise pure/synchronous calculation over the Team data already held
 * by MatchService once a match is complete.
 */
@Injectable({
  providedIn: 'root',
})
export class MvpCalculatorService {
  firestore = inject(Firestore);
  utilityService = inject(UtilityService);

  /**
   * In-memory cache of the loaded weights, same caching pattern as
   * PlayerService.players - once loaded for this app session, we don't
   * re-fetch on every match (the rulebook doesn't change mid-session).
   */
  private cachedWeights: MvpWeightsConfig | null = null;
  // Shared in-flight request so concurrent callers before the first fetch
  // resolves await the same Firestore read instead of each firing their
  // own duplicate getDocs() call.
  private pendingLoadWeights: Promise<MvpWeightsConfig> | null = null;

  /**
   * Loads the MVP scoring rulebook from the "MvpConfig" collection.
   * Starts from a full set of hardcoded defaults, then overlays whatever
   * fields Firestore actually has - field by field, not document by
   * document - so a partially configured (or entirely absent) collection
   * never breaks MVP calculation; it just falls back to sensible defaults
   * for whatever isn't configured yet.
   */
  async loadWeights(): Promise<MvpWeightsConfig> {
    if (this.cachedWeights) return this.cachedWeights;
    if (this.pendingLoadWeights) return this.pendingLoadWeights;
    this.pendingLoadWeights = this.fetchWeights().finally(() => {
      this.pendingLoadWeights = null;
    });
    return this.pendingLoadWeights;
  }

  private async fetchWeights(): Promise<MvpWeightsConfig> {
    // Start from a deep copy of the defaults so we always have a complete,
    // valid config even if Firestore has nothing (or errors out) below.
    const weights: MvpWeightsConfig = JSON.parse(
      JSON.stringify(DEFAULT_MVP_WEIGHTS)
    );

    try {
      const snapshot = await getDocs(
        collection(this.firestore, MVP_CONFIG_COLLECTION)
      );
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        switch (docSnap.id) {
          case MVP_CONFIG_DOC_IDS.batting:
            Object.assign(weights.batting, data);
            break;
          case MVP_CONFIG_DOC_IDS.bowling:
            Object.assign(weights.bowling, data);
            break;
          case MVP_CONFIG_DOC_IDS.fielding:
            Object.assign(weights.fielding, data);
            break;
          case MVP_CONFIG_DOC_IDS.bonuses:
            Object.assign(weights.bonuses, data);
            break;
          // Unknown document IDs are ignored rather than throwing - keeps
          // this forward-compatible if more sections get added later.
        }
      });
    } catch {
      // If Firestore is unreachable or the collection doesn't exist yet,
      // silently keep the hardcoded defaults - MVP calculation should
      // never hard-fail a match save just because config is missing.
    }

    this.cachedWeights = weights;
    return weights;
  }

  /**
   * Converts a team's runRate (runs per over, e.g. 8.4) into the
   * equivalent "runs per 100 balls" figure so it's directly comparable to
   * a batter's strike rate. 1 over = 6 balls, so runs-per-ball = runRate/6,
   * and runs-per-100-balls = that * 100.
   */
  private teamRunRateAsStrikeRate(teamRunRate: number): number {
    return (teamRunRate / 6) * 100;
  }

  /** Batting points for a single batter's innings in this match, plus a line-by-line breakdown explaining how the total was reached. */
  calculateBattingPoints(
    batsman: Batsmen,
    weights: BattingMvpWeights,
    totalOvers: number,
    battingTeamRunRate: number
  ): { points: number; items: MvpLineItem[] } {
    let points = 0;
    const items: MvpLineItem[] = [];

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

    // Milestone bonus - threshold scales with match length so a 5-over
    // game and a 20-over game don't use the same fixed runs target, but
    // never drops below minimumMilestoneRuns - otherwise very short
    // matches would round down to a trivially easy target.
    const rawMilestoneThreshold =
      totalOvers * weights.milestoneRunsPerOverFactor;
    const scaledMilestoneThreshold = Math.round(rawMilestoneThreshold);
    const milestoneThreshold = Math.max(
      weights.minimumMilestoneRuns,
      scaledMilestoneThreshold
    );
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

    // Duck penalty - only if they actually faced enough balls to count as
    // a "real" dismissal for 0, and they were actually out (not unbeaten).
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

    // Strike-rate bonus/penalty - compared against this batter's OWN
    // team's run rate for the innings, only once they've faced enough
    // balls for the comparison to be meaningful.
    if (batsman.balls >= weights.minBallsFacedForStrikeRateAdjustment) {
      const strikeRate = (batsman.runs / batsman.balls) * 100;
      const benchmarkStrikeRate = this.teamRunRateAsStrikeRate(
        battingTeamRunRate
      );
      if (strikeRate >= benchmarkStrikeRate * weights.strikeRateBonusMultiplier) {
        points += weights.strikeRateBonusPoints;
        items.push({
          label: 'Strike Rate Bonus',
          points: weights.strikeRateBonusPoints,
          detail: `Struck at ${strikeRate.toFixed(0)} vs team's ${benchmarkStrikeRate.toFixed(0)} (+${weights.strikeRateBonusPoints} pts)`,
        });
      } else if (
        strikeRate <=
        benchmarkStrikeRate * weights.strikeRatePenaltyMultiplier
      ) {
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

  /** Bowling points for a single bowler's spell in this match, plus a line-by-line breakdown explaining how the total was reached. */
  calculateBowlingPoints(
    bowler: Bowler,
    weights: BowlingMvpWeights,
    totalOvers: number,
    opposingBattingTeamRunRate: number
  ): { points: number; items: MvpLineItem[] } {
    let points = 0;
    const items: MvpLineItem[] = [];

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

    // Wicket-haul bonus - threshold scales with match length (fewer overs
    // means fewer realistic chances at a big haul), but never drops below
    // minimumWicketHaulCount - a single wicket is never a "haul", however
    // few overs were bowled.
    const rawHaulThreshold = totalOvers / weights.wicketHaulOversPerWicketFactor;
    const scaledHaulThreshold = Math.ceil(rawHaulThreshold);
    const haulThreshold = Math.max(
      weights.minimumWicketHaulCount,
      scaledHaulThreshold
    );
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

    // Economy bonus/penalty - compared against the OPPOSING (batting)
    // team's own run rate for that innings, i.e. how this bowler's economy
    // stacks up against how fast that specific team scored overall. Only
    // applied once enough overs have been bowled for the comparison to be
    // meaningful.
    //
    // bowler.overs is stored in cricket "x.y" notation (e.g. 3.4 = 3 overs
    // and 4 balls), not decimal overs, so we convert to a ball count via
    // UtilityService before dividing - same convention already used by
    // StatsComponent.calculateEco().
    if (bowler.overs >= weights.minOversBowledForEconomyAdjustment) {
      const economy =
        (bowler.runs / this.utilityService.ballplayed(bowler.overs)) * 6;
      if (economy <= opposingBattingTeamRunRate * weights.economyBonusMultiplier) {
        points += weights.economyBonusPoints;
        items.push({
          label: 'Economy Bonus',
          points: weights.economyBonusPoints,
          detail: `Economy of ${economy.toFixed(2)} vs opponent's ${opposingBattingTeamRunRate.toFixed(2)} (+${weights.economyBonusPoints} pts)`,
        });
      } else if (
        economy >=
        opposingBattingTeamRunRate * weights.economyPenaltyMultiplier
      ) {
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

  /** Fielding points for a single fielder's contributions in this match - flat per-count, no match-format scaling needed. Also returns a line-by-line breakdown. */
  calculateFieldingPoints(
    fielder: Fielder,
    weights: FieldingMvpWeights
  ): { points: number; items: MvpLineItem[] } {
    let points = 0;
    const items: MvpLineItem[] = [];

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

  /**
   * Ranking comparator used to sort players from best to worst MVP
   * performance. Primary key is total points (descending). When two
   * players end up with EXACTLY equal totals, ties are broken in this
   * order (as agreed with the user):
   *   1. Player on the winning team ranks higher.
   *   2. Otherwise, the player who contributed across more disciplines
   *      (batting/bowling/fielding) ranks higher - an all-rounder
   *      performance is preferred over a one-dimensional one when points
   *      are otherwise level.
   *   3. Otherwise, more runs scored wins, then more wickets taken, then
   *      alphabetical by name (purely to guarantee a fully deterministic
   *      order - this last step should practically never be needed).
   */
  private comparePlayers(a: PlayerMvpBreakdown, b: PlayerMvpBreakdown): number {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (a.isOnWinningTeam !== b.isOnWinningTeam) {
      return a.isOnWinningTeam ? -1 : 1;
    }
    if (b.disciplineCount !== a.disciplineCount) {
      return b.disciplineCount - a.disciplineCount;
    }
    if (b.runsScored !== a.runsScored) return b.runsScored - a.runsScored;
    if (b.wicketsTaken !== a.wicketsTaken) return b.wicketsTaken - a.wicketsTaken;
    return a.name.localeCompare(b.name);
  }

  /**
   * Calculates MVP points for every player who took part in a finished
   * match, ranks them, and returns the full result (see MatchMvpSummary
   * doc comment for why `allPlayers` exists alongside `topFive`).
   *
   * @param winningTeamKey 'team1' | 'team2' if the match had a clear
   *   winner, or undefined for a tie - a tie simply means the "winning
   *   team" tie-break rule above doesn't favor anyone, it isn't treated as
   *   an error.
   * @param tossWinnerKey 'team1' | 'team2' if the toss result is known, or
   *   undefined for older matches saved before toss tracking existed - used
   *   only for the toss-winning captain bonus below, never affects ranking.
   */
  calculateMatchMvp(
    team1: Team,
    team2: Team,
    winningTeamKey: 'team1' | 'team2' | undefined,
    tossWinnerKey: 'team1' | 'team2' | undefined,
    weights: MvpWeightsConfig,
    totalOvers: number
  ): MatchMvpSummary {
    // name -> in-progress breakdown, built up as we walk each team's
    // Batsmens/Bowlers/Fielders arrays. Same "find or create an entry for
    // this player name" merge pattern PlayerService.updatePlayerStats()
    // already uses to combine a single player's contributions across all
    // 3 disciplines into one record.
    const breakdownsByName = new Map<string, PlayerMvpBreakdown>();

    const getOrCreate = (
      name: string,
      isOnWinningTeam: boolean,
      teamKey: 'team1' | 'team2'
    ): PlayerMvpBreakdown => {
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

    const teams: { team: Team; key: 'team1' | 'team2'; opponent: Team }[] = [
      { team: team1, key: 'team1', opponent: team2 },
      { team: team2, key: 'team2', opponent: team1 },
    ];

    teams.forEach(({ team, key, opponent }) => {
      const isOnWinningTeam = winningTeamKey === key;

      team.Batsmens.forEach((batsman) => {
        const entry = getOrCreate(batsman.name, isOnWinningTeam, key);
        const result = this.calculateBattingPoints(
          batsman,
          weights.batting,
          totalOvers,
          team.runRate
        );
        entry.battingPoints += result.points;
        entry.battingBreakdown.push(...result.items);
        entry.runsScored += batsman.runs;
      });

      team.Bowlers.forEach((bowler) => {
        const entry = getOrCreate(bowler.name, isOnWinningTeam, key);
        const result = this.calculateBowlingPoints(
          bowler,
          weights.bowling,
          totalOvers,
          opponent.runRate
        );
        entry.bowlingPoints += result.points;
        entry.bowlingBreakdown.push(...result.items);
        entry.wicketsTaken += bowler.wickets;
      });

      team.Fielders.forEach((fielder) => {
        const entry = getOrCreate(fielder.name, isOnWinningTeam, key);
        const result = this.calculateFieldingPoints(fielder, weights.fielding);
        entry.fieldingPoints += result.points;
        entry.fieldingBreakdown.push(...result.items);
      });
    });

    // Now that every discipline's points are known per player, work out
    // discipline count + all-rounder/triple-threat bonus + the final total.
    const allPlayers = Array.from(breakdownsByName.values()).map((entry) => {
      let disciplineCount = 0;
      if (entry.battingPoints > 0) disciplineCount++;
      if (entry.bowlingPoints > 0) disciplineCount++;
      if (entry.fieldingPoints > 0) disciplineCount++;
      entry.disciplineCount = disciplineCount;

      // Triple-threat and all-rounder bonuses don't stack - the bigger
      // triple-threat bonus takes over once a player qualifies for it.
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
      // all-rounder/triple-threat bonus above (unlike those two, which
      // don't stack with each other). Older matches saved before captain
      // selection existed simply have an empty team.captain, so no player
      // name will ever match it and this safely no-ops for them.
      const teamForEntry = entry.teamKey === 'team1' ? team1 : team2;
      const captainName = teamForEntry.captain?.trim();
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
        entry.battingPoints +
        entry.bowlingPoints +
        entry.fieldingPoints +
        entry.bonusPoints;

      return entry;
    });

    allPlayers.sort((a, b) => this.comparePlayers(a, b));

    const topFive = allPlayers.slice(0, 5);
    const manOfTheMatch = topFive.length > 0 ? topFive[0].name : '';

    return { topFive, manOfTheMatch, allPlayers };
  }

  /**
   * Builds a plain-English, section-by-section explanation of the points
   * system, driven entirely by the ACTUAL loaded weights (never hardcoded
   * copy) so this stays accurate if an admin tunes the numbers in
   * Firestore. Powers the user-facing "how are points calculated?" help
   * dialog (MvpHelpDialog).
   *
   * When `totalOvers` is supplied (opened from a specific match's Match
   * Info tab), milestone/haul thresholds are resolved to concrete numbers
   * for that match's format. When omitted (opened from the general Stats
   * page, where there's no single match in view), the formula/scaling
   * factor is described in words instead.
   */
  describeRules(
    weights: MvpWeightsConfig,
    totalOvers?: number
  ): { section: string; lines: string[] }[] {
    const b = weights.batting;
    const bl = weights.bowling;
    const f = weights.fielding;
    const bonus = weights.bonuses;

    const milestoneLine =
      totalOvers && totalOvers > 0
        ? `Score ${Math.max(
            b.minimumMilestoneRuns,
            Math.round(totalOvers * b.milestoneRunsPerOverFactor)
          )}+ runs in this match for a +${b.milestoneBonusPoints} point milestone bonus.`
        : `A runs milestone bonus of +${b.milestoneBonusPoints} points applies once you reach a target that scales with the match length (longer matches need more runs, though it never drops below ${b.minimumMilestoneRuns} runs).`;

    const haulLine =
      totalOvers && totalOvers > 0
        ? `Take ${Math.max(
            bl.minimumWicketHaulCount,
            Math.ceil(totalOvers / bl.wicketHaulOversPerWicketFactor)
          )}+ wickets in this match for a +${bl.wicketHaulBonusPoints} point haul bonus.`
        : `A wicket-haul bonus of +${bl.wicketHaulBonusPoints} points applies once you take enough wickets for the match length (longer matches need more wickets, though it never drops below ${bl.minimumWicketHaulCount} wickets).`;

    return [
      {
        section: 'Batting',
        lines: [
          `+${b.pointsPerRun} point per run scored.`,
          `+${b.pointsPerFour} bonus point per four, +${b.pointsPerSix} bonus points per six.`,
          milestoneLine,
          `-${b.duckPenaltyPoints} points for being out for a duck (0 runs, after facing at least ${b.minBallsFacedForDuckPenalty} ball(s)).`,
          `Bonus/penalty points for scoring noticeably faster or slower than your own team's overall run rate (only applies after facing at least ${b.minBallsFacedForStrikeRateAdjustment} balls).`,
        ],
      },
      {
        section: 'Bowling',
        lines: [
          `+${bl.pointsPerWicket} points per wicket - the single biggest point value, since wickets usually decide matches.`,
          haulLine,
          `+${bl.pointsPerMaiden} point per maiden over.`,
          `Bonus/penalty points for bowling noticeably more economically or expensively than the batting team's overall run rate (only applies after bowling at least ${bl.minOversBowledForEconomyAdjustment} over(s)).`,
        ],
      },
      {
        section: 'Fielding',
        lines: [
          `+${f.pointsPerCatch} points per catch.`,
          `+${f.pointsPerRunOut} points per run out.`,
          `+${f.pointsPerStumping} points per stumping.`,
        ],
      },
      {
        section: 'Bonuses',
        lines: [
          `+${bonus.allRounderBonusPoints} bonus points for contributing in at least ${bonus.allRounderMinDisciplines} disciplines (batting/bowling/fielding) in the same match.`,
          `+${bonus.tripleThreatBonusPoints} bonus points instead if you contribute in all ${bonus.tripleThreatMinDisciplines} disciplines in the same match.`,
          `+${bonus.captainBonusPoints} bonus point for being a team's captain, every match.`,
          `+${bonus.tossWinCaptainBonusPoints} extra bonus point for the captain of the team that wins the toss.`,
        ],
      },
      {
        section: 'Ranking & ties',
        lines: [
          'The top 5 point-scorers are shown for the match, with #1 named Man of the Match.',
          'If two players end up perfectly tied on points, the player on the winning team ranks higher; if still tied, the more all-round performance (more disciplines contributed to) ranks higher; any remaining tie is settled by runs scored, then wickets taken.',
        ],
      },
    ];
  }
}
