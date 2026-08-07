import { inject, Injectable } from '@angular/core';
import { Team } from '../models/team.interface';
import { Batsmen } from '../models/batsmen.interface';
import { addDoc, collection, Firestore } from '@angular/fire/firestore';
import { MatchService } from './match.service';
import { ModeService } from './mode.service';
import { BALL_DATA } from '../models/ball_data.class';
import { EventHandlerService } from './event-handler.service';
import { LoadMatchService } from './load-match.service';
import { MatchMvpSummary } from '../models/mvp.interface';

@Injectable({
  providedIn: 'root',
})
export class SaveMatchService {
  constructor(
    public matchService: MatchService,
    private modeService: ModeService,
    private eventHandlerService: EventHandlerService,
    private loadMatchService: LoadMatchService
  ) {}

  firestore = inject(Firestore);

  public async saveMatchData(
    matchResult: string,
    mvpSummary: MatchMvpSummary
  ): Promise<void> {
    const date = new Date();
    const dateWithoutTime = date.toLocaleDateString();
    let teamDataDTO = this.prepareTeamDataObject();

    // Only persist the top 5 + Man of the Match on the match document
    // itself - mvpSummary.allPlayers is intentionally left out here (it's
    // only needed in-memory, once, to update every player's lifetime
    // mvpPoints total - see PlayerService.applyMvpPointsToPlayers) so the
    // match document doesn't carry a full-roster breakdown it'll never
    // display.
    const mvpDTO = {
      topFive: mvpSummary.topFive,
      manOfTheMatch: mvpSummary.manOfTheMatch,
    };

    // Read the 4 derived innings/match ball timestamps off MatchService
    // *before* saving. These getters scan oversPlayedData (see
    // MatchService) - by the time saveMatchData() runs (from
    // MatchCompleteDialog, once the match is over) they hold their final,
    // undo-corrected values. We persist them as flat Timestamp fields
    // (same style as MatchDate/FireBaseDate) rather than re-deriving them
    // from per-ball data on every future load, since per-ball timestamps are
    // deliberately not persisted (see prepareOversPlayedObj below).
    const inningsTimestamps = {
      InningsOneFirstBallTime: this.matchService.inningsOneFirstBallTime,
      InningsOneLastBallTime: this.matchService.inningsOneLastBallTime,
      InningsTwoFirstBallTime: this.matchService.inningsTwoFirstBallTime,
      InningsTwoLastBallTime: this.matchService.inningsTwoLastBallTime,
    };

    if (this.modeService.mode === 'prod') {
      await addDoc(collection(this.firestore, 'MatchData'), {
        tossWinner: this.matchService.tossWinner,
        tossResult: this.matchService.tossResult,
        totalOvers: this.matchService.totalOvers,
        totalPlayers: this.matchService.totalPlayers,
        MatchResult: matchResult,
        MatchDate: dateWithoutTime,
        FireBaseDate: date,
        ...inningsTimestamps,
        teamData: teamDataDTO,
        mvp: mvpDTO,
      }).then(async (matchRef) => {
        this.eventHandlerService.NotifyMatchSaveCompleteEvent(matchRef.id);
      });
    } else {
      await addDoc(collection(this.firestore, 'Test_MatchData'), {
        tossWinner: this.matchService.tossWinner,
        tossResult: this.matchService.tossResult,
        totalOvers: this.matchService.totalOvers,
        totalPlayers: this.matchService.totalPlayers,
        MatchResult: matchResult,
        MatchDate: dateWithoutTime,
        FireBaseDate: date,
        ...inningsTimestamps,
        teamData: teamDataDTO,
        mvp: mvpDTO,
      }).then(async (matchRef) => {
        this.eventHandlerService.NotifyMatchSaveCompleteEvent(matchRef.id);
      });
    }
  }

  private prepareTeamDataObject(): any {
    this.filterIncorrectBatsmenData();
    this.filterIncorrectBowlersData();
    let teamObj = JSON.parse(JSON.stringify(this.matchService.teamData));

    this.prepareOversPlayedObj(
      this.matchService.teamData['team1'],
      teamObj,
      'team1'
    );
    this.prepareOversPlayedObj(
      this.matchService.teamData['team2'],
      teamObj,
      'team2'
    );
    return teamObj;
  }

