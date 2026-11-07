import { STATION_SOURCE_EDITS } from '@configuration/application/ports/station-source-edits.port';
import {
  CONFIGURATION_CONTROLLERS,
  CONFIGURATION_PROVIDERS,
} from '@configuration/configuration.wiring';
import { IdentityModule } from '@identity/identity.module';
import { LinesModule } from '@lines/lines.module';
import { Module } from '@nestjs/common';
import { RunnersModule } from '@runners/runners.module';
import { SecretsModule } from '@secrets/secrets.module';
import { BUILT_IN_SKILLS } from '@work/application/ports/built-in-skills.port';
import { STATION_PROFILES } from '@work/application/ports/station-profiles.port';
import { TEAM_SKILLS } from '@work/application/ports/team-skills.port';
import { WorkModule } from '@work/work.module';

@Module({
  imports: [
    IdentityModule,
    SecretsModule,
    RunnersModule,
    LinesModule,
    WorkModule,
  ],
  controllers: [...CONFIGURATION_CONTROLLERS],
  providers: [...CONFIGURATION_PROVIDERS],
  exports: [
    TEAM_SKILLS,
    BUILT_IN_SKILLS,
    STATION_PROFILES,
    STATION_SOURCE_EDITS,
  ],
})
export class ConfigurationModule {}
