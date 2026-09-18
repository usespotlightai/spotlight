import { IdentityModule } from '@identity/identity.module';
import { Module } from '@nestjs/common';
import { INSTALLER_ASSETS } from '@runners/application/ports/installer-assets.port';
import { RUNNER_PRESENCE } from '@runners/application/ports/runner-presence.port';
import { RUNNER_READER } from '@runners/application/ports/runner-reader.port';
import {
  RUNNERS_CONTROLLERS,
  RUNNERS_PROVIDERS,
} from '@runners/runners.wiring';
import { RUNNER_IDENTITY } from '@shared-kernel/application/ports/runner-identity.port';

@Module({
  imports: [IdentityModule],
  controllers: [...RUNNERS_CONTROLLERS],
  providers: [...RUNNERS_PROVIDERS],
  exports: [RUNNER_IDENTITY, RUNNER_PRESENCE, RUNNER_READER, INSTALLER_ASSETS],
})
export class RunnersModule {}
