import { IdentityModule } from '@identity/identity.module';
import { Module } from '@nestjs/common';
import { BOUND_SECRETS } from '@secrets/application/ports/bound-secrets.port';
import { CALL_SECRET_FETCHES } from '@secrets/application/ports/call-secret-fetches.port';
import { CREDENTIAL_ENCRYPTION } from '@secrets/application/ports/credential-encryption.port';
import { DEFINED_SECRETS } from '@secrets/application/ports/defined-secrets.port';
import { HARNESS_KEYS } from '@secrets/application/ports/harness-keys.port';
import { HOST_SECRET_FETCHES } from '@secrets/application/ports/host-secret-fetches.port';
import { RUN_GRANTS } from '@secrets/application/ports/run-grants.port';
import { RUN_SECRET_FETCHES } from '@secrets/application/ports/run-secret-fetches.port';
import { SANDBOX_ENV_REVEALS } from '@secrets/application/ports/sandbox-env-reveals.port';
import { SECRET_CONFIGURATION } from '@secrets/application/ports/secret-configuration.port';
import { SECRET_INJECTION } from '@secrets/application/ports/secret-injection.port';
import { SECRET_READINESS } from '@secrets/application/ports/secret-readiness.port';
import { SECRET_USE_LOCKS } from '@secrets/application/ports/secret-use-locks.port';
import { SECRET_USES } from '@secrets/application/ports/secret-uses.port';
import {
  SECRETS_CONTROLLERS,
  SECRETS_PROVIDERS,
} from '@secrets/secrets.wiring';

@Module({
  imports: [IdentityModule],
  controllers: [...SECRETS_CONTROLLERS],
  providers: [...SECRETS_PROVIDERS],
  exports: [
    SECRET_INJECTION,
    CALL_SECRET_FETCHES,
    CREDENTIAL_ENCRYPTION,
    DEFINED_SECRETS,
    HARNESS_KEYS,
    HOST_SECRET_FETCHES,
    RUN_GRANTS,
    RUN_SECRET_FETCHES,
    SANDBOX_ENV_REVEALS,
    SECRET_CONFIGURATION,
    SECRET_READINESS,
    BOUND_SECRETS,
    SECRET_USES,
    SECRET_USE_LOCKS,
  ],
})
export class SecretsModule {}
