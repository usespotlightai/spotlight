import {
  MAX_RUN_SERVICES,
  type RunServiceShape,
} from '@runs/application/contracts/run-spec.contract';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  ComposeFilesPort,
  ServicesAt,
} from '@work/application/ports/compose-files.port';
import {
  type ComposeFile,
  type ServiceToStart,
  servicesToStart,
} from '@work/domain/services/compose-services';

const shapeOf = (service: ServiceToStart): RunServiceShape => ({
  name: service.name,
  image: service.image,
  ...(service.command ? { command: [...service.command] } : {}),
  ...(service.env
    ? { env: service.env.map(({ name, value }) => ({ name, value })) }
    : {}),
  ...(service.health
    ? { health: { ...service.health, test: [...service.health.test] } }
    : {}),
  ...(service.dependsOn ? { dependsOn: [...service.dependsOn] } : {}),
  from: service.from,
});

/**
 * Finds the services a run starts beside its sandbox, from the Compose files of its checkouts. Every path that
 * orders a run with a new spec asks it, so a task, a chat and a replay of a task get services the same way. A
 * checkout whose files cannot be read gives none, and the run is still ordered.
 */
export class RunServices {
  constructor(
    private readonly files: ComposeFilesPort,
    private readonly logger: LoggerPort,
  ) {}

  async of(
    workspaceId: WorkspaceId,
    at: readonly ServicesAt[],
  ): Promise<readonly RunServiceShape[]> {
    const found = await Promise.all(
      at.map((checkout) => this.read(workspaceId, checkout)),
    );
    const { services, leftOut } = servicesToStart(found, MAX_RUN_SERVICES);

    if (leftOut.length > 0) {
      this.logger.info(
        { workspaceId: workspaceId.value, leftOut },
        'Left out services of a Compose file that a run cannot start',
      );
    }
    return services.map(shapeOf);
  }

  private async read(
    workspaceId: WorkspaceId,
    checkout: ServicesAt,
  ): Promise<readonly ComposeFile[]> {
    try {
      return await this.files.at(workspaceId, checkout);
    } catch (error: unknown) {
      this.logger.warn(
        {
          err: error,
          workspaceId: workspaceId.value,
          repository: checkout.repository.value,
        },
        'Ordering the run without the services of its Compose file, which could not be read',
      );
      return [];
    }
  }
}
