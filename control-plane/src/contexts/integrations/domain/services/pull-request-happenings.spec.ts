import { UnplaceableHappeningError } from '@integrations/domain/exceptions/unplaceable-happening.error';
import {
  type PullRequestActivityFacts,
  PullRequestHappenings,
} from '@integrations/domain/services/pull-request-happenings';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { describe, expect, it } from 'vitest';

const PR = PullRequestUrl.of('https://github.com/acme/api/pull/7');

const facts = (
  over: Partial<PullRequestActivityFacts> = {},
): PullRequestActivityFacts => ({
  activity: 'commented',
  pullRequest: PR,
  branch: 'feat/a',
  labelled: false,
  described: true,
  body: null,
  comment: null,
  ...over,
});

const kinds = (over: Partial<PullRequestActivityFacts>) =>
  PullRequestHappenings.of(facts(over)).map((each) =>
    each.kind === 'activity'
      ? `${each.activity} to ${each.to}`
      : `review request (${each.trigger})`,
  );

describe('PullRequestHappenings', () => {
  it('requests a review of a pull request opened', () => {
    expect(kinds({ activity: 'opened' })).toEqual(['review request (opened)']);
  });

  it('requests a review of a pull request labelled, but not when the label is gone', () => {
    expect(kinds({ activity: 'labelled', labelled: true })).toEqual([
      'review request (labelled)',
    ]);
    expect(kinds({ activity: 'labelled' })).toEqual([]);
  });

  it('tells both the task that opened the pull request and the task that reviews it', () => {
    expect(kinds({ activity: 'merged' })).toEqual([
      'merged to its-task',
      'merged to its-review',
    ]);
  });

  it('requests a review when a comment mentions somebody', () => {
    expect(kinds({ comment: 'please look @spotlight' })).toEqual([
      'commented to its-task',
      'commented to its-review',
      'review request (mentioned)',
    ]);
    expect(kinds({ activity: 'merged', comment: '@spotlight' })).toEqual([
      'merged to its-task',
      'merged to its-review',
    ]);
  });

  it('requests no review of a pull request it knows nothing about', () => {
    expect(kinds({ activity: 'opened', described: false })).toEqual([]);
  });

  it('tells only the task by its branch when there is no pull request', () => {
    expect(kinds({ activity: 'checks-failed', pullRequest: null })).toEqual([
      'checks-failed to its-task',
    ]);
  });

  it('cannot place activity that names neither a branch nor a pull request', () => {
    expect(() =>
      PullRequestHappenings.of(facts({ pullRequest: null, branch: null })),
    ).toThrow(UnplaceableHappeningError);
    expect(() =>
      PullRequestHappenings.of(
        facts({ activity: 'opened', pullRequest: null }),
      ),
    ).toThrow(UnplaceableHappeningError);
  });

  it('describes a review request, and carries the comment only of a mention', () => {
    const [opened] = PullRequestHappenings.of(
      facts({ activity: 'opened', body: 'Adds the cache.' }),
    );
    const mentioned = PullRequestHappenings.of(
      facts({ comment: 'please look @spotlight' }),
    ).find((each) => each.kind === 'review-request');

    expect(opened).toMatchObject({
      kind: 'review-request',
      carriesComment: false,
      description: `Review ${PR.value}\n\nAdds the cache.`,
    });
    expect(mentioned).toMatchObject({
      kind: 'review-request',
      carriesComment: true,
      description: `Review ${PR.value}`,
    });
  });
});
