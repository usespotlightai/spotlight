import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';
import { ConfigurationProblem } from '@domain/value-objects/configuration-problem.vo';
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

  // One that says something is wrong and leaves the reader no better off is
  // worse than none at all.
  it('refuses one that says nothing to act on', () => {
    expect(() => problem({ reason: '   ' })).toThrow(InvalidIdentifierError);
  });

  it('says which file it is in', () => {
    expect(problem().isIn('.spotlight/integrations/linear.yml')).toBe(true);
    expect(problem().isIn('.spotlight/lines/default.yml')).toBe(false);
  });
});
