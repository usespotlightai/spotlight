import type { SecretResourceDto } from '@secrets/application/dto/secret-resource.dto';
import type { KeptSecret } from '@secrets/application/ports/secret-resources.port';

export const SecretResourceMapper = {
  toDto(secret: KeptSecret): SecretResourceDto {
    return {
      id: secret.id,
      version: secret.version,
      address: secret.name,
      workspaceId: secret.workspaceId.value,
      name: secret.name,
      source: { ...secret.source },
      bindings: secret.bindings.map((each) => ({ ...each })),
      valueWoVersion: secret.valueVersion,
      rotatedAt: secret.rotatedAt.toISOString(),
      warnings: [],
    };
  },
};
