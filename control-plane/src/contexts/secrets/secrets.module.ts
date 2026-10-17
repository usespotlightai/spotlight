import { IdentityModule } from '@identity/identity.module';
import { Module } from '@nestjs/common';
import { CREDENTIAL_ENCRYPTION } from '@secrets/application/ports/credential-encryption.port';
import { DEFINED_SECRETS } from '@secrets/application/ports/defined-secrets.port';
import { RUN_GRANTS } from '@secrets/application/ports/run-grants.port';
import { RUN_SECRET_FETCHES } from '@secrets/application/ports/run-secret-fetches.port';
import { SECRET_CONFIGURATION } from '@secrets/application/ports/secret-configuration.port';
import { SECRET_INJECTION } from '@secrets/application/ports/secret-injection.port';
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
    CREDENTIAL_ENCRYPTION,
    DEFINED_SECRETS,
    RUN_GRANTS,
    RUN_SECRET_FETCHES,
    SECRET_CONFIGURATION,
    SECRET_USES,
  ],
})
export class SecretsModule {}
