import type { SecretResourceDto } from '@secrets/application/dto/secret-resource.dto';
import type { SecretView } from '@secrets/application/ports/secret-configuration.port';
import type { SecretRecord } from '@secrets/application/ports/secret-resources.port';
import type { Secret } from '@secrets/domain/aggregates/secret.aggregate';

export const SecretResourceMapper = {
  toDto(secret: SecretRecord): SecretResourceDto {
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

  configured(secret: Secret): SecretView {
    return {
      id: secret.id.value,
      address: secret.name.value,
      workspaceId: secret.workspaceId,
      name: secret.name.value,
      source: {
        kind: secret.source.kind,
        secretId: secret.source.secretId,
        field: secret.source.field,
      },
      bindings: secret.bindings.all.map((each) => ({
        host: each.host,
        carrier: each.carrier.kind,
        name: each.carrier.name,
        prefix: each.prefix,
      })),
      keepsValue: secret.source.isBuiltIn,
      valueVersion: secret.valueVersion,
    };
  },
};
