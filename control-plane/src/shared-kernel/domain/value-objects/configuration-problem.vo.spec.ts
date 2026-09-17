import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { describe, expect, it } from 'vitest';

const problem = (over: Record<string, string> = {}) =>
  ConfigurationProblem.of({
    path: '.spotlight/integrations/linear.yml',
    at: 'happenings.0.when',
    reason: 'must be an expression',
    ...over,
  });

describe('ConfigurationProblem', () => {
  it('points at where it is the way a person would', () => {
    expect(problem().path).toBe('.spotlight/integrations/linear.yml');
    expect(problem().at).toBe('happenings.0.when');
    expect(problem().reason).toBe('must be an expression');
  });

  it('points at the file where it points at nothing narrower', () => {
    expect(problem({ at: '' }).at).toBe('the file');
  });

  it('refuses one that says nothing to act on', () => {
    expect(() => problem({ reason: '   ' })).toThrow(InvalidIdentifierError);
  });

  it('is an error unless it is said to be a warning', () => {
    expect(problem().severity).toBe('error');
    expect(problem().isWarning).toBe(false);
    expect(
      ConfigurationProblem.of({
        path: 'x.yml',
        at: 'on.task.asked.to.thread',
        reason: 'does not check',
        severity: 'warning',
      }).isWarning,
    ).toBe(true);
  });

  it('says which file it is in', () => {
    expect(problem().isIn('.spotlight/integrations/linear.yml')).toBe(true);
    expect(problem().isIn('.spotlight/lines/default/line.yml')).toBe(false);
  });
});
