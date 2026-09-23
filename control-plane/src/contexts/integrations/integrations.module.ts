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
import { INTEGRATION_TOOL_CALLS } from '@work/application/ports/integration-tool-calls.port';
import { TASK_NOTICES } from '@work/application/ports/task-notices.port';
import { TEAM_INTEGRATIONS } from '@work/application/ports/team-integrations.port';
import { WorkModule } from '@work/work.module';

@Module({
  imports: [
    DiscoveryModule,
    IdentityModule,
    GitHubModule,
    WorkModule,
    ConfigurationModule,
  ],
  controllers: [...INTEGRATIONS_CONTROLLERS],
  providers: [...INTEGRATIONS_PROVIDERS],
  exports: [
    TEAM_INTEGRATIONS,
    INTEGRATION_READER,
    TASK_NOTICES,
    INTEGRATION_TOOL_CALLS,
  ],
})
export class IntegrationsModule {}
