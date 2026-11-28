import { ChangeReviewSessionLabels } from '@change-review/infrastructure/acl/assist-session-labels';
import { describe, expect, it } from 'vitest';

const BASED_ON = {
  runId: 'run_1',
  task: 'Add GET /health endpoint',
  station: 'Implementation',
};

const labelOf = (
  purpose: string,
  key: string,
  task: string | null = BASED_ON.task,
) =>
  new ChangeReviewSessionLabels().labelOf({
    purpose,
    key,
    basedOn: { ...BASED_ON, task },
  });

describe('ChangeReviewSessionLabels', () => {
  it('names the drafting of a change stack by its task, and opens the run', () => {
    expect(labelOf('change-review.change-stack', 'stack_1:draft:1')).toEqual({
      title: 'Building the change stack for “Add GET /health endpoint”',
      opens: true,
    });
  });

  it('names a redraft after a check', () => {
    expect(
      labelOf('change-review.change-stack', 'stack_1:redraft:first:1')?.title,
    ).toBe('Rebuilding the change stack for “Add GET /health endpoint”');
  });

  it('names the grading of an answer, and a stack with no task plainly', () => {
    expect(
      labelOf('change-review.grade', 'answer_1:1764240000000:1')?.title,
    ).toBe(
      'Checking an answer about the change stack for “Add GET /health endpoint”',
    );
    expect(
      labelOf('change-review.change-stack', 'stack_1:draft:1', null)?.title,
    ).toBe('Building a change stack');
  });

  it('names no purpose it does not order', () => {
    expect(labelOf('change-review.other', 'key')).toBeNull();
  });
});