  private prepareOversPlayedObj(team: Team, teamObj: any, key: string) {
    let overDTO: { [key: number]: BALL_DATA }[] = [];
    team.oversPlayedData.forEach((over) => {
      let ballDataObj: { [key: number]: BALL_DATA } = {};
      over.forEach((ball, index) => {
        ballDataObj[index] = JSON.parse(JSON.stringify(ball));
        // BALL_DATA.timestamp is a transient, in-memory-only aid used to
        // derive the 4 flat innings timestamps saved on the match document
        // (see saveMatchData). We don't persist it per-ball - that would
        // bloat every stored ball with data the user didn't ask to keep at
        // that granularity, and it would round-trip through Firestore as a
        // plain string (from the JSON.stringify above) rather than a
        // proper Timestamp.
        delete (ballDataObj[index] as any).timestamp;
      });
      overDTO.push(ballDataObj);
    });
    teamObj[key]['oversPlayedData'] = overDTO;
  }

  /**
   * Removes batsmen entries that never really got to the crease (0 runs AND
   * 0 balls faced) - this guards against accidental "new batsman" mis-taps
   * during live scoring that get corrected moments later without the wrong
   * name ever facing a ball.
   *
   * BUT a legitimate not-out survivor (e.g. a non-striker who never got the
   * strike before the innings ended - all out, overs completed, or target
   * chased) can have that exact same 0/0 signature, and a blind runs/balls
   * filter used to strip them too, leaving strikerIndex/nonStrikerIndex
   * pointing out of bounds (see the missing-batsmen prod data bug this
   * fixes the root cause of).
   *
   * The two cases are disambiguated per team via filterBatsmenForTeam().
   */
  filterIncorrectBatsmenData(): void {
    this.filterBatsmenForTeam('team1');
    this.filterBatsmenForTeam('team2');
  }

  /**
   * A mis-tapped/corrected batsman is already spliced out of Batsmens (and
   * strikerIndex/nonStrikerIndex already repointed to the corrected name) by
   * MatchService.undoBatsmenPlayerReferenceForWicket() the moment a scorer
   * fixes it via Undo - so by save time it's simply gone, not sitting here
   * at 0/0. Anything STILL referenced by strikerIndex/nonStrikerIndex at
   * save time is therefore either a genuine not-out survivor, or (rarely) an
   * uncorrected mistake that was never undone.
   *
   * To tell those two apart, a team can never legitimately have more
   * batsmen than totalPlayers - so a 0/0 index occupant is only protected
   * from removal if keeping it stays within the team's real roster size.
   * If protecting it would exceed totalPlayers, it falls back to the
   * original blanket removal (this is what correctly filters out a bogus
   * entry like a scorer typing "Null"/similar for a wicket that didn't
   * actually need a new batsman).
   */
  private filterBatsmenForTeam(teamKey: 'team1' | 'team2'): void {
    const team = this.matchService.teamData[teamKey];
    const batsmens = team.Batsmens;
    const isUnfaced = (b: Batsmen) => b.runs === 0 && b.balls === 0;

    const strikerBatsmen = batsmens[team.strikerIndex];
    const nonStrikerBatsmen = batsmens[team.nonStrikerIndex];

    const candidateProtections = [strikerBatsmen, nonStrikerBatsmen].filter(
      (b): b is Batsmen => !!b && isUnfaced(b)
    );
    const uniqueProtections = Array.from(new Set(candidateProtections));

    const totalPlayers = this.matchService.totalPlayers;
    const nonZeroCount = batsmens.filter((b) => !isUnfaced(b)).length;
    const canProtect =
      totalPlayers !== null &&
      nonZeroCount + uniqueProtections.length <= totalPlayers;

    const filtered = batsmens.filter(
      (b) => !isUnfaced(b) || (canProtect && uniqueProtections.includes(b))
    );

    if (strikerBatsmen) {
      const newStrikerIndex = filtered.indexOf(strikerBatsmen);
      if (newStrikerIndex !== -1) team.strikerIndex = newStrikerIndex;
    }
    if (nonStrikerBatsmen) {
      const newNonStrikerIndex = filtered.indexOf(nonStrikerBatsmen);
      if (newNonStrikerIndex !== -1) team.nonStrikerIndex = newNonStrikerIndex;
    }

    team.Batsmens = filtered;
  }

  filterIncorrectBowlersData(): void {
    this.matchService.teamData['team1'].Bowlers = this.matchService.teamData[
      'team1'
    ].Bowlers.filter((bowler) => bowler.runs > 0 || bowler.overs > 0);

    this.matchService.teamData['team2'].Bowlers = this.matchService.teamData[
      'team2'
    ].Bowlers.filter((bowler) => bowler.runs > 0 || bowler.overs > 0);
  }
}
