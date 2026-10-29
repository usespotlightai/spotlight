import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface ConfigFile {
  readonly path: string;
  readonly content: string;
  readonly commit: string;
}

export interface ConfigFileChange {
  readonly path: string;
  readonly content: string;
}

export interface ConfigCommit {
  readonly branch: string;
  readonly base: string;
  readonly replacing: string | null;
  readonly message: string;
  readonly files: readonly ConfigFileChange[];
}

export interface ConfigPullRequestOpening {
  readonly branch: string;
  readonly title: string;
  readonly body: string;
}

export interface OpenedConfigPullRequest {
  readonly url: string;
  readonly number: number;
  readonly gitHubId: number;
  readonly repository: string;
}

export interface ConfigPullRequestAt {
  readonly repository: Repository;
  readonly number: number;
}

export interface ConfigPullRequestStatus {
  readonly state: 'open' | 'closed' | 'merged';
  readonly closedAt: Date | null;
}

export const CONFIG_REPOSITORY = Symbol('CONFIG_REPOSITORY');

export interface ConfigRepositoryPort {
  fileAt(
    workspaceId: WorkspaceId,
    repository: Repository,
    path: string,
    commit?: string,
  ): Promise<ConfigFile | null>;

  filesIn(
    workspaceId: WorkspaceId,
    repository: Repository,
    directory: string,
    commit: string,
  ): Promise<readonly string[]>;

  committed(
    workspaceId: WorkspaceId,
    repository: Repository,
    commit: ConfigCommit,
  ): Promise<string>;

  opened(
    workspaceId: WorkspaceId,
    repository: Repository,
    opening: ConfigPullRequestOpening,
  ): Promise<OpenedConfigPullRequest>;

  statusOf(
    workspaceId: WorkspaceId,
    pullRequest: ConfigPullRequestAt,
  ): Promise<ConfigPullRequestStatus>;

  closed(
    workspaceId: WorkspaceId,
    pullRequest: ConfigPullRequestAt,
  ): Promise<void>;

  commented(
    workspaceId: WorkspaceId,
    pullRequest: ConfigPullRequestAt,
    body: string,
  ): Promise<void>;
}
