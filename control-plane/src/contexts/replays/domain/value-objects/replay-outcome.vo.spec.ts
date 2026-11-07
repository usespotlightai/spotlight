import { aReplay } from '@replays/domain/replays.fake-spec';
import {
  ReplayOutcome,
  type ReplayOutcomeState,
} from '@replays/domain/value-objects/replay-outcome.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const stateOf = (outcome: ReplayOutcome): ReplayOutcomeState => ({
  id: outcome.id,
  setId: outcome.setId,
  candidateId: outcome.candidateId,
  searchId: outcome.searchId,
  current: outcome.current,
  startedAt: outcome.startedAt,
  endedAt: outcome.endedAt,
  repeats: outcome.repeats,
  calibration: outcome.calibration,
  servesAsBaseline: outcome.servesAsBaseline,
  healthSampleGroup: outcome.healthSampleGroup,
  sampledAt: outcome.sampledAt,
  rubricVersion: outcome.rubricVersion,
  currency: outcome.currency,
  runSubset: outcome.runSubset,
  referenceReplayId: outcome.referenceReplayId,
  pairwiseReferenceId: outcome.pairwiseReferenceId,
  originals: outcome.originals,
  entries: outcome.entries,
});

describe('ReplayOutcome', () => {
  const state = stateOf(aReplay({ count: 2, repeats: 2 }).outcome());

  it('holds entries within its repeats of its original runs', () => {
    expect(ReplayOutcome.of(state).entries).toHaveLength(4);
  });

  it('refuses an entry past its repeats', () => {
    expect(() => ReplayOutcome.of({ ...state, repeats: 1 })).toThrow(
      InconsistentStateError,
    );
  });

  it('refuses an entry of a run that is not one of its originals', () => {
    expect(() =>
      ReplayOutcome.of({
        ...state,
        originals: [RunId.of('run_elsewhere')],
      }),
    ).toThrow(InconsistentStateError);
  });
});
