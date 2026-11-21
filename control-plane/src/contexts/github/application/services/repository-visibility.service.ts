import type { RepositorySettingsPort } from '@github/application/ports/repository-settings.port';
import type {
  RepositoryVisibilityStorePort,
  StoredVisibility,
} from '@github/application/ports/repository-visibility-store.port';
import type {
  RecordsRepositoryVisibility,
  RepositoryVisibilityPort,
} from '@github/application/ports/repository-visibility.port';
import {
  isFresh,
  type RepositoryVisibility,
  VISIBILITY_TTL_MS,
} from '@github/domain/value-objects/repository-visibility.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TelemetryPort } from '@shared-kernel/application/ports/telemetry.port';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const CHECKS_METRIC = 'spotlight.repository_visibility.checks';

const SOURCE = 'spotlight.visibility.source';

const OUTCOME = 'spotlight.visibility.outcome';

export const keyOf = (repository: Repository): string =>
  repository.value.toLowerCase();

export class RepositoryVisibilities
  implements RepositoryVisibilityPort, RecordsRepositoryVisibility
{
  constructor(
    private readonly store: RepositoryVisibilityStorePort,
    private readonly settings: RepositorySettingsPort,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
    private readonly telemetry: TelemetryPort,
  ) {}

  async arePublic(
    workspaceId: WorkspaceId,
    repositories: readonly Repository[],
  ): Promise<boolean> {
    if (repositories.length === 0) {
      return false;
    }

    try {
      const stored = await this.store.find(repositories);

      const answers = await Promise.all(
        repositories.map((each) =>
          this.currentOf(workspaceId, each, stored.get(keyOf(each))),
        ),
      );

      return answers.every((each) => each === 'public');
    } catch (error) {
      this.warn(repositories.map((each) => each.value).join(', '), error);
      return false;
    }
  }

  async record(
    repository: Repository,
    visibility: RepositoryVisibility,
  ): Promise<void> {
    await this.store.save(repository, visibility, this.clock.now());
    this.telemetry.count(CHECKS_METRIC, {
      [SOURCE]: 'webhook',
      [OUTCOME]: 'ok',
    });
  }

  private async currentOf(
    workspaceId: WorkspaceId,
    repository: Repository,
    stored: StoredVisibility | undefined,
  ): Promise<RepositoryVisibility | null> {
    const now = this.clock.now();

    if (stored && isFresh(stored.checkedAt, now, VISIBILITY_TTL_MS)) {
      return stored.visibility;
    }

    try {
      const visibility = await this.settings.visibilityOf(
        workspaceId,
        repository,
      );

      await this.store.save(repository, visibility, now);
      this.telemetry.count(CHECKS_METRIC, {
        [SOURCE]: 'refresh',
        [OUTCOME]: 'ok',
      });

      return visibility;
    } catch (error) {
      this.telemetry.count(CHECKS_METRIC, {
        [SOURCE]: 'refresh',
        [OUTCOME]: 'error',
      });
      this.warn(repository.value, error);

      return null;
    }
  }

  private warn(repository: string, error: unknown): void {
    this.logger.warn(
      {
        repository,
        reason: error instanceof Error ? error.message : String(error),
      },
      'Could not read the visibility of a repository',
    );
  }
}
