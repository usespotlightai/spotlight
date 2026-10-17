import {
  REPOSITORY_ACCESS,
  type RepositoryAccessPort,
} from '@github/application/ports/repository-access.port';
import type {
  ReviewCommentReply,
  ReviewCommentsPort,
} from '@github/application/ports/review-comments.port';
import { Inject, Injectable } from '@nestjs/common';
import { InvalidPullRequestError } from '@shared-kernel/domain/exceptions/invalid-pull-request.error';
import { UpstreamError } from '@shared-kernel/domain/exceptions/upstream.error';

const API = 'https://api.github.com';

const THREADS = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      reviewThreads(first: 100) {
        nodes {
          id
          isResolved
          comments(first: 100) { nodes { id body } }
        }
      }
    }
  }
}`;

const REPLY = `
mutation($thread: ID!, $body: String!) {
  addPullRequestReviewThreadReply(
    input: { pullRequestReviewThreadId: $thread, body: $body }
  ) { clientMutationId }
}`;

const RESOLVE = `
mutation($thread: ID!) {
  resolveReviewThread(input: { threadId: $thread }) { clientMutationId }
}`;

interface Thread {
  readonly id: string;
  readonly isResolved: boolean;
  readonly comments: {
    readonly nodes: { readonly id: string; readonly body: string }[];
  };
}

const numbered = (url: string): number => {
  const last = Number(url.trim().split('/').pop());

  if (!Number.isInteger(last) || last <= 0) {
    throw new InvalidPullRequestError(`at ${url} has no number`);
  }

  return last;
};

@Injectable()
export class GitHubReviewComments implements ReviewCommentsPort {
  constructor(
    @Inject(REPOSITORY_ACCESS)
    private readonly access: RepositoryAccessPort,
  ) {}

  async reply(reply: ReviewCommentReply): Promise<void> {
    const { password: token } = await this.access.credential(reply.workspaceId);
    const thread = await this.threadContaining(reply, token);

    if (!thread) {
      if (reply.resolve) {
        throw new UpstreamError(
          'resolving a review comment',
          'it is not on a line, so it is in no thread',
        );
      }

      return this.comment(reply, token);
    }

    const already = thread.comments.nodes.some(
      (each) => each.body.trim() === reply.body.trim(),
    );

    if (!already) {
      await this.graphql(REPLY, { thread: thread.id, body: reply.body }, token);
    }

    if (reply.resolve && !thread.isResolved) {
      await this.graphql(RESOLVE, { thread: thread.id }, token);
    }
  }

  private async threadContaining(
    reply: ReviewCommentReply,
    token: string,
  ): Promise<Thread | null> {
    const read = await this.graphql(
      THREADS,
      {
        owner: reply.repository.owner,
        name: reply.repository.name,
        number: numbered(reply.pullRequest.value),
      },
      token,
    );

    const threads = (
      read as {
        repository?: { pullRequest?: { reviewThreads?: { nodes?: Thread[] } } };
      }
    ).repository?.pullRequest?.reviewThreads?.nodes;

    return (
      threads?.find((each) =>
        each.comments.nodes.some((one) => one.id === reply.reviewComment),
      ) ?? null
    );
  }

  private async comment(
    reply: ReviewCommentReply,
    token: string,
  ): Promise<void> {
    const at = numbered(reply.pullRequest.value);
    const response = await fetch(
      `${API}/repos/${reply.repository.owner}/${reply.repository.name}/issues/${at}/comments`,
      {
        method: 'POST',
        headers: this.headers(token),
        body: JSON.stringify({ body: reply.body }),
      },
    );

    if (!response.ok) {
      throw new UpstreamError(
        'replying to a review comment',
        `GitHub answered ${response.status}`,
      );
    }
  }

  private async graphql(
    query: string,
    variables: Record<string, unknown>,
    token: string,
  ): Promise<unknown> {
    const response = await fetch(`${API}/graphql`, {
      method: 'POST',
      headers: this.headers(token),
      body: JSON.stringify({ query, variables }),
    });

    const answered = (await response.json()) as {
      data?: unknown;
      errors?: { message?: string }[];
    };

    if (!response.ok || answered.errors?.length) {
      throw new UpstreamError(
        'replying to a review comment',
        answered.errors?.[0]?.message ?? `GitHub answered ${response.status}`,
      );
    }

    return answered.data;
  }

  private headers(token: string): Record<string, string> {
    return {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    };
  }
}
