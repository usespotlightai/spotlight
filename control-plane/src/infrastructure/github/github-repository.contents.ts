import {
  REPOSITORY_ACCESS,
  type RepositoryAccessPort,
} from '@application/ports/repository-access.port';
import type {
  Reading,
  RepositoryContentsPort,
  RepositoryFile,
} from '@application/ports/repository-contents.port';
import { UpstreamRefusedError } from '@domain/exceptions/upstream-refused.error';
import type { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import type { Repository } from '@domain/value-objects/repository.vo';
import { answered, call } from '@infrastructure/github/github.rest';
import { Inject, Injectable } from '@nestjs/common';

/**
 * What Spotlight will read of a repository. Configuration is written by hand
 * and read on every change, so these are generous for anything a person would
 * write and firm about anything nobody would.
 */
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
  /** GitHub gives up on very large repositories rather than paginating. */
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
    installation: GitHubInstallation,
    repository: Repository,
  ): Promise<string | null> {
    const { password: token } = await this.access.credential(installation);
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

    // Nothing there is an answer, not a failure: configuration is optional.
    if (response.status === NOT_FOUND) {
      return null;
    }

    const found = await answered<Blob & { type?: string; size?: number }>(
      response,
      `GitHub would not read ${path} from ${reading.repository.value}`,
    );

    // A directory asked for as a file answers with a list, which is not one.
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

    // Reading half a directory would look like configuration somebody deleted.
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

    // One at a time: a directory of configuration is a handful of files, and
    // asking for all of them at once is how an installation loses its rate.
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
    const { password } = await this.access.credential(reading.installation);

    return password;
  }
}
