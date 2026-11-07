import { HOOK_CONFIGS } from '@configuration/application/ports/hook-configs.port';
import { INTEGRATION_CONFIGS } from '@configuration/application/ports/integration-configs.port';
import { ConfigurationModule } from '@configuration/configuration.module';
import { GitHubModule } from '@github/github.module';
import { IdentityModule } from '@identity/identity.module';
import { HOOKS_CONTROLLERS, HOOKS_PROVIDERS } from '@integrations/hooks.wiring';
import {
  INTEGRATIONS_CONTROLLERS,
  INTEGRATIONS_PROVIDERS,
} from '@integrations/integrations.wiring';
import { LinesModule } from '@lines/lines.module';
import { Module } from '@nestjs/common';
import { contextBindings } from '@platform/bindings/context-bindings';
import { RunsModule } from '@runs/runs.module';
import { SecretsModule } from '@secrets/secrets.module';
import { CHANNEL_NOTICES } from '@work/application/ports/channel-notices.port';
import { INTEGRATION_TOOL_CALLS } from '@work/application/ports/integration-tool-calls.port';
import { LIFECYCLE_HOOKS } from '@work/application/ports/lifecycle-hooks.port';
import { TASK_NOTICES } from '@work/application/ports/task-notices.port';
import { TEAM_INTEGRATIONS } from '@work/application/ports/team-integrations.port';
import { WorkModule } from '@work/work.module';

const BINDINGS = contextBindings([
  TEAM_INTEGRATIONS,
  INTEGRATION_CONFIGS,
  HOOK_CONFIGS,
  TASK_NOTICES,
  CHANNEL_NOTICES,
  INTEGRATION_TOOL_CALLS,
  LIFECYCLE_HOOKS,
]);

@Module({
  imports: [
    IdentityModule,
    SecretsModule,
    GitHubModule,
    LinesModule,
    RunsModule,
    WorkModule,
    ConfigurationModule,
  ],
  controllers: [...INTEGRATIONS_CONTROLLERS, ...HOOKS_CONTROLLERS],
  providers: [
    ...INTEGRATIONS_PROVIDERS,
    ...HOOKS_PROVIDERS,
    ...BINDINGS.exposed,
  ],
  exports: [...BINDINGS.exposedTokens],
})
class IntegrationsModule {}

@Module({
  imports: [IntegrationsModule],
  providers: [...BINDINGS.bound],
  exports: [...BINDINGS.tokens],
})
export class IntegrationsBindingsModule {}
