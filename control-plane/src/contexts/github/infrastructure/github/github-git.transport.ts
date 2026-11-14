import { Readable } from 'node:stream';

import { GitHubUnansweredError } from '@github/application/errors/github-unanswered.error';
import {
  REPOSITORY_ACCESS,
  type RepositoryAccessPort,
} from '@github/application/ports/repository-access.port';
import type {
  GitAnswer,
  GitCall,
  RepositoryGitPort,
} from '@github/application/ports/repository-git.port';
import { Inject, Injectable } from '@nestjs/common';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const TIMEOUT_MS = 600_000;

// Never forward the caller's own authorization upstream.
const FORWARDED = [
  'content-type',
  'content-encoding',
  'accept',
  'accept-encoding',
  'git-protocol',
  'user-agent',
];

const ANSWERED = ['content-type', 'content-encoding', 'cache-control'];

const carried = (
  headers: GitCall['headers'],
  wanted: readonly string[],
): Record<string, string> => {
  const taken: Record<string, string> = {};

  for (const name of wanted) {
    const value = headers[name];
    if (typeof value === 'string') {
      taken[name] = value;
    }
  }

  return taken;
};

const reasonOf = (error: unknown): string => {
  const cause = (error as { cause?: unknown } | null)?.cause ?? error;

  return cause instanceof Error ? cause.message : String(cause);
};

@Injectable()
export class GitHubGitTransport implements RepositoryGitPort {
  constructor(
    @Inject(REPOSITORY_ACCESS)
    private readonly access: RepositoryAccessPort,
    @Inject(LOGGER)
    private readonly logger: LoggerPort,
  ) {}

  async call(
    workspaceId: WorkspaceId,
    repository: Repository,
    call: GitCall,
  ): Promise<GitAnswer> {
    const credential = await this.access.credential(workspaceId);
    const upstream = `${repository.url}.git${call.path}${call.search}`;

    const response = await fetch(upstream, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      method: call.method,
      headers: {
        ...carried(call.headers, FORWARDED),
        authorization: `Basic ${Buffer.from(
          `${credential.username}:${credential.password}`,
        ).toString('base64')}`,
      },
      // Stream the body because packfiles can be very large. Node must have duplex: 'half' to stream.
      ...(call.body
        ? {
            body: Readable.toWeb(
              Readable.from(call.body),
            ) as unknown as BodyInit,
            duplex: 'half',
          }
        : {}),
      redirect: 'manual',
    }).catch((error: unknown) => {
      this.logger.warn(
        {
          repository: repository.value,
          path: call.path,
          reason: reasonOf(error),
        },
        'GitHub sent no answer to a git call',
      );
      throw new GitHubUnansweredError(`${call.method} ${call.path}`, error);
    });

    const answered: Record<string, string> = {};
    for (const name of ANSWERED) {
      const value = response.headers.get(name);
      if (value) {
        answered[name] = value;
      }
    }

    return {
      status: response.status,
      headers: answered,
      body: response.body
        ? (Readable.fromWeb(
            response.body as never,
          ) as AsyncIterable<Uint8Array>)
        : null,
    };
  }
}
