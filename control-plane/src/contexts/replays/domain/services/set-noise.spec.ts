import {
  aSet,
  candidateOf,
  FINGERPRINT,
  LIVE_FINGERPRINT,
  replayedAs,
  replayFor,
} from '@replays/domain/replays.fake-spec';
import {
  isNoisyAt,
  noiseReadingOf,
  setNoiseOf,
  suggestedRepeatsFor,
} from '@replays/domain/services/set-noise';
import { describe, expect, it } from 'vitest';

const SET = aSet(4);

const LIVE = candidateOf('live');

const liveReplay = (id: string, repeats: number, failing: readonly string[]) =>
  replayedAs(
    replayFor(SET, id, LIVE.id.value, null, true, repeats),
    (original, repeat) =>
      failing.includes(`${original}#${repeat}`) ? 'failed' : 'completed',
  );

describe('setNoiseOf', () => {
  it('measures how far the copies of the newest finished live replay run more than once differ', () => {
    const replay = liveReplay('replay_noise', 3, [
      'original_0#1',
      'original_1#2',
      'original_2#2',
    ]);
    const noise = setNoiseOf([replay], [LIVE], LIVE.fingerprint);

    expect(noise).toMatchObject({
      repeats: 3,
      perRepeat: [0.75, 0.5, 1],
      spread: 0.5,
      flippedTasks: ['task_0', 'task_1', 'task_2'],
    });
    expect(noise?.replayId.equals(replay.id)).toBe(true);
    expect(noise?.measuredAt).toEqual(replay.endedAt);
  });

  it('has no noise without a live replay that ran the set more than once', () => {
    expect(
      setNoiseOf([liveReplay('replay_once', 1, [])], [LIVE], LIVE.fingerprint),
    ).toBeNull();
    expect(setNoiseOf([], [LIVE], LIVE.fingerprint)).toBeNull();
  });

  it('measures only on the live config as it is now', () => {
    const replay = liveReplay('replay_noise', 2, ['original_0#1']);

    expect(FINGERPRINT.equals(LIVE_FINGERPRINT)).toBe(false);
    expect(setNoiseOf([replay], [LIVE], LIVE_FINGERPRINT)).toBeNull();
    expect(
      setNoiseOf(
        [replay],
        [candidateOf('proposed', LIVE.id.value)],
        LIVE.fingerprint,
      ),
    ).toBeNull();
  });

  it('takes the newest finished one, passing over a replay still running', () => {
    const older = liveReplay('replay_older', 2, ['original_0#1']);
    const running = replayFor(
      SET,
      'replay_running',
      LIVE.id.value,
      null,
      true,
      3,
    );

    expect(
      setNoiseOf([running, older], [LIVE], LIVE.fingerprint)?.replayId.value,
    ).toBe('replay_older');
  });
});

describe('suggestedRepeatsFor', () => {
  it('asks for enough copies to bring the noise under the min gain, from 1 to 5', () => {
    expect(suggestedRepeatsFor(0, 0.05)).toBe(1);
    expect(suggestedRepeatsFor(0.05, 0.05)).toBe(1);
    expect(suggestedRepeatsFor(0.1, 0.05)).toBe(4);
    expect(suggestedRepeatsFor(0.08, 0.05)).toBe(3);
    expect(suggestedRepeatsFor(0.5, 0.05)).toBe(5);
  });
});

describe('isNoisyAt', () => {
  it('calls noise noisy in one copy when one copy cannot bring it under the min gain', () => {
    expect(isNoisyAt(0.05, 0.05, 1)).toBe(false);
    expect(isNoisyAt(0.06, 0.05, 1)).toBe(true);
    expect(isNoisyAt(0.1, 0.05, 4)).toBe(false);
    expect(isNoisyAt(0.1, 0.05, 3)).toBe(true);
  });
});

describe('noiseReadingOf', () => {
  it('reads noise against the min gain for a single copy of each run', () => {
    const replay = liveReplay('replay_noise', 3, [
      'original_0#1',
      'original_1#2',
      'original_2#2',
    ]);
    const noise = setNoiseOf([replay], [LIVE], LIVE.fingerprint);

    expect(noise && noiseReadingOf(noise, 0.05).noisyInOneCopy).toBe(true);
    expect(noise && noiseReadingOf(noise, 0.5).noisyInOneCopy).toBe(false);
  });
});
