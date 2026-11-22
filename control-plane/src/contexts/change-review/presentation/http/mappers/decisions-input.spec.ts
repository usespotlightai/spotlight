import { decisionsInput } from '@change-review/presentation/http/mappers/decisions-input';
import { describe, expect, it } from 'vitest';

const DECISION = {
  kind: 'trade-off',
  title: 'Retries uploads in the request',
  why: 'A queue would need a worker the service does not run yet.',
  alternatives: ['Retry from a queue'],
  paths: ['api/src/uploads.ts'],
};

const problemsOf = (body: unknown): string[] => {
  const input = decisionsInput(body);

  return 'problems' in input
    ? input.problems.map((each) => each.field.rendered)
    : [];
};

describe('reading the decisions a runner sends', () => {
  it('reads each decision, with no alternatives where it names none', () => {
    const without = {
      kind: DECISION.kind,
      title: DECISION.title,
      why: DECISION.why,
      paths: DECISION.paths,
    };

    expect(decisionsInput({ decisions: [DECISION, without] })).toEqual({
      decisions: [DECISION, { ...DECISION, alternatives: [] }],
    });
  });

  it('names the path of each field of the wrong shape', () => {
    expect(
      problemsOf({
        decisions: [
          DECISION,
          { ...DECISION, title: 7, alternatives: 'none' },
          'nothing',
        ],
      }),
    ).toEqual([
      'decisions[1].title',
      'decisions[1].alternatives',
      'decisions[2]',
    ]);
  });

  it('needs a list of decisions', () => {
    expect(problemsOf({})).toEqual(['decisions']);
    expect(problemsOf(null)).toEqual(['decisions']);
  });

  it('leaves how many decisions a call may record to the decisions', () => {
    expect(decisionsInput({ decisions: [] })).toEqual({ decisions: [] });
  });
});
