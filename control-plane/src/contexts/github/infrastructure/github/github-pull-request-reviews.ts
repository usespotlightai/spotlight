import type {
  FileComment,
  LineComment,
  OnGitHub,
  OnPullRequest,
  PullRequestReviewsPort,
  ReviewEvent,
  SubmittedReview,
} from '@github/application/ports/pull-request-reviews.port';
import type { RepositoryAccessPort } from '@github/application/ports/repository-access.port';
import { withByline } from '@github/infrastructure/github/byline';
import { answered, call } from '@github/infrastructure/github/github.rest';
import {
  type ChangedFile,
  PullRequestLines,
} from '@github/infrastructure/github/pull-request-lines';
import type { LinkedAccountsPort } from '@identity/application/ports/linked-accounts.port';
import { InvalidPullRequestError } from '@shared-kernel/domain/exceptions/invalid-pull-request.error';
import { UpstreamError } from '@shared-kernel/domain/exceptions/upstream.error';

interface Posted {
  readonly id: number;
  readonly html_url: string;
}

interface ListedComment extends Posted {
  readonly path: string;
  readonly line?: number | null;
  readonly side?: 'LEFT' | 'RIGHT' | null;
  readonly body: string;
}

interface Actor {
  readonly token: string;
  readonly viaUserToken: boolean;
}

const GITHUB_EVENTS: Record<ReviewEvent, string> = {
  comment: 'COMMENT',
  approve: 'APPROVE',
  'request-changes': 'REQUEST_CHANGES',
};

const USER_TOKEN_REJECTED_STATUSES = new Set([401, 403, 404]);

const UNPROCESSABLE = 422;

const OWN_PULL_REQUEST = /own pull request/i;

const REVIEW_EVENT_TEXTS: Record<ReviewEvent, string> = {
  comment: '',
  approve: '**Approves.**',
  'request-changes': '**Requests changes.**',
};

const FILES_PER_PAGE = 100;

const MAX_FILE_PAGES = 30;

class UserTokenRejectedError extends UpstreamError {}

const userAnswered = async <T>(
  response: Response,
  operation: string,
): Promise<T> => {
  if (USER_TOKEN_REJECTED_STATUSES.has(response.status)) {
    throw new UserTokenRejectedError(operation, `${response.status}`);
  }

  return answered<T>(response, operation);
};

const located = (on: OnPullRequest): { repo: string; number: number } => {
  const repository = on.pullRequest.repository;
  const number = Number(on.pullRequest.value.split('/').pop());

  if (!repository || !Number.isInteger(number)) {
    throw new InvalidPullRequestError(
      `at ${on.pullRequest.value} is not a GitHub pull request`,
    );
  }

  return { repo: repository.value, number };
};

const gitHubSide = (comment: LineComment): 'LEFT' | 'RIGHT' =>
  comment.side === 'old' ? 'LEFT' : 'RIGHT';

const folded = (body: string, comments: readonly LineComment[]): string =>
  [
    body,
    ...comments.map(
      (comment) =>
        `**\`${comment.path}\` ${comment.startLine === null ? `line ${comment.line}` : `lines ${comment.startLine}–${comment.line}`}${comment.side === 'old' ? ' (before the change)' : ''}**\n\n${comment.body}`,
    ),
  ]
    .filter(Boolean)
    .join('\n\n---\n\n');

export class GitHubPullRequestReviews implements PullRequestReviewsPort {
  constructor(
    private readonly access: RepositoryAccessPort,
    private readonly accounts: LinkedAccountsPort,
  ) {}

  async submit(
    input: OnPullRequest & {
      event: ReviewEvent;
      body: string;
      comments: readonly LineComment[];
    },
  ): Promise<SubmittedReview> {
    const { repo, number } = located(input);

    return this.asActor(input, async (actor) => {
      const pull = await userAnswered<{ head: { sha: string } }>(
        await call(`/repos/${repo}/pulls/${number}`, actor.token),
        'read the pull request',
      );
      const bylined = (body: string) => this.withBylineFor(body, input, actor);
      const lines =
        input.comments.length > 0
          ? PullRequestLines.of(
              await this.changedFiles(repo, number, actor.token),
            )
          : null;
      const placed = input.comments.filter(
        (comment) => lines?.places(comment) ?? false,
      );
      const unplaced = input.comments.filter(
        (comment) => !placed.includes(comment),
      );

      let event = input.event;
      const posting = (inline: boolean) =>
        call(`/repos/${repo}/pulls/${number}/reviews`, actor.token, {
          method: 'POST',
          body: JSON.stringify({
            commit_id: pull.head.sha,
            event: GITHUB_EVENTS[event],
            body: bylined(
              folded(
                event === input.event
                  ? input.body
                  : [REVIEW_EVENT_TEXTS[input.event], input.body]
                      .filter(Boolean)
                      .join('\n\n'),
                inline ? unplaced : input.comments,
              ),
            ),
            comments: inline
              ? placed.map((comment) => ({
                  path: comment.path,
                  line: comment.line,
                  side: gitHubSide(comment),
                  ...(comment.startLine === null
                    ? {}
                    : {
                        start_line: comment.startLine,
                        start_side: gitHubSide(comment),
                      }),
                  body: bylined(comment.body),
                }))
              : [],
          }),
        });

      let response = await posting(true);
      let inline = true;

      // GitHub does not let a user approve or request changes on their own pull request. This is also true for the app.
      if (
        response.status === UNPROCESSABLE &&
        event !== 'comment' &&
        OWN_PULL_REQUEST.test(await response.clone().text())
      ) {
        event = 'comment';
        response = await posting(true);
      }

      if (response.status === UNPROCESSABLE && placed.length > 0) {
        response = await posting(false);
        inline = false;
      }

      const review = await userAnswered<Posted>(response, 'submit the review');

      if (!inline || placed.length === 0) {
        return {
          githubId: review.id,
          comments: input.comments.map(() => null),
        };
      }

      const listed = await userAnswered<ListedComment[]>(
        await call(
          `/repos/${repo}/pulls/${number}/reviews/${review.id}/comments?per_page=100`,
          actor.token,
        ),
        'read the review’s comments',
      );
      const unmatched = [...listed];

      return {
        githubId: review.id,
        comments: input.comments.map((comment): OnGitHub | null => {
          if (!placed.includes(comment)) {
            return null;
          }

          const at = unmatched.findIndex(
            (each) =>
              each.path === comment.path &&
              each.body.includes(comment.body) &&
              (each.line == null || each.line === comment.line),
          );
          const [match] = at >= 0 ? unmatched.splice(at, 1) : [];

          return match ? { id: match.id, url: match.html_url } : null;
        }),
      };
    });
  }

