import { InvalidChangeStackError } from '@change-review/domain/exceptions/invalid-change-stack.error';
import { DraftedStack } from '@change-review/domain/services/drafted-stack';
import type { DraftedLayer } from '@change-review/domain/value-objects/stack-cohort.vo';
import { describe, expect, it } from 'vitest';

const layer = (hunks: string[], cited: string[] = []): DraftedLayer => ({
  title: 'Add invite',
  summary: 'The function',
  dependsOn: [],
  hunks: hunks.map((hunk) => ({ hunk })),
  notes: [],
  questions: [{ question: 'Why?', answer: 'Because.', hunks: cited }],
});

const problemsOf = (read: () => unknown): string[] => {
  try {
    read();
  } catch (error) {
    if (error instanceof InvalidChangeStackError) {
      return error.problems.map((each) => each.message);
    }
    throw error;
  }
  return [];
};

describe('DraftedStack', () => {
  it('reads the hunks a model placed', () => {
    expect(DraftedStack.layers([layer(['h1', 'h2'])])[0]?.hunks).toEqual([
      { hunk: 'h1' },
      { hunk: 'h2' },
    ]);
  });

  it('reports every placed hunk that names no hunk, so the model can mend it', () => {
    expect(
      problemsOf(() =>
        DraftedStack.cohorts([
          {
            kind: 'change',
            title: 'Invitations',
            intent: 'Invite people',
            layers: [layer(['h1']), layer(['hx', ''])],
          },
        ]),
      ),
    ).toEqual([
      'cohort 1, layer 2 names hx, which is not in the diff',
      'cohort 1, layer 2 names nothing, which is not in the diff',
    ]);
    expect(
      problemsOf(() =>
        DraftedStack.outline([
          {
            kind: 'change',
            title: 'Invitations',
            intent: 'Invite people',
            joinedBecause: null,
            hunks: ['h1', 'H2'],
          },
        ]),
      ),
    ).toEqual(['cohort 1 names H2, which is not in the diff']);
  });

  it('drops only the citations of a question that name no hunk', () => {
    expect(
      DraftedStack.layers([layer(['h1'], ['h1', 'H7 '])])[0]?.questions[0]
        ?.hunks,
    ).toEqual(['h1']);
  });
});
