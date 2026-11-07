import { problemsOfProposal } from '@change-review/application/services/generation-attempt';
import { InvalidChangeStackError } from '@change-review/domain/exceptions/invalid-change-stack.error';
import { describe, expect, it } from 'vitest';

const FOUND = [{ code: 'shape' as const, message: 'leaves h2 out' }];

describe('problemsOfProposal', () => {
  it('names the problems of what the model proposed', () => {
    expect(
      problemsOfProposal(() => {
        throw InvalidChangeStackError.because('leaves h1 out');
      }, FOUND).map((each) => each.message),
    ).toEqual(['leaves h1 out']);
  });

  it('keeps the problems found where the proposal itself passes', () => {
    expect(problemsOfProposal(() => undefined, FOUND)).toBe(FOUND);
  });

  it('lets any other error through', () => {
    expect(() =>
      problemsOfProposal(() => {
        throw new Error('a bug');
      }, FOUND),
    ).toThrow('a bug');
  });
});
