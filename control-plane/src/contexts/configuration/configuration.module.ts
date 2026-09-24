import { APPLIED_CONFIGURATION } from '@configuration/application/ports/applied-configuration.port';
import {
  CONFIGURATION_CONTROLLERS,
  CONFIGURATION_PROVIDERS,
} from '@configuration/configuration.wiring';
import { IdentityModule } from '@identity/identity.module';
import { Module } from '@nestjs/common';
import { SecretsModule } from '@secrets/secrets.module';
import { BUILT_IN_SKILLS } from '@work/application/ports/built-in-skills.port';
import { TEAM_SKILLS } from '@work/application/ports/team-skills.port';
import { WorkModule } from '@work/work.module';

@Module({
  imports: [IdentityModule, SecretsModule, WorkModule],
  controllers: [...CONFIGURATION_CONTROLLERS],
  providers: [...CONFIGURATION_PROVIDERS],
  exports: [APPLIED_CONFIGURATION, TEAM_SKILLS, BUILT_IN_SKILLS],
})
export class ConfigurationModule {}
