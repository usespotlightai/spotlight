import type {
  PullRequestReaction,
  PullRequestReactionsPort,
  ReactedTo,
} from '@github/application/ports/pull-request-reactions.port';
import type { RepositoryAccessPort } from '@github/application/ports/repository-access.port';
import { InvalidPullRequestError } from '@shared-kernel/domain/exceptions/invalid-pull-request.error';
import { UpstreamRefusedError } from '@shared-kernel/domain/exceptions/upstream-refused.error';

const API = 'https://api.github.com';

const GONE = 404;

type Fetch = typeof globalThis.fetch;

export class GitHubPullRequestReactions implements PullRequestReactionsPort {
  constructor(
    private readonly access: RepositoryAccessPort,
    private readonly fetch: Fetch = globalThis.fetch,
  ) {}

  async react(on: ReactedTo, reaction: PullRequestReaction): Promise<void> {
    await this.reacted(on, reaction);
  }

  // When Spotlight gives a reaction again, GitHub returns the existing reaction. Spotlight finds its own reaction this way.
  async withdraw(on: ReactedTo, reaction: PullRequestReaction): Promise<void> {
    const { reactions, token, id } = await this.reacted(on, reaction);
    const response = await this.fetch(`${reactions}/${id}`, {
      method: 'DELETE',
      headers: this.headers(token),
    });

    if (!response.ok && response.status !== GONE) {
      throw new UpstreamRefusedError(
        'taking a reaction back from a pull request',
        `GitHub answered ${response.status}`,
      );
    }
  }

  private async reacted(
    on: ReactedTo,
    reaction: PullRequestReaction,
  ): Promise<{ reactions: string; token: string; id: number }> {
    const repository = on.pullRequest.repository;
    const number = on.pullRequest.number;

    if (!repository || number === null) {
      throw new InvalidPullRequestError(
        `at ${on.pullRequest.value} is not a GitHub pull request`,
      );
    }

    const { password: token } = await this.access.credential(on.workspaceId);
    const reactions = `${API}/repos/${repository.value}/issues/${number}/reactions`;
    const response = await this.fetch(reactions, {
      method: 'POST',
      headers: this.headers(token),
      body: JSON.stringify({ content: reaction }),
    });

    if (!response.ok) {
      throw new UpstreamRefusedError(
        'reacting to a pull request',
        `GitHub answered ${response.status}`,
      );
    }

    const { id } = (await response.json()) as { readonly id: number };

    return { reactions, token, id };
  }

  private headers(token: string): Record<string, string> {
    return {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    };
  }
}
