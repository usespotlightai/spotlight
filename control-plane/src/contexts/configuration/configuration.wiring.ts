import { CreateHarnessProfileCommand } from '@configuration/application/commands/create-harness-profile.command';
import { CreateSkillCommand } from '@configuration/application/commands/create-skill.command';
import { DeleteHarnessProfileCommand } from '@configuration/application/commands/delete-harness-profile.command';
import { DeleteSkillCommand } from '@configuration/application/commands/delete-skill.command';
import { CreateHarnessProfileHandler } from '@configuration/application/commands/handlers/create-harness-profile.handler';
import { CreateSkillHandler } from '@configuration/application/commands/handlers/create-skill.handler';
import { DeleteHarnessProfileHandler } from '@configuration/application/commands/handlers/delete-harness-profile.handler';
import { DeleteSkillHandler } from '@configuration/application/commands/handlers/delete-skill.handler';
import { UpdateHarnessProfileHandler } from '@configuration/application/commands/handlers/update-harness-profile.handler';
import { UpdateSkillHandler } from '@configuration/application/commands/handlers/update-skill.handler';
import { UpdateHarnessProfileCommand } from '@configuration/application/commands/update-harness-profile.command';
import { UpdateSkillCommand } from '@configuration/application/commands/update-skill.command';
import {
  APPLIED_CONFIGURATION,
  type AppliedConfigurationPort,
} from '@configuration/application/ports/applied-configuration.port';
import { CONFIGURATION_READER } from '@configuration/application/ports/configuration-reader.port';
import {
  HARNESS_PROFILE_COMPILER,
  type HarnessProfileCompilerPort,
} from '@configuration/application/ports/harness-profile-compiler.port';
import {
  HARNESS_PROFILE_RESOURCES,
  type HarnessProfileResourcesPort,
} from '@configuration/application/ports/harness-profile-resources.port';
import {
  HARNESS_REVIEW,
  type HarnessReviewPort,
} from '@configuration/application/ports/harness-review.port';
import {
  HOOK_CONFIGS,
  type HookConfigsPort,
} from '@configuration/application/ports/hook-configs.port';
import {
  INTEGRATION_CONFIGS,
  type IntegrationConfigsPort,
} from '@configuration/application/ports/integration-configs.port';
import {
  INTEGRATION_READER,
  type IntegrationReaderPort,
} from '@configuration/application/ports/integration-reader.port';
import {
  SECRET_NAMES,
  type SecretNamesPort,
} from '@configuration/application/ports/secret-names.port';
import {
  SKILL_COMPILER,
  type SkillCompilerPort,
} from '@configuration/application/ports/skill-compiler.port';
import {
  SKILL_READER,
  type SkillReaderPort,
} from '@configuration/application/ports/skill-reader.port';
import {
  SKILL_RESOURCES,
  type SkillResourcesPort,
} from '@configuration/application/ports/skill-resources.port';
import { TEAMS } from '@configuration/application/ports/teams.port';
import { ImportHarnessProfileHandler } from '@configuration/application/queries/handlers/import-harness-profile.handler';
import { ImportSkillHandler } from '@configuration/application/queries/handlers/import-skill.handler';
import { ListHarnessProfileResourcesHandler } from '@configuration/application/queries/handlers/list-harness-profile-resources.handler';
import { ListSkillResourcesHandler } from '@configuration/application/queries/handlers/list-skill-resources.handler';
import { ConfigurationHandler } from '@configuration/application/queries/handlers/read-configuration.handler';
import { ReadHarnessProfileHandler } from '@configuration/application/queries/handlers/read-harness-profile.handler';
import { ReadSkillHandler } from '@configuration/application/queries/handlers/read-skill.handler';
import { ResourceConfigurationHandler } from '@configuration/application/queries/handlers/resource-configuration.handler';
import { TeamSkillsHandler } from '@configuration/application/queries/handlers/team-skills.handler';
import { WorkspaceConfigurationHandler } from '@configuration/application/queries/handlers/workspace-configuration.handler';
import { ImportHarnessProfileQuery } from '@configuration/application/queries/import-harness-profile.query';
import { ImportSkillQuery } from '@configuration/application/queries/import-skill.query';
import { ListHarnessProfileResourcesQuery } from '@configuration/application/queries/list-harness-profile-resources.query';
import { ListSkillResourcesQuery } from '@configuration/application/queries/list-skill-resources.query';
import { ConfigurationQuery } from '@configuration/application/queries/read-configuration.query';
import { ReadHarnessProfileQuery } from '@configuration/application/queries/read-harness-profile.query';
import { ReadSkillQuery } from '@configuration/application/queries/read-skill.query';
import { ResourceConfigurationQuery } from '@configuration/application/queries/resource-configuration.query';
import { TeamSkillsQuery } from '@configuration/application/queries/team-skills.query';
import { WorkspaceConfigurationQuery } from '@configuration/application/queries/workspace-configuration.query';
import { AbandonTeamProfiles } from '@configuration/application/services/abandon-team-profiles.service';
import { AbandonTeamSkills } from '@configuration/application/services/abandon-team-skills.service';
import { HarnessProfileViews } from '@configuration/application/services/harness-profile-views.service';
import { HeldConfigurations } from '@configuration/application/services/held-configurations.service';
import { ProfileSecretUses } from '@configuration/application/services/profile-secret-uses.service';
import { SkillViews } from '@configuration/application/services/skill-views.service';
import { StationGifts } from '@configuration/application/services/station-gifts.service';
import { CONFIGURATION_PAYLOAD_TYPES } from '@configuration/domain/payload-types';
import {
  HARNESS_PROFILES,
  type HarnessProfileRepository,
} from '@configuration/domain/repositories/harness-profile.repository';
import type { SkillDefinitionRepository } from '@configuration/domain/repositories/skill-definition.repository';
import { SKILL_DEFINITIONS } from '@configuration/domain/repositories/skill-definition.repository';
import { BuiltInSkills } from '@configuration/infrastructure/acl/built-in-skills.adapter';
import { DefinedConfiguration } from '@configuration/infrastructure/acl/defined-configuration.adapter';
import { HarnessReviewOfWork } from '@configuration/infrastructure/acl/harness-review.adapter';
import { StationProfiles } from '@configuration/infrastructure/acl/station-profiles.adapter';
import { TeamSkills } from '@configuration/infrastructure/acl/team-skills.adapter';
import { Teams } from '@configuration/infrastructure/acl/teams.adapter';
import { WorkspaceSecrets } from '@configuration/infrastructure/acl/workspace-secrets.adapter';
import { DrizzleAppliedSkills } from '@configuration/infrastructure/persistence/drizzle/readers/applied-skills.reader';
import { DrizzleHarnessProfileResources } from '@configuration/infrastructure/persistence/drizzle/readers/harness-profile-resources.reader';
import { DrizzleHarnessProfilesHeld } from '@configuration/infrastructure/persistence/drizzle/readers/harness-profiles-held.reader';
import { DrizzleSkillResources } from '@configuration/infrastructure/persistence/drizzle/readers/skill-resources.reader';
import { DrizzleSkillsHeld } from '@configuration/infrastructure/persistence/drizzle/readers/skills-held.reader';
import { DrizzleHarnessProfiles } from '@configuration/infrastructure/persistence/drizzle/repositories/harness-profiles.repository';
import { DrizzleSkillDefinitions } from '@configuration/infrastructure/persistence/drizzle/repositories/skill-definitions.repository';
import { HarnessProfileCompiler } from '@configuration/infrastructure/profiles/harness-profile.compile';
import { BuiltInSkillFiles } from '@configuration/infrastructure/skills/built-in-skill-files';
import { SkillCompiler } from '@configuration/infrastructure/skills/skill.compile';
import { TeamSkillFiles } from '@configuration/infrastructure/skills/team-skill-files';
import { configurationSubscribers } from '@configuration/presentation/events/configuration.subscribers';
import { ConfigurationController } from '@configuration/presentation/http/controllers/configuration.controller';
import { HarnessProfileResourceController } from '@configuration/presentation/http/controllers/harness-profile-resource.controller';
import { SkillController } from '@configuration/presentation/http/controllers/skill.controller';
import { SkillResourceController } from '@configuration/presentation/http/controllers/skill-resource.controller';
import { TerraformController } from '@configuration/presentation/http/controllers/terraform.controller';
import {
  TEAM_DIRECTORY,
  type TeamDirectoryPort,
} from '@identity/application/ports/team-directory.port';
import {
  TEAM_HOLDINGS,
  type TeamHoldingsPort,
} from '@identity/application/ports/team-holdings.port';
import {
  TOKEN_TRUST_CONFIGURATION,
  type TokenTrustConfigurationPort,
} from '@identity/application/ports/token-trust-configuration.port';
import {
  WORKSPACE_ACCESS,
  type WorkspaceAccessPort,
} from '@identity/application/ports/workspace-access.port';
import { WORKSPACE_READER } from '@identity/application/ports/workspace-reader.port';
import type { Provider, Type } from '@nestjs/common';
import { bindCommandHandler } from '@platform/cqrs/bind-command-handler';
import { bindQueryHandler } from '@platform/cqrs/bind-query-handler';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { PayloadTypes } from '@platform/events/payload-types';
import {
  RUNNER_CONFIGURATION,
  type RunnerConfigurationPort,
} from '@runners/application/ports/runner-configuration.port';
import {
  DEFINED_SECRETS,
  type DefinedSecretsPort,
} from '@secrets/application/ports/defined-secrets.port';
import {
  SECRET_CONFIGURATION,
  type SecretConfigurationPort,
} from '@secrets/application/ports/secret-configuration.port';
import {
  SECRET_USES,
  type SecretUsesPort,
} from '@secrets/application/ports/secret-uses.port';
import { ID_GENERATOR } from '@shared-kernel/application/ports/id-generator.port';
import { IDEMPOTENT_CREATES } from '@shared-kernel/application/ports/idempotent-creates.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { TRANSACTION } from '@shared-kernel/application/ports/transaction.port';
import {
  BUILT_IN_SKILLS,
  SHIPPED_SKILL_KEYS,
} from '@work/application/ports/built-in-skills.port';
import {
  GIVEN_AT_STATIONS,
  type GivenAtStationsPort,
} from '@work/application/ports/given-at-stations.port';
import {
  HARNESS_PROFILE_REVIEW,
  type HarnessProfileReviewPort,
} from '@work/application/ports/harness-profile-review.port';
import {
  LINE_RESOURCES,
  type LineResourcesPort,
} from '@work/application/ports/line-resources.port';
import { STATION_PROFILES } from '@work/application/ports/station-profiles.port';
import { TEAM_SKILLS } from '@work/application/ports/team-skills.port';

