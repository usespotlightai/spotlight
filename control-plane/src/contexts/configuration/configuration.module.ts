import { STATION_SOURCE_EDITS } from '@configuration/application/ports/station-source-edits.port';
import { TEAM_SKILL_KEYS } from '@configuration/application/ports/team-skill-keys.port';
import {
  CONFIGURATION_CONTROLLERS,
  CONFIGURATION_PROVIDERS,
} from '@configuration/configuration.wiring';
import { IdentityModule } from '@identity/identity.module';
import { LinesModule } from '@lines/lines.module';
import { Module } from '@nestjs/common';
import { contextBindings } from '@platform/bindings/context-bindings';
import { RunnersModule } from '@runners/runners.module';
import { RunsModule } from '@runs/runs.module';
import { SecretsModule } from '@secrets/secrets.module';
import { BUILT_IN_SKILLS } from '@work/application/ports/built-in-skills.port';
import { STATION_PROFILES } from '@work/application/ports/station-profiles.port';
import { TEAM_SKILLS } from '@work/application/ports/team-skills.port';
import { WorkModule } from '@work/work.module';

const BINDINGS = contextBindings([
  TEAM_SKILLS,
  BUILT_IN_SKILLS,
  STATION_PROFILES,
]);

@Module({
  imports: [
    IdentityModule,
    SecretsModule,
    RunnersModule,
    LinesModule,
    RunsModule,
    WorkModule,
  ],
  controllers: [...CONFIGURATION_CONTROLLERS],
  providers: [...CONFIGURATION_PROVIDERS, ...BINDINGS.exposed],
  exports: [STATION_SOURCE_EDITS, TEAM_SKILL_KEYS, ...BINDINGS.exposedTokens],
})
export class ConfigurationModule {}

@Module({
  imports: [ConfigurationModule],
  providers: [...BINDINGS.bound],
  exports: [...BINDINGS.tokens],
})
export class ConfigurationBindingsModule {}
