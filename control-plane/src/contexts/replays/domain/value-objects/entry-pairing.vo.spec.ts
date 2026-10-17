import { InvalidReplayError } from '@replays/domain/exceptions/invalid-replay.error';
import { pairVerdictOf } from '@replays/domain/replays.fake-spec';
import {
  EntryPairing,
  PairVerdict,
} from '@replays/domain/value-objects/entry-pairing.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const AGAINST = RunId.of('baseline_run_0');

const verdict = pairVerdictOf;

describe('PairVerdict', () => {
  it('reads the winner from the candidate’s side: its run wins, the baseline’s run is its loss, or a tie', () => {
    expect(verdict('run').outcome).toBe('win');
    expect(verdict('against').outcome).toBe('loss');
    expect(verdict('tie').outcome).toBe('tie');
    expect(verdict('run').readings[0]).toEqual({
      ownShownFirst: true,
      outcome: 'win',
      reasons: [
        { text: 'It drains fast.', ownHunks: ['a#1'], theirHunks: ['b#1'] },
      ],
    });
    expect(() =>
      PairVerdict.fromWinner({ winner: 'nobody', model: 'm', readings: [] }),
    ).toThrow(InvalidReplayError);
  });

  it('records both readings, one each way round, and is a tie where they disagree', () => {
    const reading = (runShownFirst: boolean, outcome: string) => ({
      ownShownFirst: runShownFirst,
      outcome,
      reasons: [],
    });

    expect(() =>
      PairVerdict.of({
        outcome: 'win',
        model: 'm',
        readings: [reading(true, 'win'), reading(false, 'loss')],
      }),
    ).toThrow(InvalidReplayError);
    expect(() =>
      PairVerdict.of({
        outcome: 'win',
        model: 'm',
        readings: [reading(true, 'win'), reading(true, 'win')],
      }),
    ).toThrow(InvalidReplayError);
    expect(() =>
      PairVerdict.of({
        outcome: 'win',
        model: 'm',
        readings: [reading(true, 'win')],
      }),
    ).toThrow(InvalidReplayError);
    expect(
      PairVerdict.of({
        outcome: 'tie',
        model: 'm',
        readings: [reading(true, 'win'), reading(false, 'loss')],
      }).outcome,
    ).toBe('tie');
  });
});

describe('EntryPairing', () => {
  it('is requested once against one run, then judged or failed, and stays so', () => {
    const requested = EntryPairing.requested(AGAINST);
    const judged = requested.judged(verdict('run'));

    expect(requested.pending).toBe(true);
    expect(judged.verdict?.outcome).toBe('win');
    expect(judged.failed('errored')).toBe(judged);
    expect(requested.failed('no-evidence').unpaired).toBe('no-evidence');
    expect(() => requested.failed('something new')).toThrow(InvalidReplayError);
    expect(requested.isAgainst(AGAINST)).toBe(true);
  });

  it('is never both judged and failed', () => {
    expect(() =>
      EntryPairing.rehydrate({
        against: AGAINST,
        verdict: verdict('tie'),
        unpaired: 'errored',
      }),
    ).toThrow(InvalidReplayError);
  });
});
