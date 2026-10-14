import { Readable } from 'node:stream';
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
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const GITHUB = 'https://github.com';

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

@Injectable()
export class GitHubGitTransport implements RepositoryGitPort {
  constructor(
    @Inject(REPOSITORY_ACCESS)
    private readonly access: RepositoryAccessPort,
  ) {}

  async call(
    workspaceId: WorkspaceId,
    repository: Repository,
    call: GitCall,
  ): Promise<GitAnswer> {
    const credential = await this.access.credential(workspaceId);
    const upstream = `${GITHUB}/${repository.owner}/${repository.name}.git${call.path}${call.search}`;

    const response = await fetch(upstream, {
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
    } as RequestInit);

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
