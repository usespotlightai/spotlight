import type {
  FileComment,
  LineComment,
  OnGitHub,
  OnPullRequest,
  PullRequestReviewsPort,
  ReviewVerdict,
  SubmittedReview,
} from '@github/application/ports/pull-request-reviews.port';
import type { RepositoryAccessPort } from '@github/application/ports/repository-access.port';
import { answered, call } from '@github/infrastructure/github/github.rest';
import {
  type ChangedFile,
  PullRequestLines,
} from '@github/infrastructure/github/pull-request-lines';
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
  readonly line?: number | null;
  readonly side?: 'LEFT' | 'RIGHT' | null;
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

const UNPROCESSABLE = 422;

const OWN_PULL_REQUEST = /own pull request/i;

const STANCES: Record<ReviewVerdict, string> = {
  comment: '',
  approve: '**Approves.**',
  'request-changes': '**Requests changes.**',
};

const FILES_PER_PAGE = 100;

const MOST_FILE_PAGES = 30;

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
      const lines =
        input.comments.length > 0
          ? PullRequestLines.of(
              await this.changedFiles(repo, number, speaker.token),
            )
          : null;
      const placed = input.comments.filter(
        (comment) => lines?.places(comment) ?? false,
      );
      const unplaced = input.comments.filter(
        (comment) => !placed.includes(comment),
      );

      let verdict = input.verdict;
      const posting = (inline: boolean) =>
        call(`/repos/${repo}/pulls/${number}/reviews`, speaker.token, {
          method: 'POST',
          body: JSON.stringify({
            commit_id: pull.head.sha,
            event: EVENTS[verdict],
            body: signed(
              folded(
                verdict === input.verdict
                  ? input.body
                  : [STANCES[input.verdict], input.body]
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
                  body: signed(comment.body),
                }))
              : [],
          }),
        });

      let response = await posting(true);
      let inline = true;

      // GitHub does not let a user approve or request changes on their own pull request. This is also true for the app.
      if (
        response.status === UNPROCESSABLE &&
        verdict !== 'comment' &&
        OWN_PULL_REQUEST.test(await response.clone().text())
      ) {
        verdict = 'comment';
        response = await posting(true);
      }

      if (response.status === UNPROCESSABLE && placed.length > 0) {
        response = await posting(false);
        inline = false;
      }

      const review = await heard<Posted>(response, 'submit the review');

      if (!inline || placed.length === 0) {
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

    for (let page = 1; page <= MOST_FILE_PAGES; page += 1) {
      const listed = await heard<ChangedFile[]>(
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

  async commentOnFile(input: OnPullRequest & FileComment): Promise<OnGitHub> {
    const { repo, number } = located(input);

    return this.speaking(input, async (speaker) => {
      const pull = await heard<{ head: { sha: string } }>(
        await call(`/repos/${repo}/pulls/${number}`, speaker.token),
        'read the pull request',
      );
      const posted = await heard<Posted>(
        await call(`/repos/${repo}/pulls/${number}/comments`, speaker.token, {
          method: 'POST',
          body: JSON.stringify({
            commit_id: pull.head.sha,
            path: input.path,
            subject_type: 'file',
            body: this.signed(input.body, input, speaker),
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
    return speaker.personally || on.by.kind === 'spotlight'
      ? body
      : signedBy(on.by.name, body);
  }

  private async speaking<T>(
    on: OnPullRequest,
    work: (speaker: Speaker) => Promise<T>,
  ): Promise<T> {
    const personal =
      on.by.kind === 'person'
        ? await this.personal.tokenFor(on.by.userId, 'github')
        : null;

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
