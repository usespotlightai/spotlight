import {
  ReplayRunDecision,
  replayAskedAPerson,
} from '@replays/domain/aggregates/replay-run-decision.aggregate';
import { MovesOnWords } from '@replays/domain/value-objects/moves-on-words.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const RUN = RunId.of('run_1');
const OWNER = {
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  replayId: ReplayId.of('replay_1'),
};
const FINGERPRINT = StationFingerprint.of('a'.repeat(64));

const ordered = () =>
  ReplayRunDecision.decidedToQueue(RUN, OWNER).ordered({
    fingerprint: FINGERPRINT,
    movesOnAfter: MovesOnWords.of(['Ship', 'done']),
  });

const ending = (handsOver: boolean, next: string | null) => ({
  askedAPerson: false,
  handsOver,
  next,
});

describe('ReplayRunDecision', () => {
  it('records the trial it ordered only while it may still queue the run', () => {
    const settled = ReplayRunDecision.decidedToCancel(RUN, OWNER);

    expect(ordered().trial?.movesOnAfter.words).toEqual(['ship', 'done']);
    expect(
      settled.ordered({ fingerprint: null, movesOnAfter: MovesOnWords.of([]) }),
    ).toBe(settled);
  });

  it('is cancelled from queued, and stays as it is once settled', () => {
    const cancelled = ordered().cancelled();

    expect(cancelled.mayQueue).toBe(false);
    expect(cancelled.trial?.fingerprint).toBe(FINGERPRINT);
    expect(cancelled.cancelled()).toBe(cancelled);
    expect(cancelled.unreplayable('cannot-start')).toBe(cancelled);
  });

  it('says a replay asked a person when it handed over and did not move on', () => {
    const decision = ordered();

    expect(decision.askedAPersonAfter(ending(false, null))).toBe(false);
    expect(decision.askedAPersonAfter(ending(true, 'SHIP'))).toBe(false);
    expect(decision.askedAPersonAfter(ending(true, 'elsewhere'))).toBe(true);
    expect(decision.askedAPersonAfter(ending(true, null))).toBe(true);
  });

  it('leaves a replay that hands its work to a person for review to its judge', () => {
    expect(ordered().askedAPersonAfter(ending(true, 'review'))).toBe(false);
    expect(ordered().askedAPersonAfter(ending(true, 'Review'))).toBe(false);
    expect(replayAskedAPerson(ending(true, 'review'), null)).toBe(false);
    expect(
      replayAskedAPerson(
        { ...ending(true, 'review'), askedAPerson: true },
        ordered(),
      ),
    ).toBe(true);
  });

  it('takes the run’s own ask, else a hand-over when no decision is known', () => {
    expect(
      replayAskedAPerson({ ...ending(false, null), askedAPerson: true }, null),
    ).toBe(true);
    expect(replayAskedAPerson(ending(true, 'ship'), null)).toBe(true);
    expect(replayAskedAPerson(ending(true, 'ship'), ordered())).toBe(false);
  });

  it('is deleted without losing its state', () => {
    const deleted = ordered().delete();

    expect(deleted.isDeleted).toBe(true);
    expect(deleted.owner.teamId.value).toBe('team_1');
  });

  it('is unreplayable exactly when it says why', () => {
    expect(() =>
      ReplayRunDecision.rehydrate({
        runId: RUN,
        owner: OWNER,
        decided: 'unreplayable',
        unreplayableReason: null,
        trial: null,
        version: 1,
      }),
    ).toThrow(InconsistentStateError);
  });
});
