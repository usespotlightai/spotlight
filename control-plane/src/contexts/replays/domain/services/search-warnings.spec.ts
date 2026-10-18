import { FINGERPRINT, NOW } from '@replays/domain/replays.fake-spec';
import { searchWarningsOf } from '@replays/domain/services/search-warnings';
import type { SetHealth } from '@replays/domain/services/set-health';
import type { SetNoiseReading } from '@replays/domain/services/set-noise';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const CALIBRATION = ReplayId.of('replay_calibration');

const noiseOf = (spread: number): SetNoiseReading => ({
  replayId: ReplayId.of('replay_noise'),
  fingerprint: FINGERPRINT,
  repeats: 3,
  perRepeat: [0.5, 0.5 + spread],
  spread,
  flippedTasks: [],
  measuredAt: NOW,
  noisyInOneRepeat: spread > 0.05,
});

const healthOf = (part: Partial<SetHealth> = {}): SetHealth => ({
  noise: noiseOf(0),
  saturation: null,
  judge: null,
  checks: null,
  oracle: null,
  ...part,
});

describe('searchWarningsOf', () => {
  it('warns that nobody measured the noise yet', () => {
    expect(searchWarningsOf(healthOf({ noise: null }), 0.05, 1)).toEqual([
      { kind: 'noise-unmeasured' },
    ]);
  });

  it('warns that a noisy set needs more repeats than requested, and says how many', () => {
    expect(
      searchWarningsOf(healthOf({ noise: noiseOf(0.1) }), 0.05, 1),
    ).toEqual([
      {
        kind: 'noisy',
        spread: 0.1,
        minGain: 0.05,
        neededRepeats: 4,
        suggestedRepeats: 4,
      },
    ]);
    expect(
      searchWarningsOf(healthOf({ noise: noiseOf(0.1) }), 0.05, 4),
    ).toEqual([]);
    expect(
      searchWarningsOf(healthOf({ noise: noiseOf(0.02) }), 0.05, 1),
    ).toEqual([]);
  });

  it('still warns at five repeats when the set needs more than five, saying how many it needs', () => {
    expect(
      searchWarningsOf(healthOf({ noise: noiseOf(0.5) }), 0.05, 5),
    ).toEqual([
      {
        kind: 'noisy',
        spread: 0.5,
        minGain: 0.05,
        neededRepeats: 100,
        suggestedRepeats: 5,
      },
    ]);
  });

  it('warns of a saturated set, an unstable judge, flaky checks and a set the answer leaves no room in', () => {
    expect(
      searchWarningsOf(
        healthOf({
          saturation: {
            replayId: CALIBRATION,
            rate: 0.97,
            interval: null,
            saturated: true,
            measuredAt: NOW,
          },
          judge: {
            replayId: CALIBRATION,
            compared: 10,
            agreed: 7,
            pending: 0,
            agreement: 0.7,
            unstable: true,
          },
          checks: {
            replayId: CALIBRATION,
            rechecked: 10,
            pending: 0,
            flaky: [
              {
                taskId: TaskId.of('task_0'),
                original: RunId.of('original_0'),
                run: RunId.of('run_0'),
                first: 'passed',
                recheck: 'failed',
              },
            ],
          },
          oracle: {
            replayId: ReplayId.of('replay_oracle'),
            candidateId: CandidateId.of('candidate_oracle'),
            repeats: 1,
            state: 'finished',
            referenceReplayId: CALIBRATION,
            referenceState: 'finished',
            answered: 8,
            live: 0.9,
            withAnswer: 0.8,
            gain: {
              gain: -0.1,
              low: -0.3,
              high: 0.1,
              significance: 'within-noise',
              minGain: 0.05,
              tasks: 10,
            },
            roomToImprove: false,
          },
        }),
        0.05,
        1,
      ),
    ).toEqual([
      { kind: 'saturated', rate: 0.97 },
      { kind: 'judge-unstable', agreement: 0.7, compared: 10 },
      { kind: 'flaky-checks', flaky: 1, rechecked: 10 },
      {
        kind: 'no-headroom',
        gain: -0.1,
        low: -0.3,
        high: 0.1,
        answered: 8,
      },
    ]);
  });

  it('says nothing of a healthy set, or of checks still to come', () => {
    expect(
      searchWarningsOf(
        healthOf({
          saturation: {
            replayId: CALIBRATION,
            rate: 0.95,
            interval: null,
            saturated: false,
            measuredAt: NOW,
          },
          judge: {
            replayId: CALIBRATION,
            compared: 0,
            agreed: 0,
            pending: 4,
            agreement: null,
            unstable: false,
          },
          checks: {
            replayId: CALIBRATION,
            rechecked: 4,
            pending: 0,
            flaky: [],
          },
        }),
        0.05,
        1,
      ),
    ).toEqual([]);
  });
});
