import type { SecretResourceDto } from '@secrets/application/dto/secret-resource.dto';
import type { SecretView } from '@secrets/application/ports/secret-configuration.port';
import type { SecretRecord } from '@secrets/application/ports/secret-resources.port';
import { SecretProblems } from '@secrets/application/rendering/secret-problems';
import type { Secret } from '@secrets/domain/aggregates/secret.aggregate';
import { DEFAULT_SECRET_SANDBOX } from '@secrets/domain/value-objects/secret-sandbox.vo';

export const SecretResourceMapper = {
  toDto(secret: SecretRecord, reachesRuns: boolean): SecretResourceDto {
    return {
      id: secret.id,
      version: secret.version,
      address: secret.name,
      workspaceId: secret.workspaceId.value,
      name: secret.name,
      bindings: secret.bindings.map((each) => ({ ...each })),
      sandbox: secret.sandbox,
      valueWoVersion: secret.valueVersion,
      rotatedAt: secret.rotatedAt.toISOString(),
      warnings: reachesRuns ? [] : [SecretProblems.unused()],
    };
  },

  configured(secret: Secret): SecretView {
    return {
      id: secret.id.value,
      address: secret.name.value,
      workspaceId: secret.workspaceId,
      name: secret.name.value,
      bindings: secret.bindings.all.map((each) => ({
        host: each.host.value,
        location: each.target.location,
        name: each.target.name,
        prefix: each.prefix,
      })),
      sandbox:
        secret.sandbox === DEFAULT_SECRET_SANDBOX ? null : secret.sandbox,
      valueVersion: secret.valueVersion?.value ?? null,
    };
  },
};
