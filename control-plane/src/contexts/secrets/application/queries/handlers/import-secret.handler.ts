import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { SecretResourceDto } from '@secrets/application/dto/secret-resource.dto';
import { SecretResourceMapper } from '@secrets/application/mappers/secret-resource.mapper';
import type { SecretResourcesPort } from '@secrets/application/ports/secret-resources.port';
import type { ImportSecretQuery } from '@secrets/application/queries/import-secret.query';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ImportSecretHandler
  implements QueryHandlerPort<ImportSecretQuery, SecretResourceDto | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly resources: SecretResourcesPort,
  ) {}

  async execute(query: ImportSecretQuery): Promise<SecretResourceDto | null> {
    try {
      const cleared = await this.access.clearanceIn(
        WorkspaceId.of(query.workspaceId),
        query.principal,
      );
      const kept = cleared
        ? await this.resources.named(
            cleared.workspaceId,
            SecretName.of(query.address).value,
          )
        : null;

      return kept ? SecretResourceMapper.toDto(kept) : null;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
