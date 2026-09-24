import { IdentityModule } from '@identity/identity.module';
import { Module } from '@nestjs/common';
import { CREDENTIAL_SEALING } from '@secrets/application/ports/credential-sealing.port';
import { DEFINED_SECRETS } from '@secrets/application/ports/defined-secrets.port';
import { RUN_GRANTS } from '@secrets/application/ports/run-grants.port';
import { SECRET_CONFIGURATION } from '@secrets/application/ports/secret-configuration.port';
import { SECRET_INJECTION } from '@secrets/application/ports/secret-injection.port';
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
    CREDENTIAL_SEALING,
    DEFINED_SECRETS,
    RUN_GRANTS,
    SECRET_CONFIGURATION,
  ],
})
export class SecretsModule {}
