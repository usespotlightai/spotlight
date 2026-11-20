import type { WorkspaceSecretDto } from '@secrets/application/dto/workspace-secret.dto';
import type { SecretRecord } from '@secrets/application/ports/secret-resources.port';
import { SecretValueOrigin } from '@secrets/domain/value-objects/secret-value-origin.vo';

export const WorkspaceSecretMapper = {
  toDto(record: SecretRecord, managesSecrets: boolean): WorkspaceSecretDto {
    const origin = SecretValueOrigin.of({
      valueVersion: record.valueVersion,
      holdsValue: record.holdsValue,
    });

    return {
      name: record.name,
      hosts: record.bindings.map((each) => each.host),
      valueOrigin: origin.kind,
      valueSetAt: record.holdsValue ? record.rotatedAt : null,
      settable: managesSecrets && origin.settable,
    };
  },
};
