import { HELD_INTEGRATIONS } from '@configuration/application/ports/held-integrations.port';
import { INTEGRATION_READER } from '@configuration/application/ports/integration-reader.port';
import { ConfigurationModule } from '@configuration/configuration.module';
import { GitHubModule } from '@github/github.module';
import { IdentityModule } from '@identity/identity.module';
import {
  INTEGRATIONS_CONTROLLERS,
  INTEGRATIONS_PROVIDERS,
} from '@integrations/integrations.wiring';
import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { SECRET_USES } from '@secrets/application/ports/secret-uses.port';
import { SecretsModule } from '@secrets/secrets.module';
import { INTEGRATION_TOOL_CALLS } from '@work/application/ports/integration-tool-calls.port';
import { TASK_NOTICES } from '@work/application/ports/task-notices.port';
import { TEAM_INTEGRATIONS } from '@work/application/ports/team-integrations.port';
import { WorkModule } from '@work/work.module';

@Module({
  imports: [
    DiscoveryModule,
    IdentityModule,
    SecretsModule,
    GitHubModule,
    WorkModule,
    ConfigurationModule,
  ],
  controllers: [...INTEGRATIONS_CONTROLLERS],
  providers: [...INTEGRATIONS_PROVIDERS],
  exports: [
    TEAM_INTEGRATIONS,
    INTEGRATION_READER,
    HELD_INTEGRATIONS,
    TASK_NOTICES,
    INTEGRATION_TOOL_CALLS,
    SECRET_USES,
  ],
})
export class IntegrationsModule {}
