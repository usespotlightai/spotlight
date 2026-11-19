import type { PublicChangeStackDto } from '@change-review/application/dto/change-stack.dto';
import type { ChangeStackReaderPort } from '@change-review/application/ports/change-stack-reader.port';
import type { RepositoryVisibilityPort } from '@change-review/application/ports/repository-visibility.port';
import type { WorkPort } from '@change-review/application/ports/work.port';
import type { StackVisibility } from '@change-review/domain/value-objects/stack-visibility.vo';
import type { TelemetryPort } from '@shared-kernel/application/ports/telemetry.port';
import { InvalidRepositoryError } from '@shared-kernel/domain/exceptions/invalid-repository.error';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const READS_METRIC = 'spotlight.public_stack.reads';

const OUTCOME = 'spotlight.public_stack.outcome';

const repositoriesOf = (
  stacks: readonly PublicChangeStackDto[],
): Repository[] | null => {
  const repositories: Repository[] = [];

  for (const { repository } of stacks) {
    if (repository === null) {
      return null;
    }

    try {
      repositories.push(Repository.of(repository));
    } catch (error) {
      if (error instanceof InvalidRepositoryError) {
        return null;
      }
      throw error;
    }
  }

  return repositories;
};

export class PublicWorkAccess {
  constructor(
    private readonly work: WorkPort,
    private readonly stacks: ChangeStackReaderPort,
    private readonly visibility: RepositoryVisibilityPort,
    private readonly telemetry: TelemetryPort,
  ) {}

  async stacksOf(
    visibility: StackVisibility,
  ): Promise<readonly PublicChangeStackDto[] | null> {
    const stacks = await this.publicStacksOf(visibility);

    this.telemetry.count(READS_METRIC, {
      [OUTCOME]: stacks ? 'served' : 'denied',
    });

    return stacks;
  }

  private async publicStacksOf(
    visibility: StackVisibility,
  ): Promise<readonly PublicChangeStackDto[] | null> {
    const workspaceId = await this.workspaceOf(visibility);

    if (!workspaceId) {
      return null;
    }

    const stacks =
      visibility.kind === 'task'
        ? await this.stacks.publicOfTask(visibility.taskId)
        : await this.stacks.publicOfRun(visibility.runId);
    const repositories = repositoriesOf(stacks);

    return repositories &&
      (await this.visibility.arePublic(workspaceId, repositories))
      ? stacks
      : null;
  }

  private async workspaceOf(
    visibility: StackVisibility,
  ): Promise<WorkspaceId | null> {
    const found =
      visibility.kind === 'task'
        ? await this.work.task(visibility.taskId)
        : await this.work.run(visibility.runId);

    return found?.workspaceId ?? null;
  }
}