const CONFIGURATION_EVENTS = Symbol('CONFIGURATION_EVENTS');

const CONFIGURATION_HOLDINGS = Symbol('CONFIGURATION_HOLDINGS');

const PROFILE_SECRET_USES = Symbol('PROFILE_SECRET_USES');

export const CONFIGURATION_CONTROLLERS: readonly Type[] = [
  ConfigurationController,
  SkillController,
  SkillResourceController,
  HarnessProfileResourceController,
  TerraformController,
];

const upstream: Provider[] = [
  {
    provide: TEAMS,
    inject: [WORKSPACE_ACCESS],
    useFactory: (access: WorkspaceAccessPort) => new Teams(access),
  },
];

const adapters: Provider[] = [
  {
    provide: BUILT_IN_SKILLS,
    inject: [SHIPPED_SKILL_KEYS],
    useFactory: (keys: readonly string[]) =>
      new BuiltInSkills(new BuiltInSkillFiles(keys)),
  },
  { provide: SKILL_READER, useFactory: () => new TeamSkillFiles() },
  {
    provide: SECRET_NAMES,
    inject: [TEAM_DIRECTORY, DEFINED_SECRETS],
    useFactory: (teams: TeamDirectoryPort, secrets: DefinedSecretsPort) =>
      new WorkspaceSecrets(teams, secrets),
  },
  {
    provide: CONFIGURATION_READER,
    inject: [INTEGRATION_READER],
    useFactory: (reader: IntegrationReaderPort) =>
      new DefinedConfiguration(reader),
  },
  { provide: SKILL_COMPILER, useClass: SkillCompiler },
  { provide: SKILL_DEFINITIONS, useClass: DrizzleSkillDefinitions },
  { provide: SKILL_RESOURCES, useClass: DrizzleSkillResources },
  {
    provide: StationGifts,
    inject: [GIVEN_AT_STATIONS],
    useFactory: (given: GivenAtStationsPort) => new StationGifts(given),
  },
  {
    provide: HARNESS_REVIEW,
    inject: [HARNESS_PROFILE_REVIEW],
    useFactory: (harnesses: HarnessProfileReviewPort) =>
      new HarnessReviewOfWork(harnesses),
  },
  {
    provide: HARNESS_PROFILE_COMPILER,
    inject: [HARNESS_REVIEW],
    useFactory: (review: HarnessReviewPort) =>
      new HarnessProfileCompiler(review),
  },
  { provide: HARNESS_PROFILES, useClass: DrizzleHarnessProfiles },
  {
    provide: HARNESS_PROFILE_RESOURCES,
    useClass: DrizzleHarnessProfileResources,
  },
  {
    provide: HarnessProfileViews,
    inject: [TEAM_DIRECTORY, HARNESS_PROFILE_COMPILER],
    useFactory: (
      teams: TeamDirectoryPort,
      compiler: HarnessProfileCompilerPort,
    ) => new HarnessProfileViews(teams, compiler),
  },
  {
    provide: HeldConfigurations,
    inject: [
      TEAM_DIRECTORY,
      LINE_RESOURCES,
      SKILL_RESOURCES,
      INTEGRATION_CONFIGS,
      HOOK_CONFIGS,
      HARNESS_PROFILE_RESOURCES,
      HarnessProfileViews,
      SECRET_CONFIGURATION,
      RUNNER_CONFIGURATION,
      TOKEN_TRUST_CONFIGURATION,
    ],
    useFactory: (
      teams: TeamDirectoryPort,
      lines: LineResourcesPort,
      skills: SkillResourcesPort,
      integrations: IntegrationConfigsPort,
      hooks: HookConfigsPort,
      profiles: HarnessProfileResourcesPort,
      profileViews: HarnessProfileViews,
      secrets: SecretConfigurationPort,
      runners: RunnerConfigurationPort,
      tokenTrusts: TokenTrustConfigurationPort,
    ) =>
      new HeldConfigurations(
        teams,
        lines,
        skills,
        integrations,
        hooks,
        profiles,
        profileViews,
        secrets,
        runners,
        tokenTrusts,
      ),
  },
  {
    provide: SkillViews,
    inject: [TEAM_DIRECTORY, SKILL_COMPILER],
    useFactory: (teams: TeamDirectoryPort, compiler: SkillCompilerPort) =>
      new SkillViews(teams, compiler),
  },
];

