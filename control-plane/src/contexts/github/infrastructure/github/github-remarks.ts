import type {
  RemarkAnswer,
  RemarksPort,
} from '@github/application/ports/remarks.port';
import {
  REPOSITORY_ACCESS,
  type RepositoryAccessPort,
} from '@github/application/ports/repository-access.port';
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
export class GitHubRemarks implements RemarksPort {
  constructor(
    @Inject(REPOSITORY_ACCESS)
    private readonly access: RepositoryAccessPort,
  ) {}

  async answer(answer: RemarkAnswer): Promise<void> {
    const { password: token } = await this.access.credential(
      answer.workspaceId,
    );
    const thread = await this.threadContaining(answer, token);

    if (!thread) {
      if (answer.resolve) {
        throw new UpstreamError(
          'resolving a remark',
          'it was not said on a line, so it is in no thread',
        );
      }

      return this.comment(answer, token);
    }

    const already = thread.comments.nodes.some(
      (each) => each.body.trim() === answer.body.trim(),
    );

    if (!already) {
      await this.ask(REPLY, { thread: thread.id, body: answer.body }, token);
    }

    if (answer.resolve && !thread.isResolved) {
      await this.ask(RESOLVE, { thread: thread.id }, token);
    }
  }

  private async threadContaining(
    answer: RemarkAnswer,
    token: string,
  ): Promise<Thread | null> {
    const read = await this.ask(
      THREADS,
      {
        owner: answer.repository.owner,
        name: answer.repository.name,
        number: numbered(answer.pullRequest.value),
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
        each.comments.nodes.some((one) => one.id === answer.remark),
      ) ?? null
    );
  }

  private async comment(answer: RemarkAnswer, token: string): Promise<void> {
    const at = numbered(answer.pullRequest.value);
    const response = await fetch(
      `${API}/repos/${answer.repository.owner}/${answer.repository.name}/issues/${at}/comments`,
      {
        method: 'POST',
        headers: this.headers(token),
        body: JSON.stringify({ body: answer.body }),
      },
    );

    if (!response.ok) {
      throw new UpstreamError(
        'answering a remark',
        `GitHub answered ${response.status}`,
      );
    }
  }

  private async ask(
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
        'answering a remark',
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
