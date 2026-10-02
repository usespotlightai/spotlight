import { BranchTakenError } from '@github/application/errors/branch-taken.error';
import { RepositoryFileUnwritableError } from '@github/application/errors/repository-file-unwritable.error';
import { RepositoryUnreachableError } from '@github/application/errors/repository-unreachable.error';
import type { RepositoryAccessPort } from '@github/application/ports/repository-access.port';
import type {
  RepositoryCommit,
  RepositoryContentsPort,
  RepositoryFileDto,
} from '@github/application/ports/repository-contents.port';
import {
  answered,
  call,
  sending,
} from '@github/infrastructure/github/github.rest';
import { UpstreamRefusedError } from '@shared-kernel/domain/exceptions/upstream-refused.error';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const NOT_FOUND = 404;

const FORBIDDEN = 403;

const UNPROCESSABLE = 422;

const FILE_MODE = '100644';

const SYMLINK_MODE = '120000';

interface TreeEntry {
  readonly path?: string;
  readonly mode?: string;
  readonly type?: string;
  readonly sha?: string;
}

interface Tree {
  readonly tree?: TreeEntry[];
}

interface Ref {
  readonly object?: Sha;
}

interface Contents {
  readonly type?: string;
  readonly path?: string;
  readonly encoding?: string;
  readonly content?: string;
  readonly sha?: string;
}

interface Sha {
  readonly sha?: string;
}

interface BlobContents {
  readonly content: string;
}

interface Commit {
  readonly tree?: Sha;
}

const decoded = (base64: string): string =>
  Buffer.from(base64, 'base64').toString('utf8');

const shaOf = (answer: Sha, asking: string): string => {
  if (!answer.sha) {
    throw new UpstreamRefusedError(asking, 'GitHub answered without a sha');
  }

  return answer.sha;
};

const pathIn = (path: string): string =>
  path.split('/').map(encodeURIComponent).join('/');

export class GitHubRepositoryContents implements RepositoryContentsPort {
  constructor(private readonly access: RepositoryAccessPort) {}

  async fileAt(
    workspaceId: WorkspaceId,
    repository: Repository,
    path: string,
    ref?: string,
  ): Promise<RepositoryFileDto | null> {
    const token = await this.tokenFor(workspaceId);
    const defaultBranch = await this.defaultBranch(repository, token);
    const commit = shaOf(
      await answered<Sha>(
        await call(
          `${this.at(repository)}/commits/${encodeURIComponent(ref ?? defaultBranch)}`,
          token,
        ),
        `GitHub would not say where ${ref ?? defaultBranch} of ${repository.value} stands`,
      ),
      'reading a commit',
    );
    const response = await call(
      `${this.at(repository)}/contents/${pathIn(path)}?ref=${commit}`,
      token,
    );

    if (response.status === NOT_FOUND) {
      return null;
    }

    const found = await answered<Contents>(
      response,
      `GitHub would not hand over ${path} in ${repository.value}`,
    );

    if (found.type === 'symlink' || (found.path && found.path !== path)) {
      throw new RepositoryFileUnwritableError(path);
    }
    if (found.type !== 'file' || !found.sha) {
      return null;
    }

    const content =
      found.encoding === 'base64' && found.content !== undefined
        ? decoded(found.content)
        : await this.blob(repository, found.sha, token);

    return { content, blobSha: found.sha, commit, defaultBranch };
  }