const handlers: Provider[] = [
  ...bindQueryHandler(ConfigurationQuery, ConfigurationHandler, [
    TEAMS,
    CONFIGURATION_READER,
  ]),
  ...bindQueryHandler(TeamSkillsQuery, TeamSkillsHandler, [
    TEAMS,
    APPLIED_CONFIGURATION,
    SKILL_READER,
  ]),
  ...bindCommandHandler(CreateSkillCommand, CreateSkillHandler, [
    WORKSPACE_ACCESS,
    TEAM_DIRECTORY,
    SKILL_COMPILER,
    SKILL_DEFINITIONS,
    IDEMPOTENT_CREATES,
    ID_GENERATOR,
    TRANSACTION,
  ]),
  ...bindCommandHandler(UpdateSkillCommand, UpdateSkillHandler, [
    WORKSPACE_ACCESS,
    SKILL_COMPILER,
    SKILL_DEFINITIONS,
    TRANSACTION,
  ]),
  ...bindCommandHandler(DeleteSkillCommand, DeleteSkillHandler, [
    WORKSPACE_ACCESS,
    SKILL_DEFINITIONS,
    StationGifts,
    TRANSACTION,
  ]),
  ...bindCommandHandler(
    CreateHarnessProfileCommand,
    CreateHarnessProfileHandler,
    [
      WORKSPACE_ACCESS,
      TEAM_DIRECTORY,
      HARNESS_PROFILE_COMPILER,
      SECRET_NAMES,
      HARNESS_PROFILES,
      IDEMPOTENT_CREATES,
      ID_GENERATOR,
      TRANSACTION,
    ],
  ),
  ...bindCommandHandler(
    UpdateHarnessProfileCommand,
    UpdateHarnessProfileHandler,
    [
      WORKSPACE_ACCESS,
      HARNESS_PROFILE_COMPILER,
      SECRET_NAMES,
      HARNESS_PROFILES,
      TRANSACTION,
    ],
  ),
  ...bindCommandHandler(
    DeleteHarnessProfileCommand,
    DeleteHarnessProfileHandler,
    [WORKSPACE_ACCESS, HARNESS_PROFILES, StationGifts, TRANSACTION],
  ),
  ...bindQueryHandler(ReadHarnessProfileQuery, ReadHarnessProfileHandler, [
    WORKSPACE_ACCESS,
    HARNESS_PROFILE_RESOURCES,
    HarnessProfileViews,
  ]),
  ...bindQueryHandler(ImportHarnessProfileQuery, ImportHarnessProfileHandler, [
    WORKSPACE_ACCESS,
    TEAM_DIRECTORY,
    HARNESS_PROFILE_RESOURCES,
    HarnessProfileViews,
  ]),
  ...bindQueryHandler(
    ListHarnessProfileResourcesQuery,
    ListHarnessProfileResourcesHandler,
    [
      WORKSPACE_ACCESS,
      TEAM_DIRECTORY,
      HARNESS_PROFILE_RESOURCES,
      HarnessProfileViews,
    ],
  ),
  ...bindQueryHandler(ReadSkillQuery, ReadSkillHandler, [
    WORKSPACE_ACCESS,
    SKILL_RESOURCES,
    SkillViews,
  ]),
  ...bindQueryHandler(
    WorkspaceConfigurationQuery,
    WorkspaceConfigurationHandler,
    [WORKSPACE_ACCESS, WORKSPACE_READER, HeldConfigurations],
  ),
  ...bindQueryHandler(
    ResourceConfigurationQuery,
    ResourceConfigurationHandler,
    [
      WORKSPACE_ACCESS,
      WORKSPACE_READER,
      TEAM_DIRECTORY,
      LINE_RESOURCES,
      SKILL_RESOURCES,
      INTEGRATION_CONFIGS,
      HOOK_CONFIGS,
      HARNESS_PROFILE_RESOURCES,
      SECRET_CONFIGURATION,
      RUNNER_CONFIGURATION,
      TOKEN_TRUST_CONFIGURATION,
      HeldConfigurations,
    ],
  ),
  ...bindQueryHandler(ImportSkillQuery, ImportSkillHandler, [
    WORKSPACE_ACCESS,
    TEAM_DIRECTORY,
    SKILL_RESOURCES,
    SkillViews,
  ]),
  ...bindQueryHandler(ListSkillResourcesQuery, ListSkillResourcesHandler, [
    WORKSPACE_ACCESS,
    TEAM_DIRECTORY,
    SKILL_RESOURCES,
    SkillViews,
  ]),
];

