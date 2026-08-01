import { Injectable } from '@angular/core';
import { Team } from '../models/team.interface';
import { BALL_DATA } from '../models/ball_data.class';
import {
  FallOfWicket,
  InningsBreakdown,
  Partnership,
  PartnershipContributor,
} from '../models/partnership.interface';

interface ContributorState {
  entryRuns: number;
  entryBalls: number;
}

@Injectable({
  providedIn: 'root',
})
export class PartnershipService {
  /**
   * Derives the Fall of Wickets list and batting Partnerships breakdown for
   * a team's innings, purely from already-persisted ball-by-ball data
   * (BALL_DATA.currentPatnership/.wicketsLost/.extras/.striker/.nonStriker -
   * see ball_data.class.ts). Nothing here is persisted separately, so this
   * recomputes fresh on every call - which keeps it automatically correct
   * across Undo, the same "derive, don't track imperatively" pattern this
   * codebase already uses for e.g. innings ball timestamps and run rate.
   *
   * IMPORTANT quirk this derivation works around: on the exact ball a
   * wicket falls, LiveMatchService snapshots the *replacement* batsman's
   * pairing onto that same ball (see checkForExtras_And_AddRun - it calls
   * updatePlayerData() a second time after updateOnFieldBatsmen()), so a
   * wicket ball's own striker/nonStriker fields already show the NEW pair,
   * not the outgoing one. So "who got out" is found by diffing the
   * *previous* ball's pair against the current ball's pair, not by looking
   * ahead. The dismissed batsman's final runs/balls are read from
   * `team.Batsmens` (frozen forever once genuinely out - they never bat
   * again), which is safe and exact. The same previous-ball-diff approach
   * also detects a mid-stand retirement swap (LiveMatchService.
   * updateBatsmenData() retroactively overwrites the last-bowled ball when
   * a batsman retires); for that rarer case the retiring batsman's stint is
   * closed out using the ball just before the swap, which can very slightly
   * undercount if they scored on the exact ball immediately before
   * retiring - a documented, rare approximation, not worth the complexity
   * of tracking it more precisely.
   */
  getInningsBreakdown(team: Team): InningsBreakdown {
    const balls: BALL_DATA[] = team.oversPlayedData
      .reduce((acc: BALL_DATA[], over) => acc.concat(over), [])
      .filter(
        (ball) =>
          ball.hasBeenBowled &&
          // Guards against a small number of legacy matches with corrupted/
          // incomplete ball records - e.g. a ball entry that only has
          // class/label/hasBeenBowled and is missing striker/nonStriker/
          // extras entirely (seen in match bw7HeCxt2GDG5JF53cOD). Every
          // read below (runsOf/ballsOf/ball.extras['w']/etc.) assumes
          // those fields exist, so such balls are treated the same as one
          // that was never bowled rather than crashing the whole
          // scorecard.
          !!ball.striker &&
          !!ball.nonStriker &&
          !!ball.extras
      );

    const fallOfWickets: FallOfWicket[] = [];
    const partnerships: Partnership[] = [];

    if (balls.length === 0) {
      return { fallOfWickets, partnerships };
    }

    const runsOf = (ball: BALL_DATA, name: string): number =>
      ball.striker.name === name
        ? ball.striker.runs
        : ball.nonStriker.name === name
        ? ball.nonStriker.runs
        : 0;
    const ballsOf = (ball: BALL_DATA, name: string): number =>
      ball.striker.name === name
        ? ball.striker.balls
        : ball.nonStriker.name === name
        ? ball.nonStriker.balls
        : 0;
    const mergeContributors = (
      list: PartnershipContributor[]
    ): PartnershipContributor[] => {
      const merged = new Map<string, PartnershipContributor>();
      list.forEach((c) => {
        const existing = merged.get(c.name);
        if (existing) {
          existing.runs += c.runs;
          existing.balls += c.balls;
        } else {
          merged.set(c.name, { ...c });
        }
      });
      return Array.from(merged.values());
    };

    const opener1 = balls[0].striker.name;
    const opener2 = balls[0].nonStriker.name;

    let activeContributors = new Map<string, ContributorState>([
      [opener1, { entryRuns: 0, entryBalls: 0 }],
      [opener2, { entryRuns: 0, entryBalls: 0 }],
    ]);
    let finalizedForCurrentStand: PartnershipContributor[] = [];
    let prevPair: string[] = [opener1, opener2];
    let prevWicketsLost = 0;
    let prevExtras: { [key: string]: number } = { w: 0, nb: 0, lb: 0, b: 0 };
    let legalBallCount = 0;

    for (let i = 0; i < balls.length; i++) {
      const ball = balls[i];

      const isLegalBall =
        ball.extras['w'] - prevExtras['w'] <= 0 &&
        ball.extras['nb'] - prevExtras['nb'] <= 0;
      if (isLegalBall) legalBallCount += 1;
      const overs =
        legalBallCount > 0
          ? `${Math.floor((legalBallCount - 1) / 6)}.${
              ((legalBallCount - 1) % 6) + 1
            }`
          : '0.0';

      const currPair = [ball.striker.name, ball.nonStriker.name];
      const wicketFell = ball.wicketsLost > prevWicketsLost;

      if (wicketFell) {
        const outgoingName =
          prevPair.find((n) => !currPair.includes(n)) ?? prevPair[0];
        const survivorName =
          prevPair.find((n) => n !== outgoingName) ?? prevPair[1];
        const incomingName =
          currPair.find((n) => n !== survivorName) ?? currPair[0];

        const dismissedEntry = team.Batsmens.find(
          (b) => b.name === outgoingName
        );

        fallOfWickets.push({
          wicketNumber: ball.wicketsLost,
          batsmanOut: outgoingName,
          teamScore: ball.currentRuns,
          overs,
          dismissal: dismissedEntry?.status ?? '',
        });

        const closingContributors: PartnershipContributor[] = [
          ...finalizedForCurrentStand,
        ];
        activeContributors.forEach((state, name) => {
          const isOutgoing = name === outgoingName;
          const finalRuns =
            isOutgoing && dismissedEntry ? dismissedEntry.runs : runsOf(ball, name);
          const finalBalls =
            isOutgoing && dismissedEntry
              ? dismissedEntry.balls
              : ballsOf(ball, name);
          closingContributors.push({
            name,
            runs: finalRuns - state.entryRuns,
            balls: finalBalls - state.entryBalls,
          });
        });

        partnerships.push({
          wicketNumber: ball.wicketsLost,
          isUnbroken: false,
          contributors: mergeContributors(closingContributors),
          runs: ball.currentPatnership.runs,
          balls: ball.currentPatnership.balls,
          batsmanOut: outgoingName,
          brokenAtTeamScore: ball.currentRuns,
          brokenAtOvers: overs,
          dismissal: dismissedEntry?.status ?? '',
        });

        activeContributors = new Map<string, ContributorState>([
          [
            survivorName,
            {
              entryRuns: runsOf(ball, survivorName),
              entryBalls: ballsOf(ball, survivorName),
            },
          ],
          [
            incomingName,
            {
              entryRuns: runsOf(ball, incomingName),
              entryBalls: ballsOf(ball, incomingName),
            },
          ],
        ]);
        finalizedForCurrentStand = [];
        prevPair = currPair;
      } else {
        const pairChanged = !(
          currPair.includes(prevPair[0]) && currPair.includes(prevPair[1])
        );
        if (pairChanged && i > 0) {
          const outgoingName = prevPair.find((n) => !currPair.includes(n));
          const incomingName = currPair.find((n) => !prevPair.includes(n));
          if (outgoingName && incomingName) {
            const state = activeContributors.get(outgoingName);
            if (state) {
              const lastReliableBall = balls[i - 1];
              finalizedForCurrentStand.push({
                name: outgoingName,
                runs: runsOf(lastReliableBall, outgoingName) - state.entryRuns,
                balls:
                  ballsOf(lastReliableBall, outgoingName) - state.entryBalls,
              });
              activeContributors.delete(outgoingName);
            }
            activeContributors.set(incomingName, {
              entryRuns: runsOf(ball, incomingName),
              entryBalls: ballsOf(ball, incomingName),
            });
          }
        }
        prevPair = currPair;
      }

      prevWicketsLost = ball.wicketsLost;
      prevExtras = { ...ball.extras };
    }

    if (activeContributors.size > 0) {
      const lastBall = balls[balls.length - 1];
      const closingContributors: PartnershipContributor[] = [
        ...finalizedForCurrentStand,
      ];
      activeContributors.forEach((state, name) => {
        closingContributors.push({
          name,
          runs: runsOf(lastBall, name) - state.entryRuns,
          balls: ballsOf(lastBall, name) - state.entryBalls,
        });
      });
      partnerships.push({
        wicketNumber: prevWicketsLost + 1,
        isUnbroken: true,
        contributors: mergeContributors(closingContributors),
        runs: lastBall.currentPatnership.runs,
        balls: lastBall.currentPatnership.balls,
      });
    }

    fallOfWickets.sort((a, b) => a.wicketNumber - b.wicketNumber);
    partnerships.sort((a, b) => a.wicketNumber - b.wicketNumber);

    return { fallOfWickets, partnerships };
  }
}
