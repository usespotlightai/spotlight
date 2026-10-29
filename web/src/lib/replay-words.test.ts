import { describe, expect, it } from 'vitest';
import {
  formatGain,
  formatState,
  healthReadingsOf,
  type SetHealth,
  stateNote,
} from '@/lib/replay-words';

const NEVER_READ: SetHealth = {
  noise: null,
  saturation: null,
  judge: null,
  checks: null,
  oracle: null,
};

describe('replay words', () => {
  it('names a reached ceiling as such, and says what it means', () => {
    expect(formatState('ceiling-reached')).toBe('Ceiling reached');
    expect(stateNote('ceiling-reached')).toBe(
      'The replay reached its ceiling. No more runs start.',
    );
    expect(stateNote('finished')).toBeNull();
  });

  it('shows a gain in points', () => {
    expect(formatGain({ gain: 0.12 })).toBe('+12 pts');
    expect(formatGain({ gain: -0.031 })).toBe('−3 pts');
    expect(formatGain({ gain: 0 })).toBe('0 pts');
  });

  it('says plainly that a set’s health was never read, and how to read it', () => {
    const readings = healthReadingsOf(NEVER_READ, 0.05);

    expect(readings.map((each) => [each.label, each.text, each.tone])).toEqual([
      ['Noise', 'Not measured', 'unknown'],
      ['Room to improve', 'Not measured', 'unknown'],
      ['Judge agreeing with itself', 'Not checked', 'unknown'],
      ['Flaky checks', 'Not checked', 'unknown'],
    ]);
    expect(readings[2]?.advice).toMatch(
      /^The first baseline of the live config judges each change twice/,
    );
  });

  it('takes whether the noise is too wide from the server', () => {
    const [noise] = healthReadingsOf(
      {
        ...NEVER_READ,
        noise: {
          replayId: 'r',
          fingerprint: 'f',
          repeats: 3,
          perRepeat: [0.5, 0.56],
          spread: 0.06,
          flippedTasks: [],
          measuredAt: '2026-10-02T09:00:00.000Z',
          noisyInOneRepeat: false,
        },
      },
      0.05,
    );

    expect(noise?.tone).toBe('good');
    expect(noise?.advice).toMatch(/^Noise is within the line’s minimum/);
  });

  it('reads an unhealthy set line by line, each with what to do', () => {
    const readings = healthReadingsOf(
      {
        noise: {
          replayId: 'r',
          fingerprint: 'f',
          repeats: 3,
          perRepeat: [0.5, 0.6, 0.7],
          spread: 0.2,
          flippedTasks: [],
          measuredAt: '2026-10-02T09:00:00.000Z',
          noisyInOneRepeat: true,
        },
        saturation: {
          replayId: 'r',
          rate: 0.97,
          interval: null,
          saturated: true,
          measuredAt: '2026-10-02T09:00:00.000Z',
        },
        judge: {
          replayId: 'r',
          compared: 10,
          agreed: 7,
          pending: 2,
          agreement: 0.7,
          unstable: true,
        },
        checks: {
          replayId: 'r',
          rechecked: 12,
          pending: 0,
          flaky: [
            {
              taskId: 't',
              originalRunId: 'o',
              runId: 'n',
              first: 'passed',
              recheck: 'failed',
            },
          ],
        },
        oracle: {
          replayId: 'o',
          candidateId: 'c',
          repeats: 1,
          state: 'finished',
          referenceReplayId: 'r',
          referenceState: 'finished',
          answered: 6,
          live: 0.95,
          withAnswer: 0.97,
          gain: {
            gain: 0.02,
            low: -0.05,
            high: 0.08,
            significance: 'within-noise',
            minGain: 0.05,
            tasks: 6,
          },
          roomToImprove: false,
        },
      },
      0.05,
    );

    expect(readings.map((each) => [each.text, each.tone])).toEqual([
      ['Success moved 20 pts between 3 repeats', 'bad'],
      ['Little: +2 pts with the answer', 'bad'],
      ['Same verdict on 70% of 10 changes', 'bad'],
      ['1 of 12 changes flipped', 'bad'],
    ]);
    expect(readings[0]?.advice).toBe(
      'One repeat can’t tell a real gain from chance. Search with more repeats per run, or raise the line’s min_gain. Minimum real gain: +5 pts',
    );
    expect(readings[1]?.advice).toMatch(
      /^Live config: 95% on 6 runs\. With the answer: 97%\. Even the answer barely helps\./,
    );
    expect(readings[2]?.advice).toMatch(
      /2 second judgings are still to come\.$/,
    );
  });

  it('reads the room a set leaves from the live config handed each run’s answer', () => {
    const oracle: NonNullable<SetHealth['oracle']> = {
      replayId: 'o',
      candidateId: 'c',
      repeats: 1,
      state: 'finished',
      referenceReplayId: 'r',
      referenceState: 'finished',
      answered: 5,
      live: 0.6,
      withAnswer: 0.8,
      gain: {
        gain: 0.2,
        low: 0.04,
        high: 0.4,
        significance: 'better',
        minGain: 0.05,
        tasks: 5,
      },
      roomToImprove: true,
    };
    const roomOf = (read: Partial<NonNullable<SetHealth['oracle']>>) =>
      healthReadingsOf(
        { ...NEVER_READ, oracle: { ...oracle, ...read } },
        0.05,
      )[1];

    expect(roomOf({})?.text).toBe('Up to +20 pts with the answer');
    expect(roomOf({})?.tone).toBe('good');
    expect(roomOf({})?.advice).toMatch(
      /^Live config: 60% on 5 runs\. With the answer: 80%\./,
    );
    expect(roomOf({ state: 'running' })?.text).toBe(
      'Measuring with the answer',
    );
    expect(roomOf({ state: 'stopped' })?.text).toBe(
      'Couldn’t measure with the answer',
    );
    expect(roomOf({ referenceState: 'gone' })?.tone).toBe('unknown');
  });
});
