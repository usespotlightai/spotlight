import { APPLIED_CONFIGURATION } from '@configuration/application/ports/applied-configuration.port';
import { TEAM_SECRETS } from '@configuration/application/ports/team-secrets.port';
import {
  CONFIGURATION_CONTROLLERS,
  CONFIGURATION_PROVIDERS,
} from '@configuration/configuration.wiring';
import { GitHubModule } from '@github/github.module';
import { IdentityModule } from '@identity/identity.module';
import { Module } from '@nestjs/common';
import { BUILT_IN_SKILLS } from '@work/application/ports/built-in-skills.port';
import { CONFIGURATION_PROPOSALS } from '@work/application/ports/configuration-proposals.port';
import { CONFIGURATION_STATUS } from '@work/application/ports/configuration-status.port';
import { TEAM_SKILLS } from '@work/application/ports/team-skills.port';
import { WorkModule } from '@work/work.module';

@Module({
  imports: [IdentityModule, GitHubModule, WorkModule],
  controllers: [...CONFIGURATION_CONTROLLERS],
  providers: [...CONFIGURATION_PROVIDERS],
  exports: [
    CONFIGURATION_STATUS,
    APPLIED_CONFIGURATION,
    CONFIGURATION_PROPOSALS,
    TEAM_SKILLS,
    TEAM_SECRETS,
    BUILT_IN_SKILLS,
  ],
})
export class ConfigurationModule {}
