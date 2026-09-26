import { IdentityModule } from '@identity/identity.module';
import { Module } from '@nestjs/common';
import { INSTALLER_ASSETS } from '@runners/application/ports/installer-assets.port';
import { RUNNER_ADMISSIONS } from '@runners/application/ports/runner-admissions.port';
import { RUNNER_CONFIGURATION } from '@runners/application/ports/runner-configuration.port';
import { RUNNER_EGRESS } from '@runners/application/ports/runner-egress.port';
import { RUNNER_POOLS } from '@runners/application/ports/runner-pools.port';
import { RUNNER_PRESENCE } from '@runners/application/ports/runner-presence.port';
import { RUNNER_READER } from '@runners/application/ports/runner-reader.port';
import { RUNNERS } from '@runners/application/ports/runners.port';
import {
  RUNNERS_CONTROLLERS,
  RUNNERS_PROVIDERS,
} from '@runners/runners.wiring';
import { SecretsModule } from '@secrets/secrets.module';
import { RUNNER_IDENTITY } from '@shared-kernel/application/ports/runner-identity.port';

@Module({
  imports: [IdentityModule, SecretsModule],
  controllers: [...RUNNERS_CONTROLLERS],
  providers: [...RUNNERS_PROVIDERS],
  exports: [
    RUNNER_IDENTITY,
    RUNNER_PRESENCE,
    RUNNER_READER,
    INSTALLER_ASSETS,
    RUNNER_CONFIGURATION,
    RUNNER_POOLS,
    RUNNERS,
    RUNNER_ADMISSIONS,
    RUNNER_EGRESS,
  ],
})
export class RunnersModule {}
