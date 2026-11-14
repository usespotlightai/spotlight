import { IdentityModule } from '@identity/identity.module';
import { Module } from '@nestjs/common';
import { EDITOR_LEASES } from '@runners/application/ports/editor-leases.port';
import { IDLE_WORKING_COPIES } from '@runners/application/ports/idle-working-copies.port';
import { INSTALLER_ASSETS } from '@runners/application/ports/installer-assets.port';
import { RUNNER_AUTHENTICATOR } from '@runners/application/ports/runner-authenticator.port';
import { RUNNER_CLAIMANTS } from '@runners/application/ports/runner-claimants.port';
import { RUNNER_CONFIGURATION } from '@runners/application/ports/runner-configuration.port';
import { RUNNER_EGRESS } from '@runners/application/ports/runner-egress.port';
import { RUNNER_POOLS } from '@runners/application/ports/runner-pools.port';
import { RUNNER_READER } from '@runners/application/ports/runner-reader.port';
import { RUNNERS } from '@runners/application/ports/runners.port';
import { SANDBOXES } from '@runners/application/ports/sandboxes.port';
import { WARM_SANDBOXES } from '@runners/application/ports/warm-sandboxes.port';
import {
  RUNNERS_CONTROLLERS,
  RUNNERS_PROVIDERS,
} from '@runners/runners.wiring';
import { SecretsModule } from '@secrets/secrets.module';

@Module({
  imports: [IdentityModule, SecretsModule],
  controllers: [...RUNNERS_CONTROLLERS],
  providers: [...RUNNERS_PROVIDERS],
  exports: [
    RUNNER_CLAIMANTS,
    RUNNER_READER,
    IDLE_WORKING_COPIES,
    INSTALLER_ASSETS,
    RUNNER_CONFIGURATION,
    RUNNER_POOLS,
    RUNNERS,
    SANDBOXES,
    WARM_SANDBOXES,
    EDITOR_LEASES,
    RUNNER_AUTHENTICATOR,
    RUNNER_EGRESS,
  ],
})
export class RunnersModule {}
