import {
  type ClassifiedRun,
  dispositionOf,
  resolutionOf,
} from '@insights/domain/services/run-classification';
import { HumanAction } from '@insights/domain/value-objects/human-action.vo';
import type { HumanActionKind } from '@insights/domain/value-objects/human-action.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

const AT = new Date('2026-09-30T12:00:00.000Z');

const run = (
  change: Partial<Omit<ClassifiedRun, 'firstHumanAction'>> & {
    readonly action?: HumanActionKind;
  } = {},
): ClassifiedRun => ({
  ending: change.ending ?? 'completed',
  asked: change.asked ?? false,
  firstHumanAction: change.action
    ? HumanAction.of(change.action, AT, UserId.of('user_actor'))
    : null,
  approvalAnsweredAt: change.approvalAnsweredAt ?? null,
  passed: change.passed ?? false,
  taskMerged: change.taskMerged ?? false,
  followed: change.followed ?? false,
});

describe('resolutionOf', () => {
  it.each([
    [
      'sent back first',
      run({ ending: 'failed', action: 'sent-back' }),
      'sent-back',
    ],
    [
      'accepted first',
      run({ ending: 'failed', action: 'accepted' }),
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
    ['answered', run({ action: 'answered' }), 'other'],
    ['without an answer', run(), 'other'],
  ] as const)('gives a run %s its resolution', (_, each, resolution) => {
    expect(resolutionOf(each)).toBe(resolution);
  });
});

describe('dispositionOf', () => {
  it.each([
    ['merged without a person', run({ taskMerged: true }), 'other'],
    [
      'merged after a question',
      run({ taskMerged: true, asked: true }),
      'asked',
    ],
    ['accepted by a person', run({ action: 'accepted' }), 'accepted'],
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
    ['moved on after a question', run({ passed: true, asked: true }), 'asked'],
    ['moved on', run({ passed: true }), 'other'],
    ['answered', run({ action: 'answered' }), 'asked'],
  ] as const)(
    'reads a run %s only from what a person did',
    (_, each, disposition) => {
      expect(dispositionOf(each)).toBe(disposition);
    },
  );
});
