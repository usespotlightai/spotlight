import type {
  LineComment,
  OnGitHub,
  OnPullRequest,
  PullRequestReviewsPort,
  ReviewVerdict,
  SubmittedReview,
} from '@github/application/ports/pull-request-reviews.port';
import type { RepositoryAccessPort } from '@github/application/ports/repository-access.port';
import { answered, call } from '@github/infrastructure/github/github.rest';
import { signedBy } from '@github/infrastructure/github/spotlight-signature';
import type { LinkedAccountsPort } from '@identity/application/ports/linked-accounts.port';
import { InvalidPullRequestError } from '@shared-kernel/domain/exceptions/invalid-pull-request.error';
import { UpstreamRefusedError } from '@shared-kernel/domain/exceptions/upstream-refused.error';

interface Posted {
  readonly id: number;
  readonly html_url: string;
}

interface ListedComment extends Posted {
  readonly path: string;
  readonly line: number | null;
  readonly side: 'LEFT' | 'RIGHT' | null;
  readonly body: string;
}

interface Speaker {
  readonly token: string;
  readonly personally: boolean;
}

const EVENTS: Record<ReviewVerdict, string> = {
  comment: 'COMMENT',
  approve: 'APPROVE',
  'request-changes': 'REQUEST_CHANGES',
};

const UNHEARD = new Set([401, 403, 404]);

class UnheardError extends UpstreamRefusedError {}

const heard = async <T>(response: Response, asking: string): Promise<T> => {
  if (UNHEARD.has(response.status)) {
    throw new UnheardError(asking, `${response.status}`);
  }

  return answered<T>(response, asking);
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
    private readonly personal: LinkedAccountsPort,
  ) {}

  async submit(
    input: OnPullRequest & {
      verdict: ReviewVerdict;
      body: string;
      comments: readonly LineComment[];
    },
  ): Promise<SubmittedReview> {
    const { repo, number } = located(input);

    return this.speaking(input, async (speaker) => {
      const pull = await heard<{ head: { sha: string } }>(
        await call(`/repos/${repo}/pulls/${number}`, speaker.token),
        'read the pull request',
      );
      const signed = (body: string) => this.signed(body, input, speaker);

      const posting = (inline: boolean) =>
        call(`/repos/${repo}/pulls/${number}/reviews`, speaker.token, {
          method: 'POST',
          body: JSON.stringify({
            commit_id: pull.head.sha,
            event: EVENTS[input.verdict],
            body: signed(
              inline ? input.body : folded(input.body, input.comments),
            ),
            comments: inline
              ? input.comments.map((comment) => ({
                  path: comment.path,
                  line: comment.line,
                  side: gitHubSide(comment),
                  ...(comment.startLine === null
                    ? {}
                    : {
                        start_line: comment.startLine,
                        start_side: gitHubSide(comment),
                      }),
                  body: signed(comment.body),
                }))
              : [],
          }),
        });

      let response = await posting(true);
      let inline = true;

      if (response.status === 422 && input.comments.length > 0) {
        response = await posting(false);
        inline = false;
      }

      const review = await heard<Posted>(response, 'submit the review');

      if (!inline) {
        return {
          githubId: review.id,
          comments: input.comments.map(() => null),
        };
      }

      const listed = await heard<ListedComment[]>(
        await call(
          `/repos/${repo}/pulls/${number}/reviews/${review.id}/comments?per_page=100`,
          speaker.token,
        ),
        'read the review’s comments',
      );
      const unmatched = [...listed];

      return {
        githubId: review.id,
        comments: input.comments.map((comment): OnGitHub | null => {
          const at = unmatched.findIndex(
            (each) =>
              each.path === comment.path &&
              each.body.includes(comment.body) &&
              (each.line === null || each.line === comment.line),
          );
          const [match] = at >= 0 ? unmatched.splice(at, 1) : [];

          return match ? { id: match.id, url: match.html_url } : null;
        }),
      };
    });
  }

  async reply(
    input: OnPullRequest & { to: number; body: string },
  ): Promise<OnGitHub> {
    const { repo, number } = located(input);

    return this.speaking(input, async (speaker) => {
      const posted = await heard<Posted>(
        await call(
          `/repos/${repo}/pulls/${number}/comments/${input.to}/replies`,
          speaker.token,
          {
            method: 'POST',
            body: JSON.stringify({
              body: this.signed(input.body, input, speaker),
            }),
          },
        ),
        'reply to the review comment',
      );

      return { id: posted.id, url: posted.html_url };
    });
  }

  async edit(
    input: OnPullRequest & { commentId: number; body: string },
  ): Promise<void> {
    const { repo } = located(input);

    await this.speaking(input, async (speaker) => {
      await heard(
        await call(
          `/repos/${repo}/pulls/comments/${input.commentId}`,
          speaker.token,
          {
            method: 'PATCH',
            body: JSON.stringify({
              body: this.signed(input.body, input, speaker),
            }),
          },
        ),
        'edit the review comment',
      );
    });
  }

  async remove(input: OnPullRequest & { commentId: number }): Promise<void> {
    const { repo } = located(input);

    await this.speaking(input, async (speaker) => {
      const response = await call(
        `/repos/${repo}/pulls/comments/${input.commentId}`,
        speaker.token,
        { method: 'DELETE' },
      );

      if (!response.ok && response.status !== 404) {
        await heard(response, 'delete the review comment');
      }
    });
  }

  private signed(body: string, on: OnPullRequest, speaker: Speaker): string {
    return speaker.personally ? body : signedBy(on.by.name, body);
  }

  private async speaking<T>(
    on: OnPullRequest,
    work: (speaker: Speaker) => Promise<T>,
  ): Promise<T> {
    const personal = await this.personal
      .tokenFor(on.by.userId, 'github')
      .catch(() => null);

    if (personal) {
      try {
        return await work({ token: personal, personally: true });
      } catch (error) {
        if (!(error instanceof UnheardError)) {
          throw error;
        }
      }
    }

    const { password } = await this.access.credential(on.workspaceId);

    return work({ token: password, personally: false });
  }
}
