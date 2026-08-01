/**
 * A single Fall of Wicket entry - one per dismissal, in the order wickets
 * fell. Fully derived from ball-by-ball data (see PartnershipService), never
 * persisted directly, so it's automatically correct for both in-progress
 * live matches and historical matches loaded from Firestore.
 */
export interface FallOfWicket {
  /** 1-based wicket number (1st wicket, 2nd wicket, ...). */
  wicketNumber: number;
  /** Name of the batsman who got out. */
  batsmanOut: string;
  /** Team's total runs at the moment this wicket fell. */
  teamScore: number;
  /** Over.ball notation, e.g. "5.3", when this wicket fell. */
  overs: string;
  /** Dismissal detail, e.g. "b Bowler", "c Fielder b Bowler", "lbw Bowler". */
  dismissal: string;
}

/** One batsman's individual contribution during a specific partnership/stand. */
export interface PartnershipContributor {
  name: string;
  /** Runs scored by this batsman while part of this specific stand. */
  runs: number;
  /** Balls faced by this batsman while part of this specific stand. */
  balls: number;
}

/**
 * A batting partnership/stand for one wicket slot. `contributors` is
 * normally exactly 2 batsmen, but can be 3+ if a not-out retirement swap
 * happened mid-stand (the stand itself doesn't break on a retirement, but
 * a new batsman joins it) - each contributor's individual stint is tracked
 * separately rather than merging them into just 2 names.
 */
export interface Partnership {
  /** 1-based wicket number this stand is for (ends with this wicket falling, or is the current/still-batting stand if isUnbroken). */
  wicketNumber: number;
  /** True when the innings ended (overs/target/all-out aside) before this stand was separated by a wicket. */
  isUnbroken: boolean;
  contributors: PartnershipContributor[];
  /** Total partnership runs (includes extras credited to the stand, matching real scorecards). */
  runs: number;
  /** Total balls bowled during this stand. */
  balls: number;
  /** Name of the batsman whose dismissal ended this stand - undefined when isUnbroken. */
  batsmanOut?: string;
  /** Team's total runs at the moment this stand ended - undefined when isUnbroken. */
  brokenAtTeamScore?: number;
  /** Over.ball notation, e.g. "5.3", when this stand ended - undefined when isUnbroken. */
  brokenAtOvers?: string;
  /** Dismissal detail, e.g. "b Bowler", "c Fielder b Bowler" - undefined when isUnbroken. */
  dismissal?: string;
}

/** Combined Fall of Wickets + Partnerships breakdown for one team's innings. */
export interface InningsBreakdown {
  fallOfWickets: FallOfWicket[];
  partnerships: Partnership[];
}
