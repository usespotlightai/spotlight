import type { BoundSecretShape } from '@secrets/application/ports/bound-secrets.port';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import type { BoundSecret } from '@work/domain/value-objects/bound-secret';

export const BoundSecretMapper = {
  toBound(bound: BoundSecretShape): BoundSecret {
    return {
      name: SecretName.of(bound.name),
      bindings: bound.bindings.map(({ host, location, name, sent }) => ({
        host,
        location,
        name,
        sent,
      })),
      awaitingValue: bound.awaitingValue,
    };
  },
};