const published: Provider[] = [
  { provide: APPLIED_CONFIGURATION, useClass: DrizzleAppliedSkills },
  DrizzleSkillsHeld,
  DrizzleHarnessProfilesHeld,
  {
    provide: CONFIGURATION_HOLDINGS,
    inject: [TEAM_HOLDINGS, DrizzleSkillsHeld, DrizzleHarnessProfilesHeld],
    useFactory: (
      holdings: TeamHoldingsPort,
      skills: DrizzleSkillsHeld,
      profiles: DrizzleHarnessProfilesHeld,
    ) => {
      holdings.register(skills);
      holdings.register(profiles);
      return true;
    },
  },
  {
    provide: PROFILE_SECRET_USES,
    inject: [SECRET_USES, TEAM_DIRECTORY, HARNESS_PROFILES],
    useFactory: (
      uses: SecretUsesPort,
      teams: TeamDirectoryPort,
      profiles: HarnessProfileRepository,
    ) => {
      uses.register(new ProfileSecretUses(teams, profiles));
      return true;
    },
  },
  {
    provide: STATION_PROFILES,
    inject: [HARNESS_PROFILE_RESOURCES, HARNESS_PROFILE_COMPILER],
    useFactory: (
      resources: HarnessProfileResourcesPort,
      compiler: HarnessProfileCompilerPort,
    ) => new StationProfiles(resources, compiler),
  },
  {
    provide: TEAM_SKILLS,
    inject: [APPLIED_CONFIGURATION, SKILL_READER, SECRET_NAMES],
    useFactory: (
      applied: AppliedConfigurationPort,
      reader: SkillReaderPort,
      secrets: SecretNamesPort,
    ) => new TeamSkills(applied, reader, secrets),
  },
];

export const CONFIGURATION_PROVIDERS: readonly Provider[] = [
  {
    provide: CONFIGURATION_EVENTS,
    inject: [
      PayloadTypes,
      EventSubscribers,
      SKILL_DEFINITIONS,
      HARNESS_PROFILES,
      TRANSACTION,
    ],
    useFactory: (
      types: PayloadTypes,
      subscribers: EventSubscribers,
      skills: SkillDefinitionRepository,
      profiles: HarnessProfileRepository,
      transaction: TransactionPort,
    ) => {
      types.register('configuration', CONFIGURATION_PAYLOAD_TYPES);
      subscribers.register(
        configurationSubscribers(
          new AbandonTeamSkills(skills, transaction),
          new AbandonTeamProfiles(profiles, transaction),
        ),
      );
      return true;
    },
  },
  ...upstream,
  ...adapters,
  ...handlers,
  ...published,
];
