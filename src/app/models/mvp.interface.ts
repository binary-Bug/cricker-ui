// ---------------------------------------------------------------------
// MVP (Most Valuable Player) / Man of the Match feature - data model.
//
// These interfaces describe:
//  1. The scoring "rulebook" (MvpWeightsConfig) - every number the points
//     system uses, loaded from Firestore (collection "MvpConfig") at
//     calculation time so the rules can be tuned without a code change.
//  2. The result of scoring a single match (PlayerMvpBreakdown per player,
//     rolled up into a MatchMvpSummary for the whole match).
// ---------------------------------------------------------------------

/** Weights that control how batting performance turns into MVP points. */
export interface BattingMvpWeights {
  /** Points awarded for every run scored. */
  pointsPerRun: number;
  /** Extra bonus points for every boundary (four) hit, on top of the run points already counted. */
  pointsPerFour: number;
  /** Extra bonus points for every six hit, on top of the run points already counted. */
  pointsPerSix: number;
  /**
   * Used to work out a "milestone" runs target for THIS match's format,
   * since totalOvers varies match to match (not fixed like real 20/50-over
   * cricket). The target is: round(totalOvers * milestoneRunsPerOverFactor).
   * e.g. a factor of 2.5 gives a 50-run milestone for a 20-over match.
   */
  milestoneRunsPerOverFactor: number;
  /**
   * The milestone target can never be BELOW this many runs, regardless of
   * match length. Without this floor, short matches (low totalOvers) would
   * get a trivially low target - e.g. a 5-over match would only need
   * ~13 runs, which isn't a meaningful "milestone" achievement. This
   * keeps the bonus meaning "a genuinely notable innings" even in short
   * formats.
   */
  minimumMilestoneRuns: number;
  /** Bonus points awarded once a batter's runs reach the milestone target above. */
  milestoneBonusPoints: number;
  /** Points subtracted when a batter is out for 0 runs (a "duck"). */
  duckPenaltyPoints: number;
  /** A batter needs to have faced at least this many balls before the duck penalty can apply (protects edge cases like being run out at the non-striker's end without ever facing a ball). */
  minBallsFacedForDuckPenalty: number;
  /**
   * A batter's strike rate is compared against their OWN team's run rate
   * for that innings (converted to an equivalent "runs per 100 balls"
   * figure - see MvpCalculatorService.teamRunRateAsStrikeRate). If the
   * batter's strike rate is at least (team rate * this multiplier), they
   * get the bonus below - i.e. they scored notably faster than their team overall.
   */
  strikeRateBonusMultiplier: number;
  /** Bonus points for batting notably faster than the team's own run rate (see strikeRateBonusMultiplier). */
  strikeRateBonusPoints: number;
  /** If the batter's strike rate is at or below (team rate * this multiplier), the penalty below applies instead - i.e. they scored notably slower than their team overall. */
  strikeRatePenaltyMultiplier: number;
  /** Points subtracted for batting notably slower than the team's own run rate (see strikeRatePenaltyMultiplier). */
  strikeRatePenaltyPoints: number;
  /** A batter needs to have faced at least this many balls before the strike-rate bonus/penalty applies - a handful of balls isn't a reliable enough sample. */
  minBallsFacedForStrikeRateAdjustment: number;
}

/** Weights that control how bowling performance turns into MVP points. */
export interface BowlingMvpWeights {
  /** Points awarded for every wicket taken - the single heaviest weight, since wickets are usually the most match-defining stat. */
  pointsPerWicket: number;
  /**
   * Used to work out a "wicket haul" target for THIS match's format:
   * haulThreshold = ceil(totalOvers / wicketHaulOversPerWicketFactor).
   * e.g. a factor of ~6.67 gives a 3-wicket haul target for a 20-over match.
   */
  wicketHaulOversPerWicketFactor: number;
  /**
   * The haul target can never be BELOW this many wickets, regardless of
   * match length. Without this floor, short matches (low totalOvers)
   * would round down to a target of just 1 wicket, which isn't a
   * meaningful "haul" - the word implies multiple wickets. Keeps the
   * bonus meaningful even in short formats.
   */
  minimumWicketHaulCount: number;
  /** Bonus points awarded once a bowler's wickets reach the haul target above. */
  wicketHaulBonusPoints: number;
  /** Points awarded for every maiden over bowled. */
  pointsPerMaiden: number;
  /**
   * A bowler's economy rate is compared against the OPPOSING (batting)
   * team's own run rate for that innings - i.e. how much more/less
   * economical this bowler was than that team scored overall. If the
   * bowler's economy is at or below (opponent's run rate * this
   * multiplier), the bonus below applies - i.e. they bowled notably tighter
   * than the team scored on average.
   */
  economyBonusMultiplier: number;
  /** Bonus points for bowling notably more economically than the batting team's overall run rate (see economyBonusMultiplier). */
  economyBonusPoints: number;
  /** If the bowler's economy is at least (opponent's run rate * this multiplier), the penalty below applies instead - i.e. they were notably more expensive than the team scored on average. */
  economyPenaltyMultiplier: number;
  /** Points subtracted for bowling notably more expensively than the batting team's overall run rate (see economyPenaltyMultiplier). */
  economyPenaltyPoints: number;
  /** A bowler needs to have bowled at least this many overs before the economy bonus/penalty applies - one or two overs isn't a reliable enough sample. */
  minOversBowledForEconomyAdjustment: number;
}

/** Weights that control how fielding performance turns into MVP points. These are flat/per-count - fielding actions don't need match-format scaling. */
export interface FieldingMvpWeights {
  pointsPerCatch: number;
  pointsPerRunOut: number;
  pointsPerStumping: number;
}

