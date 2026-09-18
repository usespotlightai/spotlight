import {
  REPOSITORY_ACCESS,
  type RepositoryAccessPort,
} from '@github/application/ports/repository-access.port';
import type {
  Reading,
  RepositoryContentsPort,
  RepositoryFile,
} from '@github/application/ports/repository-contents.port';
import { answered, call } from '@github/infrastructure/github/github.rest';
import { Inject, Injectable } from '@nestjs/common';
import { UpstreamRefusedError } from '@shared-kernel/domain/exceptions/upstream-refused.error';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const MOST_FILES = 200;
const LONGEST_FILE = 256 * 1024;

interface Entry {
  readonly path?: string;
  readonly type?: string;
  readonly sha?: string;
  readonly size?: number;
}

interface Tree {
  readonly tree?: readonly Entry[];
  readonly truncated?: boolean;
}

interface Blob {
  readonly content?: string;
  readonly encoding?: string;
}

const NOT_FOUND = 404;

const tidied = (path: string): string => path.replace(/^\/+|\/+$/g, '');

const decoded = (blob: Blob): string =>
  blob.encoding === 'base64'
    ? Buffer.from(blob.content ?? '', 'base64').toString('utf8')
    : (blob.content ?? '');

@Injectable()
export class GitHubRepositoryContents implements RepositoryContentsPort {
  constructor(
    @Inject(REPOSITORY_ACCESS)
    private readonly access: RepositoryAccessPort,
  ) {}

  async headOf(
    workspaceId: WorkspaceId,
    repository: Repository,
  ): Promise<string | null> {
    const { password: token } = await this.access.credential(workspaceId);
    const response = await call(`${this.at(repository)}/commits/HEAD`, token);

    if (response.status === NOT_FOUND) {
      return null;
    }

    const found = await answered<{ sha?: string }>(
      response,
      `GitHub would not say where ${repository.value} stands`,
    );

    return found.sha ?? null;
  }

  async read(reading: Reading): Promise<RepositoryFile | null> {
    const token = await this.tokenFor(reading);
    const path = tidied(reading.path);

    const response = await call(
      `${this.at(reading.repository)}/contents/${path}?ref=${encodeURIComponent(reading.ref)}`,
      token,
    );

    if (response.status === NOT_FOUND) {
      return null;
    }

    const found = await answered<Blob & { type?: string; size?: number }>(
      response,
      `GitHub would not read ${path} from ${reading.repository.value}`,
    );

    if (found.type !== 'file') {
      return null;
    }

    this.refuseIfTooLong(path, found.size ?? 0);

    return { path, text: decoded(found) };
  }

  async under(reading: Reading): Promise<readonly RepositoryFile[]> {
    const token = await this.tokenFor(reading);
    const root = tidied(reading.path);

    const response = await call(
      `${this.at(reading.repository)}/git/trees/${encodeURIComponent(reading.ref)}?recursive=1`,
      token,
    );

    if (response.status === NOT_FOUND) {
      return [];
    }

    const tree = await answered<Tree>(
      response,
      `GitHub would not list ${reading.repository.value} at ${reading.ref}`,
    );

    if (tree.truncated) {
      throw new UpstreamRefusedError(
        `reading ${root} from ${reading.repository.value}`,
        'the repository is too large for GitHub to list in one answer',
      );
    }

    const beneath = (tree.tree ?? [])
      .filter(
        (entry): entry is Entry & { path: string; sha: string } =>
          entry.type === 'blob' &&
          !!entry.path &&
          !!entry.sha &&
          (root === '' || entry.path.startsWith(`${root}/`)),
      )
      .sort((one, other) => one.path.localeCompare(other.path));

    if (beneath.length > MOST_FILES) {
      throw new UpstreamRefusedError(
        `reading ${root} from ${reading.repository.value}`,
        `it holds more than ${MOST_FILES} files`,
      );
    }

    for (const entry of beneath) {
      this.refuseIfTooLong(entry.path, entry.size ?? 0);
    }

    // Sequential on purpose, to spare the installation's rate limit.
    const read: RepositoryFile[] = [];

    for (const entry of beneath) {
      read.push({
        path: entry.path,
        text: decoded(
          await answered<Blob>(
            await call(
              `${this.at(reading.repository)}/git/blobs/${entry.sha}`,
              token,
            ),
            `GitHub would not read ${entry.path} from ${reading.repository.value}`,
          ),
        ),
      });
    }

    return read;
  }

  private refuseIfTooLong(path: string, size: number): void {
    if (size > LONGEST_FILE) {
      throw new UpstreamRefusedError(
        `reading ${path}`,
        `it is larger than ${LONGEST_FILE} bytes`,
      );
    }
  }

  private at(repository: Repository): string {
    return `/repos/${repository.owner}/${repository.name}`;
  }

  private async tokenFor(reading: Reading): Promise<string> {
    const { password } = await this.access.credential(reading.workspaceId);

    return password;
  }
}