  private async changedFiles(
    repo: string,
    number: number,
    token: string,
  ): Promise<ChangedFile[]> {
    const files: ChangedFile[] = [];

    for (let page = 1; page <= MAX_FILE_PAGES; page += 1) {
      const listed = await userAnswered<ChangedFile[]>(
        await call(
          `/repos/${repo}/pulls/${number}/files?per_page=${FILES_PER_PAGE}&page=${page}`,
          token,
        ),
        'read what the pull request changes',
      );

      files.push(...listed);

      if (listed.length < FILES_PER_PAGE) {
        break;
      }
    }

    return files;
  }

  async reply(
    input: OnPullRequest & { to: number; body: string },
  ): Promise<OnGitHub> {
    const { repo, number } = located(input);

    return this.asActor(input, async (actor) => {
      const posted = await userAnswered<Posted>(
        await call(
          `/repos/${repo}/pulls/${number}/comments/${input.to}/replies`,
          actor.token,
          {
            method: 'POST',
            body: JSON.stringify({
              body: this.withBylineFor(input.body, input, actor),
            }),
          },
        ),
        'reply to the review comment',
      );

      return { id: posted.id, url: posted.html_url };
    });
  }

  async commentOnFile(input: OnPullRequest & FileComment): Promise<OnGitHub> {
    const { repo, number } = located(input);

    return this.asActor(input, async (actor) => {
      const pull = await userAnswered<{ head: { sha: string } }>(
        await call(`/repos/${repo}/pulls/${number}`, actor.token),
        'read the pull request',
      );
      const posted = await userAnswered<Posted>(
        await call(`/repos/${repo}/pulls/${number}/comments`, actor.token, {
          method: 'POST',
          body: JSON.stringify({
            commit_id: pull.head.sha,
            path: input.path,
            subject_type: 'file',
            body: this.withBylineFor(input.body, input, actor),
          }),
        }),
        'comment on the file',
      );

      return { id: posted.id, url: posted.html_url };
    });
  }

  async edit(
    input: OnPullRequest & { commentId: number; body: string },
  ): Promise<void> {
    const { repo } = located(input);

    await this.asActor(input, async (actor) => {
      await userAnswered(
        await call(
          `/repos/${repo}/pulls/comments/${input.commentId}`,
          actor.token,
          {
            method: 'PATCH',
            body: JSON.stringify({
              body: this.withBylineFor(input.body, input, actor),
            }),
          },
        ),
        'edit the review comment',
      );
    });
  }

  async remove(input: OnPullRequest & { commentId: number }): Promise<void> {
    const { repo } = located(input);

    await this.asActor(input, async (actor) => {
      const response = await call(
        `/repos/${repo}/pulls/comments/${input.commentId}`,
        actor.token,
        { method: 'DELETE' },
      );

      if (!response.ok && response.status !== 404) {
        await userAnswered(response, 'delete the review comment');
      }
    });
  }

  private withBylineFor(body: string, on: OnPullRequest, actor: Actor): string {
    return actor.viaUserToken || on.by.kind === 'spotlight'
      ? body
      : withByline(on.by.name, body);
  }

  private async asActor<T>(
    on: OnPullRequest,
    work: (actor: Actor) => Promise<T>,
  ): Promise<T> {
    const userToken =
      on.by.kind === 'person'
        ? await this.accounts.tokenFor(on.by.userId, 'github')
        : null;

    if (userToken) {
      try {
        return await work({ token: userToken, viaUserToken: true });
      } catch (error) {
        if (!(error instanceof UserTokenRejectedError)) {
          throw error;
        }
      }
    }

    const { password } = await this.access.credential(on.workspaceId);

    return work({ token: password, viaUserToken: false });
  }
}
