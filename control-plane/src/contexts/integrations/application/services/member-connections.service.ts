import type { IntegrationConnectionRepository } from '@integrations/domain/repositories/integration-connection.repository';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class MemberConnections {
  constructor(
    private readonly connections: IntegrationConnectionRepository,
    private readonly logger: LoggerPort,
  ) {}

  async disconnect(workspaceId: WorkspaceId, person: UserId): Promise<void> {
    const owned = await this.connections.ofPerson(workspaceId, person);

    try {
      for (const connection of owned) {
        await this.connections.remove(connection);
      }
    } catch (error) {
      this.logger.warn(
        { err: error, workspaceId: workspaceId.value, userId: person.value },
        'Could not disconnect the connections of a member without access',
      );
      throw error;
    }
  }
}
