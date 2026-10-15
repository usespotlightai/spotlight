import { DeclaredHappening } from '@integrations/domain/value-objects/declared-happening.vo';
import { HappeningName } from '@integrations/domain/value-objects/happening-name.vo';
import { MarkKind } from '@integrations/domain/value-objects/mark-kind.vo';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { describe, expect, it } from 'vitest';

const COMPLETED = HappeningName.of('linear.issue.completed');
const ISSUE = MarkKind.of('linear.issue');

const declaring = (over: Record<string, unknown> = {}) =>
  DeclaredHappening.of({
    happening: COMPLETED,
    label: 'Issue completed',
    told: 'The issue was moved to Done.',
    finds: [ISSUE],
    ...over,
  });

describe('DeclaredHappening', () => {
  it('holds what a person picking one of these reads', () => {
    expect(declaring().label).toBe('Issue completed');
    expect(declaring().told).toBe('The issue was moved to Done.');
  });

  it('is the world reporting unless it says otherwise', () => {
    expect(declaring().spoken).toBe(false);
    expect(declaring({ spoken: true }).spoken).toBe(true);
  });

  it('says what it can find a task by', () => {
    expect(declaring().finds).toEqual([ISSUE]);
    expect(declaring({ findsByBranch: true }).findsByBranch).toBe(true);
  });

  it('refuses one nobody could read in a note', () => {
    expect(() => declaring({ told: '  ' })).toThrow(InvalidIdentifierError);
    expect(() => declaring({ label: '' })).toThrow(InvalidIdentifierError);
  });

  it('refuses one that could never find a task', () => {
    expect(() => declaring({ finds: [], findsByBranch: false })).toThrow(
      /no task can be found/,
    );
  });

  it('takes one that finds a task by its branch alone', () => {
    expect(declaring({ finds: [], findsByBranch: true }).findsByBranch).toBe(
      true,
    );
  });
});