/**
 * Weights for the "all-rounder" bonus - extra points for contributing
 * meaningfully across more than one discipline (batting/bowling/fielding)
 * in the same match, since that's a broader match impact than excelling in
 * just one area.
 */
export interface BonusMvpWeights {
  /** Minimum number of disciplines (out of batting/bowling/fielding) a player must have scored points in to earn the all-rounder bonus. */
  allRounderMinDisciplines: number;
  /** Bonus points for qualifying as an all-rounder (see allRounderMinDisciplines). */
  allRounderBonusPoints: number;
  /** Minimum number of disciplines a player must have scored points in to earn the bigger "triple-threat" bonus instead (normally 3, i.e. contributed in every discipline). */
  tripleThreatMinDisciplines: number;
  /** Bonus points for qualifying as a triple-threat (see tripleThreatMinDisciplines). This REPLACES the all-rounder bonus, it doesn't stack with it. */
  tripleThreatBonusPoints: number;
  /** Flat bonus points awarded to each team's captain, every match, regardless of performance or result. Stacks with tossWinCaptainBonusPoints below. */
  captainBonusPoints: number;
  /** Extra bonus points awarded ONLY to the captain of the team that won the toss (on top of captainBonusPoints) - the other players on that team don't get this. */
  tossWinCaptainBonusPoints: number;
}

/**
 * The full MVP scoring rulebook, grouped the same way it's stored in
 * Firestore: one document per section inside the "MvpConfig" collection
 * (documents named "batting", "bowling", "fielding", "bonuses"). Loading
 * happens as a single getDocs() call over the whole collection - see
 * MvpCalculatorService.loadWeights().
 */
export interface MvpWeightsConfig {
  batting: BattingMvpWeights;
  bowling: BowlingMvpWeights;
  fielding: FieldingMvpWeights;
  bonuses: BonusMvpWeights;
}

/**
 * A single "line" in a player's points breakdown for one discipline -
 * e.g. "Runs Scored: 42 runs x 1 pt = 42 pts". Used to power the
 * click-through MVP breakdown dialog on the match-details Match Info tab,
 * so users can see exactly how a player's total was arrived at instead of
 * just a single opaque number.
 */
export interface MvpLineItem {
  /** Short name of what this line represents, e.g. "Runs Scored", "Milestone Bonus", "Duck Penalty". */
  label: string;
  /** Points this line contributes to the discipline's subtotal - negative for penalties. */
  points: number;
  /** Plain-English explanation of how `points` was worked out, e.g. "42 runs x 1 pt = 42 pts". */
  detail: string;
  /**
   * Optional plain-English explanation of how a MATCH-SPECIFIC threshold
   * used by this line item was derived, e.g. how the "50-run milestone" or
   * "3-wicket haul" target for THIS match's over count was calculated from
   * totalOvers + the relevant weight. Only set for line items whose
   * trigger condition is a computed threshold (Milestone Bonus, Wicket
   * Haul Bonus) rather than a fixed number - other line items leave this
   * undefined. Shown in the breakdown dialog behind a collapsible toggle
   * rather than inline, since it's "how was the target calculated" detail
   * on top of the already-shown "detail" text, not something everyone
   * needs to see by default. Computed once at match-save time (same as
   * the rest of the breakdown) so it always matches the weights that were
   * actually in effect for that match, even if MvpConfig gets retuned later.
   */
  thresholdExplanation?: string;
}

/** A single player's full MVP points breakdown for one match. */
export interface PlayerMvpBreakdown {
  name: string;
  battingPoints: number;
  bowlingPoints: number;
  fieldingPoints: number;
  /** All-rounder/triple-threat bonus points, if any (see BonusMvpWeights). */
  bonusPoints: number;
  /** battingPoints + bowlingPoints + fieldingPoints + bonusPoints. */
  totalPoints: number;
  /** How many of {battingPoints, bowlingPoints, fieldingPoints} are > 0 - used for the all-rounder bonus and as a ranking tie-breaker. */
  disciplineCount: number;
  /** True if this player's team won the match - used only as a ranking tie-breaker, never added to totalPoints (MVP points are meant to be purely stat-based). */
  isOnWinningTeam: boolean;
  /** Which team (team1/team2) this player played for in this match - used to check if they're that team's captain (captaincy/toss bonuses) and for the winning-toss captain bonus. */
  teamKey: 'team1' | 'team2';
  /** Raw runs scored this match (not points) - used only as a final ranking tie-breaker. */
  runsScored: number;
  /** Raw wickets taken this match (not points) - used only as a final ranking tie-breaker. */
  wicketsTaken: number;
  /**
   * Line-by-line explanation of how battingPoints/bowlingPoints/
   * fieldingPoints/bonusPoints were each calculated. Stored (persisted
   * alongside topFive on the match document - see SaveMatchService) rather
   * than recalculated on demand, so the breakdown a user sees always
   * matches the points that were actually awarded at match-save time, even
   * if the MvpConfig weights get retuned later.
   */
  battingBreakdown: MvpLineItem[];
  bowlingBreakdown: MvpLineItem[];
  fieldingBreakdown: MvpLineItem[];
  bonusBreakdown: MvpLineItem[];
}

/**
 * The result of scoring one whole match.
 *
 * `allPlayers` holds EVERY player who took part (used to add each player's
 * own points onto their lifetime Player.mvpPoints total - a player's
 * lifetime tally isn't limited to matches where they made a given match's
 * top 5). It is intentionally NOT written to the saved match document -
 * SaveMatchService only persists `topFive` + `manOfTheMatch`, to keep the
 * match document itself lightweight. `allPlayers` only ever exists
 * in-memory, for the single save operation right after a match ends.
 */
export interface MatchMvpSummary {
  topFive: PlayerMvpBreakdown[];
  manOfTheMatch: string;
  allPlayers: PlayerMvpBreakdown[];
}
