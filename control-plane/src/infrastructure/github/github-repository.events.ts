import type {
  MergedPullRequest,
  RepositoryEventsPort,
} from '@application/ports/repository-events.port';
import { Injectable } from '@nestjs/common';

const PULL_REQUEST = 'pull_request';

/** The little of GitHub's delivery that Spotlight reads. */
interface PullRequestDelivery {
  readonly action?: unknown;
  readonly pull_request?: {
    readonly merged?: unknown;
    readonly html_url?: unknown;
  };
}

@Injectable()
export class GitHubRepositoryEvents implements RepositoryEventsPort {
  merged(
    event: string | undefined,
    payload: unknown,
  ): MergedPullRequest | null {
    if (event !== PULL_REQUEST) {
      return null;
    }

    const delivered = (payload ?? {}) as PullRequestDelivery;
    const pull = delivered.pull_request;

    // Closed and merged are separate facts: a pull request closed without one
    // finishes nothing, and its task stays where it stands.
    if (
      delivered.action !== 'closed' ||
      pull?.merged !== true ||
      typeof pull.html_url !== 'string'
    ) {
      return null;
    }

    return { url: pull.html_url };
  }
}
