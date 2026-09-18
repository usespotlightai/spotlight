import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import {
  PULL_REQUEST_MARK,
  REVIEW_MARK,
  REVIEW_ROLE,
} from '@work/application/contracts/happenings.contract';
import { LineRole } from '@work/domain/value-objects/line-role.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { describe, expect, it } from 'vitest';

const PULL = PullRequestUrl.of('https://github.com/acme/api/pull/7');

describe('the words Work publishes for happenings', () => {
  it('name the marks a task wears for its pull request, as the task names them', () => {
    expect(Mark.pullRequest(PULL).kind).toBe(PULL_REQUEST_MARK);
    expect(Mark.review(PULL).kind).toBe(REVIEW_MARK);
  });

  it('name the role a review opens onto, as the line names it', () => {
    expect(LineRole.REVIEW.value).toBe(REVIEW_ROLE);
  });
});
