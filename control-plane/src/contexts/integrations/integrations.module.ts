import { INTEGRATION_LINKS } from '@configuration/application/ports/integration-links.port';
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
import { DELIVERY_ADDRESSES } from '@work/application/ports/delivery-addresses.port';
import { INTEGRATION_TOOL_CALLS } from '@work/application/ports/integration-tool-calls.port';
import { STARTER_INTEGRATIONS } from '@work/application/ports/starter-integrations.port';
import { TASK_NOTICES } from '@work/application/ports/task-notices.port';
import { TEAM_INTEGRATIONS } from '@work/application/ports/team-integrations.port';
import { WorkModule } from '@work/work.module';

@Module({
  imports: [
    DiscoveryModule,
    WorkModule,
    IdentityModule,
    ConfigurationModule,
    GitHubModule,
  ],
  controllers: [...INTEGRATIONS_CONTROLLERS],
  providers: [...INTEGRATIONS_PROVIDERS],
  exports: [
    TEAM_INTEGRATIONS,
    INTEGRATION_LINKS,
    INTEGRATION_READER,
    STARTER_INTEGRATIONS,
    TASK_NOTICES,
    INTEGRATION_TOOL_CALLS,
    DELIVERY_ADDRESSES,
  ],
})
export class IntegrationsModule {}