  async committed(
    workspaceId: WorkspaceId,
    repository: Repository,
    commit: RepositoryCommit,
  ): Promise<string> {
    const token = await this.tokenFor(workspaceId);
    const base = await answered<Commit>(
      await call(`${this.at(repository)}/git/commits/${commit.base}`, token),
      `GitHub would not hand over the commit ${commit.base}`,
    );
    const baseTree = shaOf(base.tree ?? {}, 'reading the base tree');
    const tree = [];

    for (const file of commit.files) {
      const mode = await this.modeOf(repository, baseTree, file.path, token);

      if (mode === SYMLINK_MODE) {
        throw new RepositoryFileUnwritableError(file.path);
      }

      tree.push({
        path: file.path,
        mode: mode ?? FILE_MODE,
        type: 'blob',
        sha: shaOf(
          await answered<Sha>(
            await call(
              `${this.at(repository)}/git/blobs`,
              token,
              sending({ content: file.content, encoding: 'utf-8' }),
            ),
            `GitHub would not take ${file.path}`,
          ),
          'writing a blob',
        ),
      });
    }

    const written = shaOf(
      await answered<Sha>(
        await call(
          `${this.at(repository)}/git/trees`,
          token,
          sending({ base_tree: baseTree, tree }),
        ),
        'GitHub would not take the changed tree',
      ),
      'writing a tree',
    );
    const committed = shaOf(
      await answered<Sha>(
        await call(
          `${this.at(repository)}/git/commits`,
          token,
          sending({
            message: commit.message,
            tree: written,
            parents: [commit.base],
          }),
        ),
        'GitHub would not take the commit',
      ),
      'writing a commit',
    );

    await this.pointed(repository, commit, committed, token);

    return committed;
  }

  private async modeOf(
    repository: Repository,
    rootTree: string,
    path: string,
    token: string,
  ): Promise<string | null> {
    let tree = rootTree;
    const steps = path.split('/');

    for (const [at, step] of steps.entries()) {
      const listed = await answered<Tree>(
        await call(`${this.at(repository)}/git/trees/${tree}`, token),
        `GitHub would not list the tree holding ${path}`,
      );
      const entry = (listed.tree ?? []).find((each) => each.path === step);

      if (!entry?.sha) {
        return null;
      }
      if (at === steps.length - 1) {
        return entry.mode ?? null;
      }
      if (entry.type !== 'tree') {
        return null;
      }

      tree = entry.sha;
    }

    return null;
  }

  private async pointed(
    repository: Repository,
    commit: RepositoryCommit,
    sha: string,
    token: string,
  ): Promise<void> {
    const { branch } = commit;
    const created = await call(
      `${this.at(repository)}/git/refs`,
      token,
      sending({ ref: `refs/heads/${branch}`, sha }),
    );

    if (created.status !== UNPROCESSABLE) {
      await answered(created, `GitHub would not open the branch ${branch}`);
      return;
    }

    const head = (
      await answered<Ref>(
        await call(
          `${this.at(repository)}/git/ref/heads/${pathIn(branch)}`,
          token,
        ),
        `GitHub would not say where ${branch} stands`,
      )
    ).object?.sha;

    if (head !== commit.base && head !== commit.replacing) {
      throw new BranchTakenError(branch);
    }

    await answered(
      await call(
        `${this.at(repository)}/git/refs/heads/${pathIn(branch)}`,
        token,
        { method: 'PATCH', body: JSON.stringify({ sha, force: true }) },
      ),
      `GitHub would not move the branch ${branch}`,
    );
  }

  private async blob(
    repository: Repository,
    sha: string,
    token: string,
  ): Promise<string> {
    const found = await answered<BlobContents>(
      await call(`${this.at(repository)}/git/blobs/${sha}`, token),
      `GitHub would not hand over the blob ${sha}`,
    );

    return decoded(found.content);
  }

  private async defaultBranch(
    repository: Repository,
    token: string,
  ): Promise<string> {
    const response = await call(this.at(repository), token);

    if (response.status === NOT_FOUND || response.status === FORBIDDEN) {
      throw new RepositoryUnreachableError(repository.value);
    }

    const found = await answered<{ default_branch: string }>(
      response,
      `GitHub would not say what ${repository.value} merges into`,
    );

    return found.default_branch;
  }

  private at(repository: Repository): string {
    return `/repos/${repository.owner}/${repository.name}`;
  }

  private async tokenFor(workspaceId: WorkspaceId): Promise<string> {
    const { password } = await this.access.credential(workspaceId);

    return password;
  }
}
