import {
  type ClassifiedRun,
  dispositionOf,
  resolutionOf,
} from '@insights/domain/services/run-classification';
import { HumanLabel } from '@insights/domain/value-objects/human-label.vo';
import {
  PersonAction,
  DECIDING_ACTIONS,
  type DecidingActionKind,
} from '@insights/domain/value-objects/person-action.vo';
import { RUN_ENDINGS } from '@insights/domain/value-objects/run-ending';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

const AT = new Date('2026-09-30T12:00:00.000Z');

const run = (
  change: Partial<Omit<ClassifiedRun, 'decidingAction'>> & {
    readonly action?: DecidingActionKind;
  } = {},
): ClassifiedRun => ({
  ending: change.ending ?? 'completed',
  decidingAction: change.action
    ? PersonAction.of(change.action, AT, UserId.of('user_actor'))
    : null,
  taskMerged: change.taskMerged ?? false,
  followed: change.followed ?? false,
  asked: change.asked ?? false,
  answered: change.answered ?? false,
  approvalAnswered: change.approvalAnswered ?? false,
  passed: change.passed ?? false,
});

describe('resolutionOf', () => {
  it.each([
    [
      'sent back after it failed',
      run({ ending: 'failed', action: 'sent-back' }),
      'sent-back',
    ],
    ['held as wrong', run({ action: 'held-as-wrong' }), 'sent-back'],
    ['accepted', run({ action: 'accepted' }), 'accepted'],
    [
      'accepted after it stopped',
      run({ ending: 'stopped', action: 'accepted' }),
      'accepted',
    ],
    [
      'accepted after it failed',
      run({ ending: 'failed', action: 'accepted' }),
      'failed',
    ],
    [
      'accepted after it ran out',
      run({ ending: 'exhausted', action: 'accepted' }),
      'other',
    ],
    [
      'accepted after it moved on',
      run({ action: 'accepted', passed: true }),
      'accepted',
    ],
    ['failed', run({ ending: 'failed', taskMerged: true }), 'failed'],
    ['stopped', run({ ending: 'stopped', taskMerged: true }), 'other'],
    ['superseded', run({ ending: 'superseded', passed: true }), 'other'],
    ['handed on', run({ passed: true, taskMerged: true }), 'moved-on'],
    [
      'moved on by a person',
      run({ action: 'started', taskMerged: true }),
      'moved-on',
    ],
    ['merged', run({ taskMerged: true }), 'accepted'],
    [
      'merged after a later run of its station',
      run({ taskMerged: true, followed: true }),
      'other',
    ],
    ['parked', run({ action: 'parked' }), 'other'],
    ['answered', run({ answered: true }), 'other'],
    ['without an answer', run(), 'other'],
  ] as const)('gives a run %s its resolution', (_, each, resolution) => {
    expect(resolutionOf(each)).toBe(resolution);
  });
});

describe('dispositionOf', () => {
  it.each([
    ['merged without a person', run({ taskMerged: true }), 'accepted'],
    [
      'merged after a question',
      run({ taskMerged: true, asked: true }),
      'accepted',
    ],
    [
      'merged after an answer',
      run({ taskMerged: true, answered: true }),
      'accepted',
    ],
    [
      'merged after it moved on',
      run({ taskMerged: true, passed: true }),
      'accepted',
    ],
    [
      'merged after a person started it at another station',
      run({ taskMerged: true, action: 'started' }),
      'accepted',
    ],
    [
      'merged after a later run of its station',
      run({ taskMerged: true, followed: true }),
      'other',
    ],
    [
      'merged after it stopped',
      run({ taskMerged: true, ending: 'stopped' }),
      'other',
    ],
    ['accepted by a person', run({ action: 'accepted' }), 'accepted'],
    [
      'accepted by a person after it stopped',
      run({ ending: 'stopped', action: 'accepted' }),
      'accepted',
    ],
    [
      'accepted by a person after it failed',
      run({ ending: 'failed', action: 'accepted' }),
      'failed',
    ],
    [
      'accepted by a person after it ran out',
      run({ ending: 'exhausted', action: 'accepted' }),
      'other',
    ],
    [
      'failed after a question',
      run({ ending: 'failed', asked: true }),
      'failed',
    ],
    [
      'sent back after failing',
      run({ ending: 'failed', action: 'sent-back' }),
      'sent-back',
    ],
    ['held as wrong', run({ action: 'held-as-wrong' }), 'sent-back'],
    ['moved on after a question', run({ passed: true, asked: true }), 'asked'],
    ['moved on', run({ passed: true }), 'other'],
    ['answered', run({ answered: true }), 'asked'],
    [
      'answered, then started at another station',
      run({ answered: true, action: 'started' }),
      'asked',
    ],
    ['with an approval answered', run({ approvalAnswered: true }), 'asked'],
  ] as const)('reads a run %s', (_, each, disposition) => {
    expect(dispositionOf(each)).toBe(disposition);
  });
});

const FLAGS = [
  'merged',
  'followed',
  'asked',
  'answered',
  'approvalAnswered',
  'passed',
] as const;

const everyRun = (): ClassifiedRun[] =>
  RUN_ENDINGS.flatMap((ending) =>
    [undefined, ...DECIDING_ACTIONS].flatMap((action) =>
      Array.from({ length: 2 ** FLAGS.length }, (_, bits) =>
        run({
          ending,
          ...(action ? { action } : {}),
          ...Object.fromEntries(
            FLAGS.map((flag, at) => [flag, (bits & (1 << at)) !== 0]),
          ),
        }),
      ),
    ),
  );

describe('people’s verdict across every run', () => {
  const runs = everyRun().map((each) => ({
    each,
    passes: HumanLabel.of(each)?.passes ?? null,
  }));

  it('shows a run as accepted only where people passed it', () => {
    for (const { each, passes } of runs) {
      expect(resolutionOf(each) !== 'accepted' || passes === true).toBe(true);
    }
  });

  it('shows a run as sent back exactly where people failed it', () => {
    for (const { each, passes } of runs) {
      expect(resolutionOf(each) === 'sent-back').toBe(passes === false);
    }
  });

  it('replays a run as accepted exactly where people passed it, and as sent back exactly where they failed it', () => {
    for (const { each, passes } of runs) {
      expect(dispositionOf(each) === 'accepted').toBe(passes === true);
      expect(dispositionOf(each) === 'sent-back').toBe(passes === false);
    }
  });

  it('never passes a run that failed', () => {
    for (const { each, passes } of runs) {
      expect(each.ending !== 'failed' || passes !== true).toBe(true);
    }
  });
});
