import type {
  PullRequestCommentsPort,
  StickyComment,
  StickyCommentPlace,
} from '@github/application/ports/pull-request-comments.port';
import type { RepositoryAccessPort } from '@github/application/ports/repository-access.port';
import { InvalidPullRequestError } from '@shared-kernel/domain/exceptions/invalid-pull-request.error';
import { UpstreamRefusedError } from '@shared-kernel/domain/exceptions/upstream-refused.error';

const API = 'https://api.github.com';

const MAX_PAGES = 10;

type Fetch = typeof globalThis.fetch;

const numbered = (url: string): number => {
  const last = Number(url.trim().split('/').pop());

  if (!Number.isInteger(last) || last <= 0) {
    throw new InvalidPullRequestError(`at ${url} has no number`);
  }

  return last;
};

export class GitHubPullRequestComments implements PullRequestCommentsPort {
  constructor(
    private readonly access: RepositoryAccessPort,
    private readonly fetch: Fetch = globalThis.fetch,
  ) {}

  async keep(comment: StickyComment): Promise<void> {
    const { password: token } = await this.access.credential(
      comment.workspaceId,
    );
    const repo = `${comment.repository.owner}/${comment.repository.name}`;
    const number = numbered(comment.pullRequest.value);
    const existing = await this.stickyCommentId(
      repo,
      number,
      comment.marker,
      token,
    );
    const body = `${comment.marker}\n${comment.body}`;

    const response = existing
      ? await this.fetch(`${API}/repos/${repo}/issues/comments/${existing}`, {
          method: 'PATCH',
          headers: this.headers(token),
          body: JSON.stringify({ body }),
        })
      : await this.fetch(`${API}/repos/${repo}/issues/${number}/comments`, {
          method: 'POST',
          headers: this.headers(token),
          body: JSON.stringify({ body }),
        });

    if (!response.ok) {
      throw new UpstreamRefusedError(
        'commenting on a pull request',
        `GitHub answered ${response.status}`,
      );
    }
  }

  async withdraw(place: StickyCommentPlace): Promise<void> {
    const { password: token } = await this.access.credential(place.workspaceId);
    const repo = `${place.repository.owner}/${place.repository.name}`;
    const existing = await this.stickyCommentId(
      repo,
      numbered(place.pullRequest.value),
      place.marker,
      token,
    );

    if (!existing) {
      return;
    }

    const response = await this.fetch(
      `${API}/repos/${repo}/issues/comments/${existing}`,
      { method: 'DELETE', headers: this.headers(token) },
    );

    if (!response.ok && response.status !== 404) {
      throw new UpstreamRefusedError(
        'withdrawing a comment from a pull request',
        `GitHub answered ${response.status}`,
      );
    }
  }

  private async stickyCommentId(
    repo: string,
    number: number,
    marker: string,
    token: string,
  ): Promise<number | null> {
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const response = await this.fetch(
        `${API}/repos/${repo}/issues/${number}/comments?per_page=100&page=${page}`,
        { headers: this.headers(token) },
      );

      if (!response.ok) {
        throw new UpstreamRefusedError(
          'reading a pull request’s comments',
          `GitHub answered ${response.status}`,
        );
      }

      const comments = (await response.json()) as {
        readonly id: number;
        readonly body?: string;
      }[];
      const found = comments.find((each) => each.body?.startsWith(marker));

      if (found) {
        return found.id;
      }
      if (comments.length < 100) {
        return null;
      }
    }

    return null;
  }

  private headers(token: string): Record<string, string> {
    return {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    };
  }
}
