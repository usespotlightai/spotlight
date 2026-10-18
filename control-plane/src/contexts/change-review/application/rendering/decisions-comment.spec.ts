import type { TaskDecisionsDto } from '@change-review/application/dto/decision.dto';
import { DecisionsComment } from '@change-review/application/rendering/decisions-comment';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { describe, expect, it } from 'vitest';

const FOUND: TaskDecisionsDto = {
  runId: 'run_1',
  generating: false,
  status: 'proposed',
  merge: null,
  decisions: [
    {
      id: 'decision_1',
      kind: 'limitation',
      title: 'Retries only once',
      why: 'Backoff is not in the client yet.',
      alternatives: [],
      paths: ['api/src/uploads.ts'],
      journalSteps: [7],
      disputes: [
        {
          id: 'dispute_1',
          path: 'api/src/uploads.ts',
          by: 'user_1',
          byName: 'Maya Chen',
          reason: 'The client retries twice already.',
          at: new Date('2026-09-21T10:00:00Z'),
        },
      ],
    },
    {
      id: 'decision_2',
      kind: 'rejected-approach',
      title: 'Retries in the request, not from a queue',
      why: 'A queue needs a worker the service does not run.',
      alternatives: ['Retry from a queue', 'Retry in the browser'],
      paths: ['api/src/uploads.ts', 'web/src/Upload.tsx'],
      journalSteps: [3],
      disputes: [],
    },
  ],
};

const body = DecisionsComment.of(
  FOUND,
  Repository.of('acme/api'),
  'https://app.example/w/acme/team/t1/tasks/task_1#decisions',
);

describe('the decisions comment on a pull request', () => {
  it('links the decisions in Spotlight', () => {
    expect(body).toContain(
      '(https://app.example/w/acme/team/t1/tasks/task_1#decisions)',
    );
  });

  it('names each decision by its kind, with why it was made', () => {
    expect(body).toContain(
      '**Limitation** · Retries only once\nBackoff is not in the client yet.',
    );
  });

  it('says what the agent weighed and set aside', () => {
    expect(body).toContain(
      'Weighed and set aside: Retry from a queue; Retry in the browser.',
    );
  });

  it('names files as the repository stores them, and others as the workspace does', () => {
    expect(body).toContain('`src/uploads.ts`, `web/src/Upload.tsx`');
  });

  it('quotes who disputed a decision, on which file, and why', () => {
    expect(body).toContain(
      '> Disputed by Maya Chen on `src/uploads.ts`: The client retries twice already.',
    );
  });
});
