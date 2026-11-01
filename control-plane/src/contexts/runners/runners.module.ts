import { IdentityModule } from '@identity/identity.module';
import { Module } from '@nestjs/common';
import { EDITOR_LEASES } from '@runners/application/ports/editor-leases.port';
import { INSTALLER_ASSETS } from '@runners/application/ports/installer-assets.port';
import { RUNNER_AUTHENTICATOR } from '@runners/application/ports/runner-authenticator.port';
import { RUNNER_CONFIGURATION } from '@runners/application/ports/runner-configuration.port';
import { RUNNER_EGRESS } from '@runners/application/ports/runner-egress.port';
import { RUNNER_HEARTBEATS } from '@runners/application/ports/runner-heartbeats.port';
import { RUNNER_POOLS } from '@runners/application/ports/runner-pools.port';
import { RUNNER_READER } from '@runners/application/ports/runner-reader.port';
import { RUNNERS } from '@runners/application/ports/runners.port';
import { SANDBOXES } from '@runners/application/ports/sandboxes.port';
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
    RUNNER_HEARTBEATS,
    RUNNER_READER,
    INSTALLER_ASSETS,
    RUNNER_CONFIGURATION,
    RUNNER_POOLS,
    RUNNERS,
    SANDBOXES,
    EDITOR_LEASES,
    RUNNER_AUTHENTICATOR,
    RUNNER_EGRESS,
  ],
})
export class RunnersModule {}
